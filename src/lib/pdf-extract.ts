// Real client-side PDF text extraction via pdf.js (FR22-26) — runs
// entirely in the browser, no server involved, consistent with this app's
// on-device-first architecture (matches how the AI model in
// src/lib/ai-model.ts works). pdfjs-dist is only ever dynamically
// imported, never at module top-level, so it stays out of the SSR bundle.

import { resplitGluedWords } from "@/lib/word-resplit";
import { ocrPage, terminateOcrWorker } from "@/lib/pdf-ocr";

export type ExtractProgress = {
  page: number;
  totalPages: number;
  // Which pass this page is on — surfaced so the UI can say "OCR" instead
  // of a plain page count while a scanned page is being recognized, since
  // that pass is genuinely much slower than reading a real text layer and
  // a student watching a stalled-looking progress bar deserves to know why.
  stage?: "reading" | "ocr";
};

export type ExtractResult = {
  text: string;
  pageCount: number;
};

export type PdfExtractionReason = "password" | "invalid" | "empty" | "unknown";

export class PdfExtractionError extends Error {
  reason: PdfExtractionReason;
  constructor(message: string, reason: PdfExtractionReason) {
    super(message);
    this.name = "PdfExtractionError";
    this.reason = reason;
  }
}

type RawLine = {
  y: number;
  // Left edge of the line's first fragment — the indentation signal below
  // needs this, separately from the line's text content.
  x: number;
  // Right edge of the last fragment appended so far — see the word-gap
  // check where fragments are merged, below.
  endX: number;
  text: string;
  // Max glyph height among the line's fragments — a proxy for font size,
  // since pdf.js doesn't expose one directly. Used to tell a heading from
  // body text.
  size: number;
  // Best-effort: true if any fragment's font name looks bold (e.g.
  // "Helvetica-Bold"). PDFs don't reliably expose a numeric font weight
  // through pdf.js, so this is a heuristic on the font's name, same
  // honesty-about-limits precedent as the rest of this file.
  bold: boolean;
  // Per-cell text and each cell's left edge, split wherever a fragment gap
  // is wide enough to look like column padding rather than an ordinary
  // word space (see CELL_GAP_RATIO). An ordinary prose line just ends up
  // with a single cell equal to the whole line — every consumer that only
  // cares about the flat line text still reads `text` as before; only
  // detectTableRows (see below) looks at these.
  cells: string[];
  cellX: number[];
};

type LineKind = "heading" | "subheading" | "bullet" | "body" | "table-row";

const BULLET_PATTERN = /^[•●▪◦‣∙·-]\s+|^\*\s+/;
const NUMBERED_PATTERN = /^(\d+[.)]|[a-zA-Z][.)]|\([a-zA-Z0-9]+\))\s+/;
// A list item is indented at least this many PDF units further right than
// the document's body-text left margin. Found empirically to matter: many
// real PDFs (anything from a browser's print-to-PDF, in particular) render
// a list's bullet/number as a pure vector glyph via CSS ::marker, which
// getTextContent() never sees at all — so indentation is often the *only*
// signal a list item leaves in the text layer, not a fallback for when the
// character-based patterns above miss.
const LIST_INDENT_THRESHOLD = 15;

// A gap this many times the line's own font size, between two fragments
// pdf.js reports on the same visual line, reads as column padding rather
// than an ordinary inter-word space — a normal space between words is
// typically well under 1x the font size, while a table's column padding is
// usually several character-widths. Conservative on purpose: a false
// positive here just means an ordinary sentence with unusually wide
// spacing gets treated as a possible table-row candidate, which
// detectTableRows' further alignment-across-rows check will almost always
// reject anyway (see MIN_TABLE_ROWS).
const CELL_GAP_RATIO = 2.5;

// A confirmed table needs at least this many consecutive rows with the same
// cell count *and* matching column x-positions — one or two coincidentally
// wide-spaced lines (e.g. a heading followed by a byline) shouldn't be
// mistaken for a table.
const MIN_TABLE_ROWS = 3;

// How far apart (in PDF units) two rows' same-column cell can start and
// still count as "the same column" — real tables are rarely pixel-perfect
// aligned across every row (proportional fonts, right-aligned numbers).
const CELL_X_TOLERANCE = 8;

/** Finds runs of >= MIN_TABLE_ROWS consecutive lines that look like table
 * rows: the same number of cells, each cell's left edge aligned with the
 * same column across the whole run. Everything outside a confirmed run —
 * including a near-miss shorter than MIN_TABLE_ROWS — is left as an
 * ordinary line for classifyLine to handle as before; this only ever adds
 * a new classification, never removes the existing fallback. */
function detectTableRows(lines: RawLine[]): boolean[] {
  const isTableRow = new Array(lines.length).fill(false);
  let runStart = -1;
  let columnX: number[] = [];

  const closeRun = (end: number) => {
    if (runStart >= 0 && end - runStart >= MIN_TABLE_ROWS) {
      for (let i = runStart; i < end; i++) isTableRow[i] = true;
    }
    runStart = -1;
    columnX = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const matchesRun =
      runStart >= 0 &&
      line.cells.length === columnX.length &&
      line.cellX.every((x, col) => Math.abs(x - columnX[col]) <= CELL_X_TOLERANCE);

    if (matchesRun) continue;

    closeRun(i);
    if (line.cells.length >= 2) {
      runStart = i;
      columnX = line.cellX;
    }
  }
  closeRun(lines.length);
  return isTableRow;
}

// A literal "|" inside a real cell's text would otherwise be read as a
// column separator once rendered as GFM — rare in ordinary PDF content, but
// cheap to guard against.
function escapeTableCell(text: string): string {
  return text.trim().replace(/\|/g, "\\|");
}

/** Classifies one line relative to the document's own body-text size and
 * left margin — "heading" or "indented" is meaningless in isolation (a
 * size or offset that's huge in one PDF is ordinary in another with a
 * larger base font or margin), so every threshold here is a ratio/delta
 * against the document's own `bodySize`/`bodyX`, not an absolute value. */
function classifyLine(line: RawLine, bodySize: number, bodyX: number): LineKind {
  const ratio = bodySize > 0 ? line.size / bodySize : 1;
  if (ratio >= 1.4) return "heading";
  if (ratio >= 1.15 || (line.bold && ratio >= 0.95)) return "subheading";
  if (BULLET_PATTERN.test(line.text) || NUMBERED_PATTERN.test(line.text)) return "bullet";
  if (ratio >= 0.85 && ratio <= 1.15 && line.x - bodyX >= LIST_INDENT_THRESHOLD) return "bullet";
  return "body";
}

function stripBulletPrefix(text: string): string {
  return text.replace(BULLET_PATTERN, "").replace(NUMBERED_PATTERN, "").trim();
}

// A line ending in a hyphen right after a lowercase letter is almost
// always a word-wrap break the PDF's own justification inserted (e.g.
// "under-" / "standing" across two lines), not a real hyphenated compound
// sitting at a line boundary — real compounds are comparatively rare and
// this is the same heuristic most PDF text extractors use for this.
const HYPHEN_WRAP = /\p{Ll}-$/u;

/** Joins a paragraph's wrapped lines back into flowing text, undoing
 * word-wrap hyphenation so extracted text reads as real words instead of
 * "under- standing". */
function joinParagraphLines(lines: string[]): string {
  let result = "";
  for (const line of lines) {
    if (result && HYPHEN_WRAP.test(result) && /^\p{Ll}/u.test(line)) {
      result = result.slice(0, -1) + line;
    } else if (result) {
      result += " " + line;
    } else {
      result = line;
    }
  }
  return result;
}

/** Turns classified lines into lightweight Markdown — headings as `#`/`##`,
 * list items as `-`, and consecutive body lines merged into paragraph
 * blocks (pdf.js gives one fragment-cluster per visual line, not per
 * paragraph, so wrapped lines of the same paragraph would otherwise stay
 * awkwardly split). Deliberately plain Markdown rather than a custom
 * format: every downstream consumer (summarizer, future quiz generation,
 * a future rendered view) can treat structure as a bonus without needing
 * to understand a bespoke schema — plain text readers just see the raw
 * `#`/`-` characters, which still reads fine unrendered. */
function formatStructuredText(lines: { kind: LineKind; text: string; cells?: string[] }[]): string {
  const blocks: string[] = [];
  let paragraphBuffer: string[] = [];
  let tableBuffer: string[][] = [];

  const flushParagraph = () => {
    if (paragraphBuffer.length > 0) {
      blocks.push(joinParagraphLines(paragraphBuffer));
      paragraphBuffer = [];
    }
  };

  // GFM requires a header row + separator even though pdf.js gives no real
  // signal about which row (if any) was actually a header — treating the
  // table-run's first row as the header is a reasonable default (most real
  // tables do have one), not a claim this file can actually verify.
  const flushTable = () => {
    if (tableBuffer.length === 0) return;
    const [header, ...rest] = tableBuffer;
    const separator = header.map(() => "---");
    const rows = [header, separator, ...rest];
    blocks.push(rows.map((row) => `| ${row.join(" | ")} |`).join("\n"));
    tableBuffer = [];
  };

  for (const line of lines) {
    if (!line.text.trim()) continue;
    if (line.kind === "table-row" && line.cells) {
      flushParagraph();
      tableBuffer.push(line.cells.map(escapeTableCell));
      continue;
    }
    flushTable();
    switch (line.kind) {
      case "heading":
        flushParagraph();
        blocks.push(`# ${line.text.trim()}`);
        break;
      case "subheading":
        flushParagraph();
        blocks.push(`## ${line.text.trim()}`);
        break;
      case "bullet":
        flushParagraph();
        blocks.push(`- ${stripBulletPrefix(line.text)}`);
        break;
      case "body":
        paragraphBuffer.push(line.text.trim());
        break;
    }
  }
  flushParagraph();
  flushTable();
  return blocks.join("\n\n");
}

// Tesseract's raw recognized text is one line per detected text line, with
// (inconsistently) blank lines between paragraphs depending on scan
// quality — reflowed into the same blank-line-separated block shape the
// rest of this file uses, so downstream consumers (StructuredText,
// retrieval.ts's chunker, structured-export.ts) don't need a separate code
// path for OCR'd content. OCR has no reliable per-line font-size signal the
// way real text-layer fragments do, so this never attempts heading/bullet
// classification — plain paragraphs are the honest result here, not a
// lesser version of the same structure detection.
function formatOcrText(raw: string): string {
  return raw
    .split(/\n\s*\n/)
    .map((block) => block.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean)
    .join("\n\n");
}

/** Extracts real text from a real PDF file, page by page, with real
 * progress (FR26) — not a fake timer. Reconstructs document structure
 * (FR24) — headings, subheadings, bullet/numbered lists, tables, and
 * paragraphs — by clustering pdf.js's positioned text fragments into
 * lines, then classifying each line's role from its font size and column
 * alignment relative to the document's own body-text size (see
 * classifyLine, detectTableRows). pdf.js only exposes positioned fragments
 * with no semantic markup at all, so this is a genuine best-effort
 * reconstruction, not a fake pass-through — a PDF with unusually uniform
 * styling will fall back to being read as plain paragraphs, which is still
 * correct, just less structured. A page with no text layer at all (a
 * scanned/photographed page) falls back to OCR (see pdf-ocr.ts) rather
 * than failing outright — the one case this file used to have no answer
 * for. Classifies real failure modes (FR23) instead of a generic error:
 * password-protected, not a valid PDF, or a document where even OCR found
 * no readable text at all. */
export async function extractPdfText(
  file: File,
  onProgress?: (p: ExtractProgress) => void,
): Promise<ExtractResult> {
  const pdfjsLib = await import("pdfjs-dist");
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

  const arrayBuffer = await file.arrayBuffer();
  let doc;
  try {
    doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  } catch (err) {
    const name = err instanceof Error ? err.name : "";
    if (name === "PasswordException") {
      throw new PdfExtractionError("This PDF is password-protected.", "password");
    }
    if (name === "InvalidPDFException") {
      throw new PdfExtractionError("This file doesn't look like a valid PDF.", "invalid");
    }
    throw new PdfExtractionError("Couldn't open this PDF.", "unknown");
  }

  const pageLines: RawLine[][] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const lines: RawLine[] = [];
    for (const item of content.items) {
      if (!("str" in item) || !item.str.trim()) continue;
      const y = Math.round(item.transform[5]);
      const x = Math.round(item.transform[4]);
      const width = "width" in item && item.width > 0 ? item.width : 0;
      const size = "height" in item && item.height > 0 ? item.height : Math.abs(item.transform[3]);
      const fontStyle = "fontName" in item ? content.styles[item.fontName] : undefined;
      const bold = /bold/i.test(fontStyle?.fontFamily ?? "");
      const existing = lines.find((l) => Math.abs(l.y - y) < 3);
      if (existing) {
        // pdf.js sometimes splits one visual word across separate text
        // runs (a style/font change, a hyperlink) with no space character
        // in either run — concatenating them as-is glues two real words
        // together ("wordmore" instead of "word more"). A real horizontal
        // gap between consecutive fragments on the same line is the
        // standard signal a word boundary was there even without a space
        // character to prove it.
        const gap = x - existing.endX;
        // A gap this wide reads as column padding, not a word space (see
        // CELL_GAP_RATIO) — starts a new cell for the table-detection pass
        // below, independent of the plain-text space decision right after.
        const isCellBoundary = gap > existing.size * CELL_GAP_RATIO;
        const needsSpace =
          !isCellBoundary &&
          gap > existing.size * 0.15 &&
          !existing.text.endsWith(" ") &&
          !item.str.startsWith(" ");
        existing.text += (needsSpace || isCellBoundary ? " " : "") + item.str;
        if (isCellBoundary) {
          existing.cells.push(item.str);
          existing.cellX.push(x);
        } else {
          existing.cells[existing.cells.length - 1] += item.str;
        }
        existing.size = Math.max(existing.size, size);
        existing.bold = existing.bold || bold;
        existing.x = Math.min(existing.x, x);
        existing.endX = Math.max(existing.endX, x + width);
      } else {
        lines.push({
          y,
          x,
          endX: x + width,
          text: item.str,
          size,
          bold,
          cells: [item.str],
          cellX: [x],
        });
      }
    }
    // pdf.js's y-axis grows upward (origin bottom-left), so the first
    // line on the page has the largest y.
    lines.sort((a, b) => b.y - a.y);
    pageLines.push(lines);
    onProgress?.({ page: i, totalPages: doc.numPages, stage: "reading" });
  }

  // OCR only ever runs when *every* page came back with no text-layer
  // fragments at all — a real scanned/photographed document, the "may be
  // scanned" case this file used to just fail outright on. Deliberately
  // not triggered by a handful of empty pages in an otherwise-real
  // born-digital document (a decorative cover page, a blank divider) —
  // real testing against TestDoc/CORRECT NATIS QUESTIONS_010313.pdf found
  // exactly that case: one image-only cover page in an otherwise perfectly
  // extractable 123-page document. OCR-ing just that cover cost ~70s (WASM
  // engine + language-data download, not compute) for a garbage result,
  // since a decorative cover isn't real scanned prose to begin with —
  // strictly worse than the old behavior of just leaving that one page
  // blank. An ordinary born-digital PDF's pageLines are never all empty,
  // so this whole block is a no-op for the overwhelming majority of
  // uploads.
  const emptyPageNumbers = pageLines
    .map((lines, idx) => (lines.length === 0 ? idx + 1 : -1))
    .filter((n) => n > 0);
  const isFullyScanned = emptyPageNumbers.length === pageLines.length;

  const ocrTexts = new Map<number, string>();
  if (isFullyScanned) {
    try {
      for (const pageNumber of emptyPageNumbers) {
        onProgress?.({ page: pageNumber, totalPages: doc.numPages, stage: "ocr" });
        try {
          const page = await doc.getPage(pageNumber);
          const text = await ocrPage(page);
          if (text) ocrTexts.set(pageNumber, text);
        } catch (err) {
          // One page's OCR failing (a corrupt render, an engine hiccup, no
          // network on the very first-ever OCR attempt before the language
          // data is cached) shouldn't abort the rest of the document — it
          // just stays empty, the same best-effort-degrade precedent as
          // every other fallback in this file.
          console.error(`OCR failed for page ${pageNumber}`, err);
        }
      }
    } finally {
      await terminateOcrWorker();
    }
  }

  // The document's own body-text size, not an absolute constant — the most
  // frequent rounded font size across every line, weighted by character
  // count so a title page's one big line doesn't outvote the actual body.
  const sizeVotes = new Map<number, number>();
  for (const lines of pageLines) {
    for (const line of lines) {
      const bucket = Math.round(line.size);
      sizeVotes.set(bucket, (sizeVotes.get(bucket) ?? 0) + line.text.length);
    }
  }
  let bodySize = 0;
  let bestSizeVotes = -1;
  for (const [size, votes] of sizeVotes) {
    if (votes > bestSizeVotes) {
      bestSizeVotes = votes;
      bodySize = size;
    }
  }

  // The document's own left margin for body-sized text specifically — a
  // title page's centered heading shouldn't pull this toward the middle of
  // the page, so only lines already close to bodySize vote here.
  const xVotes = new Map<number, number>();
  for (const lines of pageLines) {
    for (const line of lines) {
      if (bodySize > 0 && Math.abs(line.size - bodySize) / bodySize > 0.15) continue;
      xVotes.set(line.x, (xVotes.get(line.x) ?? 0) + line.text.length);
    }
  }
  let bodyX = 0;
  let bestXVotes = -1;
  for (const [x, votes] of xVotes) {
    if (votes > bestXVotes) {
      bestXVotes = votes;
      bodyX = x;
    }
  }

  const pageTexts = pageLines.map((lines, idx) => {
    const ocrText = ocrTexts.get(idx + 1);
    if (ocrText !== undefined) return formatOcrText(ocrText);
    const tableFlags = detectTableRows(lines);
    return formatStructuredText(
      lines.map((line, i) =>
        tableFlags[i]
          ? { kind: "table-row" as const, text: line.text, cells: line.cells }
          : { kind: classifyLine(line, bodySize, bodyX), text: line.text },
      ),
    );
  });

  const joined = pageTexts.join("\n\n").trim();
  // See word-resplit.ts: some PDF generators encode certain lines' word
  // gaps in a way pdf.js's own (non-optional) space heuristic misjudges,
  // handing back whole phrases already fused with no space at all — a
  // different failure mode from the inter-fragment gaps merged above, and
  // one this last pass specifically targets.
  const text = await resplitGluedWords(joined);
  if (!text) {
    throw new PdfExtractionError(
      isFullyScanned
        ? "No text could be read from this PDF, even with OCR — the scan may be too unclear, or these pages may genuinely be blank."
        : "No text could be extracted — this PDF may be scanned images rather than real text.",
      "empty",
    );
  }
  return { text, pageCount: doc.numPages };
}
