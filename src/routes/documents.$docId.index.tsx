import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Copy,
  Download,
  FileDown,
  Folder,
  Layers,
  ListChecks,
  Loader2,
  NotebookPen,
  Sparkles,
} from "lucide-react";
import { MobileShell } from "@/components/MobileShell";
import { StructuredText } from "@/components/StructuredText";
import { FlashcardDeck, QuizPanel } from "@/components/QuizFlashcards";
import { ReadingWidthControl } from "@/components/ReadingWidthControl";
import { formatMb } from "@/lib/mock-data";
import { buildStructuredExportHtml, downloadBlob } from "@/lib/structured-export";
import { deriveDocumentLead } from "@/lib/document-lead";
import { useReadingWidth, READING_WIDTH_STYLE } from "@/hooks/use-reading-width";
import {
  usePersonalDocument,
  usePersonalDocumentFile,
  useGenerateDocumentSummary,
  useDocumentCollection,
  updateDocumentReadProgress,
} from "@/hooks/use-documents";
import { useFlashcardSet, useGenerateFlashcards, useQuiz, useGenerateQuiz } from "@/hooks/use-quiz";
import { useChatModelStatus } from "@/hooks/use-ai-chat";
import { useReadingProgress } from "@/hooks/use-reading-progress";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/documents/$docId/")({
  head: ({ params }) => ({
    meta: [{ title: `Document — eLearn` }, { name: "description", content: params.docId }],
  }),
  component: DocumentDetail,
});

function DocumentDetail() {
  const { docId } = Route.useParams();
  const { user } = useAuth();
  const doc = usePersonalDocument(docId);
  const originalFile = usePersonalDocumentFile(docId);
  const collection = useDocumentCollection(doc?.collectionId ?? "");
  const { generateSummary, pendingIds } = useGenerateDocumentSummary();
  const isSummarizing = pendingIds.has(docId);
  const [copied, setCopied] = useState(false);

  // A real editorial-style lead paragraph + pull-quote derived from the
  // document's own extracted text — see document-lead.ts. Same visual
  // treatment catalog materials get from their hand-authored content.
  const { lead, pullQuote, bodyText } = useMemo(
    () => deriveDocumentLead(doc?.text ?? ""),
    [doc?.text],
  );

  // Real scroll-based reading progress — see use-reading-progress.ts.
  const persistProgress = useCallback(
    (pct: number) => {
      if (user) void updateDocumentReadProgress(user.id, docId, pct);
    },
    [user, docId],
  );
  const readProgress = useReadingProgress(!!doc, doc?.readProgressPct ?? 0, persistProgress);
  const [readingWidth, setReadingWidth] = useReadingWidth();

  const flashcardSet = useFlashcardSet(docId);
  const { generate: generateFlashcardsFor, pendingIds: flashcardPendingIds } =
    useGenerateFlashcards();
  const isGeneratingFlashcards = flashcardPendingIds.has(docId);

  const quiz = useQuiz(docId);
  const {
    generate: generateQuizFor,
    pendingIds: quizPendingIds,
    progress: quizProgress,
  } = useGenerateQuiz();
  const isGeneratingQuiz = quizPendingIds.has(docId);
  const quizQuestionProgress = quizProgress[docId];
  // Unlike flashcards (extractive, no model needed), a quiz genuinely
  // needs the on-device chat model. Without this check, clicking "Quiz"
  // before it's downloaded would silently kick off an untracked,
  // multi-minute download with no progress UI — the exact "looks broken"
  // mistake Feature 31/34 already found and fixed for the other two
  // download entry points; gating here instead of repeating it a third
  // time.
  const chatModelStatus = useChatModelStatus();
  const chatModelReady = chatModelStatus === "ready";

  const copyToNotes = () => {
    if (!doc?.summary) return;
    void navigator.clipboard.writeText(doc.summary).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const downloadOriginal = () => {
    if (!originalFile) return;
    downloadBlob(originalFile.blob, originalFile.fileName);
  };

  const downloadStructured = () => {
    if (!doc) return;
    const html = buildStructuredExportHtml(doc.title, doc.text);
    downloadBlob(new Blob([html], { type: "text/html" }), `${doc.title}.html`);
  };

  // A liveQuery-backed hook starts as `undefined` for a real document that
  // just hasn't loaded yet — only treat it as truly missing once we've had
  // a chance to observe that. Simpler apps might risk a `notFound()` flash
  // here; this just renders a blank frame briefly instead, consistent with
  // the auth-loading pattern used elsewhere in this app.
  if (doc === undefined) {
    return <div className="min-h-screen bg-background" />;
  }

  return (
    <MobileShell>
      <div className="px-6 pt-10 lg:px-10 lg:pt-14">
        <Link
          to="/documents"
          className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-prestige-mid hover:text-prestige-deep"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
          My documents
        </Link>
      </div>

      <article
        className="mx-auto px-6 pb-40 pt-8 lg:pt-10"
        style={{ maxWidth: READING_WIDTH_STYLE[readingWidth] }}
      >
        <div className="flex items-start justify-between gap-3">
          <p className="eyebrow">
            {doc.pageCount} pages · {formatMb(doc.sizeMb)}
          </p>
          <ReadingWidthControl width={readingWidth} onChange={setReadingWidth} />
        </div>
        <h1 className="mt-3 font-display text-3xl font-medium leading-[1.15] tracking-tight text-prestige-deep lg:text-4xl">
          {doc.title}
        </h1>
        <div className="mt-4 flex items-center gap-3">
          <div className="h-0.5 flex-1 overflow-hidden rounded-full bg-prestige-deep/10">
            <div
              className="h-full bg-prestige-gold transition-all"
              style={{ width: `${readProgress}%` }}
            />
          </div>
          <span className="shrink-0 text-[11px] font-medium uppercase tracking-widest text-prestige-mid">
            {readProgress}% read
          </span>
        </div>
        {collection && (
          <Link
            to="/documents/collections/$collectionId"
            params={{ collectionId: collection.id }}
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-prestige-mid hover:text-prestige-deep"
          >
            <Folder className="h-3.5 w-3.5" strokeWidth={1.75} />
            {collection.name}
          </Link>
        )}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          {originalFile && (
            <button
              type="button"
              onClick={downloadOriginal}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-medium text-prestige-mid ring-1 ring-border/70 transition-colors hover:bg-secondary hover:text-prestige-deep"
            >
              <Download className="h-3.5 w-3.5" strokeWidth={1.75} />
              Download original PDF
            </button>
          )}
          <button
            type="button"
            onClick={downloadStructured}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-medium text-prestige-mid ring-1 ring-border/70 transition-colors hover:bg-secondary hover:text-prestige-deep"
          >
            <FileDown className="h-3.5 w-3.5" strokeWidth={1.75} />
            Download structured version
          </button>
        </div>
        {lead && (
          <p className="mt-6 font-display text-lg italic leading-relaxed text-prestige-mid lg:text-xl">
            {lead}
          </p>
        )}
        <div className="mt-8 h-px w-full bg-prestige-deep/10" />
        {pullQuote && (
          <figure className="my-8 border-l-2 border-prestige-gold pl-6">
            <p className="font-display text-xl leading-snug text-prestige-deep text-balance">
              {pullQuote}
            </p>
            <figcaption className="mt-3 text-[11px] uppercase tracking-widest text-prestige-mid">
              — From this document
            </figcaption>
          </figure>
        )}
        <StructuredText
          text={bodyText}
          className="mt-8 space-y-5 whitespace-pre-line text-[15px] leading-[1.75] text-foreground/85"
        />

        {(doc.summary || isSummarizing) && (
          <div className="relative mt-12">
            <div className="pointer-events-none absolute -inset-1 rounded-2xl border-t border-l border-prestige-gold/40" />
            <div className="relative rounded-2xl bg-prestige-deep p-6 text-prestige-cream">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-prestige-gold">
                  AI summary
                </p>
                <p className="text-[10px] uppercase tracking-widest text-prestige-cream/50">
                  {doc.summaryMethod === "cloud"
                    ? "Cloud AI"
                    : doc.summaryMethod === "neural"
                      ? "On-device · Neural model"
                      : doc.summaryMethod === "extractive"
                        ? "On-device · Extractive"
                        : "On-device"}
                </p>
              </div>
              {isSummarizing ? (
                <p className="mt-4 flex items-center gap-2 text-sm text-prestige-cream/70">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.75} />
                  Summarising this document…
                </p>
              ) : (
                <>
                  <p className="mt-4 text-[15px] leading-relaxed text-prestige-cream/90">
                    {doc.summary}
                  </p>
                  <div className="mt-5 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={copyToNotes}
                      className="inline-flex items-center gap-2 rounded-lg bg-prestige-gold px-3 py-2 text-xs font-semibold text-prestige-deep transition-transform active:scale-[0.97]"
                    >
                      <Copy className="h-3.5 w-3.5" strokeWidth={2} />
                      {copied ? "Copied" : "Copy to notes"}
                    </button>
                    {doc.summarySections && doc.summarySections.length > 0 && (
                      <Link
                        to="/documents/$docId/summary"
                        params={{ docId }}
                        className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-prestige-cream ring-1 ring-prestige-cream/25 transition-colors hover:bg-prestige-cream/10"
                      >
                        <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.75} />
                        View full summary
                      </Link>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {flashcardSet && flashcardSet.cards.length > 0 && (
          <FlashcardDeck cards={flashcardSet.cards} />
        )}

        {quiz && quiz.questions.length > 0 && <QuizPanel questions={quiz.questions} />}

        {isGeneratingQuiz && (
          <p className="mt-6 text-center text-[11px] text-muted-foreground">
            Writing a quiz question by question can take a few minutes on this device — this is
            genuinely working, not stuck.
          </p>
        )}

        {!chatModelReady && !quiz && !isGeneratingQuiz && (
          <p className="mt-6 text-[11px] text-muted-foreground">
            Quizzes need the on-device assistant — download it from the{" "}
            <Link to="/assistant" className="gold-underline font-medium text-prestige-deep">
              Ask AI
            </Link>{" "}
            tab first. Flashcards don't need it and work right now.
          </p>
        )}

        <Link
          to="/documents/$docId/notes"
          params={{ docId }}
          className="mt-8 flex items-center justify-between gap-3 rounded-xl bg-secondary/60 px-4 py-3.5 text-sm font-medium text-prestige-deep transition-colors hover:bg-secondary"
        >
          <span className="inline-flex items-center gap-2">
            <NotebookPen className="h-4 w-4 text-prestige-gold" strokeWidth={1.75} />
            {doc.aiNotes ? "View AI notes" : "Generate AI notes"}
          </span>
          <ArrowUpRight className="h-3.5 w-3.5 text-prestige-mid" strokeWidth={1.75} />
        </Link>
      </article>

      {/* bottom-20 + lg:bottom-0 lg:ml-64: this page renders inside
       * MobileShell, whose own mobile bottom nav is *also* fixed at
       * bottom-0 z-30 (lg:hidden). A plain bottom-0 bar here sits exactly
       * underneath it and is genuinely unclickable on mobile — found via a
       * real mobile-viewport (390px) Playwright click, not assumed from
       * desktop-viewport testing where lg:hidden hides the nav and the
       * collision never surfaces. Same proven pattern already used by
       * assistant.tsx's input bar and the collection chat page. */}
      <div className="fixed inset-x-0 bottom-20 z-20 border-t border-border/60 bg-background/95 backdrop-blur-md lg:bottom-0 lg:ml-64">
        {/* justify-end paired with overflow-x-auto on the same element
         * right-aligned this row's default (unscrolled) scroll position,
         * clipping the first button ("Flashcards") off-screen to the left
         * on narrow phones — found via a real 375px-viewport screenshot
         * showing only "CARDS" visible at the left edge. justify-start
         * keeps the natural reading order visible from the start, with any
         * overflow scrollable to the right instead. */}
        <div className="mx-auto flex max-w-[720px] items-center justify-start gap-2 overflow-x-auto px-5 py-4">
          <button
            type="button"
            disabled={isGeneratingFlashcards}
            onClick={() => void generateFlashcardsFor(docId, doc.text)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-prestige-deep ring-1 ring-border/70 transition-all active:scale-[0.97] disabled:opacity-60"
          >
            {isGeneratingFlashcards ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
            ) : (
              <Layers className="h-3.5 w-3.5" strokeWidth={2} />
            )}
            {flashcardSet ? "Regenerate" : "Flashcards"}
          </button>
          <button
            type="button"
            disabled={isGeneratingQuiz || !chatModelReady}
            title={!chatModelReady ? "Download the assistant from Ask AI first" : undefined}
            onClick={() => void generateQuizFor(docId, doc.text)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-prestige-deep ring-1 ring-border/70 transition-all active:scale-[0.97] disabled:opacity-60"
          >
            {isGeneratingQuiz ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
            ) : (
              <ListChecks className="h-3.5 w-3.5" strokeWidth={2} />
            )}
            {isGeneratingQuiz
              ? quizQuestionProgress
                ? `Q${quizQuestionProgress.current}/${quizQuestionProgress.total}…`
                : "Starting…"
              : quiz
                ? "Regenerate"
                : "Quiz"}
          </button>
          <button
            type="button"
            disabled={isSummarizing}
            onClick={() => void generateSummary(docId, doc.text)}
            className="inline-flex shrink-0 items-center gap-2 rounded-full bg-prestige-gold px-5 py-2.5 text-xs font-semibold uppercase tracking-widest text-prestige-deep transition-transform active:scale-[0.97] disabled:opacity-60"
          >
            {isSummarizing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
            ) : (
              <Sparkles className="h-3.5 w-3.5" strokeWidth={2} />
            )}
            {isSummarizing ? "Summarising…" : doc.summary ? "Regenerate" : "Summarise"}
          </button>
        </div>
      </div>
    </MobileShell>
  );
}
