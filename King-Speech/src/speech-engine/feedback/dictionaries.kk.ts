/**
 * Kazakh feedback dictionaries (spec §8.4.3). Mirrors dictionaries.ru.ts.
 *
 * Coaching principle: a filler is replaced by a PAUSE, not another word — else
 * a new filler grows. Kazakh speech often mixes in Russian parasites
 * («короче», «типа», «вот», «как бы», «ну»), so they get Kazakh advice too.
 */

import { stemKk } from '../core/text/stemmer';
import type { FillerAdvice } from './dictionaries.ru';

/** Filler → advice. Keyed by the normalized token / bigram (fillers.ts byLemma). */
export const FILLER_ADVICE_KK: Record<string, FillerAdvice> = {
  яғни: { advice: 'Мұнда «яғни» керек емес — қысқа кідіріс жаса. Түсіндіру керек болса, «басқаша айтқанда» де.' },
  енді: { advice: '«Енді» сөзін алып таста да, сөйлемді бірден негізгі ойдан баста.' },
  'ал енді': { advice: 'Сөйлемді «ал енді» деп бастама — бірден негізгі ойға көш.' },
  әлгі: { advice: 'Сөз есіңе түспесе, «әлгі» деме — сәл кідір де, ойыңды жина.' },
  әлгіндей: { advice: 'Сөз іздеп тұрғанда «әлгіндей» деме — үнсіз кідіріс сенімдірек естіледі.' },
  сосын: { advice: 'Әр сөйлемді «сосын» деп жалғама. Жаңа ойдың алдында жай ғана кідір.' },
  негізі: { advice: '«Негізі» сөзін шын негізгі ойға ғана сақта, қалған жерде кідіріс жаса.' },
  қысқасы: { advice: '«Қысқасы» орнына «қорыта айтқанда» де немесе қысқа кідіріс жаса.' },
  мынау: { advice: '«Мынау» сөзінің орнына нақты атауын айт немесе сәл кідір.' },
  былай: { advice: '«Былай» деп уақыт созба — ойыңды жинау үшін қысқа кідір.' },
  короче: { advice: 'Бұл жерде қысқа кідіріс жаса. Қорытынды керек болса, «қорыта айтқанда» де.' },
  типа: { advice: 'Кідіріспен алмастыр. Мысал керек болса, «мысалы» де.' },
  'как бы': { advice: 'Бұл сөз көбіне мүлде керек емес — алып таста, орнына кідіріс қалдыр.' },
  ну: { advice: '«Ну» сөзін алып таста да, сөйлемді бірден баста.' },
  вот: { advice: '«Вот» орнына қысқа кідіріс жаса — мағынасы бұзылмайды.' },
};

/** Default advice when a filler has no specific entry. */
export const DEFAULT_FILLER_ADVICE_KK =
  'Сол жерлерде жай ғана үнсіз қал — кідіріс кез келген сөзден сенімдірек естіледі.';

/**
 * Mini synonym dictionary for `tautology_word`. Written as surface words and
 * keyed by `stemKk` at load time, so keys always match the stemmer output.
 * Seed set only — content can extend it.
 */
const SYNONYM_SEED_KK: [string, string[]][] = [
  ['жақсы', ['тамаша', 'керемет']],
  ['жаман', ['нашар', 'сапасыз']],
  ['үлкен', ['зор', 'ірі']],
  ['кішкентай', ['шағын', 'кішкене']],
  ['әдемі', ['көркем', 'сұлу']],
  ['тез', ['жылдам', 'шапшаң']],
  ['күшті', ['мықты', 'қуатты']],
  ['маңызды', ['елеулі', 'мәнді']],
  ['қызықты', ['тартымды', 'әсерлі']],
  ['қиын', ['күрделі', 'ауыр']],
  ['оңай', ['жеңіл', 'қарапайым']],
  ['көп', ['мол', 'көптеген']],
  ['адам', ['кісі', 'тұлға']],
  ['айту', ['баяндау', 'жеткізу']],
  ['ойлау', ['пайымдау', 'санау']],
  ['үй', ['баспана', 'мекен']],
  ['дос', ['жолдас', 'серік']],
  ['жұмыс', ['еңбек', 'іс']],
  ['уақыт', ['мезгіл', 'кез']],
  ['мәселе', ['түйін', 'проблема']],
];

export const SYNONYMS_KK: Record<string, string[]> = Object.fromEntries(
  SYNONYM_SEED_KK.map(([w, syns]) => [stemKk(w), syns]),
);

/** Look up Kazakh synonyms by stemmed lemma (empty when absent). */
export function synonymsForKk(lemmaStem: string): string[] {
  return SYNONYMS_KK[lemmaStem] ?? [];
}
