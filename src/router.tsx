import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { RoutePending } from "@/components/RoutePending";

let viewTransitionRejectionsSilenced = false;

// A fast tap (or Link preload-on-hover immediately followed by a click, or
// two navigations in quick succession) legitimately supersedes an
// in-flight document.startViewTransition() before it finishes — the
// browser then rejects that transition's promises with "Transition was
// skipped". That's expected View Transitions API behavior, not a bug, but
// TanStack Router doesn't catch it, so it otherwise surfaces as an
// uncaught rejection in the console on ordinary navigation.
//
// A second, real-device-reported variant of the same underlying class:
// navigating right as the tab is backgrounded (screen locked, app
// switched, PWA left) — Chrome requires the document to be visible to run
// a view transition, and rejects with `InvalidStateError` instead of the
// "skipped" AbortError above when that's not the case. Same reasoning
// applies: the navigation itself still completes (React Router doesn't
// depend on the transition promise to finish updating the DOM), only the
// cosmetic cross-fade is skipped, so this is equally safe to silence
// rather than let it read as a crash in the console.
function silenceExpectedViewTransitionRejections() {
  if (viewTransitionRejectionsSilenced || typeof window === "undefined") return;
  viewTransitionRejectionsSilenced = true;
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason as { name?: string; message?: string } | undefined;
    if (reason?.name === "AbortError" && reason.message?.includes("skipped")) {
      event.preventDefault();
      return;
    }
    if (
      reason?.name === "InvalidStateError" &&
      reason.message?.toLowerCase().includes("transition")
    ) {
      event.preventDefault();
    }
  });
}

export const getRouter = () => {
  silenceExpectedViewTransitionRejections();
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    // FR80: every route loader (dashboard, courses, progress, the reader…)
    // fetches from Supabase, so without this, a slow/offline network just
    // leaves the previous screen frozen with no feedback until the loader
    // either resolves or throws. defaultPendingMs delays showing it briefly
    // so a fast, cached load doesn't flash a skeleton for one frame.
    defaultPendingComponent: RoutePending,
    defaultPendingMs: 300,
    defaultPendingMinMs: 300,
    // Real page-to-page motion via the browser's native View Transitions
    // API (document.startViewTransition) — a genuine cross-fade between
    // screens instead of an instant, static swap. A router-level default
    // rather than a per-<Link> prop, so every navigation in the app gets
    // it with zero changes to the ~40 <Link>s already written. Pure
    // progressive enhancement: browsers without View Transitions support
    // (some older Safari/Firefox) just navigate instantly, exactly as
    // before — no fallback code needed.
    defaultViewTransition: true,
  });

  return router;
};
