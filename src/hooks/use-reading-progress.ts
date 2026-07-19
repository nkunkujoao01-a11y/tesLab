import { useEffect, useRef, useState } from "react";

const PERSIST_DEBOUNCE_MS = 1200;

/** Tracks how far down the page the student has actually scrolled, as a
 * real 0-100 read percentage — this app's honest replacement for the
 * reader's old "Page N of M" counter, which was just a number a button
 * incremented with no real pagination of the content behind it (see
 * DEV_LOG.md). Persists the *furthest* fraction reached, not the current
 * scroll position, so scrolling back up to re-read something never looks
 * like lost progress. Restores that furthest point once real content has
 * rendered (`ready`), so a returning student picks up roughly where they
 * left off instead of always starting at the top. */
export function useReadingProgress(
  ready: boolean,
  initialPct: number,
  onPersist: (pct: number) => void,
): number {
  const [pct, setPct] = useState(initialPct);
  const maxPctRef = useRef(initialPct);
  const restoredRef = useRef(false);
  const persistTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!ready || restoredRef.current || initialPct <= 0) return;
    restoredRef.current = true;
    const id = requestAnimationFrame(() => {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      if (scrollable > 0) {
        window.scrollTo({ top: scrollable * (initialPct / 100) });
      }
    });
    return () => cancelAnimationFrame(id);
  }, [ready, initialPct]);

  useEffect(() => {
    const handleScroll = () => {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      const fraction = scrollable > 0 ? window.scrollY / scrollable : 1;
      const clamped = Math.max(0, Math.min(1, fraction)) * 100;
      if (clamped > maxPctRef.current) {
        maxPctRef.current = clamped;
        setPct(clamped);
        clearTimeout(persistTimer.current);
        persistTimer.current = setTimeout(() => onPersist(maxPctRef.current), PERSIST_DEBOUNCE_MS);
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      clearTimeout(persistTimer.current);
    };
  }, [onPersist]);

  return Math.round(pct);
}
