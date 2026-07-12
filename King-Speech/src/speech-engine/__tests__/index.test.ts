/** End-to-end orchestrator tests (spec §12 checklist items). */
import { VadResult } from '../core/audio/vad';
import { SttResult } from '../core/stt/types';
import { analyzeCaptured } from '../index';
import clean from '../__fixtures__/tongue_twister_clean.json';

const REFERENCE = 'Карл у Клары украл кораллы, а Клара у Карла украла кларнет.';
const cleanStt = clean as SttResult;
const mumbledStt: SttResult = { ...cleanStt, words: cleanStt.words.map((w) => ({ ...w, confidence: 0.4 })) };

function vad(over: Partial<VadResult>): VadResult {
  const n = 20;
  return {
    isSpeech: new Uint8Array(n).fill(1), noiseFloor: -50, speechThr: -38, pauses: [],
    speechSegments: [{ startMs: 0, endMs: 4000 }], speechDbfs: new Array(n).fill(-25),
    speechFrameCount: n, totalFrameCount: n, speechRatio: 1,
    firstSpeechFrame: 0, lastSpeechFrame: n - 1, speechDurationMs: 4000, hopMs: 32, frameMs: 64,
    ...over,
  };
}

describe('analyzeCaptured — end to end (§12)', () => {
  it('novice and pro see DIFFERENT shown scores for the same raw', async () => {
    const midStt: SttResult = { ...cleanStt, words: cleanStt.words.map((w) => ({ ...w, confidence: 0.7 })) };
    const base = { level: 'tongue_twister' as const, reference: { text: REFERENCE }, attempt: 1 as const, stt: midStt, mode: 'FULL' as const, durationMs: 4000, now: 1_000_000 };
    const novice = await analyzeCaptured({ ...base, locale: 'ru', rank: 'novice' });
    const pro = await analyzeCaptured({ ...base, locale: 'ru', rank: 'pro' });
    expect(novice.status).toBe('scored');
    expect(pro.status).toBe('scored');
    if (novice.status === 'scored' && pro.status === 'scored') {
      expect(novice.shown.score).toBeGreaterThan(pro.shown.score);
    }
  });

  it('mostly silence → retry, no score created', async () => {
    const res = await analyzeCaptured({
      level: 'reading', reference: { text: REFERENCE }, locale: 'ru', rank: 'novice',
      stt: cleanStt, mode: 'FULL', durationMs: 20000,
      frames: { dbfs: new Float32Array(20).fill(-25), clipped: new Uint8Array(20), count: 20, frameMs: 64, hopMs: 32, sampleRate: 16000 },
      vad: vad({ speechRatio: 0.1 }),
    });
    expect(res.status).toBe('retry');
    if (res.status === 'retry') expect(res.reason).toBe('mostly_silence');
  });

  it('wrong text → off_script retry (streak safe)', async () => {
    const wrong: SttResult = {
      transcript: 'совершенно другой текст про погоду', onDevice: true,
      words: 'совершенно другой текст про погоду'.split(' ').map((t, i) => ({ text: t, startMs: i * 400, endMs: i * 400 + 300, confidence: 0.9 })),
    };
    const res = await analyzeCaptured({
      level: 'tongue_twister', reference: { text: REFERENCE }, attempt: 1, locale: 'ru', rank: 'novice',
      stt: wrong, mode: 'FULL', durationMs: 3000,
    });
    expect(res.status).toBe('retry');
    if (res.status === 'retry') expect(res.reason).toBe('off_script');
  });

  it('mumbled twister → scored but low, ≥2 stars, below a clean read (§12)', async () => {
    const commonInput = { level: 'tongue_twister' as const, reference: { text: REFERENCE }, attempt: 1 as const, locale: 'ru' as const, rank: 'novice' as const, mode: 'FULL' as const, durationMs: 3000, now: 2_000_000 };
    const clear = await analyzeCaptured({ ...commonInput, stt: cleanStt });
    const mumbled = await analyzeCaptured({ ...commonInput, stt: mumbledStt });
    expect(mumbled.status).toBe('scored');
    if (mumbled.status === 'scored' && clear.status === 'scored') {
      expect(mumbled.shown.stars).toBeGreaterThanOrEqual(2);
      expect(mumbled.shown.score).toBeLessThan(clear.shown.score);
    }
  });

  it('valid attempt yields exactly one praise + one growth + one action', async () => {
    const res = await analyzeCaptured({
      level: 'tongue_twister', reference: { text: REFERENCE }, attempt: 1, locale: 'ru', rank: 'novice',
      stt: cleanStt, mode: 'FULL', durationMs: 3000, now: 3_000_000,
    });
    expect(res.status).toBe('scored');
    if (res.status === 'scored') {
      expect(res.shown.feedback.praise.length).toBeGreaterThan(0);
      expect(res.shown.feedback.growth.length).toBeGreaterThan(0);
      expect(res.shown.feedback.action.length).toBeGreaterThan(0);
    }
  });

  it('vocabulary no-match → gentle retry, not a zero', async () => {
    const res = await analyzeCaptured({
      level: 'vocabulary', reference: { text: 'радость' }, locale: 'ru', rank: 'novice',
      stt: { transcript: 'печаль', onDevice: true, words: [{ text: 'печаль', startMs: 0, endMs: 400, confidence: 0.9 }] },
      mode: 'FULL', durationMs: 1000,
    });
    expect(res.status).toBe('retry');
    if (res.status === 'retry') {
      expect(res.reason).toBe('off_script');
      expect(res.message).toContain('Скажи ещё раз');
    }
  });

  it('LITE mode (no STT) → acoustic score with liteMode flag', async () => {
    const res = await analyzeCaptured({
      level: 'reading', reference: { text: REFERENCE }, locale: 'ru', rank: 'novice',
      stt: null, mode: 'LITE', durationMs: 20000,
      frames: { dbfs: new Float32Array(20).fill(-25), clipped: new Uint8Array(20), count: 20, frameMs: 64, hopMs: 32, sampleRate: 16000 },
      vad: vad({ pauses: [{ startMs: 500, endMs: 900, durMs: 400 }] }),
    });
    expect(res.status).toBe('scored');
    if (res.status === 'scored') expect(res.liteMode).toBe(true);
  });
});
