import { Loader2 } from "lucide-react";

/** Shown while a route's loader is in flight (see router.tsx's
 * defaultPendingComponent) — every real route loader in this app fetches
 * from Supabase, so without this the previous screen just sits frozen with
 * no feedback on a slow or dropped connection. Doubles as this app's splash
 * screen: it's also what's on screen for that first `defaultPendingMs`
 * window right after a cold launch, before the very first route's own data
 * has loaded — the one moment a student opening the app (or its installed
 * PWA icon) has nothing else to look at yet. Carries the same icon mark
 * (`/icon-192.png`) already used for the home-screen icon/manifest, so a
 * freshly-launched app reads as "eLearn" from the very first frame rather
 * than an unbranded spinner — kept on the app's ordinary `bg-background`
 * (not a full-bleed themed takeover like ResearchConsentGate) since this
 * same component reappears on every ordinary route transition too, not
 * just the first cold launch. */
export function RoutePending() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
      <img src="/icon-192.png" alt="" className="h-14 w-14 rounded-full" />
      <p className="font-display text-lg font-medium tracking-tight text-prestige-deep">eLearn</p>
      <div className="flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin text-prestige-mid" strokeWidth={1.75} />
        <p className="text-xs font-medium uppercase tracking-widest text-prestige-mid">
          Loading&hellip;
        </p>
      </div>
    </div>
  );
}
