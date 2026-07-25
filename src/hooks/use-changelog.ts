import { useEffect, useState } from "react";
import { deviceDb } from "@/lib/db";
import { APP_VERSION } from "@/lib/changelog";

const LAST_SEEN_VERSION_KEY = "changelog_last_seen_version";

/** Whether the student has already seen the "What's new" panel for the
 * current APP_VERSION — device-local (like every other small app-settings
 * flag: CLOUD_AI_ENABLED_KEY, MODEL_DOWNLOADED_KEY), not per-account,
 * since "have I looked at what changed" is a fact about this browser's
 * own history, not something worth syncing across a student's devices. */
export function useChangelogSeen(): { hasUnseen: boolean; markSeen: () => void } {
  const [lastSeen, setLastSeen] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    void deviceDb.appSettings.get(LAST_SEEN_VERSION_KEY).then((row) => {
      if (!cancelled) setLastSeen(row?.value ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const markSeen = () => {
    setLastSeen(APP_VERSION);
    void deviceDb.appSettings.put({ key: LAST_SEEN_VERSION_KEY, value: APP_VERSION });
  };

  // undefined (still loading) reads as "nothing new" rather than briefly
  // flashing a badge that then disappears once the real value loads.
  const hasUnseen = lastSeen !== undefined && lastSeen !== APP_VERSION;

  return { hasUnseen, markSeen };
}
