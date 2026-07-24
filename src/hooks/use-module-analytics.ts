// Per-module admin analytics — reads the same already-synced student data
// (activity_events, read_materials, module_grades) directly, rather than
// a separate reporting table that could drift from what a student's own
// devices actually recorded. See 0028_analytics_and_messaging.sql for the
// lecturer-read RLS policies this depends on.
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { RosterEntry } from "@/hooks/use-enrollment";

export type StudentAnalytics = {
  userId: string;
  materialsRead: number;
  // null means "no grades recorded yet," not "0%" — an honestly-distinct
  // state from a real, low grade.
  avgGradePct: number | null;
  // Last activity_events entry *anywhere in the app*, not scoped to this
  // module — activity_events has no module_id column (see db.ts's own
  // ActivityEvent shape), so this is the closest real signal available:
  // "has this student used eLearn recently at all," not "in this module
  // specifically." Labeled that way in the UI rather than implying more
  // precision than the data actually has.
  lastActiveAt: number | null;
};

// Ordered newest-first and read top-down per user — a reasonably generous
// bound for a roster-sized (tens, not thousands, of students) query, not
// a guarantee every student's true most-recent event is captured if the
// combined roster's event history is unusually large. An honest
// approximation, same spirit as this app's other "good enough, not
// exhaustive" real-data signals (see moduleCompletion in use-activity.ts).
const ACTIVITY_SAMPLE_LIMIT = 1000;

export function useModuleAnalytics(
  moduleId: string | null,
  roster: RosterEntry[],
): { analytics: Map<string, StudentAnalytics>; loading: boolean } {
  const [analytics, setAnalytics] = useState<Map<string, StudentAnalytics>>(new Map());
  const [loading, setLoading] = useState(false);
  const rosterKey = roster
    .map((r) => r.userId)
    .sort()
    .join(",");

  useEffect(() => {
    if (!moduleId || roster.length === 0) {
      setAnalytics(new Map());
      return;
    }
    let cancelled = false;
    const userIds = roster.map((r) => r.userId);
    setLoading(true);
    void Promise.all([
      supabase
        .from("read_materials")
        .select("user_id, material_id")
        .eq("module_id", moduleId)
        .in("user_id", userIds),
      supabase
        .from("module_grades")
        .select("user_id, score, max_score")
        .eq("module_id", moduleId)
        .in("user_id", userIds),
      supabase
        .from("activity_events")
        .select("user_id, event_at")
        .in("user_id", userIds)
        .order("event_at", { ascending: false })
        .limit(ACTIVITY_SAMPLE_LIMIT),
    ]).then(([readRes, gradesRes, activityRes]) => {
      if (cancelled) return;
      if (readRes.error) console.error("Failed to load read history for analytics", readRes.error);
      if (gradesRes.error) console.error("Failed to load grades for analytics", gradesRes.error);
      if (activityRes.error)
        console.error("Failed to load activity for analytics", activityRes.error);

      const materialsByUser = new Map<string, Set<string>>();
      for (const row of readRes.data ?? []) {
        const set = materialsByUser.get(row.user_id) ?? new Set<string>();
        set.add(row.material_id);
        materialsByUser.set(row.user_id, set);
      }

      const gradeTotalsByUser = new Map<string, { scoreSum: number; maxSum: number }>();
      for (const row of gradesRes.data ?? []) {
        const totals = gradeTotalsByUser.get(row.user_id) ?? { scoreSum: 0, maxSum: 0 };
        totals.scoreSum += row.score;
        totals.maxSum += row.max_score;
        gradeTotalsByUser.set(row.user_id, totals);
      }

      // Rows arrive newest-first — the first one seen per user is their
      // most recent, everything after that for the same user is ignored.
      const lastActiveByUser = new Map<string, number>();
      for (const row of activityRes.data ?? []) {
        if (!lastActiveByUser.has(row.user_id)) {
          lastActiveByUser.set(row.user_id, new Date(row.event_at).getTime());
        }
      }

      const next = new Map<string, StudentAnalytics>();
      for (const userId of userIds) {
        const gradeTotals = gradeTotalsByUser.get(userId);
        next.set(userId, {
          userId,
          materialsRead: materialsByUser.get(userId)?.size ?? 0,
          avgGradePct:
            gradeTotals && gradeTotals.maxSum > 0
              ? Math.round((gradeTotals.scoreSum / gradeTotals.maxSum) * 100)
              : null,
          lastActiveAt: lastActiveByUser.get(userId) ?? null,
        });
      }
      setAnalytics(next);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
    // rosterKey (derived from roster's user ids) is the real dependency —
    // `roster` itself is a new array identity every render (useModuleRoster
    // returns a fresh array from state), which would otherwise refetch on
    // every render for no reason.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleId, rosterKey]);

  return { analytics, loading };
}
