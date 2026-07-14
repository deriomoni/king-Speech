import { useCallback, useEffect, useRef, useState } from "react";
import {
  computeAlignmentIndex,
  splitReadingWords,
} from "@/src/speech-engine/core/text/reading";
import {
  getSpeechRecognitionModule,
  isSpeechRecognitionNativeAvailable,
} from "@/lib/speechRecognition";

// ─────────────────────────────────────────────────────────────────────────────
// useReadingAlignment — turns a speech source into a monotonic "current word"
// index for the karaoke canvas. The ReadingText component stays dumb and
// controlled: <ReadingText currentIndex={...} />; this hook owns the progress.
//
// The real source is the on-device recognizer (expo-speech-recognition, the
// same one vocabulary-level uses) fed through the engine's word aligner
// (core/text/align.ts). No reference biasing is sent to the recognizer — the
// text is used only for post-hoc alignment.
//
// The recognizer is unavailable in Expo Go / on the simulator. There we DO NOT
// fabricate progress in production — the index simply stays put. A time-based
// MockDriver exists strictly behind __DEV__ so the transition + karaoke can be
// built and demoed without a device.
// ─────────────────────────────────────────────────────────────────────────────

export type AlignmentDriver = "auto" | "stt" | "mock" | "off";

interface Options {
  /** The exact reference text the player is reading. */
  expectedText: string;
  /** True only while the player is actively reading (recording). */
  active: boolean;
  /** BCP-47 locale for the recognizer. */
  locale?: string;
  /**
   * Which source drives the index. "auto" = STT when the native recognizer is
   * available, otherwise the dev mock (only in __DEV__) or nothing in prod.
   */
  driver?: AlignmentDriver;
  /** Bumped to reset progress back to the start (matches ReadingLevelView). */
  resetSignal?: number;
}

interface Result {
  /** Index of the word currently being read (-1 before the first word). */
  currentIndex: number;
  /** True when a real recognizer is driving the index (vs mock / none). */
  live: boolean;
}

export function useReadingAlignment({
  expectedText,
  active,
  locale = "ru-RU",
  driver = "auto",
  resetSignal = 0,
}: Options): Result {
  const [currentIndex, setCurrentIndex] = useState(-1);
  const indexRef = useRef(-1);
  const refWordsRef = useRef<string[]>([]);

  useEffect(() => {
    refWordsRef.current = splitReadingWords(expectedText);
  }, [expectedText]);

  const setIndex = useCallback((n: number) => {
    if (n === indexRef.current) return;
    indexRef.current = n;
    setCurrentIndex(n);
  }, []);

  // Reset progress on resetSignal change (and when a new read begins).
  useEffect(() => {
    indexRef.current = -1;
    setCurrentIndex(-1);
  }, [resetSignal]);

  const sttAvailable =
    driver === "stt" || driver === "auto"
      ? (() => {
          try {
            return isSpeechRecognitionNativeAvailable();
          } catch {
            return false;
          }
        })()
      : false;

  const resolvedDriver: AlignmentDriver =
    driver === "auto"
      ? sttAvailable
        ? "stt"
        : __DEV__
          ? "mock"
          : "off"
      : driver;

  // ── STT driver ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!active || resolvedDriver !== "stt") return;
    const sr = getSpeechRecognitionModule();
    if (!sr) return;

    let cancelled = false;
    const subs: Array<{ remove: () => void }> = [];

    const onResult = (event: any) => {
      if (cancelled) return;
      // Take the best (first) hypothesis; interim results stream continuously.
      const hyp = event?.results?.[0]?.transcript ?? "";
      if (!hyp) return;
      const hypWords = splitReadingWords(hyp);
      const next = computeAlignmentIndex(
        refWordsRef.current,
        hypWords,
        indexRef.current,
      );
      setIndex(next);
    };

    try {
      subs.push(sr.addListener("result", onResult));
      sr.start({
        lang: locale,
        interimResults: true,
        continuous: true,
      });
    } catch {
      // Recognizer refused (busy / permission) — leave the index put.
    }

    return () => {
      cancelled = true;
      subs.forEach((s) => s.remove());
      try {
        sr.stop();
      } catch {}
    };
  }, [active, resolvedDriver, locale, setIndex]);

  // ── Mock driver (DEV only) ──────────────────────────────────────────────────
  // Advances one word at a time on a human-ish cadence so the karaoke +
  // Mirror transition can be exercised on the simulator / in Expo Go.
  useEffect(() => {
    if (!active || resolvedDriver !== "mock") return;
    const total = refWordsRef.current.length;
    if (total === 0) return;
    let raf: ReturnType<typeof setTimeout>;
    const step = () => {
      const cur = indexRef.current;
      if (cur >= total - 1) return;
      setIndex(cur + 1);
      // ~2.6 words/sec with a little jitter for a natural feel.
      raf = setTimeout(step, 300 + Math.round((((cur * 37) % 11) - 5) * 12));
    };
    raf = setTimeout(step, 500);
    return () => clearTimeout(raf);
  }, [active, resolvedDriver, setIndex]);

  return { currentIndex, live: resolvedDriver === "stt" };
}
