import { useCallback, useMemo, useRef } from "react";
import { Platform } from "react-native";
import { getApiUrl } from "@/lib/query-client";

// expo-av only on native
let Audio: any = null;
if (Platform.OS !== "web") {
  Audio = require("expo-av").Audio;
}

/**
 * Jenny's voice on the client. Calls the server `/api/tts` endpoint, plays the
 * returned audio, and reports start/end so the screen can hold the avatar's
 * "speaking" state for exactly as long as she's actually talking.
 *
 * Resilient by design: if the backend isn't reachable (no deploy yet / offline)
 * `speak()` simply resolves without calling `onStart`, so callers fall back to
 * their estimated-duration timer and the avatar still animates. Real voice
 * kicks in automatically once the backend is live — no client change needed.
 */
export function useJennyVoice() {
  const soundRef = useRef<any>(null);
  const webAudioRef = useRef<any>(null);

  const stop = useCallback(() => {
    try {
      soundRef.current?.unloadAsync?.();
    } catch {}
    soundRef.current = null;
    if (webAudioRef.current) {
      try {
        webAudioRef.current.pause();
      } catch {}
      webAudioRef.current = null;
    }
  }, []);

  const speak = useCallback(
    async (
      text: string,
      cb?: { onStart?: () => void; onEnd?: () => void },
    ): Promise<void> => {
      let done = false;
      const end = () => {
        if (!done) {
          done = true;
          cb?.onEnd?.();
        }
      };
      const clean = (text ?? "").trim();
      if (!clean) return end();
      try {
        stop();
        const url = new URL("/api/tts", getApiUrl()).toString();
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: clean }),
        });
        if (!res.ok) return end();
        const data = await res.json();
        const b64: string | undefined = data?.audioBase64;
        if (!b64) return end();

        if (Platform.OS === "web") {
          const audio = new (window as any).Audio(
            `data:audio/mp3;base64,${b64}`,
          );
          webAudioRef.current = audio;
          audio.onended = end;
          audio.onerror = end;
          audio.onplay = () => cb?.onStart?.();
          await audio.play().catch(() => end());
        } else {
          const FileSystem = require("expo-file-system/legacy");
          const path = `${FileSystem.cacheDirectory}jenny-${Date.now()}.mp3`;
          await FileSystem.writeAsStringAsync(path, b64, { encoding: "base64" });
          await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
          const { sound } = await Audio.Sound.createAsync(
            { uri: path },
            { shouldPlay: true },
          );
          soundRef.current = sound;
          cb?.onStart?.();
          sound.setOnPlaybackStatusUpdate((s: any) => {
            if (s?.didJustFinish) end();
          });
        }
      } catch {
        end();
      }
    },
    [stop],
  );

  // Stable identity so callers can safely list it in effect/callback deps
  // without re-running on every render (speak/stop are themselves stable).
  return useMemo(() => ({ speak, stop }), [speak, stop]);
}
