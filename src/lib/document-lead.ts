// Gives a student's own uploaded document the same editorial treatment
// catalog materials get for free from their hand-authored `heading/lead/
// body/pull` content (see supabase/migrations/0002_material_content.sql)
// — a real lead paragraph and a real standout pull-quote, not just a flat
// wall of paragraphs. Nothing here is fabricated: `lead` is real text
// already in the document, and `pull` is a real sentence chosen by
// word-frequency scoring, the same technique summarize.ts already uses
// elsewhere in this app — not a new algorithm invented for this.

const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "but",
  "by",
  "for",
  "from",
  "has",
  "have",
  "he",
  "her",
  "his",
  "in",
  "is",
  "it",
  "its",
  "of",
  "on",
  "or",
  "our",
  "she",
  "that",
  "the",
  "their",
  "they",
  "this",
  "to",
  "was",
  "were",
  "will",
  "with",
  "you",
  "your",
]);

// A real intro paragraph is normally a sentence or two — much longer than
// this and it reads more like body text than a lead, so only the opening
// sentences are kept (still verbatim, just trimmed to a lead-sized chunk).
const MAX_LEAD_CHARS = 400;
// A byline ("a b Muhammad Ehsan Rana and Omar S. Saleh") can be as short
// as 8 words — real lead-worthy sentences run noticeably longer than that
// in practice, found via real testing on an academic paper.
const MIN_PROSE_WORDS = 12;
// A real sentence of prose is thick with small connective words (the, of,
// and, is...); an author/affiliation byline or a bare citation entry has
// almost none. Below this density, treat a candidate as not real prose.
const MIN_STOPWORD_DENSITY = 0.15;
// A list of names/affiliations is almost entirely capitalized words; real
// prose capitalizes only sentence starts and proper nouns.
const MAX_CAPITALIZED_RATIO = 0.35;

function wordsOf(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter(Boolean);
}

function looksLikeProse(text: string): boolean {
  const rawWords = text.trim().split(/\s+/).filter(Boolean);
  if (rawWords.length < MIN_PROSE_WORDS) return false;

  const words = wordsOf(text);
  const stopwordCount = words.filter((w) => STOPWORDS.has(w)).length;
  if (stopwordCount / words.length < MIN_STOPWORD_DENSITY) return false;

  // A whole sentence in ALL CAPS (found via real testing on an official
  // instructions document — "DO NOT TURN THE PAGE BEFORE READING ALL
  // INSTRUCTIONS...") is a real, if shouty, stylistic choice, not a name
  // list — every word being "capitalized" there is just what uppercase
  // text looks like, not evidence of a byline. Only check the
  // capitalization-ratio signal for text that isn't already all-caps.
  if (text !== text.toUpperCase()) {
    // Skip the very first word — a real sentence always capitalizes it
    // too, so it carries no information either way.
    const rest = rawWords.slice(1);
    const capitalizedCount = rest.filter((w) => /^[A-Z]/.test(w)).length;
    if (rest.length > 0 && capitalizedCount / rest.length > MAX_CAPITALIZED_RATIO) return false;
  }

  return true;
}

function isPlainParagraph(block: string): boolean {
  return !block.startsWith("# ") && !block.startsWith("## ") && !block.startsWith("- ");
}

/** Concatenates only a document's plain-paragraph blocks — excluding
 * headings and bullet list items. Found via real testing on a
 * multiple-choice exam document: running sentence-splitting over the
 * *raw* structured text (still carrying its `#`/`##`/`- ` markers and,
 * critically, short one-line bullet answer options like "- A", "- B",
 * "- C") produced garbled, meaningless "sentences" that spliced a
 * question fragment together with unrelated answer options — a bullet
 * list is not prose no matter how it's punctuated, and shouldn't be fed
 * to a prose-scoring function at all. */
function extractPlainProseText(text: string): string {
  return text
    .split(/\n\n+/)
    .filter((b) => b.trim() && isPlainParagraph(b))
    .join(" ");
}

function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?])\s+(?=[A-Z])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Some real paragraphs — especially a PDF's opening one — turn out to be
 * a font-size-classification side effect where an author/affiliation
 * byline (no real paragraph break between it and the real text, from
 * pdf-extract.ts's perspective) is glued onto the same block as the
 * document's actual opening sentences. Rather than trust an entire
 * candidate block, this scans sentence by sentence for the first one that
 * genuinely looks like prose, and returns *both* the lead (a few
 * sentences from there) and whatever real content follows it in the same
 * block, so that content isn't silently dropped from the body either. */
function extractLeadFromBlock(block: string): { lead: string; rest: string } | null {
  const sentences = splitSentences(block);
  const startIndex = sentences.findIndex(looksLikeProse);
  if (startIndex === -1) return null;

  let lead = "";
  let endIndex = startIndex;
  for (let i = startIndex; i < sentences.length; i++) {
    const candidate = lead ? `${lead} ${sentences[i]}` : sentences[i];
    if (lead && candidate.length > MAX_LEAD_CHARS) break;
    lead = candidate;
    endIndex = i + 1;
  }

  const rest = sentences.slice(endIndex).join(" ");
  return { lead, rest };
}

/** The single best real-prose sentence in `text`, scored by word
 * frequency across the whole text (same technique summarize.ts uses) but
 * only ever *chosen* from sentences that look like genuine prose — a
 * citation or reference-list entry can still score well on raw word
 * frequency (repeated author/journal names), so scoring alone isn't
 * enough of a filter; the candidate pool itself has to exclude those
 * first. */
function pickBestSentence(text: string): string | null {
  const sentences = splitSentences(text);
  const candidates = sentences.filter(looksLikeProse);
  if (candidates.length === 0) return null;

  const frequency = new Map<string, number>();
  for (const sentence of sentences) {
    for (const word of wordsOf(sentence)) {
      frequency.set(word, (frequency.get(word) ?? 0) + 1);
    }
  }

  let best = candidates[0];
  let bestScore = -1;
  for (const sentence of candidates) {
    const words = wordsOf(sentence);
    const score = words.length
      ? words.reduce((sum, w) => sum + (frequency.get(w) ?? 0), 0) / words.length
      : 0;
    if (score > bestScore) {
      bestScore = score;
      best = sentence;
    }
  }
  return best;
}

export type DocumentLead = {
  lead: string | null;
  pullQuote: string | null;
  // The document's text with the lead sentences removed (and any junk
  // that preceded them in the same block, e.g. a byline) so whatever
  // renders `lead` separately doesn't also show it a second time inside
  // the regular structured body below — while any real content that
  // followed the lead in that same block is kept, not dropped.
  bodyText: string;
};

/** Derives a real lead + pull-quote from a document's already-extracted,
 * already-structured text (the `#`/`##`/`-` markup pdf-extract.ts
 * produces). Both come straight from the document's own words — this
 * never writes new text, and both are gated on actually looking like
 * real prose rather than an author byline or a citation. */
export function deriveDocumentLead(text: string): DocumentLead {
  const blocks = text.split(/\n\n+/).filter((b) => b.trim());

  let lead: string | null = null;
  let bodyBlocks = blocks;

  for (let i = 0; i < blocks.length; i++) {
    if (!isPlainParagraph(blocks[i])) continue;
    const extracted = extractLeadFromBlock(blocks[i]);
    if (!extracted) continue;
    lead = extracted.lead;
    bodyBlocks = [
      ...blocks.slice(0, i),
      ...(extracted.rest ? [extracted.rest] : []),
      ...blocks.slice(i + 1),
    ];
    break;
  }

  const bodyText = bodyBlocks.join("\n\n");
  // Picked from the *rest* of the document's real prose only — picking it
  // from the lead itself would just echo what's already shown above, and
  // picking it from raw structured text (headings/bullets still carrying
  // their `#`/`- ` markers) risks the garbled-fragment bug described in
  // extractPlainProseText's own comment.
  const proseText = extractPlainProseText(bodyText);
  const pullQuote = proseText.trim() ? pickBestSentence(proseText) : null;

  return { lead, pullQuote, bodyText };
}
