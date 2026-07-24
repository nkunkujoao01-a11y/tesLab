import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MessageSquareWarning, MessageSquareText, Plus, Users } from "lucide-react";
import { cn } from "@/lib/utils";
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
      ? "text-prestige-mid"
      : tone === "warn"
        ? "text-destructive"
        : "text-muted-foreground";
  return (
    <div className="animate-rise rounded-2xl bg-card p-4 ring-1 ring-border/60">
      <p className="text-[11.5px] text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-[26px] font-medium tabular-nums text-prestige-deep">
        {value}
      </p>
      <p className={cn("mt-1 text-[11px] tabular-nums", toneClass)}>{delta}</p>
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
          <p className="eyebrow">Namibia University of Science and Technology</p>
          <h1 className="mt-1 font-display text-2xl font-medium tracking-tight text-prestige-deep">
            Console overview
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
            <div className="animate-rise overflow-hidden rounded-2xl bg-card ring-1 ring-border/60">
              <div className="flex items-center justify-between border-b border-border/60 px-4 py-3.5">
                <div>
                  <p className="text-sm font-medium text-prestige-deep">Feedback inbox</p>
                  <p className="mt-0.5 text-[11.5px] text-muted-foreground">Most recent</p>
                </div>
                <Link
                  to="/admin/feedback"
                  className="text-xs font-medium text-prestige-mid hover:text-prestige-deep hover:underline"
                >
                  View all →
                </Link>
              </div>
              <div>
                {data && data.recentFeedback.length === 0 && (
                  <p className="px-4 py-6 text-xs text-muted-foreground">
                    No feedback submitted yet.
                  </p>
                )}
                {data?.recentFeedback.map((f) => (
                  <div
                    key={f.id}
                    className="flex gap-2.5 border-b border-border/60 px-4 py-3 last:border-none"
                  >
                    <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-prestige-deep/5 text-prestige-mid">
                      <MessageSquareWarning className="h-3.5 w-3.5" strokeWidth={1.75} />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xs text-foreground/90">{f.message}</p>
                      <p className="mt-0.5 text-[10.5px] text-muted-foreground">
                        {f.fullName} · {formatRelative(f.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="animate-rise overflow-hidden rounded-2xl bg-card ring-1 ring-border/60">
              <div className="flex items-center justify-between border-b border-border/60 px-4 py-3.5">
                <div>
                  <p className="text-sm font-medium text-prestige-deep">Recently registered</p>
                  <p className="mt-0.5 text-[11.5px] text-muted-foreground">Across all modules</p>
                </div>
                <Link
                  to="/admin/modules"
                  className="text-xs font-medium text-prestige-mid hover:text-prestige-deep hover:underline"
                >
                  Modules →
                </Link>
              </div>
              <div>
                {data && data.recentEnrollments.length === 0 && (
                  <p className="px-4 py-6 text-xs text-muted-foreground">
                    No one has enrolled yet.
                  </p>
                )}
                {data?.recentEnrollments.map((e) => (
                  <div
                    key={`${e.userId}-${e.enrolledAt}`}
                    className="flex items-center gap-2.5 border-b border-border/60 px-4 py-2.5 last:border-none"
                  >
                    <div className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-prestige-deep/5 text-prestige-mid">
                      <Users className="h-3 w-3" strokeWidth={1.75} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs text-foreground/90">{e.fullName}</p>
                      <p className="truncate text-[10.5px] text-muted-foreground">
                        {e.moduleTitle}
                      </p>
                    </div>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {formatRelative(e.enrolledAt)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-8 flex items-center justify-between border-t border-border/60 pt-4 text-[10.5px] text-muted-foreground">
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
