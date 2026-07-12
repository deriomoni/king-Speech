/**
 * Shared helpers for the level analyzers.
 *
 * Turns an `SttResult` into normalized, alignment-ready tokens and derives a
 * speech duration from word timings when the acoustic VAD isn't available
 * (e.g. tongue-twister unit tests, spec §11.5).
 */

import { align, AlignResult } from '../core/text/align';
import { normalizeText } from '../core/text/normalize';
import { SttResult, WordToken } from '../core/stt/types';

/**
 * Normalize STT word tokens for alignment, preserving timing/confidence.
 * A token that normalizes into several words (rare) is split, sharing timing.
 */
export function normalizeHyp(stt: SttResult): WordToken[] {
  const out: WordToken[] = [];
  for (const w of stt.words) {
    const norm = normalizeText(w.text);
    if (!norm) continue;
    const parts = norm.split(' ');
    for (const p of parts) {
      out.push({ text: p, startMs: w.startMs, endMs: w.endMs, confidence: w.confidence });
    }
  }
  return out;
}

export interface AlignedReference {
  refWords: string[];
  normHyp: WordToken[];
  align: AlignResult;
}

export function alignReference(referenceRaw: string, stt: SttResult): AlignedReference {
  const refWords = normalizeText(referenceRaw).split(' ').filter(Boolean);
  const normHyp = normalizeHyp(stt);
  return {
    refWords,
    normHyp,
    align: align(refWords, normHyp.map((w) => w.text)),
  };
}

/** Speech duration (ms) from word timings — a fallback when VAD is absent. */
export function speechDurationFromTimings(words: readonly WordToken[]): number {
  const timed = words.filter((w) => w.endMs > w.startMs && w.endMs > 0);
  if (timed.length === 0) return 0;
  // Sum of spoken spans (pauses between words excluded, matching §6.2 intent).
  let sum = 0;
  for (const w of timed) sum += w.endMs - w.startMs;
  return sum;
}

/** Normalized transcript tokens (for filler/tautology/diversity metrics). */
export function transcriptTokens(stt: SttResult): string[] {
  return normalizeHyp(stt).map((w) => w.text);
}
