import { useEffect, useState } from "react";
import { liveQuery } from "dexie";
import { getUserDb, materialKey, type ActivityType } from "@/lib/db";
import { useAuth } from "@/hooks/use-auth";

// Both functions below are called `void`-prefixed, fire-and-forget, from
// their callers (a failed activity-log write shouldn't block or interrupt
// whatever the user was actually doing — downloading, summarising, reading).
// They catch their own errors so a failure is a console log, not an
// unhandled promise rejection.

export async function logActivity(userId: string, type: ActivityType): Promise<void> {
  try {
    await getUserDb(userId).activityEvents.add({
      id: crypto.randomUUID(),
      type,
      timestamp: Date.now(),
    });
  } catch (err) {
    console.error("Failed to log activity", err);
  }
}

/** Records that a material was actually opened — a real, honest signal,
 * distinct from the app's static mock "lessons completed" numbers (see
 * DEV_LOG.md). Also logs a "read" activity event for the streak grid. */
export async function markMaterialRead(
  userId: string,
  materialId: string,
  moduleId: string,
): Promise<void> {
  try {
    const db = getUserDb(userId);
    const now = Date.now();
    const key = materialKey(moduleId, materialId);
    const existing = await db.readMaterials.get(key);
    await db.readMaterials.put({
      key,
      materialId,
      moduleId,
      firstReadAt: existing?.firstReadAt ?? now,
      lastReadAt: now,
    });
  } catch (err) {
    console.error("Failed to record material as read", err);
  }
  await logActivity(userId, "read");
}

/** Records real scroll-based reading progress for a material (see
 * src/hooks/use-reading-progress.ts) — takes the max of the new and any
 * previously-stored value, so scrolling back up never looks like regress. */
export async function updateMaterialReadProgress(
  userId: string,
  materialId: string,
  moduleId: string,
  pct: number,
): Promise<void> {
  try {
    const db = getUserDb(userId);
    const key = materialKey(moduleId, materialId);
    const existing = await db.readMaterials.get(key);
    const now = Date.now();
    await db.readMaterials.put({
      key,
      materialId,
      moduleId,
      firstReadAt: existing?.firstReadAt ?? now,
      lastReadAt: now,
      progressPct: Math.max(existing?.progressPct ?? 0, Math.round(pct)),
    });
  } catch (err) {
    console.error("Failed to record reading progress", err);
  }
}

/** Reactive real read-progress (0-100) for one material, defaulting to 0
 * for a material that hasn't been opened, or opened before this feature
 * existed. */
export function useMaterialReadProgress(moduleId: string, materialId: string): number {
  const { user } = useAuth();
  const [pct, setPct] = useState(0);

  useEffect(() => {
    if (!user) {
      setPct(0);
      return;
    }
    const db = getUserDb(user.id);
    const key = materialKey(moduleId, materialId);
    const sub = liveQuery(() => db.readMaterials.get(key)).subscribe({
      next: (row) => setPct(row?.progressPct ?? 0),
      error: (err) => console.error("Failed to read reading progress", err),
    });
    return () => sub.unsubscribe();
  }, [user, moduleId, materialId]);

  return pct;
}

/** Returns composite `moduleId::materialId` keys — see materialKey() in
 * lib/db.ts. Check with `.has(materialKey(moduleId, materialId))`. */
export function useReadMaterialIds(): Set<string> {
  const { user } = useAuth();
  const [ids, setIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (!user) {
      setIds(new Set());
      return;
    }
    const db = getUserDb(user.id);
    const sub = liveQuery(() => db.readMaterials.toArray()).subscribe({
      next: (rows) => setIds(new Set(rows.map((r) => r.key))),
      error: (err) => console.error("Failed to read materials-read state", err),
    });
    return () => sub.unsubscribe();
  }, [user]);

  return ids;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function intensityFor(count: number): number {
  if (count <= 0) return 0;
  if (count <= 1) return 1;
  if (count <= 3) return 2;
  return 3;
}

/** Consecutive days of activity ending today, derived from useStreakGrid's
 * output — the grid's last cell is always today (see that hook's own day
 * indexing), so this just walks backward counting non-zero intensity
 * cells until the first gap. Replaces the old mock "rank" stat on
 * Dashboard (see DEV_LOG.md, Feature 25) — there's no real classmate data
 * to rank against, but a real streak is honest and fits the same slot. */
export function currentStreakDays(grid: number[][]): number {
  const flat = grid.flat();
  let streak = 0;
  for (let i = flat.length - 1; i >= 0; i--) {
    if (flat[i] > 0) streak++;
    else break;
  }
  return streak;
}

/** Real study-activity grid, shaped like the old mock `streak` data:
 * weeks[0] is the oldest week, weeks[weeks.length - 1] is the current week,
 * each week is 7 days (Sun..Sat), each cell an 0-3 intensity. */
export function useStreakGrid(weeks = 12): number[][] {
  const { user } = useAuth();
  const [grid, setGrid] = useState<number[][]>(() =>
    Array.from({ length: weeks }, () => Array(7).fill(0)),
  );

  useEffect(() => {
    if (!user) {
      setGrid(Array.from({ length: weeks }, () => Array(7).fill(0)));
      return;
    }
    const db = getUserDb(user.id);
    const rangeStart = startOfDay(Date.now()) - (weeks * 7 - 1) * DAY_MS;
    const sub = liveQuery(() =>
      db.activityEvents.where("timestamp").aboveOrEqual(rangeStart).toArray(),
    ).subscribe({
      next: (events) => {
        const countByDay = new Map<number, number>();
        for (const event of events) {
          const day = startOfDay(event.timestamp);
          countByDay.set(day, (countByDay.get(day) ?? 0) + 1);
        }
        const todayStart = startOfDay(Date.now());
        const gridStart = todayStart - (weeks * 7 - 1) * DAY_MS;
        const next = Array.from({ length: weeks }, (_, w) =>
          Array.from({ length: 7 }, (_, d) => {
            const dayTs = gridStart + (w * 7 + d) * DAY_MS;
            if (dayTs > todayStart) return 0;
            return intensityFor(countByDay.get(dayTs) ?? 0);
          }),
        );
        setGrid(next);
      },
      error: (err) => console.error("Failed to compute streak grid", err),
    });
    return () => sub.unsubscribe();
  }, [user, weeks]);

  return grid;
}

export function useSummariesGeneratedCount(): number {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!user) {
      setCount(0);
      return;
    }
    const db = getUserDb(user.id);
    const sub = liveQuery(() => db.materialSummaries.count()).subscribe({
      next: setCount,
      error: (err) => console.error("Failed to count summaries", err),
    });
    return () => sub.unsubscribe();
  }, [user]);

  return count;
}

/** The module id whose material was most recently opened, or undefined if
 * nothing has been read yet. Used to pick a real "Continuing now" module
 * on the Dashboard instead of a hardcoded one. */
export function useMostRecentlyReadModuleId(): string | undefined {
  const { user } = useAuth();
  const [moduleId, setModuleId] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!user) {
      setModuleId(undefined);
      return;
    }
    const db = getUserDb(user.id);
    const sub = liveQuery(() => db.readMaterials.toArray()).subscribe({
      next: (rows) => {
        const latest = rows.reduce<(typeof rows)[number] | undefined>(
          (best, row) => (!best || row.lastReadAt > best.lastReadAt ? row : best),
          undefined,
        );
        setModuleId(latest?.moduleId);
      },
      error: (err) => console.error("Failed to read most-recent module", err),
    });
    return () => sub.unsubscribe();
  }, [user]);

  return moduleId;
}

/** Fraction of a module's materials that have been opened at least once —
 * the app's real, honest stand-in for "completion" now that the old mock
 * `progress`/`completedLessons` fields don't exist in the database (see
 * DEV_LOG.md, Feature 10). */
export function moduleCompletion(
  materials: { id: string }[],
  moduleId: string,
  readMaterialIds: Set<string>,
): { opened: number; total: number; pct: number } {
  const total = materials.length;
  const opened = materials.filter((mat) =>
    readMaterialIds.has(materialKey(moduleId, mat.id)),
  ).length;
  return { opened, total, pct: total === 0 ? 0 : opened / total };
}
