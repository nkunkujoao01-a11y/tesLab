/** Deterministic safety net for the "no em dashes anywhere a student reads"
 * house style. The system-prompt instruction given to chat models (see
 * use-ai-chat.ts/use-collection-chat.ts's SYSTEM_PROMPT/BASE_INSTRUCTIONS)
 * only works as well as that specific model's instruction-following —
 * smaller on-device models (SmolLM2, Gemma 1B) are noticeably less
 * reliable at it than Gemini, and the on-device neural summarizer/QA
 * models take no natural-language instructions at all. Running every
 * AI-generated string through this before it's stored or shown closes
 * that gap regardless of which model produced it. Not applied to a
 * student's own uploaded document text (personal-document reading,
 * catalog materials) — that's the source material's own real prose, not
 * something this app generated, so altering it would mean silently
 * editing what a real document actually says. */
export function stripEmDash(text: string): string {
  return text.replace(/\s*—\s*/g, ", ").replace(/,\s*,/g, ",");
}
