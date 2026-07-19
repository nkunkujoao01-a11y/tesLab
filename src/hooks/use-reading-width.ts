import { useCallback, useEffect, useState } from "react";
import { liveQuery } from "dexie";
import { deviceDb } from "@/lib/db";

const SETTING_KEY = "reading_width";

export type ReadingWidth = "narrow" | "medium" | "wide";

// The reading column's own max-width per setting — "narrow" is the
// article's original fixed 680px (unchanged default, so nobody's existing
// reading experience shifts unless they deliberately pick something else),
// "wide" removes the cap entirely so the column fills whatever the
// surrounding page layout (MobileShell's own padding) already allows,
// rather than a second, redundant pixel ceiling on top of it.
export const READING_WIDTH_STYLE: Record<ReadingWidth, string> = {
  narrow: "680px",
  medium: "880px",
  wide: "100%",
};

const isReadingWidth = (v: string): v is ReadingWidth =>
  v === "narrow" || v === "medium" || v === "wide";

/** A per-device reading-column-width preference, stored the same
 * liveQuery-backed `appSettings` key/value way as the AI model/chat
 * settings (see use-ai-model.ts) — not per-document, since this is a
 * reading-comfort preference about the person, not the material. */
export function useReadingWidth(): [ReadingWidth, (width: ReadingWidth) => void] {
  const [width, setWidthState] = useState<ReadingWidth>("narrow");

  useEffect(() => {
    const sub = liveQuery(() => deviceDb.appSettings.get(SETTING_KEY)).subscribe({
      next: (row) => {
        if (row && isReadingWidth(row.value)) setWidthState(row.value);
      },
      error: (err) => console.error("Failed to read reading-width setting", err),
    });
    return () => sub.unsubscribe();
  }, []);

  const setWidth = useCallback((next: ReadingWidth) => {
    setWidthState(next);
    deviceDb.appSettings.put({ key: SETTING_KEY, value: next }).catch((err) => {
      console.error("Failed to save reading-width setting", err);
    });
  }, []);

  return [width, setWidth];
}
