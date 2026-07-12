/**
 * Namespaced AsyncStorage wrapper for the engine (spec §10).
 *
 * All keys are versioned and prefixed. AsyncStorage is lazy-required so pure
 * unit tests (align/curve/gates/…) never touch the native module. HC-2: local
 * device storage only, no network.
 */

export const STORAGE_KEYS = {
  /** EMA baselines per metric (§8.5). */
  baseline: 'se:baseline:v1',
  /** Problem-sound cluster map (§7.1). */
  soundmap: 'se:soundmap:v1',
  /** Recently used feedback phrase ids + last critique category (§8.4.2). */
  feedback: 'se:feedback:v1',
  /** Cached STT capability detection (§4.4). */
  capability: 'se:capability:v1',
  /** Raw metrics per attempt — never exposed to screens (HC-4). */
  raw: 'se:raw:v1',
} as const;

interface AsyncStorageLike {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
}

let store: AsyncStorageLike | null | undefined;

function getStore(): AsyncStorageLike | null {
  if (store !== undefined) return store;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    store = require('@react-native-async-storage/async-storage')
      .default as AsyncStorageLike;
  } catch {
    store = null;
  }
  return store;
}

export async function getJson<T>(key: string): Promise<T | null> {
  const s = getStore();
  if (!s) return null;
  try {
    const raw = await s.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function setJson<T>(key: string, value: T): Promise<void> {
  const s = getStore();
  if (!s) return;
  try {
    await s.setItem(key, JSON.stringify(value));
  } catch {
    // Persistence is best-effort; a failed write must never break scoring.
  }
}

export async function removeKey(key: string): Promise<void> {
  const s = getStore();
  if (!s) return;
  try {
    await s.removeItem(key);
  } catch {
    // ignore
  }
}
