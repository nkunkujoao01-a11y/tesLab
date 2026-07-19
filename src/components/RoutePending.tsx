import { Loader2 } from "lucide-react";

/** Shown while a route's loader is in flight (see router.tsx's
 * defaultPendingComponent) — every real route loader in this app fetches
 * from Supabase, so without this the previous screen just sits frozen with
 * no feedback on a slow or dropped connection. */
export function RoutePending() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background">
      <Loader2 className="h-6 w-6 animate-spin text-prestige-mid" strokeWidth={1.75} />
      <p className="text-xs font-medium uppercase tracking-widest text-prestige-mid">
        Loading&hellip;
      </p>
    </div>
  );
}
