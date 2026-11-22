// Get Ready tip rotation. A route's tip slots are placeholders: each one is
// filled with a tip of the same variant (tip / fix) from TIP_POOL — the one
// the player saw longest ago (never-seen first, random among equals), never
// twice in one run. Every pool tip carries its own fitting Oscar pose, so the
// picture always matches the words.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { TIP_POOL, type CheatStep, type TipStep } from "@/constants/cheatsheetData";

const KEY = "@kingspeech_tips_seen_v1";
let seen: Record<string, number> = {};
let loaded = false;

export function loadTipHistory(): Promise<void> {
  if (loaded) return Promise.resolve();
  loaded = true;
  return AsyncStorage.getItem(KEY)
    .then((raw) => {
      if (raw) seen = JSON.parse(raw) ?? {};
    })
    .catch(() => {});
}
// Warm the cache as soon as Get Ready's code is loaded.
loadTipHistory();

export function markTipSeen(id: string) {
  seen = { ...seen, [id]: Date.now() };
  AsyncStorage.setItem(KEY, JSON.stringify(seen)).catch(() => {});
}

export function resolveTipSlots(steps: CheatStep[]): CheatStep[] {
  const used = new Set<string>();
  return steps.map((s) => {
    if (s.kind !== "tip") return s;
    const pool = TIP_POOL.filter((t) => t.variant === s.variant && !used.has(t.id));
    if (pool.length === 0) return s;
    const oldest = Math.min(...pool.map((t) => seen[t.id] ?? 0));
    // a little slack so tips seen within the same minute count as equally old
    const bucket = pool.filter((t) => (seen[t.id] ?? 0) <= oldest + 60_000);
    const pick: TipStep = bucket[Math.floor(Math.random() * bucket.length)];
    used.add(pick.id);
    return pick;
  });
}
