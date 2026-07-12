/**
 * Tongue-twister analyzer (spec §7.1).
 *
 * Goal: hold intelligibility as tempo rises — not speed for its own sake. The
 * clarity bar does NOT drop as tempo grows; that is the point of the level.
 *
 *   attempt 1: tempo NOT scored; raw = 100·(0.65·clarity + 0.35·coverage)
 *   attempt 2: target = baseWPM
 *   attempt 3: target = 1.3·baseWPM
 *   attempt 2,3: raw = 100·(0.55·clarity + 0.30·coverage + 0.15·tempoScore)
 */

import { computeClarity, ClarityWord } from '../core/metrics/clarity';
import { computeTempo } from '../core/metrics/tempo';
import { SttResult } from '../core/stt/types';
import { SttMode } from '../core/stt/types';
import {
  detectCleanSprint,
  detectMissedWords,
  detectProblemCluster,
  detectSpeedOverClarity,
  Insight,
} from '../feedback/insights';
import { MetricValue } from '../feedback/selector';
import { RawMetrics } from '../types';
import { alignReference, speechDurationFromTimings } from './context';

export const DEFAULT_BASE_WPM = 90;

export interface TongueTwisterInput {
  referenceRaw: string;
  stt: SttResult;
  attempt: 1 | 2 | 3;
  baseWPM?: number;
  mode: SttMode;
  /** Speech duration from VAD; falls back to word timings when omitted. */
  speechDurationMs?: number;
  /** attempt-1 clarity, for the speed_over_clarity insight (attempt 3). */
  attempt1Clarity?: number;
  /** A reference word repeatedly failed across attempts (missed_words). */
  missedWord?: string | null;
  /** Problem consonant cluster from the soundmap. */
  problemCluster?: string | null;
}

export interface TongueTwisterOutput {
  raw: number;
  metrics: RawMetrics;
  insights: Insight[];
  metricValues: MetricValue[];
  clarity: number;
  coverage: number;
  tempoScore: number | null;
  /** Per-word clarity detail — the caller updates the soundmap from failures. */
  clarityPerWord: ClarityWord[];
}

function targetFor(attempt: 1 | 2 | 3, baseWPM: number): number | null {
  if (attempt === 1) return null;
  if (attempt === 2) return baseWPM;
  return 1.3 * baseWPM;
}

export function analyzeTongueTwister(input: TongueTwisterInput): TongueTwisterOutput {
  const baseWPM = input.baseWPM && input.baseWPM > 0 ? input.baseWPM : DEFAULT_BASE_WPM;
  const { refWords, normHyp, align } = alignReference(input.referenceRaw, input.stt);

  const clarityResult = computeClarity({
    ops: align.ops,
    refWords,
    hypWords: normHyp,
    mode: input.mode,
  });
  const clarity = clarityResult.clarity;
  const coverage = align.coverage;

  const speechDurationMs =
    input.speechDurationMs != null ? input.speechDurationMs : speechDurationFromTimings(normHyp);
  const target = targetFor(input.attempt, baseWPM);
  const { wpm, tempoScore } = computeTempo(normHyp.length, speechDurationMs, target);

  let raw: number;
  if (input.attempt === 1) {
    raw = 100 * (0.65 * clarity + 0.35 * coverage);
  } else {
    const ts = tempoScore ?? 0;
    raw = 100 * (0.55 * clarity + 0.3 * coverage + 0.15 * ts);
  }

  // Insights.
  const insights: Insight[] = [];
  if (input.attempt === 3 && tempoScore != null) {
    const clean = detectCleanSprint(clarity, tempoScore);
    if (clean) insights.push(clean);
    if (input.attempt1Clarity != null) {
      const soc = detectSpeedOverClarity(tempoScore, clarity, input.attempt1Clarity);
      if (soc) insights.push(soc);
    }
  }
  const cluster = detectProblemCluster(input.problemCluster ?? null);
  if (cluster) insights.push(cluster);
  const missed = detectMissedWords(input.missedWord ?? null);
  if (missed) insights.push(missed);

  const metrics: RawMetrics = {
    raw,
    mode: input.mode,
    clarity,
    coverage,
    wpm,
    tempoScore,
  };

  const metricValues: MetricValue[] = [
    { key: 'clarity', value: clarity, computed: true },
    { key: 'tempo', value: tempoScore ?? 0, computed: tempoScore != null },
  ];

  return {
    raw,
    metrics,
    insights,
    metricValues,
    clarity,
    coverage,
    tempoScore,
    clarityPerWord: clarityResult.perWord,
  };
}
