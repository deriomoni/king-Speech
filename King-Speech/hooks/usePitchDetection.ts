import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { useNativePitchDetector } from "@/hooks/useNativePitchDetector";
import {
  CALIBRATION_STORAGE_KEY,
  DEFAULT_VOICE_RANGE,
  PitchSmoother,
  detectPitchFromBuffer,
  medianHz,
  positionFromHz,
  type VoiceRange,
} from "@/services/warmupPitch";

export type PitchMode = "frequency" | "metering";

export interface PitchState {
  hz: number | null;
  position01: number;
  voiceActive: boolean;
  metering: number;
  isListening: boolean;
  calibrated: boolean;
  range: VoiceRange;
  pitchMode: PitchMode;
}

let Audio: typeof import("expo-av").Audio | null = null;
if (Platform.OS !== "web") {
  Audio = require("expo-av").Audio;
}

export function usePitchDetection() {
  const listeningRef = useRef(false);

  const [state, setState] = useState<PitchState>({
    hz: null,
    position01: 0.5,
    voiceActive: false,
    metering: -160,
    isListening: false,
    calibrated: false,
    range: DEFAULT_VOICE_RANGE,
    pitchMode: Platform.OS === "web" ? "frequency" : "metering",
  });

  const rangeRef = useRef<VoiceRange>(DEFAULT_VOICE_RANGE);
  const smootherRef = useRef(new PitchSmoother(4));
  const rafRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const recordingRef = useRef<any>(null);
  const meterIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const calLowRef = useRef<number[]>([]);
  const calHighRef = useRef<number[]>([]);

  const applyReading = useCallback(
    (hz: number | null, metering = -160, mode: PitchMode = "frequency") => {
      const smoothed = mode === "frequency" ? smootherRef.current.push(hz) : hz;
      const voiceActive =
        mode === "frequency"
          ? smoothed != null
          : metering > -45;
      const position01 =
        smoothed != null
          ? positionFromHz(smoothed, rangeRef.current)
          : state.position01;

      setState((s) => ({
        ...s,
        hz: smoothed,
        position01,
        voiceActive,
        metering,
        pitchMode: mode,
      }));
    },
    [state.position01],
  );

  const onNativeFrequency = useCallback(
    (hz: number) => {
      if (!listeningRef.current) return;
      applyReading(hz, -20, "frequency");
    },
    [applyReading],
  );

  useNativePitchDetector(
    state.isListening && Platform.OS !== "web",
    onNativeFrequency,
  );

  const stopListening = useCallback(async () => {
    listeningRef.current = false;
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (meterIntervalRef.current) {
      clearInterval(meterIntervalRef.current);
      meterIntervalRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    analyserRef.current = null;
    if (audioCtxRef.current) {
      await audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    if (recordingRef.current) {
      try {
        await recordingRef.current.stopAndUnloadAsync?.();
      } catch {}
      recordingRef.current = null;
    }
    setState((s) => ({ ...s, isListening: false }));
  }, []);

  const startListening = useCallback(async () => {
    await stopListening();
    smootherRef.current.reset();
    listeningRef.current = true;
    setState((s) => ({ ...s, isListening: true }));

    if (Platform.OS === "web" && typeof window !== "undefined") {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      analyserRef.current = analyser;
      const buf = new Float32Array(analyser.fftSize);

      const tick = () => {
        if (!analyserRef.current || !audioCtxRef.current) return;
        analyserRef.current.getFloatTimeDomainData(buf);
        const raw = detectPitchFromBuffer(buf, audioCtxRef.current.sampleRate);
        applyReading(raw, raw != null ? -20 : -60, "frequency");
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
      return;
    }

    if (!Audio) return;
    await Audio.requestPermissionsAsync();
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });
    const opts = {
      ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
      isMeteringEnabled: true,
    };
    const { recording } = await Audio.Recording.createAsync(opts);
    recordingRef.current = recording;
    await recording.startAsync();

    meterIntervalRef.current = setInterval(async () => {
      try {
        const st = await recording.getStatusAsync();
        const metering = st.metering ?? -160;
        const active = metering > -45;
        const pseudoHz = active
          ? rangeRef.current.fLow +
            (rangeRef.current.fHigh - rangeRef.current.fLow) * 0.55
          : null;
        applyReading(pseudoHz, metering, "metering");
      } catch {}
    }, 50);
  }, [applyReading, stopListening]);

  const beginCalibrationStep = useCallback((step: "low" | "high") => {
    if (step === "low") calLowRef.current = [];
    else calHighRef.current = [];
  }, []);

  const feedCalibration = useCallback(
    (hz: number | null, step: "low" | "high") => {
      if (hz == null || hz < 80 || hz > 700) return;
      if (step === "low") calLowRef.current.push(hz);
      else calHighRef.current.push(hz);
    },
    [],
  );

  const saveCalibrationRange = useCallback(async (range: VoiceRange) => {
    rangeRef.current = range;
    setState((s) => ({
      ...s,
      range,
      calibrated: true,
    }));
    try {
      const { default: AsyncStorage } = await import(
        "@react-native-async-storage/async-storage"
      );
      await AsyncStorage.setItem(CALIBRATION_STORAGE_KEY, JSON.stringify(range));
    } catch {}
  }, []);

  const finishCalibrationStep = useCallback(
    async (step: "low" | "high"): Promise<number | null> => {
      const samples = step === "low" ? calLowRef.current : calHighRef.current;
      return medianHz(samples);
    },
    [],
  );

  const completeCalibration = useCallback(async () => {
    const fLow = medianHz(calLowRef.current) ?? DEFAULT_VOICE_RANGE.fLow;
    let fHigh = medianHz(calHighRef.current) ?? DEFAULT_VOICE_RANGE.fHigh;
    if (fHigh <= fLow * 1.08) fHigh = fLow * 1.6;
    await saveCalibrationRange({ fLow, fHigh });
    return { fLow, fHigh };
  }, [saveCalibrationRange]);

  useEffect(() => {
    (async () => {
      try {
        const { default: AsyncStorage } = await import(
          "@react-native-async-storage/async-storage"
        );
        const raw = await AsyncStorage.getItem(CALIBRATION_STORAGE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw) as VoiceRange;
        if (parsed.fLow > 0 && parsed.fHigh > parsed.fLow) {
          rangeRef.current = parsed;
          setState((s) => ({ ...s, range: parsed, calibrated: true }));
        }
      } catch {}
    })();
    return () => {
      stopListening();
    };
  }, [stopListening]);

  return {
    ...state,
    startListening,
    stopListening,
    beginCalibrationStep,
    feedCalibration,
    finishCalibrationStep,
    completeCalibration,
    saveCalibrationRange,
  };
}
