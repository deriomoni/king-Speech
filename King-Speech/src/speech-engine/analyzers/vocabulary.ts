/**
 * Vocabulary analyzer (spec §7.3).
 *
 *   gate: transcript non-empty
 *   match: fuzzy match (§5.2) of any transcript word with the reference
 *   raw = match ? 100·(0.5 + 0.5·conf_of_target_word) : RETRY (not a zero!)
 *
 * Not saying the word is a gate, not a score: "Не расслышал. Скажи ещё раз: …".
 */

import { fuzzyEqual } from '../core/text/align';
import { normalizeText } from '../core/text/normalize';
import { SttMode, SttResult } from '../core/stt/types';
import { detectSyllableHint, Insight } from '../feedback/insights';
import { MetricValue } from '../feedback/selector';
import { RawMetrics } from '../types';
import { normalizeHyp } from './context';

/** Proxy confidence when the platform provides none (NO_CONF, §9). */
const NO_CONF_PROXY = 0.9;

export interface VocabularyInput {
  /** The target word / short phrase. */
  referenceRaw: string;
  stt: SttResult;
  mode: SttMode;
}

export interface VocabularyOutput {
  matched: boolean;
  /** Valid only when matched. */
  raw: number;
  conf: number | null;
  metrics: RawMetrics;
  insights: Insight[];
  metricValues: MetricValue[];
}

/** Naive Russian syllabifier: one vowel per syllable (for the hint). */
export function syllabify(word: string): string {
  const w = word.toLowerCase().replace(/ё/g, 'е');
  const vowels = 'аеиоуыэюя';
  const syllables: string[] = [];
  let cur = '';
  for (let i = 0; i < w.length; i++) {
    cur += w[i];
    if (vowels.includes(w[i])) {
      // Close the syllable after the vowel unless only consonants remain.
      const rest = w.slice(i + 1);
      const hasMoreVowels = [...rest].some((c) => vowels.includes(c));
      if (hasMoreVowels) {
        syllables.push(cur);
        cur = '';
      }
    }
  }
  if (cur) syllables.push(cur);
  return syllables.length ? syllables.join('-') : w;
}

export function analyzeVocabulary(input: VocabularyInput): VocabularyOutput {
  const refWords = normalizeText(input.referenceRaw).split(' ').filter(Boolean);
  const normHyp = normalizeHyp(input.stt);

  // Find any transcript word that fuzzy-matches any reference word.
  let matchedConf: number | null = null;
  let matched = false;
  for (const ref of refWords) {
    for (const hyp of normHyp) {
      if (fuzzyEqual(ref, hyp.text)) {
        matched = true;
        matchedConf = hyp.confidence;
        break;
      }
    }
    if (matched) break;
  }

  if (!matched) {
    return {
      matched: false,
      raw: 0,
      conf: null,
      metrics: { raw: 0, mode: input.mode },
      insights: [],
      metricValues: [],
    };
  }

  const conf = matchedConf ?? NO_CONF_PROXY;
  const raw = 100 * (0.5 + 0.5 * conf);

  const insights: Insight[] = [];
  const hint = detectSyllableHint(refWords.join(' '), matchedConf, syllabify(refWords[0] ?? ''));
  if (hint) insights.push(hint);

  const metrics: RawMetrics = { raw, mode: input.mode, clarity: conf };
  const metricValues: MetricValue[] = [{ key: 'clarity', value: conf, computed: matchedConf != null }];

  return { matched: true, raw, conf: matchedConf, metrics, insights, metricValues };
}
