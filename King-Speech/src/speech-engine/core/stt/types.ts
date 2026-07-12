/**
 * STT adapter contract (spec §4).
 *
 * The engine never feeds the reference text to the recognizer — no
 * `contextualStrings` / biasing anywhere (HC-3). The reference is used only
 * for post-hoc alignment (`core/text/align.ts`).
 */

export interface WordToken {
  text: string;
  startMs: number;
  endMs: number;
  /** STT per-word confidence in [0,1], or null when the platform omits it. */
  confidence: number | null;
}

export interface SttResult {
  words: WordToken[];
  transcript: string;
  onDevice: boolean;
}

export interface SttCapability {
  available: boolean;
  onDevice: boolean;
  locale: string;
  /** True when per-word confidence is available (drives FULL vs NO_CONF, §9). */
  wordConfidence: boolean;
}

/**
 * Degradation mode selected from capability (spec §9):
 * - FULL: on-device STT + per-word confidence,
 * - NO_CONF: STT present but no confidence (clarity uses fixed proxies),
 * - LITE: no STT at all (acoustic-only scoring).
 */
export type SttMode = 'FULL' | 'NO_CONF' | 'LITE';

export interface RecognitionOptions {
  /** BCP-47 locale, e.g. 'ru-RU' | 'en-US'. */
  locale: string;
  /**
   * When true, request the recognizer persist the captured audio to a WAV file
   * so the acoustic pipeline (§3) can reuse the SAME single capture.
   */
  persist: boolean;
}

export interface RecognitionOutput {
  stt: SttResult | null;
  /** URI of the persisted WAV (present only when `persist` and capture succeed). */
  wavUri: string | null;
}

/**
 * A live capture+recognition session. The app UI owns start/stop (tap to
 * record, tap to finish), so `startSession` returns a handle rather than a
 * bare promise. `done` resolves once the recognizer finalizes.
 */
export interface SttSession {
  /** Finish capture and let the recognizer emit its final result. */
  stop(): void;
  /** Cancel without producing a result. */
  abort(): void;
  readonly done: Promise<RecognitionOutput>;
}

/**
 * Platform recognizer. iOS/Android provide concrete implementations; the
 * interface is intentionally minimal so a future whisper.cpp / Kazakh adapter
 * (§9 TODO) can drop in without touching callers.
 */
export interface SttAdapter {
  detectCapability(locale: string): Promise<SttCapability>;
  /** Start a live capture; persists a WAV when `opts.persist` (§3 reuse). */
  startSession(opts: RecognitionOptions): SttSession;
  /** Recognize from an already-recorded local audio file (via `audioSource`). */
  recognizeFromFile(uri: string, opts: RecognitionOptions): Promise<RecognitionOutput>;
}

/** Derive the degradation mode from a detected capability (§9). */
export function deriveMode(cap: SttCapability): SttMode {
  if (!cap.available) return 'LITE';
  if (!cap.wordConfidence) return 'NO_CONF';
  return 'FULL';
}
