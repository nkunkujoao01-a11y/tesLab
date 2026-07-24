import { useEffect, useState } from "react";

// The `beforeinstallprompt` event isn't in TypeScript's own DOM lib —
// Chrome/Edge/Android-specific, never standardized. Typed here rather
// than pulling in a third-party ambient-types package for one event
// shape this app only ever reads two fields off of.
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  // iOS Safari has no `display-mode` media query support for this — it
  // exposes `navigator.standalone` instead, its own non-standard flag for
  // exactly this. Checked as a fallback, not the primary signal, since
  // every other engine (including iOS's own in-app browsers) either
  // doesn't set it at all or doesn't mean the same thing there.
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
}

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

/** Tracks whether this device can install the app, is already running it
 * installed, or (iOS specifically) needs the manual "Share > Add to Home
 * Screen" flow since Safari never fires `beforeinstallprompt` at all —
 * there is no programmatic install trigger on iOS, only instructions.
 * Shared by the one-time install nudge (InstallAppPrompt) and the
 * always-available Settings > Profile install button, so both read the
 * exact same state instead of duplicating this detection. */
export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(isStandalone());

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      // Stops Chrome's own default mini-infobar so this app controls
      // exactly when/how the prompt is offered, instead of a browser
      // banner appearing on its own schedule alongside this app's UI.
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const handleInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  const promptInstall = async (): Promise<boolean> => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    return outcome === "accepted";
  };

  return {
    installed,
    // True only when the browser has actually offered a real,
    // one-tap install (Chrome/Edge/Android) — iOS is handled as its own
    // distinct case by callers (see canShowIosInstructions), not folded
    // in here, since there's nothing to "prompt" there.
    canPromptInstall: deferredPrompt !== null,
    promptInstall,
    isIos: isIos(),
  };
}
