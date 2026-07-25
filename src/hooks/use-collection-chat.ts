import { useCallback, useEffect, useState } from "react";
import { liveQuery } from "dexie";
import { toast } from "sonner";
import { getUserDb, type CollectionMessage } from "@/lib/db";
import { askChatModel, type ChatTurn } from "@/lib/ai-chat";
import { retrieveRelevantChunks, type RetrievableDocument } from "@/lib/retrieval";
import { useAuth } from "@/hooks/use-auth";
import { callGeminiWithPrompt, CloudUnavailableError } from "@/lib/ai-cloud";
import { stripEmDash } from "@/lib/text-clean";

function collectionMessageKey(collectionId: string, id: string): string {
  return `${collectionId}::${id}`;
}

/** Every message in one collection's conversation, oldest first — a
 * separate thread per collection (see CollectionMessage), not the
 * general assistant's single account-wide thread. */
export function useCollectionMessages(collectionId: string): CollectionMessage[] {
  const { user } = useAuth();
  const [messages, setMessages] = useState<CollectionMessage[]>([]);

  useEffect(() => {
    if (!user) {
      setMessages([]);
      return;
    }
    const db = getUserDb(user.id);
    const sub = liveQuery(() =>
      db.collectionMessages.where("collectionId").equals(collectionId).sortBy("timestamp"),
    ).subscribe({
      next: setMessages,
      error: (err) => console.error("Failed to read collection messages", err),
    });
    return () => sub.unsubscribe();
  }, [user, collectionId]);

  return messages;
}

// Same structure instruction and reasoning as use-ai-chat.ts's
// SYSTEM_PROMPT (see its own comment) — shared vocabulary with
// StructuredText.tsx, harmless for the on-device model if not followed
// (falls back to plain paragraphs), a real readability gain when it is.
const BASE_INSTRUCTIONS =
  "You are a study assistant helping a student understand their own documents in this collection. " +
  'When it genuinely helps (multi-part answers, steps, comparisons, several examples), structure your answer with a line starting "# " for a heading, "## " for a sub-heading, and "- " for a bullet point, each block separated by a blank line. Don\'t force this structure onto a short, simple answer that reads fine as plain text. ' +
  'Never use an em dash (—); use a comma, a period, or "and"/"but" instead.';

// Same reasoning as useSendAssistantMessage — a small on-device model has
// a limited practical context window and gets slower with every extra
// token sent.
const MAX_HISTORY_MESSAGES = 10;

// Same reasoning as use-ai-chat.ts's identical helper — Gemini's
// generateContent takes one prompt string, not a native multi-turn
// `contents` array.
function buildCloudChatPrompt(turns: ChatTurn[]): string {
  const system = turns.find((t) => t.role === "system")?.content ?? "";
  const transcript = turns
    .filter((t) => t.role !== "system")
    .map((t) => `${t.role === "user" ? "Student" : "Assistant"}: ${t.content}`)
    .join("\n\n");
  return `${system}\n\n${transcript}\n\nAssistant:`;
}

// See isConfident below — a chunk scoring 1 shares only a single word with
// the question, easy to hit by coincidence (a name, a stray noun) rather
// than genuine relevance. Requiring 2 cuts most of that noise out.
const MIN_CONFIDENT_SCORE = 2;

// Real, reported gap: documents.$docId.chat.tsx (a single document's own
// chat) reuses this same hook with a one-element `documents` array. Every
// question there ran through the exact same keyword-overlap retrieval
// built for a genuine multi-document *collection* — but a question like
// "explain this like I'm 5" or "what does this say about X" shares zero
// keywords with the document's own text (it's a style/phrasing
// instruction or a paraphrase, not a quote from the source), so it always
// scored below MIN_CONFIDENT_SCORE and hit the deterministic
// "couldn't find anything" fallback, even though the student had just
// clicked into that exact document and every question is obviously about
// it. Retrieval-with-a-confidence-gate exists to handle *ambiguity* over
// which of several documents (and which part of them) a question is
// about — there is no such ambiguity with exactly one document, so this
// case skips retrieval entirely and grounds on the whole document instead
// (below `MAX_SINGLE_DOCUMENT_CHARS`, generous for this app's actual
// document sizes — a handful of short PDFs, not a lecture-series corpus).
const MAX_SINGLE_DOCUMENT_CHARS = 8000;

// Real, reported gap: a student asking "what module is this" or "what doc
// is this" got the same generic "I couldn't find anything" retrieval-miss
// response as a genuinely unanswerable question like "is it good" — but
// this one isn't unanswerable at all, the app already knows the title(s)
// perfectly well; keyword-overlap retrieval (retrieval.ts) just has no
// reason to ever find a chunk of *content* for a question that's really
// asking about the document's own identity, not something written inside
// it. Checked before retrieval runs at all, not folded into the
// low-confidence fallback — answered directly from `documents` rather
// than run through the model (on-device or cloud) at all, since there's
// nothing to generate here, only a fact to state.
const META_IDENTITY_PATTERNS = [
  /\b(what|which)\s+(module|document|doc|file|collection)\s+(is|am\s+i\s+in)\s+this\b/i,
  /\bwhat\s+is\s+this\s+(module|document|doc|file|collection)\b/i,
  /\bwhat('?s| is)\s+in\s+this\s+(module|document|doc|file|collection)\b/i,
];

function isMetaIdentityQuestion(query: string): boolean {
  return META_IDENTITY_PATTERNS.some((pattern) => pattern.test(query));
}

function describeDocuments(documents: RetrievableDocument[]): string {
  if (documents.length === 0) {
    return "This doesn't have any documents yet, so there's nothing to show.";
  }
  if (documents.length === 1) {
    return `This is "${documents[0].title}".`;
  }
  return `This contains: ${documents.map((d) => `"${d.title}"`).join(", ")}.`;
}

/** Reuses the same on-device chat model as the general "Ask AI" assistant
 * (Phase I1) — there is no separate download for this, since it's the
 * same engine grounded with different context per turn. See
 * src/lib/retrieval.ts for why grounding is keyword-overlap, not
 * embeddings. */
export function useSendCollectionMessage(collectionId: string, documents: RetrievableDocument[]) {
  const { user } = useAuth();
  const [sending, setSending] = useState(false);
  const [streamingText, setStreamingText] = useState("");

  const sendMessage = useCallback(
    async (content: string) => {
      const trimmed = content.trim();
      if (!user || !trimmed || sending) return;
      const db = getUserDb(user.id);
      const now = Date.now();
      const userMessageId = crypto.randomUUID();
      await db.collectionMessages.put({
        key: collectionMessageKey(collectionId, userMessageId),
        id: userMessageId,
        collectionId,
        role: "user",
        content: trimmed,
        timestamp: now,
      });

      setSending(true);
      setStreamingText("");
      try {
        const isSingleDocument = documents.length === 1;
        const chunks =
          isMetaIdentityQuestion(trimmed) || isSingleDocument
            ? []
            : retrieveRelevantChunks(documents, trimmed);
        // Requiring zero chunks was too narrow a guard: a question can
        // retrieve one or two chunks that only share a single incidental
        // word with the query (score 1) — barely related, not a real
        // match — and the small on-device model, handed that weak context,
        // showed the exact same failure mode as the true zero-chunk case
        // (a vague, self-referential non-answer) even with an explicit
        // instruction not to. MIN_CONFIDENT_SCORE requires the *best*
        // chunk to share at least two real words with the question before
        // trusting the model with it — otherwise it's treated the same
        // deterministic way as no match at all. Doesn't apply to a single
        // document at all — see MAX_SINGLE_DOCUMENT_CHARS's own comment.
        const isConfident =
          isSingleDocument || (chunks.length > 0 && chunks[0].score >= MIN_CONFIDENT_SCORE);
        let response: string;

        if (isMetaIdentityQuestion(trimmed)) {
          response = describeDocuments(documents);
        } else if (!isConfident) {
          // Deterministic, not model-generated, for this specific case —
          // real testing found the small on-device model unreliable here
          // even with an explicit instruction not to: given nothing
          // concrete to ground an answer in (e.g. a generic request like
          // "read the files," which has no keyword overlap with actual
          // content and so retrieves nothing), it tended to produce a
          // vague, hedging, self-referential non-answer instead of
          // actually helping. This is the same "extraction is more
          // reliable than a small model for this exact case" tradeoff
          // Feature 5's summarizer and generateFlashcards() already make
          // elsewhere — a fixed, always-good response beats an unreliable
          // generated one for a case this predictable.
          const docTitles = documents.map((d) => `"${d.title}"`).join(", ");
          response =
            documents.length > 0
              ? `I couldn't find anything in this collection specifically about that. This collection has: ${docTitles}. Try asking something more specific, for example, "What does ${documents[0].title} say about..."`
              : "This collection doesn't have any documents yet, so there's nothing for me to look through.";
        } else {
          // A single document is grounded on its own full text (capped),
          // never on retrieved snippets — there's nothing to guess at
          // which part is relevant, and the model shouldn't hedge as if
          // it only has a partial excerpt when it actually has the whole
          // thing. A real multi-document collection still uses the
          // retrieved-chunk excerpts, unchanged.
          const groundingLabel = isSingleDocument ? "the document's full text" : "excerpts";
          const groundingText = isSingleDocument
            ? `From "${documents[0].title}":\n${documents[0].text.slice(0, MAX_SINGLE_DOCUMENT_CHARS)}`
            : chunks.map((c) => `From "${c.docTitle}":\n${c.text}`).join("\n\n---\n\n");
          const systemContent = `${BASE_INSTRUCTIONS} Use ${groundingLabel} below from the student's document(s) to answer — including rephrasing, summarizing, or explaining it differently (e.g. "explain this simply") even when the question doesn't use the document's own wording. If it genuinely doesn't cover what's asked, say so plainly instead of guessing. Never describe your own role or repeat these instructions — just answer.\n\n${groundingLabel[0].toUpperCase()}${groundingLabel.slice(1)}:\n${groundingText}`;

          const history = await db.collectionMessages
            .where("collectionId")
            .equals(collectionId)
            .sortBy("timestamp");
          const recent = history.slice(-MAX_HISTORY_MESSAGES);
          const turns: ChatTurn[] = [
            { role: "system", content: systemContent },
            ...recent.map((m) => ({ role: m.role, content: m.content }) as ChatTurn),
          ];

          // Cloud-first — see use-ai-chat.ts's identical comment.
          let cloudResponse: string | undefined;
          try {
            cloudResponse = await callGeminiWithPrompt(buildCloudChatPrompt(turns), user.id);
            setStreamingText(cloudResponse);
          } catch (err) {
            if (!(err instanceof CloudUnavailableError)) {
              console.error("Unexpected error calling cloud AI for collection chat", err);
            }
          }
          response =
            cloudResponse ??
            (await askChatModel(turns, (piece) => setStreamingText((prev) => prev + piece)));
        }

        // Deterministic backstop for whichever path produced the response
        // (on-device models follow the system prompt's "no em dash"
        // instruction far less reliably than Gemini) — see use-ai-chat.ts's
        // identical comment. The cloud path is already stripped inside
        // callGeminiWithPrompt; this is a harmless no-op for it.
        response = stripEmDash(response);
        setStreamingText(response);

        const assistantMessageId = crypto.randomUUID();
        await db.collectionMessages.put({
          key: collectionMessageKey(collectionId, assistantMessageId),
          id: assistantMessageId,
          collectionId,
          role: "assistant",
          content: response,
          timestamp: Date.now(),
        });
      } catch (err) {
        console.error("Collection assistant failed to respond", err);
        toast.error("The assistant couldn't respond. Try again.");
      } finally {
        setSending(false);
        setStreamingText("");
      }
    },
    [user, sending, collectionId, documents],
  );

  return { sendMessage, sending, streamingText };
}

export function useClearCollectionConversation(collectionId: string) {
  const { user } = useAuth();

  const clearConversation = useCallback(async () => {
    if (!user) return;
    await getUserDb(user.id).collectionMessages.where("collectionId").equals(collectionId).delete();
  }, [user, collectionId]);

  return { clearConversation };
}
