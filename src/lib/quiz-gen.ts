// Flashcard and multiple-choice quiz generation from a document's own
// extracted text (Phase J, see DEV_LOG.md). Two genuinely different
// techniques for two genuinely different needs, same "honest tradeoff"
// discipline as summarize.ts and retrieval.ts:
//
// - Flashcards are extractive: pair each heading/subheading (from
//   pdf-extract.ts's `#`/`##` structure) with the text under it. No AI, no
//   model download, works instantly and fully offline for every document,
//   even one nobody has ever downloaded a model on this device. A student
//   flipping through cards is checking recall of facts already in their
//   own notes, not asking for anything generative.
// - Multiple-choice questions genuinely need generation — a real MCQ needs
//   plausible wrong answers, which extractive methods can't produce. Reuses
//   the existing on-device chat model from ai-chat.ts (the same one
//   powering "Ask AI" and collection chat) rather than a new download.

export type Flashcard = { front: string; back: string };

type Block = { kind: "heading" | "subheading" | "bullet" | "body" | "table"; content: string };

function parseBlocks(text: string): Block[] {
  return text
    .split(/\n\n+/)
    .map((b) => b.trim())
    .filter(Boolean)
    .map((block) => {
      if (block.startsWith("## ")) return { kind: "subheading" as const, content: block.slice(3) };
      if (block.startsWith("# ")) return { kind: "heading" as const, content: block.slice(2) };
      if (block.startsWith("- ")) return { kind: "bullet" as const, content: block.slice(2) };
      // A table block (see pdf-extract.ts's `| `-prefixed GFM markup) isn't
      // real explanatory prose — gluing its raw pipe syntax onto a
      // flashcard's back reproduces the exact table-leak bug already found
      // and fixed in document-lead.ts and summarize-structured.ts. Kept as
      // its own kind (not silently dropped) so a heading immediately
      // followed by only a table still correctly produces no card, rather
      // than accidentally treating the table as the heading's "back" once
      // filtered out downstream.
      if (block.startsWith("| ")) return { kind: "table" as const, content: block };
      return { kind: "body" as const, content: block };
    });
}

const MAX_CARDS = 12;

// A numbered/lettered heading prefix ("11. Software Requirements Skill
// Area", "A. Contributors") reads awkwardly once wrapped in a question —
// stripped before building the front, real heading text kept as-is.
const HEADING_ENUMERATION_PREFIX = /^(?:\d+|[A-Z])[.)]\s+/;

/** Turns a heading into something that actually reads as a question, not
 * just the heading text relabeled — found via real user feedback that a
 * flashcard front which is just a document heading ("References",
 * "Prepare to Commit") doesn't read as a question at all. Deliberately a
 * plain template, not model-generated: flashcards are extractive by
 * design (see this file's own top comment) specifically so they work
 * instantly, offline, for every document with no AI download required;
 * templating the heading keeps that property while still framing genuine
 * recall practice rather than a bare label. */
function headingToQuestion(heading: string): string {
  const trimmed = heading.replace(HEADING_ENUMERATION_PREFIX, "").trim();
  if (trimmed.endsWith("?")) return trimmed;
  return `What does "${trimmed}" cover?`;
}

/** Pairs each heading/subheading with the text that follows it (up to the
 * next heading) as front/back — a direct, honest mapping onto how the
 * document itself is organized, not a guessed "important fact" extraction.
 * Deliberately returns nothing (not degenerate cards) for a document with
 * no heading structure at all: an earlier version fell back to truncating
 * each paragraph's own opening words as the "front," but for anything
 * short of a couple sentences that truncation barely differs from the
 * paragraph itself — a flashcard whose front already gives away the back
 * isn't testing recall of anything, it's just relabeling the same text.
 * Better to say plainly that this document doesn't have enough structure
 * for flashcards yet (the UI should suggest the quiz generator instead,
 * which doesn't need headings) than pad the deck with cards that don't do
 * their one job. */
export function generateFlashcards(text: string): Flashcard[] {
  const blocks = parseBlocks(text);
  const cards: Flashcard[] = [];
  let front: string | null = null;
  let backParts: string[] = [];

  const flush = () => {
    if (front && backParts.length > 0) {
      cards.push({ front, back: backParts.join(" ") });
    }
    backParts = [];
  };

  for (const block of blocks) {
    if (block.kind === "heading" || block.kind === "subheading") {
      flush();
      front = headingToQuestion(block.content);
    } else if (block.kind === "bullet" || block.kind === "body") {
      backParts.push(block.content);
    }
    // "table" blocks contribute to neither front nor back — see
    // parseBlocks' own comment on why they're excluded rather than
    // silently falling into "body".
  }
  flush();

  return cards.slice(0, MAX_CARDS);
}

export type QuizQuestion = {
  question: string;
  options: string[];
  correctIndex: number;
};

export const QUIZ_QUESTION_COUNT = 3;
// A small on-device model's practical context window doesn't need (and
// gets slower/less coherent with) a whole document's worth of text — same
// truncation-for-focus tradeoff retrieval.ts makes per-chunk, just applied
// to a single document's full text here since there's no per-question
// query to retrieve chunks against.
const MAX_SOURCE_CHARS = 3000;

/** One question per model call, not all of them in a single generation —
 * found necessary from real on-device CPU testing (see DEV_LOG.md, Phase
 * J), not chosen upfront. Autoregressive generation is one token at a
 * time, and a single call asking for several full questions at once took
 * several minutes on real hardware with no visible progress until it
 * either finished or silently produced nothing parseable. Splitting into
 * one short call per question makes each step genuinely faster (far fewer
 * output tokens per call) and lets the UI show real "question 2 of 3"
 * progress instead of one long unmeasured wait. `alreadyAsked` is passed
 * back in so the model doesn't repeat the same question across calls,
 * since each call otherwise has no memory of the others. */
// Raw `| `-prefixed table markup (see pdf-extract.ts) wastes a real chunk
// of the model's small char budget on syntax it has no special handling
// for, and risks the same garbled-output-from-raw-markup failure mode
// already found and fixed for flashcards/summaries/pull-quotes elsewhere
// in this app — stripped before the budget is spent, not left for the
// model to make sense of.
function stripTableBlocks(text: string): string {
  return text
    .split(/\n\n+/)
    .filter((block) => !block.trim().startsWith("| "))
    .join("\n\n");
}

export function buildSingleQuestionPrompt(
  text: string,
  questionNumber: number,
  alreadyAsked: string[],
): string {
  const source = stripTableBlocks(text).slice(0, MAX_SOURCE_CHARS);
  const avoid =
    alreadyAsked.length > 0
      ? `Do not repeat these already-asked questions: ${alreadyAsked.join(" | ")}\n`
      : "";
  return (
    `Write exactly 1 multiple-choice question (question ${questionNumber} of ${QUIZ_QUESTION_COUNT}) testing understanding of the study notes below. ` +
    `Use only information in the notes. ${avoid}` +
    `Follow this exact format, with nothing else before, after, or in between:\n\n` +
    `Q: <question>\nA) <option>\nB) <option>\nC) <option>\nD) <option>\nCorrect: <letter>\n\n` +
    `Study notes:\n${source}`
  );
}

/** Parses the model's raw text response into real question objects,
 * silently dropping any block that doesn't match the requested format
 * (a small model with a temperature-free greedy decode is reliable most
 * of the time, not all of the time) rather than crashing on or guessing at
 * a malformed question — same "exclude, don't fake" discipline as
 * retrieval.ts dropping zero-overlap chunks. */
export function parseQuizResponse(raw: string): QuizQuestion[] {
  const questions: QuizQuestion[] = [];
  const blocks = raw.split(/\n\s*\n/);
  for (const block of blocks) {
    const lines = block
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    const qLine = lines.find((l) => /^Q:?\s*/i.test(l));
    if (!qLine) continue;
    const question = qLine.replace(/^Q:?\s*/i, "").trim();

    const options: string[] = [];
    let correctIndex = -1;
    for (const line of lines) {
      const optMatch = line.match(/^([A-D])\)\s*(.+)$/i);
      if (optMatch) {
        options.push(optMatch[2].trim());
        continue;
      }
      const correctMatch = line.match(/^Correct:?\s*([A-D])/i);
      if (correctMatch) {
        correctIndex = correctMatch[1].toUpperCase().charCodeAt(0) - 65;
      }
    }

    if (question && options.length === 4 && correctIndex >= 0 && correctIndex < 4) {
      questions.push({ question, options, correctIndex });
    }
  }
  return questions;
}
