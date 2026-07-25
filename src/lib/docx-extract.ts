// Real structural extraction from .docx files, mirroring pdf-extract.ts's
// output shape (the same lightweight `#`/`##`/`- `/`| |` markup convention)
// so every downstream consumer (StructuredText, summarize-structured.ts,
// quiz-gen.ts, retrieval.ts) treats a Word document exactly like a PDF,
// no separate code path needed anywhere else.
//
// This replaces the previous approach (mammoth.extractRawText — flat,
// unstructured prose with every heading/list/table/quote read as one
// undifferentiated blob of text). PDF extraction gets real structure by
// re-deriving it from font size/position heuristics on unstructured
// positioned text fragments, since that's all pdf.js exposes; a .docx
// file is the opposite situation — Word already stores real paragraph
// styles (Heading 1..6, Title, Quote), real list numbering, and real
// `<table>` markup in its own XML, and mammoth.convertToHtml already
// surfaces essentially all of it as real HTML tags. No heuristics needed
// here at all — just a straightforward walk of that HTML into this app's
// own markup, which is a *more* reliable source of structure than the
// PDF path ever has, not a lesser one.

const HEADING_TAG_PATTERN = /^h[1-6]$/;

function escapeTableCell(text: string): string {
  return text.trim().replace(/\|/g, "\\|");
}

function textOf(el: Element): string {
  return (el.textContent ?? "").replace(/\s+/g, " ").trim();
}

/** Walks mammoth's HTML output into this app's own lightweight markup.
 * Deliberately collapses Word's real h1-h6 hierarchy down to this app's
 * existing two-level heading/subheading convention (h1 → "# ", h2-h6 →
 * "## ") rather than inventing a third markup level every other
 * consumer (StructuredText, quiz-gen.ts's parseBlocks,
 * summarize-structured.ts's splitIntoSections) would need updating to
 * understand — a real simplification, not a bug: the useful distinction
 * for summarization/chunking is "is this a title or a sub-detail," not
 * exactly how many levels deep. A "Quote"/"Intense Quote"-styled
 * paragraph (see the styleMap below) has no equivalent markup convention
 * either, so it renders as an ordinary paragraph — still fully readable,
 * just not visually distinguished as a quotation. */
function walkDocxHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const blocks: string[] = [];

  for (const el of Array.from(doc.body.children)) {
    const tag = el.tagName.toLowerCase();
    if (tag === "h1") {
      const text = textOf(el);
      if (text) blocks.push(`# ${text}`);
    } else if (HEADING_TAG_PATTERN.test(tag)) {
      const text = textOf(el);
      if (text) blocks.push(`## ${text}`);
    } else if (tag === "ul" || tag === "ol") {
      for (const li of Array.from(el.children)) {
        if (li.tagName !== "LI") continue;
        const text = textOf(li);
        if (text) blocks.push(`- ${text}`);
      }
    } else if (tag === "table") {
      const rows = Array.from(el.querySelectorAll("tr")).map((tr) =>
        Array.from(tr.querySelectorAll("td, th")).map((cell) => escapeTableCell(textOf(cell))),
      );
      if (rows.length > 0) {
        const [header, ...rest] = rows;
        const separator = header.map(() => "---");
        const tableRows = [header, separator, ...rest];
        blocks.push(tableRows.map((row) => `| ${row.join(" | ")} |`).join("\n"));
      }
    } else {
      // Everything else (an ordinary paragraph, a "Quote"-styled
      // paragraph mapped below, a stray wrapper element) reads as plain
      // prose — an honest, still fully readable degrade, same as a PDF
      // page whose styling is too uniform for the classifier to read
      // any real structure out of.
      const text = textOf(el);
      if (text) blocks.push(text);
    }
  }

  return blocks.join("\n\n");
}

/** Real structural text extraction from a .docx file — headings, bullet/
 * numbered lists, and tables, in the same markup convention pdf-extract.ts
 * produces. `pageCount` is always 1: Word documents have no fixed page
 * count outside of print layout, which this extraction never renders. */
export async function extractDocxStructuredText(
  file: File,
): Promise<{ text: string; pageCount: number }> {
  const mammoth = await import("mammoth");
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.convertToHtml(
    { arrayBuffer },
    {
      // mammoth's own default style map already handles "Heading 1"
      // through "Heading 6" → h1-h6; these three add the common cover-
      // page/quotation styles it doesn't map by default.
      styleMap: [
        "p[style-name='Title'] => h1:fresh",
        "p[style-name='Subtitle'] => h2:fresh",
        "p[style-name='Quote'] => p:fresh",
        "p[style-name='Intense Quote'] => p:fresh",
      ],
    },
  );
  const text = walkDocxHtml(result.value);
  return { text, pageCount: 1 };
}

const MIN_HEADING_TITLE_CHARS = 15;
const MIN_TITLE_CHARS = 15;
const MAX_TITLE_CHARS = 200;

// Common cover-page boilerplate that precedes or follows a real title —
// confirmed against a real submitted thesis, whose actual title (a plain
// bold paragraph, no heading style at all) sat between "FACULTY OF
// COMPUTING AND INFORMATICS"/"DEPARTMENT OF..." lines above it and a
// "BY" / author name / student number / "A PROJECT SUBMITTED IN PARTIAL
// COMPLETION OF..." block below it — a pure "longest line" or "first
// line over N characters" heuristic both picked the wrong line (the
// institution name, or the longer submission-purpose sentence, which
// happened to run longer than the actual title itself). Excluding these
// specific, very common patterns and taking the first surviving line is
// far more reliable than length alone.
const COVER_PAGE_BOILERPLATE_PATTERNS = [
  /^(faculty|department|school|college|institute)\s+of\b/i,
  /^(a|an)\s+(project|thesis|dissertation|report|proposal)\s+submitted\b/i,
  /^in\s+(partial\s+)?(fulfil?l?ment|completion)\b/i,
  /^in\s+the\s+department\b/i,
  /^by$/i,
  /^student\s+number\b/i,
  /^supervisor\b/i,
  /^date\s+of\s+submission\b/i,
  /^\d/,
];

/** The document's own detected title — preferred over a raw uploaded
 * filename (often a meaningless student-number/submission-id string,
 * not anything a student chose). Best-effort, not a guarantee: checks
 * for a real early heading first (a document that genuinely uses a
 * "Title" style), then falls back to the first non-boilerplate line on
 * the "cover page" (everything before the first heading of any kind) —
 * see the constant above for exactly why plain length/longest-line
 * heuristics weren't reliable enough on their own. */
export function detectDocumentTitle(text: string): string | null {
  const blocks = text.split(/\n\n+/);
  const firstHeadingIndex = blocks.findIndex((b) => /^#{1,2}\s/.test(b));
  const coverBlocks =
    firstHeadingIndex === -1 ? blocks.slice(0, 10) : blocks.slice(0, firstHeadingIndex);

  const earlyHeading = coverBlocks.find((b) => /^#\s/.test(b));
  if (earlyHeading) {
    const heading = earlyHeading.replace(/^#\s+/, "").trim();
    if (heading.length >= MIN_HEADING_TITLE_CHARS) return heading;
  }

  const candidate = coverBlocks
    .map((b) => b.replace(/^#{1,2}\s+/, "").trim())
    .find(
      (t) =>
        t.length >= MIN_TITLE_CHARS &&
        t.length <= MAX_TITLE_CHARS &&
        !COVER_PAGE_BOILERPLATE_PATTERNS.some((pattern) => pattern.test(t)),
    );
  return candidate ?? null;
}
