/**
 * Personal baselines + problem-sound map (spec §8.5, §7.1).
 *
 * - EMA per metric: b ← 0.8·b + 0.2·x (raw values), stored at se:baseline:v1.
 * - Weekly progress line ("Чёткость +12% за неделю") when the delta ≥ +5%.
 * - Consonant-cluster failure map at se:soundmap:v1; a cluster is "problem" at
 *   attempts ≥ 8 and failures/attempts ≥ 0.5.
 *
 * Time is passed in (`now`) so the logic is deterministic and testable.
 */

import { getJson, setJson, STORAGE_KEYS } from '../core/storage';
import { Locale } from '../types';

export const EMA_ALPHA = 0.2;
export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
export const PROGRESS_MIN_DELTA = 0.05; // +5%
export const CLUSTER_MIN_ATTEMPTS = 8;
export const CLUSTER_FAIL_RATIO = 0.5;

export type MetricSnapshot = Record<string, number>;

export interface BaselineRecord {
  values: MetricSnapshot;
  weekAnchor?: { values: MetricSnapshot; at: number };
}

/** Pure EMA update of the baseline with a batch of raw metric values. */
export function emaUpdate(record: BaselineRecord, metrics: MetricSnapshot): BaselineRecord {
  const values: MetricSnapshot = { ...record.values };
  for (const [k, x] of Object.entries(metrics)) {
    if (!Number.isFinite(x)) continue;
    values[k] = k in values ? 0.8 * values[k] + EMA_ALPHA * x : x;
  }
  return { ...record, values };
}

const METRIC_LABELS_RU: Record<string, string> = {
  clarity: 'Чёткость',
  tempoScore: 'Темп',
  punctScore: 'Паузы',
  loudness: 'Громкость',
  breath: 'Дыхание',
  fillerScore: 'Чистота речи',
  tautScore: 'Разнообразие',
  divScore: 'Словарь',
};
const METRIC_LABELS_EN: Record<string, string> = {
  clarity: 'Clarity',
  tempoScore: 'Tempo',
  punctScore: 'Pauses',
  loudness: 'Volume',
  breath: 'Breathing',
  fillerScore: 'Clean speech',
  tautScore: 'Variety',
  divScore: 'Vocabulary',
};

export interface WeeklyProgress {
  line: string | null;
  record: BaselineRecord;
}

/**
 * Compute the weekly progress line (comparing self to self, §8.5) and roll the
 * week anchor forward when a week has elapsed. Returns the possibly-updated
 * record so the caller can persist it.
 */
export function weeklyProgress(record: BaselineRecord, now: number, locale: Locale): WeeklyProgress {
  const anchor = record.weekAnchor;
  if (!anchor) {
    return { line: null, record: { ...record, weekAnchor: { values: { ...record.values }, at: now } } };
  }
  if (now - anchor.at < WEEK_MS) {
    return { line: null, record };
  }

  // A week has passed: find the most-improved metric ≥ +5%.
  let bestKey: string | null = null;
  let bestDelta = 0;
  for (const [k, cur] of Object.entries(record.values)) {
    const prev = anchor.values[k];
    if (prev == null || prev <= 0) continue;
    const delta = (cur - prev) / prev;
    if (delta >= PROGRESS_MIN_DELTA && delta > bestDelta) {
      bestDelta = delta;
      bestKey = k;
    }
  }

  const rolled: BaselineRecord = { ...record, weekAnchor: { values: { ...record.values }, at: now } };
  if (!bestKey) return { line: null, record: rolled };

  const labels = locale === 'en' ? METRIC_LABELS_EN : METRIC_LABELS_RU;
  const label = labels[bestKey] ?? bestKey;
  const pct = Math.round(bestDelta * 100);
  const line = locale === 'en' ? `${label} +${pct}% this week` : `${label} +${pct}% за неделю`;
  return { line, record: rolled };
}

export async function loadBaselines(): Promise<BaselineRecord> {
  return (await getJson<BaselineRecord>(STORAGE_KEYS.baseline)) ?? { values: {} };
}

export async function saveBaselines(record: BaselineRecord): Promise<void> {
  await setJson(STORAGE_KEYS.baseline, record);
}

// ---------------------------------------------------------------------------
// Problem-sound map (§7.1)
// ---------------------------------------------------------------------------

export interface SoundMap {
  clusters: Record<string, { failures: number; attempts: number }>;
}

const RU_VOWELS = 'аеиоуыэюя';
const RU_SIGNS = 'ьъ';

function isConsonant(c: string): boolean {
  return /[а-яё]/.test(c) && RU_VOWELS.indexOf(c) < 0 && RU_SIGNS.indexOf(c) < 0;
}

/** Extract consonant bi/trigrams from a word (deduped within the word). */
export function extractClusters(word: string): string[] {
  const w = word.toLowerCase().replace(/ё/g, 'е');
  const found = new Set<string>();
  let run = '';
  const flush = () => {
    for (let i = 0; i + 2 <= run.length; i++) found.add(run.slice(i, i + 2));
    for (let i = 0; i + 3 <= run.length; i++) found.add(run.slice(i, i + 3));
    run = '';
  };
  for (const ch of w) {
    if (isConsonant(ch)) run += ch;
    else flush();
  }
  flush();
  return Array.from(found);
}

export interface SoundmapUpdate {
  clusters: string[];
  failed: boolean;
}

/** Fold a batch of word observations into the soundmap (pure). */
export function updateSoundmap(map: SoundMap, updates: readonly SoundmapUpdate[]): SoundMap {
  const clusters: SoundMap['clusters'] = { ...map.clusters };
  for (const u of updates) {
    for (const c of u.clusters) {
      const cur = clusters[c] ?? { failures: 0, attempts: 0 };
      clusters[c] = {
        attempts: cur.attempts + 1,
        failures: cur.failures + (u.failed ? 1 : 0),
      };
    }
  }
  return { clusters };
}

/** Worst qualifying problem cluster, or null (§7.1). */
export function getProblemCluster(map: SoundMap): string | null {
  let best: string | null = null;
  let bestRatio = 0;
  for (const [c, s] of Object.entries(map.clusters)) {
    if (s.attempts < CLUSTER_MIN_ATTEMPTS) continue;
    const ratio = s.failures / s.attempts;
    if (ratio >= CLUSTER_FAIL_RATIO && ratio > bestRatio) {
      bestRatio = ratio;
      best = c;
    }
  }
  return best;
}

export async function loadSoundmap(): Promise<SoundMap> {
  return (await getJson<SoundMap>(STORAGE_KEYS.soundmap)) ?? { clusters: {} };
}

export async function saveSoundmap(map: SoundMap): Promise<void> {
  await setJson(STORAGE_KEYS.soundmap, map);
}
