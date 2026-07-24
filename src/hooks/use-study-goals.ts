// A student's own weekly study goal — purely self-tracking (see
// StudyGoal's own comment in db.ts): never synced to Supabase, never
// visible to a lecturer/admin. "Studied" counts any activityEvents row
// (download/read/summary/quiz/flashcard), matching how useStreakGrid
// already treats any activity as a streak-day — a goal should feel
// consistent with the streak grid on the same page, not use a stricter
// definition of "studied."
import { useCallback, useEffect, useState } from "react";
import { liveQuery } from "dexie";
import { getUserDb } from "@/lib/db";
import { useAuth } from "@/hooks/use-auth";

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfWeek(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime() - d.getDay() * DAY_MS;
}

/** The current week's start (Sunday, local time) — exported so
 * use-reminder-notifications.ts's goal nudge can build the same dedup
 * key this hook keys its data on. */
export function getCurrentWeekStart(): number {
  return startOfWeek(Date.now());
}

export function useCurrentWeekGoal(): {
  target: number | null;
  setTarget: (target: number) => void;
  clearTarget: () => void;
  loading: boolean;
} {
  const { user } = useAuth();
  const weekStart = getCurrentWeekStart();
  const [target, setTargetState] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setTargetState(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    void getUserDb(user.id)
      .studyGoals.get(weekStart)
      .then((row) => {
        setTargetState(row?.target ?? null);
        setLoading(false);
      });
  }, [user, weekStart]);

  const setTarget = useCallback(
    (next: number) => {
      if (!user) return;
      setTargetState(next);
      void getUserDb(user.id).studyGoals.put({ weekStart, target: next, createdAt: Date.now() });
    },
    [user, weekStart],
  );

  const clearTarget = useCallback(() => {
    if (!user) return;
    setTargetState(null);
    void getUserDb(user.id).studyGoals.delete(weekStart);
  }, [user, weekStart]);

  return { target, setTarget, clearTarget, loading };
}

/** Distinct days with at least one activityEvents row so far this week —
 * live-updating, same Dexie liveQuery pattern useStreakGrid/
 * useDailyActivityCounts already use. */
export function useWeekProgress(): number {
  const { user } = useAuth();
  const weekStart = getCurrentWeekStart();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!user) {
      setCount(0);
      return;
    }
    const db = getUserDb(user.id);
    const sub = liveQuery(() =>
      db.activityEvents.where("timestamp").aboveOrEqual(weekStart).toArray(),
    ).subscribe({
      next: (events) => {
        const days = new Set(
          events.map((e) => {
            const d = new Date(e.timestamp);
            d.setHours(0, 0, 0, 0);
            return d.getTime();
          }),
        );
        setCount(days.size);
      },
      error: (err) => console.error("Failed to compute week progress", err),
    });
    return () => sub.unsubscribe();
  }, [user, weekStart]);

  return count;
}
