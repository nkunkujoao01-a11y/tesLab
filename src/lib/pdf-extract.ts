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
  // Character counts backing a bold *proportion* for the line, not a
  // simple OR across fragments — a line whose first word or two is bold
  // (e.g. a lead-in term like "Client:") but whose remaining dozen words
  // are plain body text should not read as "this whole line is bold."
  // Bold itself is a best-effort heuristic on whether a fragment's font
  // name looks bold (e.g. "Helvetica-Bold") — PDFs don't reliably expose
  // a numeric font weight through pdf.js, same honesty-about-limits
  // precedent as the rest of this file.
  boldChars: number;
  charCount: number;
  // Character count per raw pdf.js font resource name on this line — backs
  // a fallback heading signal for documents where bold/size detection
  // above can't work at all. Found via real testing on a Google-Docs-
  // exported PDF (TestDoc/"1-Week5A PRS821 Domains of Security-S1.pdf"):
  // every font in the document resolves through pdf.js's `content.styles`
  // to a generic `fontFamily: "sans-serif"` with no weight information,
  // and its real headings ("Network Security", "Application Security")
  // render at the exact same point size as body text — so neither the
  // size-ratio nor the bold-name check has anything to key off, even
  // though the heading text visibly uses a distinct underlying font
  // resource (`g_d0_f3` vs body's `g_d0_f5`) that pdf.js just doesn't
  // expose as "bold". See bodyFontName/classifyLine below.
  fontChars: Record<string, number>;
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

// A real two-column page (found via real testing on TestDoc/"Git Cheat
// Sheet (2-column test).pdf", named for exactly this) extracts, before
// this, in whatever raw content-stream/y-position order the PDF encodes —
// not necessarily "read the left column top-to-bottom, then the right
// column," which is what a human actually does. A plain y-sort interleaves
// both columns' lines by absolute vertical position, reading as scrambled
// nonsense.
//
// Classification is by each line's *start* x only, not its full [x, endX]
// range — found the hard way via real testing: this document's topic boxes
// have genuinely varying widths, so plenty of legitimate single-column
// lines are simply long enough that their endX lands well past where the
// next column visually begins, even though the line unambiguously belongs
// to (starts in) one column. Requiring the whole line to stay clear of the
// gutter rejected the correct split entirely; requiring only where it
// *starts* to be clearly on one side is both simpler and matches how a
// human actually perceives which box a line belongs to. Still
// conservative in the ways that matter: only reorders when start-x values
// clearly cluster into two well-separated, well-populated groups roughly
// in the middle of the page — a single-column document's lines mostly
// share one left margin and never form two such clusters.
const COLUMN_MIN_GAP_RATIO = 0.06;
const COLUMN_MIN_SIDE_FRACTION = 0.25;
const COLUMN_MIN_LINE_COUNT = 8;

function findColumnGutter(lines: RawLine[]): number | null {
  if (lines.length < COLUMN_MIN_LINE_COUNT) return null;

  const minX = Math.min(...lines.map((l) => l.x));
  const maxX = Math.max(...lines.map((l) => l.x));
  const spanWidth = maxX - minX;
  if (spanWidth <= 0) return null;

  // Only consider a gutter roughly in the middle of the page — a gap near
  // either edge is just how many lines happen to start, not a column break.
  const bandStart = minX + spanWidth * 0.25;
  const bandEnd = minX + spanWidth * 0.75;

  const starts = [...new Set(lines.map((l) => l.x))].sort((a, b) => a - b);
  let bestGapWidth = 0;
  let bestSplit: number | null = null;

  for (let i = 0; i < starts.length - 1; i++) {
    const gapStart = starts[i];
    const gapEnd = starts[i + 1];
    const mid = (gapStart + gapEnd) / 2;
    if (mid < bandStart || mid > bandEnd) continue;

    const left = lines.filter((l) => l.x < mid).length;
    const right = lines.length - left;
    if (left / lines.length < COLUMN_MIN_SIDE_FRACTION) continue;
    if (right / lines.length < COLUMN_MIN_SIDE_FRACTION) continue;

    const gapWidth = gapEnd - gapStart;
    if (gapWidth > bestGapWidth) {
      bestGapWidth = gapWidth;
      bestSplit = mid;
    }
  }

  if (bestSplit === null || bestGapWidth < spanWidth * COLUMN_MIN_GAP_RATIO) return null;
  return bestSplit;
}

/** Reorders a page's lines to read the left column fully (top to bottom),
 * then the right column fully — see findColumnGutter for the detection
 * heuristic and its safety margins. */
function orderLinesForReading(lines: RawLine[]): RawLine[] {
  const gutter = findColumnGutter(lines);
  if (gutter === null) {
    return [...lines].sort((a, b) => b.y - a.y);
  }

  const left = lines.filter((l) => l.x < gutter).sort((a, b) => b.y - a.y);
  const right = lines.filter((l) => l.x >= gutter).sort((a, b) => b.y - a.y);
  return [...left, ...right];
}

const BULLET_PATTERN = /^[•●▪◦‣∙·-]\s+|^\*\s+/;
const NUMBERED_PATTERN = /^(\d+[.)]|[a-zA-Z][.)]|\([a-zA-Z0-9]+\))\s+/;
// A reference-list entry ("[24] S. Lujan..." or IEEE-style "[Abran 2010]
// Alain Abran...") starts with a bracketed marker — square brackets
// aren't matched by BULLET_PATTERN (bullet glyphs) or NUMBERED_PATTERN
// (`\d+[.)]`/parens only), so a dense reference list previously read as
// plain body text and got silently run-on joined by joinParagraphLines
// with no per-entry break. Matches any short bracketed marker, not just
// numeric — found via real testing on swecom.pdf, whose references use
// IEEE's author-year key style (`[Abran 2010]`, `[ACM 2004]`) exclusively,
// not bare numbers; the numeric-only version of this pattern never
// matched a single one of them, so the whole reference list (and its
// citation-dense prose) still fed straight into the neural summarizer as
// ordinary body text, producing degenerate/hallucinated output on real
// documents (see summarize-structured.ts's isPlainParagraph, which
// already excludes bullets from summarization once classified as such).
// The bracket-content length cap keeps this from matching a long
// bracketed aside that happens to open a line. Anchored to line start
// like every other pattern here, so an inline "as shown in [24]" citation
// mid-sentence is untouched.
const CITATION_MARKER_PATTERN = /^\[[^\]\n]{1,60}\]\s+/;
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

// A real heading essentially never ends in sentence-terminal punctuation
// — found via real testing on swecom.pdf, where several ordinary
// sentence tail-ends ("included in an appendix.", "...analogous elements
// of SWECOM.") were misclassified as headings/subheadings purely because
// a page-edge justification quirk made pdf.js report a slightly larger
// font size for that one line, and font-size ratio was previously the
// *only* signal used. Those went on to produce nonsense flashcard fronts
// downstream ("What does 'included in an appendix.' cover?"). A line
// ending in ":" is deliberately still allowed through (e.g. "References:"
// is a real heading-like label), only real sentence-final punctuation
// disqualifies it.
const SENTENCE_TERMINAL = /[.!?]['")\]]*$/;

// A real heading is short — every genuine heading in real test documents
// (this project's own TestDoc/ corpus included) runs a handful of words
// ("Software Systems Engineering Skill Area", "References"). Found via
// the same real testing as SENTENCE_TERMINAL above: even after excluding
// lines ending in sentence-terminal punctuation, plenty of ordinary
// paragraph continuation lines ("designer are provided. The SWECOM
// Staffing Gap Analysis and", 10 words) were still being read as
// headings — a justified paragraph's own line-wrap can coincidentally
// avoid ending in punctuation while clearly still being a sentence
// fragment, not a label. Word count catches what punctuation alone
// can't.
const MAX_HEADING_WORDS = 10;

// A line's bold *proportion* has to clear a real majority, not merely
// contain any bold fragment, before its size (just under the outright
// ratio>=1.15 subheading cutoff) is trusted as a bold-styled label —
// found via real testing on swecom.pdf's "Client: the requester of the
// process..." bold-lead-in sentences, where only the first word or two
// was actually bold. A genuinely bold short subheading reads as ~100%
// bold and clears this trivially; a sentence with a 1-2 word bold
// lead-in term fails it decisively.
const BOLD_MAJORITY_RATIO = 0.6;

/** Classifies one line relative to the document's own body-text size and
 * left margin — "heading" or "indented" is meaningless in isolation (a
 * size or offset that's huge in one PDF is ordinary in another with a
 * larger base font or margin), so every threshold here is a ratio/delta
 * against the document's own `bodySize`/`bodyX`, not an absolute value. */
function classifyLine(
  line: RawLine,
  bodySize: number,
  bodyX: number,
  bodyFontName: string,
): LineKind {
  const ratio = bodySize > 0 ? line.size / bodySize : 1;
  const boldRatio = line.charCount > 0 ? line.boldChars / line.charCount : 0;
  const trimmed = line.text.trim();
  const looksLikeHeadingText =
    /\p{L}/u.test(trimmed) &&
    !SENTENCE_TERMINAL.test(trimmed) &&
    trimmed.split(/\s+/).length <= MAX_HEADING_WORDS;
  const hasListMarker =
    BULLET_PATTERN.test(line.text) ||
    NUMBERED_PATTERN.test(line.text) ||
    CITATION_MARKER_PATTERN.test(line.text);
  // Fallback signal for documents (Google Docs PDF exports, real-world
  // example: TestDoc/"1-Week5A PRS821 Domains of Security-S1.pdf") where
  // every font resolves through pdf.js to the same generic family with no
  // weight info, so boldRatio can never be anything but 0 and a heading
  // never gets a size bump either — see RawLine.fontChars' own comment.
  // Only trusted at body-like size and never on a line that already has a
  // real list marker, so a numbered/citation/bullet line that happens to
  // use a differently-keyed font fragment still falls through to "bullet"
  // below rather than being misread as a heading. Reuses BOLD_MAJORITY_RATIO
  // rather than a stricter cutoff on purpose: a stricter ratio was tried
  // (real testing against TestDoc/"4-Week5D PRS821 Network Attacks-1of2.pdf",
  // whose scrambled reading order on one dense lettered list produces one
  // genuinely garbled heading either way) and made a *different* real
  // document worse — TestDoc/"2-Week5B PRS821 Database Security-S1.pdf"
  // dropped from 9 correctly-detected headings to 2. The known, accepted
  // cost of the looser ratio is that one garbled heading in 4-Week5D;
  // every other document across the full 25-file TestDoc/ corpus came out
  // clean or improved. Not a threshold worth re-chasing without a genuinely
  // different signal (e.g. per-page-scoped font-name reuse isn't reliable —
  // pdf.js's raw resource names like "g_d0_f2" aren't guaranteed consistent
  // across a multi-page document's separate content streams).
  const bodyFontChars = bodyFontName ? (line.fontChars[bodyFontName] ?? 0) : line.charCount;
  const offBodyFontRatio = line.charCount > 0 ? 1 - bodyFontChars / line.charCount : 0;
  const usesDistinctFont =
    !hasListMarker && ratio >= 0.95 && ratio <= 1.15 && offBodyFontRatio >= BOLD_MAJORITY_RATIO;
  if (ratio >= 1.4 && looksLikeHeadingText) return "heading";
  if (
    (ratio >= 1.15 || (boldRatio >= BOLD_MAJORITY_RATIO && ratio >= 0.95) || usesDistinctFont) &&
    looksLikeHeadingText
  )
    return "subheading";
  if (hasListMarker) return "bullet";
  if (ratio >= 0.85 && ratio <= 1.15 && line.x - bodyX >= LIST_INDENT_THRESHOLD) return "bullet";
  return "body";
}

function stripBulletPrefix(text: string): string {
  return text.replace(BULLET_PATTERN, "").replace(NUMBERED_PATTERN, "").trim();
}

// Real, observed bug (TestDoc/"1-Week5A PRS821 Domains of Security-S1.pdf"):
// a hanging-indent bullet list's own *wrapped continuation* line — e.g.
// "Firewalls – Hardware or software that monitors incoming and outgoing
// network" wrapping onto a second physical PDF line, "traffic and blocks
// threats" — is indented to line up with the bullet's *text*, not the
// bullet glyph, so it satisfies classifyLine's indentation-only bullet
// fallback (line.x - bodyX >= LIST_INDENT_THRESHOLD) exactly the same way a
// genuine new list item does. Every wrapped continuation line of a bullet
// like this was read as a brand new bullet instead, splitting one real
// bullet into two or more fragments. A line with an actual marker character
// (a real bullet glyph, a number, a citation bracket) is never ambiguous —
// only the indentation-alone fallback is — so only that case needs to
// check for an already-open, not-yet-complete bullet to continue instead
// of starting fresh.
function hasExplicitBulletMarker(text: string): boolean {
  return (
    BULLET_PATTERN.test(text) || NUMBERED_PATTERN.test(text) || CITATION_MARKER_PATTERN.test(text)
  );
}

// Found necessary via the same real testing as hasExplicitBulletMarker,
// against a different real document (swecom.pdf): a genuine sequence of
// short, independent, Title Case list items with no marker of their own
// ("Inductive Reasoning" / "Deductive Reasoning" / "Heuristic Reasoning",
// each its own real skill/competency, not a continued sentence) triggered
// the exact same indentation-only bullet fallback as a real wrapped
// continuation would — hasExplicitBulletMarker alone can't tell these two
// cases apart, since neither has a marker. The real, reliable difference:
// an actual sentence wrapping onto a new line continues mid-sentence, so
// its first word is never capitalized ("traffic and blocks threats" — the
// real bug this file's own history documents); a new, independent item
// starts its own sentence/phrase, capitalized, even with no marker glyph.
function looksLikeContinuationLine(text: string): boolean {
  return /^\p{Ll}/u.test(text.trim());
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
  // A heading/subheading that visually wraps across two physical PDF
  // lines (e.g. "High assurance software" / "architecture and design")
  // would otherwise become two separate blocks, one per raw line — this
  // buffers consecutive same-kind heading lines the same way
  // paragraphBuffer buffers body lines, only closing the buffer once the
  // accumulated text already looks like a complete line (ends in
  // sentence-terminal punctuation) or the next line is a different kind,
  // so an unrelated table-of-contents run of short headings doesn't get
  // wrongly glued into one.
  let headingBuffer: { kind: "heading" | "subheading"; lines: string[] } | null = null;
  // A list item's own text can wrap across multiple physical PDF lines too
  // (e.g. "Client: the requester of the processes either through a web
  // browser interface" / "or chat client, email client, etc.") — the
  // wrapped continuation classifies as plain "body" (it isn't itself
  // indented or bullet-marked), so without this buffer it would flush as
  // its own orphaned paragraph right after the bullet instead of
  // completing it. Same discipline as headingBuffer: keep absorbing
  // "body"-classified lines into the open bullet until its text-so-far
  // already looks like a complete sentence, or a non-"body" line arrives.
  let bulletBuffer: string[] | null = null;

  const flushParagraph = () => {
    if (paragraphBuffer.length > 0) {
      blocks.push(joinParagraphLines(paragraphBuffer));
      paragraphBuffer = [];
    }
  };

  const flushHeading = () => {
    if (headingBuffer) {
      const prefix = headingBuffer.kind === "heading" ? "# " : "## ";
      blocks.push(`${prefix}${joinParagraphLines(headingBuffer.lines)}`);
      headingBuffer = null;
    }
  };

  const flushBullet = () => {
    if (bulletBuffer) {
      blocks.push(`- ${joinParagraphLines(bulletBuffer)}`);
      bulletBuffer = null;
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
      flushHeading();
      flushBullet();
      tableBuffer.push(line.cells.map(escapeTableCell));
      continue;
    }
    flushTable();
    switch (line.kind) {
      case "heading":
      case "subheading": {
        flushParagraph();
        const trimmed = line.text.trim();
        if (headingBuffer && headingBuffer.kind === line.kind) {
          const bufferedSoFar = joinParagraphLines(headingBuffer.lines);
          if (!SENTENCE_TERMINAL.test(bufferedSoFar)) {
            headingBuffer.lines.push(trimmed);
            break;
          }
        }
        flushHeading();
        headingBuffer = { kind: line.kind, lines: [trimmed] };
        break;
      }
      case "bullet": {
        // A line classified "bullet" purely by indentation (no real marker
        // character) *and* starting lowercase — genuinely mid-sentence —
        // might be a wrapped continuation of the bullet already open, not
        // a new item. Both conditions matter: hasExplicitBulletMarker alone
        // isn't enough, since a real sequence of short, independent,
        // Title Case items with no marker of their own (found via swecom.pdf
        // real testing) would otherwise all get merged into one run-on
        // "bullet" — looksLikeContinuationLine's own comment has the full
        // reasoning for why capitalization is the reliable tell here. A
        // line with an explicit marker is never ambiguous either way; it
        // always starts a new item.
        if (
          !hasExplicitBulletMarker(line.text) &&
          looksLikeContinuationLine(line.text) &&
          bulletBuffer
        ) {
          const bufferedSoFar = joinParagraphLines(bulletBuffer);
          if (!SENTENCE_TERMINAL.test(bufferedSoFar)) {
            bulletBuffer.push(line.text.trim());
            break;
          }
        }
        flushParagraph();
        flushHeading();
        flushBullet();
        bulletBuffer = [stripBulletPrefix(line.text)];
        break;
      }
      case "body": {
        flushHeading();
        const trimmed = line.text.trim();
        if (bulletBuffer) {
          const bufferedSoFar = joinParagraphLines(bulletBuffer);
          if (!SENTENCE_TERMINAL.test(bufferedSoFar)) {
            bulletBuffer.push(trimmed);
            break;
          }
          flushBullet();
        }
        paragraphBuffer.push(trimmed);
        break;
      }
    }
  }
  flushParagraph();
  flushHeading();
  flushBullet();
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
    // Anything else here (a worker script failing to load, an out-of-
    // memory kill on a constrained device, a network hiccup fetching the
    // worker asset) used to be discarded behind a fixed, generic message
    // — exactly the "no way to diagnose a mobile-only failure without a
    // remote debugger" gap this was found blocking. Folding the real
    // name/message in means whatever actually went wrong shows up as
    // readable text in the upload toast itself, on the device it happened
    // on, not just in a console nobody on a phone can see.
    const detail = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    throw new PdfExtractionError(`Couldn't open this PDF (${detail}).`, "unknown");
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
      const fontName = "fontName" in item ? item.fontName : "";
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
        existing.boldChars += bold ? item.str.length : 0;
        existing.fontChars[fontName] = (existing.fontChars[fontName] ?? 0) + item.str.length;
        existing.charCount += item.str.length;
        existing.x = Math.min(existing.x, x);
        existing.endX = Math.max(existing.endX, x + width);
      } else {
        lines.push({
          y,
          x,
          endX: x + width,
          text: item.str,
          size,
          boldChars: bold ? item.str.length : 0,
          fontChars: { [fontName]: item.str.length },
          charCount: item.str.length,
          cells: [item.str],
          cellX: [x],
        });
      }
    }
    // pdf.js's y-axis grows upward (origin bottom-left), so the first
    // line on the page has the largest y — orderLinesForReading falls
    // back to exactly this plain sort unless it detects a real two-column
    // layout (see its own comment).
    pageLines.push(orderLinesForReading(lines));
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

  // The document's own dominant pdf.js font resource — same char-weighted
  // vote as bodySize, backing the fallback heading signal described on
  // RawLine.fontChars above. A document where bold/size detection already
  // works fine still computes this harmlessly; it only changes anything in
  // classifyLine when the other two signals have nothing to go on.
  const fontVotes = new Map<string, number>();
  for (const lines of pageLines) {
    for (const line of lines) {
      for (const [font, count] of Object.entries(line.fontChars)) {
        fontVotes.set(font, (fontVotes.get(font) ?? 0) + count);
      }
    }
  }
  let bodyFontName = "";
  let bestFontVotes = -1;
  for (const [font, votes] of fontVotes) {
    if (votes > bestFontVotes) {
      bestFontVotes = votes;
      bodyFontName = font;
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

  // A running header/footer (a chapter name reprinted at the top of every
  // page in that chapter, a page number, a multi-page table's own header
  // row reprinted at the top of each continuation page) repeats
  // near-verbatim across several pages; real body prose essentially never
  // does. Found via real testing on TestDoc/swecom.pdf, whose dense
  // multi-page competency tables reprint their column-header row ("Skill
  // Entry Technical ... Practitioner Leader Engineer") at the top of every
  // continuation page — without this, that row (and the chapter-name
  // running header beside it) fell through table detection as ordinary
  // "body" text and polluted both the reading view and the AI summary.
  // Page numbers vary between occurrences, so digits are normalized away
  // before comparing. An absolute minimum page count (not a fraction of
  // the whole document) is deliberate: many of these repeat only within
  // one chapter's short page span, not across the entire document.
  const NOISE_MIN_PAGE_COUNT = 3;
  const NOISE_MAX_LINE_LENGTH = 100;
  // A running header is styled distinctly from body text often enough
  // (bold, a touch larger) that classifyLine reads it as "subheading" —
  // found via real testing on swecom.pdf, whose chapter-name running
  // footer ("Software Requirements Skill Area 27") survived a body-only
  // check for exactly this reason. Subheading-kind repeats are only
  // treated as noise when they additionally *cluster* within a narrow page
  // span: a running header repeats throughout one short chapter, while a
  // real repeated section title (this same document's "References"
  // heading appears in all 11 skill-area chapters) recurs once every
  // several dozen pages, spread across the whole document — a real
  // heading, not noise, even though it also repeats 3+ times. "bullet" is
  // treated the same as "body" (no clustering needed, a real bullet list
  // item essentially never repeats verbatim 3+ times across separate
  // pages) — also found via real testing: the same running-footer caption
  // above alternated between "body" and "bullet" classification from page
  // to page (a stray leading-character quirk), which split its already-few
  // occurrences across two kinds and let it slip under the threshold
  // before this was accounted for.
  const NOISE_SUBHEADING_MAX_CLUSTER_SPAN = 15;

  function normalizeForNoiseDetection(text: string): string {
    return text.replace(/\d+/g, "#").replace(/\s+/g, " ").trim().toLowerCase();
  }

  function classifyPageLines(
    lines: RawLine[],
  ): { kind: LineKind; text: string; cells?: string[] }[] {
    const tableFlags = detectTableRows(lines);
    return lines.map((line, i) =>
      tableFlags[i]
        ? { kind: "table-row" as const, text: line.text, cells: line.cells }
        : { kind: classifyLine(line, bodySize, bodyX, bodyFontName), text: line.text },
    );
  }

  const NOISE_ELIGIBLE_KINDS = new Set<LineKind>(["body", "bullet", "subheading"]);
  const NOISE_UNCLUSTERED_KINDS = new Set<LineKind>(["body", "bullet"]);

  const lineOccurrences = new Map<string, { kinds: Set<LineKind>; pages: Set<number> }>();
  pageLines.forEach((lines, pageIdx) => {
    for (const line of classifyPageLines(lines)) {
      if (!NOISE_ELIGIBLE_KINDS.has(line.kind)) continue;
      const trimmed = stripBulletPrefix(line.text).trim();
      if (!trimmed || trimmed.length > NOISE_MAX_LINE_LENGTH) continue;
      const norm = normalizeForNoiseDetection(trimmed);
      if (!norm) continue;
      const existing = lineOccurrences.get(norm);
      if (existing) {
        existing.kinds.add(line.kind);
        existing.pages.add(pageIdx);
      } else {
        lineOccurrences.set(norm, { kinds: new Set([line.kind]), pages: new Set([pageIdx]) });
      }
    }
  });
  const noiseNormalizedTexts = new Set(
    [...lineOccurrences.entries()]
      .filter(([, { kinds, pages }]) => {
        if (pages.size < NOISE_MIN_PAGE_COUNT) return false;
        if ([...kinds].some((k) => NOISE_UNCLUSTERED_KINDS.has(k))) return true;
        const sorted = [...pages].sort((a, b) => a - b);
        const span = sorted[sorted.length - 1] - sorted[0];
        return span <= NOISE_SUBHEADING_MAX_CLUSTER_SPAN;
      })
      .map(([norm]) => norm),
  );

  const pageTexts = pageLines.map((lines, idx) => {
    const ocrText = ocrTexts.get(idx + 1);
    if (ocrText !== undefined) return formatOcrText(ocrText);
    const classified = classifyPageLines(lines).filter((line) => {
      if (!NOISE_ELIGIBLE_KINDS.has(line.kind)) return true;
      const trimmed = stripBulletPrefix(line.text).trim();
      if (trimmed.length > NOISE_MAX_LINE_LENGTH) return true;
      return !noiseNormalizedTexts.has(normalizeForNoiseDetection(trimmed));
    });
    return formatStructuredText(classified);
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
