/**
 * The player's very first reading take, kept forever.
 *
 * The rank-up screen plays it back so the player can hear how they sounded
 * at the very start and feel how far they've come. It is saved once — the
 * first reading recording that is long enough to mean something — no matter
 * whether the player chose to keep that take in their library, and it is
 * never overwritten. On native the audio is copied out of the OS cache into
 * the documents folder so it survives cleanups.
 */
import { useEffect, useState } from "react";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "@kingspeech_first_reading_take_v1";
/** Shorter takes are false starts, not a first reading. */
const MIN_SECONDS = 3;

export type FirstTake = {
  uri: string;
  title: string;
  author?: string;
  date: number;
  durationSec: number;
  waveform?: number[];
};

let cache: FirstTake | null | undefined;
let saving = false;
const listeners = new Set<(t: FirstTake | null) => void>();

export async function getFirstReadingTake(): Promise<FirstTake | null> {
  if (cache !== undefined) return cache;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const v = raw ? JSON.parse(raw) : null;
    cache = v && typeof v.uri === "string" ? (v as FirstTake) : null;
  } catch {
    cache = null;
  }
  return cache;
}

async function durableCopy(uri: string): Promise<string> {
  if (Platform.OS === "web") return uri;
  try {
    const FileSystem = require("expo-file-system/legacy");
    const dir = `${FileSystem.documentDirectory}reading/`;
    try {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    } catch {}
    const ext = (uri.split("?")[0].split(".").pop() || "m4a").slice(0, 5);
    const dest = `${dir}first_take.${ext}`;
    await FileSystem.copyAsync({ from: uri, to: dest });
    return dest;
  } catch {
    return uri;
  }
}

/** Save `take` as the first reading — only if none has been saved yet. */
export async function saveFirstReadingTake(take: FirstTake): Promise<void> {
  if (saving || !take.uri || take.durationSec < MIN_SECONDS) return;
  saving = true;
  try {
    if (await getFirstReadingTake()) return;
    const saved: FirstTake = {
      ...take,
      uri: await durableCopy(take.uri),
      // keep the envelope small: ~120 points is plenty for the bars
      waveform: take.waveform?.length ? downsample(take.waveform, 120) : undefined,
    };
    await AsyncStorage.setItem(KEY, JSON.stringify(saved));
    cache = saved;
    listeners.forEach((l) => l(saved));
  } catch {
  } finally {
    saving = false;
  }
}

function downsample(a: number[], n: number): number[] {
  if (a.length <= n) return a.map((v) => Math.round(v * 1000) / 1000);
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const s = Math.floor((i * a.length) / n);
    const e = Math.max(s + 1, Math.floor(((i + 1) * a.length) / n));
    let m = 0;
    for (let j = s; j < e; j++) m = Math.max(m, a[j]);
    out.push(Math.round(m * 1000) / 1000);
  }
  return out;
}

export function useFirstReadingTake(): FirstTake | null {
  const [take, setTake] = useState<FirstTake | null>(cache ?? null);
  useEffect(() => {
    let alive = true;
    getFirstReadingTake().then((t) => alive && setTake(t));
    listeners.add(setTake);
    return () => {
      alive = false;
      listeners.delete(setTake);
    };
  }, []);
  return take;
}
