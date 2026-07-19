import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Copy, Sparkles, ArrowUpRight } from "lucide-react";
import { usePersonalDocument } from "@/hooks/use-documents";

export const Route = createFileRoute("/documents/$docId/summary")({
  head: () => ({
    meta: [
      { title: "Summary — eLearn" },
      { name: "description", content: "A structured, section-by-section AI summary." },
    ],
  }),
  component: DocumentSummaryPage,
});

/** A dedicated, standalone view for a personal document's summary — same
 * reasoning and layout as courses.$moduleId.summary.$docId.tsx, for a
 * student's own uploaded PDF instead of a catalog material. */
function DocumentSummaryPage() {
  const { docId } = Route.useParams();
  const doc = usePersonalDocument(docId);
  const [copied, setCopied] = useState(false);

  if (doc === undefined) {
    return <div className="min-h-screen bg-background" />;
  }

  const fullText = doc.summary
    ? [doc.summary, ...(doc.summarySections ?? []).map((s) => `${s.heading}\n${s.body}`)].join(
        "\n\n",
      )
    : "";

  const copyAll = () => {
    void navigator.clipboard.writeText(fullText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
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
          <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-prestige-gold">
            <Sparkles className="h-3 w-3" strokeWidth={2} />
            On-device{doc.summaryMethod === "neural" ? " · Neural model" : " · Extractive"}
          </span>
        </div>
      </header>

      <article className="mx-auto max-w-[680px] px-6 pb-32 pt-10 lg:pt-14">
        {!doc.summary ? (
          <div className="animate-rise rounded-2xl bg-card p-8 text-center ring-1 ring-border/60">
            <Sparkles className="mx-auto h-8 w-8 text-prestige-gold" strokeWidth={1.5} />
            <p className="mt-4 font-display text-lg text-prestige-deep">No summary yet</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Go back to the document and tap "Summarise" — it'll show up here.
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

            <div className="relative mt-8">
              <div className="pointer-events-none absolute -inset-1 rounded-2xl border-t border-l border-prestige-gold/40" />
              <div className="relative rounded-2xl bg-prestige-deep p-6 text-prestige-cream lg:p-8">
                <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-prestige-gold">
                  Overview
                </p>
                <p className="mt-4 font-display text-lg leading-relaxed text-prestige-cream/90 lg:text-xl">
                  {doc.summary}
                </p>
              </div>
            </div>

            {doc.summarySections && doc.summarySections.length > 0 && (
              <div className="mt-10 space-y-8">
                {doc.summarySections.map((section, i) => (
                  <section key={i} className="animate-rise">
                    <h2 className="font-display text-xl font-medium text-prestige-deep">
                      {section.heading}
                    </h2>
                    <div className="mt-2 h-px w-12 bg-prestige-gold" />
                    <p className="mt-4 text-[15px] leading-[1.75] text-foreground/85">
                      {section.body}
                    </p>
                  </section>
                ))}
              </div>
            )}

            <div className="mt-12 flex flex-wrap items-center gap-2 border-t border-border/60 pt-6">
              <button
                type="button"
                onClick={copyAll}
                className="inline-flex items-center gap-2 rounded-lg bg-prestige-gold px-4 py-2.5 text-xs font-semibold text-prestige-deep transition-transform active:scale-[0.97]"
              >
                <Copy className="h-3.5 w-3.5" strokeWidth={2} />
                {copied ? "Copied" : "Copy full summary"}
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
