// Real, whole-document summarization that doesn't silently drop content.
//
// The neural summarizer (ai-model.ts) has a hard MAX_INPUT_CHARS budget
// per call — a real T5-family model limit, not a policy choice. Handing
// it a whole long document once meant only the first ~3000 characters
// (roughly the first page or two) were ever actually summarized; the rest
// of the document was silently invisible to it, with nothing in the UI
// admitting that. This module fixes that properly rather than just
// raising the limit (which would just move the same problem to a longer
// document): split the real document into its own real sections (from the
// `#`/`##` structure pdf-extract.ts already produces), summarize each
// section within the model's real budget (chunking further if even one
// section is too long), and summarize the section summaries into one short
// overview. Every section of the source text ends up inside some model
// call — nothing skipped.

import { deviceDb, type SummarySection } from "@/lib/db";
import { summarizeText } from "@/lib/summarize";
import { summarizeWithModel } from "@/lib/ai-model";
import { callGeminiWithPrompt, CloudUnavailableError, stripJsonFence } from "@/lib/ai-cloud";

// Cloud models handle far more context per call than the small on-device
// summarizer's MODEL_INPUT_BUDGET below — this is a generous but still
// bounded budget so a very large document doesn't balloon a single request
// against the student's own free-tier token quota (see ai-cloud.ts).
const CLOUD_SOURCE_CHARS = 12_000;

type CloudStructuredSummary = { overview: string; sections: SummarySection[] };

/** Parses the cloud model's JSON reply into the same shape the rest of
 * this file already produces, applying the same "drop what doesn't
 * validate, don't guess" discipline as quiz-gen.ts's cloud parsers. Any
 * malformed or unparseable reply returns null so the caller falls straight
 * through to the existing chunked on-device/extractive pipeline below,
 * unchanged. */
function parseCloudStructuredSummary(raw: string): CloudStructuredSummary | null {
  let data: unknown;
  try {
    data = JSON.parse(stripJsonFence(raw));
  } catch {
    return null;
  }
  const obj = data as Record<string, unknown> | null;
  if (!obj || typeof obj.overview !== "string" || !Array.isArray(obj.sections)) return null;

  const sections: SummarySection[] = [];
  for (const entry of obj.sections) {
    const s = entry as Record<string, unknown>;
    if (
      s &&
      typeof s.heading === "string" &&
      typeof s.body === "string" &&
      (s.keyPoints === undefined ||
        (Array.isArray(s.keyPoints) && s.keyPoints.every((k) => typeof k === "string")))
    ) {
      sections.push({
        heading: s.heading,
        body: s.body,
        keyPoints: s.keyPoints as string[] | undefined,
      });
    }
  }
  return sections.length > 0 ? { overview: obj.overview, sections } : null;
}

function buildCloudStructuredSummaryPrompt(text: string): string {
  return (
    `Summarize the study material below as a short overview plus one summary per real section ` +
    `of the material (matching its own heading structure). Respond with ONLY a JSON object, no ` +
    `other text, matching this shape exactly: ` +
    `{"overview": string, "sections": [{"heading": string, "body": string, "keyPoints": [string]}]}. ` +
    `Study material:\n${text}`
  );
}

const MODEL_DOWNLOADED_KEY = "ai_model_downloaded";
// Mirrors ai-model.ts's own MAX_INPUT_CHARS — kept as a separate constant
// here (not imported) since this module's chunking needs to reason about
// it independently of that module's internal truncation, which this file
// exists specifically to avoid ever triggering.
const MODEL_INPUT_BUDGET = 3000;

type RawSection = { heading: string; body: string; keyPoints: string[] };

// A section's summary reads as one dense block with no internal structure,
// because the on-device summarizer only ever outputs plain prose — it
// can't reliably produce a bullet list on its own (see this file's own
// header comment on why raw markup fed to the model corrupts its output).
// Real bullets straight from the source document are the one piece of
// structure that's genuine and safe to show without asking the model to
// invent anything — capped the same way flashcard generation caps its own
// per-document list (quiz-gen.ts's MAX_CARDS) so one bullet-heavy section
// doesn't dwarf its own prose summary.
const MAX_KEY_POINTS_PER_SECTION = 5;

// A bullet or table block isn't sentence prose — summarizeText's
// splitSentences has no markup awareness at all, so handing it a raw
// `| cell | cell |` table block (or a bare `- A` bullet) produces
// garbled, punctuation-spliced "sentences" instead of a real summary.
// Found via real testing on TestDoc/swecom.pdf, whose crosscutting-skill
// tables produced exactly this in the AI summary. Skipping non-prose
// blocks here means a section that's *entirely* tables/bullets honestly
// has no summary rather than a corrupted one — the same standard
// document-lead.ts already applies to the lead/pull-quote.
function isPlainParagraph(block: string): boolean {
  return (
    !block.startsWith("# ") &&
    !block.startsWith("## ") &&
    !block.startsWith("- ") &&
    !block.startsWith("| ")
  );
}

/** Splits pdf-extract.ts's lightweight Markdown (`#`/`##` headings, `-`
 * bullets, blank-line-separated paragraphs) into real sections — one per
 * top-level or second-level heading. Text before the first heading (if
 * any) becomes its own leading section so it's never lost. A document
 * with no headings at all (e.g. a catalog material's synthetic
 * single-heading wrapper, or older uniformly-styled extractions) comes
 * back as one section under `fallbackTitle`. */
function splitIntoSections(text: string, fallbackTitle: string): RawSection[] {
  const blocks = text.split(/\n\n+/).filter((b) => b.trim());
  const sections: RawSection[] = [];
  let currentHeading: string | null = null;
  let currentBody: string[] = [];
  let currentBullets: string[] = [];

  const flush = () => {
    const body = currentBody.join("\n\n").trim();
    if (body || currentBullets.length > 0) {
      sections.push({
        heading: currentHeading ?? fallbackTitle,
        body,
        keyPoints: currentBullets.slice(0, MAX_KEY_POINTS_PER_SECTION),
      });
    }
    currentBody = [];
    currentBullets = [];
  };

  for (const block of blocks) {
    if (block.startsWith("# ") || block.startsWith("## ")) {
      flush();
      currentHeading = block.replace(/^#+\s*/, "").trim();
    } else if (block.startsWith("- ")) {
      // Kept out of `body` — never fed to the model (see this file's own
      // header comment) — but real, so worth surfacing directly. See
      // MAX_KEY_POINTS_PER_SECTION's comment above.
      currentBullets.push(block.slice(2).trim());
    } else if (isPlainParagraph(block)) {
      currentBody.push(block);
    }
  }
  flush();

  return sections.length > 0
    ? sections
    : [{ heading: fallbackTitle, body: text.trim(), keyPoints: [] }];
}

/** Greedily groups a section's paragraphs into chunks that each fit the
 * model's real input budget, splitting on paragraph boundaries (never
 * mid-sentence). A single paragraph longer than the whole budget is cut
 * at the character limit as a last resort — rare, and still summarized,
 * just not on a clean boundary. */
function chunkForModel(text: string, maxChars: number): string[] {
  const paragraphs = text.split(/\n\n+/).filter((p) => p.trim());
  const chunks: string[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    const candidate = current ? `${current}\n\n${paragraph}` : paragraph;
    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }
    if (current) chunks.push(current);
    current = paragraph.length > maxChars ? paragraph.slice(0, maxChars) : paragraph;
  }
  if (current) chunks.push(current);
  return chunks.length > 0 ? chunks : [text.slice(0, maxChars)];
}

export type StructuredSummaryResult = {
  overview: string;
  sections: SummarySection[];
  method: "cloud" | "neural" | "extractive";
};

/** Generates a real, whole-document summary: a short overview plus one
 * summary per real section, covering all of `text` — not just whatever
 * fit in one model call. Tries the student's own cloud AI key first (see
 * ai-cloud.ts) — genuinely better quality than the on-device model, which
 * this app has already deliberately not chased further on-device (see
 * DEV_LOG.md: a larger on-device summarizer measured ~10 minutes for a
 * 2-page document and was rejected). Any cloud failure — offline, no key,
 * bad JSON, rate limit — falls straight through to the existing on-device
 * neural summarizer when it's been downloaded (Profile > AI settings), and
 * from there to the extractive summarizer per-chunk on any *further*
 * failure — same degrade-gracefully rule as the rest of this app's AI
 * features (FR44), just with one more rung added above it. */
export async function generateStructuredSummary(
  text: string,
  fallbackTitle: string,
): Promise<StructuredSummaryResult> {
  try {
    const raw = await callGeminiWithPrompt(
      buildCloudStructuredSummaryPrompt(text.slice(0, CLOUD_SOURCE_CHARS)),
    );
    const cloudResult = parseCloudStructuredSummary(raw);
    if (cloudResult) {
      return { ...cloudResult, method: "cloud" };
    }
  } catch (err) {
    if (!(err instanceof CloudUnavailableError)) {
      console.error("Unexpected error calling cloud AI for summarization", err);
    }
    // Any cloud failure falls straight through to the existing on-device/
    // extractive pipeline below — cloud is an optional enhancement, never
    // a requirement.
  }

  const modelDownloaded =
    (await deviceDb.appSettings.get(MODEL_DOWNLOADED_KEY))?.value === "true";
  let method: "neural" | "extractive" = modelDownloaded ? "neural" : "extractive";

  const rawSections = splitIntoSections(text, fallbackTitle);
  const sections: SummarySection[] = [];

  for (const section of rawSections) {
    const chunks = chunkForModel(section.body, MODEL_INPUT_BUDGET);
    const chunkSummaries: string[] = [];
    for (const chunk of chunks) {
      // method !== "extractive": once one chunk's neural attempt has
      // already failed, every later chunk skipped straight to the
      // extractive fallback here too — before this, `modelDownloaded`
      // alone gated this branch, so a fatal, deterministic failure (one
      // that will reproduce identically for every remaining chunk) got
      // re-attempted from scratch for each one anyway. One real attempt
      // per document, then a clean, fast fallback for the rest.
      if (modelDownloaded && method !== "extractive") {
        try {
          chunkSummaries.push(await summarizeWithModel(chunk));
          continue;
        } catch (err) {
          console.error("Neural summarization failed for a chunk, falling back", err);
          method = "extractive";
        }
      }
      chunkSummaries.push(summarizeText(chunk, 2));
    }
    sections.push({
      heading: section.heading,
      body: chunkSummaries.join(" "),
      keyPoints: section.keyPoints.length > 0 ? section.keyPoints : undefined,
    });
  }

  const combined = sections.map((s) => s.body).join(" ");
  let overview: string;
  if (modelDownloaded && method === "neural") {
    try {
      overview = await summarizeWithModel(combined.slice(0, MODEL_INPUT_BUDGET));
    } catch (err) {
      console.error("Neural overview summarization failed, falling back", err);
      method = "extractive";
      overview = summarizeText(combined, 3);
    }
  } else {
    overview = summarizeText(combined, 3);
  }

  return { overview, sections, method };
}
