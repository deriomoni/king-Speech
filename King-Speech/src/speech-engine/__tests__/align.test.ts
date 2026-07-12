/** Alignment tests (spec §11.1). */
import { align, charLevenshtein, fuzzyEqual } from '../core/text/align';

const words = (s: string) => s.split(' ').filter(Boolean);

describe('charLevenshtein', () => {
  it('is 0 for identical strings', () => {
    expect(charLevenshtein('карла', 'карла')).toBe(0);
  });
  it('counts single edits', () => {
    expect(charLevenshtein('карала', 'крала')).toBe(1); // delete one 'а'
    expect(charLevenshtein('кот', 'код')).toBe(1);
  });
  it('respects the cap early-out', () => {
    expect(charLevenshtein('abcdef', 'uvwxyz', 1)).toBe(2); // > cap → cap+1
  });
});

describe('fuzzyEqual (§5.2)', () => {
  it('matches near-misses when the longer word is ≥5 chars', () => {
    expect(fuzzyEqual('карала', 'крала')).toBe(true);
  });
  it('does not fuzzy-match short words', () => {
    expect(fuzzyEqual('кот', 'код')).toBe(false); // max length 3 < 5
  });
  it('rejects distance > 1', () => {
    expect(fuzzyEqual('корабль', 'карандаш')).toBe(false);
  });
});

describe('align (§11.1)', () => {
  it('exact match → full coverage, zero WER', () => {
    const r = align(words('карл у клары украл кораллы'), words('карл у клары украл кораллы'));
    expect(r.matches).toBe(5);
    expect(r.coverage).toBe(1);
    expect(r.wer).toBe(0);
    expect(r.ops.every((o) => o.type === 'match')).toBe(true);
  });

  it('deletion: a missed reference word', () => {
    const r = align(words('карл у клары украл кораллы'), words('карл у клары кораллы'));
    expect(r.deletions).toBe(1);
    expect(r.matches).toBe(4);
    expect(r.coverage).toBeCloseTo(4 / 5, 6);
    const del = r.ops.find((o) => o.type === 'del');
    expect(del?.refIdx).toBe(3); // "украл"
  });

  it('insertion: an extra spoken word', () => {
    const r = align(words('карл украл кораллы'), words('карл быстро украл кораллы'));
    expect(r.insertions).toBe(1);
    expect(r.matches).toBe(3);
    expect(r.refWordCount).toBe(3);
    expect(r.wer).toBeCloseTo(1 / 3, 6);
  });

  it('fuzzy STT near-miss counts as a match, not a substitution', () => {
    const r = align(words('клара крала кларнет'), words('клара карала кларнет'));
    // «крала»→«карала» is a fuzzy match (dist 1, len ≥5); the rest exact.
    expect(r.matches).toBe(3);
    expect(r.substitutions).toBe(0);
    expect(r.coverage).toBe(1);
  });

  it('substitution: a genuinely different word', () => {
    const r = align(words('карл украл кораллы'), words('карл забрал кораллы'));
    expect(r.substitutions).toBe(1);
    expect(r.matches).toBe(2);
  });

  it('empty transcript → all deletions, zero coverage', () => {
    const r = align(words('карл украл кораллы'), []);
    expect(r.matches).toBe(0);
    expect(r.deletions).toBe(3);
    expect(r.coverage).toBe(0);
    expect(r.wer).toBe(1);
  });

  it('empty reference → zero-safe', () => {
    const r = align([], words('что то'));
    expect(r.coverage).toBe(0);
    expect(r.insertions).toBe(2);
  });
});
