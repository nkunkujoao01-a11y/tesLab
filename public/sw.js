const CACHE_NAME = "elearn-shell-v2";
// .wasm covers the self-hosted OCR engine under public/tesseract/ (see
// pdf-ocr.ts) — cache-first here is what lets a scanned-PDF upload actually
// OCR while offline after the first successful run, not just born-digital
// PDFs. .mjs covers pdfjs-dist's own worker script (pdf-extract.ts imports
// it as an ES module worker) — without it here, that fetch was never
// cache-first, so it worked once online but had nothing to fall back to
// when a second, different PDF spawned a new worker while offline.
const STATIC_ASSET_PATTERN = /\.(?:m?js|css|woff2?|ttf|png|jpg|jpeg|svg|ico|wasm)$/;
// Main nav destinations (see MobileShell.tsx's NAV array) plus /login —
// precached once signed in (see the "message" handler below) so navigating
// to a page never opened this session still works offline. Without this,
// each route's own code-split JS chunk is only ever cached lazily, the
// first time it's actually fetched — offline before that first fetch means
// the chunk genuinely isn't there yet, and navigation fails at the
// module-load level even though the shell HTML itself is cached.
const PRECACHE_ROUTES = [
  "/login",
  "/dashboard",
  "/courses",
  "/summaries",
  "/assistant",
  "/progress",
  "/profile",
];
// Matches a script/link tag's src="…"/href="…" attribute value ending in
// .js or .css — real asset URLs discovered from a route's own rendered
// HTML, not guessed from a build manifest (this project's Nitro/Cloudflare
// build output isn't reliably introspectable from inside the SW itself).
const ASSET_TAG_PATTERN = /(?:src|href)="([^"]+\.(?:js|css))"/g;
// Synthetic cache key (not a real route) holding the most recently seen
// navigation response. This is a client-routed SPA: visiting /courses/x via
// an in-app <Link> never issues a real "navigate" fetch for that URL — only
// a hard load/reload of a route does — so almost no route ever ends up
// cached under its own URL. Without this fallback, going offline and
// reloading (or reopening the app on) any page other than the one exact URL
// last hard-loaded fails outright, even though the same cached JS bundle is
// perfectly able to boot and let the client router render the real URL.
const SHELL_CACHE_KEY = "/__app-shell__";

self.addEventListener("install", (event) => {
  // A same-session user who only ever clicks in-app links (the normal case)
  // never triggers a second real "navigate" fetch for the fetch handler
  // below to opportunistically cache a shell from — so the very first
  // install proactively fetches one itself. /login always renders valid
  // shell HTML regardless of auth state, unlike /dashboard which needs a
  // session. Best-effort: if this fetch fails (e.g. installing while
  // offline is somehow possible), the fetch handler's own cache.put on the
  // next successful navigation still covers it — this is a head start, not
  // the only path to a cached shell.
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        fetch("/login")
          .then((response) => (response.ok ? cache.put(SHELL_CACHE_KEY, response) : undefined))
          .catch(() => {}),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) {
    return;
  }

  // Static build assets (JS/CSS/fonts/images): cache-first, network fallback.
  if (STATIC_ASSET_PATTERN.test(new URL(request.url).pathname)) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        // Offline and never cached (e.g. a route's own JS chunk that
        // wasn't precached — see the "message" handler below): fail in a
        // well-defined way instead of an unhandled rejection propagating
        // out of respondWith, matching the navigate handler's own
        // try/catch shape below rather than leaving this one branch as
        // the only unguarded fetch in the file.
        try {
          const response = await fetch(request);
          if (response.ok) cache.put(request, response.clone());
          return response;
        } catch {
          // A real opaque network-error Response, not a fabricated "ok"
          // one with an error status — this is what a module loader or
          // <img>/<link> already expects a failed fetch to look like, so
          // it fails the same well-understood way an unhandled rejection
          // would have, just without an actual unhandled rejection.
          return Response.error();
        }
      }),
    );
    return;
  }

  // Page navigations: network-first, falling back to the last cached copy of
  // that exact URL when offline, then to the app shell (see SHELL_CACHE_KEY)
  // so any route can still boot and render offline, not just the one URL
  // that happened to be hard-loaded most recently.
  if (request.mode === "navigate") {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        try {
          const response = await fetch(request);
          if (response.ok) {
            cache.put(request, response.clone());
            cache.put(SHELL_CACHE_KEY, response.clone());
          }
          return response;
        } catch {
          const cached = await cache.match(request);
          if (cached) return cached;
          const shell = await cache.match(SHELL_CACHE_KEY);
          if (shell) return shell;
          throw new Error("offline and no cached copy of this page");
        }
      }),
    );
  }
});

// Triggered once from the client after a real sign-in (see __root.tsx) —
// not from "install", which commonly runs on a brand-new visitor's very
// first, signed-out load, where every route but /login would just cache a
// login-redirect instead of real content. Fetches each main route's own
// rendered HTML (real content, not a guess) and caches every script/style
// asset it references, so opening one of these pages for the first time
// this session still works if you go offline before ever clicking into it
// yourself.
self.addEventListener("message", (event) => {
  if (event.data?.type !== "PRECACHE_ROUTES") return;
  event.waitUntil(precacheRoutes());
});

async function precacheRoutes() {
  const cache = await caches.open(CACHE_NAME);
  await Promise.all(
    PRECACHE_ROUTES.map(async (route) => {
      try {
        const response = await fetch(route, { credentials: "include" });
        if (!response.ok) return;
        const html = await response.clone().text();
        await cache.put(route, response);

        const assetUrls = new Set();
        for (const match of html.matchAll(ASSET_TAG_PATTERN)) {
          assetUrls.add(new URL(match[1], self.location.origin).toString());
        }
        await Promise.all(
          [...assetUrls].map(async (url) => {
            try {
              if (await cache.match(url)) return;
              const assetResponse = await fetch(url);
              if (assetResponse.ok) await cache.put(url, assetResponse);
            } catch {
              // One asset failing shouldn't stop the rest of this route's
              // assets, or the other routes, from precaching.
            }
          }),
        );
      } catch {
        // Same reasoning — one route failing (e.g. a transient network
        // blip) shouldn't abort precaching the remaining routes.
      }
    }),
  );
}
