/**
 * Stars from the shown score (spec §8.3). Floor is 2 for any valid attempt.
 *   shown < 50 → 2★;  50–69 → 3★;  70–84 → 4★;  ≥ 85 → 5★
 */

import { Stars } from '../types';

export function starsFor(shown: number): Stars {
  if (shown >= 85) return 5;
  if (shown >= 70) return 4;
  if (shown >= 50) return 3;
  return 2;
}
