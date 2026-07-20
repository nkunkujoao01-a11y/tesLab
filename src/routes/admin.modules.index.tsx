import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { fetchAdminModules, type AdminModuleSummary } from "@/lib/admin-console-api";

export const Route = createFileRoute("/admin/modules/")({
  component: AdminModulesPage,
});

function StatusPill({ module }: { module: AdminModuleSummary }) {
  if (module.materialCount === 0) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-console-text-faint/15 px-2 py-0.5 font-console-mono text-[10.5px] text-console-text-dim">
        <span className="h-1.5 w-1.5 rounded-full bg-console-text-faint" />
        Draft
      </span>
    );
  }
  if (module.quizQuestionCount === 0) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-console-warn/15 px-2 py-0.5 font-console-mono text-[10.5px] text-console-warn">
        <span className="h-1.5 w-1.5 rounded-full bg-console-warn" />
        No quiz yet
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-console-good/15 px-2 py-0.5 font-console-mono text-[10.5px] text-console-good">
      <span className="h-1.5 w-1.5 rounded-full bg-console-good" />
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
          <p className="font-console-mono text-[11px] uppercase tracking-widest text-console-text-faint">
            Catalog
          </p>
          <h1 className="mt-1 font-console-mono text-[22px] font-semibold tracking-tight text-console-text">
            Modules
          </h1>
        </div>
        <Link
          to="/admin/modules/new"
          className="inline-flex items-center gap-2 rounded-md bg-console-accent px-3.5 py-2 text-[12.5px] font-semibold text-console-bg transition-transform active:scale-[0.97]"
        >
          + New module
        </Link>
      </div>

      {error && (
        <p className="rounded-lg border border-console-critical/40 bg-console-critical/10 p-4 text-sm text-console-critical">
          Couldn't load the modules list. Try refreshing.
        </p>
      )}

      {!error && (
        <div className="overflow-hidden rounded-lg border border-console-border bg-console-surface">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  {["Module", "Materials", "Quiz", "Enrolled", "Status"].map((h) => (
                    <th
                      key={h}
                      className="whitespace-nowrap border-b border-console-border px-4 py-2.5 text-left font-console-mono text-[10px] font-medium uppercase tracking-wider text-console-text-faint"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {modules?.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-8 text-center text-xs text-console-text-faint"
                    >
                      No modules yet — create one to get started.
                    </td>
                  </tr>
                )}
                {modules?.map((m) => (
                  <tr key={m.id} className="hover:bg-console-surface-2">
                    <td className="border-b border-console-border px-4 py-3">
                      <Link
                        to="/admin/modules/$moduleId"
                        params={{ moduleId: m.id }}
                        className="block"
                      >
                        <p className="text-[12.5px] font-medium text-console-text hover:text-console-accent">
                          {m.title}
                        </p>
                        <p className="mt-0.5 font-console-mono text-[10.5px] text-console-text-faint">
                          {m.code}
                        </p>
                      </Link>
                    </td>
                    <td className="border-b border-console-border px-4 py-3 text-right font-console-mono text-[12px] tabular-nums text-console-text">
                      {m.materialCount}
                    </td>
                    <td className="border-b border-console-border px-4 py-3 text-right font-console-mono text-[12px] tabular-nums text-console-text">
                      {m.quizQuestionCount}
                    </td>
                    <td className="border-b border-console-border px-4 py-3 text-right font-console-mono text-[12px] tabular-nums text-console-text">
                      {m.enrolledCount}
                    </td>
                    <td className="border-b border-console-border px-4 py-3">
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
