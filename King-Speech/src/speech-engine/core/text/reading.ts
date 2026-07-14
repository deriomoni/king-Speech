/**
 * Reading-canvas text helpers — tokenization for the karaoke renderer and the
 * streaming hypothesis → "current word" mapping. Pure (no RN / no native), so
 * it lives beside align/normalize and is unit-tested directly.
 */

import { align } from './align';

export interface ReadingToken {
  text: string;
  isWord: boolean;
  /**
   * Word ordinal for words; for gaps/punctuation, the preceding word's ordinal
   * (so punctuation lights together with the word it trails). -1 before the
   * first word.
   */
  wordIndex: number;
}

export interface TokenizeResult {
  tokens: ReadingToken[];
  /** Number of actual words (max wordIndex + 1). */
  wordCount: number;
}

// A "word" is a run of letters/digits allowing internal apostrophes/hyphens
// (о'кей, кто-то, well-known). Everything else — spaces, punctuation, newlines —
// is preserved verbatim so the text reproduces exactly.
const WORD_RE = /[\p{L}\p{N}]+(?:[’'\-][\p{L}\p{N}]+)*/gu;

export function tokenizeReading(text: string): TokenizeResult {
  const tokens: ReadingToken[] = [];
  let lastIndex = 0;
  let wordOrdinal = 0;
  let match: RegExpExecArray | null;
  WORD_RE.lastIndex = 0;
  while ((match = WORD_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({
        text: text.slice(lastIndex, match.index),
        isWord: false,
        wordIndex: wordOrdinal - 1,
      });
    }
    tokens.push({ text: match[0], isWord: true, wordIndex: wordOrdinal });
    wordOrdinal += 1;
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    tokens.push({
      text: text.slice(lastIndex),
      isWord: false,
      wordIndex: wordOrdinal - 1,
    });
  }
  return { tokens, wordCount: wordOrdinal };
}

/** Normalize a word for alignment: lowercase, strip punctuation, ё→е. */
export function normalizeReadingWord(w: string): string {
  return w
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

export function splitReadingWords(text: string): string[] {
  return (text.match(WORD_RE) ?? []).map(normalizeReadingWord).filter(Boolean);
}

/**
 * Map a streaming hypothesis onto the reference and return the index of the
 * last reference word that has been read. Pure + monotonic:
 *  - never returns less than `prevIndex` (the spark never slides backwards),
 *  - tolerates the recognizer skipping words (alignment bridges the gap),
 *  - clamps a single jump to `maxJump` so a burst of late text glides forward
 *    over the next few updates instead of teleporting.
 */
export function computeAlignmentIndex(
  refWords: readonly string[],
  hypWords: readonly string[],
  prevIndex: number,
  maxJump = 4,
): number {
  if (hypWords.length === 0 || refWords.length === 0) return prevIndex;
  const res = align(refWords, hypWords);
  let lastMatchedRef = -1;
  for (const op of res.ops) {
    if ((op.type === 'match' || op.type === 'sub') && op.refIdx != null) {
      if (op.refIdx > lastMatchedRef) lastMatchedRef = op.refIdx;
    }
  }
  if (lastMatchedRef <= prevIndex) return prevIndex;
  return Math.min(lastMatchedRef, prevIndex + maxJump);
}
