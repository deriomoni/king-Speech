/**
 * Vendored stemmers (spec §5.3). Pure JS, no native deps.
 *
 * - Russian: the Snowball "russian" algorithm
 *   (https://snowballstem.org/algorithms/russian/stemmer.html), reimplemented.
 * - English: the classic Porter algorithm.
 *
 * Used by fillers/tautology/diversity to compare lemmas rather than surface
 * forms. Input is assumed already normalized (lowercase, ё→е).
 */

// ---------------------------------------------------------------------------
// Russian (Snowball)
// ---------------------------------------------------------------------------

const RU_VOWELS = 'аеиоуыэюя';

function isRuVowel(c: string): boolean {
  return RU_VOWELS.indexOf(c) >= 0;
}

/** Start index of the region after the first vowel→consonant transition. */
function ruRegionStart(w: string, from: number): number {
  let i = from;
  while (i < w.length && !isRuVowel(w[i])) i++;
  while (i < w.length && isRuVowel(w[i])) i++;
  return i < w.length ? i + 1 : w.length;
}

/** Remove the first (longest-first) ending that lies within `region`. */
function removeEnding(
  w: string,
  region: number,
  endings: readonly string[],
  needPrecedingAYA: boolean,
): string | null {
  for (const e of endings) {
    const start = w.length - e.length;
    if (start < region) continue;
    if (!w.endsWith(e)) continue;
    if (needPrecedingAYA) {
      const prev = w[start - 1];
      if (prev !== 'а' && prev !== 'я') continue;
    }
    return w.slice(0, start);
  }
  return null;
}

// Ending groups, each sorted longest-first so `removeEnding` is greedy.
const PG_G1 = ['вшись', 'вши', 'в'];
const PG_G2 = ['ившись', 'ывшись', 'ивши', 'ывши', 'ив', 'ыв'];
const ADJECTIVE = [
  'ими', 'ыми', 'его', 'ого', 'ему', 'ому',
  'ее', 'ие', 'ые', 'ое', 'ей', 'ий', 'ый', 'ой', 'ем', 'им', 'ым', 'ом',
  'их', 'ых', 'ую', 'юю', 'ая', 'яя', 'ою', 'ею',
];
const PARTICIPLE_G1 = ['ем', 'нн', 'вш', 'ющ', 'щ'];
const PARTICIPLE_G2 = ['ивш', 'ывш', 'ующ'];
const VERB_G1 = [
  'ешь', 'нно', 'ете', 'йте',
  'ла', 'на', 'ли', 'ем', 'ло', 'но', 'ет', 'ют', 'ны', 'ть',
  'й', 'л', 'н',
];
const VERB_G2 = [
  'ейте', 'уйте',
  'ила', 'ыла', 'ена', 'ите', 'или', 'ыли', 'ило', 'ыло', 'ено',
  'ует', 'уют', 'ены', 'ить', 'ыть', 'ишь',
  'ей', 'уй', 'ил', 'ыл', 'им', 'ым', 'ен', 'ят', 'ит', 'ыт', 'ую',
  'ю',
];
const NOUN = [
  'иями',
  'ями', 'ами', 'ией', 'иям', 'ием', 'иях',
  'ев', 'ов', 'ие', 'ье', 'еи', 'ии', 'ей', 'ой', 'ий', 'ям', 'ем', 'ам',
  'ом', 'ах', 'ях', 'ию', 'ью', 'ия', 'ья',
  'а', 'е', 'и', 'й', 'о', 'у', 'ы', 'ь', 'ю', 'я',
];
const DERIVATIONAL = ['ость', 'ост'];
const SUPERLATIVE = ['ейше', 'ейш'];

function ruPerfectiveGerund(w: string, rv: number): string | null {
  return removeEnding(w, rv, PG_G2, false) ?? removeEnding(w, rv, PG_G1, true);
}

function ruAdjectival(w: string, rv: number): string | null {
  const adj = removeEnding(w, rv, ADJECTIVE, false);
  if (adj === null) return null;
  const p2 = removeEnding(adj, rv, PARTICIPLE_G2, false);
  if (p2 !== null) return p2;
  const p1 = removeEnding(adj, rv, PARTICIPLE_G1, true);
  if (p1 !== null) return p1;
  return adj;
}

function ruVerb(w: string, rv: number): string | null {
  return removeEnding(w, rv, VERB_G2, false) ?? removeEnding(w, rv, VERB_G1, true);
}

export function stemRu(word: string): string {
  let w = word;
  if (w.length <= 2) return w;

  let rv = w.length;
  for (let i = 0; i < w.length; i++) {
    if (isRuVowel(w[i])) {
      rv = i + 1;
      break;
    }
  }
  const r1 = ruRegionStart(w, 0);
  const r2 = ruRegionStart(w, r1);

  // Step 1.
  const pg = ruPerfectiveGerund(w, rv);
  if (pg !== null) {
    w = pg;
  } else {
    const refl = removeEnding(w, rv, ['ся', 'сь'], false);
    if (refl !== null) w = refl;
    const adj = ruAdjectival(w, rv);
    if (adj !== null) {
      w = adj;
    } else {
      const vb = ruVerb(w, rv);
      if (vb !== null) {
        w = vb;
      } else {
        const nn = removeEnding(w, rv, NOUN, false);
        if (nn !== null) w = nn;
      }
    }
  }

  // Step 2: remove a trailing и.
  if (w.endsWith('и') && w.length - 1 >= rv) w = w.slice(0, -1);

  // Step 3: derivational ending in R2.
  const der = removeEnding(w, r2, DERIVATIONAL, false);
  if (der !== null) w = der;

  // Step 4.
  if (w.endsWith('нн') && w.length - 2 >= rv) {
    w = w.slice(0, -1);
  } else {
    const sup = removeEnding(w, rv, SUPERLATIVE, false);
    if (sup !== null) {
      w = sup;
      if (w.endsWith('нн') && w.length - 2 >= rv) w = w.slice(0, -1);
    }
  }
  if (w.endsWith('ь') && w.length - 1 >= rv) w = w.slice(0, -1);

  return w;
}

// ---------------------------------------------------------------------------
// English (classic Porter)
// ---------------------------------------------------------------------------

const EN_VOWELS = 'aeiou';

function enIsConsonant(w: string, i: number): boolean {
  const c = w[i];
  if (EN_VOWELS.indexOf(c) >= 0) return false;
  if (c === 'y') return i === 0 ? true : !enIsConsonant(w, i - 1);
  return true;
}

/** Porter's measure m: the number of VC sequences. */
function enMeasure(stem: string): number {
  let m = 0;
  let prevCons = true;
  let seenVowel = false;
  for (let i = 0; i < stem.length; i++) {
    const cons = enIsConsonant(stem, i);
    if (!cons) seenVowel = true;
    if (!cons) prevCons = false;
    else {
      if (seenVowel && !prevCons) m++;
      prevCons = true;
    }
  }
  return m;
}

function enHasVowel(stem: string): boolean {
  for (let i = 0; i < stem.length; i++) if (!enIsConsonant(stem, i)) return true;
  return false;
}

function enDoubleConsonant(w: string): boolean {
  const n = w.length;
  return n >= 2 && w[n - 1] === w[n - 2] && enIsConsonant(w, n - 1);
}

function enCvc(w: string): boolean {
  const n = w.length;
  if (n < 3) return false;
  if (!enIsConsonant(w, n - 1) || enIsConsonant(w, n - 2) || !enIsConsonant(w, n - 3)) {
    return false;
  }
  const last = w[n - 1];
  return last !== 'w' && last !== 'x' && last !== 'y';
}

export function stemEn(word: string): string {
  let w = word;
  if (w.length <= 2) return w;

  // Step 1a.
  if (w.endsWith('sses')) w = w.slice(0, -2);
  else if (w.endsWith('ies')) w = w.slice(0, -2);
  else if (w.endsWith('ss')) { /* keep */ }
  else if (w.endsWith('s')) w = w.slice(0, -1);

  // Step 1b.
  let step1bSecond = false;
  if (w.endsWith('eed')) {
    if (enMeasure(w.slice(0, -3)) > 0) w = w.slice(0, -1);
  } else if (w.endsWith('ed') && enHasVowel(w.slice(0, -2))) {
    w = w.slice(0, -2);
    step1bSecond = true;
  } else if (w.endsWith('ing') && enHasVowel(w.slice(0, -3))) {
    w = w.slice(0, -3);
    step1bSecond = true;
  }
  if (step1bSecond) {
    if (w.endsWith('at') || w.endsWith('bl') || w.endsWith('iz')) {
      w += 'e';
    } else if (enDoubleConsonant(w) && !/[lsz]$/.test(w)) {
      w = w.slice(0, -1);
    } else if (enMeasure(w) === 1 && enCvc(w)) {
      w += 'e';
    }
  }

  // Step 1c.
  if (w.endsWith('y') && enHasVowel(w.slice(0, -1))) w = w.slice(0, -1) + 'i';

  // Step 2.
  const step2: [string, string][] = [
    ['ational', 'ate'], ['tional', 'tion'], ['enci', 'ence'], ['anci', 'ance'],
    ['izer', 'ize'], ['bli', 'ble'], ['alli', 'al'], ['entli', 'ent'],
    ['eli', 'e'], ['ousli', 'ous'], ['ization', 'ize'], ['ation', 'ate'],
    ['ator', 'ate'], ['alism', 'al'], ['iveness', 'ive'], ['fulness', 'ful'],
    ['ousness', 'ous'], ['aliti', 'al'], ['iviti', 'ive'], ['biliti', 'ble'],
    ['logi', 'log'],
  ];
  for (const [suf, rep] of step2) {
    if (w.endsWith(suf)) {
      if (enMeasure(w.slice(0, -suf.length)) > 0) w = w.slice(0, -suf.length) + rep;
      break;
    }
  }

  // Step 3.
  const step3: [string, string][] = [
    ['icate', 'ic'], ['ative', ''], ['alize', 'al'], ['iciti', 'ic'],
    ['ical', 'ic'], ['ful', ''], ['ness', ''],
  ];
  for (const [suf, rep] of step3) {
    if (w.endsWith(suf)) {
      if (enMeasure(w.slice(0, -suf.length)) > 0) w = w.slice(0, -suf.length) + rep;
      break;
    }
  }

  // Step 4.
  const step4 = [
    'al', 'ance', 'ence', 'er', 'ic', 'able', 'ible', 'ant', 'ement',
    'ment', 'ent', 'ou', 'ism', 'ate', 'iti', 'ous', 'ive', 'ize',
  ];
  for (const suf of step4) {
    if (w.endsWith(suf)) {
      const stem = w.slice(0, -suf.length);
      if (enMeasure(stem) > 1) w = stem;
      break;
    }
  }
  if (w.endsWith('ion')) {
    const stem = w.slice(0, -3);
    if (enMeasure(stem) > 1 && /[st]$/.test(stem)) w = stem;
  }

  // Step 5a.
  if (w.endsWith('e')) {
    const stem = w.slice(0, -1);
    const m = enMeasure(stem);
    if (m > 1 || (m === 1 && !enCvc(stem))) w = stem;
  }
  // Step 5b.
  if (enMeasure(w) > 1 && enDoubleConsonant(w) && w.endsWith('l')) w = w.slice(0, -1);

  return w;
}

/** Stem `word` for the given locale (defaults to Russian). */
export function stem(word: string, locale: 'ru' | 'en' = 'ru'): string {
  return locale === 'en' ? stemEn(word) : stemRu(word);
}
