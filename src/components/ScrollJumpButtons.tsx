import { ChevronUp, ChevronDown } from "lucide-react";

/** Two small floating buttons that jump to the very top/bottom of the
 * current page instantly (well, smoothly) — both readers use plain
 * window-level scrolling (see use-reading-progress.ts), so no scroll
 * container ref is needed here, just window.scrollTo. `bottomClassName`
 * lets each page clear its own fixed floating action bar, which sits at
 * a different height on each reader. */
export function ScrollJumpButtons({ bottomClassName }: { bottomClassName: string }) {
  const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });
  const scrollToBottom = () =>
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });

  return (
    <div className={`fixed right-4 z-30 flex flex-col gap-2 ${bottomClassName}`}>
      <button
        type="button"
        onClick={scrollToTop}
        aria-label="Jump to top"
        className="grid h-9 w-9 place-items-center rounded-full bg-prestige-deep/90 text-prestige-cream shadow-lg backdrop-blur-md transition-transform active:scale-90"
      >
        <ChevronUp className="h-4 w-4" strokeWidth={2} />
      </button>
      <button
        type="button"
        onClick={scrollToBottom}
        aria-label="Jump to bottom"
        className="grid h-9 w-9 place-items-center rounded-full bg-prestige-deep/90 text-prestige-cream shadow-lg backdrop-blur-md transition-transform active:scale-90"
      >
        <ChevronDown className="h-4 w-4" strokeWidth={2} />
      </button>
    </div>
  );
}
