// Classifies an on-device AI error so callers can react differently to a
// genuinely fatal failure than to a harmless blip — see DEV_LOG.md for the
// full reasoning. Before this existed, every error from the AI worker
// collapsed into a bare string by the time any hook saw it, so a real
// dead-end (a missing ONNX kernel) and a transient network hiccup looked
// identical, and callers retried both the same way — including retrying a
// fatal, deterministic failure on every question of a quiz.

export type ModelErrorCategory = "transient" | "fatal-unsupported" | "fatal-oom" | "unknown";

// The browser's own signal for a network-level fetch failure specifically —
// same rule already used (in two separate, now-duplicated places) by
// ai-model.ts and ai-chat.ts for their download-retry logic.
function isTransientFetchError(err: unknown): boolean {
  return err instanceof TypeError;
}

// Confirmed, real text from a real device: "Can't create a session.
// ERROR_CODE: 9, ERROR_MESSAGE: Could not find an implementation for
// GatherBlockQuantized(1) node with name '/model/embed_tokens/Gather_Quant'"
// — a genuine ONNX Runtime Web kernel gap for a block-quantized model. The
// broader "Can't create a session...ERROR_CODE" framing is ORT Web's own
// generic wording for *any* unsupported-op session failure, not just this
// one kernel, so it's matched too — this generalizes the one confirmed
// signature to the same class of error without inventing unconfirmed ones.
const FATAL_UNSUPPORTED_PATTERNS = [
  /could not find an implementation for/i,
  /gatherblockquantized/i,
  /can'?t create a session/i,
];

// Well-known Emscripten/WASM abort text. Unlike the pattern above, none of
// these have actually been observed in this project — included defensively
// since a thrown WASM out-of-memory abort is a real, well-documented failure
// mode for this class of runtime, not because a real report matched this
// exact text. Kept as a distinct category so this honest uncertainty isn't
// hidden behind the confirmed case above.
const FATAL_OOM_PATTERNS = [
  /aborted\(/i,
  /cannot enlarge memory arrays/i,
  /memory access out of bounds/i,
  /out of memory/i,
];

function errorMessageOf(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

export function classifyModelError(err: unknown): ModelErrorCategory {
  if (isTransientFetchError(err)) return "transient";
  const message = errorMessageOf(err);
  if (FATAL_UNSUPPORTED_PATTERNS.some((p) => p.test(message))) return "fatal-unsupported";
  if (FATAL_OOM_PATTERNS.some((p) => p.test(message))) return "fatal-oom";
  return "unknown";
}

export function isFatalCategory(category: ModelErrorCategory): boolean {
  return category === "fatal-unsupported" || category === "fatal-oom";
}

/** One shared place for the user-facing wording for each category, so
 * quiz/chat/summary don't each invent slightly different phrasing for the
 * same underlying failure. `featureLabel` names what specifically failed
 * ("this quiz", "this summary", "a response") so the message reads
 * naturally in each caller's context. */
export function fatalErrorUserMessage(category: ModelErrorCategory, featureLabel: string): string {
  if (category === "fatal-unsupported") {
    return `This device can't run the current AI model for ${featureLabel} — try a different model in Profile > AI Settings.`;
  }
  if (category === "fatal-oom") {
    return `The AI ran low on memory generating ${featureLabel} — try closing other tabs/apps, or a smaller model in Profile > AI Settings.`;
  }
  return `Couldn't generate ${featureLabel}. Try again.`;
}
