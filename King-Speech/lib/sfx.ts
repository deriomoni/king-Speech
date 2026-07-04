/**
 * Lightweight sound-effects helper for Show Time.
 *
 * No binary asset files are shipped: short UI sounds are *synthesized* at
 * runtime. On native we render a tiny 16-bit PCM WAV into the cache directory
 * once and play it with expo-av; on web we use the Web Audio API directly.
 *
 * Every call is wrapped in try/catch and degrades to a silent no-op, so a
 * missing permission or unsupported platform never breaks the screen.
 */
import { Platform } from "react-native";

export type SfxName = "click" | "swipe" | "success" | "applause";

let muted = false;
export function setSfxMuted(v: boolean) {
  muted = v;
}

// ── WAV synthesis ────────────────────────────────────────────────────────────
const SAMPLE_RATE = 22050;

function renderSamples(name: SfxName): Float32Array {
  const sr = SAMPLE_RATE;
  const sec = (s: number) => Math.floor(s * sr);
  switch (name) {
    case "click": {
      const n = sec(0.06);
      const out = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const env = Math.exp(-t * 55);
        out[i] = Math.sin(2 * Math.PI * 1200 * t) * env * 0.6;
      }
      return out;
    }
    case "swipe": {
      const n = sec(0.14);
      const out = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const p = i / n;
        const freq = 560 + 700 * p; // rising sweep
        const env = Math.sin(Math.PI * p); // soft in/out
        out[i] = Math.sin(2 * Math.PI * freq * t) * env * 0.5;
      }
      return out;
    }
    case "success": {
      const n = sec(0.34);
      const out = new Float32Array(n);
      const tones = [660, 880, 1175]; // ascending arpeggio
      const seg = Math.floor(n / tones.length);
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const idx = Math.min(tones.length - 1, Math.floor(i / seg));
        const local = (i - idx * seg) / seg;
        const env = Math.sin(Math.PI * local) * 0.6;
        out[i] = Math.sin(2 * Math.PI * tones[idx] * t) * env * 0.55;
      }
      return out;
    }
    case "applause": {
      // Filtered noise with a swell to evoke a crowd clap.
      const n = sec(0.9);
      const out = new Float32Array(n);
      let last = 0;
      for (let i = 0; i < n; i++) {
        const p = i / n;
        const swell = Math.sin(Math.PI * Math.min(1, p * 1.2)) * 0.9;
        const white = Math.random() * 2 - 1;
        last = last * 0.6 + white * 0.4; // crude low-pass
        out[i] = last * swell * 0.5;
      }
      return out;
    }
    default:
      return new Float32Array(0);
  }
}

function floatToWavBytes(samples: Float32Array): Uint8Array {
  const numSamples = samples.length;
  const bytesPerSample = 2;
  const dataSize = numSamples * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, dataSize, true);
  let off = 44;
  for (let i = 0; i < numSamples; i++) {
    let s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    off += 2;
  }
  return new Uint8Array(buffer);
}

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
function bytesToBase64(bytes: Uint8Array): string {
  let out = "";
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + B64[n & 63];
  }
  const rem = bytes.length - i;
  if (rem === 1) {
    const n = bytes[i] << 16;
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + "==";
  } else if (rem === 2) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + "=";
  }
  return out;
}

// ── Native (expo-av + cached WAV files) ──────────────────────────────────────
let NativeAudio: any = null;
let NativeFS: any = null;
if (Platform.OS !== "web") {
  try { NativeAudio = require("expo-av").Audio; } catch {}
  try { NativeFS = require("expo-file-system/legacy"); } catch {}
}

const soundCache: Record<string, any> = {};

async function ensureNativeSound(name: SfxName): Promise<any | null> {
  if (!NativeAudio || !NativeFS?.cacheDirectory) return null;
  if (soundCache[name]) return soundCache[name];
  const uri = `${NativeFS.cacheDirectory}sfx_${name}.wav`;
  try {
    const info = await NativeFS.getInfoAsync(uri);
    if (!info.exists) {
      const wav = floatToWavBytes(renderSamples(name));
      await NativeFS.writeAsStringAsync(uri, bytesToBase64(wav), {
        encoding: NativeFS.EncodingType.Base64,
      });
    }
    const { sound } = await NativeAudio.Sound.createAsync(
      { uri },
      { volume: 0.55 },
    );
    soundCache[name] = sound;
    return sound;
  } catch {
    return null;
  }
}

// ── Web (Web Audio API) ──────────────────────────────────────────────────────
let webCtx: any = null;
function playWeb(name: SfxName) {
  try {
    const AC = (globalThis as any).AudioContext || (globalThis as any).webkitAudioContext;
    if (!AC) return;
    if (!webCtx) webCtx = new AC();
    const ctx = webCtx;
    const samples = renderSamples(name);
    const buf = ctx.createBuffer(1, samples.length, SAMPLE_RATE);
    buf.getChannelData(0).set(samples);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const gain = ctx.createGain();
    gain.gain.value = 0.55;
    src.connect(gain).connect(ctx.destination);
    src.start();
  } catch {}
}

/** Play a one-shot effect. Safe no-op when muted or unsupported. */
export async function playSfx(name: SfxName): Promise<void> {
  if (muted) return;
  if (Platform.OS === "web") {
    playWeb(name);
    return;
  }
  try {
    const sound = await ensureNativeSound(name);
    if (sound) await sound.replayAsync();
  } catch {}
}

/** Pre-generate & load native sounds so the first play has no latency. */
export async function preloadSfx(names: SfxName[]): Promise<void> {
  if (Platform.OS === "web") return;
  for (const n of names) {
    try { await ensureNativeSound(n); } catch {}
  }
}

/** Free cached native sounds (call on screen unmount). */
export async function unloadSfx(): Promise<void> {
  const entries = Object.entries(soundCache);
  for (const [k, s] of entries) {
    try { await s.unloadAsync(); } catch {}
    delete soundCache[k];
  }
}
