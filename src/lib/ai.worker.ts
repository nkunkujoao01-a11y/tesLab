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
import type { WorkerRequest, WorkerResponse } from "@/lib/ai-worker-protocol";

function post(message: WorkerResponse): void {
  self.postMessage(message);
}

// Single in-flight generation per worker — reject-if-busy, not queued (see
// DEV_LOG.md Feature 51 for why). `suppressedRequestId` lets a cancelled
// request's eventual (non-interruptible) result be dropped silently
// instead of posting a message back for a request the client no longer
// has a listener for.
let currentRequestId: string | null = null;
let suppressedRequestId: string | null = null;

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data;

  if (msg.type === "cancel") {
    if (msg.requestId === currentRequestId) suppressedRequestId = msg.requestId;
    return;
  }

  if (currentRequestId) {
    post({ type: "busy", requestId: msg.requestId });
    return;
  }

  currentRequestId = msg.requestId;
  suppressedRequestId = null;
  try {
    const result =
      msg.type === "chat-generate"
        ? await generateChatLocally(
            msg.turns,
            msg.stream
              ? (piece) => {
                  if (suppressedRequestId !== msg.requestId) {
                    post({ type: "token", requestId: msg.requestId, piece });
                  }
                }
              : undefined,
            msg.maxNewTokens,
          )
        : await summarizeLocally(msg.text);

    if (suppressedRequestId !== msg.requestId) {
      post({ type: "done", requestId: msg.requestId, result });
    }
  } catch (err) {
    if (suppressedRequestId !== msg.requestId) {
      post({
        type: "error",
        requestId: msg.requestId,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  } finally {
    if (currentRequestId === msg.requestId) currentRequestId = null;
  }
};
