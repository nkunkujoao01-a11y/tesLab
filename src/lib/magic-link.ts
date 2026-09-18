// eLearn: magic-link (passwordless) sign-in for an existing eLearn
// account. Client-side entry point — see magic-link-server.ts for the
// rate-limit gate this calls before ever hitting Supabase's own OTP
// endpoint.
import { supabase } from "@/lib/supabase";
import { checkMagicLinkRateLimit } from "@/lib/magic-link-server";

export type SendMagicLinkResult =
  { ok: true } | { ok: false; reason: "rate_limited" | "unexpected" };

/** Existing accounts only (`shouldCreateUser: false`) — this is
 * deliberately never a backdoor signup path; typing an arbitrary email
 * here can never provision a new account, only the real /signup flow can.
 * That also narrows the "annoy someone with emails" surface from the
 * rate limit above: an email with no real account gets no email sent at
 * all (Supabase itself refuses with a "signups not allowed" error rather
 * than sending anything) — masked as a plain success below rather than
 * surfaced, so this can never be used to probe which emails have an
 * eLearn account, same no-account-enumeration reasoning
 * forgot-password.tsx already documents for resetPasswordForEmail. */
export async function sendMagicLink(email: string): Promise<SendMagicLinkResult> {
  const normalized = email.trim();

  const rateLimit = await checkMagicLinkRateLimit({ data: { email: normalized } });
  if (!rateLimit.allowed) return { ok: false, reason: "rate_limited" };

  const { error } = await supabase.auth.signInWithOtp({
    email: normalized,
    options: {
      shouldCreateUser: false,
      // Same redirect target Google sign-in already uses — the
      // Supabase-side redirect allow-list is already satisfied by that
      // existing flow, nothing new to configure there.
      emailRedirectTo: `${window.location.origin}/dashboard`,
    },
  });
  if (!error) return { ok: true };

  if (/signup|not allowed/i.test(error.message)) {
    return { ok: true };
  }
  console.error("Failed to send magic link", error);
  return { ok: false, reason: "unexpected" };
}
