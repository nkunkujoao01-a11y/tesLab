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
//
// Real bug found from a user report: switching into an "Ask AI" thread
// scoped to a specific material/collection/module (as opposed to the
// general /assistant tab, which IS in PRECACHE_PATHS above) while offline,
// for a thread not yet opened this session, left the page stuck on
// RoutePending forever — these four routes' own chunks were never fetched,
// so the router had nothing to resolve to and never settled. Each needs
// the same placeholder-param treatment as /documents/$docId.
const DYNAMIC_PRECACHE_ROUTES: {
  to: string;
  params: Record<string, string>;
}[] = [
  { to: "/documents/$docId", params: { docId: "__precache__" } },
  { to: "/documents/$docId/chat", params: { docId: "__precache__" } },
  {
    to: "/documents/collections/$collectionId/chat",
    params: { collectionId: "__precache__" },
  },
  {
    to: "/courses/$moduleId/chat/",
    params: { moduleId: "__precache__" },
  },
  {
    to: "/courses/$moduleId/chat/$docId",
    params: { moduleId: "__precache__", docId: "__precache__" },
  },
];

// Real-world data showed this warming work competing directly with the
// current page's own render: firing a dozen `preloadRoute()` calls (each
// fetching + parsing + executing a route's JS chunk, including the ~360KB
// recharts chunk for /progress) the instant `user` becomes truthy in
// __root.tsx routinely landed inside the current page's own critical
// rendering path — worst-case on exactly the slow/metered connections this
// app is built for. Deferred to the browser's idle period (never sooner than
// `window.load`, since `requestIdleCallback` can still fire mid-render on a
// busy page) and skipped outright when the device says it's on a
// constrained connection — this is background warming for *future*
// navigations, not something the current page or its data budget should
// ever pay for.
function isConstrainedConnection(): boolean {
  const connection = (
    navigator as Navigator & {
      connection?: { saveData?: boolean; effectiveType?: string };
    }
  ).connection;
  if (!connection) return false;
  if (connection.saveData) return true;
  return connection.effectiveType === "slow-2g" || connection.effectiveType === "2g";
}

function runWhenIdle(task: () => void): void {
  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(task, { timeout: 5000 });
  } else {
    setTimeout(task, 2000);
  }
}

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
 * sign-in, not on every render or navigation. Skipped entirely on a
 * save-data/2G connection — those users are exactly who this app's own
 * "70% data savings" goal is for; spending their data on routes they may
 * never visit this session isn't a trade this app should make for them. */
export function usePrecacheRoutes(): void {
  const { user } = useAuth();
  const router = useRouter();
  const firedRef = useRef(false);

  useEffect(() => {
    if (!user || firedRef.current) return;
    firedRef.current = true;

    if (isConstrainedConnection()) return;

    runWhenIdle(() => {
      // Sequential, not fired all at once: each preloadRoute call mutates
      // shared router match-store state, and firing several concurrently
      // against routes that were never actually rendered/matched this
      // session hit real internal errors when raced together. Each step
      // is its own idle callback so this never monopolizes a single main
      // -thread turn even once it starts.
      void (async () => {
        for (const to of PRECACHE_PATHS) {
          await new Promise<void>((resolve) =>
            runWhenIdle(() => {
              router
                .preloadRoute({ to } as Parameters<typeof router.preloadRoute>[0])
                .catch((err) => console.error(`Failed to preload route chunk for ${to}`, err))
                .finally(resolve);
            }),
          );
        }
        for (const { to, params } of DYNAMIC_PRECACHE_ROUTES) {
          await new Promise<void>((resolve) =>
            runWhenIdle(() => {
              router
                .preloadRoute({
                  to,
                  params,
                } as unknown as Parameters<typeof router.preloadRoute>[0])
                .catch((err) => console.error(`Failed to preload route chunk for ${to}`, err))
                .finally(resolve);
            }),
          );
        }
      })();

      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.ready
          .then((registration) => {
            registration.active?.postMessage({ type: "PRECACHE_ROUTES" });
          })
          .catch((err) => console.error("Failed to trigger route HTML precache", err));
      }
    });
  }, [user, router]);
}
