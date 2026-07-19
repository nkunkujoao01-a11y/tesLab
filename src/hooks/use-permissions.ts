import { useCallback, useEffect, useState } from "react";

/**
 * Persistent Storage API — asks the browser not to silently evict this
 * origin's IndexedDB/Cache Storage (downloaded modules, AI models, personal
 * documents) under storage pressure, the way it can for "best-effort"
 * origins. Directly serves this app's offline-first premise: a student
 * who downloaded a module for a poor-connectivity trip shouldn't lose it
 * because the browser decided to reclaim space for something else. Browser
 * support varies (and even granted, the browser can still refuse based on
 * its own heuristics — usage history, bookmarking, etc. — this API can
 * only ask, not guarantee), so `supported` must be checked before treating
 * `persisted` as meaningful.
 */
export function usePersistentStorage() {
  const [supported, setSupported] = useState(false);
  const [persisted, setPersisted] = useState(false);
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.storage?.persisted) {
      setSupported(false);
      return;
    }
    setSupported(true);
    navigator.storage
      .persisted()
      .then(setPersisted)
      .catch((err) => console.error("Failed to read persisted-storage status", err));
  }, []);

  const requestPersist = useCallback(async () => {
    if (!navigator.storage?.persist) return;
    setRequesting(true);
    try {
      const granted = await navigator.storage.persist();
      setPersisted(granted);
    } catch (err) {
      console.error("Failed to request persistent storage", err);
    } finally {
      setRequesting(false);
    }
  }, []);

  return { supported, persisted, requesting, requestPersist };
}

export type NotificationPermissionState = "unsupported" | "default" | "granted" | "denied";

/**
 * Notifications permission — used to tell a student a long-running
 * on-device task (an AI model download, in particular; these run several
 * minutes and this app's own testing found that silent wait reads as
 * "broken" if you're not staring at the tab, see DEV_LOG.md Feature 31)
 * finished while they were doing something else. Deliberately a single,
 * narrow use — not a general marketing/engagement channel.
 */
export function useNotificationPermission() {
  const [permission, setPermission] = useState<NotificationPermissionState>("unsupported");
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission as NotificationPermissionState);
  }, []);

  const requestPermission = useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    setRequesting(true);
    try {
      const result = await Notification.requestPermission();
      setPermission(result as NotificationPermissionState);
    } catch (err) {
      console.error("Failed to request notification permission", err);
    } finally {
      setRequesting(false);
    }
  }, []);

  return { permission, requesting, requestPermission };
}

/** Fires a real notification only if permission was actually granted —
 * every caller can call this unconditionally without checking permission
 * state itself. Wrapped in try/catch: some browsers throw if called from
 * a background tab or without a user-gesture history, and a failed
 * notification should never break the task it's reporting on. */
export function notifyIfPermitted(title: string, body: string): void {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  try {
    new Notification(title, { body, icon: "/favicon.ico" });
  } catch (err) {
    console.error("Failed to show notification", err);
  }
}
