import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  getMoodleConnectionStatus,
  connectMoodle,
  disconnectMoodle,
  type MoodleConnectionStatus,
} from "@/lib/moodle-cloud";
import { useAuth } from "@/hooks/use-auth";
import { getUserDb } from "@/lib/db";
import { syncProgress } from "@/lib/sync";

export type MoodleConnectionState = MoodleConnectionStatus & {
  // undefined while the initial check is still in flight.
  loaded: boolean;
  connecting: boolean;
  connect: (studentNumber: string, password: string) => Promise<boolean>;
  disconnect: () => Promise<void>;
};

const UNLOADED: MoodleConnectionStatus = {
  connected: false,
  needsReconnect: false,
  fullName: null,
  lastSyncAt: null,
  lastSyncError: null,
};

/** Whether the signed-in student has connected their real NUST eLearning
 * account, and the actions to connect/disconnect one — same shape as
 * useCloudAiKey (use-cloud-ai.ts), used by the Settings screen. */
export function useMoodleConnection(): MoodleConnectionState {
  const { user } = useAuth();
  const [status, setStatus] = useState<MoodleConnectionStatus>(UNLOADED);
  const [loaded, setLoaded] = useState(false);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    if (!user) {
      setStatus(UNLOADED);
      setLoaded(true);
      return;
    }
    let cancelled = false;
    setLoaded(false);
    void getMoodleConnectionStatus().then((value) => {
      if (!cancelled) {
        setStatus(value);
        setLoaded(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const connect = useCallback(
    async (studentNumber: string, password: string) => {
      const trimmed = studentNumber.trim();
      if (!trimmed || !password) return false;
      setConnecting(true);
      try {
        const result = await connectMoodle(trimmed, password);
        if (result.connected) {
          setStatus({
            connected: true,
            needsReconnect: false,
            fullName: result.fullName,
            lastSyncAt: null,
            lastSyncError: null,
          });
          // The server-side connect flow already kicked off a best-effort
          // sync (see moodle-server.ts's triggerImmediateMoodleSync), but
          // this device's own local cache was never told to re-pull it —
          // without this, the browser just kept showing whatever Moodle
          // data (if any, possibly a *previous* connection's) it had
          // cached until the next periodic auto-sync tick, which could be
          // minutes to hours away. Pulling right now, before returning,
          // means the courses page reflects the real newly-connected
          // account the moment "Connected" appears, not some time later.
          if (user) {
            try {
              await syncProgress(user.id);
            } catch (err) {
              console.error("Post-connect Moodle sync failed", err);
            }
          }
          return true;
        }
        const message =
          result.reason === "invalid_credentials"
            ? "Those NUST eLearning credentials weren't accepted. Check your student number and password."
            : result.reason === "not_signed_in"
              ? "Sign in to eLearn first, then connect your NUST account."
              : "Couldn't connect right now. Try again in a moment.";
        toast.error(message);
        return false;
      } catch (err) {
        console.error("Failed to connect Moodle account", err);
        toast.error("Couldn't connect right now. Try again.");
        return false;
      } finally {
        setConnecting(false);
      }
    },
    [user],
  );

  const disconnect = useCallback(async () => {
    try {
      await disconnectMoodle();
      setStatus(UNLOADED);
      // clear_moodle_connection (0021_moodle_disconnect_cleanup.sql) already
      // deletes this student's synced courses/sections/modules/grades
      // server-side — clearing the local mirror too means the courses page
      // shows "not connected" immediately, not whatever was last cached
      // here until some future sync happens to overwrite it (which, once
      // disconnected, may never happen again).
      if (user) {
        const db = getUserDb(user.id);
        await Promise.all([
          db.moodleCourses.clear(),
          db.moodleCourseSections.clear(),
          db.moodleCourseModules.clear(),
          db.moodleGrades.clear(),
        ]);
      }
    } catch (err) {
      console.error("Failed to disconnect Moodle account", err);
      toast.error("Couldn't disconnect. Try again.");
    }
  }, [user]);

  return { ...status, loaded, connecting, connect, disconnect };
}
