/**
 * Show Time analyzer (spec §7.4). No reference — scores the WHOLE form, always,
 * locally.
 *
 *   raw = 100·(0.20·loudness + 0.20·tempoScore(target=130) + 0.20·fillerScore
 *            + 0.15·pauseDiscipline + 0.15·divScore + 0.10·tautScore)
 *   pauseDiscipline = clamp01(1 − longGaps/(durMin·1.5)), longGaps = pauses > 1500ms
 *
 * When divScore is not computed (<60 words) its weight is split evenly between
 * fillerScore and tautScore.
 *
 * HC-1: this module does not touch the Show Time screen. Integration is a
 * separate future task.
 */

import { RmsFrames } from '../../core/audio/rms';
import { VadResult } from '../../core/audio/vad';
import { computeDiversity } from '../../core/metrics/diversity';
import { computeFillers } from '../../core/metrics/fillers';
import { computeLoudness, speechDbfsThirds } from '../../core/metrics/loudness';
import { computeTautology } from '../../core/metrics/tautology';
import { computeWpm, tempoScoreFor } from '../../core/metrics/tempo';
import { SttMode, SttResult } from '../../core/stt/types';
import {
  detectFillerWord,
  detectPaceDrift,
  detectStrongFinish,
  detectTautologyWord,
  detectVolumeFade,
  detectZeroFillers,
  Insight,
  thirdsWpm,
} from '../../feedback/insights';
import { MetricValue } from '../../feedback/selector';
import { Locale, RawMetrics } from '../../types';
import { clamp01 } from '../../core/util';
import { normalizeHyp } from '../context';

export const SHOWTIME_TEMPO_TARGET = 130;
export const LONG_GAP_MS = 1500;

export interface ShowTimeInput {
  stt: SttResult;
  mode: SttMode;
  locale: Locale;
  frames: RmsFrames;
  vad: VadResult;
}

export interface ShowTimeOutput {
  raw: number;
  metrics: RawMetrics;
  insights: Insight[];
  metricValues: MetricValue[];
  /** ≤4 short phrases with fillers/tautology for the paid LLM formatter (§7.4). */
  worstQuotes: string[];
}

function buildWorstQuotes(tokens: string[], hotIdx: Set<number>): string[] {
  const quotes: string[] = [];
  const used = new Set<number>();
  for (const idx of Array.from(hotIdx).sort((a, b) => a - b)) {
    if (used.has(idx)) continue;
    const start = Math.max(0, idx - 4);
    const end = Math.min(tokens.length, idx + 5); // ≤ 9 words window (≤12 cap)
    const slice = tokens.slice(start, end);
    for (let i = start; i < end; i++) used.add(i);
    quotes.push(slice.slice(0, 12).join(' '));
    if (quotes.length >= 4) break;
  }
  return quotes;
}

export function analyzeShowTime(input: ShowTimeInput): ShowTimeOutput {
  const { stt, mode, locale, frames, vad } = input;
  const normHyp = normalizeHyp(stt);
  const tokens = normHyp.map((w) => w.text);
  const confidences = normHyp.map((w) => w.confidence);
  const spokenWords = tokens.length;

  const speechDurationMs = vad.speechDurationMs;
  const totalDurationMs = frames.count * frames.hopMs;
  const durMin = totalDurationMs / 60000;

  const loud = computeLoudness(vad.speechDbfs, vad.noiseFloor, speechDurationMs);
  const wpm = computeWpm(spokenWords, speechDurationMs);
  const tempoScore = tempoScoreFor(wpm, SHOWTIME_TEMPO_TARGET);
  const fillers = computeFillers(normHyp, speechDurationMs);
  const taut = computeTautology({ tokens, speechDurationMs, locale, confidences });
  const div = computeDiversity(tokens);

  const longGaps = vad.pauses.filter((p) => p.durMs > LONG_GAP_MS).length;
  const pauseDiscipline = durMin > 0 ? clamp01(1 - longGaps / (durMin * 1.5)) : 1;

  // Weights, with diversity redistribution when it isn't computed (§7.4).
  let wFiller = 0.2;
  let wTaut = 0.1;
  let wDiv = 0.15;
  if (!div.computed) {
    wFiller += wDiv / 2;
    wTaut += wDiv / 2;
    wDiv = 0;
  }
  const raw =
    100 *
    (0.2 * loud.loudness +
      0.2 * tempoScore +
      wFiller * fillers.score +
      0.15 * pauseDiscipline +
      wDiv * div.divScore +
      wTaut * taut.tautScore);

  // Insights.
  const insights: Insight[] = [];
  const fw = detectFillerWord(fillers);
  if (fw) insights.push(fw);
  const tw = detectTautologyWord(taut.byLemma);
  if (tw) insights.push(tw);
  const thirds = speechDbfsThirds(frames, vad.isSpeech);
  const fade = detectVolumeFade(thirds.firstMean, thirds.lastMean, thirds.hasData);
  if (fade) insights.push(fade);
  const { firstWpm, lastWpm } = thirdsWpm(normHyp);
  const drift = detectPaceDrift(firstWpm, lastWpm);
  if (drift) insights.push(drift);
  const strong = detectStrongFinish(thirds.firstMean, thirds.lastMean, firstWpm, lastWpm, thirds.hasData);
  if (strong) insights.push(strong);
  const zero = detectZeroFillers(fillers.fillers, spokenWords);
  if (zero) insights.push(zero);

  // worstQuotes from filler + repeated-lemma positions.
  const hot = new Set<number>();
  const fillerSet = new Set(fillers.byLemma.keys());
  const tautStem = tw?.evidence.word;
  for (let i = 0; i < tokens.length; i++) {
    if (fillerSet.has(tokens[i])) hot.add(i);
    if (tautStem && tokens[i] === tautStem) hot.add(i);
  }
  const worstQuotes = buildWorstQuotes(tokens, hot);

  const metrics: RawMetrics = {
    raw,
    mode,
    loudness: loud.loudness,
    loudLevel: loud.loudLevel,
    loudHold: loud.loudHold,
    lMean: loud.lMean,
    lStd: loud.lStd,
    wpm,
    tempoScore,
    fillerRate: fillers.rate,
    fillerScore: fillers.score,
    tautScore: taut.tautScore,
    divScore: div.computed ? div.divScore : undefined,
    pauseDiscipline,
  };

  const metricValues: MetricValue[] = [
    { key: 'loudness', value: loud.loudness, computed: vad.speechDbfs.length > 0 },
    { key: 'tempo', value: tempoScore, computed: true },
    { key: 'fillers', value: fillers.score, computed: true },
    { key: 'pauseDiscipline', value: pauseDiscipline, computed: true },
    { key: 'diversity', value: div.divScore, computed: div.computed },
    { key: 'tautology', value: taut.tautScore, computed: true },
  ];

  return { raw, metrics, insights, metricValues, worstQuotes };
}
