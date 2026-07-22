import { useCallback, useEffect, useState } from "react";
import { liveQuery } from "dexie";
import { toast } from "sonner";
import {
  hasCloudKey,
  saveCloudKey,
  clearCloudKey,
  getCloudAiUsageToday,
  CLOUD_AI_ENABLED_KEY,
  CLOUD_AI_DAILY_LIMIT,
} from "@/lib/ai-cloud";
import { deviceDb } from "@/lib/db";
import { useAuth } from "@/hooks/use-auth";

export type CloudAiKeyState = {
  // undefined while the initial check is still in flight.
  connected: boolean | undefined;
  connecting: boolean;
  connect: (key: string) => Promise<boolean>;
  disconnect: () => Promise<void>;
};

/** Whether the signed-in student has a saved free cloud AI key (Gemini,
 * BYOK — see ai-cloud.ts), and the actions to connect/disconnect one. Used
 * both by the AI settings screen (the actual connect/disconnect UI) and by
 * any cloud-only feature (e.g. documents.$docId.notes.tsx) that just needs
 * to know whether to show its own "connect a key" empty state instead of a
 * generate button that would always fail. */
export function useCloudAiKey(): CloudAiKeyState {
  const { user } = useAuth();
  const [connected, setConnected] = useState<boolean | undefined>(undefined);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    if (!user) {
      setConnected(false);
      return;
    }
    let cancelled = false;
    setConnected(undefined);
    void hasCloudKey().then((value) => {
      if (!cancelled) setConnected(value);
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const connect = useCallback(async (key: string) => {
    const trimmed = key.trim();
    if (!trimmed) return false;
    setConnecting(true);
    try {
      await saveCloudKey(trimmed);
      setConnected(true);
      return true;
    } catch (err) {
      console.error("Failed to save the cloud AI key", err);
      // The one specific, expected-to-recur failure here isn't a per-user
      // problem at all — it's the project not having set up the
      // encryption secret yet (see supabase/migrations/0014_ai_provider_keys.sql's
      // own comment on this). Surfacing the real Postgres exception text
      // instead of a generic "try again" saves whoever's debugging this
      // from re-diagnosing something already explained in that migration.
      const message = err instanceof Error ? err.message : "";
      toast.error(
        message.includes("encryption secret is not configured")
          ? "Cloud AI isn't set up on this deployment yet — an admin needs to configure the key encryption secret (see supabase/migrations/0014_ai_provider_keys.sql)."
          : "Couldn't save that key. Try again.",
      );
      return false;
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    try {
      await clearCloudKey();
      setConnected(false);
    } catch (err) {
      console.error("Failed to remove the cloud AI key", err);
      toast.error("Couldn't disconnect. Try again.");
    }
  }, []);

  return { connected, connecting, connect, disconnect };
}

/** Whether the online AI should be *tried* at all — independent of whether
 * a key is connected. Default true (missing row = enabled) so a student who
 * already connected a key before this setting existed sees no behavior
 * change until they deliberately turn it off; when off, generation goes
 * straight to the on-device path even while online with a valid key, same
 * as being offline. Device-local, same liveQuery-backed appSettings pattern
 * as useReadingWidth/useChatModelChoice — a preference about this device,
 * not account data. */
export function useCloudAiEnabled(): [boolean, (enabled: boolean) => void] {
  const [enabled, setEnabledState] = useState(true);

  useEffect(() => {
    const sub = liveQuery(() => deviceDb.appSettings.get(CLOUD_AI_ENABLED_KEY)).subscribe({
      next: (row) => setEnabledState(row?.value !== "false"),
      error: (err) => console.error("Failed to read cloud AI enabled setting", err),
    });
    return () => sub.unsubscribe();
  }, []);

  const setEnabled = useCallback((next: boolean) => {
    setEnabledState(next);
    deviceDb.appSettings
      .put({ key: CLOUD_AI_ENABLED_KEY, value: next ? "true" : "false" })
      .catch((err) => console.error("Failed to save cloud AI enabled setting", err));
  }, []);

  return [enabled, setEnabled];
}

export type CloudAiQuota = { used: number; limit: number };

/** Today's cloud AI usage for the signed-in student, refetched whenever the
 * settings screen mounts — a plain one-shot read (not a liveQuery) since
 * syncMeta's counter is written from deep inside ai-cloud.ts's request path
 * across several other hooks/routes, not through a single mutator this
 * screen could subscribe to as cheaply; good enough for "roughly how much
 * of today's limit is left" rather than a live ticking counter. */
export function useCloudAiQuota(): CloudAiQuota {
  const { user } = useAuth();
  const [quota, setQuota] = useState<CloudAiQuota>({ used: 0, limit: CLOUD_AI_DAILY_LIMIT });

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void getCloudAiUsageToday(user.id).then((used) => {
      if (!cancelled) setQuota({ used, limit: CLOUD_AI_DAILY_LIMIT });
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  return quota;
}
