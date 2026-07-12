/** Insight detection tests (spec §11.6a). */
import { FillersResult } from '../core/metrics/fillers';
import { RmsFrames } from '../core/audio/rms';
import { speechDbfsThirds } from '../core/metrics/loudness';
import {
  canNameWord,
  detectFillerWord,
  detectVolumeFade,
} from '../feedback/insights';
import { MetricValue, selectFeedback } from '../feedback/selector';
import { Insight } from '../feedback/insights';

function fillersWith(word: string, count: number, conf: number | null): FillersResult {
  const confs = Array.from({ length: count }, () => conf);
  return {
    fillers: count,
    rate: 3,
    score: 0.5,
    byLemma: new Map([[word, { count, confs }]]),
  };
}

describe('canNameWord — false-accusation guard (§8.4.1)', () => {
  it('rejects count < 3', () => {
    expect(canNameWord(2, [0.9, 0.9])).toBe(false);
  });
  it('rejects mean confidence < 0.65', () => {
    expect(canNameWord(3, [0.5, 0.5, 0.5])).toBe(false);
  });
  it('rejects when no confidence is available (NO_CONF)', () => {
    expect(canNameWord(5, [null, null, null, null, null])).toBe(false);
  });
  it('accepts count ≥ 3 with mean confidence ≥ 0.65', () => {
    expect(canNameWord(3, [0.7, 0.7, 0.7])).toBe(true);
  });
});

describe('detectFillerWord (§11.6a)', () => {
  it('does NOT fire at count = 2', () => {
    expect(detectFillerWord(fillersWith('короче', 2, 0.9))).toBeNull();
  });
  it('does NOT fire at conf = 0.5', () => {
    expect(detectFillerWord(fillersWith('короче', 3, 0.5))).toBeNull();
  });
  it('fires at count = 3, conf = 0.7', () => {
    const insight = detectFillerWord(fillersWith('короче', 3, 0.7));
    expect(insight).not.toBeNull();
    expect(insight?.id).toBe('filler_word');
    expect(insight?.evidence).toMatchObject({ word: 'короче', count: 3 });
  });
});

describe('detectVolumeFade — synthetic RMS envelope (§11.6a)', () => {
  it('fires when the last third is ≥4 dB quieter', () => {
    const N = 30;
    const dbfs = new Float32Array(N);
    for (let i = 0; i < N; i++) dbfs[i] = -20 - (i / (N - 1)) * 10; // −20 → −30
    const frames: RmsFrames = {
      dbfs,
      clipped: new Uint8Array(N),
      count: N,
      frameMs: 64,
      hopMs: 32,
      sampleRate: 16000,
    };
    const isSpeech = new Uint8Array(N).fill(1);
    const thirds = speechDbfsThirds(frames, isSpeech);
    const insight = detectVolumeFade(thirds.firstMean, thirds.lastMean, thirds.hasData);
    expect(insight).not.toBeNull();
    expect(insight?.id).toBe('volume_fade');
  });

  it('does not fire on a flat envelope', () => {
    const N = 30;
    const dbfs = new Float32Array(N).fill(-25);
    const frames: RmsFrames = {
      dbfs, clipped: new Uint8Array(N), count: N, frameMs: 64, hopMs: 32, sampleRate: 16000,
    };
    const thirds = speechDbfsThirds(frames, new Uint8Array(N).fill(1));
    expect(detectVolumeFade(thirds.firstMean, thirds.lastMean, thirds.hasData)).toBeNull();
  });
});

describe('feedback never names two words at once (§11.6a, §8.4.2)', () => {
  it('with both a filler and a tautology insight, only one word is named', () => {
    const filler: Insight = {
      id: 'filler_word', kind: 'growth', severity: 0.8, detectConf: 0.9,
      evidence: { word: 'короче', count: 5 },
    };
    const taut: Insight = {
      id: 'tautology_word', kind: 'growth', severity: 0.6, detectConf: 0.8,
      evidence: { word: 'вопрос', count: 4 },
    };
    const metrics: MetricValue[] = [{ key: 'clarity', value: 0.9, computed: true }];
    const { feedback } = selectFeedback({
      insights: [filler, taut],
      metrics,
      locale: 'ru',
      history: { lastGrowthIds: [], lastVariantByCategory: {} },
    });
    const namesKoroche = feedback.growth.includes('короче');
    const namesVopros = feedback.growth.includes('вопрос');
    expect(namesKoroche || namesVopros).toBe(true);
    expect(namesKoroche && namesVopros).toBe(false);
  });
});
