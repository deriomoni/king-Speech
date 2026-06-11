import { useEffect, useRef } from "react";
import { Platform } from "react-native";

/**
 * Optional native pitch detector for dev/TestFlight builds.
 * In Expo Go the module is absent — returns null and callers use Web Audio / metering.
 */
export function useNativePitchDetector(
  enabled: boolean,
  onFrequency: (hz: number) => void,
) {
  const stopRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!enabled || Platform.OS === "web") return;

    let cancelled = false;
    (async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const mod = require("react-native-pitch-detector");
        const start = mod?.start ?? mod?.default?.start;
        const stop = mod?.stop ?? mod?.default?.stop;
        if (typeof start !== "function") return;

        await start((evt: { frequency?: number }) => {
          if (cancelled) return;
          const f = evt?.frequency;
          if (typeof f === "number" && f > 0) onFrequency(f);
        });
        stopRef.current = () => {
          try {
            stop?.();
          } catch {}
        };
      } catch {
        // Module not linked (Expo Go) — ignore.
      }
    })();

    return () => {
      cancelled = true;
      stopRef.current?.();
      stopRef.current = null;
    };
  }, [enabled, onFrequency]);
}
