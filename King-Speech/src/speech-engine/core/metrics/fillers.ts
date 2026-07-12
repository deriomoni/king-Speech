/**
 * Filler words (spec §6.5).
 *
 * Dictionary of ru lemmas; bigrams («как бы», «это самое», …) are matched on the
 * raw token sequence before stemming. Known limitation: native STT normalizes
 * «эээ/ммм», so those never reach the transcript — an acoustic filled-pause
 * detector is Phase 2 (`detectFilledPauses` is a stub with a TODO).
 *
 *   fillerRate = fillers / speechDurMin
 *   score: rate ≤ 1 → 1.0; rate ≥ 6 → 0; linear between.
 */

import { WordToken } from '../stt/types';
import { clamp01 } from '../util';

/** Single-word fillers (invariant forms, matched on the normalized token). */
export const FILLER_WORDS = new Set([
  'ну', 'вот', 'типа', 'короче', 'значит', 'собственно', 'блин', 'э', 'м',
]);

/** Multi-word fillers, matched as consecutive tokens (before stemming). */
export const FILLER_BIGRAMS: [string, string][] = [
  ['как', 'бы'],
  ['это', 'самое'],
  ['в', 'общем'],
  ['так', 'сказать'],
];

export interface FillerOccurrence {
  count: number;
  /** Confidence of each occurrence (null when unavailable). */
  confs: (number | null)[];
}

export interface FillersResult {
  fillers: number;
  rate: number;
  score: number;
  /** Per display-lemma occurrences, for the filler_word insight (§8.4.1). */
  byLemma: Map<string, FillerOccurrence>;
}

function norm(t: string): string {
  return t.toLowerCase().replace(/ё/g, 'е');
}

function bump(map: Map<string, FillerOccurrence>, key: string, conf: number | null): void {
  const cur = map.get(key) ?? { count: 0, confs: [] };
  cur.count++;
  cur.confs.push(conf);
  map.set(key, cur);
}

function avgConf(a: number | null, b: number | null): number | null {
  const vals = [a, b].filter((v): v is number => v != null);
  if (vals.length === 0) return null;
  return vals.reduce((s, v) => s + v, 0) / vals.length;
}

export function computeFillers(
  hypWords: readonly WordToken[],
  speechDurationMs: number,
): FillersResult {
  const byLemma = new Map<string, FillerOccurrence>();
  let fillers = 0;
  const tokens = hypWords.map((w) => ({ text: norm(w.text), conf: w.confidence }));

  for (let i = 0; i < tokens.length; i++) {
    // Bigrams first so their words aren't double-counted as single fillers.
    let matchedBigram = false;
    if (i + 1 < tokens.length) {
      for (const [a, b] of FILLER_BIGRAMS) {
        if (tokens[i].text === a && tokens[i + 1].text === b) {
          bump(byLemma, `${a} ${b}`, avgConf(tokens[i].conf, tokens[i + 1].conf));
          fillers++;
          i++; // consume second token
          matchedBigram = true;
          break;
        }
      }
    }
    if (matchedBigram) continue;
    if (FILLER_WORDS.has(tokens[i].text)) {
      bump(byLemma, tokens[i].text, tokens[i].conf);
      fillers++;
    }
  }

  const minutes = speechDurationMs / 60000;
  const rate = minutes > 0 ? fillers / minutes : 0;
  const score = clamp01((6 - rate) / 5); // rate 1 → 1.0, rate 6 → 0

  return { fillers, rate, score, byLemma };
}

/**
 * Acoustic filled-pause detector — Phase 2, intentionally not implemented here.
 * TODO(phase-2): detect «эээ/ммм» from the RMS/spectral envelope since STT
 * strips them from the transcript.
 */
export function detectFilledPauses(): null {
  return null;
}
