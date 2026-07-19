// Grounds the collection-scoped assistant (Feature 36 / Phase I2) in a
// collection's actual documents — retrieve the most relevant text chunks
// for a question, then feed only those into the chat model's context,
// rather than the whole collection (which could easily exceed a 360M-
// parameter model's practical context window, see ai-chat.ts).
//
// Deliberately keyword-overlap scoring, not semantic/embedding-based
// search — same honest tradeoff line as summarize.ts's extractive
// summarizer: a real embedding model would need loading a *third*
// on-device model (after the summarizer and the chat model), a real
// download-size cost for a student on a poor connection, for a quality
// gain this app's actual document sizes (a handful of short PDFs, not a
// large corpus) don't obviously need. If retrieval quality turns out to
// matter more in practice than this assumes, that's the natural next
// upgrade — not built speculatively now.

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

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

// Splits on the same block boundary StructuredText renders on (Feature 32's
// `\n\n`-separated headings/bullets/paragraphs) — a chunk this way is
// already a coherent unit (one paragraph, one bullet, one heading), not an
// arbitrary character-count slice that could cut a sentence in half.
function chunkDocument(text: string): string[] {
  return text
    .split(/\n\n+/)
    .map((block) => block.trim())
    .filter((block) => block.length > 20);
}

export type RetrievedChunk = {
  docId: string;
  docTitle: string;
  text: string;
  score: number;
};

export type RetrievableDocument = { id: string; title: string; text: string };

/** Returns the `maxChunks` blocks (across all of `documents`) with the most
 * words in common with `query` — nothing fancier than that. Chunks with
 * zero overlap are excluded entirely rather than padding the result with
 * irrelevant text just to hit `maxChunks`. */
export function retrieveRelevantChunks(
  documents: RetrievableDocument[],
  query: string,
  maxChunks = 4,
): RetrievedChunk[] {
  const queryWords = new Set(tokenize(query));
  if (queryWords.size === 0) return [];

  const scored: RetrievedChunk[] = [];
  for (const doc of documents) {
    for (const block of chunkDocument(doc.text)) {
      const blockWords = tokenize(block);
      let score = 0;
      for (const w of blockWords) {
        if (queryWords.has(w)) score += 1;
      }
      if (score > 0) {
        scored.push({ docId: doc.id, docTitle: doc.title, text: block, score });
      }
    }
  }

  return scored.sort((a, b) => b.score - a.score).slice(0, maxChunks);
}
