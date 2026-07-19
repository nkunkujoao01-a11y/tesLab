import type { ReadingWidth } from "@/hooks/use-reading-width";

const OPTIONS: { value: ReadingWidth; label: string }[] = [
  { value: "narrow", label: "Narrow" },
  { value: "medium", label: "Medium" },
  { value: "wide", label: "Wide" },
];

type ReadingWidthControlProps = {
  width: ReadingWidth;
  onChange: (width: ReadingWidth) => void;
  className?: string;
};

/** A small segmented control for the reading column's width (see
 * use-reading-width.ts) — shared between the personal-document and
 * catalog-material reading pages, which otherwise duplicate the same
 * `<article>` width styling. */
export function ReadingWidthControl({ width, onChange, className }: ReadingWidthControlProps) {
  return (
    <div
      className={`inline-flex shrink-0 items-center gap-0.5 rounded-lg bg-secondary p-0.5 ${className ?? ""}`}
    >
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          aria-pressed={width === opt.value}
          className={`rounded-md px-2 py-1 text-[10px] font-medium uppercase tracking-wider transition-colors ${
            width === opt.value
              ? "bg-background text-prestige-deep shadow-sm"
              : "text-prestige-mid hover:text-prestige-deep"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
