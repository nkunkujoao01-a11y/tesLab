// On-device extractive question-answering via transformers.js — same
// browser-only, dynamically-imported architecture as ai-model.ts's
// summarizer and ai-chat.ts's chat models. A genuinely different job from
// either: this doesn't summarize or converse, it pulls a real answer span
// out of a specific piece of source text for a specific question.
//
// Used to *ground* quiz answers (see quiz-gen.ts's matchAnswerToOption and
// use-quiz.ts's useGenerateQuiz): the chat model that writes each MCQ also
// asserts its own "Correct: <letter>" for it, which is just self-reported
// text, not derived from the source — the same class of risk as any LLM
// stating a fact that sounds right. This model instead extracts the answer
// directly from the same source chunk the question came from, so a
// disagreement is a real signal the chat model's stated answer doesn't
// match anything actually in the text.
//
// Model: Xenova/distilbert-base-cased-distilled-squad — a small (~65MB),
// widely-used extractive-QA export, encoder-only (BERT-family), a
// genuinely different architecture from the T5/decoder-only models that hit
// this project's real dtype/kernel problems (ai-model.ts's T5 quantization
// failures, ai-chat.ts's GatherBlockQuantized crashes) — those were tied to
// T5 graph fusion and block-quantized token embeddings specifically, not a
// general on-device-model problem, so there's no a priori reason to expect
// the same failures here. That said, this hasn't yet been verified against
// a real TestDoc/ PDF or a real device the way the other two models were —
// treat "q8" below as a reasonable starting choice, not a confirmed one.
import { classifyModelError, isFatalCategory } from "@/lib/ai-error-classifier";
import { markAiOperationStarted, markAiOperationFinished } from "@/lib/ai-crash-breadcrumb";

const MODEL_ID = "Xenova/distilbert-base-cased-distilled-squad";
const MODEL_DTYPE = "q8";

export type ModelProgress = {
  status: string;
  file?: string;
  loaded?: number;
  total?: number;
};

export type QaResult = { answer: string; score: number };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type QuestionAnswerer = (question: string, context: string) => Promise<any>;

// Same reasoning as ai-model.ts/ai-chat.ts's identical pair — a real,
// one-off transient fetch failure mid-download is worth one clean retry;
// anything else (a fatal, deterministic load failure) isn't.
const TRANSIENT_RETRY_ATTEMPTS = 2;
const TRANSIENT_RETRY_DELAY_MS = 1500;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let pipelinePromise: Promise<QuestionAnswerer> | null = null;
let qaFatalError: Error | null = null;

/** Whether loading the QA model has already failed fatally this session,
 * without triggering a load attempt — mirrors
 * isSummarizerFatallyBroken/isModelFatallyBroken's own purpose. */
export function isQaFatallyBroken(): boolean {
  return qaFatalError !== null;
}

let progressSubscribers: Set<(p: ModelProgress) => void> | null = null;

export function loadQaModel(onProgress?: (p: ModelProgress) => void): Promise<QuestionAnswerer> {
  if (qaFatalError) return Promise.reject(qaFatalError);

  if (!pipelinePromise) {
    const subscribers = new Set<(p: ModelProgress) => void>();
    if (onProgress) subscribers.add(onProgress);
    progressSubscribers = subscribers;
    const broadcastProgress = (p: ModelProgress) => {
      for (const subscriber of subscribers) subscriber(p);
    };

    pipelinePromise = (async () => {
      await markAiOperationStarted("load", "the answer-grounding model");
      try {
        const { pipeline } = await import("@huggingface/transformers");
        for (let attempt = 0; ; attempt++) {
          try {
            const answerer = await pipeline("question-answering", MODEL_ID, {
              dtype: MODEL_DTYPE,
              progress_callback: broadcastProgress,
            });
            return answerer as unknown as QuestionAnswerer;
          } catch (err) {
            const category = classifyModelError(err);
            if (isFatalCategory(category)) {
              const fatal = err instanceof Error ? err : new Error(String(err));
              qaFatalError = fatal;
              throw fatal;
            }
            if (attempt >= TRANSIENT_RETRY_ATTEMPTS || category !== "transient") throw err;
            console.error(
              `Transient failure loading QA model (attempt ${attempt + 1}), retrying`,
              err,
            );
            await delay(TRANSIENT_RETRY_DELAY_MS);
          }
        }
      } finally {
        await markAiOperationFinished();
      }
    })();
    pipelinePromise.catch(() => {
      pipelinePromise = null;
    });
    pipelinePromise.finally(() => {
      progressSubscribers = null;
    });
  } else if (onProgress) {
    progressSubscribers?.add(onProgress);
  }
  return pipelinePromise;
}

/** Whether the QA model's weight file made it into Cache Storage — same
 * check and same real reasoning as isSummarizerCachedForOffline/
 * isModelCachedForOffline (a caught, non-fatal Cache API failure can leave
 * a model working this session but not actually saved for next time). */
export async function isQaCachedForOffline(): Promise<boolean> {
  if (typeof caches === "undefined") return false;
  try {
    const cacheNames = await caches.keys();
    for (const name of cacheNames) {
      const cache = await caches.open(name);
      const keys = await cache.keys();
      if (keys.some((req) => req.url.includes(MODEL_ID) && /\.onnx(_data)?$/.test(req.url))) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

/** The actual on-device QA call. Runs inside the AI worker (ai.worker.ts
 * imports this directly), same as summarizeLocally/generateChatLocally —
 * see answerQuestionViaWorker in ai-worker-client.ts for the main-thread-
 * facing entry point every application caller actually uses. */
export async function answerQuestionLocally(question: string, context: string): Promise<QaResult> {
  const answerer = await loadQaModel();
  await markAiOperationStarted("generate", "an answer");
  let result;
  try {
    result = await answerer(question, context);
  } finally {
    await markAiOperationFinished();
  }
  const answer = typeof result?.answer === "string" ? result.answer.trim() : "";
  const score = typeof result?.score === "number" ? result.score : 0;
  if (!answer) throw new Error("Model returned no answer");
  return { answer, score };
}
