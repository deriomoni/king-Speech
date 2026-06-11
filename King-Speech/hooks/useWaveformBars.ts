import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Platform, type AppStateStatus } from "react-native";

export interface WaveBar {
  id: number;
  height: number;
  opacity: number;
}

export const WAVEFORM_MAX_BARS = 60;
export const WAVEFORM_BAR_MIN = 4;
export const WAVEFORM_BAR_MAX = 56;

const SAMPLE_INTERVAL_MS = 150;

export interface UseWaveformBarsOptions {
  isRecording: boolean;
  isPaused: boolean;
  recording?: any | null;
  webStream?: MediaStream | null;
  maxBars?: number;
}

export interface UseWaveformBarsResult {
  bars: WaveBar[];
  elapsedSeconds: number;
  reset: () => void;
}

export function useWaveformBars({
  isRecording,
  isPaused,
  recording,
  webStream,
  maxBars = WAVEFORM_MAX_BARS,
}: UseWaveformBarsOptions): UseWaveformBarsResult {
  const [bars, setBars] = useState<WaveBar[]>([]);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isAppActive, setIsAppActive] = useState(true);

  const amplitudeRef = useRef(0);
  const idCounterRef = useRef(0);
  const sampleTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const freqArrRef = useRef<Uint8Array | null>(null);

  // Web: build an AnalyserNode tap on the live MediaStream so we can
  // sample real-time amplitude for the bars.
  useEffect(() => {
    if (Platform.OS !== "web") return;
    if (!webStream || typeof window === "undefined") return;
    const W = window as any;
    const Ctx = W.AudioContext ?? W.webkitAudioContext;
    if (!Ctx) return;
    let ctx: AudioContext | null = null;
    try {
      ctx = new Ctx() as AudioContext;
      const src = ctx.createMediaStreamSource(webStream);
      const an = ctx.createAnalyser();
      an.fftSize = 256;
      an.smoothingTimeConstant = 0.6;
      src.connect(an);
      audioCtxRef.current = ctx;
      analyserRef.current = an;
      sourceRef.current = src;
      freqArrRef.current = new Uint8Array(an.frequencyBinCount);
    } catch {
      // ignore — analyser unavailable
    }
    return () => {
      try {
        sourceRef.current?.disconnect();
      } catch {}
      try {
        analyserRef.current?.disconnect();
      } catch {}
      try {
        audioCtxRef.current?.close();
      } catch {}
      audioCtxRef.current = null;
      analyserRef.current = null;
      sourceRef.current = null;
      freqArrRef.current = null;
    };
  }, [webStream]);

  // Native: subscribe to expo-av recording status so `metering` (dB) lands
  // in amplitudeRef. Convert via (db + 60) / 60 → 0..1.
  useEffect(() => {
    if (Platform.OS === "web") return;
    if (!recording) return;
    try {
      recording.setProgressUpdateInterval?.(100);
      recording.setOnRecordingStatusUpdate?.((status: any) => {
        if (typeof status?.metering === "number") {
          const norm = Math.max(0, Math.min(1, (status.metering + 60) / 60));
          amplitudeRef.current = norm;
        }
      });
    } catch {}
    return () => {
      try {
        recording.setOnRecordingStatusUpdate?.(null);
      } catch {}
    };
  }, [recording]);

  const sampleAmplitude = useCallback((): number => {
    if (Platform.OS === "web" && analyserRef.current && freqArrRef.current) {
      const an = analyserRef.current;
      const arr = freqArrRef.current;
      an.getByteFrequencyData(arr as unknown as Uint8Array<ArrayBuffer>);
      let sum = 0;
      for (let i = 0; i < arr.length; i++) sum += arr[i];
      const avg = sum / arr.length / 255;
      amplitudeRef.current = Math.max(0, Math.min(1, avg * 1.6));
    }
    return amplitudeRef.current;
  }, []);

  // Freeze waveform/timer when the app is backgrounded or the browser tab
  // is hidden. We pause sampling but never tear down recording resources —
  // restoring focus seamlessly resumes the visual.
  useEffect(() => {
    const sub = AppState.addEventListener(
      "change",
      (next: AppStateStatus) => {
        setIsAppActive(next === "active");
      },
    );
    let onVisibility: (() => void) | null = null;
    if (Platform.OS === "web" && typeof document !== "undefined") {
      onVisibility = () => setIsAppActive(!document.hidden);
      document.addEventListener("visibilitychange", onVisibility);
    }
    return () => {
      sub.remove();
      if (onVisibility && typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibility);
      }
    };
  }, []);

  // Bar-pushing + 1s ticker. Both freeze when paused, stopped, or blurred.
  useEffect(() => {
    if (!isRecording || isPaused || !isAppActive) {
      if (sampleTimerRef.current) clearInterval(sampleTimerRef.current);
      if (tickTimerRef.current) clearInterval(tickTimerRef.current);
      sampleTimerRef.current = null;
      tickTimerRef.current = null;
      return;
    }

    sampleTimerRef.current = setInterval(() => {
      const amp = sampleAmplitude();
      const height =
        WAVEFORM_BAR_MIN + amp * (WAVEFORM_BAR_MAX - WAVEFORM_BAR_MIN);
      setBars((prev) => {
        const id = ++idCounterRef.current;
        const next = [...prev, { id, height, opacity: 1 }];
        const sliced =
          next.length > maxBars ? next.slice(next.length - maxBars) : next;
        const len = sliced.length;
        return sliced.map((b, i) => ({
          ...b,
          opacity: 0.5 + (0.5 * (i + 1)) / len,
        }));
      });
    }, SAMPLE_INTERVAL_MS);

    tickTimerRef.current = setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);

    return () => {
      if (sampleTimerRef.current) clearInterval(sampleTimerRef.current);
      if (tickTimerRef.current) clearInterval(tickTimerRef.current);
      sampleTimerRef.current = null;
      tickTimerRef.current = null;
    };
  }, [isRecording, isPaused, isAppActive, sampleAmplitude, maxBars]);

  const reset = useCallback(() => {
    setBars([]);
    setElapsedSeconds(0);
    amplitudeRef.current = 0;
  }, []);

  // Final cleanup on unmount
  useEffect(() => {
    return () => {
      if (sampleTimerRef.current) clearInterval(sampleTimerRef.current);
      if (tickTimerRef.current) clearInterval(tickTimerRef.current);
    };
  }, []);

  return { bars, elapsedSeconds, reset };
}
