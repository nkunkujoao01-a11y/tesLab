// On-device conversational AI via transformers.js — same architecture as
// src/lib/ai-model.ts's summarizer (browser-only, dynamically imported so
// it stays out of the SSR bundle), but a genuinely different model: the
// existing summarizer is a T5 model fine-tuned specifically for
// summarization, not built for open-ended Q&A — using it to "chat" would
// produce poor, off-task output. This uses a small instruction-tuned
// model instead, purpose-built for exactly this.
//
// Two selectable models, not one — see CHAT_MODELS below. The default,
// SmolLM2-360M, is chosen for size, not raw capability: this app's whole
// premise is working on poor/limited connectivity (see DEV_LOG.md, the
// Roadmap 2 planning round), and the existing 155MB summarizer already
// measured as a multi-minute download that read as "broken" to a real
// user (Feature 31) before a UX fix. HuggingFaceTB's SmolLM2 family is
// built specifically for on-device/edge deployment — an honest
// quality-for-size tradeoff, not the best possible chat experience.
// Gemma 3 1B (added Feature 47) is a real, larger, higher-quality
// alternative for anyone willing to spend the extra download/storage —
// confirmed via HuggingFace's own file listing at
// onnx-community/gemma-3-1b-it-ONNX: its smallest usable quantization
// (q4) is ~859MB, more than double SmolLM2's ~387MB q4 file, so it's an
// explicit opt-in (Profile > AI Settings), never the default.
import { deviceDb } from "@/lib/db";
import { generateChatViaWorker } from "@/lib/ai-worker-client";

export type ChatModelChoice = "smollm2" | "gemma3-1b";

// Matches transformers.js's own PretrainedOptions["dtype"] union — spelled
// out here rather than imported so this file doesn't need a static,
// top-level import of the (deliberately dynamically-imported) library
// just for a type.
type ModelDtype =
  | "auto"
  | "fp32"
  | "fp16"
  | "q8"
  | "int8"
  | "uint8"
  | "q4"
  | "bnb4"
  | "q4f16"
  | "q2"
  | "q2f16"
  | "q1"
  | "q1f16";

export type ChatModelInfo = {
  id: string;
  dtype: ModelDtype;
  label: string;
  description: string;
  approxSizeMb: number;
};

export const CHAT_MODELS: Record<ChatModelChoice, ChatModelInfo> = {
  // dtype was "q4" (block-quantized) until real-device testing surfaced a
  // hard failure generating every quiz question: "Can't create a session
  // ... Could not find an implementation for GatherBlockQuantized(1) node
  // with name '/model/embed_tokens/Gather_Quant'" — a real ONNX Runtime Web
  // kernel gap for this model's block-quantized embedding lookup, not a
  // timeout or a device-capability issue (this project's own sandboxed
  // testing hits the model's genuine slowness, a different failure mode,
  // never this exact error — this fix is grounded in the real error text
  // and the model's actual published files, not verified end-to-end here).
  // "int8" is a plain per-tensor quantization (DequantizeLinear/
  // MatMulInteger, not GatherBlockQuantized/MatMulNBits) that's had broad
  // WASM kernel support for a long time, and onnx-community's own published
  // int8 file for this model is 363MB — smaller than q4's 386MB, not a
  // tradeoff. Needs a real device to confirm this actually resolves it.
  smollm2: {
    id: "onnx-community/SmolLM2-360M-Instruct-ONNX",
    dtype: "int8",
    label: "SmolLM2 (360M)",
    description: "Small and fast — the default. Good for quick answers and quiz generation.",
    approxSizeMb: 363,
  },
  // Real-device testing also reported the device crashing during this
  // model's download/install (SmolLM2 self-recovered via a page refresh;
  // this one reportedly took the whole system down). Left at "q4" rather
  // than switched to a broadly-compatible dtype the way smollm2 was above:
  // onnx-community's own int8 file for THIS model is 1GB vs q4's 859MB —
  // a real ~140MB increase, not a free win — and a crash on the larger of
  // the two chat models is at least as plausibly plain memory pressure on
  // a constrained device as it is the same kernel gap, so a bigger file
  // could easily make that worse rather than better. Surfacing this
  // honestly in the description below instead of guessing at a dtype
  // change with a real chance of making things worse.
  "gemma3-1b": {
    id: "onnx-community/gemma-3-1b-it-ONNX",
    dtype: "q4",
    label: "Gemma 3 (1B)",
    description:
      "Larger and more capable, at more than double the download size. Some devices have crashed during this download — if that happens, switch back to SmolLM2 and reload.",
    approxSizeMb: 859,
  },
};

export const DEFAULT_CHAT_MODEL: ChatModelChoice = "smollm2";
const CHAT_MODEL_CHOICE_KEY = "chat_model_choice";

function isChatModelChoice(value: string): value is ChatModelChoice {
  return value === "smollm2" || value === "gemma3-1b";
}

/** The model the user has selected in Profile > AI Settings (see Feature
 * 47) — same `appSettings` key/value pattern as every other on-device-AI
 * preference in this app. Defaults to the small model so a fresh install
 * never silently prefers the larger download. */
export async function getSelectedChatModel(): Promise<ChatModelChoice> {
  const row = await deviceDb.appSettings.get(CHAT_MODEL_CHOICE_KEY);
  return row && isChatModelChoice(row.value) ? row.value : DEFAULT_CHAT_MODEL;
}

export async function setSelectedChatModel(choice: ChatModelChoice): Promise<void> {
  await deviceDb.appSettings.put({ key: CHAT_MODEL_CHOICE_KEY, value: choice });
}

export type ModelProgress = {
  status: string;
  file?: string;
  loaded?: number;
  total?: number;
};

export type ChatRole = "system" | "user" | "assistant";
export type ChatTurn = { role: ChatRole; content: string };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Generator = any;

// Same reasoning and same real, one-off failure as ai-model.ts — see its
// own comment on this constant pair for the full explanation.
const TRANSIENT_RETRY_ATTEMPTS = 2;
const TRANSIENT_RETRY_DELAY_MS = 1500;

function isTransientFetchError(err: unknown): boolean {
  return err instanceof TypeError;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Keyed per model choice — not a single slot — so switching the Profile
// setting doesn't discard an already-loaded model still usable this
// session, and loading one model never blocks or clobbers the other.
const pipelinePromises = new Map<ChatModelChoice, Promise<Generator>>();

// Real bug found via real-device testing: leaving the /assistant page (or
// any component calling loadChatModel) while a download was in flight, then
// coming back, made the download look like it "started over or stopped" —
// it didn't actually restart (pipelinePromises above already dedupes that
// correctly), but progress_callback is bound to whichever caller's
// onProgress happened to be passed the *first* time this model started
// downloading, at pipeline() call time — a second caller returning to an
// already-in-flight download had no way to observe its progress at all, so
// its own UI just sat at a fresh 0% (or looked stuck) until the original,
// unrelated promise resolved. This set lets every current caller's
// onProgress subscribe to the one real in-flight download, not just the
// first one to start it.
const progressSubscribers = new Map<ChatModelChoice, Set<(p: ModelProgress) => void>>();

/** Loads the given model (or, if omitted, whichever the user has selected
 * in Profile > AI Settings — see getSelectedChatModel). Existing callers
 * that don't care which model — they just want "the current one" — don't
 * need to change. */
export async function loadChatModel(
  onProgress?: (p: ModelProgress) => void,
  modelChoice?: ChatModelChoice,
): Promise<Generator> {
  const choice = modelChoice ?? (await getSelectedChatModel());
  const existing = pipelinePromises.get(choice);
  if (existing) {
    if (onProgress) progressSubscribers.get(choice)?.add(onProgress);
    return existing;
  }

  const { id, dtype } = CHAT_MODELS[choice];
  const subscribers = new Set<(p: ModelProgress) => void>();
  if (onProgress) subscribers.add(onProgress);
  progressSubscribers.set(choice, subscribers);
  const broadcastProgress = (p: ModelProgress) => {
    for (const subscriber of subscribers) subscriber(p);
  };

  const promise = (async () => {
    const { pipeline } = await import("@huggingface/transformers");
    for (let attempt = 0; ; attempt++) {
      try {
        return await pipeline("text-generation", id, {
          dtype,
          progress_callback: broadcastProgress,
        });
      } catch (err) {
        if (attempt >= TRANSIENT_RETRY_ATTEMPTS || !isTransientFetchError(err)) throw err;
        console.error(
          `Transient failure loading chat model (attempt ${attempt + 1}), retrying`,
          err,
        );
        await delay(TRANSIENT_RETRY_DELAY_MS);
      }
    }
  })();
  pipelinePromises.set(choice, promise);
  // Same reasoning as ai-model.ts: don't cache a rejected promise, so the
  // next attempt retries clean instead of failing forever.
  promise.catch(() => {
    pipelinePromises.delete(choice);
  });
  // No more progress events will ever come once this settles either way —
  // release the closures so a long-finished download doesn't keep every
  // component that ever observed it alive in memory.
  promise.finally(() => {
    progressSubscribers.delete(choice);
  });
  return promise;
}

/** Whether the given model's actual weight file (the large one, not the
 * small config/tokenizer files) made it into Cache Storage — found to
 * matter by real testing, not assumed: transformers.js's own cache-write
 * for that file can fail with a caught, non-fatal "Unexpected internal
 * error" from the browser's Cache API (observed in this project's
 * sandboxed test environment; storage quota was nowhere near exhausted at
 * the time, so this isn't a quota problem — it looks like a real Cache
 * API limitation for a single very large entry). transformers.js swallows
 * that error and proceeds — the model still works for the rest of *this*
 * session, but nothing was actually saved for next time, silently,
 * despite the UI otherwise saying "downloaded." This lets the UI tell the
 * difference instead of overselling offline-readiness that wasn't
 * achieved. Not yet confirmed whether this is sandbox-specific or
 * reproduces on a real device — see REAL_DEVICE_TESTING.md. */
export async function isModelCachedForOffline(modelChoice?: ChatModelChoice): Promise<boolean> {
  if (typeof caches === "undefined") return false;
  const choice = modelChoice ?? (await getSelectedChatModel());
  const modelId = CHAT_MODELS[choice].id;
  try {
    const cacheNames = await caches.keys();
    for (const name of cacheNames) {
      const cache = await caches.open(name);
      const keys = await cache.keys();
      // A model whose quantized weights exceed ~2GB (Gemma 3 1B's q4
      // export does) splits into a tiny ".onnx" stub plus the real
      // weights in a separate ".onnx_data" file — checking only ".onnx"
      // would only ever see the stub for a model shaped that way and
      // wrongly report it never cached. Confirmed via the real file
      // listing at onnx-community/gemma-3-1b-it-ONNX.
      if (keys.some((req) => req.url.includes(modelId) && /\.onnx(_data)?$/.test(req.url))) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

const MAX_NEW_TOKENS = 300;

/** The actual on-device generation call. Runs inside the AI worker
 * (ai.worker.ts imports this directly) rather than on the main thread —
 * see askChatModel below, the main-thread-facing entry point every
 * application caller actually uses. `onToken` is called incrementally as
 * text streams out (transformers.js's own TextStreamer) — without this, a
 * real response can take long enough on a real device that a silent wait
 * reads as frozen, the exact "AI can't be downloaded" mistake Feature 31
 * found and fixed for the download itself; this is the same lesson
 * applied to inference. `maxNewTokens` defaults to the chat-turn budget
 * above; quiz generation (src/lib/quiz-gen.ts) needs more room for
 * several full multiple-choice questions in one response, so it passes a
 * larger explicit budget rather than sharing the chat default. */
export async function generateChatLocally(
  history: ChatTurn[],
  onToken?: (piece: string) => void,
  maxNewTokens: number = MAX_NEW_TOKENS,
): Promise<string> {
  const { TextStreamer } = await import("@huggingface/transformers");
  const generator = await loadChatModel();
  const streamer = onToken
    ? new TextStreamer(generator.tokenizer, {
        skip_prompt: true,
        skip_special_tokens: true,
        callback_function: onToken,
      })
    : undefined;
  const output = await generator(history, {
    max_new_tokens: maxNewTokens,
    do_sample: false,
    no_repeat_ngram_size: 3,
    streamer,
  });
  const lastTurn = output?.[0]?.generated_text?.at(-1);
  const content = lastTurn && typeof lastTurn === "object" ? lastTurn.content : undefined;
  if (!content) throw new Error("Model returned no response");
  return String(content).trim();
}

/** Runs one turn of conversation through the on-device model, off the main
 * thread (see DEV_LOG.md, Feature 51) — same signature and streaming
 * semantics as before the worker migration, so existing callers
 * (use-ai-chat.ts, use-collection-chat.ts, use-quiz.ts) need no changes. */
export async function askChatModel(
  history: ChatTurn[],
  onToken?: (piece: string) => void,
  maxNewTokens: number = MAX_NEW_TOKENS,
): Promise<string> {
  return generateChatViaWorker(history, onToken, maxNewTokens);
}
