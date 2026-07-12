/**
 * Standalone lazy loader for the native `expo-speech-recognition` module.
 *
 * The engine must not import app screens (HC-5), so it loads the native module
 * itself rather than reusing `lib/speechRecognition.ts`. Guards against Expo Go,
 * where the native module is absent (a dev build is required — spec §0).
 *
 * HC-3: this module never passes `contextualStrings` / biasing options.
 */

export interface NativeSttListener {
  remove: () => void;
}

/** Minimal surface of `ExpoSpeechRecognitionModule` that the engine uses. */
export interface NativeSttModule {
  isRecognitionAvailable: () => boolean;
  supportsOnDeviceRecognition?: () => boolean;
  getSupportedLocales?: (opts?: Record<string, unknown>) => Promise<{
    locales?: string[];
    installedLocales?: string[];
  }>;
  requestPermissionsAsync: () => Promise<{ granted: boolean }>;
  start: (options: Record<string, unknown>) => void;
  stop: () => void;
  abort: () => void;
  addListener: (
    event: string,
    callback: (...args: unknown[]) => void,
  ) => NativeSttListener;
}

let cached: NativeSttModule | null | undefined;

export function getNativeSttModule(): NativeSttModule | null {
  if (cached !== undefined) return cached;

  try {
    // Expo Go ships no native STT module; bail out cleanly (→ LITE mode, §9).
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Constants = require('expo-constants').default as {
      executionEnvironment?: string;
    };
    if (Constants?.executionEnvironment === 'storeClient') {
      cached = null;
      return null;
    }
  } catch {
    // expo-constants missing (e.g. Jest) — fall through to the require attempt.
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('expo-speech-recognition') as {
      ExpoSpeechRecognitionModule: NativeSttModule;
    };
    cached = mod.ExpoSpeechRecognitionModule ?? null;
  } catch {
    cached = null;
  }
  return cached;
}

/** Test-only: reset the memoized module handle. */
export function __resetNativeSttModuleCache(): void {
  cached = undefined;
}
