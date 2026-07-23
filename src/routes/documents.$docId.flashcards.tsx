import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowUpRight,
  Download,
  Layers,
  Loader2,
  RefreshCw,
  Share2,
} from "lucide-react";
import { usePersonalDocument } from "@/hooks/use-documents";
import {
  useFlashcardSet,
  useGenerateFlashcards,
  useFlashcardReviews,
  useRecordFlashcardReview,
} from "@/hooks/use-quiz";
import { buildFlashcardsExportText } from "@/lib/quiz-gen";
import { buildStructuredExportHtml, shareOrDownloadBlob } from "@/lib/structured-export";
import { useCanShareFiles } from "@/hooks/use-online-status";
import { FlashcardDeck } from "@/components/QuizFlashcards";

export const Route = createFileRoute("/documents/$docId/flashcards")({
  head: () => ({
    meta: [
      { title: "Flashcards — eLearn" },
      { name: "description", content: "AI-generated flashcards for this document." },
    ],
  }),
  component: DocumentFlashcardsPage,
});

/** A dedicated, standalone view for a personal document's flashcard set —
 * same reasoning and layout as courses.$moduleId.flashcards.$docId.tsx,
 * for a student's own uploaded PDF instead of a catalog material. */
function DocumentFlashcardsPage() {
  const { docId } = Route.useParams();
  const doc = usePersonalDocument(docId);
  const flashcardSet = useFlashcardSet(docId);
  const { generate: generateFlashcardsFor, pendingIds } = useGenerateFlashcards();
  const isGenerating = pendingIds.has(docId);
  const reviews = useFlashcardReviews(docId);
  const recordReview = useRecordFlashcardReview();
  const canShare = useCanShareFiles();

  if (doc === undefined) {
    return <div className="min-h-screen bg-background" />;
  }

  const download = () => {
    if (!flashcardSet) return;
    const html = buildStructuredExportHtml(
      `${doc.title} — Flashcards`,
      buildFlashcardsExportText(flashcardSet.cards),
    );
    void shareOrDownloadBlob(
      new Blob([html], { type: "text/html" }),
      `${doc.title} — Flashcards.html`,
      `${doc.title} — Flashcards`,
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-[680px] items-center justify-between px-6 py-4">
          <Link
            to="/documents/$docId"
            params={{ docId }}
            className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-prestige-mid hover:text-prestige-deep"
          >
            <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
            {doc.title}
          </Link>
          {flashcardSet && (
            <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-prestige-gold">
              <Layers className="h-3 w-3" strokeWidth={2} />
              {flashcardSet.method === "cloud" ? "Cloud AI" : "On-device"}
            </span>
          )}
        </div>
      </header>

      <article className="mx-auto max-w-[680px] px-6 pb-32 pt-10 lg:pt-14">
        {!flashcardSet || flashcardSet.cards.length === 0 ? (
          <div className="animate-rise rounded-2xl bg-card p-8 text-center ring-1 ring-border/60">
            <Layers className="mx-auto h-8 w-8 text-prestige-gold" strokeWidth={1.5} />
            <p className="mt-4 font-display text-lg text-prestige-deep">No flashcards yet</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Go back to the document and tap "Flashcards" — they'll show up here.
            </p>
            <Link
              to="/documents/$docId"
              params={{ docId }}
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-prestige-gold px-4 py-2 text-xs font-semibold text-prestige-deep transition-transform active:scale-[0.97]"
            >
              <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.75} />
              Open document
            </Link>
          </div>
        ) : (
          <>
            <p className="eyebrow">{doc.pageCount} pages</p>
            <h1 className="mt-3 font-display text-3xl font-medium leading-[1.15] tracking-tight text-prestige-deep lg:text-4xl">
              {doc.title}
            </h1>

            <FlashcardDeck
              cards={flashcardSet.cards}
              reviews={reviews}
              onReview={(cardIndex, knew) => void recordReview(docId, cardIndex, knew)}
            />

            <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-border/60 pt-6">
              <button
                type="button"
                onClick={download}
                className="inline-flex items-center gap-2 rounded-lg bg-prestige-gold px-4 py-2.5 text-xs font-semibold text-prestige-deep transition-transform active:scale-[0.97]"
              >
                {canShare ? (
                  <Share2 className="h-3.5 w-3.5" strokeWidth={2} />
                ) : (
                  <Download className="h-3.5 w-3.5" strokeWidth={2} />
                )}
                {canShare ? "Share" : "Download"}
              </button>
              <button
                type="button"
                disabled={isGenerating}
                onClick={() => void generateFlashcardsFor(docId, doc.text)}
                className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-semibold text-prestige-deep ring-1 ring-border/70 transition-all active:scale-[0.97] disabled:opacity-60"
              >
                {isGenerating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.75} />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.75} />
                )}
                {isGenerating ? "Generating…" : "New set"}
              </button>
              <Link
                to="/documents/$docId"
                params={{ docId }}
                className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-semibold text-prestige-deep ring-1 ring-border/70 transition-all active:scale-[0.97]"
              >
                <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.75} />
                Back to document
              </Link>
            </div>
          </>
        )}
      </article>
    </div>
  );
}
