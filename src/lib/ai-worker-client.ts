// Main-thread entry point for the AI worker (ai.worker.ts) — mirrors
// pdf-ocr.ts's lazily-created, cached `workerPromise` pattern. Every
// caller of askChatModel/summarizeWithModel (ai-chat.ts, ai-model.ts)
// routes generation through here instead of running it on the main
// thread directly — see DEV_LOG.md, Feature 51.
//
// One shared worker for both chat/quiz generation and summarization, not
// two — a Worker's fixed startup cost is worth paying once, and each
// pipeline stays independently lazy inside it exactly as it would on the
// main thread. Model *downloads* (progress-tracked, used by the Profile >
// AI Settings screen) deliberately stay on the main thread — only
// generation moves here.
import type { ChatTurn } from "@/lib/ai-chat";
import type {
  ChatGenerateRequest,
  CancelRequest,
  SummarizeRequest,
  QaRequest,
  WorkerRequest,
  WorkerResponse,
} from "@/lib/ai-worker-protocol";
import type { ModelErrorCategory } from "@/lib/ai-error-classifier";
import type { QaResult } from "@/lib/ai-qa";

/** An error from the worker, carrying the same classification computed
 * worker-side (see ai.worker.ts) — lets a caller do
 * `err instanceof ModelError && err.category === "fatal-unsupported"`
 * instead of re-parsing message text on this side of the boundary. */
export class ModelError extends Error {
  category: ModelErrorCategory;
  constructor(message: string, category: ModelErrorCategory) {
    super(message);
    this.name = "ModelError";
    this.category = category;
  }
}

/** Distinct from ModelError — this isn't a model failure at all, just this
 * worker's own "single in-flight generation, reject if busy, not queued"
 * scheduling (see ai.worker.ts's own comment on that design). Found via
 * real-device testing to matter: a caller retrying a genuinely transient
 * "busy" the same way it would retry a real model error wastes a retry
 * attempt on something that just needs a short wait, not a different
 * approach — see use-quiz.ts's own handling. A distinct class lets callers
 * tell the two apart with `instanceof` instead of matching on message text. */
export class WorkerBusyError extends Error {
  constructor() {
    super("AI worker is busy with another request");
    this.name = "WorkerBusyError";
  }
}

type PendingRequest = {
  onToken?: (piece: string) => void;
  resolve: (result: string) => void;
  reject: (err: Error) => void;
  timeoutId: ReturnType<typeof setTimeout>;
};

// Real generation time on this app's small on-device models is genuinely
// unmeasured on actual target hardware (see REAL_DEVICE_TESTING.md — still
// open) and a sandboxed test VM's CPU-bound WASM inference has been found
// to run far slower than that, so this is deliberately generous rather
// than tuned to a real number. The point isn't to cut off a legitimately
// slow-but-working generation — it's that nothing in this pipeline had
// *any* upper bound before this, so a genuinely stuck (or just very slow)
// call left the UI showing "Generating…" forever with no feedback and no
// way out. A caller that can degrade gracefully (quiz generation skips a
// timed-out question and tries the next one) benefits either way; one
// that can't (Ask AI) at least surfaces a real error instead of an
// infinite silent spinner.
const DEFAULT_TIMEOUT_MS = 180_000;

let workerPromise: Promise<Worker> | null = null;
const pending = new Map<string, PendingRequest>();

async function cancelRequest(requestId: string): Promise<void> {
  const worker = await getWorker();
  const cancel: CancelRequest = { type: "cancel", requestId };
  worker.postMessage(cancel);
}

function handleMessage(message: WorkerResponse): void {
  const entry = pending.get(message.requestId);
  // No entry means the caller already gave up on this request (timed out
  // or was otherwise cancelled) — nothing left to notify.
  if (!entry) return;

  if (message.type === "token") {
    entry.onToken?.(message.piece);
    return;
  }
  clearTimeout(entry.timeoutId);
  pending.delete(message.requestId);
  if (message.type === "done") {
    entry.resolve(message.result);
  } else if (message.type === "error") {
    entry.reject(new ModelError(message.message, message.category));
  } else {
    entry.reject(new WorkerBusyError());
  }
}

function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = Promise.resolve().then(() => {
      const worker = new Worker(new URL("./ai.worker.ts", import.meta.url), {
        type: "module",
      });
      worker.onmessage = (e: MessageEvent<WorkerResponse>) => handleMessage(e.data);
      return worker;
    });
  }
  return workerPromise;
}

function makeRequestId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function send(
  request: WorkerRequest,
  onToken?: (piece: string) => void,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<string> {
  const worker = await getWorker();
  return new Promise<string>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      pending.delete(request.requestId);
      void cancelRequest(request.requestId);
      reject(
        new Error(
          "The AI model is taking too long to respond — this device may be too slow for on-device generation right now.",
        ),
      );
    }, timeoutMs);
    pending.set(request.requestId, { onToken, resolve, reject, timeoutId });
    worker.postMessage(request);
  });
}

/** Runs one turn of conversation through the on-device model in the
 * worker. Mirrors askChatModel's own signature and streaming semantics
 * exactly: `onToken` fires incrementally as text streams out, and the
 * returned promise resolves with the full response. */
export function generateChatViaWorker(
  turns: ChatTurn[],
  onToken?: (piece: string) => void,
  maxNewTokens?: number,
  sample?: boolean,
): Promise<string> {
  const request: ChatGenerateRequest = {
    type: "chat-generate",
    requestId: makeRequestId(),
    turns,
    maxNewTokens,
    sample,
    stream: Boolean(onToken),
  };
  return send(request, onToken);
}

export function summarizeViaWorker(text: string): Promise<string> {
  const request: SummarizeRequest = {
    type: "summarize",
    requestId: makeRequestId(),
    text,
  };
  return send(request);
}

/** Grounds a quiz question's answer in real source text (see ai-qa.ts) —
 * off the main thread, same as the other two worker calls. The worker
 * encodes its `{answer, score}` result as a JSON string (see
 * ai-worker-protocol.ts's QaRequest comment on why); this is the one place
 * that decodes it back into an object for callers, so a malformed/garbled
 * result reads as a real thrown error here rather than a caller getting a
 * raw unparsed string and silently misusing it. */
export async function answerQuestionViaWorker(
  question: string,
  context: string,
): Promise<QaResult> {
  const request: QaRequest = {
    type: "qa",
    requestId: makeRequestId(),
    question,
    context,
  };
  const raw = await send(request);
  const parsed = JSON.parse(raw) as Partial<QaResult>;
  if (typeof parsed.answer !== "string" || typeof parsed.score !== "number") {
    throw new Error("QA worker returned a malformed result");
  }
  return { answer: parsed.answer, score: parsed.score };
}
