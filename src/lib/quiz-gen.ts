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

// A third technique, alongside the two above (see ai-cloud.ts): an
// optional cloud model can generate either kind directly as JSON, when the
// student has their own BYOK key and is online — parseCloudQuizJson/
// parseCloudFlashcardsJson below apply the same "drop what doesn't
// validate, don't guess" discipline as parseQuizResponse to that reply,
// since a cloud model's JSON-formatting compliance isn't any more
// guaranteed than the on-device model's own format compliance was.
import { stripJsonFence } from "@/lib/ai-cloud";

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

const MAX_CARDS = 15;

// A student asked for a varied deck size rather than the same fixed count
// every time — 5 is the smallest that still feels like a real study deck,
// 15 the largest before a single generation run starts feeling like a
// chore rather than a quick review. Only meaningful for the *generative*
// (cloud) path, which can be steered toward a specific count; the
// extractive path below returns however many real heading/answer pairs
// the document actually has (up to MAX_CARDS), never padded to hit this
// floor — see generateFlashcards' own comment on why faking cards to pad
// a deck isn't acceptable here.
export function pickFlashcardCount(): number {
  return 5 + Math.floor(Math.random() * 11); // 5..15 inclusive
}

// Same reasoning as pickFlashcardCount, for quiz length — 3 stays quick on
// slower on-device hardware, 10 is a real, substantial quiz for a student
// who wants more practice. Picked once per generation run (not per
// question) so the whole run — and its "Q current/total" progress — agree
// on a single total throughout.
export function pickQuizQuestionCount(): number {
  return 3 + Math.floor(Math.random() * 8); // 3..10 inclusive
}

// Real, reported bug: a heading like "Download" — a short navigational/
// structural label, not a real concept — mechanically became "What does
// 'Download' cover?" with a thin, low-value answer underneath (e.g. just
// "Android device iOS device" from a mobile-app instruction guide). No
// fixed blocklist of "bad" heading words would generalize across
// documents (a "Download" section is a real, substantive topic in a
// different PDF) — the reliable, generic signal is the *answer*, not the
// heading: a heading with real explanatory text under it makes a real
// flashcard; one with only a line or two of thin content doesn't, no
// matter what the heading itself says. Same "exclude, don't fake"
// discipline this file already applies to a document with no heading
// structure at all — a card testing recall of almost nothing isn't worth
// including just to pad the deck.
const MIN_BACK_CHARS = 60;

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
    const back = backParts.join(" ");
    if (front && back.length >= MIN_BACK_CHARS) {
      cards.push({ front, back });
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

/** The same source-text preparation (table-stripped, truncated to the
 * model's small char budget) used to build the generation prompt below —
 * exported so use-quiz.ts's QA-grounding step (see matchAnswerToOption) can
 * run the extractive QA model against the *exact* same chunk the question
 * was generated from, rather than a separately-recomputed one that could
 * silently drift out of sync with it. */
export function buildQuestionSource(text: string): string {
  return stripTableBlocks(text).slice(0, MAX_SOURCE_CHARS);
}

export function buildSingleQuestionPrompt(
  text: string,
  questionNumber: number,
  alreadyAsked: string[],
  totalQuestions: number,
): string {
  const source = buildQuestionSource(text);
  const avoid =
    alreadyAsked.length > 0
      ? `Do not repeat these already-asked questions: ${alreadyAsked.join(" | ")}\n`
      : "";
  return (
    `Write exactly 1 multiple-choice question (question ${questionNumber} of ${totalQuestions}) testing understanding of the study notes below. ` +
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

// Below this ratio, the extracted answer and the option it overlaps with
// don't share enough text to call it a real match — an unverified starting
// threshold (see ai-qa.ts's own comment on this model not yet having a
// real-device confirmation pass), not a tuned one.
const MIN_ANSWER_OVERLAP_RATIO = 0.5;

/** Best-effort fuzzy match between the QA model's extracted answer span
 * (ai-qa.ts) and this question's 4 MCQ option strings, so a genuinely
 * different answer than what the chat model asserted as "Correct" can
 * override it — grounding the quiz's scored answer in text actually pulled
 * from the source, not just the chat model's own self-reported letter.
 * Returns -1 if no option overlaps the extracted answer meaningfully;
 * callers should treat that as "inconclusive," not as "no option is
 * correct" — a real substring/word-overlap check is a blunt instrument for
 * short, differently-phrased option text, and a miss here doesn't mean the
 * chat model's own answer was wrong. */
export function matchAnswerToOption(extractedAnswer: string, options: string[]): number {
  const normalize = (s: string) => s.toLowerCase().trim();
  const answer = normalize(extractedAnswer);
  if (!answer) return -1;

  let bestIndex = -1;
  let bestScore = 0;
  options.forEach((option, i) => {
    const opt = normalize(option);
    if (!opt || !(opt.includes(answer) || answer.includes(opt))) return;
    const score = Math.min(answer.length, opt.length) / Math.max(answer.length, opt.length);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  });
  return bestScore >= MIN_ANSWER_OVERLAP_RATIO ? bestIndex : -1;
}

/** Parses a cloud model's JSON reply (see ai-cloud.ts's "quiz" prompt) into
 * real question objects, dropping any entry that doesn't validate rather
 * than guessing at a malformed one — same discipline as parseQuizResponse.
 * A completely unparseable reply (bad JSON, wrong shape, a non-array)
 * returns an empty array so the caller treats it exactly like any other
 * cloud failure and falls back to on-device generation. */
export function parseCloudQuizJson(raw: string): QuizQuestion[] {
  let data: unknown;
  try {
    data = JSON.parse(stripJsonFence(raw));
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];

  const questions: QuizQuestion[] = [];
  for (const entry of data) {
    const item = entry as Record<string, unknown>;
    if (
      item &&
      typeof item.question === "string" &&
      Array.isArray(item.options) &&
      item.options.length === 4 &&
      item.options.every((o) => typeof o === "string") &&
      typeof item.correctIndex === "number" &&
      item.correctIndex >= 0 &&
      item.correctIndex < 4
    ) {
      questions.push({
        question: item.question,
        options: item.options as string[],
        correctIndex: item.correctIndex,
      });
    }
  }
  return questions;
}

/** Same validation discipline as parseCloudQuizJson, for the "flashcards"
 * cloud prompt — capped at the same MAX_CARDS as the extractive path so a
 * cloud-generated deck can't come back unbounded. */
export function parseCloudFlashcardsJson(raw: string): Flashcard[] {
  let data: unknown;
  try {
    data = JSON.parse(stripJsonFence(raw));
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];

  const cards: Flashcard[] = [];
  for (const entry of data) {
    const item = entry as Record<string, unknown>;
    if (item && typeof item.front === "string" && typeof item.back === "string") {
      cards.push({ front: item.front, back: item.back });
    }
  }
  return cards.slice(0, MAX_CARDS);
}

/** Renders a generated quiz as the same lightweight `#`/`##`/`-` markup
 * structured-export.ts's buildStructuredExportHtml already knows how to
 * turn into a styled HTML download — reusing that exporter unchanged
 * rather than writing a second one, per each question its correct answer
 * bolded in-place via a leading "Correct:" bullet so the downloaded file is
 * a real study sheet, not just a blank quiz. */
export function buildQuizExportText(questions: QuizQuestion[]): string {
  return questions
    .map((q, i) => {
      const options = q.options.map((opt, j) => `- ${String.fromCharCode(65 + j)}. ${opt}`);
      return [
        `## ${i + 1}. ${q.question}`,
        options.join("\n\n"),
        `- Correct: ${String.fromCharCode(65 + q.correctIndex)}. ${q.options[q.correctIndex]}`,
      ].join("\n\n");
    })
    .join("\n\n");
}

/** Same purpose as buildQuizExportText, for a flashcard set — one heading
 * per card (the front) with its back as the body beneath, so the download
 * reads as real study notes rather than a raw data dump. */
export function buildFlashcardsExportText(cards: Flashcard[]): string {
  return cards.map((c, i) => `## ${i + 1}. ${c.front}\n\n${c.back}`).join("\n\n");
}
