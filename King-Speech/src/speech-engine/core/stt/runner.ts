/**
 * Shared recognition runner used by both platform adapters.
 *
 * Wires the native module's event listeners into a single promise, accumulating
 * final results and the persisted-WAV URI. Platform differences (confidence
 * extraction, offline flags) live in the adapters; the event plumbing lives
 * here so it isn't duplicated.
 *
 * HC-3: callers never put `contextualStrings`/biasing into `startOptions`.
 */

import { getNativeSttModule } from './module';
import { RecognitionOutput, WordToken } from './types';

/** Minimal mirror of `ExpoSpeechRecognitionResultSegment`. */
export interface RawSegment {
  startTimeMillis: number;
  endTimeMillis: number;
  segment: string;
  confidence: number;
}
/** Minimal mirror of `ExpoSpeechRecognitionResult`. */
export interface RawResult {
  transcript: string;
  confidence: number;
  segments: RawSegment[];
}
/** Minimal mirror of `ExpoSpeechRecognitionResultEvent`. */
export interface RawResultEvent {
  isFinal: boolean;
  results: RawResult[];
}

export interface RunnerHandle {
  stop(): void;
  abort(): void;
  done: Promise<RecognitionOutput>;
}

/** Normalize a native confidence (0..1, or -1 = unavailable) to [0,1] | null. */
export function normConfidence(c: number): number | null {
  return typeof c === 'number' && c >= 0 && c <= 1 ? c : null;
}

/**
 * Start recognition and resolve when the recognizer ends.
 *
 * @param startOptions options passed verbatim to `module.start` (built by the adapter)
 * @param buildWords   platform-specific mapping of a final event → word tokens
 * @param onDevice     whether recognition is running on-device (for `SttResult.onDevice`)
 */
export function runRecognition(
  startOptions: Record<string, unknown>,
  buildWords: (ev: RawResultEvent) => WordToken[],
  onDevice: boolean,
): RunnerHandle {
  const mod = getNativeSttModule();

  // No native module → LITE mode (§9): resolve empty, no capture.
  if (!mod) {
    return {
      stop: () => {},
      abort: () => {},
      done: Promise.resolve({ stt: null, wavUri: null }),
    };
  }

  const words: WordToken[] = [];
  const transcripts: string[] = [];
  let wavUri: string | null = null;
  let settled = false;

  const removers: { remove: () => void }[] = [];
  let resolveFn: (out: RecognitionOutput) => void = () => {};
  const done = new Promise<RecognitionOutput>((resolve) => {
    resolveFn = resolve;
  });

  const cleanup = () => {
    for (const r of removers) {
      try {
        r.remove();
      } catch {
        // ignore
      }
    }
  };

  const finish = (aborted: boolean) => {
    if (settled) return;
    settled = true;
    cleanup();
    if (aborted && words.length === 0) {
      resolveFn({ stt: null, wavUri });
      return;
    }
    resolveFn({
      stt: {
        words,
        transcript: transcripts.join(' ').replace(/\s+/g, ' ').trim(),
        onDevice,
      },
      wavUri,
    });
  };

  try {
    removers.push(
      mod.addListener('result', (ev) => {
        const event = ev as RawResultEvent;
        if (!event || !event.isFinal) return;
        const w = buildWords(event);
        for (const tok of w) words.push(tok);
        const top = event.results && event.results[0];
        if (top && top.transcript) transcripts.push(top.transcript);
      }),
    );
    removers.push(
      mod.addListener('audioend', (ev) => {
        const data = ev as { uri: string | null };
        if (data && data.uri) wavUri = data.uri;
      }),
    );
    removers.push(
      mod.addListener('error', () => {
        // Resolve gracefully with whatever we captured (never throws to caller).
        finish(false);
      }),
    );
    removers.push(mod.addListener('end', () => finish(false)));
  } catch {
    settled = true;
    cleanup();
    return {
      stop: () => {},
      abort: () => {},
      done: Promise.resolve({ stt: null, wavUri: null }),
    };
  }

  try {
    mod.start(startOptions);
  } catch {
    finish(false);
  }

  return {
    stop: () => {
      try {
        mod.stop();
      } catch {
        finish(false);
      }
    },
    abort: () => {
      try {
        mod.abort();
      } catch {
        // ignore
      }
      finish(true);
    },
    done,
  };
}

/** Await a runner as a plain promise (used for file-based recognition). */
export function runToCompletion(handle: RunnerHandle): Promise<RecognitionOutput> {
  return handle.done;
}
