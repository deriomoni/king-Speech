/** Validity-gate tests (spec §11.3). */
import { checkGates, GateInput, retryMessage } from '../scoring/gates';

const valid: GateInput = {
  level: 'reading',
  durationMs: 20000,
  speechRatio: 0.7,
  recognizedWords: 40,
  clippingRatio: 0.0,
  coverage: 0.95,
  refWordCount: 40,
  targetWpm: 120,
};

describe('checkGates (§8.1) — each RetryReason reproduces', () => {
  it('valid attempt passes every gate', () => {
    expect(checkGates(valid)).toEqual({ ok: true });
  });

  it('too_short (tongue twister < 1.5s)', () => {
    const r = checkGates({ ...valid, level: 'tongue_twister', durationMs: 1000 });
    expect(r).toEqual({ ok: false, reason: 'too_short' });
  });

  it('too_short (reading < 0.25× expected time)', () => {
    // expected = 40/120 min = 20s; 0.25× = 5s. 3s < 5s.
    const r = checkGates({ ...valid, durationMs: 3000 });
    expect(r).toEqual({ ok: false, reason: 'too_short' });
  });

  it('mostly_silence (speech ratio < 0.20)', () => {
    expect(checkGates({ ...valid, speechRatio: 0.1 })).toEqual({
      ok: false,
      reason: 'mostly_silence',
    });
  });

  it('nothing_recognized (< 3 words)', () => {
    expect(checkGates({ ...valid, recognizedWords: 2 })).toEqual({
      ok: false,
      reason: 'nothing_recognized',
    });
  });

  it('nothing_recognized threshold is 1 for vocabulary', () => {
    expect(checkGates({ ...valid, level: 'vocabulary', recognizedWords: 0, coverage: null })).toEqual({
      ok: false,
      reason: 'nothing_recognized',
    });
    expect(
      checkGates({ ...valid, level: 'vocabulary', recognizedWords: 1, coverage: null, durationMs: 600 }),
    ).toEqual({ ok: true });
  });

  it('off_script (coverage < 0.35, reference levels only)', () => {
    expect(checkGates({ ...valid, coverage: 0.2 })).toEqual({
      ok: false,
      reason: 'off_script',
    });
    // show_time has no reference → coverage ignored.
    expect(
      checkGates({ level: 'show_time', durationMs: 15000, speechRatio: 0.6, recognizedWords: 30, clippingRatio: 0, coverage: null }),
    ).toEqual({ ok: true });
  });

  it('too_loud_clipping (clipping ratio ≥ 0.10)', () => {
    expect(checkGates({ ...valid, clippingRatio: 0.2 })).toEqual({
      ok: false,
      reason: 'too_loud_clipping',
    });
  });

  it('retry messages are neutral and localized', () => {
    expect(retryMessage('off_script', 'ru')).toContain('другой текст');
    expect(retryMessage('nothing_recognized', 'en')).toMatch(/catch/i);
  });
});
