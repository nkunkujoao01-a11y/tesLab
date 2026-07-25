// Blocks the most common disposable/temporary-inbox email providers at
// signup — a plain client-side domain check, not a paid API or an npm
// dependency (kept deliberately zero-cost, matching this project's free
// Supabase tier). This is a UX deterrent for the normal signup form, not
// a real security boundary — a determined user could still call the
// Supabase REST API directly with a disposable address, since the actual
// enforcement for anything that matters is RLS, not this list. Its job is
// just to stop the common case: someone typing a throwaway address into
// the signup form because a real one wasn't handy.
//
// A comprehensive, centrally-maintained list (e.g. the disposable-email-
// domains npm package) would catch more, but pulls in a dependency that
// needs its own updates; this covers the domains that come up in
// practice, and is easy to extend if a new one shows up.
const DISPOSABLE_EMAIL_DOMAINS = new Set([
  "mailinator.com",
  "guerrillamail.com",
  "guerrillamail.info",
  "guerrillamail.biz",
  "guerrillamail.org",
  "guerrillamail.net",
  "guerrillamail.de",
  "sharklasers.com",
  "10minutemail.com",
  "10minutemail.net",
  "20minutemail.com",
  "tempmail.com",
  "temp-mail.org",
  "temp-mail.io",
  "throwawaymail.com",
  "yopmail.com",
  "yopmail.net",
  "yopmail.fr",
  "trashmail.com",
  "trashmail.net",
  "getnada.com",
  "dispostable.com",
  "maildrop.cc",
  "fakeinbox.com",
  "mintemail.com",
  "mohmal.com",
  "mailnesia.com",
  "mailcatch.com",
  "spamgourmet.com",
  "moakt.com",
  "emailondeck.com",
  "burnermail.io",
  "tempinbox.com",
  "discard.email",
  "discardmail.com",
  "mytemp.email",
  "tempail.com",
  "tempmailo.com",
  "inboxkitten.com",
  "mail-temporaire.fr",
  "einrot.com",
  "fakemailgenerator.com",
  "harakirimail.com",
  "jetable.org",
  "spam4.me",
  "anonbox.net",
  "byom.de",
  "chacuo.net",
  "crazymailing.com",
  "deadaddress.com",
  "e4ward.com",
  "emailfake.com",
]);

/** True when `email`'s domain matches a known disposable/temporary-inbox
 * provider — case-insensitive, subdomain-aware (e.g.
 * "x.mailinator.com" still matches "mailinator.com"). */
export function isDisposableEmail(email: string): boolean {
  const domain = email.trim().toLowerCase().split("@").pop();
  if (!domain) return false;
  return (
    DISPOSABLE_EMAIL_DOMAINS.has(domain) ||
    [...DISPOSABLE_EMAIL_DOMAINS].some((known) => domain.endsWith(`.${known}`))
  );
}
