import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Check, Copy, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { MobileShell, PageHeader } from "@/components/MobileShell";
import { formatRelative } from "@/lib/mock-data";
import { fetchModules } from "@/lib/modules-api";
import { useAllSummaries } from "@/hooks/use-summaries";

export const Route = createFileRoute("/summaries")({
  loader: () => fetchModules(),
  head: () => ({
    meta: [
      { title: "Summaries — eLearn" },
      {
        name: "description",
        content: "Every AI summary you have generated, kept alongside its source module.",
      },
    ],
  }),
  component: Summaries,
});

function Summaries() {
  const modules = Route.useLoaderData();
  const summaries = useAllSummaries();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copySummary = (key: string, body: string) => {
    navigator.clipboard
      ?.writeText(body)
      .then(() => {
        setCopiedKey(key);
        setTimeout(() => setCopiedKey((cur) => (cur === key ? null : cur)), 1500);
      })
      .catch((err) => {
        console.error("Failed to copy summary", err);
        toast.error("Couldn't copy. Try selecting the text instead.");
      });
  };

  return (
    <MobileShell>
      <PageHeader
        eyebrow="AI summaries"
        title="Everything you asked the model"
        action={
          <span className="hidden items-center gap-2 rounded-full bg-prestige-deep px-4 py-2 text-[10px] font-semibold uppercase tracking-widest text-prestige-gold lg:inline-flex">
            <Sparkles className="h-3 w-3" strokeWidth={2} />
            On-device
          </span>
        }
      />

      <div className="px-6 lg:px-10 lg:pb-16">
        {summaries.length === 0 ? (
          <div className="animate-rise rounded-2xl bg-card p-8 text-center ring-1 ring-border/60">
            <Sparkles className="mx-auto h-8 w-8 text-prestige-gold" strokeWidth={1.5} />
            <p className="mt-4 font-display text-lg text-prestige-deep">No summaries yet</p>
            <p className="mt-2 max-w-[36ch] text-sm text-muted-foreground">
              Open a downloaded material and tap "Summarise this page" — it'll show up here.
            </p>
            <Link
              to="/courses"
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-prestige-gold px-4 py-2 text-xs font-semibold text-prestige-deep transition-transform active:scale-[0.97]"
            >
              Browse the library
            </Link>
          </div>
        ) : (
          <ul className="space-y-4">
            {summaries.map((s, i) => {
              const module =
                s.kind === "material" ? modules.find((m) => m.id === s.moduleId) : undefined;
              const material =
                s.kind === "material"
                  ? module?.materials.find((mat) => mat.id === s.materialId)
                  : undefined;
              const linkProps =
                s.kind === "personal"
                  ? { to: "/documents/$docId/summary" as const, params: { docId: s.docId } }
                  : s.sections && s.sections.length > 0
                    ? {
                        to: "/courses/$moduleId/summary/$docId" as const,
                        params: { moduleId: s.moduleId, docId: s.materialId },
                      }
                    : {
                        to: "/courses/$moduleId/read/$docId" as const,
                        params: { moduleId: s.moduleId, docId: s.materialId },
                      };
              return (
                <li key={s.key} className="animate-rise" style={{ animationDelay: `${i * 60}ms` }}>
                  <Link
                    {...linkProps}
                    className="block rounded-2xl bg-card p-5 ring-1 ring-border/60 transition-colors hover:ring-prestige-gold/40 lg:p-6"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-prestige-mid">
                        {s.kind === "personal"
                          ? "My documents"
                          : module
                            ? `${module.faculty} · ${module.title}`
                            : s.moduleId}
                      </p>
                      <p className="shrink-0 text-[10px] uppercase tracking-widest text-muted-foreground">
                        {formatRelative(new Date(s.generatedAt).toISOString())}
                      </p>
                    </div>
                    <p className="mt-4 font-display text-base leading-relaxed text-prestige-deep lg:text-lg">
                      {s.body}
                    </p>
                    <div className="mt-5 flex items-center justify-between gap-4">
                      <span className="min-w-0 truncate text-[11px] uppercase tracking-widest text-muted-foreground">
                        {s.kind === "personal"
                          ? `From ${s.title}`
                          : material
                            ? `From ${material.title}`
                            : "Open in reader"}
                        {s.method &&
                          ` · ${
                            s.method === "cloud"
                              ? "Cloud AI"
                              : s.method === "neural"
                                ? "Neural model"
                                : "Extractive"
                          }`}
                      </span>
                      <button
                        aria-label="Copy summary"
                        className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-prestige-mid transition-colors hover:text-prestige-deep"
                        onClick={(e) => {
                          e.preventDefault();
                          copySummary(s.key, s.body);
                        }}
                      >
                        {copiedKey === s.key ? (
                          <>
                            <Check className="h-3.5 w-3.5" strokeWidth={1.75} />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5" strokeWidth={1.75} />
                            Copy
                          </>
                        )}
                      </button>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </MobileShell>
  );
}
