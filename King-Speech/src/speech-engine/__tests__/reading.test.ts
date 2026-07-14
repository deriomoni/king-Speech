import {
  tokenizeReading,
  splitReadingWords,
  normalizeReadingWord,
  computeAlignmentIndex,
  readingLines,
} from '../core/text/reading';

describe('tokenizeReading', () => {
  it('reproduces the source text exactly', () => {
    const src = 'На берегу пустынных волн\nстоял он, дум великих полн…';
    const { tokens } = tokenizeReading(src);
    expect(tokens.map((t) => t.text).join('')).toBe(src);
  });

  it('counts words and assigns increasing ordinals', () => {
    const { tokens, wordCount } = tokenizeReading('Медный всадник');
    expect(wordCount).toBe(2);
    const words = tokens.filter((t) => t.isWord);
    expect(words.map((w) => w.text)).toEqual(['Медный', 'всадник']);
    expect(words.map((w) => w.wordIndex)).toEqual([0, 1]);
  });

  it('colors trailing punctuation with the preceding word', () => {
    const { tokens } = tokenizeReading('дум, полн');
    // "дум" (0), ", " gap (0), "полн" (1)
    const comma = tokens.find((t) => t.text.startsWith(','));
    expect(comma?.wordIndex).toBe(0);
  });

  it('marks leading punctuation as pre-first-word (-1)', () => {
    const { tokens } = tokenizeReading('«Слово»');
    expect(tokens[0].isWord).toBe(false);
    expect(tokens[0].wordIndex).toBe(-1);
  });

  it('keeps internal hyphens/apostrophes inside a word', () => {
    const { wordCount, tokens } = tokenizeReading('кто-то о’кей');
    expect(wordCount).toBe(2);
    expect(tokens.filter((t) => t.isWord).map((t) => t.text)).toEqual([
      'кто-то',
      'о’кей',
    ]);
  });

  it('assigns line indices that increment across newlines', () => {
    const { tokens } = tokenizeReading('На берегу\nстоял он\nи вдаль');
    const words = tokens.filter((t) => t.isWord);
    // line 0: На берегу | line 1: стоял он | line 2: и вдаль
    expect(words.map((w) => w.lineIndex)).toEqual([0, 0, 1, 1, 2, 2]);
  });

  it('counts blank lines so a stanza break bumps the line index', () => {
    const { tokens } = tokenizeReading('раз\n\nдва');
    const words = tokens.filter((t) => t.isWord);
    expect(words[0].lineIndex).toBe(0);
    expect(words[1].lineIndex).toBe(2); // blank line in between
  });
});

describe('readingLines', () => {
  it('returns non-empty lines with word counts + first word index', () => {
    const { tokens } = tokenizeReading('На берегу пустынных\nстоял он');
    const ls = readingLines(tokens);
    expect(ls).toEqual([
      { line: 0, wordCount: 3, firstWordIndex: 0 },
      { line: 1, wordCount: 2, firstWordIndex: 3 },
    ]);
  });

  it('skips blank lines entirely', () => {
    const { tokens } = tokenizeReading('раз\n\nдва три');
    const ls = readingLines(tokens);
    expect(ls.map((l) => l.line)).toEqual([0, 2]);
    expect(ls[1].wordCount).toBe(2);
  });
});

describe('normalizeReadingWord / splitReadingWords', () => {
  it('lowercases, strips punctuation, maps ё→е', () => {
    expect(normalizeReadingWord('Ёлка!')).toBe('елка');
  });
  it('splits and normalizes, dropping empties', () => {
    expect(splitReadingWords('На берегу, пустынных…')).toEqual([
      'на',
      'берегу',
      'пустынных',
    ]);
  });
});

describe('computeAlignmentIndex', () => {
  const ref = splitReadingWords('на берегу пустынных волн стоял он дум великих полн');

  it('advances to the last matched reference word', () => {
    const hyp = splitReadingWords('на берегу пустынных');
    // matched refs 0,1,2 → index 2 (but clamped to prev+maxJump from -1 → 3)
    const idx = computeAlignmentIndex(ref, hyp, -1);
    expect(idx).toBe(2);
  });

  it('never slides backwards (monotonic)', () => {
    const idx = computeAlignmentIndex(ref, splitReadingWords('на берегу'), 5);
    expect(idx).toBe(5);
  });

  it('tolerates a skipped word via alignment', () => {
    // "пустынных" missing from the hypothesis — align bridges it, we still
    // reach "волн" (ref idx 3).
    const hyp = splitReadingWords('на берегу волн');
    const idx = computeAlignmentIndex(ref, hyp, 1);
    expect(idx).toBeGreaterThanOrEqual(3);
  });

  it('clamps a big forward jump to maxJump', () => {
    const hyp = splitReadingWords('на берегу пустынных волн стоял он дум великих полн');
    const idx = computeAlignmentIndex(ref, hyp, 0, 4);
    expect(idx).toBe(4); // 0 + maxJump, not 8
  });

  it('returns prev on empty hypothesis', () => {
    expect(computeAlignmentIndex(ref, [], 3)).toBe(3);
  });
});
