// Resumable, interruption-resilient downloads for @huggingface/transformers'
// own internal networking. See DEV_LOG.md, Feature 74, for the full "why" —
// short version: transformers.js exposes `env.fetch`, a genuine override
// point for the fetch function it uses internally (confirmed by reading its
// own source, not the type declarations alone: `getFile()` calls
// `env.fetch(url, { headers })` directly, and its progress-reporting code
// only ever reads the returned Response's `Content-Length` header and
// streams its `.body` — nothing else). That means every model file's
// download can be made resumable by chunking it via HTTP Range requests,
// persisting each received chunk to IndexedDB immediately, and reassembling
// a real Response once complete — all without forking transformers.js and
// without touching its own Cache Storage persistence (`env.useBrowserCache`),
// which still runs exactly as before on the fully-assembled Response this
// override hands back.
//
// Real, previously honest-but-unresolved gap this closes: ChatModelDownloadPrompt.tsx
// used to warn students outright that switching apps or letting the screen
// lock "can interrupt the download and restart it from zero" —
// wake-lock.ts's own comment named Background Fetch (Chromium-only, a
// materially bigger/riskier build) as the correct fix. This is the
// universal, cross-browser alternative: a tab closed mid-download now only
// loses the one chunk in flight at that instant, not the whole file, since
// every completed chunk is durably in IndexedDB independent of the tab's
// own lifetime.
import { deviceDb } from "@/lib/db";

// Large enough that a real multi-hundred-MB model download doesn't create
// thousands of tiny IndexedDB rows (real per-write overhead); small enough
// that an interruption never loses more than this much progress. 8MB.
const CHUNK_SIZE = 8 * 1024 * 1024;

// Same real, network-failure-specific retry signal already used throughout
// this codebase (ai-model.ts/ai-chat.ts/ai-error-classifier.ts) — a
// TypeError is the browser's own signal for a fetch-level network failure,
// not a real HTTP error status a retry wouldn't fix.
const CHUNK_RETRY_ATTEMPTS = 2;
const CHUNK_RETRY_DELAY_MS = 1500;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function chunkKey(url: string, chunkIndex: number): string {
  return `${url}::${chunkIndex}`;
}

function parseTotalFromContentRange(contentRange: string | null): number | null {
  const match = contentRange ? /\/(\d+)$/.exec(contentRange) : null;
  return match ? Number(match[1]) : null;
}

async function fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await fetch(url, init);
      if (!response.ok && response.status !== 206) {
        throw new Error(`Unexpected response status ${response.status} for ${url}`);
      }
      return response;
    } catch (err) {
      if (attempt >= CHUNK_RETRY_ATTEMPTS || !(err instanceof TypeError)) throw err;
      console.error(
        `Transient failure fetching a model chunk (attempt ${attempt + 1}), retrying`,
        err,
      );
      await delay(CHUNK_RETRY_DELAY_MS);
    }
  }
}

/** Fetches every not-yet-received chunk of `url` (resuming from whatever's
 * already durably stored in IndexedDB from a previous, interrupted attempt),
 * then reassembles a real Response with the correct total `Content-Length`
 * and a stream that yields the stored chunks back in order. Deletes the
 * chunk scratch space once the stream is fully consumed — it's only ever
 * needed to survive an interruption *during* this download, not afterward
 * (the completed file goes on to transformers.js's own Cache Storage write,
 * unaffected by anything here). */
async function downloadResumable(
  url: string,
  headers: Headers,
  totalBytes: number,
  contentType: string | null,
): Promise<Response> {
  const totalChunks = Math.ceil(totalBytes / CHUNK_SIZE);
  for (let i = 0; i < totalChunks; i++) {
    const existing = await deviceDb.partialDownloadChunks.get(chunkKey(url, i));
    if (existing) continue;
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, totalBytes) - 1;
    const rangeHeaders = new Headers(headers);
    rangeHeaders.set("Range", `bytes=${start}-${end}`);
    const chunkResponse = await fetchWithRetry(url, { headers: rangeHeaders });
    const buf = await chunkResponse.arrayBuffer();
    await deviceDb.partialDownloadChunks.put({
      key: chunkKey(url, i),
      url,
      chunkIndex: i,
      data: new Blob([buf]),
    });
    await deviceDb.partialDownloadMeta.update(url, {
      receivedBytes: Math.min(totalBytes, (i + 1) * CHUNK_SIZE),
      updatedAt: Date.now(),
    });
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for (let i = 0; i < totalChunks; i++) {
          const row = await deviceDb.partialDownloadChunks.get(chunkKey(url, i));
          if (!row) {
            controller.error(new Error(`Missing chunk ${i} of ${totalChunks} for ${url}`));
            return;
          }
          controller.enqueue(new Uint8Array(await row.data.arrayBuffer()));
        }
        controller.close();
      } catch (err) {
        controller.error(err);
        return;
      }
      // Reached only once every chunk was successfully enqueued — the
      // downloaded file is now fully in the caller's hands (about to be
      // read into Cache Storage by transformers.js), so this scratch
      // space is no longer needed. A failure here (e.g. the tab closing
      // right as this runs) just leaves it for the *next* attempt to find
      // already-complete and clean up itself — self-healing, not a
      // correctness problem.
      await deviceDb.partialDownloadChunks.where("url").equals(url).delete();
      await deviceDb.partialDownloadMeta.delete(url);
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Length": String(totalBytes),
      "Content-Type": contentType ?? "application/octet-stream",
    },
  });
}

/** The `env.fetch` override itself — see installResumableDownloads below
 * for where this gets installed. Falls back to a single plain fetch
 * whenever resumability genuinely isn't possible (the server ignores
 * `Range`, or anything about the chunking/IndexedDB machinery itself
 * throws unexpectedly) rather than ever failing a download that a plain
 * `fetch` would have succeeded at — this is a pure reliability addition,
 * never a new way to fail. */
export async function resumableFetch(input: string | URL, init?: RequestInit): Promise<Response> {
  const url = typeof input === "string" ? input : input.toString();

  try {
    const existingMeta = await deviceDb.partialDownloadMeta.get(url);
    if (existingMeta) {
      const headers = new Headers(init?.headers);
      return await downloadResumable(
        url,
        headers,
        existingMeta.totalBytes,
        existingMeta.contentType,
      );
    }

    // First time seeing this URL this download: probe with a ranged
    // request for the first chunk. If the server doesn't honor Range at
    // all, this response's body already *is* the whole file — return it
    // directly, no resumability possible or needed for this host.
    const probeHeaders = new Headers(init?.headers);
    probeHeaders.set("Range", `bytes=0-${CHUNK_SIZE - 1}`);
    const probeResponse = await fetchWithRetry(url, { headers: probeHeaders });

    if (probeResponse.status !== 206) {
      return probeResponse;
    }

    const totalBytes = parseTotalFromContentRange(probeResponse.headers.get("Content-Range"));
    if (totalBytes == null) {
      // A 206 with no parseable Content-Range is malformed enough not to
      // trust for chunked resumption — but the body we already have is
      // still a real, valid partial-or-full response either way. Safest
      // is to just hand it back as-is rather than guess further.
      return probeResponse;
    }

    const contentType = probeResponse.headers.get("Content-Type");
    const firstChunk = await probeResponse.arrayBuffer();
    await deviceDb.partialDownloadChunks.put({
      key: chunkKey(url, 0),
      url,
      chunkIndex: 0,
      data: new Blob([firstChunk]),
    });
    await deviceDb.partialDownloadMeta.put({
      url,
      totalBytes,
      receivedBytes: firstChunk.byteLength,
      contentType,
      updatedAt: Date.now(),
    });

    return await downloadResumable(url, new Headers(init?.headers), totalBytes, contentType);
  } catch (err) {
    console.error(`Resumable download failed for ${url}, falling back to a plain fetch`, err);
    return fetch(input, init);
  }
}

// Shared, single-source-of-truth copy for the download-in-progress UI —
// found duplicated three times with drifted-apart wording potential
// (ChatModelDownloadPrompt.tsx, and twice independently in settings.tsx,
// once each for the summarizer and chat model) despite one of those files'
// own comment claiming it's shared. Deliberately doesn't overclaim
// Background-Fetch-style "close the browser entirely and it still
// finishes" behavior — that's a real, Chromium-only, not-yet-built
// enhancement (see this file's own top comment), not what resumable-fetch
// alone guarantees.
export const DOWNLOAD_RESILIENCE_NOTE =
  "You can switch apps or let the screen lock — the download picks up where it left off. Keeping this tab open and connected just finishes it fastest.";

let installed = false;

/** Installs the resumable-download override onto transformers.js's own
 * `env.fetch` — idempotent and safe to call from every model-loading entry
 * point (loadChatModel, loadSummarizerModel) without first checking
 * whether it's already been installed this session; only the first call
 * actually does anything. Accepts a loosely-typed `env` (rather than
 * statically importing transformers.js's own type) for the same reason
 * ai-chat.ts's `ModelDtype` is spelled out by hand instead of imported —
 * this file must stay free of any top-level import of the (deliberately
 * dynamically-imported) library. */
export function installResumableDownloads(env: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fetch: (input: string | URL, init?: any) => Promise<any>;
}): void {
  if (installed) return;
  installed = true;
  env.fetch = resumableFetch;
}
