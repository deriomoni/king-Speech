/**
 * Soft recorded UI sounds (assets/sounds/ui) for bricks, buttons, tabs,
 * toggles and going back. Preloaded once so a tap plays without delay; they
 * obey the «Звуковые эффекты» switch (same mute flag as lib/sfx) and every
 * failure is silent.
 */
import { Platform } from "react-native";
import { isSfxMuted } from "@/lib/sfx";

export type UiSound =
  | "tapPrimary"
  | "tapSecondary"
  | "tapSoft"
  | "locked"
  | "tabSwitch"
  | "toggleOn"
  | "toggleOff"
  | "back";

const SOURCES: Record<UiSound, number> = {
  tapPrimary: require("@/assets/sounds/ui/tap-primary.m4a"),
  tapSecondary: require("@/assets/sounds/ui/tap-secondary.m4a"),
  tapSoft: require("@/assets/sounds/ui/tap-soft.m4a"),
  locked: require("@/assets/sounds/ui/locked.m4a"),
  tabSwitch: require("@/assets/sounds/ui/tab-switch.m4a"),
  toggleOn: require("@/assets/sounds/ui/toggle-on.m4a"),
  toggleOff: require("@/assets/sounds/ui/toggle-off.m4a"),
  back: require("@/assets/sounds/ui/back.m4a"),
};

const VOLUME = 0.6;

type Player = { play: () => void };
const players: Partial<Record<UiSound, Promise<Player | null>>> = {};

function load(name: UiSound): Promise<Player | null> {
  if (players[name]) return players[name]!;
  const p = (async (): Promise<Player | null> => {
    if (Platform.OS === "web") {
      try {
        const { Asset } = require("expo-asset");
        const uri = Asset.fromModule(SOURCES[name]).uri;
        return {
          play: () => {
            try {
              const el = new (globalThis as any).Audio(uri);
              el.volume = VOLUME;
              el.play?.().catch(() => {});
            } catch {}
          },
        };
      } catch {
        return null;
      }
    }
    try {
      const { Audio } = require("@/lib/av");
      const { sound } = await Audio.Sound.createAsync(SOURCES[name], { volume: VOLUME, shouldPlay: false });
      return { play: () => sound.replayAsync().catch(() => {}) };
    } catch {
      return null;
    }
  })();
  players[name] = p;
  return p;
}

/** Warm every UI sound up (call once at start-up). */
export function preloadUiSounds() {
  (Object.keys(SOURCES) as UiSound[]).forEach((n) => load(n).catch(() => {}));
}

// one tap can reach several handlers (e.g. a row and its button) — keep it to one sound
let lastAt = 0;
export function playUi(name: UiSound) {
  if (isSfxMuted()) return;
  const now = Date.now();
  if (now - lastAt < 60) return;
  lastAt = now;
  load(name)
    .then((p) => p?.play())
    .catch(() => {});
}
