/** Stars tests (spec §11.7). */
import { applyCurve } from '../scoring/curve';
import { starsFor } from '../scoring/stars';
import { RANK_ORDER } from '../types';

describe('starsFor (§8.3)', () => {
  it('maps shown-score bands correctly', () => {
    expect(starsFor(0)).toBe(2);
    expect(starsFor(49)).toBe(2);
    expect(starsFor(50)).toBe(3);
    expect(starsFor(69)).toBe(3);
    expect(starsFor(70)).toBe(4);
    expect(starsFor(84)).toBe(4);
    expect(starsFor(85)).toBe(5);
    expect(starsFor(100)).toBe(5);
  });

  it('floor is 2 for any valid raw × any rank (§11.7)', () => {
    for (const rank of RANK_ORDER) {
      for (let raw = 0; raw <= 100; raw++) {
        expect(starsFor(applyCurve(raw, rank))).toBeGreaterThanOrEqual(2);
      }
    }
  });
});
