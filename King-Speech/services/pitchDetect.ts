/** Reference frequency for «до» (C4) in Hz — calibrated per session on device. */
export const DEFAULT_DO_FREQ = 261.63;

export function semitonesFromFrequency(freq: number, refHz: number): number {
  if (freq <= 0 || refHz <= 0) return 0;
  return 12 * Math.log2(freq / refHz);
}

export function frequencyFromSemitones(semitones: number, refHz: number): number {
  return refHz * Math.pow(2, semitones / 12);
}

/**
 * Autocorrelation pitch estimator (YIN-lite). Returns Hz or null if unvoiced.
 */
export function detectPitchHz(
  buffer: Float32Array,
  sampleRate: number,
  minHz = 80,
  maxHz = 600,
): number | null {
  const size = buffer.length;
  if (size < 256) return null;

  let rms = 0;
  for (let i = 0; i < size; i++) rms += buffer[i] * buffer[i];
  rms = Math.sqrt(rms / size);
  if (rms < 0.01) return null;

  const minLag = Math.floor(sampleRate / maxHz);
  const maxLag = Math.floor(sampleRate / minHz);

  let bestLag = -1;
  let bestCorr = 0;

  for (let lag = minLag; lag <= maxLag; lag++) {
    let corr = 0;
    for (let i = 0; i < size - lag; i++) {
      corr += buffer[i] * buffer[i + lag];
    }
    if (corr > bestCorr) {
      bestCorr = corr;
      bestLag = lag;
    }
  }

  if (bestLag <= 0 || bestCorr < rms * rms * size * 0.3) return null;
  return sampleRate / bestLag;
}

/** Map Russian note name to semitone offset from «до». */
const NOTE_OFFSET: Record<string, number> = {
  до: 0,
  ре: 2,
  ми: 4,
  фа: 5,
  соль: 7,
  ля: 9,
  си: 11,
};

export function noteNameToSemitone(name: string): number {
  const key = name.toLowerCase().trim();
  return NOTE_OFFSET[key] ?? 0;
}
