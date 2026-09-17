import { useCallback, useEffect, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { CloudDownload, X } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";

// Matches the marker ResearchConsentGate.tsx puts on its own root element.
// Polled directly via the DOM (see useElementPresent below) rather than
// calling useResearchConsentGate() a second time here: that hook owns one
// component's worth of local `responded` state, and a second independent
// call would get its own stale copy that never learns the gate was
// dismissed elsewhere — a real bug found by driving this tour end to end
// in a browser, not something that showed up in a type check.
const RESEARCH_CONSENT_GATE_SELECTOR = '[data-onboarding-gate="research-consent"]';

// Dispatched by Profile > Settings' "Replay tour" button (see profile.tsx)
// so a student who skipped this the first time, or just wants a refresher,
// can see it again without a DB round-trip — the tour's own "have I
// finished onboarding" gate (profile.onboarding_completed_at) only
// controls the *automatic* first-run showing, never a deliberate replay.
export const REPLAY_ONBOARDING_TOUR_EVENT = "elearn:replay-onboarding-tour";

type SpotlightStep = {
  id: string;
  // A CSS selector for the one real, already-on-screen element this step
  // teaches — never a copy of the app rendered separately for onboarding
  // purposes (see this file's own header comment on why).
  selector: string;
  matchPath: (pathname: string) => boolean;
  eyebrow: string;
  title: string;
  body: string;
};

// Four steps, each teaching by doing on the real page — no slide explains
// a feature the student doesn't immediately use. Chosen to reach this
// app's actual "aha moment" (a real, on-device AI summary) as fast as
// possible: download a module, open it, open a material, summarise it.
// Every target is a real interactive element already in the DOM (marked
// with the matching data-tour attribute in dashboard.tsx/
// courses.$moduleId.index.tsx/courses.$moduleId.read.$docId.tsx) — this
// component only finds and highlights it, it never renders its own copy
// of the button. Advancing happens on a genuine click of that element, not
// a "Next" button, so the student's very first action in the product is
// also their first onboarding step.
const SPOTLIGHT_STEPS: SpotlightStep[] = [
  {
    id: "download",
    selector: '[data-tour="tour-download"]',
    matchPath: (p) => p === "/dashboard",
    eyebrow: "Step 1 of 4",
    title: "Download a module",
    body: "Tap Get to save this to your device. Once it's downloaded, you can read it with no signal at all.",
  },
  {
    id: "open-module",
    selector: '[data-tour="tour-open-featured"]',
    matchPath: (p) => p === "/dashboard",
    eyebrow: "Step 2 of 4",
    title: "Open a module",
    body: "Tap here to see what's inside — lecture notes, slides, and more.",
  },
  {
    id: "open-material",
    selector: '[data-tour="tour-open-material"]',
    matchPath: (p) => /^\/courses\/[^/]+$/.test(p),
    eyebrow: "Step 3 of 4",
    title: "Start reading",
    body: "Anything downloaded shows Open. Tap it to start reading.",
  },
  {
    id: "summarise",
    selector: '[data-tour="tour-summarise"]',
    matchPath: (p) => /^\/courses\/[^/]+\/read\/[^/]+$/.test(p),
    eyebrow: "Step 4 of 4",
    title: "Try a real AI summary",
    body: "Tap Summarise for an instant summary, generated right on your device — no internet needed.",
  },
];

type Phase = "welcome" | "spotlight" | "complete";

const CALLOUT_GAP = 16;
const SPOTLIGHT_PAD = 8;

function useElementRect(selector: string | null): DOMRect | null {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!selector) {
      setRect(null);
      return;
    }
    let raf = 0;
    let cancelled = false;
    // A short rAF poll rather than a one-off lookup: the target may not be
    // in the DOM yet (e.g. still rendering after a click), may move
    // (scroll, layout shift), or may disappear (navigated away) — this one
    // loop handles all three without separate MutationObserver/scroll/
    // resize wiring. Cheap enough for the few seconds any one step is
    // actually on screen.
    function tick() {
      if (cancelled) return;
      const el = selector ? document.querySelector(selector) : null;
      setRect(el ? el.getBoundingClientRect() : null);
      raf = requestAnimationFrame(tick);
    }
    tick();
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [selector]);

  return rect;
}

/** Lighter-weight cousin of useElementRect above — just "is this selector
 * present right now," polled on an interval rather than every animation
 * frame, since (unlike a spotlight step's target) this runs for however
 * long the whole tour stays eligible, not just a few seconds. */
function useElementPresent(selector: string): boolean {
  const [present, setPresent] = useState(() =>
    typeof document !== "undefined" ? document.querySelector(selector) !== null : false,
  );

  useEffect(() => {
    const id = setInterval(() => {
      setPresent(document.querySelector(selector) !== null);
    }, 250);
    return () => clearInterval(id);
  }, [selector]);

  return present;
}

/** Dims everything except a cutout around the target — the cutout itself
 * (not just a colour) is what tells the student where to look, so this
 * still works for anyone who can't distinguish the highlight colour. No
 * `rect` yet (target not found/not on this page) just dims the whole
 * screen; the callout below still shows with a "waiting" body in that
 * case rather than pointing at nothing. */
function SpotlightOverlay({ rect }: { rect: DOMRect | null }) {
  return (
    <svg
      className="pointer-events-none fixed inset-0 z-[100] h-full w-full transition-opacity duration-300"
      aria-hidden="true"
    >
      <defs>
        <mask id="onboarding-spotlight-mask">
          <rect width="100%" height="100%" fill="white" />
          {rect && (
            <rect
              x={Math.max(rect.left - SPOTLIGHT_PAD, 0)}
              y={Math.max(rect.top - SPOTLIGHT_PAD, 0)}
              width={rect.width + SPOTLIGHT_PAD * 2}
              height={rect.height + SPOTLIGHT_PAD * 2}
              rx={14}
              fill="black"
            />
          )}
        </mask>
      </defs>
      <rect
        width="100%"
        height="100%"
        fill="rgba(6, 20, 15, 0.6)"
        mask="url(#onboarding-spotlight-mask)"
      />
      {rect && (
        <rect
          className="stroke-prestige-gold"
          x={Math.max(rect.left - SPOTLIGHT_PAD, 0)}
          y={Math.max(rect.top - SPOTLIGHT_PAD, 0)}
          width={rect.width + SPOTLIGHT_PAD * 2}
          height={rect.height + SPOTLIGHT_PAD * 2}
          rx={14}
          fill="none"
          strokeWidth={2}
        />
      )}
    </svg>
  );
}

function SpotlightCallout({
  step,
  rect,
  onSkip,
}: {
  step: SpotlightStep;
  rect: DOMRect | null;
  onSkip: () => void;
}) {
  const viewportW = typeof window !== "undefined" ? window.innerWidth : 0;
  const viewportH = typeof window !== "undefined" ? window.innerHeight : 0;
  const below = !rect || viewportH - rect.bottom >= rect.top;
  const top = rect ? (below ? rect.bottom + CALLOUT_GAP : rect.top - CALLOUT_GAP) : viewportH / 2;
  const left = rect
    ? Math.min(Math.max(rect.left, 16), Math.max(viewportW - 296, 16))
    : Math.max(viewportW / 2 - 140, 16);

  return (
    // Positioning (including the "flip above the target" translateY) lives
    // on this outer element, kept deliberately free of any `animation` —
    // a CSS animation's own keyframe values for a property always win
    // over an inline style for that same property, for as long as the
    // animation applies (here, permanently, since animate-rise uses fill
    // mode `both`). Putting `animate-rise` on the outer element together
    // with this positioning transform silently discarded the "flip above"
    // translateY the moment a step needed "above" placement — a real bug
    // found by driving this tour end to end, not visible from the code
    // alone. The entrance animation now lives on the inner element only,
    // where it can't fight this element's own transform.
    <div
      className="fixed z-[101] w-[280px] max-w-[calc(100vw-2rem)]"
      style={{ top, left, transform: rect && !below ? "translateY(-100%)" : undefined }}
    >
      <div
        role="dialog"
        aria-live="polite"
        aria-label={step.title}
        className="animate-rise rounded-2xl bg-card p-4 shadow-xl ring-1 ring-border/60"
      >
        <div className="flex items-start justify-between gap-3">
          <p className="eyebrow">{step.eyebrow}</p>
          <button
            type="button"
            onClick={onSkip}
            aria-label="Skip tour"
            className="-m-1 rounded-full p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" strokeWidth={1.75} />
          </button>
        </div>
        <h2 className="mt-1.5 font-display text-base font-medium text-prestige-deep">
          {step.title}
        </h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
          {rect
            ? step.body
            : "One moment — head back here once that's ready and we'll pick up right where you left off."}
        </p>
        <button
          type="button"
          onClick={onSkip}
          className="mt-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground"
        >
          Skip tour
        </button>
      </div>
    </div>
  );
}

/** The complete first-run onboarding experience: a calm welcome, then four
 * real-page spotlight steps (see SPOTLIGHT_STEPS above), then a plain
 * completion screen — never a feature-by-feature tour of the whole app.
 * Mounted once at the app root (see __root.tsx), not per-page, for the
 * same reason as AutoSync (Feature 23): most pages remount MobileShell on
 * navigation, which would re-trigger a per-page mount otherwise.
 *
 * Gated on `profile.onboarding_completed_at` being null for the automatic
 * first showing, same as the WelcomeTour this replaces — see
 * 0006_profiles's own column. A manual replay (Settings > Replay tour)
 * bypasses that gate via REPLAY_ONBOARDING_TOUR_EVENT without touching the
 * DB flag, so replaying never re-arms the automatic first-run trigger. */
export function OnboardingTour() {
  const { user, profile, completeOnboarding } = useAuth();
  // ResearchConsentGate (also mounted at root, see __root.tsx) is a
  // separate mandatory first-load gate at the same top stacking layer —
  // both it and this tour become eligible independently for a brand-new
  // student (this tour off `profile.onboarding_completed_at`, that gate
  // off its own local "have I responded" check), so without this they can
  // race: whichever resolves its own async check second ends up covering
  // the other. The consent gate's own header comment says it's meant to
  // show "before the rest of the app" — this tour defers to that rather
  // than the reverse, by polling for its DOM marker (see
  // RESEARCH_CONSENT_GATE_SELECTOR above) rather than that hook itself.
  const consentGateShowing = useElementPresent(RESEARCH_CONSENT_GATE_SELECTOR);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);
  const [replaying, setReplaying] = useState(false);
  const [phase, setPhase] = useState<Phase>("welcome");
  const [stepIndex, setStepIndex] = useState(0);

  // This walks through student-only pages (dashboard, courses, the
  // reader) and its spotlight overlay sits above everything — on
  // /admin/* it would be both meaningless and block the entire console
  // for a lecturer who hasn't happened to dismiss it yet.
  const onAdminConsole = pathname.startsWith("/admin");
  const firstRun = Boolean(user && profile && !profile.onboarding_completed_at);
  const active = Boolean(
    user &&
    profile &&
    !onAdminConsole &&
    !dismissed &&
    !consentGateShowing &&
    (firstRun || replaying),
  );

  useEffect(() => {
    function onReplay() {
      setPhase("welcome");
      setStepIndex(0);
      setDismissed(false);
      setReplaying(true);
    }
    window.addEventListener(REPLAY_ONBOARDING_TOUR_EVENT, onReplay);
    return () => window.removeEventListener(REPLAY_ONBOARDING_TOUR_EVENT, onReplay);
  }, []);

  const finish = useCallback(() => {
    setDismissed(true);
    setReplaying(false);
    // Idempotent on a replay (already completed) — still worth calling,
    // since a student who skipped on their very first run and only
    // replays later should still have it recorded as done.
    void completeOnboarding();
  }, [completeOnboarding]);

  // The first spotlight step lives on /dashboard — a student could hit
  // "Let's get started" (or Settings > Replay tour) from any page, so this
  // gets them there rather than showing a dimmed screen with nothing to
  // point at until they happen to navigate there themselves.
  const startSpotlight = useCallback(() => {
    setStepIndex(0);
    setPhase("spotlight");
    if (pathname !== "/dashboard") void navigate({ to: "/dashboard" });
  }, [navigate, pathname]);

  useEffect(() => {
    if (!active) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") finish();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, finish]);

  const step = phase === "spotlight" ? SPOTLIGHT_STEPS[stepIndex] : null;
  const stepOnThisPage = Boolean(step && step.matchPath(pathname));
  const rect = useElementRect(active && step && stepOnThisPage ? step.selector : null);

  useEffect(() => {
    if (!active || phase !== "spotlight" || !step || !stepOnThisPage) return;
    function onClick(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (!target?.closest(step!.selector)) return;
      if (stepIndex === SPOTLIGHT_STEPS.length - 1) {
        setPhase("complete");
      } else {
        setStepIndex((i) => i + 1);
      }
    }
    // Capture phase, not bubble: the real target is often a <Link> whose
    // own click handling can trigger a synchronous client-side navigation
    // (a real bug found by driving this end to end — a bubble-phase
    // listener on `document` lost the race against that navigation's own
    // re-render, which detached and replaced this very listener before
    // the event ever reached it, silently swallowing the click). Capture
    // fires before the target's own handlers run at all, so this always
    // sees the click regardless of what it goes on to do.
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [active, phase, step, stepOnThisPage, stepIndex]);

  if (!active) return null;

  if (phase === "welcome") {
    return (
      <Dialog open onOpenChange={(open) => !open && finish()}>
        <DialogContent className="max-w-md gap-0 p-0">
          <div className="p-6">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-prestige-deep/5 text-prestige-mid">
              <CloudDownload className="h-5 w-5" strokeWidth={1.75} />
            </div>
            <h2 className="mt-4 font-display text-xl font-medium leading-tight text-prestige-deep">
              Welcome to eLearn
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              This is your library for course material — built to work even when your connection
              doesn't. Download a module once, and it's yours to read anywhere, with real AI
              summaries generated right on your device.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              We'll walk through downloading a module and creating your first summary. It takes
              about a minute, and you can skip at any point.
            </p>
          </div>
          <div className="flex items-center justify-end gap-3 border-t border-border/60 px-6 py-4">
            <button
              type="button"
              onClick={finish}
              className="text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground"
            >
              Skip for now
            </button>
            <button
              type="button"
              onClick={startSpotlight}
              className="inline-flex items-center gap-1.5 rounded-full bg-prestige-deep px-4 py-2 text-xs font-semibold text-prestige-cream transition-transform active:scale-[0.97]"
            >
              Let's get started
            </button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (phase === "complete") {
    return (
      <Dialog open onOpenChange={(open) => !open && finish()}>
        <DialogContent className="max-w-md gap-0 p-0">
          <div className="p-6">
            <h2 className="font-display text-xl font-medium leading-tight text-prestige-deep">
              You're ready
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              You just downloaded a module and generated a real AI summary. Everything else in
              eLearn works the same way — explore the rest whenever you're ready.
            </p>
          </div>
          <div className="flex items-center justify-end border-t border-border/60 px-6 py-4">
            <button
              type="button"
              onClick={finish}
              className="inline-flex items-center gap-1.5 rounded-full bg-prestige-deep px-4 py-2 text-xs font-semibold text-prestige-cream transition-transform active:scale-[0.97]"
            >
              Done
            </button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // phase === "spotlight" — only render once the right page is actually
  // showing; a step whose target lives on another route just waits
  // (nothing to dim or point at yet) rather than showing a misleading
  // spotlight on the wrong page.
  if (!step) return null;
  return (
    <>
      <SpotlightOverlay rect={stepOnThisPage ? rect : null} />
      <SpotlightCallout step={step} rect={stepOnThisPage ? rect : null} onSkip={finish} />
    </>
  );
}
