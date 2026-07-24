import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { fetchAdminModules, type AdminModuleSummary } from "@/lib/admin-console-api";

export const Route = createFileRoute("/admin/modules/")({
  component: AdminModulesPage,
});

function StatusPill({ module }: { module: AdminModuleSummary }) {
  if (module.materialCount === 0) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2 py-0.5 text-[10.5px] font-medium text-muted-foreground">
        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
        Draft
      </span>
    );
  }
  if (module.quizQuestionCount === 0) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-prestige-gold/15 px-2 py-0.5 text-[10.5px] font-medium text-prestige-gold">
        <span className="h-1.5 w-1.5 rounded-full bg-prestige-gold" />
        No quiz yet
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-prestige-mid/15 px-2 py-0.5 text-[10.5px] font-medium text-prestige-mid">
      <span className="h-1.5 w-1.5 rounded-full bg-prestige-mid" />
      Published
    </span>
  );
}

function AdminModulesPage() {
  const [modules, setModules] = useState<AdminModuleSummary[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchAdminModules()
      .then((res) => {
        if (!cancelled) setModules(res);
      })
      .catch((err) => {
        console.error("Failed to load admin modules list", err);
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto max-w-[1100px]">
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className="eyebrow">Catalog</p>
          <h1 className="mt-1 font-display text-2xl font-medium tracking-tight text-prestige-deep">
            Modules
          </h1>
        </div>
        <Link
          to="/admin/modules/new"
          className="inline-flex items-center gap-2 rounded-lg bg-prestige-deep px-3.5 py-2 text-xs font-semibold text-prestige-cream transition-transform active:scale-[0.97]"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2} />
          New module
        </Link>
      </div>

      {error && (
        <p className="rounded-2xl bg-destructive/10 p-4 text-sm text-destructive ring-1 ring-destructive/30">
          Couldn't load the modules list. Try refreshing.
        </p>
      )}

      {!error && (
        <div className="animate-rise overflow-hidden rounded-2xl bg-card ring-1 ring-border/60">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  {["Module", "Materials", "Quiz", "Enrolled", "Status"].map((h) => (
                    <th
                      key={h}
                      className="eyebrow whitespace-nowrap border-b border-border/60 px-4 py-2.5 text-left"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {modules?.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-xs text-muted-foreground">
                      No modules yet — create one to get started.
                    </td>
                  </tr>
                )}
                {modules?.map((m) => (
                  <tr key={m.id} className="transition-colors hover:bg-secondary/60">
                    <td className="border-b border-border/60 px-4 py-3">
                      <Link
                        to="/admin/modules/$moduleId"
                        params={{ moduleId: m.id }}
                        className="block"
                      >
                        <p className="text-sm font-medium text-prestige-deep hover:text-prestige-mid">
                          {m.title}
                        </p>
                        <p className="mt-0.5 text-[10.5px] text-muted-foreground">{m.code}</p>
                      </Link>
                    </td>
                    <td className="border-b border-border/60 px-4 py-3 text-right text-[12px] tabular-nums text-foreground/90">
                      {m.materialCount}
                    </td>
                    <td className="border-b border-border/60 px-4 py-3 text-right text-[12px] tabular-nums text-foreground/90">
                      {m.quizQuestionCount}
                    </td>
                    <td className="border-b border-border/60 px-4 py-3 text-right text-[12px] tabular-nums text-foreground/90">
                      {m.enrolledCount}
                    </td>
                    <td className="border-b border-border/60 px-4 py-3">
                      <StatusPill module={m} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
