/** Reading + Vocabulary analyzer guards (spec §7.2, §7.3). */
import { RmsFrames } from '../core/audio/rms';
import { Pause, VadResult } from '../core/audio/vad';
import { SttResult } from '../core/stt/types';
import { analyzeReading } from '../analyzers/reading';
import { analyzeVocabulary, syllabify } from '../analyzers/vocabulary';

function frames(dbfsValue: number, n: number): RmsFrames {
  return {
    dbfs: new Float32Array(n).fill(dbfsValue),
    clipped: new Uint8Array(n),
    count: n,
    frameMs: 64,
    hopMs: 32,
    sampleRate: 16000,
  };
}

function vad(over: Partial<VadResult>): VadResult {
  const n = 20;
  return {
    isSpeech: new Uint8Array(n).fill(1),
    noiseFloor: -50,
    speechThr: -38,
    pauses: [],
    speechSegments: [{ startMs: 0, endMs: n * 32 }],
    speechDbfs: new Array(n).fill(-25),
    speechFrameCount: n,
    totalFrameCount: n,
    speechRatio: 1,
    firstSpeechFrame: 0,
    lastSpeechFrame: n - 1,
    speechDurationMs: 4000,
    hopMs: 32,
    frameMs: 64,
    ...over,
  };
}

const REF = 'мороз, и солнце.';
const STT: SttResult = {
  transcript: 'мороз и солнце',
  onDevice: true,
  words: [
    { text: 'мороз', startMs: 0, endMs: 500, confidence: 0.9 },
    { text: 'и', startMs: 800, endMs: 900, confidence: 0.9 },
    { text: 'солнце', startMs: 1200, endMs: 1700, confidence: 0.9 },
  ],
};

const HIT_PAUSES: Pause[] = [
  { startMs: 520, endMs: 720, durMs: 200 }, // comma hit
  { startMs: 1720, endMs: 2220, durMs: 500 }, // sentence hit
];

describe('analyzeReading (§7.2)', () => {
  it('clean read with hit pauses and in-corridor loudness → high raw', () => {
    const out = analyzeReading({
      referenceRaw: REF,
      stt: STT,
      mode: 'FULL',
      literature: false,
      frames: frames(-25, 20),
      vad: vad({ pauses: HIT_PAUSES }),
    });
    // clarity 1, punct 1, loudness ~1, breath 1 → raw ≈ 100.
    expect(out.raw).toBeGreaterThan(90);
    expect(out.coverage).toBe(1);
  });

  it('flags monotone when the envelope is flat and long (§7.2)', () => {
    const out = analyzeReading({
      referenceRaw: REF,
      stt: STT,
      mode: 'FULL',
      literature: true,
      frames: frames(-25, 20),
      vad: vad({ pauses: HIT_PAUSES, speechDurationMs: 20000, speechDbfs: new Array(20).fill(-25) }),
    });
    expect(out.metrics.monotone).toBe(true);
    expect(out.insights.some((i) => i.id === 'monotone')).toBe(true);
  });
});

describe('analyzeVocabulary (§7.3)', () => {
  it('fuzzy-matched target → raw = 100·(0.5 + 0.5·conf)', () => {
    const out = analyzeVocabulary({
      referenceRaw: 'радость',
      stt: { transcript: 'радость', onDevice: true, words: [{ text: 'радость', startMs: 0, endMs: 400, confidence: 0.8 }] },
      mode: 'FULL',
    });
    expect(out.matched).toBe(true);
    expect(out.raw).toBeCloseTo(90, 5); // 100*(0.5+0.5*0.8)
  });

  it('no match → retry (matched=false), not a zero score', () => {
    const out = analyzeVocabulary({
      referenceRaw: 'радость',
      stt: { transcript: 'печаль грусть', onDevice: true, words: [
        { text: 'печаль', startMs: 0, endMs: 400, confidence: 0.9 },
        { text: 'грусть', startMs: 500, endMs: 900, confidence: 0.9 },
      ] },
      mode: 'FULL',
    });
    expect(out.matched).toBe(false);
  });

  it('syllabify splits on vowels', () => {
    expect(syllabify('радость')).toBe('ра-дость');
    expect(syllabify('корова')).toBe('ко-ро-ва');
  });
});
