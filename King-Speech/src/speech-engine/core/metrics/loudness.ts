/**
 * Loudness (spec §3.5 / §6). Computed over speech frames only.
 *
 *   L_mean, L_std over speech-frame dBFS
 *   loudLevel = clamp01(1 − dist(L_mean, [nf+18, nf+38]) / 10)
 *   loudHold  = clamp01(1 − max(0, L_std − 3) / 6)
 *   loudness  = 0.6·loudLevel + 0.4·loudHold
 *   monotone  = L_std < 2.5 dB AND speech duration > 15 s
 */

import { RmsFrames } from '../audio/rms';
import { clamp01, mean, std } from '../util';

export const LOUDNESS_LEVEL_WEIGHT = 0.6;
export const LOUDNESS_HOLD_WEIGHT = 0.4;
export const MONOTONE_STD_DB = 2.5;
export const MONOTONE_MIN_MS = 15000;

export interface LoudnessResult {
  loudness: number;
  loudLevel: number;
  loudHold: number;
  lMean: number;
  lStd: number;
  monotone: boolean;
}

function distanceToCorridor(x: number, lo: number, hi: number): number {
  if (x < lo) return lo - x;
  if (x > hi) return x - hi;
  return 0;
}

export function computeLoudness(
  speechDbfs: readonly number[],
  noiseFloor: number,
  speechDurationMs: number,
): LoudnessResult {
  if (speechDbfs.length === 0) {
    return { loudness: 0, loudLevel: 0, loudHold: 0, lMean: -90, lStd: 0, monotone: false };
  }
  const lMean = mean(speechDbfs);
  const lStd = std(speechDbfs);

  const lo = noiseFloor + 18;
  const hi = noiseFloor + 38;
  const dist = distanceToCorridor(lMean, lo, hi);
  const loudLevel = clamp01(1 - dist / 10);
  const loudHold = clamp01(1 - Math.max(0, lStd - 3) / 6);
  const loudness = LOUDNESS_LEVEL_WEIGHT * loudLevel + LOUDNESS_HOLD_WEIGHT * loudHold;
  const monotone = lStd < MONOTONE_STD_DB && speechDurationMs > MONOTONE_MIN_MS;

  return { loudness, loudLevel, loudHold, lMean, lStd, monotone };
}

/**
 * Mean speech-frame dBFS of the first and last third (by frame index) — used by
 * the `volume_fade` / `strong_finish` insights (§8.4.1).
 */
export function speechDbfsThirds(
  frames: RmsFrames,
  isSpeech: Uint8Array,
): { firstMean: number; lastMean: number; hasData: boolean } {
  const speechIdx: number[] = [];
  for (let i = 0; i < frames.count; i++) if (isSpeech[i]) speechIdx.push(i);
  if (speechIdx.length < 6) return { firstMean: 0, lastMean: 0, hasData: false };
  const third = Math.floor(speechIdx.length / 3);
  const first: number[] = [];
  const last: number[] = [];
  for (let k = 0; k < third; k++) first.push(frames.dbfs[speechIdx[k]]);
  for (let k = speechIdx.length - third; k < speechIdx.length; k++) {
    last.push(frames.dbfs[speechIdx[k]]);
  }
  return { firstMean: mean(first), lastMean: mean(last), hasData: true };
}
