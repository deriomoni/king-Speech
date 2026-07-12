/**
 * Shared numeric helpers for the speech engine.
 *
 * Pure, dependency-free, offline. Used across audio / metrics / scoring so the
 * math lives in exactly one place (spec §0: deterministic, on-device).
 */

/** Clamp `x` into the inclusive range [min, max]. */
export function clamp(x: number, min: number, max: number): number {
  if (x < min) return min;
  if (x > max) return max;
  return x;
}

/** Clamp `x` into [0, 1]. */
export function clamp01(x: number): number {
  return clamp(x, 0, 1);
}

/** Arithmetic mean. Returns 0 for an empty input. */
export function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < values.length; i++) sum += values[i];
  return sum / values.length;
}

/** Population standard deviation. Returns 0 for fewer than 2 values. */
export function std(values: readonly number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  const m = mean(values);
  let acc = 0;
  for (let i = 0; i < n; i++) {
    const d = values[i] - m;
    acc += d * d;
  }
  return Math.sqrt(acc / n);
}

/**
 * Linear-interpolated percentile (`p` in [0, 1]).
 *
 * `percentile(xs, 0.1)` is the 10th percentile used by the VAD noise floor
 * (spec §3.3). Input is copied and sorted ascending; the original is untouched.
 */
export function percentile(values: readonly number[], p: number): number {
  const n = values.length;
  if (n === 0) return 0;
  if (n === 1) return values[0];
  const sorted = Array.from(values).sort((a, b) => a - b);
  const rank = clamp01(p) * (n - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return sorted[lo];
  const frac = rank - lo;
  return sorted[lo] * (1 - frac) + sorted[hi] * frac;
}
