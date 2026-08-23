// Text-accuracy check for the tongue-twister level. The card shows a fixed text;
// we transcribe the player's audio and verify how many of the expected words
// were actually said. Fully deterministic (no AI, no server) → scales infinitely.
//
// Matching uses an LCS (longest common subsequence) between the expected words
// and the spoken words, so word order is respected and repeats/extra words don't
// inflate the count. Equality is lenient by one edit (Levenshtein ≤ 1 for words
// ≥ 4 chars) so ASR noise doesn't unfairly mark a correct word as missed.

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
  const expected = wordsOf(expectedText);
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

  // LCS DP with lenient equality.
  const n = expected.length;
  const m = spoken.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      dp[i][j] = eq(expected[i - 1], spoken[j - 1])
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  // Backtrack to flag which expected words were matched.
  const hit = new Array(n).fill(false);
  let i = n;
  let j = m;
  while (i > 0 && j > 0) {
    if (eq(expected[i - 1], spoken[j - 1]) && dp[i][j] === dp[i - 1][j - 1] + 1) {
      hit[i - 1] = true;
      i--;
      j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

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
