/**
 * Insight engine (spec §8.4.1): detect concrete facts from this attempt so
 * feedback can name them ("«короче» прозвучало 6 раз"). Personalization without
 * AI — the evidence is already in the metrics.
 *
 * Critical guard (§8.4.1): an insight that names a specific word fires only if
 * (a) the word occurred ≥3 times AND (b) the mean STT confidence of those
 * occurrences ≥0.65. STT hallucinates short words, and accusing the player of a
 * filler they didn't say is far worse than staying silent.
 */

import { FillersResult } from '../core/metrics/fillers';
import { LemmaStat } from '../core/metrics/tautology';
import { ClarityWord } from '../core/metrics/clarity';
import { MarkResult } from '../core/metrics/pauses';
import { WordToken } from '../core/stt/types';
import { clamp01, mean } from '../core/util';

export type InsightId =
  | 'filler_word'
  | 'tautology_word'
  | 'volume_fade'
  | 'pace_drift'
  | 'strong_finish'
  | 'zero_fillers'
  | 'missed_words'
  | 'speed_over_clarity'
  | 'problem_cluster'
  | 'clean_sprint'
  | 'swallowed_marks'
  | 'ending_swallow'
  | 'monotone'
  | 'breath_breaks'
  | 'all_marks_hit'
  | 'syllable_hint';

export interface InsightEvidence {
  word?: string;
  count?: number;
  examples?: string[];
  location?: string;
  cluster?: string;
  syllables?: string;
}

export interface Insight {
  id: InsightId;
  kind: 'growth' | 'praise';
  severity: number; // 0..1 — how far it pulls down / up
  detectConf: number; // 0..1 — detection confidence (NOT STT confidence)
  evidence: InsightEvidence;
}

/** Word-naming threshold: ≥3 occurrences (§8.4.1, §8.4.2). */
export const NAME_MIN_COUNT = 3;
/** Word-naming threshold: mean STT confidence ≥0.65 (§8.4.1). */
export const NAME_MIN_CONF = 0.65;

/** Mean of the non-null confidences. */
function meanConf(confs: readonly (number | null)[]): number {
  const vals = confs.filter((c): c is number => c != null);
  return vals.length ? mean(vals) : 0;
}

/**
 * The false-accusation guard: a word may be named only when it occurred enough
 * times AND was heard confidently. Returns false → no insight, fallback runs.
 */
export function canNameWord(count: number, confs: readonly (number | null)[]): boolean {
  if (count < NAME_MIN_COUNT) return false;
  // If NO confidence is available at all (NO_CONF mode), we cannot verify the
  // word was actually said — stay silent to avoid false accusation.
  const hasAnyConf = confs.some((c) => c != null);
  if (!hasAnyConf) return false;
  return meanConf(confs) >= NAME_MIN_CONF;
}

// ---------------------------------------------------------------------------
// Common insights (all STT levels)
// ---------------------------------------------------------------------------

/** Top filler word, guarded (§8.4.1). */
export function detectFillerWord(fillers: FillersResult): Insight | null {
  let bestWord: string | null = null;
  let best: { count: number; confs: (number | null)[] } | null = null;
  for (const [word, occ] of fillers.byLemma) {
    if (!best || occ.count > best.count) {
      best = occ;
      bestWord = word;
    }
  }
  if (!best || bestWord === null) return null;
  if (!canNameWord(best.count, best.confs)) return null;
  return {
    id: 'filler_word',
    kind: 'growth',
    severity: clamp01(best.count / 6),
    detectConf: meanConf(best.confs),
    evidence: { word: bestWord, count: best.count },
  };
}

/** Repeated content lemma, guarded (§8.4.1). */
export function detectTautologyWord(byLemma: Map<string, LemmaStat>): Insight | null {
  let bestLemma: string | null = null;
  let best: LemmaStat | null = null;
  for (const [lemma, stat] of byLemma) {
    if (stat.total >= NAME_MIN_COUNT && stat.windows >= 2) {
      if (!best || stat.total > best.total) {
        best = stat;
        bestLemma = lemma;
      }
    }
  }
  if (!best || bestLemma === null) return null;
  if (!canNameWord(best.total, best.confs)) return null;
  return {
    id: 'tautology_word',
    kind: 'growth',
    severity: clamp01(best.total / 6),
    detectConf: meanConf(best.confs),
    evidence: { word: best.sample, count: best.total },
  };
}

/** Volume fade: last third ≥4 dB quieter than the first (§8.4.1). */
export function detectVolumeFade(firstMean: number, lastMean: number, hasData: boolean): Insight | null {
  if (!hasData) return null;
  const drop = firstMean - lastMean;
  if (drop < 4) return null;
  return {
    id: 'volume_fade',
    kind: 'growth',
    severity: clamp01(drop / 10),
    detectConf: 0.8,
    evidence: {},
  };
}

/** Pace drift: last third ≥1.25× the first third's wpm (§8.4.1). */
export function detectPaceDrift(firstWpm: number, lastWpm: number): Insight | null {
  if (firstWpm <= 0) return null;
  const ratio = lastWpm / firstWpm;
  if (ratio < 1.25) return null;
  return {
    id: 'pace_drift',
    kind: 'growth',
    severity: clamp01((ratio - 1.25) / 0.5 + 0.3),
    detectConf: 0.75,
    evidence: {},
  };
}

/** Strong finish (praise): no fade and no drift (§8.4.1). */
export function detectStrongFinish(
  firstMean: number,
  lastMean: number,
  firstWpm: number,
  lastWpm: number,
  hasData: boolean,
): Insight | null {
  if (!hasData || firstWpm <= 0) return null;
  const noFade = lastMean >= firstMean - 1;
  const steady = lastWpm / firstWpm <= 1.1;
  if (!noFade || !steady) return null;
  return { id: 'strong_finish', kind: 'praise', severity: 0.6, detectConf: 0.7, evidence: {} };
}

/** Zero fillers on a substantial sample (praise, §8.4.1). */
export function detectZeroFillers(fillerCount: number, spokenWords: number): Insight | null {
  if (fillerCount !== 0 || spokenWords < 60) return null;
  return {
    id: 'zero_fillers',
    kind: 'praise',
    severity: 0.7,
    detectConf: 0.9,
    evidence: { count: spokenWords },
  };
}

// ---------------------------------------------------------------------------
// Reading / Literature insights
// ---------------------------------------------------------------------------

/** ≥3 swallowed punctuation marks (§8.4.1). */
export function detectSwallowedMarks(swallowed: readonly MarkResult[]): Insight | null {
  if (swallowed.length < 3) return null;
  const commas = swallowed.filter((m) => m.kind === 'comma');
  const sample = (commas[0] ?? swallowed[0]).word;
  return {
    id: 'swallowed_marks',
    kind: 'growth',
    severity: clamp01(swallowed.length / 6),
    detectConf: 0.8,
    evidence: { count: swallowed.length, location: sample },
  };
}

/** ≥3 ending-swallow incidents (§7.2 heuristic). */
export function detectEndingSwallow(incidents: number): Insight | null {
  if (incidents < 3) return null;
  return {
    id: 'ending_swallow',
    kind: 'growth',
    severity: clamp01(incidents / 6),
    detectConf: 0.7,
    evidence: { count: incidents },
  };
}

/** Monotone flag from §7.2. */
export function detectMonotone(monotone: boolean): Insight | null {
  if (!monotone) return null;
  return { id: 'monotone', kind: 'growth', severity: 0.7, detectConf: 0.85, evidence: {} };
}

/** ≥2 out-of-text breath breaks (§8.4.1). */
export function detectBreathBreaks(breaks: number): Insight | null {
  if (breaks < 2) return null;
  return {
    id: 'breath_breaks',
    kind: 'growth',
    severity: clamp01(breaks / 5),
    detectConf: 0.7,
    evidence: { count: breaks },
  };
}

/** All marks hit (praise, §8.4.1). */
export function detectAllMarksHit(punctScore: number, evaluatedMarks: number): Insight | null {
  if (evaluatedMarks < 3 || punctScore < 0.9) return null;
  return { id: 'all_marks_hit', kind: 'praise', severity: 0.7, detectConf: 0.85, evidence: {} };
}

// ---------------------------------------------------------------------------
// Tongue-twister insights
// ---------------------------------------------------------------------------

/** Problem consonant cluster from the soundmap (§7.1). */
export function detectProblemCluster(cluster: string | null): Insight | null {
  if (!cluster) return null;
  return {
    id: 'problem_cluster',
    kind: 'growth',
    severity: 0.6,
    detectConf: 0.7,
    evidence: { cluster },
  };
}

/** attempt 3: fast AND clear (praise, §8.4.1). */
export function detectCleanSprint(clarity: number, tempoScore: number): Insight | null {
  if (clarity < 0.85 || tempoScore < 0.7) return null;
  return { id: 'clean_sprint', kind: 'praise', severity: 0.8, detectConf: 0.8, evidence: {} };
}

/** attempt 3: tempoScore ≥0.7 but clarity dropped ≥0.2 vs attempt 1 (§8.4.1). */
export function detectSpeedOverClarity(
  attempt3Tempo: number,
  attempt3Clarity: number,
  attempt1Clarity: number,
): Insight | null {
  if (attempt3Tempo < 0.7) return null;
  if (attempt1Clarity - attempt3Clarity < 0.2) return null;
  return {
    id: 'speed_over_clarity',
    kind: 'growth',
    severity: clamp01(attempt1Clarity - attempt3Clarity),
    detectConf: 0.8,
    evidence: {},
  };
}

/** Reference words failed/deleted across attempts (§8.4.1). */
export function detectMissedWords(word: string | null): Insight | null {
  if (!word) return null;
  return {
    id: 'missed_words',
    kind: 'growth',
    severity: 0.6,
    detectConf: 0.75,
    evidence: { word },
  };
}

// ---------------------------------------------------------------------------
// Vocabulary insight
// ---------------------------------------------------------------------------

/** Low confidence on the target word → syllable hint (§8.4.1). */
export function detectSyllableHint(word: string, conf: number | null, syllables: string): Insight | null {
  if (conf != null && conf >= 0.7) return null;
  return {
    id: 'syllable_hint',
    kind: 'growth',
    severity: 0.6,
    detectConf: 0.7,
    evidence: { word, syllables },
  };
}

// ---------------------------------------------------------------------------
// Helpers for temporal (thirds) insights
// ---------------------------------------------------------------------------

/** wpm of the first vs last third of spoken words, by word timings. */
export function thirdsWpm(hypWords: readonly WordToken[]): { firstWpm: number; lastWpm: number } {
  const timed = hypWords.filter((w) => w.endMs > w.startMs && w.endMs > 0);
  if (timed.length < 6) return { firstWpm: 0, lastWpm: 0 };
  const third = Math.floor(timed.length / 3);
  const wpmOf = (slice: WordToken[]): number => {
    if (slice.length === 0) return 0;
    const spanMs = slice[slice.length - 1].endMs - slice[0].startMs;
    if (spanMs <= 0) return 0;
    return slice.length / (spanMs / 60000);
  };
  return {
    firstWpm: wpmOf(timed.slice(0, third)),
    lastWpm: wpmOf(timed.slice(timed.length - third)),
  };
}

/** Pick a named missed word from clarity per-word data (failed or deleted). */
export function pickMissedWord(perWord: readonly ClarityWord[]): string | null {
  const candidates = perWord.filter((w) => (w.failed || w.deleted) && w.refWord.length >= 4);
  if (candidates.length === 0) return null;
  // Prefer the longest (most "content-y") word.
  candidates.sort((a, b) => b.refWord.length - a.refWord.length);
  return candidates[0].refWord;
}
