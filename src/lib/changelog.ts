// A hand-maintained "what's new" list, shown from Settings (see
// use-changelog.ts). Plain-language, student-facing entries only — the
// technical record of every change lives in DEV_LOG.md/git history
// instead; this is deliberately a short, curated subset of what actually
// changed for a student using the app, not an engineering changelog.
// Bump APP_VERSION and add one new entry at the top of CHANGELOG whenever
// a real, user-visible batch of changes ships.

export const APP_VERSION = "1.2.0";

export type ChangelogEntry = {
  version: string;
  date: string; // YYYY-MM-DD
  items: string[];
};

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "1.2.0",
    date: "2026-07-29",
    items: [
      "A splash screen so it's always clear which app you're in while it loads",
      "Google's Gemini Nano added as an on-device AI option on desktop Chrome, and set as the default there",
      "AI model downloads now resume instead of restarting from zero if interrupted, and on most Chrome-based browsers keep going in the background even if you close the tab",
      "Fixed a real bug where an interrupted AI model download could get stuck failing forever until you fully reloaded the app",
      "Research consent can now be given anonymously if you'd rather not have your name attached",
      "Clearer, more honest guidance about the on-device AI's real limits, with a pointer to connecting a free cloud AI key for anything you need a dependable answer for",
    ],
  },
  {
    version: "1.1.0",
    date: "2026-07-25",
    items: [
      "Upload Word documents (.docx), not just PDFs, with the exact same reading, chat, quiz, flashcard, and summary features",
      "Jump straight to the top or bottom of a long document instead of scrolling",
      "Fixed tables and glossaries (like a list of abbreviations) extracting correctly instead of getting jumbled",
      "A livelier, more polished welcome screen",
      "Stay signed in more reliably across app switches and slow connections",
      "Settings reorganized into clearer groups",
      "Faster, more resilient offline support, including self-hosted fonts and honest offline messaging where a page can't confirm live data",
      "Anonymous suggestions can now include a screenshot or photo, not just text",
      "Cleaned up leftover formatting glitches in AI responses and app text",
    ],
  },
];
