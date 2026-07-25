// Supports the NUST ethics-approved usability study this app is part of
// (researcher Joao Ndongala Nkunku, supervisor Dr Tendai Mataranyika) — a
// consent record, then a post-task System Usability Scale/TAM-UTAUT/
// data-efficiency questionnaire. See 0025_research_study.sql for the
// original anonymous-only design, and 0042_research_optional_identity.sql
// for why a signed-in respondent is now identified (real name) by
// default, with anonymity kept as an explicit opt-out.
import { supabase, type ResearchSurveyAnswers } from "@/lib/supabase";
import { deviceDb } from "@/lib/db";

const ANONYMOUS_ID_KEY = "research_anonymous_id";
// The consent-time anonymity choice, remembered so the *survey* submitted
// later doesn't need to ask again — one choice governs both submissions,
// matching how the consent gate and the survey are presented as one flow,
// not two independent decisions.
const STAY_ANONYMOUS_KEY = "research_stay_anonymous";

/** A random, non-identifying id (e.g. "User_4821") — generated once and
 * persisted device-wide (not per-account: the consent text's own promise
 * is "no personal information that can identify you," and tying this to
 * a specific signed-in account would itself be an identifying link this
 * study doesn't need). Two different real students sharing one browser
 * would share one anonymous id — an accepted, minor tradeoff for a
 * low-stakes usability study, not something worth a heavier per-account
 * scheme that would undercut the anonymity this exists for in the first
 * place. */
export async function getAnonymousId(): Promise<string> {
  const existing = await deviceDb.appSettings.get(ANONYMOUS_ID_KEY);
  if (existing) return existing.value;
  const id = `User_${Math.floor(1000 + Math.random() * 9000)}`;
  await deviceDb.appSettings.put({ key: ANONYMOUS_ID_KEY, value: id });
  return id;
}

/** Resolves the real identity to attach to a submission — `null`/`null`
 * whenever the student chose to stay anonymous, matching this study's
 * still-honored anonymous option. `full_name` is read from `profiles` at
 * submission time (a snapshot, not a live join) so a later profile-name
 * change never retroactively rewrites what a past research record says a
 * respondent's name was. */
async function resolveIdentity(
  stayAnonymous: boolean,
): Promise<{ userId: string | null; fullName: string | null }> {
  if (stayAnonymous) return { userId: null, fullName: null };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { userId: null, fullName: null };
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();
  return { userId: user.id, fullName: profile?.full_name ?? null };
}

export async function submitResearchConsent(
  agreed: boolean,
  stayAnonymous: boolean,
): Promise<void> {
  await deviceDb.appSettings.put({
    key: STAY_ANONYMOUS_KEY,
    value: stayAnonymous ? "true" : "false",
  });
  const anonymousId = await getAnonymousId();
  const { userId, fullName } = await resolveIdentity(stayAnonymous);
  const { error } = await supabase.from("research_consent").insert({
    id: crypto.randomUUID(),
    anonymous_id: anonymousId,
    agreed,
    responded_at: new Date().toISOString(),
    user_id: userId,
    full_name: fullName,
  });
  if (error) throw error;
}

export async function submitResearchSurvey(answers: ResearchSurveyAnswers): Promise<void> {
  const anonymousId = await getAnonymousId();
  // Reuses the same choice made at consent time (above) — the survey
  // never asks again, it's presented as one flow, not two independent
  // decisions.
  const stored = await deviceDb.appSettings.get(STAY_ANONYMOUS_KEY);
  const stayAnonymous = stored?.value === "true";
  const { userId, fullName } = await resolveIdentity(stayAnonymous);
  const { error } = await supabase.from("research_survey_responses").insert({
    id: crypto.randomUUID(),
    anonymous_id: anonymousId,
    answers,
    submitted_at: new Date().toISOString(),
    user_id: userId,
    full_name: fullName,
  });
  if (error) throw error;
}

/** A general, always-available anonymous suggestion — separate from the
 * one-time research study above and from the account-tied feedback
 * feature (use-feedback.ts). Reuses the same device anonymous id rather
 * than a second identity scheme — see 0039_anonymous_suggestions.sql.
 * `imagePaths` (already-uploaded — see use-research-study.ts, which
 * uploads to the anonymous-suggestion-images bucket keyed by this
 * submission's own id, never the student's) defaults to none; a plain
 * text-only suggestion is still the common case. */
export async function submitAnonymousSuggestion(
  message: string,
  imagePaths: string[] = [],
): Promise<void> {
  const anonymousId = await getAnonymousId();
  const { error } = await supabase.from("anonymous_suggestions").insert({
    id: crypto.randomUUID(),
    anonymous_id: anonymousId,
    message: message.trim(),
    image_paths: imagePaths,
    submitted_at: new Date().toISOString(),
  });
  if (error) throw error;
}
