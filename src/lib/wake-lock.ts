// Keeps the screen from dimming/locking during a long, in-progress model
// download — found to matter from a real user report: a model download
// (transformers.js's own main-thread fetch, see ai-model.ts/ai-chat.ts's
// own comments on why downloads stay on the main thread) has no way to
// resume a partial fetch, so the screen going to sleep mid-download
// effectively restarts it from zero next time.
//
// This is a real but *partial* fix, not a full one: the Screen Wake Lock
// API only ever prevents the screen from sleeping while the tab stays
// visible and foregrounded — the spec has the browser auto-release the
// lock the instant the document is hidden (switching apps, backgrounding
// the PWA, locking the phone with the power button), which is exactly the
// other half of what was reported ("when you switch panel or leave the
// pwa"). Surviving *that* would need the download to happen as a real
// Background Fetch (a Service Worker API, Chrome-only, with real platform-
// support and integration uncertainty against transformers.js's own
// Cache Storage lookups) — a materially bigger, riskier build than this.
export async function acquireWakeLock(): Promise<WakeLockSentinel | null> {
  if (typeof navigator === "undefined" || !("wakeLock" in navigator)) return null;
  try {
    return await navigator.wakeLock.request("screen");
  } catch (err) {
    // Real, expected rejections here: the tab isn't visible right now, or
    // the OS/browser declined (e.g. low battery). Either way, the download
    // itself should proceed regardless — this is a best-effort mitigation,
    // never a requirement for the download to work.
    console.error("Couldn't acquire a screen wake lock", err);
    return null;
  }
}

export async function releaseWakeLock(sentinel: WakeLockSentinel | null): Promise<void> {
  if (!sentinel) return;
  try {
    await sentinel.release();
  } catch (err) {
    console.error("Couldn't release the screen wake lock", err);
  }
}
