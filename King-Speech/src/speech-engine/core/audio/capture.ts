/**
 * Audio capture / PCM ingestion (spec §3.1).
 *
 * The Warmup amplitude engine only exposes an `expo-av` metering scalar on
 * device — no raw PCM — so the RMS pipeline (§3.2+) instead consumes the WAV
 * that `expo-speech-recognition` persists for the SAME single microphone
 * capture (`recordingOptions.persist`). This module turns that WAV file into
 * a mono PCM16 stream at 16 kHz.
 *
 * HC-2: no network here. Bytes are read from a local file URI only.
 */

/** Target format for all downstream DSP: mono, 16-bit-scaled samples, 16 kHz. */
export const TARGET_SAMPLE_RATE = 16000;

/** Anti-alias FIR length and cutoff for decimation (spec §3.1). */
export const FIR_TAPS = 32;
export const FIR_CUTOFF_HZ = 7200;

export interface Pcm {
  /**
   * Samples in the int16 amplitude domain (nominally −32768..32767) held as
   * floats so filtering/resampling stay lossless. The RMS formula (§3.2) and
   * the clipping gate (§8.1, `|x| ≥ 32000`) both operate in this domain.
   */
  samples: Float32Array;
  sampleRate: number;
}

interface WavData {
  samples: Float32Array; // int16-scaled, interleaved-then-downmixed to mono
  sampleRate: number;
  channels: number;
}

const BASE64_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/**
 * Decode a base64 string to bytes. Implemented locally (no `atob`/Buffer) so
 * the engine has zero runtime deps and behaves identically under Jest.
 */
export function base64ToBytes(b64: string): Uint8Array {
  const lookup = new Int16Array(256).fill(-1);
  for (let i = 0; i < BASE64_ALPHABET.length; i++) {
    lookup[BASE64_ALPHABET.charCodeAt(i)] = i;
  }
  // Count valid symbols only (whitespace, newlines and '=' padding are ignored).
  let validCount = 0;
  for (let i = 0; i < b64.length; i++) {
    if (lookup[b64.charCodeAt(i)] >= 0) validCount++;
  }
  const outLen = Math.floor((validCount * 6) / 8);
  const out = new Uint8Array(outLen);
  let o = 0;
  let acc = 0;
  let bits = 0;
  for (let i = 0; i < b64.length; i++) {
    const v = lookup[b64.charCodeAt(i)];
    if (v < 0) continue; // skip padding / whitespace
    acc = (acc << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[o++] = (acc >> bits) & 0xff;
    }
  }
  return out;
}

function readAscii(bytes: Uint8Array, offset: number, len: number): string {
  let s = '';
  for (let i = 0; i < len; i++) s += String.fromCharCode(bytes[offset + i]);
  return s;
}

/**
 * Parse a RIFF/WAVE buffer into mono int16-scaled samples. Supports PCM16
 * (format 1) and IEEE float32 (format 3); other encodings throw. Multi-channel
 * audio is downmixed to mono by averaging.
 */
export function parseWav(bytes: Uint8Array): WavData {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (readAscii(bytes, 0, 4) !== 'RIFF' || readAscii(bytes, 8, 4) !== 'WAVE') {
    throw new Error('capture: not a RIFF/WAVE file');
  }

  let channels = 1;
  let sampleRate = TARGET_SAMPLE_RATE;
  let bitsPerSample = 16;
  let audioFormat = 1;
  let dataOffset = -1;
  let dataLength = 0;

  // Walk chunks starting after the 12-byte RIFF header.
  let pos = 12;
  while (pos + 8 <= bytes.length) {
    const id = readAscii(bytes, pos, 4);
    const size = view.getUint32(pos + 4, true);
    const body = pos + 8;
    if (id === 'fmt ') {
      audioFormat = view.getUint16(body, true);
      channels = Math.max(1, view.getUint16(body + 2, true));
      sampleRate = view.getUint32(body + 4, true);
      bitsPerSample = view.getUint16(body + 14, true);
    } else if (id === 'data') {
      dataOffset = body;
      dataLength = size;
    }
    // Chunks are word-aligned: pad odd sizes by one byte.
    pos = body + size + (size % 2);
  }

  if (dataOffset < 0) throw new Error('capture: WAV has no data chunk');
  // Guard against a truncated final chunk.
  dataLength = Math.min(dataLength, bytes.length - dataOffset);

  const bytesPerSample = bitsPerSample >> 3;
  const frameCount = Math.floor(dataLength / (bytesPerSample * channels));
  const mono = new Float32Array(frameCount);

  for (let f = 0; f < frameCount; f++) {
    let acc = 0;
    for (let c = 0; c < channels; c++) {
      const at = dataOffset + (f * channels + c) * bytesPerSample;
      let sample: number;
      if (audioFormat === 3 && bitsPerSample === 32) {
        // IEEE float in [-1, 1] → int16 domain.
        sample = view.getFloat32(at, true) * 32768;
      } else if (audioFormat === 1 && bitsPerSample === 16) {
        sample = view.getInt16(at, true);
      } else if (audioFormat === 1 && bitsPerSample === 32) {
        sample = view.getInt32(at, true) / 65536;
      } else if (audioFormat === 1 && bitsPerSample === 8) {
        // 8-bit PCM is unsigned, centered at 128.
        sample = (view.getUint8(at) - 128) * 256;
      } else {
        throw new Error(
          `capture: unsupported WAV format=${audioFormat} bits=${bitsPerSample}`,
        );
      }
      acc += sample;
    }
    mono[f] = acc / channels;
  }

  return { samples: mono, sampleRate, channels };
}

/**
 * 32-tap Hamming-windowed sinc low-pass (spec §3.1 anti-alias FIR).
 * `cutoffHz` is relative to `sampleRate`.
 */
function lowPassFir(sampleRate: number, cutoffHz: number, taps: number): Float32Array {
  const h = new Float32Array(taps);
  const fc = cutoffHz / sampleRate; // normalized cutoff (cycles/sample)
  const mid = (taps - 1) / 2;
  let sum = 0;
  for (let n = 0; n < taps; n++) {
    const k = n - mid;
    // Ideal sinc.
    const sinc = k === 0 ? 2 * fc : Math.sin(2 * Math.PI * fc * k) / (Math.PI * k);
    // Hamming window.
    const w = 0.54 - 0.46 * Math.cos((2 * Math.PI * n) / (taps - 1));
    h[n] = sinc * w;
    sum += h[n];
  }
  // Normalize to unity DC gain.
  for (let n = 0; n < taps; n++) h[n] /= sum;
  return h;
}

function convolveSame(input: Float32Array, kernel: Float32Array): Float32Array {
  const out = new Float32Array(input.length);
  const kLen = kernel.length;
  const half = Math.floor(kLen / 2);
  for (let i = 0; i < input.length; i++) {
    let acc = 0;
    for (let k = 0; k < kLen; k++) {
      const idx = i + k - half;
      if (idx >= 0 && idx < input.length) acc += input[idx] * kernel[k];
    }
    out[i] = acc;
  }
  return out;
}

/**
 * Resample mono int16-scaled samples to 16 kHz. If already at the target rate,
 * returns the input untouched. Otherwise applies the anti-alias FIR (§3.1) and
 * linearly resamples — this also covers non-integer ratios (e.g. 44100→16000).
 */
export function resampleTo16k(samples: Float32Array, sampleRate: number): Pcm {
  if (sampleRate === TARGET_SAMPLE_RATE || samples.length === 0) {
    return { samples, sampleRate: TARGET_SAMPLE_RATE };
  }
  const filtered =
    sampleRate > TARGET_SAMPLE_RATE
      ? convolveSame(samples, lowPassFir(sampleRate, FIR_CUTOFF_HZ, FIR_TAPS))
      : samples;
  const ratio = sampleRate / TARGET_SAMPLE_RATE;
  const outLen = Math.floor(samples.length / ratio);
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const srcPos = i * ratio;
    const lo = Math.floor(srcPos);
    const hi = Math.min(lo + 1, filtered.length - 1);
    const frac = srcPos - lo;
    out[i] = filtered[lo] * (1 - frac) + filtered[hi] * frac;
  }
  return { samples: out, sampleRate: TARGET_SAMPLE_RATE };
}

/** Parse + downmix + resample a WAV buffer to the canonical 16 kHz mono PCM. */
export function pcmFromWavBytes(bytes: Uint8Array): Pcm {
  const { samples, sampleRate } = parseWav(bytes);
  return resampleTo16k(samples, sampleRate);
}

/**
 * Load and decode the persisted WAV at `uri` into 16 kHz mono PCM.
 *
 * Uses `expo-file-system` (legacy string API — the enum export is not reliably
 * reachable through `require()` in this project, mirroring the existing app
 * usage). No network access (HC-2).
 */
export async function loadPcmFromWavUri(uri: string): Promise<Pcm> {
  // Lazy require so Jest/unit tests never pull in the native module.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const FileSystem = require('expo-file-system/legacy') as {
    readAsStringAsync: (u: string, o: { encoding: string }) => Promise<string>;
  };
  const b64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
  return pcmFromWavBytes(base64ToBytes(b64));
}
