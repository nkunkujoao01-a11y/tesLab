// A genuine tab/process crash (like the real Gemma 3 1B reports from
// device testing) happens below where JavaScript can react at all — no
// error is ever thrown, so ai-error-classifier.ts's containment can't see
// it, and neither can anything else in this app. This is the one honest
// mitigation available for that specific failure mode: a small marker
// written right before a download/generation starts and cleared right
// after it finishes (success or failure — either way the process is
// clearly still alive to run that cleanup). If a stale marker is found on
// a later load, the process that wrote it never got to clear it, which is
// consistent with — but not proof of — a real crash; it's equally
// consistent with the user just closing the tab on purpose mid-operation.
// Said plainly here and in the UI that reads this: this is a low-confidence
// signal, offered only because it's strictly better than today's total
// silence on the subject, not because it can reliably distinguish the two
// cases.
import { deviceDb } from "@/lib/db";

const BREADCRUMB_KEY = "ai_last_op";

export type AiOperation = "load" | "generate";

export type StaleAiBreadcrumb = {
  op: AiOperation;
  modelLabel: string;
  ts: number;
};

export async function markAiOperationStarted(op: AiOperation, modelLabel: string): Promise<void> {
  await deviceDb.appSettings.put({
    key: BREADCRUMB_KEY,
    value: JSON.stringify({ op, modelLabel, ts: Date.now() }),
  });
}

export async function markAiOperationFinished(): Promise<void> {
  await deviceDb.appSettings.delete(BREADCRUMB_KEY);
}

/** Reads a stale breadcrumb left over from a previous session, if any, and
 * deletes it in the same call — this is what makes the resulting UI
 * warning genuinely one-time rather than repeating on every load: once
 * read, it's gone, whether or not the caller actually ends up showing
 * anything with it. */
export async function checkAndConsumeStaleAiBreadcrumb(): Promise<StaleAiBreadcrumb | null> {
  const row = await deviceDb.appSettings.get(BREADCRUMB_KEY);
  if (!row) return null;
  await deviceDb.appSettings.delete(BREADCRUMB_KEY);
  try {
    const parsed = JSON.parse(row.value) as Partial<StaleAiBreadcrumb>;
    if (!parsed.op || !parsed.modelLabel || !parsed.ts) return null;
    return { op: parsed.op, modelLabel: parsed.modelLabel, ts: parsed.ts };
  } catch {
    return null;
  }
}
