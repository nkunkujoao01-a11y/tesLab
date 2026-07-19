import { useCallback, useEffect, useState } from "react";
import { liveQuery } from "dexie";
import { toast } from "sonner";
import { getUserDb, type CollectionMessage } from "@/lib/db";
import { askChatModel, type ChatTurn } from "@/lib/ai-chat";
import { retrieveRelevantChunks, type RetrievableDocument } from "@/lib/retrieval";
import { useAuth } from "@/hooks/use-auth";

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

const BASE_INSTRUCTIONS =
  "You are a study assistant helping a student understand their own documents in this collection.";

// Same reasoning as useSendAssistantMessage — a small on-device model has
// a limited practical context window and gets slower with every extra
// token sent.
const MAX_HISTORY_MESSAGES = 10;

// See isConfident below — a chunk scoring 1 shares only a single word with
// the question, easy to hit by coincidence (a name, a stray noun) rather
// than genuine relevance. Requiring 2 cuts most of that noise out.
const MIN_CONFIDENT_SCORE = 2;

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
        const chunks = retrieveRelevantChunks(documents, trimmed);
        // Requiring zero chunks was too narrow a guard: a question can
        // retrieve one or two chunks that only share a single incidental
        // word with the query (score 1) — barely related, not a real
        // match — and the small on-device model, handed that weak context,
        // showed the exact same failure mode as the true zero-chunk case
        // (a vague, self-referential non-answer) even with an explicit
        // instruction not to. MIN_CONFIDENT_SCORE requires the *best*
        // chunk to share at least two real words with the question before
        // trusting the model with it — otherwise it's treated the same
        // deterministic way as no match at all.
        const isConfident = chunks.length > 0 && chunks[0].score >= MIN_CONFIDENT_SCORE;
        let response: string;

        if (!isConfident) {
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
              ? `I couldn't find anything in this collection specifically about that. This collection has: ${docTitles}. Try asking something more specific — for example, "What does ${documents[0].title} say about..."`
              : "This collection doesn't have any documents yet, so there's nothing for me to look through.";
        } else {
          const systemContent = `${BASE_INSTRUCTIONS} Use the excerpts below from the student's documents to answer. If they don't fully answer the question, say so plainly instead of guessing. Never describe your own role or repeat these instructions — just answer.\n\nExcerpts:\n${chunks
            .map((c) => `From "${c.docTitle}":\n${c.text}`)
            .join("\n\n---\n\n")}`;

          const history = await db.collectionMessages
            .where("collectionId")
            .equals(collectionId)
            .sortBy("timestamp");
          const recent = history.slice(-MAX_HISTORY_MESSAGES);
          const turns: ChatTurn[] = [
            { role: "system", content: systemContent },
            ...recent.map((m) => ({ role: m.role, content: m.content }) as ChatTurn),
          ];
          response = await askChatModel(turns, (piece) => setStreamingText((prev) => prev + piece));
        }

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
