/**
 * Voice-activity detection, noise floor and pause map (spec §3.3–3.4).
 *
 * Consumes framed dBFS from `rms.ts`. All timing is expressed in the hop grid
 * (32 ms/frame at 16 kHz): frame `i` starts at `i · hopMs`.
 */

import { percentile } from '../util';
import { frameStartMs, RmsFrames } from './rms';

/** Speech threshold margin above the noise floor, dB (§3.3). */
export const SPEECH_MARGIN_DB = 12;
/** Hysteresis: silence→speech needs 3 consecutive speech frames (96 ms). */
export const HYST_SPEECH_FRAMES = 3;
/** Hysteresis: speech→silence needs 6 consecutive silent frames (192 ms). */
export const HYST_SILENCE_FRAMES = 6;
/** Minimum silence span counted as a pause (§3.4). */
export const PAUSE_MIN_MS = 180;
/** Window for the initial noise-floor estimate. */
export const NOISE_INIT_MS = 500;
/** Sliding window for the adaptive noise-floor update. */
export const NOISE_WINDOW_MS = 3000;

export interface Pause {
  startMs: number;
  endMs: number;
  durMs: number;
}

export interface SpeechSegment {
  startMs: number;
  endMs: number;
}

export interface VadResult {
  /** Per-frame speech (1) / silence (0) after hysteresis. */
  isSpeech: Uint8Array;
  /** Canonical noise floor: 10th percentile dBFS over the first 500 ms (§3.3). */
  noiseFloor: number;
  /** noiseFloor + 12 dB. */
  speechThr: number;
  /** Internal pauses (≥180 ms) between the first and last speech frame (§3.4). */
  pauses: Pause[];
  /** Contiguous speech runs. */
  speechSegments: SpeechSegment[];
  /** dBFS of every speech frame — feeds the loudness metric (§3.5). */
  speechDbfs: number[];
  speechFrameCount: number;
  totalFrameCount: number;
  /** speechFrameCount / totalFrameCount — the `mostly_silence` gate (§8.1). */
  speechRatio: number;
  firstSpeechFrame: number; // -1 if no speech
  lastSpeechFrame: number; // -1 if no speech
  /** Total speech duration in ms (Σ segment lengths) — tempo denominator (§6.2). */
  speechDurationMs: number;
  hopMs: number;
  frameMs: number;
}

function emptyResult(frames: RmsFrames): VadResult {
  return {
    isSpeech: new Uint8Array(0),
    noiseFloor: 0,
    speechThr: SPEECH_MARGIN_DB,
    pauses: [],
    speechSegments: [],
    speechDbfs: [],
    speechFrameCount: 0,
    totalFrameCount: frames.count,
    speechRatio: 0,
    firstSpeechFrame: -1,
    lastSpeechFrame: -1,
    speechDurationMs: 0,
    hopMs: frames.hopMs,
    frameMs: frames.frameMs,
  };
}

export function computeVad(frames: RmsFrames): VadResult {
  const { dbfs, count, hopMs, frameMs } = frames;
  if (count === 0) return emptyResult(frames);

  // --- Canonical noise floor: 10th percentile over the first 500 ms. ---
  const initDbfs: number[] = [];
  for (let i = 0; i < count; i++) {
    if (frameStartMs(i, hopMs) < NOISE_INIT_MS) initDbfs.push(dbfs[i]);
  }
  if (initDbfs.length === 0) initDbfs.push(dbfs[0]);
  const noiseFloor = percentile(initDbfs, 0.1);
  const speechThr = noiseFloor + SPEECH_MARGIN_DB;

  // --- Raw classification with an adaptive floor (sliding 3 s of silence). ---
  const rawSpeech = new Uint8Array(count);
  let adaptiveFloor = noiseFloor;
  const silenceWindow: { ms: number; db: number }[] = [];
  for (let i = 0; i < count; i++) {
    const isSp = dbfs[i] >= adaptiveFloor + SPEECH_MARGIN_DB ? 1 : 0;
    rawSpeech[i] = isSp;
    if (!isSp) {
      const ms = frameStartMs(i, hopMs);
      silenceWindow.push({ ms, db: dbfs[i] });
      while (silenceWindow.length > 0 && ms - silenceWindow[0].ms > NOISE_WINDOW_MS) {
        silenceWindow.shift();
      }
      adaptiveFloor = percentile(
        silenceWindow.map((s) => s.db),
        0.1,
      );
    }
  }

  // --- Hysteresis with retroactive backfill of the triggering run (§3.3). ---
  const isSpeech = new Uint8Array(count);
  let state = 0; // 0 = silence, 1 = speech
  let runVal = -1;
  let run = 0;
  for (let i = 0; i < count; i++) {
    const v = rawSpeech[i];
    if (v === runVal) run++;
    else {
      runVal = v;
      run = 1;
    }
    if (state === 0 && v === 1 && run >= HYST_SPEECH_FRAMES) {
      state = 1;
      for (let k = Math.max(0, i - HYST_SPEECH_FRAMES + 1); k <= i; k++) isSpeech[k] = 1;
    } else if (state === 1 && v === 0 && run >= HYST_SILENCE_FRAMES) {
      state = 0;
      for (let k = Math.max(0, i - HYST_SILENCE_FRAMES + 1); k <= i; k++) isSpeech[k] = 0;
    } else {
      isSpeech[i] = state;
    }
  }

  // --- Derived stats. ---
  let speechFrameCount = 0;
  let firstSpeechFrame = -1;
  let lastSpeechFrame = -1;
  const speechDbfs: number[] = [];
  for (let i = 0; i < count; i++) {
    if (isSpeech[i]) {
      speechFrameCount++;
      speechDbfs.push(dbfs[i]);
      if (firstSpeechFrame < 0) firstSpeechFrame = i;
      lastSpeechFrame = i;
    }
  }

  // Speech segments (contiguous speech runs).
  const speechSegments: SpeechSegment[] = [];
  let segStart = -1;
  for (let i = 0; i < count; i++) {
    if (isSpeech[i] && segStart < 0) segStart = i;
    if ((!isSpeech[i] || i === count - 1) && segStart >= 0) {
      const segEnd = isSpeech[i] ? i : i - 1;
      speechSegments.push({
        startMs: segStart * hopMs,
        endMs: (segEnd + 1) * hopMs,
      });
      segStart = -1;
    }
  }
  let speechDurationMs = 0;
  for (const s of speechSegments) speechDurationMs += s.endMs - s.startMs;

  // Internal pauses: silence runs between the first and last speech frame.
  const pauses: Pause[] = [];
  if (firstSpeechFrame >= 0 && lastSpeechFrame > firstSpeechFrame) {
    let runStart = -1;
    for (let i = firstSpeechFrame; i <= lastSpeechFrame; i++) {
      if (!isSpeech[i] && runStart < 0) runStart = i;
      if ((isSpeech[i] || i === lastSpeechFrame) && runStart >= 0) {
        const runEnd = isSpeech[i] ? i - 1 : i;
        // Only interior runs (endpoints are speech, so this always holds).
        if (runEnd >= runStart && runEnd < lastSpeechFrame) {
          const durMs = (runEnd - runStart + 1) * hopMs;
          if (durMs >= PAUSE_MIN_MS) {
            pauses.push({
              startMs: runStart * hopMs,
              endMs: (runEnd + 1) * hopMs,
              durMs,
            });
          }
        }
        runStart = -1;
      }
    }
  }

  return {
    isSpeech,
    noiseFloor,
    speechThr,
    pauses,
    speechSegments,
    speechDbfs,
    speechFrameCount,
    totalFrameCount: count,
    speechRatio: count > 0 ? speechFrameCount / count : 0,
    firstSpeechFrame,
    lastSpeechFrame,
    speechDurationMs,
    hopMs,
    frameMs,
  };
}
