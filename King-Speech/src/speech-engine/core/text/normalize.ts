/**
 * Text normalization (spec §5.1). Applied identically to reference and
 * transcript so alignment compares like with like.
 *
 * 1. lowercase → NFC
 * 2. ё → е
 * 3. drop everything except letters, digits and word-internal hyphens
 * 4. collapse whitespace
 * (5. numbers are pre-written as words in content — a content rule, not code.)
 */

export function normalizeText(input: string): string {
  if (!input) return '';
  let s = input.toLowerCase().normalize('NFC').replace(/ё/g, 'е');
  // Keep letters, digits, whitespace and hyphens; everything else → space.
  s = s.replace(/[^\p{L}\p{N}\s-]/gu, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  if (!s) return '';
  // Strip leading/trailing hyphens per token (keep only word-internal ones).
  return s
    .split(' ')
    .map((w) => w.replace(/^-+/, '').replace(/-+$/, ''))
    .filter(Boolean)
    .join(' ');
}

/** Normalize and split into word tokens. */
export function tokenize(input: string): string[] {
  const n = normalizeText(input);
  return n ? n.split(' ') : [];
}
