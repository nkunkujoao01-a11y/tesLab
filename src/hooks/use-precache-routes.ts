import { useEffect, useRef } from "react";
import { useRouter } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";

// Mirrors MobileShell.tsx's NAV array plus /login and /documents — see the
// SW-side PRECACHE_ROUTES list in public/sw.js for the HTML-caching half of
// this. /documents ("My documents") isn't a bottom-nav item — it's reached
// via a link from /courses (Library) — so without listing it explicitly
// here too, a document opened for the first time while offline (having
// never visited /documents itself this session) fails: its own route chunk,
// and the per-document detail route's chunk below, were never fetched.
const PRECACHE_PATHS = [
  "/dashboard",
  "/courses",
  "/documents",
  "/summaries",
  "/assistant",
  "/progress",
  "/profile",
];

// /documents/$docId can't go through PRECACHE_PATHS above — that list
// assumes each entry is a real, literal, fetchable URL (for the SW's
// HTML-caching half), but this route needs a docId no route list can know
// in advance. router.preloadRoute() below only needs to resolve which route
// matches and trigger *that route's* lazy import — it doesn't render the
// component or need the placeholder id to correspond to a real document —
// so a dummy id is enough to warm the chunk cache for every real docId.

/** Proactively warms this session's offline caches for the main nav
 * routes once actually signed in (not at service-worker install time,
 * when most routes would only render a login redirect). Two halves,
 * because a route's own lazy-loaded JS chunk is never listed anywhere in
 * server-rendered HTML — it only exists as a runtime `import()` call the
 * router itself makes — so it can't be discovered by scanning HTML for
 * `<script>`/`<link>` tags the way the route's own document can be:
 *
 * 1. `router.preloadRoute()` — the same real mechanism `<Link
 *    preload="intent">` already uses on hover — actually triggers each
 *    route's `import()`, so its chunk gets fetched for real and the
 *    service worker's existing cache-first static-asset handler picks it
 *    up like any other script fetch.
 * 2. A message to the service worker (see public/sw.js) to separately
 *    fetch+cache each route's own rendered HTML under its exact URL, so
 *    a real offline hard-navigation to that URL hits an exact cache
 *    match instead of falling back to a generic app-shell page.
 *
 * Without both halves, a route not yet visited this session fails to
 * navigate to at all while offline — the shell HTML alone isn't enough if
 * the route's own component chunk was never fetched. Fires once per
 * sign-in, not on every render or navigation. */
export function usePrecacheRoutes(): void {
  const { user } = useAuth();
  const router = useRouter();
  const firedRef = useRef(false);

  useEffect(() => {
    if (!user || firedRef.current) return;
    firedRef.current = true;

    // Sequential, not fired all at once: each preloadRoute call mutates
    // shared router match-store state, and firing several concurrently
    // against routes that were never actually rendered/matched this
    // session hit real internal errors when raced together.
    void (async () => {
      for (const to of PRECACHE_PATHS) {
        try {
          await router.preloadRoute({ to } as Parameters<typeof router.preloadRoute>[0]);
        } catch (err) {
          console.error(`Failed to preload route chunk for ${to}`, err);
        }
      }
      try {
        await router.preloadRoute({
          to: "/documents/$docId",
          params: { docId: "__precache__" },
        } as unknown as Parameters<typeof router.preloadRoute>[0]);
      } catch (err) {
        console.error("Failed to preload route chunk for /documents/$docId", err);
      }
    })();

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready
        .then((registration) => {
          registration.active?.postMessage({ type: "PRECACHE_ROUTES" });
        })
        .catch((err) => console.error("Failed to trigger route HTML precache", err));
    }
  }, [user, router]);
}
