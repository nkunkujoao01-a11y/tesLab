import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowUpRight, Download, Layers, Loader2, RefreshCw } from "lucide-react";
import { useDocumentCollection, usePersonalDocuments } from "@/hooks/use-documents";
import { useFlashcardSet, useGenerateFlashcards } from "@/hooks/use-quiz";
import { buildFlashcardsExportText } from "@/lib/quiz-gen";
import { buildStructuredExportHtml, downloadBlob } from "@/lib/structured-export";
import { FlashcardDeck } from "@/components/QuizFlashcards";

export const Route = createFileRoute("/documents/collections/$collectionId/flashcards")({
  head: () => ({
    meta: [
      { title: "Flashcards — eLearn" },
      { name: "description", content: "AI-generated flashcards for this collection." },
    ],
  }),
  component: CollectionFlashcardsPage,
});

/** A dedicated, standalone view for a whole collection's flashcard set —
 * same reasoning and layout as documents.$docId.flashcards.tsx, keyed by
 * collectionId instead of a single document's id (see
 * documents.collections.$collectionId.index.tsx's own comment on why
 * flashcards/quiz are generic over an arbitrary string key). */
function CollectionFlashcardsPage() {
  const { collectionId } = Route.useParams();
  const collection = useDocumentCollection(collectionId);
  const flashcardSet = useFlashcardSet(collectionId);
  const allDocs = usePersonalDocuments();
  const members = allDocs.filter((doc) => doc.collectionId === collectionId);
  // Same construction as documents.collections.$collectionId.index.tsx's
  // own flashcardSourceText — kept in sync so "New set" here regenerates
  // from the exact same source the collection page's own button would.
  const flashcardSourceText = members.map((doc) => `# ${doc.title}\n\n${doc.text}`).join("\n\n");
  const { generate: generateFlashcardsFor, pendingIds } = useGenerateFlashcards();
  const isGenerating = pendingIds.has(collectionId);

  if (collection === undefined) {
    return <div className="min-h-screen bg-background" />;
  }

  const title = collection?.name ?? "Collection";

  const download = () => {
    if (!flashcardSet) return;
    const html = buildStructuredExportHtml(
      `${title} — Flashcards`,
      buildFlashcardsExportText(flashcardSet.cards),
    );
    downloadBlob(new Blob([html], { type: "text/html" }), `${title} — Flashcards.html`);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-[680px] items-center justify-between px-6 py-4">
          <Link
            to="/documents/collections/$collectionId"
            params={{ collectionId }}
            className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-prestige-mid hover:text-prestige-deep"
          >
            <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
            {title}
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
              Go back to the collection and tap "Flashcards for this collection" — they'll show up
              here.
            </p>
            <Link
              to="/documents/collections/$collectionId"
              params={{ collectionId }}
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-prestige-gold px-4 py-2 text-xs font-semibold text-prestige-deep transition-transform active:scale-[0.97]"
            >
              <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.75} />
              Open collection
            </Link>
          </div>
        ) : (
          <>
            <h1 className="font-display text-3xl font-medium leading-[1.15] tracking-tight text-prestige-deep lg:text-4xl">
              {title}
            </h1>

            <FlashcardDeck cards={flashcardSet.cards} />

            <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-border/60 pt-6">
              <button
                type="button"
                onClick={download}
                className="inline-flex items-center gap-2 rounded-lg bg-prestige-gold px-4 py-2.5 text-xs font-semibold text-prestige-deep transition-transform active:scale-[0.97]"
              >
                <Download className="h-3.5 w-3.5" strokeWidth={2} />
                Download
              </button>
              <button
                type="button"
                disabled={isGenerating}
                onClick={() => void generateFlashcardsFor(collectionId, flashcardSourceText)}
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
                to="/documents/collections/$collectionId"
                params={{ collectionId }}
                className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-semibold text-prestige-deep ring-1 ring-border/70 transition-all active:scale-[0.97]"
              >
                <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.75} />
                Back to collection
              </Link>
            </div>
          </>
        )}
      </article>
    </div>
  );
}
