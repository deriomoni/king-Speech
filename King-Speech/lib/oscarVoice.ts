/**
 * Oscar's voice — the onboarding lines recorded in Higgsfield (text2speech_v2,
 * voice «Andre», 30.05.2026; see the «Оскар — реплики онбординга» script).
 * Russian and English are fully recorded; Kazakh has everything but the
 * send-off (25.11.2026), which stays text only.
 *
 * `useOscarVoice(line, enabled)` plays a line once while enabled and returns
 * where it is (ms since it started; -1 before; DONE once it has finished), so
 * screens can show each phrase exactly while it is being said and move on only
 * after the last word. Muted / failed / no recording → the same clock runs
 * without sound, so the texts still pace themselves.
 *
 * The cue times come from the pauses in the recordings (ffmpeg silencedetect).
 */
import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { isSfxMuted } from "@/lib/sfx";
import { useLang } from "@/context/LangContext";

export type OscarLine = "welcome" | "intro" | "greet" | "overview" | "sendoff";
type Lang = "ru" | "en" | "kk";

export const DONE = 1e9;

const SOURCES: Partial<Record<Lang, Partial<Record<OscarLine, number>>>> = {
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
    overview: require("@/assets/sounds/oscar/en-overview.mp3"),
    sendoff: require("@/assets/sounds/oscar/en-sendoff.mp3"),
  },
  kk: {
    welcome: require("@/assets/sounds/oscar/kk-welcome.mp3"),
    intro: require("@/assets/sounds/oscar/kk-intro.mp3"),
    greet: require("@/assets/sounds/oscar/kk-greet.mp3"),
    overview: require("@/assets/sounds/oscar/kk-overview.mp3"),
  },
};

/** Length of each recording (ms); for silent text, a reading-pace estimate. */
export const LINE_MS: Record<Lang, Record<OscarLine, number>> = {
  ru: { welcome: 17360, intro: 5680, greet: 3040, overview: 20240, sendoff: 6640 },
  en: { welcome: 18320, intro: 6160, greet: 3200, overview: 19760, sendoff: 7840 },
  kk: { welcome: 11600, intro: 6080, greet: 3040, overview: 18880, sendoff: 7000 },
};

/** Phrase cues: `at` = ms into the line where the phrase begins. */
export type Cue = { at: number; text: string };

export const WELCOME_CUES: Partial<Record<Lang, Cue[]>> = {
  ru: [
    { at: 3200, text: "Здесь начинается твой путь к сильной, уверенной речи — увлекательный и интересный." },
    { at: 9000, text: "Если ты горишь желанием стать оратором и улучшить свою речь, я тебе помогу." },
    { at: 13800, text: "Нажимай эту кнопку — и пошли делать великие дела!" },
  ],
  en: [
    { at: 2650, text: "This is where your journey to strong, confident speech begins — and it's going to be an exciting one." },
    { at: 9450, text: "If you're eager to become a great speaker and sharpen your skills, I'm here to help." },
    { at: 14750, text: "Just press this button, and let's go do great things together!" },
  ],
  kk: [
    { at: 2250, text: "Осы жерде сенің сенімді сөйлеуге апаратын жолың басталады." },
    { at: 6000, text: "Жақсы шешен болғың келсе, мен саған көмектесемін." },
    { at: 9200, text: "Мына батырманы бас та, бірге бастайық!" },
  ],
};

/** The overview, phrase by phrase; `focus` = what the spotlight shows meanwhile. */
export type OverviewFocus = "bar" | 0 | 2 | "profileSettings";
export const OVERVIEW_CUES: Partial<Record<Lang, (Cue & { focus: OverviewFocus })[]>> = {
  ru: [
    { at: 0, text: "Итак, начнём по порядку.", focus: "bar" },
    { at: 2050, text: "Твой Путь — это место, где ты будешь каждый день проходить задания.", focus: 0 },
    { at: 5950, text: "Здесь много всего разного: от скороговорок до настоящих выступлений.", focus: 0 },
    { at: 10330, text: "Дальше у нас Show Time — твой личный зал, где ты можешь свободно выступать перед публикой на любимые темы.", focus: 2 },
    { at: 17580, text: "А ещё дальше — твой профиль и настройки.", focus: "profileSettings" },
  ],
  en: [
    { at: 0, text: "So, let's start from the beginning.", focus: "bar" },
    { at: 2450, text: "Your Path is where you'll complete tasks every day — from tongue twisters to real speeches.", focus: 0 },
    { at: 8850, text: "Next up is Show Time, your own stage, where you can speak freely in front of an audience on topics you love.", focus: 2 },
    { at: 16650, text: "And further on — your profile and settings.", focus: "profileSettings" },
  ],
  kk: [
    { at: 0, text: "Ендеше, ретімен бастайық.", focus: "bar" },
    { at: 2200, text: "«Жол» бөлімінде сен күн сайын тапсырма орындайсың: жаңылтпаштан бастап нағыз сөз сөйлеуге дейін.", focus: 0 },
    { at: 8620, text: "Келесі — «Show Time». Бұл сенің жеке сахнаң: мұнда ұнайтын тақырыбың бойынша көрермен алдында сөйлей аласың.", focus: 2 },
    { at: 16520, text: "Одан кейін — профиль мен баптаулар.", focus: "profileSettings" },
  ],
};

/** Index of the cue being said at `pos` (-1 before the first). */
export function cueAt(cues: { at: number }[] | undefined, pos: number) {
  if (!cues) return -1;
  let k = -1;
  for (let i = 0; i < cues.length; i++) if (pos >= cues[i].at) k = i;
  return k;
}

const VOLUME = 1;

type Handle = { stop: () => void };

// Oscar has one voice: starting a line silences whatever he was saying before
let speaking: Handle | null = null;
function take(h: Handle): Handle {
  speaking?.stop();
  const own: Handle = {
    stop: () => {
      h.stop();
      if (speaking === own) speaking = null;
    },
  };
  speaking = own;
  return own;
}

async function play(src: number, onPos: (ms: number) => void): Promise<Handle | null> {
  if (Platform.OS === "web") {
    try {
      const { Asset } = require("expo-asset");
      const el = new (globalThis as any).Audio(Asset.fromModule(src).uri);
      el.volume = VOLUME;
      el.ontimeupdate = () => onPos(el.currentTime * 1000);
      el.onended = () => onPos(DONE);
      const started = await el.play?.().then(() => true).catch(() => false);
      if (started === false) return null; // autoplay refused → the clock takes over
      return {
        stop: () => {
          try {
            el.ontimeupdate = null;
            el.onended = null;
            el.pause();
            el.src = "";
          } catch {}
        },
      };
    } catch {
      return null;
    }
  }
  try {
    const { Audio } = require("@/lib/av");
    const { sound } = await Audio.Sound.createAsync(src, { volume: VOLUME, shouldPlay: true, progressUpdateIntervalMillis: 120 });
    sound.setOnPlaybackStatusUpdate((st: any) => {
      if (!st?.isLoaded) return;
      if (st.didJustFinish) onPos(DONE);
      else onPos(st.positionMillis ?? 0);
    });
    return {
      stop: () => {
        sound.setOnPlaybackStatusUpdate(null);
        sound.stopAsync().catch(() => {});
        sound.unloadAsync().catch(() => {});
      },
    };
  } catch {
    return null;
  }
}

/**
 * Say `line` once while `enabled`; returns its position (ms, -1 before it
 * starts, DONE after the last word). It stops when disabled or unmounted.
 */
export function useOscarVoice(line: OscarLine | null, enabled = true, delayMs = 0): number {
  // wait for the saved language, so a line never starts in the wrong one
  const { lang, isLoaded } = useLang();
  const [pos, setPos] = useState(-1);
  useEffect(() => {
    setPos(-1);
    if (!enabled || !line || !isLoaded) return;
    const src = SOURCES[lang as Lang]?.[line];
    const length = LINE_MS[lang as Lang]?.[line] ?? 0;
    let handle: Handle | null = null;
    let clock: ReturnType<typeof setInterval> | null = null;
    let gone = false;
    // no sound: the same timeline on a plain clock
    const runClock = () => {
      const t0 = Date.now();
      setPos(0);
      clock = setInterval(() => {
        const ms = Date.now() - t0;
        setPos(ms >= length ? DONE : ms);
        if (ms >= length && clock) clearInterval(clock);
      }, 120);
    };
    const id = setTimeout(() => {
      if (!src || isSfxMuted()) {
        runClock();
        return;
      }
      setPos(0);
      play(src, (ms) => {
        if (!gone) setPos(ms);
      }).then((h) => {
        if (gone) h?.stop();
        else if (h) handle = take(h);
        else runClock();
      });
    }, delayMs);
    return () => {
      gone = true;
      clearTimeout(id);
      if (clock) clearInterval(clock);
      handle?.stop();
    };
  }, [line, enabled, delayMs, lang, isLoaded]);
  return pos;
}
