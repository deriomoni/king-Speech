/**
 * Russian feedback dictionaries (spec §8.4.3).
 *
 * Coaching principle: a filler is replaced by a PAUSE, not another word — else
 * a new filler grows. Some fillers also get a lexical alternative.
 */

export interface FillerAdvice {
  /** Advice text shown as the concrete action for a `filler_word` insight. */
  advice: string;
}

/** Filler → advice (hardcoded, §8.4.3). Keyed by normalized lemma/bigram. */
export const FILLER_ADVICE: Record<string, FillerAdvice> = {
  короче: { advice: 'В этих местах — короткая пауза. Если нужно слово, попробуй «итак» или «в итоге».' },
  типа: { advice: 'Замени паузой. Если нужен пример — скажи «например».' },
  'как бы': { advice: 'Чаще всего это слово вообще не нужно — просто убери его, оставь паузу.' },
  значит: { advice: 'Держи паузу вместо «значит» — она звучит увереннее.' },
  'в общем': { advice: 'Замени на «главное —» или короткую паузу.' },
  ну: { advice: 'Убери «ну» и начни фразу сразу с глагола.' },
  вот: { advice: 'Замени «вот» короткой паузой — смысл не пострадает.' },
};

/** Default advice when a filler has no specific entry. */
export const DEFAULT_FILLER_ADVICE =
  'Попробуй в этих местах просто молчать — пауза звучит увереннее любого слова.';

/**
 * Mini synonym dictionary for `tautology_word` (spec §8.4.3).
 *
 * This is a CONTENT task, not a code task: ~20 seed lemmas ship here; the full
 * 200–300 × 2–3 set is supplied by the content director. When a lemma is
 * absent, feedback uses the generic wording (no synonyms).
 */
export const SYNONYMS: Record<string, string[]> = {
  хорош: ['достойный', 'славный'],
  плох: ['скверный', 'неважный'],
  больш: ['крупный', 'громадный'],
  мал: ['небольшой', 'крошечный'],
  красив: ['прекрасный', 'изящный'],
  быстр: ['стремительный', 'скорый'],
  сильн: ['мощный', 'крепкий'],
  важн: ['значимый', 'весомый'],
  интересн: ['увлекательный', 'занятный'],
  сложн: ['непростой', 'запутанный'],
  прост: ['несложный', 'ясный'],
  дела: ['поступок', 'занятие'],
  вопрос: ['проблема', 'тема'],
  человек: ['личность', 'персона'],
  говор: ['произносить', 'высказывать'],
  дума: ['полагать', 'считать'],
  дом: ['жилище', 'здание'],
  друг: ['товарищ', 'приятель'],
  работ: ['труд', 'дело'],
  врем: ['пора', 'момент'],
};

/** Look up synonyms by stemmed lemma (empty when absent). */
export function synonymsFor(lemmaStem: string): string[] {
  return SYNONYMS[lemmaStem] ?? [];
}
