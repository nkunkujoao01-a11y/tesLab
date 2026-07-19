import { useEffect, useState } from "react";

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
