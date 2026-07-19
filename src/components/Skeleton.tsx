import { cn } from "@/lib/utils";

/** A single pulsing placeholder block — pure CSS (Tailwind's built-in
 * `animate-pulse`), no JS animation loop and no network request, matching
 * Phase K's "must be pure CSS/markup, zero extra network requests" brief
 * so a shaped placeholder never costs more than the spinner it replaces. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-prestige-deep/10", className)} />;
}

/** Shaped like the real shell it stands in for (top bar, stat tiles, a
 * card) rather than a generic centered spinner — used while MobileShell
 * is still resolving auth state, the one loading moment nearly every
 * screen in the app passes through. */
export function ShellSkeleton() {
  return (
    <div className="min-h-screen bg-background px-6 pt-10 lg:px-10 lg:pt-14">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-2.5 w-28" />
          <Skeleton className="h-6 w-40" />
        </div>
        <Skeleton className="h-12 w-12 shrink-0 rounded-full" />
      </div>
      <div className="mt-8 grid grid-cols-3 gap-3">
        <Skeleton className="h-20 rounded-2xl" />
        <Skeleton className="h-20 rounded-2xl" />
        <Skeleton className="h-20 rounded-2xl" />
      </div>
      <Skeleton className="mt-6 h-40 rounded-2xl" />
      <Skeleton className="mt-4 h-20 rounded-2xl" />
      <Skeleton className="mt-3 h-20 rounded-2xl" />
    </div>
  );
}
