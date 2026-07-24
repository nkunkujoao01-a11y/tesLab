import { useEffect, useRef } from "react";

// How close to the true bottom (in pixels) still counts as "pinned" —
// generous enough that the smooth-scroll animation's own tail end (which
// briefly leaves a few px of slack) doesn't itself read as "the user
// scrolled away."
const PINNED_THRESHOLD_PX = 120;

/** Auto-scrolls a chat-style message list to its bottom sentinel whenever
 * `deps` changes (new message, new streamed token) — but only while the
 * user is already at/near the bottom. Real user report: every streamed
 * token used to force a fresh scroll-to-bottom unconditionally, which
 * fought a student's own attempt to scroll up and re-read an earlier part
 * of a still-streaming response — the page kept yanking them back down
 * mid-read. Scrolling up now genuinely un-pins it; `jumpToBottom` (call
 * from a "send" action) re-pins explicitly, since sending a new message is
 * a clear signal the student wants to see what comes back regardless of
 * where they'd scrolled to read older history. This app has no dedicated
 * scrollable container for its message lists (see MobileShell) — every
 * page scrolls at the window level, so pinned-ness is measured against
 * `window.scrollY`, not a container's own scrollTop. */
export function useStickToBottom(deps: unknown[]): {
  sentinelRef: React.RefObject<HTMLDivElement | null>;
  jumpToBottom: () => void;
} {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef(true);

  useEffect(() => {
    const handleScroll = () => {
      const distanceFromBottom =
        document.documentElement.scrollHeight - window.scrollY - window.innerHeight;
      pinnedRef.current = distanceFromBottom < PINNED_THRESHOLD_PX;
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (pinnedRef.current) {
      sentinelRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const jumpToBottom = () => {
    pinnedRef.current = true;
    sentinelRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  };

  return { sentinelRef, jumpToBottom };
}
