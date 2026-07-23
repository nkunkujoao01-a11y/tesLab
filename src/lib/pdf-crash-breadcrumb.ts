// Same reasoning and exact same shape as ai-crash-breadcrumb.ts, for PDF
// upload/extraction instead of on-device AI model operations — a genuine
// tab/process crash happens below where JavaScript can react at all, so
// extractPdfText's own try/catch (use-documents.ts) never sees it. A
// small marker written right before extraction starts and cleared right
// after it finishes (success or failure — either way the process is
// clearly still alive to run that cleanup) is the one honest mitigation
// available for that specific failure mode. A stale marker found on a
// later load is consistent with — but not proof of — a real crash; it's
// equally consistent with the user just closing the tab on purpose
// mid-upload. This is a low-confidence signal, offered only because it's
// strictly better than today's total silence on the subject.
import { deviceDb } from "@/lib/db";

const BREADCRUMB_KEY = "pdf_last_extraction";

export type StalePdfBreadcrumb = {
  fileName: string;
  ts: number;
};

export async function markPdfExtractionStarted(fileName: string): Promise<void> {
  await deviceDb.appSettings.put({
    key: BREADCRUMB_KEY,
    value: JSON.stringify({ fileName, ts: Date.now() }),
  });
}

export async function markPdfExtractionFinished(): Promise<void> {
  await deviceDb.appSettings.delete(BREADCRUMB_KEY);
}

/** Reads a stale breadcrumb left over from a previous session, if any, and
 * deletes it in the same call — same one-time-only reasoning as
 * checkAndConsumeStaleAiBreadcrumb. */
export async function checkAndConsumeStalePdfBreadcrumb(): Promise<StalePdfBreadcrumb | null> {
  const row = await deviceDb.appSettings.get(BREADCRUMB_KEY);
  if (!row) return null;
  await deviceDb.appSettings.delete(BREADCRUMB_KEY);
  try {
    const parsed = JSON.parse(row.value) as Partial<StalePdfBreadcrumb>;
    if (!parsed.fileName || !parsed.ts) return null;
    return { fileName: parsed.fileName, ts: parsed.ts };
  } catch {
    return null;
  }
}
