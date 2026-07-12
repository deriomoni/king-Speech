/**
 * iOS STT adapter — `SFSpeechRecognizer` via expo-speech-recognition (§4.2).
 *
 * - Prefers on-device recognition when supported (offline-first, §9).
 * - Reads per-segment confidence + timings from the final result.
 * - HC-3: never passes `contextualStrings`.
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

/** iOS: word tokens from the top hypothesis' segments, with per-segment confidence. */
function buildWords(event: RawResultEvent): WordToken[] {
  const top = event.results && event.results[0];
  if (!top || !top.segments) return [];
  const uttConf = normConfidence(top.confidence);
  return top.segments.map((seg) => ({
    text: seg.segment,
    startMs: seg.startTimeMillis,
    endMs: seg.endTimeMillis,
    confidence: normConfidence(seg.confidence) ?? uttConf,
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
    // NOTE: contextualStrings intentionally omitted (HC-3).
  };
  if (fromFileUri) {
    options.audioSource = { uri: fromFileUri };
  } else if (opts.persist) {
    // Force 16 kHz PCM16 so the acoustic pipeline needs no resampling (§3.1).
    options.recordingOptions = {
      persist: true,
      outputSampleRate: 16000,
      outputEncoding: 'pcmFormatInt16',
    };
  }
  return options;
}

export function createIosAdapter(): SttAdapter {
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
      // The source file itself is the WAV for the acoustic pipeline.
      return { stt: out.stt, wavUri: out.wavUri ?? uri };
    },
  };
}
