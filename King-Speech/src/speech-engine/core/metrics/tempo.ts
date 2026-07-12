/**
 * Tempo (spec §6.2).
 *
 * wpm uses speech duration only (pauses excluded from the denominator).
 * tempoScore is a Gaussian around the target: 35% off → ≈0.37, 20% off → ≈0.72.
 */

export interface TempoResult {
  wpm: number;
  /** null when no target is evaluated (e.g. tongue-twister attempt 1, §7.1). */
  tempoScore: number | null;
}

export function computeWpm(spokenWords: number, speechDurationMs: number): number {
  const minutes = speechDurationMs / 60000;
  if (minutes <= 0) return 0;
  return spokenWords / minutes;
}

export function tempoScoreFor(wpm: number, target: number): number {
  if (target <= 0) return 0;
  const z = (wpm - target) / (0.35 * target);
  return Math.exp(-(z * z));
}

export function computeTempo(
  spokenWords: number,
  speechDurationMs: number,
  target: number | null,
): TempoResult {
  const wpm = computeWpm(spokenWords, speechDurationMs);
  return {
    wpm,
    tempoScore: target != null ? tempoScoreFor(wpm, target) : null,
  };
}
