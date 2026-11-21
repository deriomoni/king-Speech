// «Королевские манеры» progress: which rules the player has gone through and
// whether they answered right. Shared by the mode screen, Path levels and
// quick prep, so a rule passed anywhere shows up in «Мой опыт».
import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "@kingspeech_manners_v1";

export type MannersEntry = { correct: boolean; at: number };
export type MannersProgress = Record<string, MannersEntry>;

let cache: MannersProgress = {};
let loaded = false;
const listeners = new Set<(p: MannersProgress) => void>();

function emit() {
  listeners.forEach((l) => l(cache));
}

async function load() {
  if (loaded) return;
  loaded = true;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) cache = JSON.parse(raw) ?? {};
  } catch {}
  emit();
}

/** Record an answered rule. A right answer is never downgraded by a later miss. */
export function recordMannersAnswer(ruleId: string, correct: boolean) {
  const prev = cache[ruleId];
  cache = { ...cache, [ruleId]: { correct: correct || !!prev?.correct, at: Date.now() } };
  AsyncStorage.setItem(KEY, JSON.stringify(cache)).catch(() => {});
  emit();
}

export function resetMannersProgress() {
  cache = {};
  AsyncStorage.removeItem(KEY).catch(() => {});
  emit();
}

export function useMannersProgress(): MannersProgress {
  const [p, setP] = useState<MannersProgress>(cache);
  useEffect(() => {
    listeners.add(setP);
    load();
    setP(cache);
    return () => {
      listeners.delete(setP);
    };
  }, []);
  return p;
}
