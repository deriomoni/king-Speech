/**
 * Public shared types for the speech engine (spec §2).
 *
 * `PlayerRank` is the engine's ordinal rank. The app stores rank as an index
 * 1..5 (`@kingspeech_current_rank_v1`); `rankFromIndex` maps it in. The γ curve
 * (§8.2) depends only on ordinal position, so the app's display names
 * (Новичок/Любитель/Уверенный/Мастер/Профи) need not match the slugs here.
 */

import { SttMode } from './core/stt/types';

export type Level = 'tongue_twister' | 'reading' | 'literature' | 'vocabulary' | 'show_time';
export type Locale = 'ru' | 'en';

export type PlayerRank = 'novice' | 'apprentice' | 'orator' | 'master' | 'pro';
export const RANK_ORDER: readonly PlayerRank[] = ['novice', 'apprentice', 'orator', 'master', 'pro'];

/** Map the app's 1..5 rank index to a PlayerRank (clamped). */
export function rankFromIndex(index: number): PlayerRank {
  const i = Math.max(1, Math.min(5, Math.round(index)));
  return RANK_ORDER[i - 1];
}

export type RetryReason =
  | 'too_short'
  | 'mostly_silence'
  | 'nothing_recognized'
  | 'off_script'
  | 'too_loud_clipping';

export type Stars = 2 | 3 | 4 | 5;

export interface ReferenceContent {
  /** Raw reference text WITH punctuation (used for the pause map). */
  text: string;
  /** Base tempo for tongue twisters; defaults to 90 when absent (§7.1). */
  baseWPM?: number;
  /** Literature preset toggles (stanza corridors, overlong exemption). */
  literature?: boolean;
}

/** Raw metric bundle — internal only, never surfaced to the UI (HC-4). */
export interface RawMetrics {
  raw: number; // 0..100 surface-independent score
  mode: SttMode;
  clarity?: number;
  coverage?: number;
  wpm?: number;
  tempoScore?: number | null;
  punctScore?: number;
  loudness?: number;
  loudLevel?: number;
  loudHold?: number;
  lMean?: number;
  lStd?: number;
  breath?: number;
  fillerRate?: number;
  fillerScore?: number;
  tautScore?: number;
  divScore?: number;
  pauseDiscipline?: number;
  monotone?: boolean;
}

export interface Feedback {
  /** Exactly one praise + one growth + one action (spec §8.4). */
  praise: string;
  growth: string;
  action: string;
  /** Optional weekly baseline progress line (§8.5). */
  progressLine?: string;
  /** Id used for anti-repeat bookkeeping (insight id or metric bucket). */
  growthCategory: string;
}

export type AnalysisResult =
  | { status: 'retry'; reason: RetryReason; message: string }
  | {
      status: 'scored';
      shown: { score: number; stars: Stars; feedback: Feedback };
      raw: RawMetrics;
      /** True when only acoustic analysis ran (no STT pack, §9). UI shows a disclaimer. */
      liteMode?: boolean;
    };
