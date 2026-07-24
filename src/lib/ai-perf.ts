// Tracks how long on-device chat generation actually takes on *this*
// device — real user report: a flat, one-size-fits-all timeout and
// "still thinking" staging (tuned around one hypothetical device) either
// cuts off a genuinely slow-but-working budget/older phone too early, or
// makes a fast PC sit through timing stages meant for a much slower
// machine before ever seeing a real failure. Device-wide, not per-user
// (see db.ts's own reasoning for deviceDb) — generation speed is a fact
// about this device's hardware, not the signed-in account, so two
// students sharing a device shouldn't each need to "relearn" its pace.
import { deviceDb } from "@/lib/db";

const AVG_GEN_MS_KEY = "avg_chat_generation_ms";

// Exponential moving average, not a plain running mean — weights recent
// generations more than old ones, so the observed pace can adapt (a
// device under heavier load, or a dtype/model switch) without needing to
// store or replay a full history of past durations.
const EMA_WEIGHT = 0.3;

/** This device's observed typical on-device generation time, or `null` if
 * nothing has completed here yet (a fresh install, or a device that's
 * only ever used the cloud path) — callers fall back to a fixed default
 * in that case, same as before this existed. */
export async function getObservedGenerationMs(): Promise<number | null> {
  const row = await deviceDb.appSettings.get(AVG_GEN_MS_KEY);
  const value = row ? Number(row.value) : NaN;
  return Number.isFinite(value) && value > 0 ? value : null;
}

/** Folds one real, completed generation's duration into the running
 * average — call only for a generation that actually finished
 * successfully; a timed-out or errored attempt says nothing trustworthy
 * about how long a *working* generation takes on this device. */
export async function recordGenerationMs(durationMs: number): Promise<void> {
  const prev = await getObservedGenerationMs();
  const next = prev === null ? durationMs : prev + (durationMs - prev) * EMA_WEIGHT;
  await deviceDb.appSettings.put({ key: AVG_GEN_MS_KEY, value: String(Math.round(next)) });
}
