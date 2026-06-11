import Constants from "expo-constants";
import type {
  ExpoSpeechRecognitionErrorEvent,
  ExpoSpeechRecognitionResultEvent,
} from "expo-speech-recognition";

export type { ExpoSpeechRecognitionErrorEvent, ExpoSpeechRecognitionResultEvent };

interface SpeechRecognitionModule {
  isRecognitionAvailable: () => boolean;
  requestPermissionsAsync: () => Promise<{ granted: boolean }>;
  addListener(
    event: "result",
    callback: (event: ExpoSpeechRecognitionResultEvent) => void,
  ): { remove: () => void };
  addListener(
    event: "error",
    callback: (event: ExpoSpeechRecognitionErrorEvent) => void,
  ): { remove: () => void };
  addListener(
    event: string,
    callback: (...args: unknown[]) => void,
  ): { remove: () => void };
  start: (options: Record<string, unknown>) => void;
  stop: () => void;
  abort: () => void;
}

let cached: SpeechRecognitionModule | null | undefined;

/**
 * Lazy-load speech recognition. Not available in Expo Go (native module missing).
 */
export function getSpeechRecognitionModule(): SpeechRecognitionModule | null {
  if (cached !== undefined) return cached;

  if (Constants.executionEnvironment === "storeClient") {
    cached = null;
    return null;
  }

  try {
    const mod = require("expo-speech-recognition") as {
      ExpoSpeechRecognitionModule: SpeechRecognitionModule;
    };
    cached = mod.ExpoSpeechRecognitionModule;
  } catch {
    cached = null;
  }
  return cached;
}

export function isSpeechRecognitionNativeAvailable(): boolean {
  const mod = getSpeechRecognitionModule();
  return mod != null && mod.isRecognitionAvailable();
}
