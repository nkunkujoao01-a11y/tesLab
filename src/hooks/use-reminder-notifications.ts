// Foreground-only reminders — see notifyIfPermitted's own comment
// (use-permissions.ts): this app's Notification usage is a plain
// `new Notification()` call, not a service-worker Push subscription, so
// it can only ever fire while this tab/app is actually open and running.
// That's a real, deliberate scope limit: these are "you opened the app
// and something's worth flagging" nudges, not a background reminder that
// wakes the device when the app is closed (which would need Push API +
// VAPID keys + a server-side scheduler, a materially bigger build).
//
// Both hooks below are meant to be mounted once, at the app root (see
// __root.tsx's AutoSync/PrecacheRoutes for the exact "renders nothing,
// mounted once inside AuthProvider" pattern this follows) — not per-page,
// or the same reminder could fire once per navigation. Dedup is tracked
// in the per-user UserDB's syncMeta table (NOT deviceDb.appSettings —
// that table is explicitly device-wide, not account-scoped, per its own
// doc comment in db.ts; this data is a fact about a specific student's
// notification history, so it has to live per-user or one student's
// dismissed reminder could wrongly suppress another's on a shared
// device), keyed so re-checking on every mount (including a fresh one
// after this same reminder already fired today) is always a safe no-op.
import { useEffect } from "react";
import { getUserDb } from "@/lib/db";
import { useAuth } from "@/hooks/use-auth";
import { notifyIfPermitted } from "@/hooks/use-permissions";
import { useUpcomingDeadlines } from "@/hooks/use-moodle-courses";
import { useStreakGrid } from "@/hooks/use-activity";
import { useCurrentWeekGoal, useWeekProgress, getCurrentWeekStart } from "@/hooks/use-study-goals";

const DEADLINE_REMINDER_WINDOW_HOURS = 48;

function formatDueIn(dueDate: number): string {
  const hoursLeft = Math.round((dueDate - Date.now()) / (60 * 60 * 1000));
  if (hoursLeft <= 1) return "due within the hour";
  if (hoursLeft < 24) return `due in about ${hoursLeft} hours`;
  return "due tomorrow";
}

/** Notifies once per assignment (never repeats for the same one, even
 * across app restarts) when it's within DEADLINE_REMINDER_WINDOW_HOURS of
 * its real due date — see useUpcomingDeadlines for where that data comes
 * from (a genuine Moodle mod_assign_get_assignments sync, not a guess). */
export function useDeadlineReminders(): void {
  const { user } = useAuth();
  const deadlines = useUpcomingDeadlines();

  useEffect(() => {
    if (!user || deadlines.length === 0) return;
    const soon = deadlines.filter(
      (d) => d.dueDate - Date.now() <= DEADLINE_REMINDER_WINDOW_HOURS * 60 * 60 * 1000,
    );
    if (soon.length === 0) return;

    void (async () => {
      const db = getUserDb(user.id);
      for (const assignment of soon) {
        const key = `deadline_notified_${assignment.key}`;
        const already = await db.syncMeta.get(key);
        if (already) continue;
        notifyIfPermitted(
          "Assignment due soon",
          `${assignment.assignmentName} (${assignment.courseName}) is ${formatDueIn(assignment.dueDate)}.`,
        );
        await db.syncMeta.put({ key, value: "1" });
      }
    })();
  }, [user, deadlines]);
}

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Notifies at most once per calendar day, only when there's a real
 * streak worth protecting: the student studied yesterday (continuing a
 * run of consecutive days) but hasn't logged anything yet today. Says
 * nothing on a day with no prior streak, or once today's own activity has
 * already happened — an honest "this is genuinely at risk" nudge, not a
 * daily engagement ping regardless of whether it means anything. */
export function useStreakReminder(): void {
  const { user } = useAuth();
  const grid = useStreakGrid();

  useEffect(() => {
    if (!user || grid.length === 0) return;
    const flat = grid.flat();
    const today = flat[flat.length - 1];
    if (today > 0) return; // already studied today — nothing to protect

    // Walk backward *starting the day before today* to count the streak
    // that's actually at risk — currentStreakDays (use-activity.ts) can't
    // be reused directly here since it starts from today's own cell and
    // would report 0 the instant today is empty, which is exactly the
    // case this hook needs to see past.
    let streakBeforeToday = 0;
    for (let i = flat.length - 2; i >= 0; i--) {
      if (flat[i] > 0) streakBeforeToday++;
      else break;
    }
    if (streakBeforeToday === 0) return;

    void (async () => {
      const db = getUserDb(user.id);
      const key = `streak_reminder_${startOfDay(Date.now())}`;
      const already = await db.syncMeta.get(key);
      if (already) return;
      notifyIfPermitted(
        "Keep your streak going",
        `You're on a ${streakBeforeToday}-day streak — open a module today to keep it alive.`,
      );
      await db.syncMeta.put({ key, value: "1" });
    })();
  }, [user, grid]);
}

/** Notifies at most once per week, only when a goal is actually set and
 * the student is genuinely behind pace — past the midpoint of the week
 * (Wed/Thu onward) and under half their target so far. Not a daily nag:
 * says nothing if no goal is set, or if they're already on pace. */
export function useGoalReminder(): void {
  const { user } = useAuth();
  const { target } = useCurrentWeekGoal();
  const progress = useWeekProgress();

  useEffect(() => {
    if (!user || !target) return;
    const dayOfWeek = new Date().getDay(); // 0 = Sunday
    const pastMidweek = dayOfWeek >= 3; // Wednesday onward
    if (!pastMidweek || progress >= target / 2) return;

    void (async () => {
      const db = getUserDb(user.id);
      const key = `goal_reminder_${getCurrentWeekStart()}`;
      const already = await db.syncMeta.get(key);
      if (already) return;
      notifyIfPermitted(
        "Behind on this week's goal",
        `You've studied ${progress} of ${target} times this week — still time to catch up.`,
      );
      await db.syncMeta.put({ key, value: "1" });
    })();
  }, [user, target, progress]);
}
