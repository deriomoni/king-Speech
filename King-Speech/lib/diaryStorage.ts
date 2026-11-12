/**
 * Audio diary storage.
 *
 * PRIVACY (user-facing promise, see the info sheet on /diary: «Записи хранятся
 * только на твоём телефоне»): diary recordings NEVER leave the device.
 *   - Audio files are copied into the app's private document directory
 *     (`FileSystem.documentDirectory + "diary/"`), not the shared cache.
 *   - Metadata (title, emotion, date, duration, file uri) lives only in
 *     AsyncStorage under DIARY_KEY.
 *   - Nothing here (or in the diary screens) uploads, syncs, or sends these
 *     files or their metadata to the backend, Firebase, analytics or any
 *     other service. Do NOT add diary entries to GameContext / the cloud
 *     sync payload or to the public «Моя библиотека» screen.
 * On web the recording stays a session-only blob: URL in this browser.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

export const DIARY_KEY = "@kingspeech_diary_v1";

export type DiaryEmotion =
  | "neutral"
  | "joy"
  | "calm"
  | "surprise"
  | "sad"
  | "anxious"
  | "angry"
  | "tired";

export type DiaryEntry = {
  id: string;
  uri: string;
  title: string;
  emotion: DiaryEmotion;
  /** Epoch ms when the entry was saved. */
  date: number;
  durationSec: number;
  /** Small rotation (deg) so each cassette sits a little crooked in the grid. */
  tilt: number;
};

export async function loadDiary(): Promise<DiaryEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(DIARY_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? (list as DiaryEntry[]) : [];
  } catch {
    return [];
  }
}

async function writeDiary(list: DiaryEntry[]) {
  await AsyncStorage.setItem(DIARY_KEY, JSON.stringify(list));
}

/**
 * Copy a freshly recorded file (the recorder writes into the OS cache, which
 * can be purged) into the private document directory. Returns the new uri.
 */
export async function persistDiaryAudio(uri: string): Promise<string> {
  if (Platform.OS === "web") return uri;
  const FileSystem = require("expo-file-system/legacy");
  const dir = `${FileSystem.documentDirectory}diary/`;
  try {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  } catch {}
  const ext = (uri.split("?")[0].split(".").pop() || "m4a").slice(0, 5);
  const dest = `${dir}entry_${Date.now()}.${ext}`;
  await FileSystem.copyAsync({ from: uri, to: dest });
  // Best effort: drop the cache copy so the take only exists in one place.
  try {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch {}
  return dest;
}

/** Delete a recording that was never saved (discarded on the sign step). */
export async function discardDiaryAudio(uri: string | null) {
  if (!uri) return;
  if (Platform.OS === "web") {
    try {
      URL.revokeObjectURL(uri);
    } catch {}
    return;
  }
  try {
    const FileSystem = require("expo-file-system/legacy");
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch {}
}

export async function addDiaryEntry(
  e: Omit<DiaryEntry, "id" | "date" | "tilt">,
): Promise<DiaryEntry> {
  const list = await loadDiary();
  const tilts = [-2, 1.5, 1, -1.5, -1, 2];
  const entry: DiaryEntry = {
    ...e,
    id: `d_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    date: Date.now(),
    tilt: tilts[list.length % tilts.length],
  };
  await writeDiary([entry, ...list]);
  return entry;
}

export async function deleteDiaryEntry(id: string): Promise<DiaryEntry[]> {
  const list = await loadDiary();
  const victim = list.find((x) => x.id === id);
  const next = list.filter((x) => x.id !== id);
  await writeDiary(next);
  if (victim) await discardDiaryAudio(victim.uri);
  return next;
}

/** 2:14 style clock. */
export function fmtClock(sec: number) {
  const v = Math.max(0, Math.round(sec || 0));
  return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, "0")}`;
}
