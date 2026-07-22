import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { hasCloudKey, saveCloudKey, clearCloudKey } from "@/lib/ai-cloud";
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
