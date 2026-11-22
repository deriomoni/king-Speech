// Text-accuracy check for the tongue-twister level. The card shows a fixed text;
// we transcribe the player's audio and verify how closely it was said.
// Fully deterministic (no AI, no server) → scales infinitely.
//
// Matching is a word-level ALIGNMENT of the whole twister against the
// transcript (edit distance over words), so every slip counts:
//   · a word said wrong (another word, a changed ending: «Греку» → «грека») — 1
//   · a word skipped, including a skipped repeat («лавировали, лавировали») — 1
//   · an extra word slipped in («через гречку реку») — ½
// accuracy = 1 − errors / words in the twister.
// ASR noise tolerance is kept small: only long words (≥ 6 letters) may differ
// by one letter, so a mangled short word or ending isn't forgiven.

export interface TextAccuracy {
  available: boolean;
  total: number; // expected words
  matched: number; // expected words said correctly
  missed: number; // total - matched
  accuracy: number; // 0..1
  score10: number; // 0..10
  expected: { w: string; hit: boolean }[];
  missedWords: string[];
}

const INSERT_COST = 0.5;

function wordsOf(s: string): string[] {
  return (s || "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^a-zа-яәғқңөұүһі\s]/gi, " ")
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
  if (Math.min(a.length, b.length) >= 6) return lev(a, b) <= 1;
  return false;
}

export function checkTextAccuracy(expectedText: string, transcript: string): TextAccuracy {
  const exp = wordsOf(expectedText);
  const spoken = wordsOf(transcript);
  const total = exp.length;
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
      expected: exp.map((w) => ({ w, hit: false })),
      missedWords: exp.slice(),
    };
  }

  // Weighted edit distance: substitution / deletion 1, insertion ½.
  const n = exp.length;
  const m = spoken.length;
  const d: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = 1; i <= n; i++) d[i][0] = i;
  for (let j = 1; j <= m; j++) d[0][j] = j * INSERT_COST;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      d[i][j] = Math.min(
        d[i - 1][j - 1] + (eq(exp[i - 1], spoken[j - 1]) ? 0 : 1),
        d[i - 1][j] + 1,
        d[i][j - 1] + INSERT_COST,
      );
    }
  }

  // Walk back to mark which expected words were said correctly.
  const hit = new Array<boolean>(n).fill(false);
  let i = n;
  let j = m;
  while (i > 0 && j > 0) {
    const same = eq(exp[i - 1], spoken[j - 1]);
    if (d[i][j] === d[i - 1][j - 1] + (same ? 0 : 1)) {
      hit[i - 1] = same;
      i--;
      j--;
    } else if (d[i][j] === d[i - 1][j] + 1) {
      i--;
    } else {
      j--;
    }
  }

  const errors = d[n][m];
  const accuracy = Math.max(0, 1 - errors / total);
  const matched = hit.filter(Boolean).length;
  return {
    available: true,
    total,
    matched,
    missed: total - matched,
    accuracy,
    score10: Math.round(accuracy * 100) / 10,
    expected: exp.map((w, k) => ({ w, hit: hit[k] })),
    missedWords: exp.filter((_, k) => !hit[k]),
  };
}
