import { useEffect, useState } from "react";
import { canShareFiles } from "@/lib/structured-export";

/** Whether this browser can share a file via the native share sheet — see
 * canShareFiles (structured-export.ts). Starts `false` to match
 * server-rendered output (the server has no `navigator` at all), then
 * resolves after hydration, same reasoning as useOnlineStatus above. A
 * false-then-true flash on mount is an acceptable tradeoff for buttons
 * that offer "Share" instead of "Download" — a spurious "Download" label
 * for one paint on a share-capable device is harmless. */
export function useCanShareFiles(): boolean {
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    setCanShare(canShareFiles());
  }, []);

  return canShare;
}

export function useOnlineStatus(): boolean {
  // Always starts "online" to match server-rendered output — the server has
  // no way to know the client's real connectivity. The real value is synced
  // in the effect below, which only runs after hydration.
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  return isOnline;
}
