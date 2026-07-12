/**
 * Android STT adapter — `SpeechRecognizer` via expo-speech-recognition (§4.3).
 *
 * - `EXTRA_PREFER_OFFLINE = true` + on-device when supported (offline-first, §9).
 * - Per-word confidence is often unavailable; recovers via the §4.3 fallback
 *   hierarchy: utterance CONFIDENCE_SCORES → cross-alternative agreement → null.
 * - HC-3: never passes biasing strings.
 */

import { detectCapability } from './capability';
import { getNativeSttModule } from './module';
import {
  normConfidence,
  RawResultEvent,
  runRecognition,
  RunnerHandle,
} from './runner';
import {
  RecognitionOptions,
  RecognitionOutput,
  SttAdapter,
  SttSession,
  WordToken,
} from './types';

function supportsOnDevice(): boolean {
  const mod = getNativeSttModule();
  try {
    return mod?.supportsOnDeviceRecognition ? mod.supportsOnDeviceRecognition() : false;
  } catch {
    return false;
  }
}

/** Lowercase word tokens for cross-alternative agreement (light, local). */
function tokenize(transcript: string): string[] {
  return transcript
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Android word tokens + confidence (§4.3):
 *  1. utterance confidence → assign to every word;
 *  2. else if ≥2 alternatives → agreement k/n per word;
 *  3. else null (→ NO_CONF handling downstream, §9).
 */
function buildWords(event: RawResultEvent): WordToken[] {
  const results = event.results || [];
  const top = results[0];
  if (!top) return [];

  const uttConf = normConfidence(top.confidence); // step 1

  // Alternative word sets for agreement (step 2).
  const altTokenSets =
    results.length >= 2 ? results.slice(1).map((r) => new Set(tokenize(r.transcript))) : [];
  const n = altTokenSets.length + 1; // include the top hypothesis itself

  const confidenceFor = (word: string): number | null => {
    if (uttConf !== null) return uttConf;
    if (altTokenSets.length === 0) return null;
    const w = word.toLowerCase();
    let k = 1; // present in the top hypothesis
    for (const set of altTokenSets) if (set.has(w)) k++;
    return k / n;
  };

  if (top.segments && top.segments.length > 0) {
    return top.segments.map((seg) => ({
      text: seg.segment,
      startMs: seg.startTimeMillis,
      endMs: seg.endTimeMillis,
      // Segment confidence is -1 on Android; fall back to the hierarchy.
      confidence: normConfidence(seg.confidence) ?? confidenceFor(seg.segment),
    }));
  }

  // No segments (pre-Android-14): tokenize the transcript, timings unavailable.
  return tokenize(top.transcript).map((text) => ({
    text,
    startMs: 0,
    endMs: 0,
    confidence: confidenceFor(text),
  }));
}

function buildStartOptions(opts: RecognitionOptions, fromFileUri?: string): Record<string, unknown> {
  const onDevice = supportsOnDevice();
  const options: Record<string, unknown> = {
    lang: opts.locale,
    interimResults: true,
    continuous: true,
    maxAlternatives: 5,
    requiresOnDeviceRecognition: onDevice,
    androidIntentOptions: { EXTRA_PREFER_OFFLINE: true },
    // NOTE: EXTRA_BIASING_STRINGS / contextualStrings intentionally omitted (HC-3).
  };
  if (fromFileUri) {
    // Our persisted WAVs are mono 16 kHz PCM16.
    options.audioSource = {
      uri: fromFileUri,
      audioChannels: 1,
      sampleRate: 16000,
    };
  } else if (opts.persist) {
    // Android default output is a 16 kHz WAV; just persist it.
    options.recordingOptions = { persist: true };
  }
  return options;
}

export function createAndroidAdapter(): SttAdapter {
  return {
    detectCapability: (locale: string) => detectCapability(locale),

    startSession(opts: RecognitionOptions): SttSession {
      const handle: RunnerHandle = runRecognition(
        buildStartOptions(opts),
        buildWords,
        supportsOnDevice(),
      );
      return { stop: handle.stop, abort: handle.abort, done: handle.done };
    },

    async recognizeFromFile(uri: string, opts: RecognitionOptions): Promise<RecognitionOutput> {
      const handle = runRecognition(
        buildStartOptions(opts, uri),
        buildWords,
        supportsOnDevice(),
      );
      const out = await handle.done;
      return { stt: out.stt, wavUri: out.wavUri ?? uri };
    },
  };
}
