/** Show Time analyzer + LLM formatter tests (spec §7.4). */
import { RmsFrames } from '../core/audio/rms';
import { Pause, VadResult } from '../core/audio/vad';
import { SttResult, WordToken } from '../core/stt/types';
import { analyzeShowTime } from '../analyzers/showtime/analyzer';
import { formatShowTimeFeedback } from '../analyzers/showtime/llmFormatter';

function word(text: string, i: number, conf: number): WordToken {
  return { text, startMs: i * 400, endMs: i * 400 + 300, confidence: conf };
}

function frames(n: number): RmsFrames {
  return { dbfs: new Float32Array(n).fill(-25), clipped: new Uint8Array(n), count: n, frameMs: 64, hopMs: 32, sampleRate: 16000 };
}

function vad(pauses: Pause[], durationMs: number): VadResult {
  const n = 40;
  return {
    isSpeech: new Uint8Array(n).fill(1),
    noiseFloor: -50, speechThr: -38, pauses,
    speechSegments: [{ startMs: 0, endMs: durationMs }],
    speechDbfs: new Array(n).fill(-25),
    speechFrameCount: n, totalFrameCount: n, speechRatio: 1,
    firstSpeechFrame: 0, lastSpeechFrame: n - 1,
    speechDurationMs: durationMs, hopMs: 32, frameMs: 64,
  };
}

describe('analyzeShowTime (§7.4)', () => {
  it('scores form locally and flags a filler word', () => {
    const texts = ['я', 'ну', 'думаю', 'ну', 'что', 'это', 'ну', 'важно', 'ну', 'очень'];
    const words = texts.map((t, i) => word(t, i, 0.85));
    const stt: SttResult = { transcript: texts.join(' '), onDevice: true, words };
    const out = analyzeShowTime({
      stt, mode: 'FULL', locale: 'ru',
      frames: frames(40), vad: vad([], 12000),
    });
    expect(out.raw).toBeGreaterThanOrEqual(0);
    expect(out.raw).toBeLessThanOrEqual(100);
    // "ну" ×4 at conf 0.85 → filler_word insight.
    expect(out.insights.some((i) => i.id === 'filler_word' && i.evidence.word === 'ну')).toBe(true);
    expect(out.worstQuotes.length).toBeGreaterThan(0);
    // <60 words → diversity not computed (weight redistributed).
    expect(out.metrics.divScore).toBeUndefined();
  });

  it('pauseDiscipline penalizes long gaps (>1500ms)', () => {
    const words = ['раз', 'два', 'три', 'четыре', 'пять', 'шесть'].map((t, i) => word(t, i, 0.9));
    const stt: SttResult = { transcript: words.map((w) => w.text).join(' '), onDevice: true, words };
    const longGaps: Pause[] = [
      { startMs: 1000, endMs: 3000, durMs: 2000 },
      { startMs: 4000, endMs: 6000, durMs: 2000 },
    ];
    const out = analyzeShowTime({ stt, mode: 'FULL', locale: 'ru', frames: frames(40), vad: vad(longGaps, 12000) });
    expect(out.metrics.pauseDiscipline).toBeLessThan(1);
  });
});

describe('formatShowTimeFeedback (§7.4 paid) — silent fallback', () => {
  const OLD_ENV = process.env.EXPO_PUBLIC_API_URL;
  afterEach(() => {
    process.env.EXPO_PUBLIC_API_URL = OLD_ENV;
    delete (global as { fetch?: unknown }).fetch;
  });

  it('returns null when no base URL is configured', async () => {
    delete process.env.EXPO_PUBLIC_API_URL;
    delete process.env.EXPO_PUBLIC_DOMAIN;
    const out = await formatShowTimeFeedback({ metrics: { raw: 50, mode: 'FULL' }, worstQuotes: [], locale: 'ru', rank: 'novice' });
    expect(out).toBeNull();
  });

  it('returns the backend text on success', async () => {
    process.env.EXPO_PUBLIC_API_URL = 'http://localhost:5000';
    (global as { fetch: unknown }).fetch = async () => ({ ok: true, json: async () => ({ feedback: 'Хорошо!' }) });
    const out = await formatShowTimeFeedback({ metrics: { raw: 50, mode: 'FULL' }, worstQuotes: [], locale: 'ru', rank: 'novice' });
    expect(out).toBe('Хорошо!');
  });

  it('returns null (silent) when the request throws / is offline', async () => {
    process.env.EXPO_PUBLIC_API_URL = 'http://localhost:5000';
    (global as { fetch: unknown }).fetch = async () => { throw new Error('offline'); };
    const out = await formatShowTimeFeedback({ metrics: { raw: 50, mode: 'FULL' }, worstQuotes: [], locale: 'ru', rank: 'novice' });
    expect(out).toBeNull();
  });
});
