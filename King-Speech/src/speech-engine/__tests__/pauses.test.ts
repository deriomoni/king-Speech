/** Punctuation-pause + breath tests (spec §11.4). */
import { AlignOp } from '../core/text/align';
import { Pause } from '../core/audio/vad';
import { WordToken } from '../core/stt/types';
import {
  buildPunctExpectations,
  computeBreath,
  computePunctuation,
} from '../core/metrics/pauses';

const REF = 'мороз, и солнце.';

// Three spoken words with timings; "мороз" ends at 500ms, "солнце" ends at 1700ms.
const HYP: WordToken[] = [
  { text: 'мороз', startMs: 0, endMs: 500, confidence: 0.9 },
  { text: 'и', startMs: 800, endMs: 900, confidence: 0.9 },
  { text: 'солнце', startMs: 1200, endMs: 1700, confidence: 0.9 },
];
const OPS: AlignOp[] = [
  { type: 'match', refIdx: 0, hypIdx: 0 },
  { type: 'match', refIdx: 1, hypIdx: 1 },
  { type: 'match', refIdx: 2, hypIdx: 2 },
];

function run(pauses: Pause[], literature = false) {
  return computePunctuation({
    parse: buildPunctExpectations(REF),
    ops: OPS,
    hypWords: HYP,
    pauses,
    literature,
  });
}

describe('buildPunctExpectations', () => {
  it('detects a comma and a sentence stop', () => {
    const { words, expectations } = buildPunctExpectations(REF);
    expect(words).toEqual(['мороз', 'и', 'солнце']);
    expect(expectations).toEqual([
      { refWordIndex: 0, kind: 'comma', lo: 150, hi: 300 },
      { refWordIndex: 2, kind: 'sentence', lo: 400, hi: 750 },
    ]);
  });

  it('classifies stanza boundaries and ellipses at 600–1000', () => {
    const { expectations } = buildPunctExpectations('первый\n\nвторой… третий');
    expect(expectations[0].kind).toBe('stanza');
    expect(expectations[0]).toMatchObject({ lo: 600, hi: 1000 });
    expect(expectations[1].kind).toBe('ellipsis');
  });
});

describe('computePunctuation classification (§11.4)', () => {
  it('hit: pause inside the corridor', () => {
    // comma pause 200ms starting at 520 (window [420,750]); sentence pause 500ms.
    const r = run([
      { startMs: 520, endMs: 720, durMs: 200 },
      { startMs: 1720, endMs: 2220, durMs: 500 },
    ]);
    expect(r.marks[0].cls).toBe('hit');
    expect(r.marks[1].cls).toBe('hit');
    expect(r.punctScore).toBe(1);
  });

  it('short: pause below the corridor floor but > 80ms', () => {
    const r = run([{ startMs: 520, endMs: 620, durMs: 100 }]);
    expect(r.marks[0].cls).toBe('short');
    expect(r.marks[0].score).toBe(0.4);
  });

  it('swallowed: no pause in the anchor window', () => {
    const r = run([]);
    expect(r.marks[0].cls).toBe('swallowed');
    expect(r.marks[0].score).toBe(0);
    expect(r.swallowed.length).toBe(2);
  });

  it('overlong: > 2×corridor → 0.5 (reading), 1.0 (literature)', () => {
    const overlong: Pause[] = [{ startMs: 1720, endMs: 3720, durMs: 2000 }]; // > 2*750
    const reading = run(overlong);
    const sentenceMark = reading.marks.find((m) => m.kind === 'sentence');
    expect(sentenceMark?.cls).toBe('overlong');
    expect(sentenceMark?.score).toBe(0.5);

    const lit = run(overlong, true);
    const litMark = lit.marks.find((m) => m.kind === 'sentence');
    expect(litMark?.cls).toBe('overlong');
    expect(litMark?.score).toBe(1); // literature does not penalize overlong
  });

  it('skips marks whose anchor word was not spoken', () => {
    const r = computePunctuation({
      parse: buildPunctExpectations(REF),
      ops: [{ type: 'del', refIdx: 0 }, ...OPS.slice(1)],
      hypWords: HYP,
      pauses: [],
      literature: false,
    });
    expect(r.marks[0].cls).toBe('skipped');
    expect(r.evaluatedCount).toBe(1); // only the sentence mark evaluated
  });
});

describe('computeBreath (§6.4)', () => {
  it('counts only unattached ≥350ms pauses', () => {
    const pauses: Pause[] = [
      { startMs: 520, endMs: 720, durMs: 200 }, // attached to comma
      { startMs: 5000, endMs: 5400, durMs: 400 }, // mid-phrase breath break
      { startMs: 6000, endMs: 6400, durMs: 400 }, // another
    ];
    const punct = run(pauses);
    const breath = computeBreath(pauses, punct.matchedPauseIndices, 100);
    expect(breath.breaks).toBe(2);
    // denom = 0.15 * (100/10) = 1.5 → breath = clamp01(1 - 2/1.5) = 0
    expect(breath.breath).toBe(0);
  });
});
