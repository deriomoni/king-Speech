import { useCallback, useRef } from "react";
import { Platform } from "react-native";

// ─────────────────────────────────────────────────────────────────────────────
// useReadingCapture — records the reading take for scoring + self-review.
//
// The karaoke highlight is a paced reading guide (see ReadingLevelView), not a
// speech follower, so capture has a single job: grab the audio. Native uses
// expo-av, web uses MediaRecorder. The downstream contract is unchanged —
// finish() resolves { durationSec, audioBase64?, audioUri? } for the existing
// server scorer and the self-review playback.
// ─────────────────────────────────────────────────────────────────────────────

let Audio: any = null;
if (Platform.OS !== "web") {
  Audio = require("expo-av").Audio;
}

export interface ReadingCaptureResult {
  durationSec: number;
  audioBase64?: string;
  audioUri?: string;
  /** Real amplitude envelope (0..1) from record-time metering (native). */
  waveform?: number[];
}

const ENVELOPE_BARS = 44;

// Downsample raw amplitude samples to a fixed-length, peak-normalised envelope.
function buildEnvelope(samples: number[], n: number): number[] | undefined {
  if (!samples.length) return undefined;
  const out = new Array(n).fill(0);
  const block = samples.length / n;
  let max = 0;
  for (let i = 0; i < n; i++) {
    const start = Math.floor(i * block);
    const end = Math.max(start + 1, Math.floor((i + 1) * block));
    let sum = 0;
    let cnt = 0;
    for (let j = start; j < end && j < samples.length; j++) {
      sum += samples[j];
      cnt++;
    }
    const avg = cnt ? sum / cnt : 0;
    out[i] = avg;
    if (avg > max) max = avg;
  }
  if (max > 0) for (let i = 0; i < n; i++) out[i] = Math.min(1, out[i] / max);
  return out;
}

export function useReadingCapture() {
  const startTsRef = useRef(0);
  const recordingRef = useRef<any>(null);
  const meterSamplesRef = useRef<number[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioBlobRef = useRef<Blob | null>(null);
  const stopPromiseRef = useRef<Promise<void> | null>(null);
  const stopResolveRef = useRef<(() => void) | null>(null);

  const begin = useCallback(async () => {
    startTsRef.current = Date.now();
    if (Platform.OS === "web") {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioStreamRef.current = stream;
        const mr = new MediaRecorder(stream);
        audioChunksRef.current = [];
        audioBlobRef.current = null;
        stopPromiseRef.current = new Promise<void>((resolve) => {
          stopResolveRef.current = resolve;
        });
        mr.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
        };
        mr.onstop = () => {
          audioBlobRef.current = new Blob(audioChunksRef.current, {
            type: "audio/webm",
          });
          stopResolveRef.current?.();
          stopResolveRef.current = null;
        };
        mr.start();
        mediaRecorderRef.current = mr;
      } catch {
        // Mic blocked — keep the visual flow so the user can still practice.
      }
      return;
    }
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const baseOpts = Audio.RecordingOptionsPresets.HIGH_QUALITY;
      const meteringOpts = {
        ...baseOpts,
        isMeteringEnabled: true,
        ios: { ...(baseOpts.ios ?? {}), meteringEnabled: true },
        android: { ...(baseOpts.android ?? {}) },
        web: { ...(baseOpts.web ?? {}) },
      };
      const { recording } = await Audio.Recording.createAsync(meteringOpts);
      recordingRef.current = recording;
      // Collect the real amplitude envelope from metering (dBFS → 0..1) so the
      // player can draw the actual waveform of this recording.
      meterSamplesRef.current = [];
      try {
        recording.setProgressUpdateInterval?.(90);
        recording.setOnRecordingStatusUpdate?.((status: any) => {
          if (typeof status?.metering === "number") {
            meterSamplesRef.current.push(Math.max(0, Math.min(1, (status.metering + 60) / 60)));
          }
        });
      } catch {}
    } catch {}
  }, []);

  const finish = useCallback(async (): Promise<ReadingCaptureResult> => {
    const durationSec = Math.max(
      1,
      Math.round((Date.now() - startTsRef.current) / 1000),
    );

    if (Platform.OS === "web") {
      try {
        if (
          mediaRecorderRef.current &&
          mediaRecorderRef.current.state !== "inactive"
        ) {
          mediaRecorderRef.current.stop();
        }
        audioStreamRef.current?.getTracks().forEach((tr) => tr.stop());
      } catch {}
      try {
        await Promise.race([
          stopPromiseRef.current ?? Promise.resolve(),
          new Promise<void>((resolve) => setTimeout(resolve, 1500)),
        ]);
      } catch {}
      stopPromiseRef.current = null;
      let audioBase64: string | undefined;
      let audioUri: string | undefined;
      const blob = audioBlobRef.current;
      if (blob) {
        try {
          audioUri = URL.createObjectURL(blob);
        } catch {}
        try {
          audioBase64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              const result = reader.result as string;
              resolve(result.split(",")[1] ?? "");
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        } catch {}
      }
      return { durationSec, audioBase64, audioUri };
    }

    let audioBase64: string | undefined;
    let audioUri: string | undefined;
    try {
      if (recordingRef.current) {
        await recordingRef.current.stopAndUnloadAsync();
        const uri = recordingRef.current.getURI?.() ?? null;
        recordingRef.current = null;
        if (uri) {
          audioUri = uri;
          const FileSystem = require("expo-file-system/legacy");
          audioBase64 = await FileSystem.readAsStringAsync(uri, {
            encoding: "base64",
          });
        }
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
    } catch (e) {
      console.warn("useReadingCapture: stop failed", e);
    }
    const waveform = buildEnvelope(meterSamplesRef.current, ENVELOPE_BARS);
    return { durationSec, audioBase64, audioUri, waveform };
  }, []);

  const cancel = useCallback(() => {
    try {
      audioStreamRef.current?.getTracks().forEach((tr) => tr.stop());
    } catch {}
    try {
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== "inactive"
      ) {
        mediaRecorderRef.current.stop();
      }
    } catch {}
    if (recordingRef.current) {
      try {
        recordingRef.current.stopAndUnloadAsync?.();
      } catch {}
      recordingRef.current = null;
    }
  }, []);

  return { begin, finish, cancel };
}
