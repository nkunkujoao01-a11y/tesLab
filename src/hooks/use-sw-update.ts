import { useEffect } from "react";
import { toast } from "sonner";

// public/sw.js calls self.skipWaiting() unconditionally on install and
// self.clients.claim() on activate (see its own top comment on why —
// a real "stale shell after deploy" bug) — a new service worker version
// takes over automatically, no "waiting" state to prompt through. But the
// *page* already open in the browser still has the old JS bundle loaded
// in memory; taking over service-worker control doesn't retroactively
// update that. `controllerchange` fires exactly once a new worker has
// actually taken control of this page, which — given the auto-claim
// strategy above — only ever happens on a genuine version change, not on
// the first-ever registration (there's no prior controller to change
// from then). A manual reload button rather than an automatic reload:
// forcing a reload mid-quiz-generation or mid-typing would be worse than
// a stale bundle for a few more minutes.
export function useServiceWorkerUpdateNotice(): void {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let reloaded = false;
    const handleControllerChange = () => {
      if (reloaded) return;
      toast.message("A new version of eLearn is available", {
        duration: Infinity,
        action: {
          label: "Reload",
          onClick: () => {
            reloaded = true;
            window.location.reload();
          },
        },
      });
    };
    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);
    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
    };
  }, []);
}
