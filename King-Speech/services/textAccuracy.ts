// Text-accuracy check for the tongue-twister level. The card shows a fixed text;
// we transcribe the player's audio and verify how many of its words were said.
// Fully deterministic (no AI, no server) → scales infinitely.
//
// Matching is by UNIQUE-WORD COVERAGE, not positional sequence: each distinct
// word of the twister counts as a hit if it appears ANYWHERE in the transcript.
// This is deliberate — ASR is unreliable and often collapses a phrase the player
// repeats (a twister with a slogan said twice comes back once), which under a
// positional match would score 7/14 = 50% even though every word was spoken.
// Unique coverage gives the fair result (every distinct word hit = 100%).
// Equality is lenient by one edit (Levenshtein ≤ 1 for words ≥ 4 chars) so ASR
// noise doesn't mark a correct word as missed.

export interface TextAccuracy {
  available: boolean;
  total: number; // expected words
  matched: number; // words actually said (in order)
  missed: number; // total - matched
  accuracy: number; // 0..1
  score10: number; // 0..10
  expected: { w: string; hit: boolean }[];
  missedWords: string[];
}

function wordsOf(s: string): string[] {
  return (s || "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^a-zа-я\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

// Levenshtein distance capped at 2 (we only care about ≤ 1).
function lev(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (Math.abs(m - n) > 1) return 2;
  let prev = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (cur[j] < rowMin) rowMin = cur[j];
    }
    if (rowMin > 1) return 2; // early out — we never need > 1
    prev = cur;
  }
  return prev[n];
}

function eq(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.min(a.length, b.length) >= 4) return lev(a, b) <= 1;
  return false;
}

export function checkTextAccuracy(expectedText: string, transcript: string): TextAccuracy {
  // Unique words of the twister (order preserved), so a repeated slogan counts
  // once and its repeat can't drag the score down.
  const expected = Array.from(new Set(wordsOf(expectedText)));
  const spoken = wordsOf(transcript);
  const total = expected.length;
  if (total === 0) {
    return { available: false, total: 0, matched: 0, missed: 0, accuracy: 0, score10: 0, expected: [], missedWords: [] };
  }
  if (spoken.length === 0) {
    return {
      available: false,
      total,
      matched: 0,
      missed: total,
      accuracy: 0,
      score10: 0,
      expected: expected.map((w) => ({ w, hit: false })),
      missedWords: expected.slice(),
    };
  }

  // Exact hits via a set (fast); fall back to a fuzzy scan (Levenshtein ≤ 1).
  const spokenSet = new Set(spoken);
  const hit = expected.map(
    (w) => spokenSet.has(w) || spoken.some((s) => eq(w, s)),
  );

  const matched = hit.filter(Boolean).length;
  const missed = total - matched;
  const accuracy = matched / total;
  return {
    available: true,
    total,
    matched,
    missed,
    accuracy,
    score10: accuracy * 10,
    expected: expected.map((w, k) => ({ w, hit: hit[k] })),
    missedWords: expected.filter((_, k) => !hit[k]),
  };
}
