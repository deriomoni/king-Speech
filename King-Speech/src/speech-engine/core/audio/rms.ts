/**
 * Frame-wise RMS → dBFS (spec §3.2).
 *
 * Frame = 1024 samples (64 ms @ 16 kHz), hop = 512 samples (32 ms).
 * Operates on the int16-scaled PCM produced by `capture.ts`.
 */

import { TARGET_SAMPLE_RATE } from './capture';

export const FRAME_SIZE = 1024;
export const HOP_SIZE = 512;

/** Floor for dbfs, per spec (clamp below to −90 dBFS). */
export const DBFS_FLOOR = -90;

/** Samples at/above this absolute value count as microphone clipping (§8.1). */
export const CLIPPING_THRESHOLD = 32000;

export interface RmsFrames {
  /** Per-frame loudness in dBFS, clamped to ≥ −90. */
  dbfs: Float32Array;
  /** 1 if any sample in the frame clips (|x| ≥ 32000), else 0. */
  clipped: Uint8Array;
  /** Number of frames. */
  count: number;
  /** Frame duration in ms (64 at 16 kHz). */
  frameMs: number;
  /** Hop duration in ms (32 at 16 kHz). */
  hopMs: number;
  sampleRate: number;
}

/** Start time (ms) of frame `i`. */
export function frameStartMs(i: number, hopMs: number): number {
  return i * hopMs;
}

/**
 * Compute framed RMS/dBFS over `samples`.
 *
 * dbfs(f) = 20·log10( max(rms, 1) / 32768 ), clamped to ≥ −90 (§3.2).
 */
export function computeRmsFrames(
  samples: Float32Array,
  sampleRate: number = TARGET_SAMPLE_RATE,
): RmsFrames {
  const count =
    samples.length < FRAME_SIZE
      ? samples.length > 0
        ? 1
        : 0
      : 1 + Math.floor((samples.length - FRAME_SIZE) / HOP_SIZE);

  const dbfs = new Float32Array(count);
  const clipped = new Uint8Array(count);
  const hopMs = (HOP_SIZE / sampleRate) * 1000;
  const frameMs = (FRAME_SIZE / sampleRate) * 1000;

  for (let f = 0; f < count; f++) {
    const start = f * HOP_SIZE;
    const end = Math.min(start + FRAME_SIZE, samples.length);
    let sumSq = 0;
    let clip = 0;
    for (let i = start; i < end; i++) {
      const x = samples[i];
      sumSq += x * x;
      if (Math.abs(x) >= CLIPPING_THRESHOLD) clip = 1;
    }
    const n = end - start;
    const rms = n > 0 ? Math.sqrt(sumSq / n) : 0;
    const value = 20 * Math.log10(Math.max(rms, 1) / 32768);
    dbfs[f] = value < DBFS_FLOOR ? DBFS_FLOOR : value;
    clipped[f] = clip;
  }

  return { dbfs, clipped, count, frameMs, hopMs, sampleRate };
}

/** Fraction of frames flagged as clipping (§8.1 `too_loud_clipping` gate). */
export function clippingRatio(frames: RmsFrames): number {
  if (frames.count === 0) return 0;
  let c = 0;
  for (let i = 0; i < frames.count; i++) c += frames.clipped[i];
  return c / frames.count;
}
