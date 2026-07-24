// Runs on-device AI inference (chat/quiz generation and summarization) off
// the main thread, so a real multi-second-to-multi-minute WASM/ONNX call
// doesn't freeze the UI — see DEV_LOG.md, Feature 51. Confirmed via a
// throwaway smoke test that Vite's `new Worker(new URL(...))` bundling
// survives this project's Nitro build wrapping, and that
// @huggingface/transformers runs correctly in a Worker's global scope
// (no `document`, limited `navigator`).
//
// Reuses generateChatLocally/summarizeLocally unmodified rather than
// reimplementing their generation logic here — a Worker executes its own
// isolated copy of every imported module, so this gives the worker its
// own independently-lazy pipeline cache (ai-chat.ts's `pipelinePromises`,
// ai-model.ts's `pipelinePromise`) for free, with zero duplicated retry/
// dtype/streaming logic to drift out of sync with the main thread's copy
// (still used by the Profile > AI Settings download flow — see
// ai-worker-client.ts for why downloads stay on the main thread).
//
// Imports generateChatLocally/summarizeLocally specifically, not
// askChatModel/summarizeWithModel — the latter two now delegate to this
// same worker via ai-worker-client.ts, so importing them here would spawn
// a worker from inside a worker on every request.
import { generateChatLocally } from "@/lib/ai-chat";
import { summarizeLocally } from "@/lib/ai-model";
import { answerQuestionLocally } from "@/lib/ai-qa";
import { classifyModelError } from "@/lib/ai-error-classifier";
import type { WorkerRequest, WorkerResponse } from "@/lib/ai-worker-protocol";

function post(message: WorkerResponse): void {
  self.postMessage(message);
}

// Single in-flight generation per worker, but genuinely *queued* now, not
// reject-if-busy — real user report: a student generating a quiz while
// the assistant chat was also mid-response (or several quiz questions
// firing back to back) hit repeated "AI worker is busy" rejections, and
// on a slow device the existing one-retry-after-a-second recovery
// (use-quiz.ts) often wasn't enough headroom before the blocking
// generation was still running, producing a real, visible failure instead
// of just a longer wait. A queued request still finishes; it only ever
// waits its turn. `MAX_QUEUE_LENGTH` exists purely as a sanity backstop
// against a real bug elsewhere spamming requests — one student's one tab
// should never realistically queue more than a couple of these.
const MAX_QUEUE_LENGTH = 8;
let currentRequestId: string | null = null;
// A cancelled request's eventual (non-interruptible) generation result is
// dropped silently instead of posting a message back for a request the
// client no longer has a listener for — only ever the *currently running*
// request needs this; a still-queued (not yet started) request that gets
// cancelled is simply removed from the queue below, nothing to suppress.
let suppressedRequestId: string | null = null;
const queue: WorkerRequest[] = [];

async function processRequest(msg: WorkerRequest): Promise<void> {
  if (msg.type === "cancel") return;
  currentRequestId = msg.requestId;
  suppressedRequestId = null;
  post({ type: "started", requestId: msg.requestId });
  try {
    let result: string;
    if (msg.type === "chat-generate") {
      result = await generateChatLocally(
        msg.turns,
        msg.stream
          ? (piece) => {
              if (suppressedRequestId !== msg.requestId) {
                post({ type: "token", requestId: msg.requestId, piece });
              }
            }
          : undefined,
        msg.maxNewTokens,
        msg.sample,
      );
    } else if (msg.type === "qa") {
      const qaResult = await answerQuestionLocally(msg.question, msg.context);
      result = JSON.stringify(qaResult);
    } else {
      result = await summarizeLocally(msg.text);
    }

    if (suppressedRequestId !== msg.requestId) {
      post({ type: "done", requestId: msg.requestId, result });
    }
  } catch (err) {
    if (suppressedRequestId !== msg.requestId) {
      // Classified here, not on the receiving end — the real err object
      // (not yet reduced to a string) is only available at this point.
      post({
        type: "error",
        requestId: msg.requestId,
        message: err instanceof Error ? err.message : String(err),
        category: classifyModelError(err),
      });
    }
  } finally {
    if (currentRequestId === msg.requestId) currentRequestId = null;
    const next = queue.shift();
    if (next) void processRequest(next);
  }
}

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data;

  if (msg.type === "cancel") {
    if (msg.requestId === currentRequestId) {
      suppressedRequestId = msg.requestId;
      return;
    }
    const queuedIndex = queue.findIndex((q) => q.requestId === msg.requestId);
    if (queuedIndex >= 0) queue.splice(queuedIndex, 1);
    return;
  }

  if (currentRequestId) {
    if (queue.length >= MAX_QUEUE_LENGTH) {
      post({ type: "busy", requestId: msg.requestId });
      return;
    }
    queue.push(msg);
    return;
  }

  void processRequest(msg);
};
