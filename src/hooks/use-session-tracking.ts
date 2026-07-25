// Device/platform + real session-duration tracking for the super admin
// platform analytics — see 0040_study_sessions.sql for the full reasoning
// on why this writes straight to Supabase (no local Dexie table, no
// sync.ts involvement — nobody reads their own session data back).
//
// Deliberately simple, per an explicit tradeoff decision: "tab visible"
// counts as active, pausing when the student switches away and resuming
// when they come back. This does NOT detect true idle (tab left open and
// visible while the student walked away) — a more precise version would
// need activity listeners (touch/click/scroll/keyboard) and an idle
// timer, more moving parts and battery cost than this data's actual
// stakes justify. The analytics this feeds describe it honestly as "time
// the app was open and visible," not focused study time.
import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";

const FLUSH_INTERVAL_MS = 30_000;

export type DeviceType = "mobile" | "tablet" | "desktop";

// Same hand-rolled navigator.userAgent regex style as use-pwa-install.ts's
// isIos()/isAndroid() — no UA-parsing library is installed, and this only
// needs coarse buckets for analytics, not detailed browser detection.
function detectDeviceType(): DeviceType {
  const ua = navigator.userAgent;
  if (/ipad/i.test(ua) || (/android/i.test(ua) && !/mobile/i.test(ua))) return "tablet";
  if (/iphone|ipod|android.*mobile|mobi/i.test(ua)) return "mobile";
  return "desktop";
}

function detectPlatform(): string {
  const ua = navigator.userAgent;
  if (/iphone|ipad|ipod/i.test(ua)) return "iOS";
  if (/android/i.test(ua)) return "Android";
  if (/windows/i.test(ua)) return "Windows";
  if (/mac os/i.test(ua)) return "macOS";
  if (/linux/i.test(ua)) return "Linux";
  return "Other";
}

/** Mounted once at the app root (see __root.tsx), same "renders nothing"
 * shape as AutoSync/PrecacheRoutes/ReminderNotifications. */
export function useSessionTracking(): void {
  const { user } = useAuth();

  useEffect(() => {
    if (!user || typeof document === "undefined") return;

    const sessionId = crypto.randomUUID();
    const startedAt = new Date().toISOString();
    const deviceType = detectDeviceType();
    const platform = detectPlatform();
    let accumulatedSeconds = 0;
    let visibleSince: number | null = document.visibilityState === "visible" ? Date.now() : null;

    const flush = () => {
      void supabase
        .from("study_sessions")
        .upsert(
          {
            id: sessionId,
            user_id: user.id,
            started_at: startedAt,
            updated_at: new Date().toISOString(),
            duration_seconds: accumulatedSeconds,
            device_type: deviceType,
            platform,
          },
          { onConflict: "id" },
        )
        .then(({ error }) => {
          if (error) console.error("Failed to flush session tracking", error);
        });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        if (visibleSince !== null) {
          accumulatedSeconds += Math.round((Date.now() - visibleSince) / 1000);
          visibleSince = null;
        }
        flush();
      } else {
        visibleSince = Date.now();
      }
    };

    const intervalId = setInterval(() => {
      if (visibleSince === null) return;
      accumulatedSeconds += Math.round((Date.now() - visibleSince) / 1000);
      visibleSince = Date.now();
      flush();
    }, FLUSH_INTERVAL_MS);

    document.addEventListener("visibilitychange", handleVisibilityChange);
    // The reliable "tab/app closing" signal, unlike beforeunload (notably
    // unreliable on mobile Safari) — best-effort, no retry if it fails,
    // same non-critical-telemetry reasoning as the rest of this hook.
    window.addEventListener("pagehide", flush);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", flush);
    };
  }, [user]);
}
