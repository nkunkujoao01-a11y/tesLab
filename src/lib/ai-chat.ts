// On-device conversational AI via transformers.js — same architecture as
// src/lib/ai-model.ts's summarizer (browser-only, dynamically imported so
// it stays out of the SSR bundle), but a genuinely different model: the
// existing summarizer is a T5 model fine-tuned specifically for
// summarization, not built for open-ended Q&A — using it to "chat" would
// produce poor, off-task output. This uses a small instruction-tuned
// model instead (see MODEL_ID below), purpose-built for exactly this.
//
// Chosen for size, not raw capability: this app's whole premise is
// working on poor/limited connectivity (see DEV_LOG.md, the Roadmap 2
// planning round), and the existing 155MB summarizer already measured as
// a multi-minute download that read as "broken" to a real user (Feature
// 31) before a UX fix. A frontier-quality chat model would be many times
// that size. HuggingFaceTB's SmolLM2 family is built specifically for
// on-device/edge deployment — this is an honest quality-for-size
// tradeoff, not the best possible chat experience, and the UI must say so
// plainly rather than imply this is ChatGPT-grade.
const MODEL_ID = "onnx-community/SmolLM2-360M-Instruct-ONNX";
const MODEL_DTYPE = "q4";

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

let pipelinePromise: Promise<Generator> | null = null;

export function loadChatModel(onProgress?: (p: ModelProgress) => void): Promise<Generator> {
  if (!pipelinePromise) {
    pipelinePromise = (async () => {
      const { pipeline } = await import("@huggingface/transformers");
      for (let attempt = 0; ; attempt++) {
        try {
          return await pipeline("text-generation", MODEL_ID, {
            dtype: MODEL_DTYPE,
            progress_callback: onProgress,
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
    // Same reasoning as ai-model.ts: don't cache a rejected promise, so
    // the next attempt retries clean instead of failing forever.
    pipelinePromise.catch(() => {
      pipelinePromise = null;
    });
  }
  return pipelinePromise;
}

/** Whether the model's actual weight file (the large one, not the small
 * config/tokenizer files) made it into Cache Storage — found to matter by
 * real testing, not assumed: transformers.js's own cache-write for that
 * file can fail with a caught, non-fatal "Unexpected internal error" from
 * the browser's Cache API (observed in this project's sandboxed test
 * environment; storage quota was nowhere near exhausted at the time, so
 * this isn't a quota problem — it looks like a real Cache API limitation
 * for a single very large entry). transformers.js swallows that error and
 * proceeds — the model still works for the rest of *this* session, but
 * nothing was actually saved for next time, silently, despite the UI
 * otherwise saying "downloaded." This lets the UI tell the difference
 * instead of overselling offline-readiness that wasn't achieved. Not yet
 * confirmed whether this is sandbox-specific or reproduces on a real
 * device — see REAL_DEVICE_TESTING.md. */
export async function isModelCachedForOffline(): Promise<boolean> {
  if (typeof caches === "undefined") return false;
  try {
    const cacheNames = await caches.keys();
    for (const name of cacheNames) {
      const cache = await caches.open(name);
      const keys = await cache.keys();
      if (keys.some((req) => req.url.includes(MODEL_ID) && req.url.endsWith(".onnx"))) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

const MAX_NEW_TOKENS = 300;

/** Runs one turn of conversation through the on-device model. `onToken` is
 * called incrementally as text streams out (transformers.js's own
 * TextStreamer) — without this, a real response can take long enough on a
 * real device that a silent wait reads as frozen, the exact "AI can't be
 * downloaded" mistake Feature 31 found and fixed for the download itself;
 * this is the same lesson applied to inference. `maxNewTokens` defaults to
 * the chat-turn budget above; quiz generation (src/lib/quiz-gen.ts) needs
 * more room for several full multiple-choice questions in one response, so
 * it passes a larger explicit budget rather than sharing the chat default. */
export async function askChatModel(
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
