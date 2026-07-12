/**
 * Clarity — the primary metric (spec §6.1).
 *
 * STT auto-corrects mumbled speech toward known phrases, so a text match does
 * NOT prove clarity — confidence does. Per matched reference word:
 *   conf ≥ 0.85            → 1.0
 *   0.55 ≤ conf < 0.85     → (conf − 0.55) / 0.30
 *   conf < 0.55            → 0
 *   substituted word       → 0.25
 *   deleted word           → 0
 *   clarity = Σ score / refWordCount
 *
 * NO_CONF mode (§9): confidence is unavailable, so matched=0.9, fuzzy=0.6,
 * sub=0.25; weights unchanged, and feedback must not claim clarity was measured
 * precisely.
 */

import { AlignOp } from '../text/align';
import { SttMode } from '../stt/types';
import { WordToken } from '../stt/types';

export interface ClarityWord {
  refIdx: number;
  hypIdx: number | null;
  refWord: string;
  hypWord: string | null;
  confidence: number | null;
  score: number;
  /** Matched but conf < 0.55 (only meaningful in FULL mode). */
  failed: boolean;
  /** Matched with 0.55 ≤ conf < 0.85. */
  smeared: boolean;
  /** Reference word with no spoken counterpart. */
  deleted: boolean;
  /** Matched via fuzzy equality rather than exact. */
  fuzzy: boolean;
}

export interface ClarityResult {
  clarity: number;
  perWord: ClarityWord[];
  mode: SttMode;
}

function scoreConfidence(conf: number): number {
  if (conf >= 0.85) return 1;
  if (conf >= 0.55) return (conf - 0.55) / 0.3;
  return 0;
}

export interface ClarityInput {
  ops: readonly AlignOp[];
  refWords: readonly string[];
  hypWords: readonly WordToken[];
  mode: SttMode;
}

export function computeClarity(input: ClarityInput): ClarityResult {
  const { ops, refWords, hypWords, mode } = input;
  const refCount = refWords.length;
  const perWord: ClarityWord[] = [];
  let sum = 0;

  for (const op of ops) {
    if (op.type === 'ins') continue; // extra spoken words aren't reference words

    const refIdx = op.refIdx ?? -1;
    const refWord = refIdx >= 0 ? refWords[refIdx] : '';

    if (op.type === 'del') {
      perWord.push({
        refIdx,
        hypIdx: null,
        refWord,
        hypWord: null,
        confidence: null,
        score: 0,
        failed: false,
        smeared: false,
        deleted: true,
        fuzzy: false,
      });
      continue;
    }

    if (op.type === 'sub') {
      const hyp = op.hypIdx != null ? hypWords[op.hypIdx] : undefined;
      perWord.push({
        refIdx,
        hypIdx: op.hypIdx ?? null,
        refWord,
        hypWord: hyp?.text ?? null,
        confidence: hyp?.confidence ?? null,
        score: 0.25,
        failed: false,
        smeared: false,
        deleted: false,
        fuzzy: false,
      });
      sum += 0.25;
      continue;
    }

    // op.type === 'match'
    const hyp = op.hypIdx != null ? hypWords[op.hypIdx] : undefined;
    const conf = hyp?.confidence ?? null;
    const fuzzy = hyp ? refWord !== hyp.text : false;

    let score: number;
    let failed = false;
    let smeared = false;
    if (mode === 'NO_CONF' || conf === null) {
      // No usable confidence → fixed proxies (§9).
      score = fuzzy ? 0.6 : 0.9;
    } else {
      score = scoreConfidence(conf);
      failed = conf < 0.55;
      smeared = conf >= 0.55 && conf < 0.85;
    }
    sum += score;
    perWord.push({
      refIdx,
      hypIdx: op.hypIdx ?? null,
      refWord,
      hypWord: hyp?.text ?? null,
      confidence: conf,
      score,
      failed,
      smeared,
      deleted: false,
      fuzzy,
    });
  }

  return {
    clarity: refCount > 0 ? sum / refCount : 0,
    perWord,
    mode,
  };
}
