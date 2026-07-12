/**
 * Word-level alignment of transcript ↔ reference (spec §5.2).
 *
 * Levenshtein DP with backtrace. Costs: match 0, substitution/insertion/
 * deletion 1. Fuzzy match: two words count as a match when the char-level
 * Levenshtein distance is ≤ 1 and the longer word is ≥ 5 chars — so STT
 * near-misses («карала»→«крала») don't wreck coverage.
 */

export type AlignOpType = 'match' | 'sub' | 'ins' | 'del';

export interface AlignOp {
  type: AlignOpType;
  /** Index into the reference words (match/sub/del). */
  refIdx?: number;
  /** Index into the hypothesis words (match/sub/ins). */
  hypIdx?: number;
}

export interface AlignResult {
  ops: AlignOp[];
  matches: number;
  substitutions: number;
  insertions: number;
  deletions: number;
  refWordCount: number;
  hypWordCount: number;
  /** matches / refWordCount. */
  coverage: number;
  /** (S + D + I) / refWordCount. */
  wer: number;
}

/** Char-level Levenshtein distance with an optional early-out cap. */
export function charLevenshtein(a: string, b: string, cap = Infinity): number {
  if (a === b) return 0;
  const n = a.length;
  const m = b.length;
  if (Math.abs(n - m) > cap) return cap + 1;
  if (n === 0) return m;
  if (m === 0) return n;
  let prev = new Array<number>(m + 1);
  let curr = new Array<number>(m + 1);
  for (let j = 0; j <= m; j++) prev[j] = j;
  for (let i = 1; i <= n; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j <= m; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > cap) return cap + 1;
    [prev, curr] = [curr, prev];
  }
  return prev[m];
}

/** Fuzzy word equality per §5.2. */
export function fuzzyEqual(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.max(a.length, b.length) < 5) return false;
  return charLevenshtein(a, b, 1) <= 1;
}

/**
 * Align reference words to hypothesis words. Deletions carry `refIdx`
 * (a reference word with no spoken counterpart); insertions carry `hypIdx`
 * (an extra spoken word).
 */
export function align(ref: readonly string[], hyp: readonly string[]): AlignResult {
  const n = ref.length;
  const m = hyp.length;

  // dp[i][j] = min edit distance between ref[0..i) and hyp[0..j).
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = 0; i <= n; i++) dp[i][0] = i;
  for (let j = 0; j <= m; j++) dp[0][j] = j;

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const same = fuzzyEqual(ref[i - 1], hyp[j - 1]);
      const diagCost = dp[i - 1][j - 1] + (same ? 0 : 1);
      const delCost = dp[i - 1][j] + 1; // ref word not matched
      const insCost = dp[i][j - 1] + 1; // extra hyp word
      dp[i][j] = Math.min(diagCost, delCost, insCost);
    }
  }

  // Backtrace, preferring diagonal on ties for a stable, intuitive alignment.
  const ops: AlignOp[] = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0) {
      const same = fuzzyEqual(ref[i - 1], hyp[j - 1]);
      const diagCost = dp[i - 1][j - 1] + (same ? 0 : 1);
      if (dp[i][j] === diagCost) {
        ops.push({
          type: same ? 'match' : 'sub',
          refIdx: i - 1,
          hypIdx: j - 1,
        });
        i--;
        j--;
        continue;
      }
    }
    if (i > 0 && dp[i][j] === dp[i - 1][j] + 1) {
      ops.push({ type: 'del', refIdx: i - 1 });
      i--;
      continue;
    }
    // j > 0
    ops.push({ type: 'ins', hypIdx: j - 1 });
    j--;
  }
  ops.reverse();

  let matches = 0;
  let substitutions = 0;
  let insertions = 0;
  let deletions = 0;
  for (const op of ops) {
    if (op.type === 'match') matches++;
    else if (op.type === 'sub') substitutions++;
    else if (op.type === 'ins') insertions++;
    else deletions++;
  }

  return {
    ops,
    matches,
    substitutions,
    insertions,
    deletions,
    refWordCount: n,
    hypWordCount: m,
    coverage: n > 0 ? matches / n : 0,
    wer: n > 0 ? (substitutions + deletions + insertions) / n : 0,
  };
}
