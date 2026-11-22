// Recording options for takes that get sent for speech analysis.
//
// The stock HIGH_QUALITY preset is tuned for music — stereo, 44.1 kHz,
// 128 kbps — and every second of it is uploaded (as base64, +33 %) before the
// analysis can even start. Speech needs none of that: the transcription model
// works on 16 kHz mono, and loudness is measured on 16 kHz mono too. So record
// one channel at 22.05 kHz, 48 kbps AAC — about 2.7× less data, still clean
// voice on playback, and no loss for transcription or the volume score.
//
// Metering stays on (the live waveform and amplitude envelope need it).
export function speechRecordingOptions(base: any): any {
  return {
    ...base,
    sampleRate: 22050,
    numberOfChannels: 1,
    bitRate: 48000,
    isMeteringEnabled: true,
    ios: { ...(base?.ios ?? {}), meteringEnabled: true },
    android: { ...(base?.android ?? {}) },
    web: { ...(base?.web ?? {}), bitsPerSecond: 48000 },
  };
}
