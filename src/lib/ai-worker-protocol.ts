// Message shapes shared between the main thread (ai-worker-client.ts) and
// the AI worker (ai.worker.ts) — imported by both sides so the shapes
// can't drift. `requestId` correlates every request with its response(s);
// see ai-worker-client.ts for how that correlation is used.
import type { ChatTurn } from "@/lib/ai-chat";
import type { ModelErrorCategory } from "@/lib/ai-error-classifier";

export type ChatGenerateRequest = {
  type: "chat-generate";
  requestId: string;
  turns: ChatTurn[];
  maxNewTokens?: number;
  // Real randomness for a genuinely different retry attempt after a
  // malformed (not fatal) response — see ai-chat.ts's generateChatLocally
  // for the full reasoning. Defaults to greedy (false) everywhere else.
  sample?: boolean;
  stream: boolean;
};

export type SummarizeRequest = {
  type: "summarize";
  requestId: string;
  text: string;
};

// Grounds a quiz question's answer in real source text (see ai-qa.ts) —
// deliberately reuses the existing DoneMessage's plain-string `result`
// rather than adding a new response variant: the response is JSON-encoded
// (`{answer, score}`) and decoded back into an object client-side (see
// answerQuestionViaWorker in ai-worker-client.ts). This keeps WorkerResponse
// untouched, so nothing about chat-generate/summarize response handling
// changes.
export type QaRequest = {
  type: "qa";
  requestId: string;
  question: string;
  context: string;
};

export type CancelRequest = {
  type: "cancel";
  requestId: string;
};

export type WorkerRequest = ChatGenerateRequest | SummarizeRequest | QaRequest | CancelRequest;

export type TokenMessage = { type: "token"; requestId: string; piece: string };
export type DoneMessage = { type: "done"; requestId: string; result: string };
// category is classified worker-side (see ai.worker.ts), where the real
// error object is still available — by the time an error crosses this
// message boundary it's already reduced to a plain string, so classifying
// after that point would have nothing but the string to go on anyway.
export type ErrorMessage = {
  type: "error";
  requestId: string;
  message: string;
  category: ModelErrorCategory;
};
// Sent instead of "done"/"error" when a request arrives while the worker
// is already generating for a different requestId *and* the queue below
// is already at its (generous, rarely-hit) sanity limit — see
// ai.worker.ts. A request that queues normally never gets this; it just
// waits.
export type BusyMessage = { type: "busy"; requestId: string };
// Sent the instant a request actually starts running (not when it's
// merely received/queued) — see ai.worker.ts's queue. Lets
// ai-worker-client.ts start a request's real generation-timeout clock only
// once it's genuinely executing, so time spent waiting behind another
// request in the queue doesn't eat into that budget.
export type StartedMessage = { type: "started"; requestId: string };

export type WorkerResponse =
  TokenMessage | DoneMessage | ErrorMessage | BusyMessage | StartedMessage;
