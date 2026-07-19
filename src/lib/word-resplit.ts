// Last-mile fix for a real extraction failure mode: pdf.js's own internal
// text-assembly step always runs a fixed-threshold heuristic to decide
// where word-boundary spaces belong, before this app's code ever sees the
// text (confirmed by reading pdfjs-dist's own worker source — there is no
// public option to disable or tune it in the installed version). For some
// PDF generators, certain lines' inter-word gaps are encoded in a way that
// heuristic misjudges, and pdf.js hands back a single fused run with the
// words already glued together with no space at all — by that point there
// is no fragment boundary left for this app's own inter-fragment gap-merge
// logic (see pdf-extract.ts) to act on; it's a single string, not multiple
// runs to compare.
//
// The only generically viable fix at that point is a last-mile,
// dictionary-based word re-segmentation over suspiciously long unbroken
// runs — real, ordinary PDFs never trigger this at all (the fast-path
// check below skips the wordlist fetch entirely for them).

// Longest ordinary English words run well under this (e.g.
// "electroencephalograph" is 21 characters) — a run has to be genuinely
// glued-together, not just one long real word, before this even attempts
// anything.
const GLUED_RUN_LENGTH = 22;
const GLUED_RUN_TEST = /[A-Za-z]{22,}/;
const GLUED_RUN_REPLACE = /[A-Za-z]{22,}/g;

// Bounds how far back the segmenter looks for a candidate word ending at
// each position — real English words essentially never exceed this, and
// keeping it small keeps the DP below cheap even for a long glued run.
const MAX_WORD_LEN = 20;

// See the averageCost check in segmentRun — calibrated empirically against
// real glued strings (should pass) and real single long words/gibberish
// (should be rejected), not picked arbitrarily.
const MAX_AVERAGE_WORD_COST = 7;

let wordRanksPromise: Promise<Map<string, number>> | null = null;

/** Loads the bundled word-frequency list (see public/wordlists/) lazily,
 * once, cached for the module's lifetime — most documents never trigger
 * this at all. Mirrors ai-model.ts's own "don't cache a failed load"
 * pattern: a fetch failure clears the cached promise so the next call
 * retries from scratch instead of failing forever. */
async function loadWordRanks(): Promise<Map<string, number>> {
  if (!wordRanksPromise) {
    wordRanksPromise = fetch("/wordlists/en-frequency.txt")
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load wordlist: ${res.status}`);
        return res.text();
      })
      .then((body) => {
        const ranks = new Map<string, number>();
        const words = body.split("\n");
        for (let i = 0; i < words.length; i++) {
          const word = words[i].trim();
          if (word) ranks.set(word, i);
        }
        return ranks;
      });
    wordRanksPromise.catch(() => {
      wordRanksPromise = null;
    });
  }
  return wordRanksPromise;
}

/** Finds the lowest-cost way to split `run` entirely into words present in
 * `wordRanks` (a rank-ordered dictionary — lower rank means more common,
 * cheaper), via a standard word-segmentation DP (Viterbi-style: cost per
 * word derived from its frequency rank, total cost minimized over the
 * whole run). Returns `null` if no split into ≥2 recognized words covers
 * the *entire* run — a partial or single-word "segmentation" isn't good
 * enough evidence to rewrite anything; leaving an unrecognized run
 * untouched is always safer than guessing at a split for it. */
function segmentRun(run: string, wordRanks: Map<string, number>): string[] | null {
  const n = run.length;
  const lower = run.toLowerCase();
  const cost = new Array<number>(n + 1).fill(Infinity);
  const back = new Array<number>(n + 1).fill(-1);
  cost[0] = 0;

  for (let end = 1; end <= n; end++) {
    const start = Math.max(0, end - MAX_WORD_LEN);
    for (let begin = start; begin < end; begin++) {
      if (cost[begin] === Infinity) continue;
      const candidate = lower.slice(begin, end);
      // The source frequency list (real subtitle-derived text) includes
      // plenty of single-letter noise — informal interjections, initials,
      // stray characters that happened to appear in the corpus — which
      // otherwise lets almost *any* long run "fully segment" by falling
      // back to individual letters no matter how nonsensical the result.
      // "a"/"i" are the only real single-letter English words, so every
      // other single letter is excluded from being used as a segment here.
      if (candidate.length === 1 && candidate !== "a" && candidate !== "i") continue;
      const rank = wordRanks.get(candidate);
      if (rank === undefined) continue;
      const candidateCost = cost[begin] + Math.log(rank + 2);
      if (candidateCost < cost[end]) {
        cost[end] = candidateCost;
        back[end] = begin;
      }
    }
  }

  if (cost[n] === Infinity) return null;

  const words: string[] = [];
  for (let i = n; i > 0;) {
    const start = back[i];
    words.unshift(run.slice(start, i)); // original casing, not `lower`
    i = start;
  }
  if (words.length < 2) return null;

  // A *complete* cover always exists once enough obscure short entries are
  // in the dictionary (rare two-letter abbreviations, stray initials) —
  // completeness alone isn't proof the split is real. A genuine sentence
  // made of real words (even short, common ones like "is"/"it"/"a") has a
  // low *average* cost per word, since common words rank low regardless of
  // length; a forced-fit split of one long unrecognized word into obscure
  // fragments needs several high-rank (rare) entries to fully cover it, so
  // its average cost per word is reliably much higher. This is what
  // actually distinguishes "you have read these" from "elect ro en ce".
  const averageCost = cost[n] / words.length;
  if (averageCost > MAX_AVERAGE_WORD_COST) return null;

  return words;
}

/** Re-splits words glued together by the extraction failure mode described
 * above. Safe to call on every extracted document — the fast-path check
 * means ordinary PDFs (the overwhelming majority) never even fetch the
 * wordlist. Only ever adds spaces into runs that fully, unambiguously
 * segment into real recognized words; anything else is left exactly as
 * extracted. */
export async function resplitGluedWords(text: string): Promise<string> {
  if (!GLUED_RUN_TEST.test(text)) return text;

  let wordRanks: Map<string, number>;
  try {
    wordRanks = await loadWordRanks();
  } catch (err) {
    console.error("Failed to load word-resplit dictionary, skipping", err);
    return text;
  }

  return text.replace(GLUED_RUN_REPLACE, (run) => {
    const words = segmentRun(run, wordRanks);
    return words ? words.join(" ") : run;
  });
}

// Exported for direct unit testing against known-glued strings — see
// GLUED_RUN_LENGTH's own reasoning above for why this threshold exists.
export const __internal = { segmentRun, GLUED_RUN_LENGTH };
