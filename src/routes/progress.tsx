import { createFileRoute } from "@tanstack/react-router";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import { Brain, ListChecks, Target, TriangleAlert } from "lucide-react";
import { MobileShell, PageHeader } from "@/components/MobileShell";
import { fetchModules } from "@/lib/modules-api";
import { cn } from "@/lib/utils";
import {
  useStreakGrid,
  useReadMaterialIds,
  useDailyActivityCounts,
  moduleCompletion,
} from "@/hooks/use-activity";
import { useCurrentWeekGoal, useWeekProgress } from "@/hooks/use-study-goals";
import { useQuizInsights, useFlashcardInsights } from "@/hooks/use-progress-insights";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

const GOAL_PRESETS = [2, 3, 5, 7];

const ACTIVITY_CHART_CONFIG: ChartConfig = {
  count: { label: "Actions", color: "var(--prestige-gold)" },
};

export const Route = createFileRoute("/progress")({
  loader: () => fetchModules(),
  head: () => ({
    meta: [
      { title: "Progress — eLearn" },
      {
        name: "description",
        content:
          "A quiet record of the reading you actually did — modules, chapters, streaks, and rank.",
      },
    ],
  }),
  component: ProgressPage,
});

/** Purely self-tracking — no lecturer/admin ever sees this, see
 * StudyGoal's own comment in db.ts. Preset chips rather than a raw number
 * input: picking "3x/week" is one tap, and the four presets cover the
 * realistic range without needing a stepper/slider. */
function WeeklyGoalCard() {
  const { target, setTarget, clearTarget, loading } = useCurrentWeekGoal();
  const progress = useWeekProgress();

  return (
    <section className="animate-rise rounded-2xl bg-card p-6 ring-1 ring-border/60 lg:col-span-3 lg:p-8">
      <div className="flex items-center gap-2 text-prestige-mid">
        <Target className="h-4 w-4" strokeWidth={1.75} />
        <p className="eyebrow">This week's goal</p>
      </div>
      {loading ? null : target ? (
        <>
          <div className="mt-4 flex items-end justify-between gap-4">
            <p className="font-display text-2xl text-prestige-deep">
              {progress} of {target} days studied
            </p>
            <button
              type="button"
              onClick={clearTarget}
              className="shrink-0 text-[11px] font-medium text-prestige-mid hover:text-prestige-deep hover:underline"
            >
              Change
            </button>
          </div>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-prestige-deep/10">
            <div
              className="h-full bg-prestige-gold transition-all"
              style={{ width: `${Math.min(100, (progress / target) * 100)}%` }}
            />
          </div>
        </>
      ) : (
        <>
          <p className="mt-2 text-sm text-muted-foreground">
            Set a personal goal for how many days you want to study this week — just for you, nobody
            else sees this.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {GOAL_PRESETS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setTarget(n)}
                className="rounded-full bg-secondary px-4 py-2 text-xs font-semibold text-prestige-deep transition-colors hover:bg-prestige-deep hover:text-prestige-cream"
              >
                {n === 7 ? "Every day" : `${n}x/week`}
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function ProgressPage() {
  const modules = Route.useLoaderData();
  const streak = useStreakGrid();
  const dailyActivity = useDailyActivityCounts(14);
  const readMaterialIds = useReadMaterialIds();
  const quizInsights = useQuizInsights(modules);
  const flashcardInsights = useFlashcardInsights(modules);

  const totalMaterials = modules.reduce((sum, m) => sum + m.materials.length, 0);
  const totalMaterialsOpened = modules.reduce(
    (sum, m) => sum + moduleCompletion(m.materials, m.id, readMaterialIds).opened,
    0,
  );
  const overallPct = totalMaterials === 0 ? 0 : totalMaterialsOpened / totalMaterials;
  const pct = Math.round(overallPct * 100);
  const dash = 2 * Math.PI * 44;
  const offset = dash * (1 - overallPct);

  const quizByModule = new Map(quizInsights.byModule.map((q) => [q.moduleId, q]));
  const flashcardByModule = new Map(flashcardInsights.byModule.map((f) => [f.moduleId, f]));
  const hasUnderstandingData = quizInsights.quizzesTaken > 0 || flashcardInsights.totalReviewed > 0;

  return (
    <MobileShell>
      <PageHeader eyebrow="Twelve weeks" title="Your record" />

      <div className="grid gap-8 px-6 lg:grid-cols-3 lg:gap-10 lg:px-10 lg:pb-16">
        {/* Ring */}
        <section className="animate-rise rounded-2xl bg-prestige-deep p-6 text-prestige-cream lg:col-span-1 lg:p-8">
          <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-prestige-gold">
            Overall completion
          </p>
          <div className="mt-6 flex items-center justify-center">
            <div className="relative">
              <svg width="180" height="180" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="44"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="4"
                  className="text-prestige-cream/10"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="44"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="4"
                  strokeDasharray={dash}
                  strokeDashoffset={offset}
                  strokeLinecap="round"
                  transform="rotate(-90 50 50)"
                  className="text-prestige-gold transition-all"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-display text-4xl">{pct}%</span>
                <span className="text-[10px] uppercase tracking-widest text-prestige-cream/50">
                  across {modules.length} modules
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Streak */}
        <section className="animate-rise rounded-2xl bg-card p-6 ring-1 ring-border/60 lg:col-span-2 lg:p-8">
          <div className="mb-6 flex items-end justify-between">
            <div>
              <p className="eyebrow">Study streak</p>
              <p className="mt-1 font-display text-lg text-prestige-deep">
                Twelve weeks, day by day
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
              <span>Low</span>
              <div className="h-2.5 w-2.5 rounded-[2px] bg-prestige-gold/20" />
              <div className="h-2.5 w-2.5 rounded-[2px] bg-prestige-gold/50" />
              <div className="h-2.5 w-2.5 rounded-[2px] bg-prestige-gold/80" />
              <div className="h-2.5 w-2.5 rounded-[2px] bg-prestige-gold" />
              <span>High</span>
            </div>
          </div>
          <div className="grid grid-cols-12 gap-1.5">
            {streak.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-1.5">
                {week.map((intensity, di) => (
                  <div
                    key={di}
                    className={cn(
                      "aspect-square rounded-[3px]",
                      intensity === 0 && "bg-prestige-deep/[0.06]",
                      intensity === 1 && "bg-prestige-gold/25",
                      intensity === 2 && "bg-prestige-gold/60",
                      intensity === 3 && "bg-prestige-gold",
                    )}
                    title={`Week ${wi + 1}, day ${di + 1}`}
                  />
                ))}
              </div>
            ))}
          </div>
        </section>

        <WeeklyGoalCard />

        {/* Daily activity trend — same underlying local activityEvents
         * data as the streak grid above, kept as real per-day counts
         * instead of the grid's 0-3 bucketed intensity, for a clearer
         * recent-activity shape at a glance. */}
        <section className="animate-rise rounded-2xl bg-card p-6 ring-1 ring-border/60 lg:col-span-3 lg:p-8">
          <p className="eyebrow">Last 14 days</p>
          <p className="mt-1 font-display text-lg text-prestige-deep">Actions per day</p>
          <ChartContainer config={ACTIVITY_CHART_CONFIG} className="mt-5 h-[180px] w-full">
            <BarChart data={dailyActivity}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} interval={1} />
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent labelKey="day" indicator="line" />}
              />
              <Bar dataKey="count" fill="var(--color-count)" radius={4} animationDuration={600} />
            </BarChart>
          </ChartContainer>
        </section>

        {/* How you're doing — real quiz/flashcard performance, not just
         * whether a material was opened (see use-progress-insights.ts's
         * own header comment on why this used to not exist at all). Only
         * renders once there's real data to show — an empty state here
         * would just be noise before a student has taken anything. */}
        {hasUnderstandingData && (
          <section className="animate-rise rounded-2xl bg-card p-6 ring-1 ring-border/60 lg:col-span-3 lg:p-8">
            <p className="eyebrow">How you're doing</p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl bg-secondary/60 p-4">
                <div className="flex items-center gap-2 text-prestige-mid">
                  <ListChecks className="h-4 w-4" strokeWidth={1.75} />
                  <p className="text-[10px] font-semibold uppercase tracking-widest">
                    Quiz average
                  </p>
                </div>
                {quizInsights.overallAvgPct === null ? (
                  <p className="mt-2 text-sm text-muted-foreground">No quizzes taken yet.</p>
                ) : (
                  <>
                    <p className="mt-1 font-display text-3xl text-prestige-deep">
                      {Math.round(quizInsights.overallAvgPct * 100)}%
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      across {quizInsights.quizzesTaken}{" "}
                      {quizInsights.quizzesTaken === 1 ? "quiz" : "quizzes"} · best attempt each
                    </p>
                  </>
                )}
              </div>
              <div className="rounded-xl bg-secondary/60 p-4">
                <div className="flex items-center gap-2 text-prestige-mid">
                  <Brain className="h-4 w-4" strokeWidth={1.75} />
                  <p className="text-[10px] font-semibold uppercase tracking-widest">
                    Flashcards known
                  </p>
                </div>
                {flashcardInsights.overallKnownPct === null ? (
                  <p className="mt-2 text-sm text-muted-foreground">No flashcards rated yet.</p>
                ) : (
                  <>
                    <p className="mt-1 font-display text-3xl text-prestige-deep">
                      {Math.round(flashcardInsights.overallKnownPct * 100)}%
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {flashcardInsights.totalKnown} of {flashcardInsights.totalReviewed} cards
                      rated "I knew this"
                    </p>
                  </>
                )}
              </div>
            </div>

            {quizInsights.weakestModule &&
              quizInsights.weakestModule.avgPct < 0.6 &&
              quizInsights.byModule.length > 1 && (
                <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-destructive/10 p-3 text-xs text-destructive">
                  <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
                  <p>
                    Lowest quiz average: <strong>{quizInsights.weakestModule.title}</strong> at{" "}
                    {Math.round(quizInsights.weakestModule.avgPct * 100)}% — worth another pass.
                  </p>
                </div>
              )}
          </section>
        )}

        {/* Per module bars */}
        <section className="animate-rise rounded-2xl bg-card p-6 ring-1 ring-border/60 lg:col-span-3 lg:p-8">
          <div className="flex items-end justify-between gap-4">
            <p className="eyebrow">By module</p>
            <p className="text-[11px] text-muted-foreground">
              {totalMaterialsOpened} of {totalMaterials} materials opened overall
            </p>
          </div>
          <ul className="mt-6 divide-y divide-border/60">
            {modules.map((m) => {
              const completion = moduleCompletion(m.materials, m.id, readMaterialIds);
              const quiz = quizByModule.get(m.id);
              const flashcards = flashcardByModule.get(m.id);
              return (
                <li key={m.id} className="py-4">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 lg:grid-cols-[minmax(0,240px)_minmax(0,1fr)_auto] lg:gap-6">
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-prestige-mid">
                        {m.code}
                      </p>
                      <p className="truncate font-display text-sm text-prestige-deep">{m.title}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {completion.opened}/{completion.total} materials opened
                      </p>
                    </div>
                    <div className="col-span-2 h-1 w-full overflow-hidden rounded-full bg-prestige-deep/10 lg:col-auto lg:col-start-2">
                      <div
                        className="h-full bg-prestige-gold"
                        style={{ width: `${completion.pct * 100}%` }}
                      />
                    </div>
                    <p className="font-display text-sm text-prestige-deep lg:col-start-3">
                      {Math.round(completion.pct * 100)}%
                    </p>
                  </div>
                  {(quiz || flashcards) && (
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                      {quiz && (
                        <span className="inline-flex items-center gap-1.5">
                          <ListChecks className="h-3 w-3" strokeWidth={1.75} />
                          Quiz avg {Math.round(quiz.avgPct * 100)}% ({quiz.quizCount})
                        </span>
                      )}
                      {flashcards && (
                        <span className="inline-flex items-center gap-1.5">
                          <Brain className="h-3 w-3" strokeWidth={1.75} />
                          {Math.round(flashcards.knownPct * 100)}% of {flashcards.reviewedCount}{" "}
                          cards known
                        </span>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </MobileShell>
  );
}
