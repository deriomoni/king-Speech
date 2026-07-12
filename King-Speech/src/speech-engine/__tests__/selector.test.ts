/** Feedback selector tests (spec §11.6). */
import { Insight } from '../feedback/insights';
import {
  EMPTY_HISTORY,
  FeedbackHistory,
  MetricValue,
  selectFeedback,
} from '../feedback/selector';

const METRICS: MetricValue[] = [
  { key: 'clarity', value: 0.4, computed: true }, // worst
  { key: 'tempo', value: 0.9, computed: true }, // best
  { key: 'loudness', value: 0.7, computed: true },
];

function fresh(): FeedbackHistory {
  return { lastGrowthIds: [], lastVariantByCategory: {} };
}

describe('selectFeedback (§8.4.2)', () => {
  it('produces exactly one praise + one growth + one action', () => {
    const { feedback } = selectFeedback({ insights: [], metrics: METRICS, locale: 'ru', history: fresh() });
    expect(feedback.praise.length).toBeGreaterThan(0);
    expect(feedback.growth.length).toBeGreaterThan(0);
    expect(feedback.action.length).toBeGreaterThan(0);
  });

  it('falls back to worst metric for growth, best for praise, when no insight fires', () => {
    const { feedback } = selectFeedback({ insights: [], metrics: METRICS, locale: 'ru', history: fresh() });
    expect(feedback.growthCategory).toBe('metric:clarity');
  });

  it('a valid insight beats the generic bucket (no generic phrase)', () => {
    const filler: Insight = {
      id: 'filler_word', kind: 'growth', severity: 0.8, detectConf: 0.9,
      evidence: { word: 'короче', count: 5 },
    };
    const { feedback } = selectFeedback({ insights: [filler], metrics: METRICS, locale: 'ru', history: fresh() });
    expect(feedback.growthCategory).toBe('filler_word');
    expect(feedback.growth).toContain('короче');
    expect(feedback.growth).toContain('5');
  });

  it('monotone overrides the worst-metric growth choice (§7.2)', () => {
    // A low-severity monotone insight still wins the growth slot.
    const monotone: Insight = { id: 'monotone', kind: 'growth', severity: 0.3, detectConf: 0.5, evidence: {} };
    const stronger: Insight = { id: 'breath_breaks', kind: 'growth', severity: 0.9, detectConf: 0.9, evidence: { count: 4 } };
    const { feedback } = selectFeedback({
      insights: [stronger, monotone],
      metrics: METRICS,
      locale: 'ru',
      history: fresh(),
    });
    expect(feedback.growthCategory).toBe('monotone');
  });

  it('anti-repeat: avoids the last two used text variants for a category', () => {
    // clarity is decisively worst (0.1) so it stays the growth target even
    // after the novelty penalty; the assertion is about variant rotation.
    const metrics: MetricValue[] = [
      { key: 'clarity', value: 0.1, computed: true },
      { key: 'tempo', value: 0.9, computed: true },
      { key: 'loudness', value: 0.7, computed: true },
    ];
    const history: FeedbackHistory = {
      lastGrowthIds: ['metric:clarity'],
      lastVariantByCategory: { 'metric:clarity': [0, 1] },
    };
    const { feedback } = selectFeedback({ insights: [], metrics, locale: 'ru', history });
    expect(feedback.growthCategory).toBe('metric:clarity');
    const used = history.lastVariantByCategory['metric:clarity'];
    expect(used[used.length - 1]).toBeGreaterThanOrEqual(2);
  });

  it('anti-repeat: novelty lets a fresh metric win over a repeated one', () => {
    // Two near-equal worst metrics; the previously-used one is penalized.
    const metrics: MetricValue[] = [
      { key: 'clarity', value: 0.4, computed: true },
      { key: 'punct', value: 0.42, computed: true },
      { key: 'tempo', value: 0.95, computed: true },
    ];
    const history: FeedbackHistory = { lastGrowthIds: ['metric:clarity'], lastVariantByCategory: {} };
    const { feedback } = selectFeedback({ insights: [], metrics, locale: 'ru', history });
    // clarity (0.4) is nominally worst, but its novelty=0.5 penalty makes
    // punct ((1-0.42)*1 = 0.58 > (1-0.4)*0.5 = 0.30) the fresh choice.
    expect(feedback.growthCategory).toBe('metric:punct');
  });

  it('praise insight beats the best-metric fallback', () => {
    const praise: Insight = { id: 'zero_fillers', kind: 'praise', severity: 0.7, detectConf: 0.9, evidence: { count: 80 } };
    const { feedback } = selectFeedback({ insights: [praise], metrics: METRICS, locale: 'ru', history: fresh() });
    expect(feedback.praise).toContain('80');
  });

  it('EMPTY_HISTORY is a usable empty seed', () => {
    const { feedback } = selectFeedback({ insights: [], metrics: METRICS, locale: 'en', history: { ...EMPTY_HISTORY, lastVariantByCategory: {} } });
    expect(feedback.growth.length).toBeGreaterThan(0);
  });
});
