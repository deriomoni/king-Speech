/** Tongue-twister analyzer tests (spec §11.5, §12).
 *
 * Fixtures are JSON (words + confidence + timings), no real audio. The key
 * property: identical text with low confidence yields low clarity — a text
 * match does NOT prove clarity.
 */
import { SttResult } from '../core/stt/types';
import { analyzeTongueTwister } from '../analyzers/tongueTwister';
import clean from '../__fixtures__/tongue_twister_clean.json';

const REFERENCE = 'Карл у Клары украл кораллы, а Клара у Карла украла кларнет.';

const cleanStt = clean as SttResult;

/** Same words & timings, but every confidence forced low (mumbled). */
const mumbledStt: SttResult = {
  ...cleanStt,
  words: cleanStt.words.map((w) => ({ ...w, confidence: 0.4 })),
};

describe('analyzeTongueTwister (§11.5)', () => {
  it('clean confident reading → clarity ≥ 0.9', () => {
    const out = analyzeTongueTwister({
      referenceRaw: REFERENCE,
      stt: cleanStt,
      attempt: 1,
      mode: 'FULL',
    });
    expect(out.clarity).toBeGreaterThanOrEqual(0.9);
    expect(out.coverage).toBe(1);
  });

  it('SAME words, low confidence → clarity < 0.4 (independent of text match)', () => {
    const out = analyzeTongueTwister({
      referenceRaw: REFERENCE,
      stt: mumbledStt,
      attempt: 1,
      mode: 'FULL',
    });
    // 100% text coverage…
    expect(out.coverage).toBe(1);
    // …but confidence 0.4 < 0.55 → every word failed → clarity ≈ 0.
    expect(out.clarity).toBeLessThan(0.4);
  });

  it('mumbled attempt gets a low raw score despite full text match (§12)', () => {
    const clear = analyzeTongueTwister({ referenceRaw: REFERENCE, stt: cleanStt, attempt: 1, mode: 'FULL' });
    const mumbled = analyzeTongueTwister({ referenceRaw: REFERENCE, stt: mumbledStt, attempt: 1, mode: 'FULL' });
    expect(clear.raw).toBeGreaterThan(90);
    // raw = 100·(0.65·clarity + 0.35·coverage) = 100·(0 + 0.35) = 35.
    expect(mumbled.raw).toBeLessThan(40);
  });

  it('attempt 1 does not score tempo; attempts 2/3 do', () => {
    const a1 = analyzeTongueTwister({ referenceRaw: REFERENCE, stt: cleanStt, attempt: 1, mode: 'FULL', baseWPM: 100 });
    expect(a1.tempoScore).toBeNull();
    const a2 = analyzeTongueTwister({ referenceRaw: REFERENCE, stt: cleanStt, attempt: 2, mode: 'FULL', baseWPM: 100 });
    expect(a2.tempoScore).not.toBeNull();
  });

  it('attempt 3 clean_sprint praise when fast AND clear', () => {
    // 11 words over ~2.0s of speech ≈ high wpm; use a large speechDuration to
    // land tempoScore in range against target 1.3·baseWPM.
    const out = analyzeTongueTwister({
      referenceRaw: REFERENCE,
      stt: cleanStt,
      attempt: 3,
      mode: 'FULL',
      baseWPM: 90,
      speechDurationMs: (11 / (1.3 * 90)) * 60000, // exactly on target → tempoScore ≈ 1
    });
    expect(out.tempoScore).toBeGreaterThan(0.9);
    expect(out.insights.some((i) => i.id === 'clean_sprint')).toBe(true);
  });
});
