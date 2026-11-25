/**
 * Oscar's voice — the onboarding lines recorded in Higgsfield (text2speech_v2,
 * voice «Andre», 30.05.2026; see the «Оскар — реплики онбординга» script).
 * Russian and English are recorded; Kazakh has none yet, so it stays silent.
 *
 * `useOscarVoice(line, enabled)` plays a line once while the screen (or step)
 * is showing and stops it when it goes away. Obeys the «Звуковые эффекты»
 * switch; every failure degrades to silence.
 */
import { useEffect } from "react";
import { Platform } from "react-native";
import { isSfxMuted } from "@/lib/sfx";
import { useLang } from "@/context/LangContext";

export type OscarLine = "welcome" | "intro" | "greet" | "overview" | "sendoff";

const SOURCES: Partial<Record<"ru" | "en" | "kk", Partial<Record<OscarLine, number>>>> = {
  ru: {
    welcome: require("@/assets/sounds/oscar/ru-welcome.mp3"),
    intro: require("@/assets/sounds/oscar/ru-intro.mp3"),
    greet: require("@/assets/sounds/oscar/ru-greet.mp3"),
    overview: require("@/assets/sounds/oscar/ru-overview.mp3"),
    sendoff: require("@/assets/sounds/oscar/ru-sendoff.mp3"),
  },
  en: {
    welcome: require("@/assets/sounds/oscar/en-welcome.mp3"),
    intro: require("@/assets/sounds/oscar/en-intro.mp3"),
    greet: require("@/assets/sounds/oscar/en-greet.mp3"),
    sendoff: require("@/assets/sounds/oscar/en-sendoff.mp3"),
  },
};

const VOLUME = 1;

type Handle = { stop: () => void };

async function play(src: number): Promise<Handle | null> {
  if (Platform.OS === "web") {
    try {
      const { Asset } = require("expo-asset");
      const el = new (globalThis as any).Audio(Asset.fromModule(src).uri);
      el.volume = VOLUME;
      el.play?.().catch(() => {});
      return { stop: () => { try { el.pause(); el.src = ""; } catch {} } };
    } catch {
      return null;
    }
  }
  try {
    const { Audio } = require("@/lib/av");
    const { sound } = await Audio.Sound.createAsync(src, { volume: VOLUME, shouldPlay: true });
    return { stop: () => { sound.stopAsync().catch(() => {}); sound.unloadAsync().catch(() => {}); } };
  } catch {
    return null;
  }
}

/** Whether a line has a recording in the current language. */
export function hasOscarVoice(lang: string, line: OscarLine) {
  return !!SOURCES[lang as "ru" | "en"]?.[line];
}

/** Say `line` once while `enabled`; it stops when disabled or unmounted. */
export function useOscarVoice(line: OscarLine | null, enabled = true, delayMs = 0) {
  const { lang } = useLang();
  useEffect(() => {
    const src = line ? SOURCES[lang]?.[line] : undefined;
    if (!enabled || !src || isSfxMuted()) return;
    let handle: Handle | null = null;
    let gone = false;
    const id = setTimeout(() => {
      play(src).then((h) => {
        if (gone) h?.stop();
        else handle = h;
      });
    }, delayMs);
    return () => {
      gone = true;
      clearTimeout(id);
      handle?.stop();
    };
  }, [line, enabled, delayMs, lang]);
}
