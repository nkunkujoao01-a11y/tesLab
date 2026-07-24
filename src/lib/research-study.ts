// Supports the NUST ethics-approved usability study this app is part of
// (researcher Joao Ndongala Nkunku, supervisor Dr Tendai Mataranyika) — a
// consent record, then a post-task System Usability Scale/TAM-UTAUT/
// data-efficiency questionnaire. See 0025_research_study.sql for the full
// reasoning on why neither submitted row carries any real identity.
import { supabase, type ResearchSurveyAnswers } from "@/lib/supabase";
import { deviceDb } from "@/lib/db";

const ANONYMOUS_ID_KEY = "research_anonymous_id";

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

export async function submitResearchConsent(agreed: boolean): Promise<void> {
  const anonymousId = await getAnonymousId();
  const { error } = await supabase.from("research_consent").insert({
    id: crypto.randomUUID(),
    anonymous_id: anonymousId,
    agreed,
    responded_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function submitResearchSurvey(answers: ResearchSurveyAnswers): Promise<void> {
  const anonymousId = await getAnonymousId();
  const { error } = await supabase.from("research_survey_responses").insert({
    id: crypto.randomUUID(),
    anonymous_id: anonymousId,
    answers,
    submitted_at: new Date().toISOString(),
  });
  if (error) throw error;
}

/** A general, always-available anonymous suggestion — separate from the
 * one-time research study above and from the account-tied feedback
 * feature (use-feedback.ts). Reuses the same device anonymous id rather
 * than a second identity scheme — see 0039_anonymous_suggestions.sql. */
export async function submitAnonymousSuggestion(message: string): Promise<void> {
  const anonymousId = await getAnonymousId();
  const { error } = await supabase.from("anonymous_suggestions").insert({
    id: crypto.randomUUID(),
    anonymous_id: anonymousId,
    message: message.trim(),
    submitted_at: new Date().toISOString(),
  });
  if (error) throw error;
}
