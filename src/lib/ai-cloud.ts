// Cloud AI generation via a student's own free Gemini API key (BYOK) — see
// DEV_LOG.md and supabase/migrations/0014_ai_provider_keys.sql. A single
// shared backend key can't stay free at real scale (free-tier quotas are
// per-key, roughly 250-1500 requests/day depending on model, not per
// student) — BYOK scales for free because each student's own free-tier
// quota belongs to them alone.
//
// This is an optional enhancement layer, not a replacement for the
// on-device path: every call site (use-quiz.ts, summarize-structured.ts)
// tries this first and falls back to the existing on-device generation on
// any failure. Offline, cloud AI turned off in settings, no key saved,
// today's client-side rate limit reached, an invalid/rate-limited key from
// Google's own side, and a genuine network error all surface as the same
// CloudUnavailableError, so callers don't need to distinguish *why* the
// cloud path didn't work, only that it didn't — same "degrade gracefully"
// discipline the on-device path already follows for its own failures.
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { deviceDb, getUserDb } from "@/lib/db";

// Typed locally rather than added to supabase.ts's shared Database type —
// see that file's own comment on Functions for why: populating the shared
// type with these broke unrelated embedded-relationship `.select()` type
// inference elsewhere in the app. Casting just for this module's own RPC
// calls gets the same real argument/return typing without that side
// effect — safe because it's a compile-time-only view over the same
// runtime client, not a second client instance.
type AiCloudFunctions = {
  save_ai_provider_key: { Args: { p_provider: string; p_key: string }; Returns: void };
  get_ai_provider_key: { Args: { p_provider: string }; Returns: string | null };
  has_ai_provider_key: { Args: { p_provider: string }; Returns: boolean };
  clear_ai_provider_key: { Args: { p_provider: string }; Returns: void };
};
const rpc = supabase as unknown as SupabaseClient<{
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: AiCloudFunctions;
  };
}>;

export class CloudUnavailableError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "CloudUnavailableError";
  }
}

const PROVIDER = "gemini";
// Gemini's current free-tier flash model — see the provider comparison in
// DEV_LOG.md for why Gemini specifically (best free per-key daily quota of
// the providers checked, and BYOK is exactly the shape its free tier is
// designed around). Pinned model names get sunset (gemini-2.5-flash 404s as
// of 2026-07 with "no longer available to new users") — the "-latest" alias
// tracks Google's current recommended flash model instead of needing a code
// change every time that happens.
const GEMINI_MODEL = "gemini-flash-latest";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// undefined = not yet fetched this session; null = fetched, nothing saved.
// Decrypted once per session and kept in memory only, never written to
// localStorage/IndexedDB — a real page reload pays one extra round trip to
// re-fetch it, an acceptable cost for keeping the plaintext key out of any
// persisted client-side storage.
let cachedKey: string | null | undefined;

// Device-local, same key useCloudAiEnabled() (use-cloud-ai.ts) reads/writes
// via liveQuery — a plain preference about whether to *try* the cloud path
// at all, same category as reading width or chat model choice, not account
// data. Missing row = enabled (matches this feature's original unconditional
// "connected == used automatically" behavior, so existing connected users
// see no change until they deliberately turn it off).
export const CLOUD_AI_ENABLED_KEY = "cloud_ai_enabled";

async function isCloudAiEnabled(): Promise<boolean> {
  const row = await deviceDb.appSettings.get(CLOUD_AI_ENABLED_KEY);
  return row?.value !== "false";
}

// A conservative client-side cap, well under Google's free-tier ~250-1500
// requests/day per key — this isn't standing in for that quota (a real 429
// from Google still surfaces as the existing "Gemini request failed: 429"
// case below), it exists so one runaway regenerate loop or a burst of
// students sharing a device can't silently burn a day's quota before anyone
// notices. Generous enough that a student generating several quizzes/
// flashcards/summaries a day never feels it.
export const CLOUD_AI_DAILY_LIMIT = 50;

const todayKey = () => `cloud_ai_calls_${new Date().toISOString().slice(0, 10)}`;

/** Today's call count for this user, read-only — used by the settings
 * screen to show "X of N used today" so the limit is legible rather than a
 * silent, mysterious fallback to on-device. */
export async function getCloudAiUsageToday(userId: string): Promise<number> {
  const row = await getUserDb(userId).syncMeta.get(todayKey());
  return row ? Number(row.value) || 0 : 0;
}

/** Increments and enforces the daily cap atomically-enough for a client-
 * side soft limit (single-tab read-then-write, not real concurrency
 * control) — returns false without incrementing once the cap is reached. */
async function consumeCloudAiQuota(userId: string): Promise<boolean> {
  const db = getUserDb(userId);
  const key = todayKey();
  const row = await db.syncMeta.get(key);
  const used = row ? Number(row.value) || 0 : 0;
  if (used >= CLOUD_AI_DAILY_LIMIT) return false;
  await db.syncMeta.put({ key, value: String(used + 1) });
  return true;
}

/** Whether a cloud key is saved for the current user, without decrypting
 * it — this is only ever used to decide *whether* to attempt the cloud
 * path (e.g. showing the AI-notes tab, or the "connected" state in AI
 * settings), not to make the actual generation call. */
export async function hasCloudKey(): Promise<boolean> {
  const { data, error } = await rpc.rpc("has_ai_provider_key", { p_provider: PROVIDER });
  if (error) {
    console.error("Failed to check for a saved cloud AI key", error);
    return false;
  }
  return Boolean(data);
}

export async function saveCloudKey(key: string): Promise<void> {
  const { error } = await rpc.rpc("save_ai_provider_key", {
    p_provider: PROVIDER,
    p_key: key,
  });
  if (error) throw error;
  cachedKey = key;
}

export async function clearCloudKey(): Promise<void> {
  const { error } = await rpc.rpc("clear_ai_provider_key", { p_provider: PROVIDER });
  if (error) throw error;
  cachedKey = null;
}

async function getDecryptedKey(): Promise<string | null> {
  if (cachedKey !== undefined) return cachedKey;
  const { data, error } = await rpc.rpc("get_ai_provider_key", { p_provider: PROVIDER });
  if (error) {
    console.error("Failed to retrieve the saved cloud AI key", error);
    cachedKey = null;
    return null;
  }
  cachedKey = data ?? null;
  return cachedKey;
}

export type CloudGenerationKind = "quiz" | "flashcards" | "notes" | "summary";

const PROMPTS: Record<CloudGenerationKind, (sourceText: string) => string> = {
  quiz: (sourceText) =>
    `Write 3 multiple-choice questions testing understanding of the study notes below. ` +
    `Respond with ONLY a JSON array, no other text, matching this shape exactly: ` +
    `[{"question": string, "options": [string, string, string, string], "correctIndex": number}]. ` +
    `Study notes:\n${sourceText}`,
  flashcards: (sourceText) =>
    `Write up to 10 flashcards (front/back pairs) covering the key concepts in the study notes below. ` +
    `Respond with ONLY a JSON array, no other text, matching this shape exactly: ` +
    `[{"front": string, "back": string}]. ` +
    `Study notes:\n${sourceText}`,
  notes: (sourceText) =>
    `Write clear, well-organized study notes summarizing the material below, as short paragraphs ` +
    `and bullet points a student could revise from. Respond with ONLY the notes text, no preamble, ` +
    `using EXACTLY this lightweight format and nothing else: a line starting with "# " for a top-level ` +
    `heading, "## " for a sub-heading, "- " for a bullet point, plain lines for body paragraphs, and a ` +
    `blank line between every block. Do not use any other markdown syntax (no **bold**, no numbered ` +
    `lists, no backticks). Source material:\n${sourceText}`,
  summary: (sourceText) =>
    `Write a concise, accurate summary (3-5 sentences) of the material below. Respond with ONLY ` +
    `the summary text, no preamble. Source material:\n${sourceText}`,
};

/** Calls Gemini directly from the browser using the signed-in student's own
 * key — safe specifically because it's BYOK: this never touches a shared
 * secret, only the one key that belongs to whoever is making the call, in
 * their own browser. Throws CloudUnavailableError (never a raw fetch/HTTP
 * error) for every case a caller should react to the same way: fall back
 * to the existing on-device path — offline, the user turned cloud AI off
 * in settings, no key saved, today's rate limit reached, or a genuine
 * network/API failure. Takes an already-built prompt rather than a `kind`
 * — see generateViaCloud below for the common case using this app's own
 * standard prompts; a caller needing a different response shape
 * (summarize-structured.ts's structured JSON, for one) builds its own
 * prompt and calls this directly instead of stretching the shared
 * CloudGenerationKind enum to cover a shape only it needs. `userId` scopes
 * the daily rate-limit counter to the account whose key/quota it actually
 * is (see consumeCloudAiQuota) — every caller already has this from
 * useAuth() at the point it calls in. */
export async function callGeminiWithPrompt(prompt: string, userId: string): Promise<string> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    throw new CloudUnavailableError("Offline");
  }
  if (!(await isCloudAiEnabled())) {
    throw new CloudUnavailableError("Cloud AI turned off in settings");
  }
  const key = await getDecryptedKey();
  if (!key) {
    throw new CloudUnavailableError("No cloud AI key saved");
  }
  if (!(await consumeCloudAiQuota(userId))) {
    throw new CloudUnavailableError("Cloud AI daily limit reached");
  }

  let response: Response;
  try {
    response = await fetch(`${GEMINI_ENDPOINT}?key=${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    });
  } catch (err) {
    // A real network failure (not just a non-2xx response) — same
    // "fall back, don't crash" treatment as every other failure here.
    throw new CloudUnavailableError(err instanceof Error ? err.message : String(err));
  }

  if (!response.ok) {
    // A bad/rate-limited/expired key surfaces here as a non-2xx status —
    // that's the student's own free-tier key hitting its own limits, not
    // this app's problem to recover from, so the honest response is "cloud
    // isn't available right now," same as being offline, not a hard error.
    throw new CloudUnavailableError(`Gemini request failed: ${response.status}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== "string" || !text.trim()) {
    throw new CloudUnavailableError("Gemini returned no usable content");
  }
  return text.trim();
}

/** The common case: one of this app's own standard prompts (see PROMPTS
 * above) for a given source text. */
export function generateViaCloud(
  kind: CloudGenerationKind,
  sourceText: string,
  userId: string,
): Promise<string> {
  return callGeminiWithPrompt(PROMPTS[kind](sourceText), userId);
}

/** Strips a ```json fenced code block if Gemini wrapped its response in
 * one despite being asked for raw JSON — observed as a real, common
 * instruction-following gap for this class of model, not a hypothetical
 * edge case, so callers parsing generateViaCloud's output as JSON should
 * run it through this first rather than calling JSON.parse directly. */
export function stripJsonFence(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}
