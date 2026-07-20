import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MessageSquareWarning, MessageSquareText, Users } from "lucide-react";
import { fetchAdminOverview, type AdminOverview } from "@/lib/admin-console-api";
import { formatRelative } from "@/lib/mock-data";

export const Route = createFileRoute("/admin/")({
  component: AdminOverviewPage,
});

function StatTile({
  label,
  value,
  delta,
  tone = "flat",
}: {
  label: string;
  value: number;
  delta: string;
  tone?: "up" | "flat" | "warn";
}) {
  const toneClass =
    tone === "up"
      ? "text-console-good"
      : tone === "warn"
        ? "text-console-warn"
        : "text-console-text-faint";
  return (
    <div className="rounded-lg border border-console-border bg-console-surface p-4">
      <p className="text-[11.5px] text-console-text-dim">{label}</p>
      <p className="mt-2 font-console-mono text-[26px] font-semibold tabular-nums text-console-text">
        {value}
      </p>
      <p className={`mt-1 font-console-mono text-[11px] tabular-nums ${toneClass}`}>{delta}</p>
    </div>
  );
}

function AdminOverviewPage() {
  const [data, setData] = useState<AdminOverview | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchAdminOverview()
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((err) => {
        console.error("Failed to load admin overview", err);
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
            Namibia University of Science and Technology
          </p>
          <h1 className="mt-1 font-console-mono text-[22px] font-semibold tracking-tight text-console-text">
            Console overview
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
          Couldn't load the console overview. Try refreshing.
        </p>
      )}

      {!error && (
        <>
          <div className="mb-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile
              label="Modules published"
              value={data?.moduleCount ?? 0}
              delta="in the catalog"
            />
            <StatTile
              label="Students enrolled"
              value={data?.distinctEnrolledStudentCount ?? 0}
              delta="distinct students"
              tone="up"
            />
            <StatTile
              label="Quiz questions live"
              value={data?.quizQuestionCount ?? 0}
              delta={data ? `across ${data.modulesWithQuizCount} modules` : ""}
            />
            <StatTile
              label="Feedback received"
              value={data?.feedbackCount ?? 0}
              delta="from Profile > Send feedback"
              tone={data && data.feedbackCount > 0 ? "warn" : "flat"}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
            <div className="overflow-hidden rounded-lg border border-console-border bg-console-surface">
              <div className="flex items-center justify-between border-b border-console-border px-4 py-3.5">
                <div>
                  <p className="text-[13px] font-semibold text-console-text">Feedback inbox</p>
                  <p className="mt-0.5 text-[11.5px] text-console-text-faint">Most recent</p>
                </div>
                <Link
                  to="/admin/feedback"
                  className="font-console-mono text-[11px] text-console-info hover:underline"
                >
                  View all →
                </Link>
              </div>
              <div>
                {data && data.recentFeedback.length === 0 && (
                  <p className="px-4 py-6 text-xs text-console-text-faint">
                    No feedback submitted yet.
                  </p>
                )}
                {data?.recentFeedback.map((f) => (
                  <div
                    key={f.id}
                    className="flex gap-2.5 border-b border-console-border px-4 py-3 last:border-none"
                  >
                    <div className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-md bg-console-surface-2 text-console-info">
                      <MessageSquareWarning className="h-3.5 w-3.5" strokeWidth={1.75} />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xs text-console-text">{f.message}</p>
                      <p className="mt-0.5 font-console-mono text-[10.5px] text-console-text-faint">
                        {f.fullName} · {formatRelative(f.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="overflow-hidden rounded-lg border border-console-border bg-console-surface">
              <div className="flex items-center justify-between border-b border-console-border px-4 py-3.5">
                <div>
                  <p className="text-[13px] font-semibold text-console-text">Recently registered</p>
                  <p className="mt-0.5 text-[11.5px] text-console-text-faint">Across all modules</p>
                </div>
                <Link
                  to="/admin/modules"
                  className="font-console-mono text-[11px] text-console-info hover:underline"
                >
                  Modules →
                </Link>
              </div>
              <div>
                {data && data.recentEnrollments.length === 0 && (
                  <p className="px-4 py-6 text-xs text-console-text-faint">
                    No one has enrolled yet.
                  </p>
                )}
                {data?.recentEnrollments.map((e) => (
                  <div
                    key={`${e.userId}-${e.enrolledAt}`}
                    className="flex items-center gap-2.5 border-b border-console-border px-4 py-2.5 last:border-none"
                  >
                    <div className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-console-surface-2 text-console-text-dim">
                      <Users className="h-3 w-3" strokeWidth={1.75} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs text-console-text">{e.fullName}</p>
                      <p className="truncate text-[10.5px] text-console-text-faint">
                        {e.moduleTitle}
                      </p>
                    </div>
                    <span className="shrink-0 font-console-mono text-[10px] text-console-text-faint">
                      {formatRelative(e.enrolledAt)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-8 flex items-center justify-between border-t border-console-border pt-4 font-console-mono text-[10.5px] text-console-text-faint">
            <span className="flex items-center gap-1.5">
              <MessageSquareText className="h-3 w-3" strokeWidth={1.75} />
              eLearn Admin Console — internal tool, not visible to students
            </span>
          </div>
        </>
      )}
    </div>
  );
}
