/** Show-curve tests (spec §11.2). */
import { applyCurve, GAMMA } from '../scoring/curve';
import { PlayerRank, RANK_ORDER } from '../types';

describe('applyCurve (§8.2)', () => {
  it('shown(0) = 0 and shown(100) = 100 for every rank', () => {
    for (const rank of RANK_ORDER) {
      expect(applyCurve(0, rank)).toBeCloseTo(0, 9);
      expect(applyCurve(100, rank)).toBeCloseTo(100, 9);
    }
  });

  it('is monotonic: raw1 > raw2 ⇒ shown1 > shown2 (1000 random pairs × all γ)', () => {
    for (const rank of RANK_ORDER) {
      for (let n = 0; n < 1000; n++) {
        let a = Math.random() * 100;
        let b = Math.random() * 100;
        if (a === b) b = Math.min(100, b + 0.5);
        const [hi, lo] = a > b ? [a, b] : [b, a];
        expect(applyCurve(hi, rank)).toBeGreaterThan(applyCurve(lo, rank));
      }
    }
  });

  it('softens more for lower ranks (novice > pro at the same raw)', () => {
    // raw 40 → novice ≈ 60, pro ≈ 42 (checklist §12).
    expect(applyCurve(40, 'novice')).toBeGreaterThan(58);
    expect(applyCurve(40, 'novice')).toBeLessThan(63);
    expect(applyCurve(40, 'pro')).toBeGreaterThan(40);
    expect(applyCurve(40, 'pro')).toBeLessThan(44);
  });

  it('uses the exact γ table', () => {
    const expected: Record<PlayerRank, number> = {
      novice: 0.55, apprentice: 0.65, orator: 0.75, master: 0.85, pro: 0.95,
    };
    expect(GAMMA).toEqual(expected);
  });
});
