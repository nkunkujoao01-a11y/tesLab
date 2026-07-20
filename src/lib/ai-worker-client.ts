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
  SummarizeRequest,
  WorkerRequest,
  WorkerResponse,
} from "@/lib/ai-worker-protocol";

type PendingRequest = {
  onToken?: (piece: string) => void;
  resolve: (result: string) => void;
  reject: (err: Error) => void;
};

let workerPromise: Promise<Worker> | null = null;
const pending = new Map<string, PendingRequest>();

function handleMessage(message: WorkerResponse): void {
  const entry = pending.get(message.requestId);
  // No entry means the caller already gave up on this request (or it was
  // cancelled) — nothing left to notify.
  if (!entry) return;

  if (message.type === "token") {
    entry.onToken?.(message.piece);
    return;
  }
  pending.delete(message.requestId);
  if (message.type === "done") {
    entry.resolve(message.result);
  } else if (message.type === "error") {
    entry.reject(new Error(message.message));
  } else {
    entry.reject(new Error("AI worker is busy with another request"));
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
): Promise<string> {
  const request: ChatGenerateRequest = {
    type: "chat-generate",
    requestId: makeRequestId(),
    turns,
    maxNewTokens,
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
