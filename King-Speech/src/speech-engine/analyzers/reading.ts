/**
 * Reading & Literature analyzer (spec §7.2). One analyzer, two presets.
 *
 *   raw = 100·(0.35·clarity + 0.30·punctScore + 0.20·loudness + 0.15·breath)
 *
 * Literature preset:
 *   - stanza-end corridors are honored (marked by \n\n in the reference);
 *   - overlong pauses are NOT penalized (declamatory tempo is legitimate);
 *   - a monotone flag forces the selector to pick the "intonation" growth zone.
 *
 * Ending-swallow (heuristic): a word ≥7 chars with conf<0.55 at the end of a
 * syntagma (a pause ≥150 ms follows) is an incident; ≥3 → ending_swallow.
 */

import { RmsFrames } from '../core/audio/rms';
import { VadResult } from '../core/audio/vad';
import { computeClarity } from '../core/metrics/clarity';
import { computeLoudness, speechDbfsThirds } from '../core/metrics/loudness';
import {
  buildPunctExpectations,
  computeBreath,
  computePunctuation,
} from '../core/metrics/pauses';
import { SttMode, SttResult } from '../core/stt/types';
import {
  detectAllMarksHit,
  detectBreathBreaks,
  detectEndingSwallow,
  detectMonotone,
  detectPaceDrift,
  detectStrongFinish,
  detectSwallowedMarks,
  detectVolumeFade,
  Insight,
  thirdsWpm,
} from '../feedback/insights';
import { MetricValue } from '../feedback/selector';
import { RawMetrics } from '../types';
import { alignReference } from './context';

/** A word this short/short-conf followed by a pause counts as an ending swallow. */
export const ENDING_MIN_LEN = 7;
export const ENDING_MAX_CONF = 0.55;
export const ENDING_FOLLOW_PAUSE_MS = 150;

export interface ReadingInput {
  referenceRaw: string;
  stt: SttResult;
  mode: SttMode;
  literature: boolean;
  frames: RmsFrames;
  vad: VadResult;
}

export interface ReadingOutput {
  raw: number;
  metrics: RawMetrics;
  insights: Insight[];
  metricValues: MetricValue[];
  coverage: number;
}

export function analyzeReading(input: ReadingInput): ReadingOutput {
  const { referenceRaw, stt, mode, literature, frames, vad } = input;
  const { refWords, normHyp, align } = alignReference(referenceRaw, stt);

  const clarityResult = computeClarity({ ops: align.ops, refWords, hypWords: normHyp, mode });
  const clarity = clarityResult.clarity;

  const loud = computeLoudness(vad.speechDbfs, vad.noiseFloor, vad.speechDurationMs);

  const parse = buildPunctExpectations(referenceRaw);
  const punct = computePunctuation({
    parse,
    ops: align.ops,
    hypWords: normHyp,
    pauses: vad.pauses,
    literature,
  });
  const breath = computeBreath(vad.pauses, punct.matchedPauseIndices, refWords.length);

  const raw =
    100 * (0.35 * clarity + 0.3 * punct.punctScore + 0.2 * loud.loudness + 0.15 * breath.breath);

  // Ending-swallow incidents (heuristic).
  let endingSwallows = 0;
  for (const w of clarityResult.perWord) {
    if (w.hypIdx == null || w.refWord.length < ENDING_MIN_LEN) continue;
    if (w.confidence == null || w.confidence >= ENDING_MAX_CONF) continue;
    const wordEnd = normHyp[w.hypIdx]?.endMs ?? 0;
    if (wordEnd <= 0) continue;
    const followed = vad.pauses.some(
      (p) => p.startMs >= wordEnd - 80 && p.startMs <= wordEnd + 300 && p.durMs >= ENDING_FOLLOW_PAUSE_MS,
    );
    if (followed) endingSwallows++;
  }

  // Insights.
  const insights: Insight[] = [];
  const swallowed = detectSwallowedMarks(punct.swallowed);
  if (swallowed) insights.push(swallowed);
  const ending = detectEndingSwallow(endingSwallows);
  if (ending) insights.push(ending);
  const mono = detectMonotone(loud.monotone);
  if (mono) insights.push(mono);
  const bb = detectBreathBreaks(breath.breaks);
  if (bb) insights.push(bb);
  const allHit = detectAllMarksHit(punct.punctScore, punct.evaluatedCount);
  if (allHit) insights.push(allHit);

  // Common temporal insights.
  const thirds = speechDbfsThirds(frames, vad.isSpeech);
  const fade = detectVolumeFade(thirds.firstMean, thirds.lastMean, thirds.hasData);
  if (fade) insights.push(fade);
  const { firstWpm, lastWpm } = thirdsWpm(normHyp);
  const drift = detectPaceDrift(firstWpm, lastWpm);
  if (drift) insights.push(drift);
  const strong = detectStrongFinish(thirds.firstMean, thirds.lastMean, firstWpm, lastWpm, thirds.hasData);
  if (strong) insights.push(strong);

  const metrics: RawMetrics = {
    raw,
    mode,
    clarity,
    coverage: align.coverage,
    punctScore: punct.punctScore,
    loudness: loud.loudness,
    loudLevel: loud.loudLevel,
    loudHold: loud.loudHold,
    breath: breath.breath,
    monotone: loud.monotone,
    lMean: loud.lMean,
    lStd: loud.lStd,
  };

  const metricValues: MetricValue[] = [
    { key: 'clarity', value: clarity, computed: true },
    { key: 'punct', value: punct.punctScore, computed: punct.evaluatedCount > 0 },
    { key: 'loudness', value: loud.loudness, computed: vad.speechDbfs.length > 0 },
    { key: 'breath', value: breath.breath, computed: true },
  ];

  return { raw, metrics, insights, metricValues, coverage: align.coverage };
}
