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

export type CancelRequest = {
  type: "cancel";
  requestId: string;
};

export type WorkerRequest = ChatGenerateRequest | SummarizeRequest | CancelRequest;

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
// is already generating for a different requestId — see ai.worker.ts.
export type BusyMessage = { type: "busy"; requestId: string };

export type WorkerResponse = TokenMessage | DoneMessage | ErrorMessage | BusyMessage;
