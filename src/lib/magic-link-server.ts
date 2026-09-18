// eLearn: server-side rate limiting for magic-link sign-in requests.
//
// supabase.auth.signInWithOtp({ email }) itself is designed to be called
// directly from the browser with the anon key — no elevated privilege
// needed for the actual email send (see magic-link.ts). This file exists
// only to gate that call with our own DB-backed rate limit (see
// 0045_magic_link_rate_limit.sql) *before* the browser is allowed to make
// it — same reasoning/shape as moodle-server.ts's checkAndRecordLoginAttempt.
import { createServerFn } from "@tanstack/react-start";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Typed locally rather than added to supabase.ts's shared Database type —
// same reasoning as moodle-server.ts's identical comment: this table is
// only ever touched from this one helper, via a service-role client.
type MagicLinkAttemptsTable = {
  magic_link_attempts: {
    Row: { id: string; email: string; created_at: string };
    Insert: { email: string };
    Update: never;
    Relationships: [];
  };
};

const WINDOW_MINUTES = 15;
const MAX_ATTEMPTS = 3;
const PRUNE_HOURS = 1;

export type MagicLinkRateLimitResult = { allowed: boolean };

/** DB-backed rate limit — this createServerFn handler is stateless across
 * serverless invocations, so an in-memory counter wouldn't actually limit
 * anything under real (multi-instance) load. Keyed by the target email:
 * the concrete risk this closes is someone spamming sign-in-link emails
 * at one known account just to annoy them. It does not stop a distributed
 * attacker spreading requests across many different target emails — same
 * known, documented limitation as checkAndRecordLoginAttempt
 * (moodle-server.ts); IP-based limiting at the edge would be needed for
 * that, a separate, larger change. */
export const checkMagicLinkRateLimit = createServerFn({ method: "POST" })
  .validator((data: { email: string }) => data)
  .handler(async ({ data }): Promise<MagicLinkRateLimitResult> => {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceRoleKey) {
      console.error(
        "Missing VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY for magic-link rate limit",
      );
      // Fail open rather than blocking every sign-in over missing config —
      // same degrade-gracefully discipline as moodle-server.ts.
      return { allowed: true };
    }
    const admin = createClient(url, serviceRoleKey) as unknown as SupabaseClient<{
      public: {
        Tables: MagicLinkAttemptsTable;
        Views: Record<string, never>;
        Functions: Record<string, never>;
      };
    }>;

    const normalized = data.email.trim().toLowerCase();
    const pruneBefore = new Date(Date.now() - PRUNE_HOURS * 60 * 60 * 1000).toISOString();
    await admin.from("magic_link_attempts").delete().lt("created_at", pruneBefore);

    const windowStart = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString();
    const { count, error } = await admin
      .from("magic_link_attempts")
      .select("id", { count: "exact", head: true })
      .eq("email", normalized)
      .gte("created_at", windowStart);
    if (error) {
      console.error("Failed to check magic-link attempt count", error);
      return { allowed: true }; // fail open — same reasoning as the missing-config case above
    }
    if ((count ?? 0) >= MAX_ATTEMPTS) {
      return { allowed: false };
    }
    await admin.from("magic_link_attempts").insert({ email: normalized });
    return { allowed: true };
  });
