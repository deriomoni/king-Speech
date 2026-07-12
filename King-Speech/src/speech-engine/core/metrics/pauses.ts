/**
 * Punctuation pauses (spec §6.3) and breath breaks (spec §6.4).
 *
 * An expectation map is built by parsing the reference. A pause "belongs" to a
 * mark if its startMs ∈ [wordEnd − 80, wordEnd + 250], where wordEnd is the end
 * of the word before the mark (STT timing). Marks whose anchor word wasn't
 * spoken (deletion, or no timing) are skipped, not penalized.
 */

import { AlignOp } from '../text/align';
import { WordToken } from '../stt/types';
import { Pause } from '../audio/vad';
import { clamp01 } from '../util';

export type PunctKind = 'comma' | 'clause' | 'sentence' | 'ellipsis' | 'stanza';
export type MarkClass = 'hit' | 'short' | 'swallowed' | 'overlong' | 'skipped';

/** Anchor timing tolerance around wordEnd (§6.3). */
export const MATCH_BEFORE_MS = 80;
export const MATCH_AFTER_MS = 250;
/** A pause counts as "short" (not swallowed) only if longer than this. */
export const SHORT_FLOOR_MS = 80;
/** Unattached pauses at/above this are breath breaks (§6.4). */
export const BREATH_MIN_MS = 350;

const CORRIDORS: Record<PunctKind, [number, number]> = {
  comma: [150, 300],
  clause: [250, 450],
  sentence: [400, 750],
  ellipsis: [600, 1000],
  stanza: [600, 1000],
};

export interface PunctExpectation {
  refWordIndex: number;
  kind: PunctKind;
  lo: number;
  hi: number;
}

export interface ReferenceParse {
  words: string[];
  expectations: PunctExpectation[];
}

const WORD_RE = /[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*/gu;

function classifyGap(gap: string): PunctKind | null {
  if (gap.includes('…') || gap.includes('...')) return 'ellipsis';
  if (/\n\s*\n/.test(gap)) return 'stanza';
  if (/[.!?]/.test(gap)) return 'sentence';
  if (/[—–:]/.test(gap) || /\s-\s/.test(gap)) return 'clause';
  if (/[,;]/.test(gap)) return 'comma';
  return null;
}

/** Parse the raw reference (with punctuation) into words + punctuation expectations. */
export function buildPunctExpectations(referenceRaw: string): ReferenceParse {
  const matches = Array.from(referenceRaw.matchAll(WORD_RE));
  const words = matches.map((m) => m[0].toLowerCase().replace(/ё/g, 'е'));
  const expectations: PunctExpectation[] = [];

  for (let i = 0; i < matches.length; i++) {
    const gapStart = (matches[i].index ?? 0) + matches[i][0].length;
    const gapEnd = i + 1 < matches.length ? matches[i + 1].index ?? referenceRaw.length : referenceRaw.length;
    const gap = referenceRaw.slice(gapStart, gapEnd);
    const kind = classifyGap(gap);
    if (kind) {
      const [lo, hi] = CORRIDORS[kind];
      expectations.push({ refWordIndex: i, kind, lo, hi });
    }
  }
  return { words, expectations };
}

export interface MarkResult {
  refWordIndex: number;
  word: string;
  kind: PunctKind;
  durMs: number | null;
  score: number;
  cls: MarkClass;
}

export interface PunctuationResult {
  punctScore: number;
  marks: MarkResult[];
  matchedPauseIndices: Set<number>;
  /** Marks classified as swallowed (for the swallowed_marks insight). */
  swallowed: MarkResult[];
  evaluatedCount: number;
}

export interface PunctuationInput {
  parse: ReferenceParse;
  ops: readonly AlignOp[];
  hypWords: readonly WordToken[];
  pauses: readonly Pause[];
  /** Literature preset: overlong pauses are not penalized (§7.2). */
  literature: boolean;
}

/** Map reference word index → hypothesis word (via match/sub ops). */
function refToHyp(ops: readonly AlignOp[]): Map<number, number> {
  const map = new Map<number, number>();
  for (const op of ops) {
    if ((op.type === 'match' || op.type === 'sub') && op.refIdx != null && op.hypIdx != null) {
      map.set(op.refIdx, op.hypIdx);
    }
  }
  return map;
}

export function computePunctuation(input: PunctuationInput): PunctuationResult {
  const { parse, ops, hypWords, pauses, literature } = input;
  const anchor = refToHyp(ops);
  const marks: MarkResult[] = [];
  const matchedPauseIndices = new Set<number>();
  let sum = 0;
  let evaluated = 0;

  for (const exp of parse.expectations) {
    const word = parse.words[exp.refWordIndex] ?? '';
    const hypIdx = anchor.get(exp.refWordIndex);
    const hyp = hypIdx != null ? hypWords[hypIdx] : undefined;

    // Anchor word missing or timing unavailable → cannot judge; skip.
    if (!hyp || hyp.endMs <= 0) {
      marks.push({ refWordIndex: exp.refWordIndex, word, kind: exp.kind, durMs: null, score: 0, cls: 'skipped' });
      continue;
    }

    const wordEnd = hyp.endMs;
    // Find the closest pause whose start falls in the anchor window.
    let best = -1;
    let bestDist = Infinity;
    for (let p = 0; p < pauses.length; p++) {
      const start = pauses[p].startMs;
      if (start >= wordEnd - MATCH_BEFORE_MS && start <= wordEnd + MATCH_AFTER_MS) {
        const d = Math.abs(start - wordEnd);
        if (d < bestDist) {
          bestDist = d;
          best = p;
        }
      }
    }

    let durMs: number | null = null;
    let score = 0;
    let cls: MarkClass = 'swallowed';
    if (best >= 0) {
      durMs = pauses[best].durMs;
      matchedPauseIndices.add(best);
      if (durMs > 2 * exp.hi) {
        cls = 'overlong';
        score = literature ? 1 : 0.5;
      } else if (durMs >= exp.lo) {
        cls = 'hit';
        score = 1;
      } else if (durMs > SHORT_FLOOR_MS) {
        cls = 'short';
        score = 0.4;
      } else {
        cls = 'swallowed';
        score = 0;
      }
    }

    marks.push({ refWordIndex: exp.refWordIndex, word, kind: exp.kind, durMs, score, cls });
    sum += score;
    evaluated++;
  }

  return {
    punctScore: evaluated > 0 ? sum / evaluated : 1,
    marks,
    matchedPauseIndices,
    swallowed: marks.filter((m) => m.cls === 'swallowed'),
    evaluatedCount: evaluated,
  };
}

export interface BreathResult {
  breath: number;
  breaks: number;
}

/**
 * Breath breaks (§6.4): pauses ≥350 ms not attached to any punctuation mark.
 *   breath = clamp01(1 − breaks / (0.15 · refWordCount / 10))
 */
export function computeBreath(
  pauses: readonly Pause[],
  matchedPauseIndices: ReadonlySet<number>,
  refWordCount: number,
): BreathResult {
  let breaks = 0;
  for (let p = 0; p < pauses.length; p++) {
    if (pauses[p].durMs >= BREATH_MIN_MS && !matchedPauseIndices.has(p)) breaks++;
  }
  const denom = 0.15 * (refWordCount / 10);
  const breath = denom > 0 ? clamp01(1 - breaks / denom) : 1;
  return { breath, breaks };
}
