// On-device neural summarization via transformers.js (WASM/ONNX runtime,
// runs entirely in the browser — no network calls after the model is
// cached). This is a browser-only module: `@huggingface/transformers` is
// never imported at module top-level, only inside async functions via
// dynamic import, so it (and the model files it fetches) stay out of the
// SSR bundle entirely and only load when a caller actually needs them.
//
// Model: onnx-community/text_summarization-ONNX (T5-small based). Chosen
// over the PRD's originally-named DistilBART after a head-to-head spike —
// see DEV_LOG.md "Feature 14" for the full comparison and reasoning.
//
// dtype: every quantized export of this model tried so far has failed one
// way or another under onnxruntime-web's WASM backend — see DEV_LOG.md,
// Features 14 and 20, for the full investigation:
//   - "int8"/"uint8": fail to load — missing scale tensor for the tied
//     embedding ("shared.weight") during a MatMulNBits graph fusion.
//   - "fp16"/"q4f16": fail to load — a separate, unrelated graph-optimizer
//     bug (broken LayerNorm fusion).
//   - "bnb4": *loads* and runs, but produces genuinely broken output on
//     real course content — a verbatim 3x repetition loop on one material,
//     a factual hallucination (attributing one plant's description to a
//     different plant) on another. Smaller and faster is worthless if the
//     summary is wrong.
// All of the above load and run correctly under onnxruntime-node (the
// runtime Feature 14's original spike used), so this is a real web-vs-node
// runtime gap in this specific model's exported graph, not a config
// mistake. "fp32" (full precision, no quantization ops at all) remains the
// one variant that's both reliable and correct, at the cost of a larger
// download (~300MB) — acceptable for a one-time, explicit opt-in download
// in an app that already treats a single course module's download (1.2GB)
// as normal (see Profile's storage rail). WebGPU (a different execution
// backend, independent of dtype) could not be evaluated at all — no GPU
// adapter available in this project's sandboxed dev/test environment —
// and real-world WebGPU support on the budget Android devices this app
// targets (NFR10) is still inconsistent, so it isn't a safe bet to build
// around even if it turned out to help.
import { summarizeViaWorker } from "@/lib/ai-worker-client";

const MODEL_ID = "onnx-community/text_summarization-ONNX";
const MODEL_DTYPE = "fp32";

export type ModelProgress = {
  status: string;
  file?: string;
  loaded?: number;
  total?: number;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Summarizer = (text: string, options?: Record<string, unknown>) => Promise<any>;

// A real, one-off `TypeError: Failed to fetch` was seen mid-download once
// (see DEV_LOG.md) — a transient network blip, not reproduced on retry,
// network otherwise fine throughout. Not root-caused, but a real fetch
// failure partway through a multi-file, multi-minute download is a
// realistic thing to hit on a real device's connection, and previously
// meant restarting the whole download by hand. A `TypeError` is the
// browser's own signal for a network-level fetch failure specifically
// (as opposed to e.g. a real unsupported-dtype error, which retrying
// wouldn't fix) — only that class of failure is retried automatically.
const TRANSIENT_RETRY_ATTEMPTS = 2;
const TRANSIENT_RETRY_DELAY_MS = 1500;

function isTransientFetchError(err: unknown): boolean {
  return err instanceof TypeError;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let pipelinePromise: Promise<Summarizer> | null = null;

export function loadSummarizerModel(onProgress?: (p: ModelProgress) => void): Promise<Summarizer> {
  if (!pipelinePromise) {
    pipelinePromise = (async () => {
      const { pipeline } = await import("@huggingface/transformers");
      for (let attempt = 0; ; attempt++) {
        try {
          const summarizer = await pipeline("summarization", MODEL_ID, {
            dtype: MODEL_DTYPE,
            progress_callback: onProgress,
          });
          return summarizer as unknown as Summarizer;
        } catch (err) {
          if (attempt >= TRANSIENT_RETRY_ATTEMPTS || !isTransientFetchError(err)) throw err;
          console.error(
            `Transient failure loading summarizer model (attempt ${attempt + 1}), retrying`,
            err,
          );
          await delay(TRANSIENT_RETRY_DELAY_MS);
        }
      }
    })();
    // If loading fails, don't leave a rejected promise cached — let the
    // next attempt retry from scratch instead of failing forever.
    pipelinePromise.catch(() => {
      pipelinePromise = null;
    });
  }
  return pipelinePromise;
}

// T5-family models have a bounded input window; very long source text is
// truncated defensively rather than left to error deep inside the runtime.
const MAX_INPUT_CHARS = 3000;

/** The actual on-device summarization call. Runs inside the AI worker
 * (ai.worker.ts imports this directly) rather than on the main thread —
 * see summarizeWithModel below, the main-thread-facing entry point every
 * application caller actually uses. */
export async function summarizeLocally(text: string): Promise<string> {
  const summarizer = await loadSummarizerModel();
  const input = text.length > MAX_INPUT_CHARS ? text.slice(0, MAX_INPUT_CHARS) : text;
  // no_repeat_ngram_size guards against a real degeneration mode found
  // during Feature 20's investigation: on some source material (e.g. the
  // Constitution Reader, law-110/m1), the model — at any precision,
  // including fp32 — falls into looping the same sentence verbatim
  // ("Article 66 recognises... Article 66 recognises...") instead of
  // continuing. Blocking any repeated 3-gram is a standard, low-risk fix
  // for exactly this failure mode.
  const result = await summarizer(input, { max_new_tokens: 80, no_repeat_ngram_size: 3 });
  const summaryText = Array.isArray(result) ? result[0]?.summary_text : undefined;
  if (!summaryText) throw new Error("Model returned no summary text");
  return String(summaryText).trim();
}

/** Runs neural summarization off the main thread (see DEV_LOG.md, Feature
 * 51) — same signature as before the worker migration, so existing
 * callers (summarize-structured.ts) need no changes. `onProgress` is
 * accepted but unused here: model *download* progress is a main-thread-
 * only concern, tracked separately via loadSummarizerModel directly (see
 * use-ai-model.ts) — no real caller of summarizeWithModel has ever passed
 * one. */
export async function summarizeWithModel(
  text: string,
  _onProgress?: (p: ModelProgress) => void,
): Promise<string> {
  return summarizeViaWorker(text);
}
