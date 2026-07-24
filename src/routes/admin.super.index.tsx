import { createFileRoute, Link } from "@tanstack/react-router";
import { Download, BookOpenText, Sparkles, ListChecks, Layers, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePlatformAnalytics } from "@/hooks/use-platform-analytics";
import type { ActivityType } from "@/lib/db";

export const Route = createFileRoute("/admin/super/")({
  component: SuperAdminOverviewPage,
});

// Same local, unshared StatTile shape as admin.index.tsx — no reason to
// hoist it into a shared component for two call sites with slightly
// different tone rules.
function StatTile({ label, value, delta }: { label: string; value: number; delta: string }) {
  return (
    <div className="animate-rise rounded-2xl bg-card p-4 ring-1 ring-border/60">
      <p className="text-[11.5px] text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-[26px] font-medium tabular-nums text-prestige-deep">
        {value}
      </p>
      <p className="mt-1 text-[11px] tabular-nums text-muted-foreground">{delta}</p>
    </div>
  );
}

const ACTIVITY_ICONS: Record<ActivityType, typeof Download> = {
  download: Download,
  read: BookOpenText,
  summary: Sparkles,
  quiz: ListChecks,
  flashcard: Layers,
};

const ACTIVITY_LABELS: Record<ActivityType, string> = {
  download: "Materials downloaded",
  read: "Materials read",
  summary: "Summaries generated",
  quiz: "Quizzes taken",
  flashcard: "Flashcard decks studied",
};

function SuperAdminOverviewPage() {
  const { data, loading, refetch } = usePlatformAnalytics();

  return (
    <div className="mx-auto max-w-[1100px]">
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className="eyebrow">Super admin</p>
          <h1 className="mt-1 font-display text-2xl font-medium tracking-tight text-prestige-deep">
            Platform overview
          </h1>
        </div>
        <button
          type="button"
          onClick={refetch}
          className="text-xs font-medium text-prestige-mid hover:text-prestige-deep hover:underline"
        >
          Refresh
        </button>
      </div>

      <div className="mb-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Students" value={data?.totalStudents ?? 0} delta="registered accounts" />
        <StatTile
          label="Active, last 7 days"
          value={data?.activeLast7Days ?? 0}
          delta="distinct students"
        />
        <StatTile
          label="Active, last 30 days"
          value={data?.activeLast30Days ?? 0}
          delta="distinct students"
        />
        <StatTile
          label="Feedback received"
          value={data?.feedbackCount ?? 0}
          delta={
            data?.avgFeedbackRating != null
              ? `avg rating ${data.avgFeedbackRating}/5`
              : "no ratings yet"
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="animate-rise overflow-hidden rounded-2xl bg-card ring-1 ring-border/60">
          <div className="border-b border-border/60 px-4 py-3.5">
            <p className="text-sm font-medium text-prestige-deep">Feature usage</p>
            <p className="mt-0.5 text-[11.5px] text-muted-foreground">All-time, platform-wide</p>
          </div>
          <div>
            {(Object.keys(ACTIVITY_LABELS) as ActivityType[]).map((type) => {
              const Icon = ACTIVITY_ICONS[type];
              return (
                <div
                  key={type}
                  className="flex items-center gap-2.5 border-b border-border/60 px-4 py-3 last:border-none"
                >
                  <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-prestige-deep/5 text-prestige-mid">
                    <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
                  </div>
                  <p className="min-w-0 flex-1 truncate text-xs text-foreground/90">
                    {ACTIVITY_LABELS[type]}
                  </p>
                  <span className="shrink-0 text-xs font-medium tabular-nums text-prestige-deep">
                    {data?.eventsByType[type] ?? 0}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="animate-rise overflow-hidden rounded-2xl bg-card ring-1 ring-border/60">
            <div className="border-b border-border/60 px-4 py-3.5">
              <p className="text-sm font-medium text-prestige-deep">Research study</p>
              <p className="mt-0.5 text-[11.5px] text-muted-foreground">Anonymous, by design</p>
            </div>
            <div className="grid grid-cols-2 gap-3 p-4">
              <div>
                <p className="text-[11px] text-muted-foreground">Consent responses</p>
                <p className="mt-1 font-display text-lg font-medium tabular-nums text-prestige-deep">
                  {data?.researchConsentCount ?? 0}
                </p>
                <p className="text-[10.5px] text-muted-foreground">
                  {data?.researchConsentAgreedCount ?? 0} agreed
                </p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Survey responses</p>
                <p className="mt-1 font-display text-lg font-medium tabular-nums text-prestige-deep">
                  {data?.researchSurveyResponseCount ?? 0}
                </p>
              </div>
            </div>
            <div className="border-t border-border/60 px-4 py-3">
              <Link
                to="/admin/super/research"
                className="text-xs font-medium text-prestige-mid hover:text-prestige-deep hover:underline"
              >
                View research data →
              </Link>
            </div>
          </div>

          <div
            className={cn(
              "animate-rise rounded-2xl bg-card p-4 ring-1 ring-border/60",
              "flex gap-2.5",
            )}
          >
            <Info className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
            <p className="text-[11.5px] leading-relaxed text-muted-foreground">
              Not yet tracked: time spent per session and mobile-vs-desktop breakdown — no device or
              duration signal is recorded anywhere today. "Active" above means at least one recorded
              action in that window, not time-on-task.
            </p>
          </div>
        </div>
      </div>

      {loading && <p className="mt-6 text-center text-xs text-muted-foreground">Loading…</p>}
    </div>
  );
}
