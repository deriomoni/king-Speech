/**
 * Show curve (spec §8.2): shown = 100·(raw/100)^γ.
 *
 * γ rises with rank so beginners see a gentler curve. Properties (unit-tested):
 * monotonicity for a fixed γ, shown(0)=0, shown(100)=100.
 */

import { PlayerRank } from '../types';

export const GAMMA: Record<PlayerRank, number> = {
  novice: 0.55,
  apprentice: 0.65,
  orator: 0.75,
  master: 0.85,
  pro: 0.95,
};

export function gammaFor(rank: PlayerRank): number {
  return GAMMA[rank];
}

/** Map a raw 0..100 score to the shown 0..100 score for `rank`. */
export function applyCurve(raw: number, rank: PlayerRank): number {
  const clamped = Math.max(0, Math.min(100, raw));
  return 100 * Math.pow(clamped / 100, gammaFor(rank));
}
