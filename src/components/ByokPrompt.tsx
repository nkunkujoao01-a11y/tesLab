import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Sparkles, X } from "lucide-react";
import { deviceDb } from "@/lib/db";
import { useAuth } from "@/hooks/use-auth";
import { useCloudAiKey } from "@/hooks/use-cloud-ai";

const DISMISSED_KEY = "byok_prompt_dismissed";

/** A one-time, honestly-labeled nudge to connect a free cloud AI key (see
 * ai-cloud.ts) — shown once, automatically, the first time a signed-in
 * student who has already been through WelcomeTour lands on a real page
 * without one connected. Dismissing it (the X, or just following the link)
 * marks it seen for good on this device — same per-device
 * `deviceDb.appSettings` flag pattern as this app's other one-time AI
 * preferences (see ai-chat.ts's CHAT_MODEL_CHOICE_KEY), not a cross-device
 * account field, since there's nothing wrong with seeing this again on a
 * genuinely different device. The same "Enable free AI" action stays
 * permanently reachable from AI settings afterward — this banner is only
 * the *first* nudge, never the only way to find it. */
export function ByokPrompt() {
  const { user, profile } = useAuth();
  const { connected } = useCloudAiKey();
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
      connected === false &&
      dismissed === false &&
      !onAuthPage,
  );

  if (!shouldShow) return null;

  return (
    <div className="animate-rise fixed inset-x-4 bottom-24 z-40 mx-auto max-w-md rounded-2xl bg-prestige-deep p-4 text-prestige-cream shadow-xl lg:inset-x-auto lg:bottom-6 lg:left-72 lg:right-6 lg:max-w-sm">
      <div className="flex items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-prestige-cream/10 text-prestige-gold">
          <Sparkles className="h-4 w-4" strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Enable free AI-powered quizzes</p>
          <p className="mt-1 text-xs text-prestige-cream/70">
            Takes about 30 seconds, uses your own free Google AI key, costs you nothing.
          </p>
          <Link
            to="/settings"
            onClick={dismiss}
            className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-prestige-gold px-3 py-1.5 text-xs font-semibold text-prestige-deep transition-transform active:scale-[0.97]"
          >
            Connect a free key
          </Link>
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
