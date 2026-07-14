import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import {
  computeAlignmentIndex,
  splitReadingWords,
} from "@/src/speech-engine/core/text/reading";
import {
  getSpeechRecognitionModule,
  isSpeechRecognitionNativeAvailable,
} from "@/lib/speechRecognition";

// ─────────────────────────────────────────────────────────────────────────────
// useReadingCapture — the reading level's single audio source.
//
// On a native build with the on-device recognizer available, ONE
// expo-speech-recognition session does double duty: its interim results drive
// the karaoke word index live, and `recordingOptions.persist` writes a WAV that
// the existing server scorer + self-review playback consume. No second mic
// capture, so no expo-av ↔ recognizer conflict.
//
// Where the recognizer is absent (web, Expo Go) there is no second source to
// clash with, so we keep the original expo-av / MediaRecorder capture and, in
// __DEV__ only, a time-based mock advances the karaoke so the screen can be
// demoed. No fabricated progress ships to production.
//
// The downstream contract is unchanged: finish() resolves
// { durationSec, audioBase64?, audioUri? } exactly as before.
// ─────────────────────────────────────────────────────────────────────────────

let Audio: any = null;
if (Platform.OS !== "web") {
  Audio = require("expo-av").Audio;
}

export interface ReadingCaptureResult {
  durationSec: number;
  audioBase64?: string;
  audioUri?: string;
}

type Mode = "stt" | "av" | "web";

interface Options {
  expectedText: string;
  locale?: string;
}

interface Api {
  /** Word currently being read (-1 before the first word). */
  currentIndex: number;
  /** True when a real recognizer is driving the index (vs mock / none). */
  live: boolean;
  /** Begin capture (called after the countdown). */
  begin: () => Promise<void>;
  /** Stop capture and resolve the recorded audio. */
  finish: () => Promise<ReadingCaptureResult>;
  /** Abort + release everything without producing a result. */
  cancel: () => void;
  /** Reset the karaoke index back to the start. */
  reset: () => void;
}

export function useReadingCapture({ expectedText, locale = "ru-RU" }: Options): Api {
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [live, setLive] = useState(false);
  const indexRef = useRef(-1);
  const refWordsRef = useRef<string[]>([]);
  const modeRef = useRef<Mode>("av");
  const startTsRef = useRef(0);

  // STT branch handles.
  const srSubsRef = useRef<Array<{ remove: () => void }>>([]);
  const wavUriRef = useRef<string | null>(null);
  const sttEndRef = useRef<Promise<void> | null>(null);
  const sttEndResolveRef = useRef<(() => void) | null>(null);

  // expo-av (native fallback) + MediaRecorder (web) handles.
  const recordingRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioBlobRef = useRef<Blob | null>(null);
  const stopPromiseRef = useRef<Promise<void> | null>(null);
  const stopResolveRef = useRef<(() => void) | null>(null);

  // DEV mock timer.
  const mockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    refWordsRef.current = splitReadingWords(expectedText);
  }, [expectedText]);

  const setIndex = useCallback((n: number) => {
    if (n === indexRef.current) return;
    indexRef.current = n;
    setCurrentIndex(n);
  }, []);

  const reset = useCallback(() => {
    indexRef.current = -1;
    setCurrentIndex(-1);
  }, []);

  const clearMock = () => {
    if (mockTimerRef.current) {
      clearTimeout(mockTimerRef.current);
      mockTimerRef.current = null;
    }
  };

  const startMock = () => {
    const total = refWordsRef.current.length;
    if (total === 0) return;
    const step = () => {
      const cur = indexRef.current;
      if (cur >= total - 1) return;
      setIndex(cur + 1);
      mockTimerRef.current = setTimeout(
        step,
        300 + Math.round((((cur * 37) % 11) - 5) * 12),
      );
    };
    mockTimerRef.current = setTimeout(step, 500);
  };

  const teardownStt = () => {
    for (const s of srSubsRef.current) {
      try {
        s.remove();
      } catch {}
    }
    srSubsRef.current = [];
  };

  const begin = useCallback(async () => {
    startTsRef.current = Date.now();
    reset();
    wavUriRef.current = null;

    const sttAvailable =
      Platform.OS !== "web" &&
      (() => {
        try {
          return isSpeechRecognitionNativeAvailable();
        } catch {
          return false;
        }
      })();

    if (sttAvailable) {
      modeRef.current = "stt";
      setLive(true);
      const sr = getSpeechRecognitionModule();
      if (!sr) {
        // Shouldn't happen (availability just checked) — degrade to av.
        modeRef.current = "av";
        setLive(false);
      } else {
        sttEndRef.current = new Promise<void>((resolve) => {
          sttEndResolveRef.current = resolve;
        });
        const onResult = (event: any) => {
          const hyp = event?.results?.[0]?.transcript ?? "";
          if (!hyp) return;
          const next = computeAlignmentIndex(
            refWordsRef.current,
            splitReadingWords(hyp),
            indexRef.current,
          );
          setIndex(next);
        };
        const onAudioEnd = (ev: any) => {
          if (ev && ev.uri) wavUriRef.current = ev.uri as string;
        };
        const onEnd = () => {
          sttEndResolveRef.current?.();
          sttEndResolveRef.current = null;
        };
        try {
          await sr.requestPermissionsAsync?.();
          srSubsRef.current.push(sr.addListener("result", onResult));
          srSubsRef.current.push(sr.addListener("audioend", onAudioEnd));
          srSubsRef.current.push(sr.addListener("end", onEnd));
          srSubsRef.current.push(sr.addListener("error", onEnd));
          sr.start({
            lang: locale,
            interimResults: true,
            continuous: true,
            requiresOnDeviceRecognition: true,
            recordingOptions: {
              persist: true,
              outputSampleRate: 16000,
              outputEncoding: "pcmFormatInt16",
            },
          });
          return;
        } catch {
          // Recognizer refused — fall through to expo-av below.
          teardownStt();
          modeRef.current = "av";
          setLive(false);
        }
      }
    }

    if (Platform.OS === "web") {
      modeRef.current = "web";
      setLive(false);
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
        // Mic blocked — keep the visual flow.
      }
      if (__DEV__) startMock();
      return;
    }

    // Native without the recognizer (Expo Go): expo-av capture + DEV mock.
    modeRef.current = "av";
    setLive(false);
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
    } catch {}
    if (__DEV__) startMock();
  }, [locale, reset, setIndex]);

  const finish = useCallback(async (): Promise<ReadingCaptureResult> => {
    clearMock();
    const durationSec = Math.max(
      1,
      Math.round((Date.now() - startTsRef.current) / 1000),
    );

    if (modeRef.current === "stt") {
      const sr = getSpeechRecognitionModule();
      try {
        sr?.stop();
      } catch {}
      // Wait for the recognizer to finalize + flush the persisted WAV.
      try {
        await Promise.race([
          sttEndRef.current ?? Promise.resolve(),
          new Promise<void>((resolve) => setTimeout(resolve, 2000)),
        ]);
      } catch {}
      teardownStt();
      const uri = wavUriRef.current ?? undefined;
      let audioBase64: string | undefined;
      if (uri) {
        try {
          const FileSystem = require("expo-file-system/legacy");
          audioBase64 = await FileSystem.readAsStringAsync(uri, {
            encoding: "base64",
          });
        } catch (e) {
          console.warn("useReadingCapture: could not read WAV", e);
        }
      }
      return { durationSec, audioBase64, audioUri: uri };
    }

    if (modeRef.current === "web") {
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
      let playableUri: string | undefined;
      const blob = audioBlobRef.current;
      if (blob) {
        try {
          playableUri = URL.createObjectURL(blob);
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
      return { durationSec, audioBase64, audioUri: playableUri };
    }

    // expo-av (native fallback)
    let audioBase64: string | undefined;
    let playableUri: string | undefined;
    try {
      if (recordingRef.current) {
        await recordingRef.current.stopAndUnloadAsync();
        const uri = recordingRef.current.getURI?.() ?? null;
        recordingRef.current = null;
        if (uri) {
          playableUri = uri;
          const FileSystem = require("expo-file-system/legacy");
          audioBase64 = await FileSystem.readAsStringAsync(uri, {
            encoding: "base64",
          });
        }
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
    } catch (e) {
      console.warn("useReadingCapture: expo-av stop failed", e);
    }
    return { durationSec, audioBase64, audioUri: playableUri };
  }, []);

  const cancel = useCallback(() => {
    clearMock();
    // STT
    try {
      getSpeechRecognitionModule()?.abort();
    } catch {}
    teardownStt();
    // web
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
    // expo-av
    if (recordingRef.current) {
      try {
        recordingRef.current.stopAndUnloadAsync?.();
      } catch {}
      recordingRef.current = null;
    }
  }, []);

  // Release on unmount.
  useEffect(() => cancel, [cancel]);

  return { currentIndex, live, begin, finish, cancel, reset };
}
