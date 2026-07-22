import { useCallback, useState } from "react";

// Real, reported bug: after a new deploy, some users saw the app render as
// bare unstyled HTML (missing CSS/JS) until they manually cleared their
// browser's cache — see public/sw.js's CACHE_NAME comment for the root
// cause (a stale cached shell referencing a previous build's now-deleted
// hashed asset filenames, which only self-heals once the browser notices
// the service worker itself changed — not instant on every deploy). This
// is the self-service version of "clear the cache," done from inside the
// app instead of the browser's own settings, which most users won't know
// how to find.
//
// Deletes Cache Storage directly from the page (available here, not just
// inside the SW) and unregisters every service worker registration, so the
// next load is guaranteed to re-fetch everything and re-install a clean
// worker — more thorough than posting a message to the current worker and
// hoping it's still responsive enough to handle it.
export function useClearCache() {
  const [clearing, setClearing] = useState(false);

  const clearCacheAndReload = useCallback(async () => {
    setClearing(true);
    try {
      if (typeof caches !== "undefined") {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      }
      if ("serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.unregister()));
      }
    } catch (err) {
      console.error("Failed to clear cache", err);
    } finally {
      // Reload either way — even a partial clear (e.g. one cache failing
      // to delete) is worth reloading for, and this is the one step that
      // actually re-fetches everything fresh regardless of what state the
      // cache/SW cleanup above landed in.
      window.location.reload();
    }
  }, []);

  return { clearCacheAndReload, clearing };
}
