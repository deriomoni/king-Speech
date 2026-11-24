/**
 * Short music stings for key screens (welcome, victory, rank-up, premium).
 *
 * Unlike lib/sfx (synthesised UI blips) these are real recorded pads shipped
 * as assets. Each plays once when its screen opens and fades out when the
 * screen goes away. They obey the same «Звуковые эффекты» switch as sfx, and
 * every failure degrades to silence.
 */
import { useEffect } from "react";
import { Platform } from "react-native";
import { isSfxMuted } from "@/lib/sfx";

export type MusicName = "welcome" | "victory" | "rankUp" | "premium";

const SOURCES: Record<MusicName, number> = {
  welcome: require("@/assets/sounds/music/welcome.m4a"),
  victory: require("@/assets/sounds/music/victory.m4a"),
  rankUp: require("@/assets/sounds/music/rank-up.m4a"),
  premium: require("@/assets/sounds/music/premium.m4a"),
};

const VOLUME = 0.7;
const FADE_MS = 450;

type Handle = { setVolume: (v: number) => void; stop: () => void };

async function start(name: MusicName): Promise<Handle | null> {
  if (Platform.OS === "web") {
    try {
      const { Asset } = require("expo-asset");
      const uri = Asset.fromModule(SOURCES[name]).uri;
      const el = new (globalThis as any).Audio(uri);
      el.volume = VOLUME;
      // browsers may refuse autoplay before the first tap — that is fine
      el.play?.().catch(() => {});
      return {
        setVolume: (v) => { try { el.volume = v; } catch {} },
        stop: () => { try { el.pause(); el.src = ""; } catch {} },
      };
    } catch {
      return null;
    }
  }
  try {
    const { Audio } = require("@/lib/av");
    const { sound } = await Audio.Sound.createAsync(SOURCES[name], { volume: VOLUME, shouldPlay: true });
    return {
      setVolume: (v) => { sound.setVolumeAsync(v).catch(() => {}); },
      stop: () => { sound.unloadAsync().catch(() => {}); },
    };
  } catch {
    return null;
  }
}

function fadeOut(h: Handle) {
  const steps = 6;
  let i = 0;
  const id = setInterval(() => {
    i++;
    h.setVolume(VOLUME * Math.max(0, 1 - i / steps));
    if (i >= steps) {
      clearInterval(id);
      h.stop();
    }
  }, FADE_MS / steps);
}

/** Play `name` once while `enabled` is true; fade it out on unmount. */
export function useScreenMusic(name: MusicName, enabled = true) {
  useEffect(() => {
    if (!enabled || isSfxMuted()) return;
    let handle: Handle | null = null;
    let gone = false;
    start(name).then((h) => {
      if (gone) h?.stop();
      else handle = h;
    });
    return () => {
      gone = true;
      if (handle) fadeOut(handle);
    };
  }, [name, enabled]);
}
