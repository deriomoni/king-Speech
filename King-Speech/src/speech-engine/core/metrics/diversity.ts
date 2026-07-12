/**
 * Lexical diversity (spec §6.7).
 *
 * MATTR (moving-average type-token ratio), window 50 words — robust to length,
 * unlike raw TTR.
 *   divScore = clamp01((MATTR − 0.55) / 0.30)   // 0.55 → 0, 0.85 → 1
 * Only computed when spokenWords ≥ 60; otherwise it does not participate and
 * its weight is redistributed by the analyzer.
 */

import { clamp01 } from '../util';

export const MATTR_WINDOW = 50;
export const MIN_WORDS_FOR_DIVERSITY = 60;

export interface DiversityResult {
  computed: boolean;
  mattr: number;
  divScore: number;
}

export function computeDiversity(tokens: readonly string[]): DiversityResult {
  const n = tokens.length;
  if (n < MIN_WORDS_FOR_DIVERSITY) {
    return { computed: false, mattr: 0, divScore: 0 };
  }

  let mattr: number;
  if (n < MATTR_WINDOW) {
    mattr = new Set(tokens).size / n;
  } else {
    let sum = 0;
    const windows = n - MATTR_WINDOW + 1;
    for (let w = 0; w < windows; w++) {
      const seen = new Set<string>();
      for (let i = w; i < w + MATTR_WINDOW; i++) seen.add(tokens[i]);
      sum += seen.size / MATTR_WINDOW;
    }
    mattr = sum / windows;
  }

  const divScore = clamp01((mattr - 0.55) / 0.3);
  return { computed: true, mattr, divScore };
}
