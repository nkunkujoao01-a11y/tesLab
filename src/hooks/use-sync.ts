import { useCallback, useEffect, useState } from "react";
import { liveQuery } from "dexie";
import { toast } from "sonner";
import { getUserDb } from "@/lib/db";
import { syncProgress } from "@/lib/sync";
import { useAuth } from "@/hooks/use-auth";

const LAST_SYNCED_KEY = "lastSyncedAt";

// A student can stay on one page (e.g. the courses list, waiting for a
// just-connected NUST account's modules) for a while without ever
// reloading or toggling connectivity — the two triggers below (sign-in,
// coming back online) alone left nothing to catch up an in-progress
// server-side sync in that window. This is a light safety net on top of
// those, not the primary mechanism.
const PERIODIC_SYNC_MS = 5 * 60 * 1000;

/** Fires a background sync on sign-in (including session restore on
 * reload), whenever the device comes back online, and periodically while
 * the app stays open and online — silent on failure (console-logged only;
 * a background sync failing isn't something to interrupt the user over,
 * and it'll just retry on the next trigger). Mount exactly once, at the
 * app root — not per-page, or it would re-fire on every navigation since
 * most page components remount MobileShell. */
export function useAutoSync(): void {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    void syncProgress(user.id).catch((err) => console.error("Background sync failed", err));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const handleOnline = () => {
      void syncProgress(user.id).catch((err) => console.error("Background sync failed", err));
    };
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      if (!navigator.onLine) return;
      void syncProgress(user.id).catch((err) => console.error("Background sync failed", err));
    }, PERIODIC_SYNC_MS);
    return () => clearInterval(interval);
  }, [user]);
}

/** Reactive "when did this device last sync" — a plain liveQuery over the
 * same syncMeta row useAutoSync/useManualSync write to, so a background
 * sync's completion shows up here too, not just an explicit manual one. */
export function useLastSyncedAt(): number | undefined {
  const { user } = useAuth();
  const [lastSyncedAt, setLastSyncedAt] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (!user) {
      setLastSyncedAt(undefined);
      return;
    }
    const db = getUserDb(user.id);
    const sub = liveQuery(() => db.syncMeta.get(LAST_SYNCED_KEY)).subscribe({
      next: (row) => setLastSyncedAt(row ? Number(row.value) : undefined),
      error: (err) => console.error("Failed to read last-synced time", err),
    });
    return () => sub.unsubscribe();
  }, [user]);

  return lastSyncedAt;
}

export function useManualSync() {
  const { user } = useAuth();
  const [syncing, setSyncing] = useState(false);

  const sync = useCallback(async () => {
    if (!user) return;
    setSyncing(true);
    try {
      await syncProgress(user.id);
    } catch (err) {
      console.error("Manual sync failed", err);
      toast.error("Couldn't sync. Check your connection and try again.");
    } finally {
      setSyncing(false);
    }
  }, [user]);

  return { sync, syncing };
}
