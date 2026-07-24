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
import { classifyModelError, isFatalCategory } from "@/lib/ai-error-classifier";
import { markAiOperationStarted, markAiOperationFinished } from "@/lib/ai-crash-breadcrumb";

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
  // Tried automatically, once, only if `dtype` fails with a *fatal*
  // (deterministic, not transient) error — see loadChatModel's own
  // comment on why this exists specifically for smollm2's "q8" gamble.
  fallbackDtype?: ModelDtype;
  label: string;
  description: string;
  approxSizeMb: number;
};

export const CHAT_MODELS: Record<ChatModelChoice, ChatModelInfo> = {
  // dtype history, real and humbling: started "q4" (block-quantized),
  // which real-device testing found crashed every quiz question with
  // "Can't create a session ... Could not find an implementation for
  // GatherBlockQuantized(1) node with name '/model/embed_tokens/Gather_Quant'"
  // — a real ONNX Runtime Web kernel gap for this op. Switched to "int8" on
  // the reasoning that it's a plain per-tensor quantization scheme
  // (DequantizeLinear/MatMulInteger) with long-standing WASM support — that
  // reasoning was wrong: the *exact same* GatherBlockQuantized error
  // reproduced on the same real device after that fix shipped.
  //
  // Also tried "q8" (a genuinely different, untested file from
  // int8/uint8 — confirmed via the model repo's own file listing) on the
  // reasoning that it's transformers.js's own default dtype for the wasm
  // backend. That reasoning didn't pan out either: it wasn't the same
  // load-time crash (the automatic fallbackDtype safety net built for that
  // case never triggered — this failed differently, during generation
  // itself, not loading), but real-device testing reported quiz
  // generation taking noticeably longer and still failing. Reverted back
  // to "fp32" — the one dtype actually confirmed working on real hardware
  // across every attempt so far, even though it's the largest and
  // slowest option. Three real attempts at a smaller/faster dtype have
  // now each failed differently; further guessing here isn't worth it
  // without a way to test on the actual target device first.
  smollm2: {
    id: "onnx-community/SmolLM2-360M-Instruct-ONNX",
    dtype: "fp32",
    label: "SmolLM2 (360M)",
    description:
      "The default — chosen for reliability, not speed. Runs at full precision, which two different quantized exports failed on for this model — a real, if large and slow, tradeoff. If it's freezing or crashing, connect a free cloud AI key in Settings instead of relying on this device.",
    approxSizeMb: 1450,
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
    // SmolLM2 being back on fp32 (1450MB) makes this q4 export the
    // *smaller* download of the two again, despite Gemma having nearly 3x
    // the parameters — corrected rather than left saying the opposite.
    description:
      "More capable (nearly 3x the parameters), and actually a smaller download than the default thanks to quantization. Some devices have crashed during this download — if that happens, switch back to SmolLM2 and reload.",
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

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Keyed per model choice — not a single slot — so switching the Profile
// setting doesn't discard an already-loaded model still usable this
// session, and loading one model never blocks or clobbers the other.
const pipelinePromises = new Map<ChatModelChoice, Promise<Generator>>();

// Real bug found via real-device testing: a fatal, deterministic session-
// creation failure (e.g. the real GatherBlockQuantized kernel gap) got
// retried anyway — every quiz question re-attempted full pipeline creation
// from scratch, even though a fatal failure reproduces identically every
// time. Remembered for the rest of this worker's lifetime once seen, so
// every subsequent call rejects immediately instead of repeating a doomed
// attempt. Intentionally in-memory only (not persisted) — a fresh page
// load/worker restart gets a clean attempt, in case the failure was
// somehow transient to that one runtime instance.
const fatalModelErrors = new Map<ChatModelChoice, Error>();

/** Whether loading this specific model has already failed fatally this
 * session, without triggering a load attempt — for UI purposes, e.g.
 * disabling "regenerate quiz" instead of letting the user click into the
 * same wall again. */
export function isModelFatallyBroken(modelChoice: ChatModelChoice): boolean {
  return fatalModelErrors.has(modelChoice);
}

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
  const fatalError = fatalModelErrors.get(choice);
  if (fatalError) return Promise.reject(fatalError);

  const existing = pipelinePromises.get(choice);
  if (existing) {
    if (onProgress) progressSubscribers.get(choice)?.add(onProgress);
    return existing;
  }

  const { id, dtype, fallbackDtype } = CHAT_MODELS[choice];
  const subscribers = new Set<(p: ModelProgress) => void>();
  if (onProgress) subscribers.add(onProgress);
  progressSubscribers.set(choice, subscribers);
  const broadcastProgress = (p: ModelProgress) => {
    for (const subscriber of subscribers) subscriber(p);
  };

  const promise = (async () => {
    await markAiOperationStarted("load", CHAT_MODELS[choice].label);
    try {
      const { pipeline } = await import("@huggingface/transformers");

      // One dtype's worth of load attempts (with the existing transient-
      // retry policy) — called twice below: once for the primary dtype,
      // once more for `fallbackDtype` if the primary one fails *fatally*
      // (see loadChatModel's own comment and smollm2's CHAT_MODELS entry
      // for why this exists). Throws whatever the final attempt threw;
      // doesn't touch fatalModelErrors itself, so the caller decides
      // whether a fatal failure here is truly final or worth falling
      // back from.
      const attemptLoad = async (attemptDtype: ModelDtype) => {
        for (let attempt = 0; ; attempt++) {
          try {
            return await pipeline("text-generation", id, {
              dtype: attemptDtype,
              progress_callback: broadcastProgress,
            });
          } catch (err) {
            const category = classifyModelError(err);
            if (isFatalCategory(category)) throw err;
            if (attempt >= TRANSIENT_RETRY_ATTEMPTS || category !== "transient") throw err;
            console.error(
              `Transient failure loading chat model (${attemptDtype}, attempt ${attempt + 1}), retrying`,
              err,
            );
            await delay(TRANSIENT_RETRY_DELAY_MS);
          }
        }
      };

      try {
        return await attemptLoad(dtype);
      } catch (err) {
        const category = classifyModelError(err);
        if (isFatalCategory(category) && fallbackDtype) {
          console.error(
            `Chat model dtype "${dtype}" failed fatally, falling back to "${fallbackDtype}"`,
            err,
          );
          try {
            return await attemptLoad(fallbackDtype);
          } catch (fallbackErr) {
            const fallbackCategory = classifyModelError(fallbackErr);
            const fatal =
              fallbackErr instanceof Error ? fallbackErr : new Error(String(fallbackErr));
            if (isFatalCategory(fallbackCategory)) fatalModelErrors.set(choice, fatal);
            throw fatal;
          }
        }
        // No fallback available (or this wasn't a fatal failure to begin
        // with) — same "remember it so every future call rejects
        // immediately" reasoning as the fallback branch above.
        const fatal = err instanceof Error ? err : new Error(String(err));
        if (isFatalCategory(category)) fatalModelErrors.set(choice, fatal);
        throw fatal;
      }
    } finally {
      // Reached only if the process is still alive to run it — a real
      // crash mid-load never gets here, which is exactly the signal
      // checkAndConsumeStaleAiBreadcrumb looks for on a later load.
      await markAiOperationFinished();
    }
  })();
  pipelinePromises.set(choice, promise);
  // Same reasoning as ai-model.ts: don't cache a rejected promise, so the
  // next attempt retries clean instead of failing forever — except for a
  // fatal error, which is deliberately kept in fatalModelErrors above
  // instead so it stops future attempts rather than allowing a clean retry.
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
  sample = false,
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
  await markAiOperationStarted("generate", "a response");
  let output;
  try {
    output = await generator(history, {
      max_new_tokens: maxNewTokens,
      // Greedy (do_sample: false) by default — deterministic, which is
      // right for most calls, but means a caller that got malformed output
      // back (quiz-gen.ts's parser dropping an unparseable question, say)
      // gains nothing from simply calling again with the same input:
      // greedy decoding would produce the exact same malformed output
      // every time. `sample: true` (used only for that kind of one-off
      // retry — see use-quiz.ts) turns on real randomness for a genuinely
      // different attempt with an actual chance of coming out right.
      do_sample: sample,
      ...(sample ? { temperature: 0.7, top_p: 0.9 } : {}),
      no_repeat_ngram_size: 3,
      streamer,
    });
  } finally {
    await markAiOperationFinished();
  }
  const lastTurn = output?.[0]?.generated_text?.at(-1);
  const content = lastTurn && typeof lastTurn === "object" ? lastTurn.content : undefined;
  if (!content) throw new Error("Model returned no response");
  return String(content).trim();
}

/** Runs one turn of conversation through the on-device model, off the main
 * thread (see DEV_LOG.md, Feature 51) — same signature and streaming
 * semantics as before the worker migration, so existing callers
 * (use-ai-chat.ts, use-collection-chat.ts) that don't pass `sample` need no
 * changes. `sample` is currently only used by use-quiz.ts's parse-failure
 * retry — see generateChatLocally's own comment above for why. */
export async function askChatModel(
  history: ChatTurn[],
  onToken?: (piece: string) => void,
  maxNewTokens: number = MAX_NEW_TOKENS,
  sample = false,
): Promise<string> {
  return generateChatViaWorker(history, onToken, maxNewTokens, sample);
}
