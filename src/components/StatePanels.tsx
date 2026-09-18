// eLearn: a small shared vocabulary for the four states every real feature
// needs — Empty, Error, Broken (a full failed page, not just a section),
// and Success — extracted from a pattern that had been copy-pasted with
// small drifts across 20+ route files (library.tsx, courses.moodle.index.tsx,
// admin.*.tsx, the root 404/error boundary, dashboard's offline state...).
// Consolidating it here means every one of those places shares the same
// visual language AND the same tone discipline: calm, specific, never
// blaming the student ("couldn't load" / "try again", never "invalid" or
// "error occurred"), and always naming a real next step — never a dead end.
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { CheckCircle2, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

// `href` is for a genuinely external/hard-reload destination only — for
// any in-app destination, pass `onClick` wired to the router's own
// `navigate()` instead. A raw `<a href="/dashboard">` forces a full
// document reload straight into that route's own loader (the same kind
// of fetch that may have just thrown the error this panel exists to
// recover from), which can strand an offline user right back on this
// same screen — a real bug already found and fixed once in this
// codebase's root error boundary; this type exists partly to stop it
// from creeping back in through a new call site.
type StateAction = {
  label: string;
  onClick?: () => void;
  href?: string;
  icon?: LucideIcon;
  // "deep" (the default) reads as a navigation/neutral action; "gold"
  // reads as the generative/primary one (e.g. "Open reader" after
  // downloading, versus "Back to module"). Only meaningful on the
  // primary action — secondary is always the same quiet outline style.
  tone?: "deep" | "gold";
  // For an action that kicks off real work in place (e.g. "Generate
  // notes") rather than navigating — disables the button and lets the
  // caller swap in a "…ing" label while it runs. Meaningless with `href`.
  disabled?: boolean;
};

function ActionButton({
  action,
  variant,
}: {
  action: StateAction;
  variant: "primary" | "secondary";
}) {
  const ActionIcon = action.icon;
  const className = cn(
    "inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-transform active:scale-[0.97] disabled:opacity-60 disabled:active:scale-100",
    variant === "primary"
      ? action.tone === "gold"
        ? "bg-prestige-gold text-prestige-deep"
        : "bg-prestige-deep text-prestige-cream shadow-lg shadow-prestige-deep/20"
      : "text-prestige-mid ring-1 ring-border/70 hover:bg-secondary",
  );
  const content = (
    <>
      {ActionIcon && <ActionIcon className="h-3.5 w-3.5" strokeWidth={1.75} />}
      {action.label}
    </>
  );
  if (action.href) {
    return (
      <a href={action.href} className={className}>
        {content}
      </a>
    );
  }
  return (
    <button type="button" disabled={action.disabled} onClick={action.onClick} className={className}>
      {content}
    </button>
  );
}

/** A section or page has nothing to show yet — not a failure, just not
 * populated. Always names what would make it non-empty, so it reads as
 * "here's what to do" rather than a dead end. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: StateAction;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "animate-rise mx-auto max-w-[440px] rounded-2xl bg-card p-8 text-center ring-1 ring-border/60",
        className,
      )}
    >
      <Icon className="mx-auto h-8 w-8 text-prestige-gold" strokeWidth={1.5} />
      <p className="mt-4 font-display text-lg text-prestige-deep">{title}</p>
      <p className="mx-auto mt-2 max-w-[38ch] text-sm text-muted-foreground">{description}</p>
      {action && (
        <div className="mt-5">
          <ActionButton action={action} variant="primary" />
        </div>
      )}
    </div>
  );
}

/** A lighter cousin of EmptyState — a single instructional line (chat
 * placeholders shown before any messages exist, or a simple "nothing in
 * this list yet" row) rather than a title+description card. Smaller
 * icon, no title, `children` instead of a fixed `description` prop so
 * callers that need extra content below the line (e.g. a row of source
 * document chips) can add it without fighting the component's shape. */
export function HintPanel({
  icon: Icon,
  className,
  children,
}: {
  icon: LucideIcon;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "animate-rise rounded-2xl bg-card p-8 text-center ring-1 ring-border/60",
        className,
      )}
    >
      <Icon className="mx-auto h-6 w-6 text-prestige-gold" strokeWidth={1.5} />
      <div className="mt-3 text-sm text-muted-foreground">{children}</div>
    </div>
  );
}

/** A short, section-level failure notice — something on an otherwise-fine
 * page couldn't load (grades, feedback inbox, one panel). Never "Error:",
 * never a raw exception message — just what didn't work and what to do. */
export function InlineError({ message, className }: { message: string; className?: string }) {
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-2xl bg-destructive/10 p-4 text-sm text-destructive ring-1 ring-destructive/30",
        className,
      )}
    >
      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
      <p>{message}</p>
    </div>
  );
}

/** A whole page (or a whole screen's worth of content) failed to load or
 * broke unexpectedly — the "broken page" state. Distinct from EmptyState
 * (nothing to blame, nothing broke) and InlineError (one section, rest of
 * the page still works): this is the full-screen recovery moment, so it
 * always centers a real recovery action, never just an apology. */
export function ErrorState({
  icon: Icon = TriangleAlert,
  eyebrow = "Something went wrong",
  title,
  description,
  primaryAction,
  secondaryAction,
  className,
}: {
  icon?: LucideIcon;
  eyebrow?: string;
  title: string;
  description: string;
  primaryAction?: StateAction;
  secondaryAction?: StateAction;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-[60vh] flex-col items-center justify-center px-6 text-center",
        className,
      )}
    >
      <div className="grid h-14 w-14 place-items-center rounded-full bg-prestige-deep/5 text-prestige-mid">
        <Icon className="h-6 w-6" strokeWidth={1.75} />
      </div>
      <p className="eyebrow mt-5">{eyebrow}</p>
      <h1 className="mt-2 font-display text-xl font-medium text-prestige-deep">{title}</h1>
      <p className="mt-2 max-w-[36ch] text-sm text-muted-foreground">{description}</p>
      {(primaryAction || secondaryAction) && (
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {secondaryAction && <ActionButton action={secondaryAction} variant="secondary" />}
          {primaryAction && <ActionButton action={primaryAction} variant="primary" />}
        </div>
      )}
    </div>
  );
}

/** A brief, calm confirmation that something completed — deliberately
 * understated (no confetti, no exclamation marks), matching this app's
 * "respectful, not celebratory" tone elsewhere (see OnboardingTour's own
 * completion screen). */
export function SuccessNote({ message, className }: { message: string; className?: string }) {
  return (
    <p
      className={cn(
        "inline-flex items-center gap-2 rounded-xl bg-card/60 px-4 py-3 text-xs font-medium text-prestige-mid ring-1 ring-border/60",
        className,
      )}
    >
      <CheckCircle2 className="h-3.5 w-3.5 text-prestige-gold" strokeWidth={2} />
      {message}
    </p>
  );
}
