import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Copy, Sparkles, ArrowUpRight } from "lucide-react";
import { fetchModule } from "@/lib/modules-api";
import { useMaterialSummary } from "@/hooks/use-summaries";

export const Route = createFileRoute("/courses/$moduleId/summary/$docId")({
  loader: async ({ params }) => {
    const module = await fetchModule(params.moduleId);
    if (!module) throw notFound();
    const doc = module.materials.find((m) => m.id === params.docId);
    if (!doc) throw notFound();
    return { module, doc };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData ? `${loaderData.doc.title} — Summary` : "Summary — eLearn" },
      { name: "description", content: "A structured, section-by-section AI summary." },
    ],
  }),
  component: MaterialSummaryPage,
});

/** A dedicated, standalone view for one material's summary — its own
 * calm page rather than a card dropped into the reader, with a real
 * overview plus one heading per real section of the source document (see
 * summarize-structured.ts), so a long material's summary reads like a
 * short, well-organized document of its own instead of one paragraph that
 * quietly only covered the first page. */
function MaterialSummaryPage() {
  const { module, doc } = Route.useLoaderData();
  const summary = useMaterialSummary(module.id, doc.id);
  const [copied, setCopied] = useState(false);

  const fullText = summary
    ? [summary.body, ...(summary.sections ?? []).map((s) => `${s.heading}\n${s.body}`)].join(
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
            to="/courses/$moduleId/read/$docId"
            params={{ moduleId: module.id, docId: doc.id }}
            className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-prestige-mid hover:text-prestige-deep"
          >
            <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
            {doc.title}
          </Link>
          <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-prestige-gold">
            <Sparkles className="h-3 w-3" strokeWidth={2} />
            On-device{summary?.method === "neural" ? " · Neural model" : " · Extractive"}
          </span>
        </div>
      </header>

      <article className="mx-auto max-w-[680px] px-6 pb-32 pt-10 lg:pt-14">
        {!summary ? (
          <div className="animate-rise rounded-2xl bg-card p-8 text-center ring-1 ring-border/60">
            <Sparkles className="mx-auto h-8 w-8 text-prestige-gold" strokeWidth={1.5} />
            <p className="mt-4 font-display text-lg text-prestige-deep">No summary yet</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Go back to the reader and tap "Summarise" — it'll show up here.
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
            <p className="eyebrow">{module.code} · {module.chapter}</p>
            <h1 className="mt-3 font-display text-3xl font-medium leading-[1.15] tracking-tight text-prestige-deep lg:text-4xl">
              {doc.title}
            </h1>

            {/* Overview */}
            <div className="relative mt-8">
              <div className="pointer-events-none absolute -inset-1 rounded-2xl border-t border-l border-prestige-gold/40" />
              <div className="relative rounded-2xl bg-prestige-deep p-6 text-prestige-cream lg:p-8">
                <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-prestige-gold">
                  Overview
                </p>
                <p className="mt-4 font-display text-lg leading-relaxed text-prestige-cream/90 lg:text-xl">
                  {summary.body}
                </p>
              </div>
            </div>

            {/* Sections */}
            {summary.sections && summary.sections.length > 0 && (
              <div className="mt-10 space-y-8">
                {summary.sections.map((section, i) => (
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
