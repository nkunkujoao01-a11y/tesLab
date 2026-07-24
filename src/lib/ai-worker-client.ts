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
import { getObservedGenerationMs, recordGenerationMs } from "@/lib/ai-perf";

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

/** Distinct from ModelError — this isn't a model failure at all. The worker
 * (ai.worker.ts) queues a request that arrives while another is already
 * running rather than rejecting it outright, so this now only fires in
 * the rare case that queue is *also* already full — a real backstop, not
 * the normal path it used to be. Found via real-device testing to matter
 * back when "busy" was the common case: a caller retrying it the same way
 * it would retry a real model error wastes a retry attempt on something
 * that just needed a short wait, not a different approach — see
 * use-quiz.ts's own handling. A distinct class lets callers tell the two
 * apart with `instanceof` instead of matching on message text. */
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
  // Undefined until the worker actually confirms it has started running
  // this request (see the "started" branch in handleMessage below) — a
  // request sitting behind another one in the worker's queue (see
  // ai.worker.ts) hasn't begun generating yet, so there's nothing to time
  // out until it has.
  timeoutId?: ReturnType<typeof setTimeout>;
  startedAt?: number;
};

// Fallback used only when this device has no observed generation time yet
// (a fresh install, or one that's only ever used the cloud path) — see
// ai-perf.ts. Deliberately generous rather than tuned to a real number,
// same reasoning as before this became dynamic: the point isn't to cut
// off a legitimately slow-but-working first generation, it's to have
// *some* upper bound rather than none. Every generation after the first
// uses this device's own real, observed pace instead (see
// computeDynamicTimeoutMs).
const DEFAULT_TIMEOUT_MS = 180_000;

// Real user report: a flat timeout tuned for one hypothetical device either
// left a fast PC waiting through the same multi-minute ceiling as a slow
// budget phone before ever seeing a real failure, or cut off a genuinely
// slow-but-working phone too early. Scaling the timeout to a multiple of
// this device's own observed typical generation time (ai-perf.ts) fixes
// both: a device that usually finishes in 3s gets a ~45s floor (still far
// short of 180s if something's actually gone wrong), and one that usually
// takes 60s gets real headroom above that instead of a number that was
// never actually about *this* hardware.
const MIN_TIMEOUT_MS = 45_000;
const MAX_TIMEOUT_MS = 300_000;
const TIMEOUT_SAFETY_MULTIPLIER = 4;

async function computeDynamicTimeoutMs(): Promise<number> {
  const observed = await getObservedGenerationMs();
  if (observed === null) return DEFAULT_TIMEOUT_MS;
  return Math.min(MAX_TIMEOUT_MS, Math.max(MIN_TIMEOUT_MS, observed * TIMEOUT_SAFETY_MULTIPLIER));
}

let workerPromise: Promise<Worker> | null = null;
const pending = new Map<string, PendingRequest>();

async function cancelRequest(requestId: string): Promise<void> {
  const worker = await getWorker();
  const cancel: CancelRequest = { type: "cancel", requestId };
  worker.postMessage(cancel);
}

function armTimeout(requestId: string, entry: PendingRequest, timeoutMs: number): void {
  entry.timeoutId = setTimeout(() => {
    pending.delete(requestId);
    void cancelRequest(requestId);
    entry.reject(
      new Error(
        "The AI model is taking too long to respond — this device may be too slow for on-device generation right now.",
      ),
    );
  }, timeoutMs);
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
  if (message.type === "started") {
    entry.startedAt = Date.now();
    void computeDynamicTimeoutMs().then((timeoutMs) => {
      // Re-check the entry is still pending — it may have already been
      // rejected/resolved (or cancelled) in the time this async lookup
      // took, in which case arming a timeout now would just leak a timer
      // for a request nothing is waiting on anymore.
      if (pending.get(message.requestId) !== entry) return;
      armTimeout(message.requestId, entry, timeoutMs);
    });
    return;
  }
  clearTimeout(entry.timeoutId);
  pending.delete(message.requestId);
  if (message.type === "done") {
    if (entry.startedAt !== undefined) {
      void recordGenerationMs(Date.now() - entry.startedAt);
    }
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

async function send(request: WorkerRequest, onToken?: (piece: string) => void): Promise<string> {
  const worker = await getWorker();
  return new Promise<string>((resolve, reject) => {
    // No timeout armed yet — see handleMessage's "started" branch. A
    // request that's merely queued behind another one (ai.worker.ts)
    // hasn't begun generating, so there's nothing to time out until the
    // worker actually confirms it has started.
    pending.set(request.requestId, { onToken, resolve, reject });
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
