import { useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { Smartphone, X } from "lucide-react";
import { deviceDb } from "@/lib/db";
import { useAuth } from "@/hooks/use-auth";
import { usePwaInstall } from "@/hooks/use-pwa-install";

const DISMISSED_KEY = "install_prompt_dismissed";

/** A one-time, dismissible nudge to install the app — same shape and
 * persistence as ByokPrompt.tsx (its own comment has the full reasoning
 * for the pattern): shown once per device to a signed-in student who
 * hasn't already installed or dismissed it, gone for good on this device
 * once dismissed. The same install action stays permanently reachable
 * from Profile > Install afterward — this banner is only the first nudge,
 * never the only way to find it. Renders nothing at all on iOS: Safari
 * never fires `beforeinstallprompt`, so there's no one-tap action to
 * offer here — the manual "Share > Add to Home Screen" instructions live
 * in Profile instead, where a student can find them when *they* decide
 * to look, not as an unpromptable banner. */
export function InstallAppPrompt() {
  const { user, profile } = useAuth();
  const { installed, canPromptInstall, promptInstall, isIos } = usePwaInstall();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [dismissed, setDismissed] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) return;
    void deviceDb.appSettings.get(DISMISSED_KEY).then((row) => {
      setDismissed(row?.value === "true");
    });
  }, [user]);

  const dismiss = () => {
    setDismissed(true);
    void deviceDb.appSettings.put({ key: DISMISSED_KEY, value: "true" });
  };

  const onAuthPage = pathname === "/login" || pathname === "/signup";
  const shouldShow = Boolean(
    user &&
    profile?.onboarding_completed_at &&
    !installed &&
    !isIos &&
    canPromptInstall &&
    dismissed === false &&
    !onAuthPage,
  );

  if (!shouldShow) return null;

  return (
    <div className="animate-rise fixed inset-x-4 bottom-24 z-40 mx-auto max-w-md rounded-2xl bg-prestige-deep p-4 text-prestige-cream shadow-xl lg:inset-x-auto lg:bottom-6 lg:left-72 lg:right-6 lg:max-w-sm">
      <div className="flex items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-prestige-cream/10 text-prestige-gold">
          <Smartphone className="h-4 w-4" strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Install eLearn</p>
          <p className="mt-1 text-xs text-prestige-cream/70">
            Add it to your home screen for faster access and full offline support.
          </p>
          <button
            type="button"
            onClick={() => void promptInstall().finally(dismiss)}
            className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-prestige-gold px-3 py-1.5 text-xs font-semibold text-prestige-deep transition-transform active:scale-[0.97]"
          >
            Install now
          </button>
        </div>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={dismiss}
          className="shrink-0 rounded-full p-1 text-prestige-cream/60 transition-colors hover:bg-prestige-cream/10 hover:text-prestige-cream"
        >
          <X className="h-4 w-4" strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
}
