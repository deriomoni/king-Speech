import { detectPitchHz } from "@/services/pitchDetect";

export interface VoiceRange {
  fLow: number;
  fHigh: number;
}

export const DEFAULT_VOICE_RANGE: VoiceRange = {
  fLow: 130,
  fHigh: 340,
};

export const CALIBRATION_STORAGE_KEY = "@kingspeech_warmup_range";

export function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

export function positionFromHz(f: number, range: VoiceRange): number {
  const { fLow, fHigh } = range;
  if (f <= 0 || fLow <= 0 || fHigh <= fLow) return 0.5;
  const num = Math.log2(f) - Math.log2(fLow);
  const den = Math.log2(fHigh) - Math.log2(fLow);
  if (den <= 0) return 0.5;
  return clamp01(num / den);
}

export function targetHz(offsetNorm: number, range: VoiceRange): number {
  const { fLow, fHigh } = range;
  const ratio = fHigh / fLow;
  return fLow * Math.pow(ratio, clamp01(offsetNorm));
}

export function centsBetween(fA: number, fB: number): number {
  if (fA <= 0 || fB <= 0) return 9999;
  return Math.abs(1200 * Math.log2(fA / fB));
}

/** EMA over last N pitch samples. */
export class PitchSmoother {
  private readonly alpha: number;
  private value: number | null = null;

  constructor(windowSize = 4) {
    this.alpha = 2 / (windowSize + 1);
  }

  push(hz: number | null): number | null {
    if (hz == null || !Number.isFinite(hz)) return this.value;
    if (this.value == null) {
      this.value = hz;
      return hz;
    }
    this.value = this.alpha * hz + (1 - this.alpha) * this.value;
    return this.value;
  }

  reset() {
    this.value = null;
  }
}

export function medianHz(samples: number[]): number | null {
  if (samples.length === 0) return null;
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

export function detectPitchFromBuffer(
  buffer: Float32Array,
  sampleRate: number,
): number | null {
  return detectPitchHz(buffer, sampleRate);
}
