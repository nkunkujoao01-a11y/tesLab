import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowUpRight, NotebookPen, Sparkles } from "lucide-react";
import { usePersonalDocument, useGenerateNotes } from "@/hooks/use-documents";
import { useCloudAiKey } from "@/hooks/use-cloud-ai";
import { StructuredText } from "@/components/StructuredText";

export const Route = createFileRoute("/documents/$docId/notes")({
  head: () => ({
    meta: [
      { title: "AI notes — eLearn" },
      { name: "description", content: "Cloud-AI-generated study notes for this document." },
    ],
  }),
  component: DocumentNotesPage,
});

/** Cloud-only — see db.ts's own comment on PersonalDocument.aiNotes for
 * why there's deliberately no on-device fallback for this feature (unlike
 * every other AI feature in this app). Three real states to show, not
 * just "has notes or doesn't": no cloud key connected at all, a key
 * connected but notes not generated yet, and notes already generated. */
function DocumentNotesPage() {
  const { docId } = Route.useParams();
  const doc = usePersonalDocument(docId);
  const { connected } = useCloudAiKey();
  const { generateNotes, pendingIds } = useGenerateNotes();
  const isGenerating = pendingIds.has(docId);

  if (doc === undefined) {
    return <div className="min-h-screen bg-background" />;
  }

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
          <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-prestige-gold">
            <Sparkles className="h-3 w-3" strokeWidth={2} />
            Cloud AI notes
          </span>
        </div>
      </header>

      <article className="mx-auto max-w-[680px] px-6 pb-32 pt-10 lg:pt-14">
        {connected === false ? (
          <div className="animate-rise rounded-2xl bg-card p-8 text-center ring-1 ring-border/60">
            <NotebookPen className="mx-auto h-8 w-8 text-prestige-gold" strokeWidth={1.5} />
            <p className="mt-4 font-display text-lg text-prestige-deep">Connect free AI notes</p>
            <p className="mt-2 text-sm text-muted-foreground">
              AI notes use your own free Google AI key — takes about 30 seconds to connect, costs
              you nothing.
            </p>
            <Link
              to="/settings"
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-prestige-gold px-4 py-2 text-xs font-semibold text-prestige-deep transition-transform active:scale-[0.97]"
            >
              <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.75} />
              Go to AI settings
            </Link>
          </div>
        ) : !doc.aiNotes ? (
          <div className="animate-rise rounded-2xl bg-card p-8 text-center ring-1 ring-border/60">
            <NotebookPen className="mx-auto h-8 w-8 text-prestige-gold" strokeWidth={1.5} />
            <p className="mt-4 font-display text-lg text-prestige-deep">No notes yet</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Generate clear, revision-ready study notes for this document using your connected
              cloud AI.
            </p>
            <button
              type="button"
              disabled={isGenerating || connected === undefined}
              onClick={() => void generateNotes(docId, doc.text)}
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-prestige-gold px-4 py-2 text-xs font-semibold text-prestige-deep transition-transform active:scale-[0.97] disabled:opacity-60"
            >
              <Sparkles className="h-3.5 w-3.5" strokeWidth={1.75} />
              {isGenerating ? "Generating…" : "Generate notes"}
            </button>
          </div>
        ) : (
          <>
            <p className="eyebrow">{doc.pageCount} pages</p>
            <h1 className="mt-3 font-display text-3xl font-medium leading-[1.15] tracking-tight text-prestige-deep lg:text-4xl">
              {doc.title} — Notes
            </h1>

            <StructuredText
              text={doc.aiNotes}
              className="mt-8 space-y-4 text-[15px] leading-[1.75] text-foreground/85"
            />

            <div className="mt-12 flex flex-wrap items-center gap-2 border-t border-border/60 pt-6">
              <button
                type="button"
                disabled={isGenerating}
                onClick={() => void generateNotes(docId, doc.text)}
                className="inline-flex items-center gap-2 rounded-lg bg-prestige-gold px-4 py-2.5 text-xs font-semibold text-prestige-deep transition-transform active:scale-[0.97] disabled:opacity-60"
              >
                <Sparkles className="h-3.5 w-3.5" strokeWidth={2} />
                {isGenerating ? "Regenerating…" : "Regenerate notes"}
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
