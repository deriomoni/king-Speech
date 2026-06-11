import { writeFileSync } from "fs";

const SAMPLE_RATE = 22050;
const BITS = 16;
const MAX_AMP = 32767;

function writeWav(filename, samples) {
  const numSamples = samples.length;
  const dataSize = numSamples * 2;
  const buf = Buffer.alloc(44 + dataSize);

  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(SAMPLE_RATE, 24);
  buf.writeUInt32LE(SAMPLE_RATE * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < numSamples; i++) {
    const v = Math.max(-MAX_AMP, Math.min(MAX_AMP, Math.round(samples[i])));
    buf.writeInt16LE(v, 44 + i * 2);
  }

  writeFileSync(filename, buf);
  console.log(`Written: ${filename} (${(dataSize / 1024).toFixed(1)} KB, ${(numSamples / SAMPLE_RATE).toFixed(2)}s)`);
}

// Random number helpers
let seed = 42;
function rand() {
  seed = (seed * 1664525 + 1013904223) & 0xffffffff;
  return (seed >>> 0) / 0xffffffff;
}
function noise() { return rand() * 2 - 1; }

// Simple one-pole low-pass filter state
function makeLPF(cutoff) {
  const rc = 1 / (2 * Math.PI * cutoff);
  const dt = 1 / SAMPLE_RATE;
  const alpha = dt / (rc + dt);
  let prev = 0;
  return (x) => { prev = prev + alpha * (x - prev); return prev; };
}

// Generate a single clap burst: fast attack, exponential decay, shaped noise
function clapBurst(durationSamples, attackSamples, decayRate, bandFreq, amplitude) {
  const lpf = makeLPF(bandFreq);
  const hpf = makeLPF(bandFreq * 0.1);
  let hpState = 0;
  const samples = [];
  for (let i = 0; i < durationSamples; i++) {
    let env = 0;
    if (i < attackSamples) {
      env = i / attackSamples;
    } else {
      env = Math.exp(-decayRate * (i - attackSamples) / SAMPLE_RATE);
    }
    const n = noise();
    const filtered = lpf(n) - (hpState = hpState + 0.02 * (n - hpState));
    samples.push(filtered * env * amplitude);
  }
  return samples;
}

// Mix segments at specific offsets into a large buffer
function mixInto(dst, src, offset) {
  for (let i = 0; i < src.length; i++) {
    const idx = offset + i;
    if (idx < dst.length) dst[idx] += src[i];
  }
}

// Master envelope over whole track
function applyMasterEnvelope(samples, fadeInSec, fadeOutSec, attackSec) {
  const fadeInS = Math.round(fadeInSec * SAMPLE_RATE);
  const fadeOutS = Math.round(fadeOutSec * SAMPLE_RATE);
  const attackS = Math.round(attackSec * SAMPLE_RATE);
  const n = samples.length;
  for (let i = 0; i < n; i++) {
    let env = 1;
    if (i < attackS) {
      env = Math.pow(i / attackS, 0.5);
    } else if (i < fadeInS) {
      env = 1;
    }
    if (i > n - fadeOutS) {
      env *= (n - i) / fadeOutS;
    }
    samples[i] *= env;
  }
}

// Normalize to target amplitude
function normalize(samples, target = 0.9) {
  let peak = 0;
  for (const s of samples) peak = Math.max(peak, Math.abs(s));
  if (peak === 0) return;
  const gain = target / peak;
  for (let i = 0; i < samples.length; i++) samples[i] *= gain;
}

// ─────────────────────────────────────────────────────────────
// 1. LIGHT APPLAUSE — sparse clapping, 4 sec, polite audience
// ─────────────────────────────────────────────────────────────
function generateLightApplause() {
  const durationSec = 4.5;
  const totalSamples = Math.round(durationSec * SAMPLE_RATE);
  const buf = new Float64Array(totalSamples);
  seed = 101;

  // ~4-5 claps/sec, 8-10 "streams" of clappers
  const streams = 8;
  for (let s = 0; s < streams; s++) {
    let t = rand() * 0.3; // random start within first 300ms
    while (t < durationSec - 0.1) {
      const interval = 0.18 + rand() * 0.12; // 180-300ms between claps
      const offset = Math.round(t * SAMPLE_RATE);
      const dur = Math.round((0.08 + rand() * 0.04) * SAMPLE_RATE);
      const clap = clapBurst(dur, Math.round(0.004 * SAMPLE_RATE), 18, 2000 + rand() * 2000, 0.15 + rand() * 0.1);
      mixInto(buf, clap, offset);
      t += interval;
    }
  }

  // Light crowd murmur underneath
  const murmurLPF = makeLPF(300);
  for (let i = 0; i < totalSamples; i++) {
    buf[i] += murmurLPF(noise()) * 0.03;
  }

  applyMasterEnvelope(buf, totalSamples * 0.6, 0.8, 0.3);
  normalize(buf, 0.75);
  return buf;
}

// ─────────────────────────────────────────────────────────────
// 2. HEAVY OVATION — dense clapping + crowd roar, 5 sec
// ─────────────────────────────────────────────────────────────
function generateHeavyOvation() {
  const durationSec = 5.5;
  const totalSamples = Math.round(durationSec * SAMPLE_RATE);
  const buf = new Float64Array(totalSamples);
  seed = 202;

  const streams = 24;
  for (let s = 0; s < streams; s++) {
    let t = rand() * 0.15;
    while (t < durationSec - 0.05) {
      const interval = 0.13 + rand() * 0.08;
      const offset = Math.round(t * SAMPLE_RATE);
      const dur = Math.round((0.07 + rand() * 0.05) * SAMPLE_RATE);
      const amp = 0.18 + rand() * 0.14;
      const clap = clapBurst(dur, Math.round(0.003 * SAMPLE_RATE), 22, 1500 + rand() * 3000, amp);
      mixInto(buf, clap, offset);
      t += interval;
    }
  }

  // Crowd roar — low rumble growing
  const roarLPF1 = makeLPF(180);
  const roarLPF2 = makeLPF(80);
  for (let i = 0; i < totalSamples; i++) {
    const progress = i / totalSamples;
    const roarAmp = 0.08 + progress * 0.12;
    buf[i] += roarLPF2(roarLPF1(noise())) * roarAmp;
  }

  // Whistle-like high tone bursts
  for (let w = 0; w < 3; w++) {
    const wStart = Math.round((0.5 + rand() * 3.5) * SAMPLE_RATE);
    const wDur = Math.round((0.15 + rand() * 0.2) * SAMPLE_RATE);
    const freq = 2000 + rand() * 1000;
    for (let i = 0; i < wDur && wStart + i < totalSamples; i++) {
      const env = Math.sin(Math.PI * i / wDur);
      buf[wStart + i] += Math.sin(2 * Math.PI * freq * i / SAMPLE_RATE) * env * 0.08;
    }
  }

  applyMasterEnvelope(buf, totalSamples * 0.5, 1.2, 0.2);
  normalize(buf, 0.85);
  return buf;
}

// ─────────────────────────────────────────────────────────────
// 3. EXPLOSIVE BURST — sudden eruption, peak, gradual fade, 6 sec
// ─────────────────────────────────────────────────────────────
function generateExplosiveBurst() {
  const durationSec = 6.0;
  const totalSamples = Math.round(durationSec * SAMPLE_RATE);
  const buf = new Float64Array(totalSamples);
  seed = 303;

  // Initial impact transient (0-150ms)
  const impactSamples = Math.round(0.15 * SAMPLE_RATE);
  const impactLPF = makeLPF(5000);
  for (let i = 0; i < impactSamples; i++) {
    const env = Math.exp(-30 * i / SAMPLE_RATE);
    buf[i] += impactLPF(noise()) * env * 0.6;
  }

  // 32 streams of frantic clapping
  const streams = 32;
  for (let s = 0; s < streams; s++) {
    let t = rand() * 0.05; // almost instant start
    while (t < durationSec - 0.05) {
      const progress = t / durationSec;
      // Clap rate slows down over time (excitement fades slightly)
      const interval = (0.10 + rand() * 0.06) * (1 + progress * 0.8);
      const offset = Math.round(t * SAMPLE_RATE);
      const dur = Math.round((0.06 + rand() * 0.05) * SAMPLE_RATE);
      const amp = (0.2 + rand() * 0.15) * (1 - progress * 0.3);
      const clap = clapBurst(dur, Math.round(0.002 * SAMPLE_RATE), 25, 1200 + rand() * 4000, amp);
      mixInto(buf, clap, offset);
      t += interval;
    }
  }

  // Massive crowd roar
  const roarLPF1 = makeLPF(200);
  const roarLPF2 = makeLPF(100);
  const roarLPF3 = makeLPF(50);
  for (let i = 0; i < totalSamples; i++) {
    const progress = i / totalSamples;
    const roarEnv = Math.pow(Math.max(0, 1 - progress * 0.6), 0.5);
    buf[i] += roarLPF3(roarLPF2(roarLPF1(noise()))) * roarEnv * 0.2;
  }

  // Multiple whistle bursts
  for (let w = 0; w < 5; w++) {
    const wStart = Math.round((rand() * 3.0) * SAMPLE_RATE);
    const wDur = Math.round((0.2 + rand() * 0.3) * SAMPLE_RATE);
    const freq = 1800 + rand() * 1400;
    const vib = 3 + rand() * 5;
    for (let i = 0; i < wDur && wStart + i < totalSamples; i++) {
      const env = Math.sin(Math.PI * i / wDur) * (1 + 0.1 * Math.sin(2 * Math.PI * vib * i / SAMPLE_RATE));
      buf[wStart + i] += Math.sin(2 * Math.PI * freq * i / SAMPLE_RATE) * env * 0.07;
    }
  }

  // Master envelope: fast attack burst, sustained peak, long fade
  const n = totalSamples;
  const attackS = Math.round(0.05 * SAMPLE_RATE);
  const peakS = Math.round(1.2 * SAMPLE_RATE);
  const fadeS = Math.round(3.5 * SAMPLE_RATE);
  for (let i = 0; i < n; i++) {
    let env = 1;
    if (i < attackS) {
      env = i / attackS;
    } else if (i > peakS) {
      const fadeProgress = (i - peakS) / fadeS;
      env = Math.max(0, 1 - fadeProgress * fadeProgress);
    }
    buf[i] *= env;
  }

  normalize(buf, 0.9);
  return buf;
}

// Generate all 3 sounds
console.log("Generating applause sounds...\n");

const light = generateLightApplause();
writeWav("assets/sounds/applause-light.wav", Array.from(light).map(s => s * MAX_AMP));

const heavy = generateHeavyOvation();
writeWav("assets/sounds/applause-heavy.wav", Array.from(heavy).map(s => s * MAX_AMP));

const burst = generateExplosiveBurst();
writeWav("assets/sounds/applause-burst.wav", Array.from(burst).map(s => s * MAX_AMP));

console.log("\nDone! All 3 sounds generated in assets/sounds/");
