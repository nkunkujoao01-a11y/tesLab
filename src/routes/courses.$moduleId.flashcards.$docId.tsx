import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, ArrowUpRight, Download, Layers, Loader2, RefreshCw } from "lucide-react";
import { fetchModule } from "@/lib/modules-api";
import { materialKey } from "@/lib/db";
import { useDownloadedMaterialContent } from "@/hooks/use-downloads";
import {
  useFlashcardSet,
  useGenerateFlashcards,
  useFlashcardReviews,
  useRecordFlashcardReview,
} from "@/hooks/use-quiz";
import { buildFlashcardsExportText } from "@/lib/quiz-gen";
import { buildStructuredExportHtml, downloadBlob } from "@/lib/structured-export";
import { FlashcardDeck } from "@/components/QuizFlashcards";

export const Route = createFileRoute("/courses/$moduleId/flashcards/$docId")({
  loader: async ({ params }) => {
    const module = await fetchModule(params.moduleId);
    if (!module) throw notFound();
    const doc = module.materials.find((m) => m.id === params.docId);
    if (!doc) throw notFound();
    return { module, doc };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData ? `${loaderData.doc.title} — Flashcards` : "Flashcards — eLearn" },
      { name: "description", content: "AI-generated flashcards for this material." },
    ],
  }),
  component: MaterialFlashcardsPage,
});

/** A dedicated, standalone view for one material's flashcard set — its own
 * page rather than a tab dropped into the reader (see the reader route's
 * own comment on why quiz/flashcards moved off the shared tab strip),
 * reachable from the reader's "Cards" action and reusing the exact same
 * FlashcardDeck the tab used to render. */
function MaterialFlashcardsPage() {
  const { module, doc } = Route.useLoaderData();
  const key = materialKey(module.id, doc.id);
  const flashcardSet = useFlashcardSet(key);
  const content = useDownloadedMaterialContent(module.id, doc.id);
  // Same synthetic single-heading document generateFlashcards() needs —
  // see courses.$moduleId.read.$docId.tsx's identical comment.
  const flashcardSourceText = content
    ? `# ${content.heading}\n\n${content.lead}\n\n${content.body.join("\n\n")}`
    : "";
  const { generate: generateFlashcardsFor, pendingIds } = useGenerateFlashcards();
  const isGenerating = pendingIds.has(key);
  const reviews = useFlashcardReviews(key);
  const recordReview = useRecordFlashcardReview();

  const download = () => {
    if (!flashcardSet) return;
    const html = buildStructuredExportHtml(
      `${doc.title} — Flashcards`,
      buildFlashcardsExportText(flashcardSet.cards),
    );
    downloadBlob(new Blob([html], { type: "text/html" }), `${doc.title} — Flashcards.html`);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-[680px] items-center justify-between px-6 py-4">
          <Link
            to="/courses/$moduleId/read/$docId"
            params={{ moduleId: module.id, docId: doc.id }}
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
              Go back to the reader and tap "Cards" — they'll show up here.
            </p>
            <Link
              to="/courses/$moduleId/read/$docId"
              params={{ moduleId: module.id, docId: doc.id }}
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-prestige-gold px-4 py-2 text-xs font-semibold text-prestige-deep transition-transform active:scale-[0.97]"
            >
              <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.75} />
              Open reader
            </Link>
          </div>
        ) : (
          <>
            <p className="eyebrow">
              {module.code} · {module.chapter}
            </p>
            <h1 className="mt-3 font-display text-3xl font-medium leading-[1.15] tracking-tight text-prestige-deep lg:text-4xl">
              {doc.title}
            </h1>

            <FlashcardDeck
              cards={flashcardSet.cards}
              reviews={reviews}
              onReview={(cardIndex, knew) => void recordReview(key, cardIndex, knew)}
            />

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
                disabled={isGenerating || !content}
                onClick={() => void generateFlashcardsFor(key, flashcardSourceText)}
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
                to="/courses/$moduleId/read/$docId"
                params={{ moduleId: module.id, docId: doc.id }}
                className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-semibold text-prestige-deep ring-1 ring-border/70 transition-all active:scale-[0.97]"
              >
                <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.75} />
                Back to reader
              </Link>
            </div>
          </>
        )}
      </article>
    </div>
  );
}
