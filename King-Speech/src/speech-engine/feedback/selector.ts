/**
 * Feedback selector (spec §8.4.2).
 *
 * Invariant: exactly one praise + one growth + one action. Never more than one
 * critique. Insights take priority; only when none fires do we fall back to the
 * best/worst metric buckets. A valid insight forbids a generic phrase (§8.4).
 *
 *  1. growth = growth-insight with max severity×detectConf×novelty
 *     (novelty=0.5 if the same id was in the previous feedback); else worst metric.
 *  2. praise = praise-insight with max severity; else best metric,
 *     tie-break by largest gain over the personal baseline.
 *  3. action = the fixed pair for the chosen growth.
 *  4. anti-repeat: ≥4 variants each; avoid the last two used.
 *
 * The `monotone` insight overrides the worst-metric growth choice (§7.2).
 */

import { Feedback, Locale } from '../types';
import { Insight, InsightId } from './insights';
import { synonymsFor, FILLER_ADVICE, DEFAULT_FILLER_ADVICE } from './dictionaries.ru';
import {
  fillTemplate,
  GROWTH_INSIGHTS_RU,
  METRIC_GROWTH_RU,
  METRIC_PRAISE_RU,
  MetricKey,
  PRAISE_INSIGHTS_RU,
} from './templates.ru';
import {
  GROWTH_INSIGHTS_EN,
  METRIC_GROWTH_EN,
  METRIC_PRAISE_EN,
  PRAISE_INSIGHTS_EN,
} from './templates.en';

export interface MetricValue {
  key: MetricKey;
  value: number;
  computed: boolean;
}

export interface FeedbackHistory {
  /** Last (up to 2) growth category ids used (insight id or `metric:<key>`). */
  lastGrowthIds: string[];
  /** Last (up to 2) variant indices used, per category id. */
  lastVariantByCategory: Record<string, number[]>;
}

export const EMPTY_HISTORY: FeedbackHistory = { lastGrowthIds: [], lastVariantByCategory: {} };

export interface SelectorInput {
  insights: readonly Insight[];
  metrics: readonly MetricValue[];
  locale: Locale;
  history: FeedbackHistory;
  /** value − baseline per metric, for the praise tie-break (§8.4.2). */
  baselineGains?: Partial<Record<MetricKey, number>>;
  /** Stemmed lemma of a tautology word, for synonym lookup. */
  tautologyStem?: string;
  /** Weekly progress line (§8.5), appended when present. */
  progressLine?: string;
}

export interface SelectorOutput {
  feedback: Feedback;
  history: FeedbackHistory;
}

const METRIC_LABEL_CATEGORY = (key: MetricKey): string => `metric:${key}`;

function growthInsightTemplates(locale: Locale) {
  return locale === 'en' ? GROWTH_INSIGHTS_EN : GROWTH_INSIGHTS_RU;
}
function praiseInsightTemplates(locale: Locale) {
  return locale === 'en' ? PRAISE_INSIGHTS_EN : PRAISE_INSIGHTS_RU;
}
function metricGrowthTemplates(locale: Locale) {
  return locale === 'en' ? METRIC_GROWTH_EN : METRIC_GROWTH_RU;
}
function metricPraiseTemplates(locale: Locale) {
  return locale === 'en' ? METRIC_PRAISE_EN : METRIC_PRAISE_RU;
}

/** Choose a variant index avoiding the last two used for this category. */
function pickVariant(category: string, variants: readonly string[], history: FeedbackHistory): number {
  const recent = history.lastVariantByCategory[category] ?? [];
  for (let i = 0; i < variants.length; i++) {
    if (!recent.includes(i)) return i;
  }
  // All variants used recently (only possible with <3 variants): rotate.
  const last = recent[recent.length - 1] ?? -1;
  return (last + 1) % variants.length;
}

function pushRecent(list: number[] | undefined, value: number): number[] {
  const next = [...(list ?? []), value];
  return next.slice(-2);
}

function synonymText(stem: string | undefined, locale: Locale): string {
  const syns = stem ? synonymsFor(stem) : [];
  if (syns.length > 0) {
    return locale === 'en' ? `try: ${syns.join(', ')}` : `попробуй: ${syns.join(', ')}`;
  }
  return locale === 'en' ? 'look for a replacement' : 'поищи замену';
}

export function selectFeedback(input: SelectorInput): SelectorOutput {
  const { insights, metrics, locale, history } = input;
  const growthInsights = insights.filter((i) => i.kind === 'growth');
  const praiseInsights = insights.filter((i) => i.kind === 'praise');

  // --- Choose growth ---
  const novelty = (id: string): number => (history.lastGrowthIds.includes(id) ? 0.5 : 1);

  let growthText = '';
  let action = '';
  let growthCategory = '';

  const monotone = growthInsights.find((i) => i.id === 'monotone');
  const chosenGrowthInsight =
    monotone ??
    (growthInsights.length > 0
      ? growthInsights.reduce((best, i) =>
          i.severity * i.detectConf * novelty(i.id) > best.severity * best.detectConf * novelty(best.id)
            ? i
            : best,
        )
      : null);

  if (chosenGrowthInsight) {
    const tpl = growthInsightTemplates(locale)[chosenGrowthInsight.id];
    growthCategory = chosenGrowthInsight.id;
    if (tpl) {
      const idx = pickVariant(growthCategory, tpl.variants, history);
      const extras: Record<string, string> = {};
      if (chosenGrowthInsight.id === 'tautology_word') {
        extras.synonyms = synonymText(input.tautologyStem, locale);
      }
      growthText = fillTemplate(tpl.variants[idx], chosenGrowthInsight.evidence, extras);
      action = resolveAction(chosenGrowthInsight.id, chosenGrowthInsight, tpl.action, locale);
      history.lastVariantByCategory[growthCategory] = pushRecent(
        history.lastVariantByCategory[growthCategory],
        idx,
      );
    }
  } else {
    // Fallback: worst computed metric (with novelty anti-repeat).
    const computed = metrics.filter((m) => m.computed);
    if (computed.length > 0) {
      const worst = computed.reduce((best, m) =>
        (1 - m.value) * novelty(METRIC_LABEL_CATEGORY(m.key)) >
        (1 - best.value) * novelty(METRIC_LABEL_CATEGORY(best.key))
          ? m
          : best,
      );
      growthCategory = METRIC_LABEL_CATEGORY(worst.key);
      const tpl = metricGrowthTemplates(locale)[worst.key];
      const idx = pickVariant(growthCategory, tpl.variants, history);
      growthText = tpl.variants[idx];
      action = tpl.action;
      history.lastVariantByCategory[growthCategory] = pushRecent(
        history.lastVariantByCategory[growthCategory],
        idx,
      );
    }
  }

  // --- Choose praise ---
  let praiseText = '';
  let praiseCategory = '';
  const chosenPraiseInsight =
    praiseInsights.length > 0
      ? praiseInsights.reduce((best, i) => (i.severity > best.severity ? i : best))
      : null;

  if (chosenPraiseInsight) {
    const tpl = praiseInsightTemplates(locale)[chosenPraiseInsight.id];
    praiseCategory = `praise:${chosenPraiseInsight.id}`;
    if (tpl) {
      const idx = pickVariant(praiseCategory, tpl.variants, history);
      praiseText = fillTemplate(tpl.variants[idx], chosenPraiseInsight.evidence);
      history.lastVariantByCategory[praiseCategory] = pushRecent(
        history.lastVariantByCategory[praiseCategory],
        idx,
      );
    }
  } else {
    const computed = metrics.filter((m) => m.computed);
    if (computed.length > 0) {
      const gains = input.baselineGains ?? {};
      const best = computed.reduce((b, m) => {
        if (m.value > b.value) return m;
        if (m.value === b.value) {
          if ((gains[m.key] ?? -Infinity) > (gains[b.key] ?? -Infinity)) return m;
        }
        return b;
      });
      praiseCategory = `praise:metric:${best.key}`;
      const tpl = metricPraiseTemplates(locale)[best.key];
      const idx = pickVariant(praiseCategory, tpl.variants, history);
      praiseText = tpl.variants[idx];
      history.lastVariantByCategory[praiseCategory] = pushRecent(
        history.lastVariantByCategory[praiseCategory],
        idx,
      );
    }
  }

  // Update growth-category history (last 2 categories).
  if (growthCategory) {
    history.lastGrowthIds = [...history.lastGrowthIds, growthCategory].slice(-2);
  }

  const feedback: Feedback = {
    praise: praiseText,
    growth: growthText,
    action,
    growthCategory,
    ...(input.progressLine ? { progressLine: input.progressLine } : {}),
  };
  return { feedback, history };
}

/** Resolve the concrete action; filler_word pulls a personal tip from the dict. */
function resolveAction(
  id: InsightId,
  insight: Insight,
  defaultAction: string,
  locale: Locale,
): string {
  if (id === 'filler_word' && locale === 'ru') {
    const word = insight.evidence.word ?? '';
    return FILLER_ADVICE[word]?.advice ?? DEFAULT_FILLER_ADVICE;
  }
  return defaultAction;
}
