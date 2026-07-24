// OCR fallback for scanned/image-only PDF pages — the one real gap
// pdf-extract.ts previously had no answer for (a page with no text layer at
// all just failed outright with a "may be scanned" error). Runs entirely in
// the browser via tesseract.js (WASM, Apache-2.0 licensed), only ever
// invoked by pdf-extract.ts for a page whose real text layer came back
// empty — an ordinary born-digital PDF never pays this cost.
//
// The worker/core engine files are self-hosted under public/tesseract/
// (copied from node_modules/tesseract.js + tesseract.js-core at the time
// this was built) rather than left on tesseract.js's own CDN defaults — a
// CDN-hosted engine would bypass this app's own service worker cache-first
// strategy (public/sw.js only intercepts same-origin requests), so
// self-hosting is what actually makes OCR usable offline after the first
// successful run. `corePath` is passed as a specific file
// (tesseract-core-simd-lstm.wasm.js) rather than a directory, skipping
// tesseract.js's own SIMD/relaxed-SIMD feature detection entirely — this
// app already assumes a browser modern enough to run its existing
// Transformers.js on-device models, which need at least the same WASM SIMD
// support, so shipping only the SIMD build (and not also the ~6MB of
// non-SIMD/relaxed-SIMD variants) is a deliberate size tradeoff, not an
// oversight.
//
// The English *language* data (a separate, several-MB file, distinct from
// the engine above) is deliberately left on tesseract.js's own default CDN
// rather than bundled into this repo — tesseract.js already caches it in
// IndexedDB internally the first time it's fetched (see its own
// worker-script/browser/cache.js, backed by idb-keyval), so it only ever
// costs real network once, the same shape as the on-device AI models in
// ai-model.ts, without this repo carrying an extra ~10MB binary asset.

import type { PDFPageProxy } from "pdfjs-dist";
import type { Worker as TesseractWorker } from "tesseract.js";

let workerPromise: Promise<TesseractWorker> | null = null;

async function getOcrWorker(): Promise<TesseractWorker> {
  if (!workerPromise) {
    workerPromise = import("tesseract.js").then(({ createWorker }) =>
      createWorker("eng", 1, {
        workerPath: "/tesseract/worker.min.js",
        corePath: "/tesseract/tesseract-core-simd-lstm.wasm.js",
      }),
    );
    // Mirrors ai-model.ts's own "don't cache a failed load" pattern — a
    // transient failure (e.g. offline on the very first-ever OCR attempt,
    // before the language data has ever been cached) shouldn't poison every
    // later attempt this session.
    workerPromise.catch(() => {
      workerPromise = null;
    });
  }
  return workerPromise;
}

/** Rasterizes one pdf.js page to a canvas and runs OCR on it, returning
 * plain, paragraph-separated text. OCR output has no reliable font-size
 * metadata the way real text-layer fragments do, so this deliberately
 * returns plain prose rather than pretending to detect headings/bullets it
 * can't actually see — an honest degrade, not a lesser version of the same
 * structure detection. Scale 2 trades some extra rasterization/recognition
 * time for materially better OCR accuracy on ordinary scanned lecture
 * material (photographed or flatbed-scanned pages are rarely high-DPI to
 * begin with). */
export async function ocrPage(page: PDFPageProxy): Promise<string> {
  const viewport = page.getViewport({ scale: 2 });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const canvasContext = canvas.getContext("2d");
  if (!canvasContext) return "";

  await page.render({ canvasContext, viewport, canvas }).promise;

  const worker = await getOcrWorker();
  const {
    data: { text },
  } = await worker.recognize(canvas);
  return text.trim();
}

/** Runs OCR directly on an uploaded image file (a photographed page,
 * scanned handout, etc.) — same shared worker as ocrPage above, just
 * handed the file's own bytes instead of a rasterized pdf.js page.
 * tesseract.js's `recognize` accepts a File/Blob natively, so no manual
 * canvas rendering step is needed here the way ocrPage's PDF-page source
 * requires. Same honest "plain prose, no heading/bullet structure"
 * degrade as ocrPage — OCR output has no font-size metadata to detect
 * structure from either way. */
export async function ocrImageFile(file: File): Promise<string> {
  const worker = await getOcrWorker();
  const {
    data: { text },
  } = await worker.recognize(file);
  return text.trim();
}

/** Releases the shared OCR worker. Call once after a whole document's
 * extraction is done (success or failure) so a WASM engine that isn't
 * needed again this session doesn't stay resident in memory — most
 * documents never trigger OCR at all, but the ones that do may be the
 * large 300+ page scans this app is explicitly meant to handle. */
export async function terminateOcrWorker(): Promise<void> {
  if (!workerPromise) return;
  const pending = workerPromise;
  workerPromise = null;
  const worker = await pending.catch(() => null);
  await worker?.terminate();
}
