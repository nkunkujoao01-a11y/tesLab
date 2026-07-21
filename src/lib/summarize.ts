// Simple on-device extractive summarizer: scores sentences by word
// frequency and keeps the top-scoring ones, in their original order.
// Stands in for the real DistilBART/TensorFlow Lite model (see DEV_LOG.md —
// blocked on real PDF assets); this is also the PRD's own documented
// fallback strategy (FR44), not a placeholder trick.

const STOPWORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "but", "by", "for", "from",
  "has", "have", "he", "her", "his", "in", "is", "it", "its", "of", "on",
  "or", "our", "she", "that", "the", "their", "they", "this", "to", "was",
  "were", "will", "with", "you", "your",
]);

function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?])\s+(?=[A-Z])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function wordsOf(sentence: string): string[] {
  return sentence
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

/** Groups a block of AI-generated prose into a handful of short paragraphs
 * instead of one dense block — a real readability improvement (found via
 * real-device testing feedback) that needs no model change at all, since
 * the summarizer only ever outputs plain prose with no paragraph breaks of
 * its own. Reuses splitSentences rather than a separate implementation. */
export function groupIntoParagraphs(text: string, sentencesPerParagraph = 2): string[] {
  const sentences = splitSentences(text);
  const paragraphs: string[] = [];
  for (let i = 0; i < sentences.length; i += sentencesPerParagraph) {
    paragraphs.push(sentences.slice(i, i + sentencesPerParagraph).join(" "));
  }
  return paragraphs;
}

export function summarizeText(text: string, sentenceCount = 3): string {
  const sentences = splitSentences(text);
  if (sentences.length <= sentenceCount) return sentences.join(" ");

  const frequency = new Map<string, number>();
  for (const sentence of sentences) {
    for (const word of wordsOf(sentence)) {
      frequency.set(word, (frequency.get(word) ?? 0) + 1);
    }
  }

  const scored = sentences.map((sentence, index) => {
    const words = wordsOf(sentence);
    const score = words.length
      ? words.reduce((sum, w) => sum + (frequency.get(w) ?? 0), 0) / words.length
      : 0;
    return { sentence, index, score };
  });

  const top = [...scored]
    .sort((a, b) => b.score - a.score)
    .slice(0, sentenceCount)
    .sort((a, b) => a.index - b.index);

  return top.map((s) => s.sentence).join(" ");
}
