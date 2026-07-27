// Chrome's built-in Gemini Nano (the "Prompt API" / on-device "Built-in AI"
// APIs) as an optional, feature-detected fourth on-device chat model — see
// DEV_LOG.md, Feature 74, for the full evaluation (why this one was added
// while Phi-4-Mini/GPT4All/"Sigma Browser" were rejected) and its real,
// honest limits: Chromium-desktop-only (no Android Chrome, no iOS Safari
// at all — this app's actual NFR10 budget-Android-phone audience gets none
// of this), still an origin-trial-shaped API as of 2026 (its exact global
// surface can and does shift between Chrome releases — re-confirm against
// whatever Chrome build is actually testing this before trusting the shape
// below as a frozen contract), and Chrome — not this app — owns and
// manages the actual model download: a real, one-time, multi-GB, browser-
// wide download shared across every site, not something this app ships or
// controls the size of.
//
// Deliberately kept separate from ai-chat.ts's CHAT_MODELS map: Gemini Nano
// has no transformers.js `pipeline()`, no dtype, no Cache Storage entry to
// check, and never touches the existing Web Worker — forcing it into
// ChatModelInfo's shape (built around a Hugging Face repo id + a
// transformers.js quantization dtype) would corrupt that type for a model
// this app doesn't actually download or run inference for itself at all.
import type { ChatTurn } from "@/lib/ai-chat";

export type GeminiNanoAvailability = "available" | "downloadable" | "unavailable";

// Hand-written, minimal shape of only the parts of the real `LanguageModel`
// global this file actually calls — there's no shipped npm package/type
// declarations for this (it's a native browser global, not a library), so
// this is deliberately not a claim about the API's *complete* real shape,
// only what's used here.
type LanguageModelDownloadProgressEvent = { loaded?: number; total?: number };
type LanguageModelSession = {
  prompt(input: string): Promise<string>;
  promptStreaming?(input: string): AsyncIterable<string>;
};
type LanguageModelStatic = {
  availability(): Promise<GeminiNanoAvailability>;
  create(options?: {
    monitor?: (m: {
      addEventListener: (
        type: "downloadprogress",
        listener: (e: LanguageModelDownloadProgressEvent) => void,
      ) => void;
    }) => void;
  }): Promise<LanguageModelSession>;
};

function getLanguageModel(): LanguageModelStatic | null {
  if (typeof self === "undefined") return null;
  const globalWithLanguageModel = self as typeof self & { LanguageModel?: LanguageModelStatic };
  return globalWithLanguageModel.LanguageModel ?? null;
}

/** Feature-detects the Prompt API and asks Chrome whether Gemini Nano is
 * usable right now — `"unavailable"` covers everything from "wrong
 * browser" to "unsupported hardware" to "not yet enabled," all of which
 * this app treats identically: don't show the option at all. Never throws
 * — any real error here also just means "treat as unavailable." */
export async function isGeminiNanoSupported(): Promise<GeminiNanoAvailability> {
  const LanguageModel = getLanguageModel();
  if (!LanguageModel) return "unavailable";
  try {
    return await LanguageModel.availability();
  } catch (err) {
    console.error("Gemini Nano availability check failed", err);
    return "unavailable";
  }
}

export type ModelProgress = {
  status: string;
  file?: string;
  loaded?: number;
  total?: number;
};

// Same "one in-flight attempt shared by every caller" shape as
// ai-chat.ts's own pipelinePromises — a second caller while a first
// session is still being created (which is also when Chrome's own
// multi-GB download happens, if not already cached) should observe the
// same attempt, not kick off a second one.
let sessionPromise: Promise<LanguageModelSession> | null = null;

/** Creates (or returns the already-in-flight) Gemini Nano session — this
 * call is what triggers Chrome's own model download if it isn't already
 * present on this device, surfaced via `onProgress` in the same
 * `ModelProgress` shape this app's other model-loading code already uses,
 * so no parallel progress-UI system is needed. */
export function loadGeminiNanoSession(
  onProgress?: (p: ModelProgress) => void,
): Promise<LanguageModelSession> {
  if (sessionPromise) return sessionPromise;

  const LanguageModel = getLanguageModel();
  if (!LanguageModel) {
    return Promise.reject(new Error("Gemini Nano isn't available in this browser"));
  }

  sessionPromise = LanguageModel.create({
    monitor(m) {
      m.addEventListener("downloadprogress", (e) => {
        onProgress?.({
          status: "progress",
          file: "gemini-nano",
          loaded: e.loaded ?? 0,
          total: e.total ?? 1,
        });
      });
    },
  });
  // Same "don't cache a rejected promise" reasoning as every other
  // model-loading entry point in this app — a failed attempt (declined
  // permission, hardware check failed mid-create) shouldn't poison every
  // later attempt this session.
  sessionPromise.catch(() => {
    sessionPromise = null;
  });
  return sessionPromise;
}

/** Generates one turn of conversation via Gemini Nano — runs on the main
 * thread (unlike the transformers.js path, this never touches
 * ai.worker.ts/ai-worker-client.ts): the Prompt API is a thin call into a
 * browser-managed model, not a blocking WASM computation this page itself
 * has to run, so there's no main-thread-jank reason to offload it the way
 * a real in-page ONNX inference call needs to be. */
export async function generateChatViaGeminiNano(
  history: ChatTurn[],
  onToken?: (piece: string) => void,
): Promise<string> {
  const session = await loadGeminiNanoSession();
  // The Prompt API takes one plain-text prompt per turn in the shape this
  // was written against, not a structured message array — flatten the
  // existing ChatTurn[] history the same way every other single-string
  // consumer in this app already would.
  const prompt = history.map((turn) => `${turn.role}: ${turn.content}`).join("\n\n");

  if (session.promptStreaming && onToken) {
    let full = "";
    for await (const piece of session.promptStreaming(prompt)) {
      onToken(piece);
      full += piece;
    }
    return full;
  }
  return session.prompt(prompt);
}
