// Keeps the screen from dimming/locking during a long, in-progress model
// download — found to matter from a real user report, back when a model
// download (transformers.js's own main-thread fetch, see ai-model.ts/
// ai-chat.ts's own comments on why downloads stay on the main thread) had
// no way to resume a partial fetch at all, so the screen sleeping mid-
// download effectively restarted it from zero next time.
//
// That restart-from-zero problem is now actually fixed independently (see
// resumable-fetch.ts, DEV_LOG.md Feature 74) — a download interrupted by
// the screen locking, an app switch, or even the tab closing outright now
// resumes from its last saved chunk instead of restarting. This wake lock
// is kept anyway, downgraded from "the only thing standing between a
// locked screen and starting over" to a smaller, still-real optimization:
// some browsers/OSes throttle a backgrounded tab's network activity even
// without fully suspending it, so keeping the screen (and tab) foregrounded
// still finishes a download faster in real wall-clock time — a nice-to-
// have now, not the thing correctness depends on. Still only a partial,
// best-effort mechanism in its own right: the Screen Wake Lock API only
// ever prevents the screen from sleeping while the tab stays visible and
// foregrounded, auto-releasing the instant the document is hidden — this
// was never going to cover "switch apps or leave the PWA" on its own,
// which is exactly why resumability, not a longer-lived wake lock, was the
// real fix needed.
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
