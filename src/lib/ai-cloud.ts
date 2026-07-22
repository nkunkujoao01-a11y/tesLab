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
// any failure. Offline, no key saved, an invalid/rate-limited key, and a
// genuine network error all surface as the same CloudUnavailableError, so
// callers don't need to distinguish *why* the cloud path didn't work, only
// that it didn't — same "degrade gracefully" discipline the on-device path
// already follows for its own failures.
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

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
// designed around).
const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// undefined = not yet fetched this session; null = fetched, nothing saved.
// Decrypted once per session and kept in memory only, never written to
// localStorage/IndexedDB — a real page reload pays one extra round trip to
// re-fetch it, an acceptable cost for keeping the plaintext key out of any
// persisted client-side storage.
let cachedKey: string | null | undefined;

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
 * to the existing on-device path. Takes an already-built prompt rather
 * than a `kind` — see generateViaCloud below for the common case using
 * this app's own standard prompts; a caller needing a different response
 * shape (summarize-structured.ts's structured JSON, for one) builds its
 * own prompt and calls this directly instead of stretching the shared
 * CloudGenerationKind enum to cover a shape only it needs. */
export async function callGeminiWithPrompt(prompt: string): Promise<string> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    throw new CloudUnavailableError("Offline");
  }
  const key = await getDecryptedKey();
  if (!key) {
    throw new CloudUnavailableError("No cloud AI key saved");
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
export function generateViaCloud(kind: CloudGenerationKind, sourceText: string): Promise<string> {
  return callGeminiWithPrompt(PROMPTS[kind](sourceText));
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
