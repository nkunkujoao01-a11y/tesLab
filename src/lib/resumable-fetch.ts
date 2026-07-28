// Resumable, interruption-resilient downloads for @huggingface/transformers'
// own internal networking. See DEV_LOG.md, Feature 74/75, for the full "why"
// — short version: transformers.js exposes `env.fetch`, a genuine override
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
// Two layers, in order of preference:
//  1. Background Fetch (Chromium desktop *and* Android Chrome — not Firefox,
//     not Safari/iOS) hands the download to the browser itself, via the
//     service worker, so it keeps running even if every tab of this app
//     closes or the app is fully quit. `public/sw.js`'s
//     backgroundfetchsuccess/backgroundfetchfail handlers persist the result
//     directly into this same IndexedDB database, independent of whether any
//     page is open to observe it.
//  2. Manual HTTP Range chunking (works everywhere Range requests are
//     honored) — a tab closed mid-download only loses the one chunk in
//     flight at that instant, not the whole file, but does *not* keep
//     downloading while every tab is closed. This is the fallback whenever
//     Background Fetch isn't available, failed, or the file's too small to
//     be worth a native download entry for.
//
// Real, previously honest-but-unresolved gap this closes: ChatModelDownloadPrompt.tsx
// used to warn students outright that switching apps or letting the screen
// lock "can interrupt the download and restart it from zero."
import { liveQuery } from "dexie";
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

// Below this size, a file isn't worth registering its own native
// Background-Fetch download entry for (tokenizer.json/config.json etc. are a
// few KB and would just spam the browser's own download UI with several
// tiny, near-instant entries) — those still go through manual chunking,
// which is more than fast enough for something this small.
const BACKGROUND_FETCH_MIN_BYTES = 5 * 1024 * 1024;

const BACKGROUND_FETCH_ID_PREFIX = "elearn-model-dl";

// A whole-file chunk (written by public/sw.js's backgroundfetchsuccess
// handler) is stored under this sentinel index instead of `0` — manual
// chunking's own loop (downloadResumable, below) only ever produces
// `0, 1, 2, ...`, so this can never collide with it. This matters: the
// Background Fetch attempt isn't guaranteed to actually stop the moment
// this app "gives up waiting" on it (see downloadViaBackgroundFetch's own
// comment on why) — if it succeeds anyway while manual chunking is
// independently fetching the same URL, both used to write to the exact
// same key (`${url}::0`), corrupting the reassembled file (whole file +
// manual chunking's own 8MB slices, concatenated). A disjoint index makes
// that structurally impossible: the two writers can never overwrite each
// other, and streamStoredChunks (below) knows to prefer the whole-file
// chunk over any partial ones if both ever exist. Must stay in exact sync
// with the literal `-1` public/sw.js writes directly (that file can't
// import this constant — it's a separate service-worker bundle).
const WHOLE_FILE_CHUNK_INDEX = -1;

/** Thrown when an assembled download's byte length doesn't match what was
 * expected — deliberately worded so it can never match any pattern in
 * ai-error-classifier.ts's FATAL_UNSUPPORTED_PATTERNS/FATAL_OOM_PATTERNS
 * (verified directly against that file's patterns when writing this
 * message) or `isTransientFetchError`'s `TypeError` check, so it always
 * classifies as "unknown" — never latched into fatalModelErrors/
 * summarizerFatalError the way a corrupted buffer reaching transformers.js
 * itself would be. Real device evidence: a race between this file's two
 * download mechanisms (see WHOLE_FILE_CHUNK_INDEX's own comment) could
 * previously corrupt a download's stored chunks, which manifested to a
 * user as "Gemma 3 said failed, and Ask AI stayed broken afterward" — this
 * class exists so a similar corruption is caught, cleaned up, and reported
 * honestly instead of reaching the model runtime as a mysterious crash. */
export class DownloadIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DownloadIntegrityError";
  }
}

/** Deletes every trace of an in-progress or corrupted download for `url` —
 * shared by streamStoredChunks' normal post-success cleanup and its
 * integrity-failure path, so a device with stale/corrupted rows (from
 * before this fix shipped, or from any future issue) always gets a genuine
 * clean slate for its next attempt rather than repeating the same
 * corruption. */
async function clearStoredDownload(url: string): Promise<void> {
  await deviceDb.partialDownloadChunks.where("url").equals(url).delete();
  await deviceDb.partialDownloadMeta.delete(url);
  await deviceDb.backgroundFetchStatus.delete(url).catch(() => {});
}

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

// Best-effort label for the progress-pub/sub below — doesn't need to match
// transformers.js's own internal `filename` exactly (see hub.js's
// `getModelFile(path_or_repo_id, filename, ...)`); it only needs to be
// stable per URL so the hooks' own totals/loaded maps (keyed by this
// string) don't confuse two different files together.
function shortFileNameFromUrl(url: string): string {
  try {
    const { pathname } = new URL(url);
    const match = /\/resolve\/[^/]+\/(.+)$/.exec(pathname);
    if (match) return decodeURIComponent(match[1]);
    const segments = pathname.split("/").filter(Boolean);
    return decodeURIComponent(segments[segments.length - 1] ?? url);
  } catch {
    return url;
  }
}

type DownloadProgress = { file: string; loaded: number; total: number };
const progressListeners = new Set<(p: DownloadProgress) => void>();

/** Lets ai-chat.ts/ai-model.ts observe real download progress from *this*
 * file's own byte-transfer mechanisms (manual chunk fetches, or a
 * Background Fetch's native progress event) — distinct from, and in
 * addition to, transformers.js's own progress_callback, which only starts
 * reporting once it begins reading the (by-then fully-assembled) Response
 * this file hands back. Without this, the existing "Downloading… X%" UI
 * sat at 0% for the entire real download, then jumped straight to 100% —
 * a real, previously-unnoticed gap, not something this app's own tests had
 * caught (they only checked the final byte-identical result, not the live
 * percentage). Returns an unsubscribe function. */
export function subscribeDownloadProgress(cb: (p: DownloadProgress) => void): () => void {
  progressListeners.add(cb);
  return () => progressListeners.delete(cb);
}

function notifyProgress(url: string, loaded: number, total: number): void {
  if (progressListeners.size === 0) return;
  const file = shortFileNameFromUrl(url);
  for (const cb of progressListeners) cb({ file, loaded, total });
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

/** Builds a real Response by reading stored chunks for `url` back in
 * `chunkIndex` order, whatever their actual sizes — deliberately not
 * assuming uniform `CHUNK_SIZE` pieces, since a Background-Fetch-completed
 * download is persisted as a single whole-file chunk (WHOLE_FILE_CHUNK_INDEX),
 * while a manually-chunked download has many `CHUNK_SIZE`-sized pieces. If a
 * whole-file chunk exists, it's streamed *alone* — any other rows for the
 * same URL are ignored rather than concatenated with it, since those can
 * only be manual chunking's own partial slices of the very same file (see
 * WHOLE_FILE_CHUNK_INDEX's own comment on why both can legitimately exist at
 * once). Verifies the assembled byte length matches `totalBytes` exactly
 * before closing — a mismatch means the two download mechanisms raced
 * despite the disjoint-index defense (or a previous corrupted attempt left
 * bad data behind), and is reported as a DownloadIntegrityError with the
 * corrupted rows cleared, rather than silently handing transformers.js a
 * broken buffer. Deletes the chunk/meta/status scratch space once the
 * stream is fully and correctly consumed — it's only ever needed to survive
 * an interruption *during* the download, not afterward (the completed file
 * goes on to transformers.js's own Cache Storage write, unaffected by
 * anything here). */
async function streamStoredChunks(
  url: string,
  totalBytes: number,
  contentType: string | null,
): Promise<Response> {
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let streamedBytes = 0;
      try {
        const allChunks = await deviceDb.partialDownloadChunks
          .where("url")
          .equals(url)
          .sortBy("chunkIndex");
        if (allChunks.length === 0) {
          controller.error(new Error(`No stored chunks found for ${url}`));
          return;
        }
        const wholeFileChunk = allChunks.find((c) => c.chunkIndex === WHOLE_FILE_CHUNK_INDEX);
        const chunksToStream = wholeFileChunk ? [wholeFileChunk] : allChunks;
        for (const chunk of chunksToStream) {
          const buf = await chunk.data.arrayBuffer();
          streamedBytes += buf.byteLength;
          controller.enqueue(new Uint8Array(buf));
        }
        if (streamedBytes !== totalBytes) {
          await clearStoredDownload(url);
          controller.error(
            new DownloadIntegrityError(
              `The downloaded file for ${shortFileNameFromUrl(url)} doesn't match its expected size ` +
                `(expected ${totalBytes} bytes, got ${streamedBytes}) — this can happen when a ` +
                `background download and a manual download of the same file overlap. The saved ` +
                `partial download has been cleared so the next attempt starts clean.`,
            ),
          );
          return;
        }
        controller.close();
      } catch (err) {
        controller.error(err);
        return;
      }
      // Reached only once every chunk was successfully enqueued and the
      // integrity check passed — a failure here (e.g. the tab closing
      // right as this runs) just leaves it for the *next* attempt to find
      // already-complete and clean up itself — self-healing, not a
      // correctness problem.
      await clearStoredDownload(url);
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

/** Fetches every not-yet-received `CHUNK_SIZE` piece of `url` via HTTP
 * Range, resuming from whatever's already durably stored in IndexedDB from
 * a previous, interrupted attempt, then reassembles the full Response. */
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
    const receivedBytes = Math.min(totalBytes, (i + 1) * CHUNK_SIZE);
    await deviceDb.partialDownloadMeta.update(url, {
      receivedBytes,
      updatedAt: Date.now(),
    });
    notifyProgress(url, receivedBytes, totalBytes);
  }

  return streamStoredChunks(url, totalBytes, contentType);
}

function backgroundFetchSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    "serviceWorker" in navigator &&
    typeof self !== "undefined" &&
    "BackgroundFetchManager" in self
  );
}

async function backgroundFetchIdForUrl(url: string): Promise<string> {
  // Stable per-URL id — lets a later call find and reuse an already-active
  // registration (registration.backgroundFetch.get(id)) instead of throwing
  // "InvalidStateError" trying to register a duplicate for the same file.
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(url));
  const hex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${BACKGROUND_FETCH_ID_PREFIX}-${hex.slice(0, 32)}`;
}

/** Resolves once `public/sw.js`'s backgroundfetchsuccess/backgroundfetchfail
 * handler has written a definitive outcome for `url` into IndexedDB —
 * this is the one signal usable regardless of whether the tab that
 * registered the fetch is still open (a page-side event on the
 * BackgroundFetchRegistration object itself isn't a reliable substitute:
 * if this exact tab closes, there's nothing left here to receive it, and a
 * *freshly opened* tab later has no live reference to that original
 * registration object at all — only the service worker's own event
 * handlers are guaranteed to run in every case). */
function waitForBackgroundFetchOutcome(url: string): Promise<"success" | "failure"> {
  return new Promise((resolve, reject) => {
    const sub = liveQuery(async () => ({
      meta: await deviceDb.partialDownloadMeta.get(url),
      status: await deviceDb.backgroundFetchStatus.get(url),
    })).subscribe({
      next: ({ meta, status }) => {
        if (meta && meta.totalBytes > 0 && meta.receivedBytes >= meta.totalBytes) {
          sub.unsubscribe();
          resolve("success");
        } else if (status?.state === "failure") {
          sub.unsubscribe();
          resolve("failure");
        }
      },
      error: (err) => {
        sub.unsubscribe();
        reject(err);
      },
    });
  });
}

// Safety net for a registration that never actually starts moving bytes —
// observed directly while building this: in at least one real Chromium
// build, `backgroundFetch.fetch()` can resolve (or the registration can sit
// at `downloaded: 0`) indefinitely with no progress and no
// success/fail/abort event ever firing, for reasons this app has no
// visibility into (sandboxed/automated environments in particular — see
// DEV_LOG.md's own honest note on what could and couldn't be verified
// here). Rather than hang forever, treat "zero bytes moved after this long"
// as stuck and fall back to manual chunking — a real, still-progressing
// multi-hundred-MB download is never affected by this, since it only ever
// fires while *zero* progress has been observed since the attempt began.
const BACKGROUND_FETCH_STALL_TIMEOUT_MS = 20_000;

/** Hands `url` off to the browser's own Background Fetch manager instead of
 * fetching it directly — unlike manual chunking, this keeps running (via
 * the service worker) even if every tab of this app closes, or the app is
 * fully quit on platforms that support it. Returns `null` (never throws) if
 * unsupported, stuck, or if anything about it fails, so the caller always
 * has a clean fallback to manual chunking. */
async function downloadViaBackgroundFetch(
  url: string,
  totalBytes: number,
  contentType: string | null,
): Promise<Response | null> {
  if (!backgroundFetchSupported()) return null;

  let sawProgress = false;
  let abandoned = false;
  // Set as soon as the registration exists, so the stall timeout below can
  // actually stop the real, browser-owned fetch instead of merely stopping
  // *this code* from waiting on it — without this, an "abandoned" fetch
  // used to keep running for real and could later succeed and race a
  // concurrent manual-chunking attempt for the same URL (see
  // WHOLE_FILE_CHUNK_INDEX's own comment for what that race corrupted).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let activeRegistration: any = null;

  const stallTimeout = new Promise<null>((resolve) => {
    setTimeout(() => {
      if (!sawProgress) {
        abandoned = true;
        console.error(
          `Background fetch for ${url} showed no progress within ${BACKGROUND_FETCH_STALL_TIMEOUT_MS}ms, falling back to direct chunking`,
        );
        // Best-effort, not awaited — the caller shouldn't wait any longer
        // than it already has. `.abort()` is a real, spec'd
        // BackgroundFetchRegistration method (Promise<boolean>, resolves
        // `false`/never throws if the fetch already finished), so this is
        // always safe to call even if the registration settled moments
        // ago. The disjoint chunk-index defense (WHOLE_FILE_CHUNK_INDEX)
        // and streamStoredChunks' integrity check are the real backstop if
        // this doesn't win the race in time.
        activeRegistration?.abort?.().catch((err: unknown) => {
          console.error(`Failed to abort abandoned background fetch for ${url}`, err);
        });
        resolve(null);
      }
    }, BACKGROUND_FETCH_STALL_TIMEOUT_MS);
  });

  const attempt = (async (): Promise<Response | null> => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const bgManager = (
        registration as ServiceWorkerRegistration & {
          backgroundFetch?: {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            get: (id: string) => Promise<any>;
            fetch: (
              id: string,
              requests: (string | Request)[],
              options?: Record<string, unknown>,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ) => Promise<any>;
          };
        }
      ).backgroundFetch;
      if (!bgManager) return null;

      const id = await backgroundFetchIdForUrl(url);
      let bgFetch = await bgManager.get(id);
      if (!bgFetch) {
        bgFetch = await bgManager.fetch(id, [url], {
          title: "Downloading eLearn's on-device AI model",
          icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }],
          downloadTotal: totalBytes,
        });
      }
      activeRegistration = bgFetch;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (bgFetch as any).addEventListener?.("progress", () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const bg = bgFetch as any;
        if (typeof bg.downloaded === "number" && bg.downloadTotal > 0) {
          if (bg.downloaded > 0) sawProgress = true;
          notifyProgress(url, bg.downloaded, bg.downloadTotal);
        }
      });

      const outcome = await waitForBackgroundFetchOutcome(url);
      if (abandoned) {
        // The stall timeout already told the caller to fall back to manual
        // chunking — don't also consume the stored chunks here, or the two
        // paths could race reading/deleting the same IndexedDB rows.
        // Whatever data this attempt did persist stays put for the next
        // resumableFetch call (or the manual path already in flight) to
        // find and reuse.
        return null;
      }
      if (outcome === "failure") {
        throw new Error(`Background fetch failed for ${url}`);
      }
      const meta = await deviceDb.partialDownloadMeta.get(url);
      if (!meta) {
        throw new Error(`Background fetch reported success but no data was persisted for ${url}`);
      }
      notifyProgress(url, meta.totalBytes, meta.totalBytes);
      return await streamStoredChunks(url, meta.totalBytes, meta.contentType);
    } catch (err) {
      console.error(
        `Background fetch unavailable/failed for ${url}, falling back to direct chunking`,
        err,
      );
      return null;
    }
  })();

  return Promise.race([attempt, stallTimeout]);
}

/** The `env.fetch` override itself — see installResumableDownloads below
 * for where this gets installed. Falls back to a single plain fetch
 * whenever resumability genuinely isn't possible (the server ignores
 * `Range`, or anything about the chunking/IndexedDB/Background-Fetch
 * machinery itself throws unexpectedly) rather than ever failing a download
 * that a plain `fetch` would have succeeded at — this is a pure reliability
 * addition, never a new way to fail. */
export async function resumableFetch(input: string | URL, init?: RequestInit): Promise<Response> {
  const url = typeof input === "string" ? input : input.toString();

  try {
    const existingMeta = await deviceDb.partialDownloadMeta.get(url);
    if (existingMeta) {
      if (existingMeta.receivedBytes >= existingMeta.totalBytes) {
        notifyProgress(url, existingMeta.totalBytes, existingMeta.totalBytes);
        return await streamStoredChunks(url, existingMeta.totalBytes, existingMeta.contentType);
      }
      // Partial progress already exists from a prior manual-chunking
      // attempt (Background Fetch never leaves a partial row — it's either
      // absent or fully complete, see downloadViaBackgroundFetch/sw.js) —
      // resume it the same way.
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

    // Prefer Background Fetch for files large enough to be worth it — it
    // keeps running independent of this tab, which manual chunking cannot
    // do. The probe response above is discarded in this branch (its body
    // is never read) since Background Fetch performs its own, independent
    // whole-file request.
    if (totalBytes >= BACKGROUND_FETCH_MIN_BYTES) {
      const bgResult = await downloadViaBackgroundFetch(url, totalBytes, contentType);
      if (bgResult) return bgResult;
    }

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
    notifyProgress(url, firstChunk.byteLength, totalBytes);

    return await downloadResumable(url, new Headers(init?.headers), totalBytes, contentType);
  } catch (err) {
    console.error(`Resumable download failed for ${url}, falling back to a plain fetch`, err);
    return fetch(input, init);
  }
}

// Shared, single-source-of-truth copy for the download-in-progress UI.
// Deliberately doesn't overclaim: the "keeps going" guarantee only actually
// holds where Background Fetch is supported (Chromium desktop and Android
// Chrome) — everywhere else (Firefox, Safari/iOS, older Chrome), closing
// every tab pauses the download, but reopening resumes from the last
// completed chunk rather than starting over, which is still real progress
// over the previous "restarts from zero" behavior.
export const DOWNLOAD_RESILIENCE_NOTE =
  "You can switch apps, lock the screen, or close this tab — on most Chrome-based browsers the download keeps going in the background and finishes on its own. Elsewhere, it picks up right where it left off next time you open the app instead of starting over.";

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
