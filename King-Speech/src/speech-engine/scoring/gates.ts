/**
 * Validity gates (spec §8.1) — run BEFORE any score is computed.
 *
 * A failed gate returns `{status:'retry'}`: no score is created or saved, the
 * streak is not broken, the attempt is not spent. Messages are neutral (no
 * blame). Trolling, noise, silence and reading the wrong text are all caught
 * here, so the scoring layer physically cannot emit a hurtful number.
 */

import { Level, Locale, RetryReason } from '../types';

/** Nominal reading pace used only to size the too_short gate (§8.1). */
export const READING_GATE_WPM = 120;

export const MIN_SPEECH_RATIO = 0.2;
export const MIN_CLIPPING_RATIO = 0.1;
export const OFF_SCRIPT_COVERAGE = 0.35;

export interface GateInput {
  level: Level;
  durationMs: number;
  speechRatio: number;
  recognizedWords: number;
  clippingRatio: number;
  /** Reference coverage (null for levels without a reference). */
  coverage: number | null;
  refWordCount?: number;
  /** Target wpm for the reading too_short expected-time calc. */
  targetWpm?: number;
}

export type GateResult =
  | { ok: true }
  | { ok: false; reason: RetryReason };

const HAS_REFERENCE: Record<Level, boolean> = {
  tongue_twister: true,
  reading: true,
  literature: true,
  vocabulary: false, // vocab uses its own gate (transcript non-empty + match)
  show_time: false,
};

function minDurationMs(input: GateInput): number {
  switch (input.level) {
    case 'tongue_twister':
      return 1500;
    case 'show_time':
      return 10000;
    case 'vocabulary':
      return 400;
    case 'reading':
    case 'literature': {
      const words = input.refWordCount ?? 0;
      const wpm = input.targetWpm && input.targetWpm > 0 ? input.targetWpm : READING_GATE_WPM;
      const expectedMs = (words / wpm) * 60000;
      return 0.25 * expectedMs;
    }
    default:
      return 0;
  }
}

/** Run the gates in order; return the first failure, or ok. */
export function checkGates(input: GateInput): GateResult {
  const minRecognized = input.level === 'vocabulary' ? 1 : 3;

  if (input.durationMs < minDurationMs(input)) return { ok: false, reason: 'too_short' };
  if (input.speechRatio < MIN_SPEECH_RATIO) return { ok: false, reason: 'mostly_silence' };
  if (input.recognizedWords < minRecognized) return { ok: false, reason: 'nothing_recognized' };
  if (
    HAS_REFERENCE[input.level] &&
    input.coverage != null &&
    input.coverage < OFF_SCRIPT_COVERAGE
  ) {
    return { ok: false, reason: 'off_script' };
  }
  if (input.clippingRatio >= MIN_CLIPPING_RATIO) return { ok: false, reason: 'too_loud_clipping' };
  return { ok: true };
}

const MESSAGES_RU: Record<RetryReason, string> = {
  too_short: 'Коротко вышло — давай ещё раз, чуть подольше.',
  mostly_silence: 'Почти не слышно голоса — попробуй ещё раз.',
  nothing_recognized: 'Не расслышал — давай ещё раз.',
  off_script: 'Кажется, это был другой текст — попробуй с начала.',
  too_loud_clipping: 'Микрофон перегружен — говори чуть тише или отодвинься.',
};

const MESSAGES_EN: Record<RetryReason, string> = {
  too_short: 'That was short — try again, a little longer.',
  mostly_silence: "I could barely hear your voice — let's try again.",
  nothing_recognized: "Didn't catch that — let's try again.",
  off_script: 'That looked like a different text — try from the start.',
  too_loud_clipping: 'The mic is overloaded — speak a bit softer or move back.',
};

export function retryMessage(reason: RetryReason, locale: Locale): string {
  return (locale === 'en' ? MESSAGES_EN : MESSAGES_RU)[reason];
}
