/**
 * Tautology (spec §6.6).
 *
 * Sliding 15-word window. A lemma (stop-words excluded) repeated ≥2 times in a
 * window = 1 incident.
 *   tautScore: 0 incidents/min → 1.0; ≥4/min → 0; linear between.
 */

import { stem } from '../text/stemmer';
import { clamp01 } from '../util';

export const TAUT_WINDOW = 15;

/** ~50 stop-word lemmas (prepositions, conjunctions, pronouns, particles). */
export const STOP_LEMMAS = new Set([
  // prepositions
  'в', 'на', 'с', 'к', 'по', 'из', 'у', 'о', 'об', 'от', 'до', 'за', 'над',
  'под', 'при', 'про', 'для', 'без', 'через', 'между',
  // conjunctions / particles
  'и', 'а', 'но', 'да', 'или', 'что', 'чтобы', 'как', 'же', 'ли', 'бы', 'не',
  'ни', 'то', 'уж', 'вот', 'ведь', 'если', 'когда', 'потому',
  // pronouns
  'я', 'ты', 'он', 'она', 'оно', 'мы', 'вы', 'они', 'это', 'этот', 'тот',
  'мой', 'твой', 'свой', 'весь', 'себя', 'кто', 'все', 'его', 'её', 'их',
]);

export interface LemmaStat {
  total: number;
  windows: number;
  sample: string;
  /** STT confidences of this lemma's occurrences (for the §8.4.1 guard). */
  confs: (number | null)[];
}

export interface TautologyResult {
  incidents: number;
  incidentsPerMin: number;
  tautScore: number;
  /** Per-lemma stats for the tautology_word insight (§8.4.1). */
  byLemma: Map<string, LemmaStat>;
}

export interface TautologyInput {
  /** Normalized surface tokens of the transcript. */
  tokens: readonly string[];
  speechDurationMs: number;
  locale: 'ru' | 'en';
  /** Per-token STT confidence, parallel to `tokens` (optional). */
  confidences?: readonly (number | null)[];
}

export function computeTautology(input: TautologyInput): TautologyResult {
  const { tokens, speechDurationMs, locale, confidences } = input;
  const n = tokens.length;

  // Precompute lemma + stop flag per position.
  const lemmas = tokens.map((t) => stem(t, locale));
  const isStop = lemmas.map((l, i) => STOP_LEMMAS.has(l) || STOP_LEMMAS.has(tokens[i]));

  const byLemma = new Map<string, LemmaStat>();
  for (let i = 0; i < n; i++) {
    if (isStop[i]) continue;
    const entry = byLemma.get(lemmas[i]) ?? { total: 0, windows: 0, sample: tokens[i], confs: [] };
    entry.total++;
    entry.confs.push(confidences ? confidences[i] ?? null : null);
    byLemma.set(lemmas[i], entry);
  }

  let incidents = 0;
  const lastWindowMap = new Map<string, number>(); // lemma → last window index counted
  const windowCount = Math.max(0, n - TAUT_WINDOW + 1);
  for (let w = 0; w < windowCount; w++) {
    const freq = new Map<string, number>();
    for (let i = w; i < w + TAUT_WINDOW; i++) {
      if (isStop[i]) continue;
      freq.set(lemmas[i], (freq.get(lemmas[i]) ?? 0) + 1);
    }
    for (const [lemma, c] of freq) {
      if (c >= 2) {
        incidents++;
        // Count distinct windows per lemma for the insight threshold (≥2 windows).
        if (lastWindowMap.get(lemma) !== w) {
          lastWindowMap.set(lemma, w);
          const entry = byLemma.get(lemma);
          if (entry) entry.windows++;
        }
      }
    }
  }

  // Short transcripts (< window) can still repeat: count a single implicit window.
  if (windowCount === 0 && n > 1) {
    const freq = new Map<string, number>();
    for (let i = 0; i < n; i++) {
      if (isStop[i]) continue;
      freq.set(lemmas[i], (freq.get(lemmas[i]) ?? 0) + 1);
    }
    for (const [lemma, c] of freq) {
      if (c >= 2) {
        incidents++;
        const entry = byLemma.get(lemma);
        if (entry) entry.windows++;
      }
    }
  }

  const minutes = speechDurationMs / 60000;
  const incidentsPerMin = minutes > 0 ? incidents / minutes : 0;
  const tautScore = clamp01(1 - incidentsPerMin / 4);

  return { incidents, incidentsPerMin, tautScore, byLemma };
}
