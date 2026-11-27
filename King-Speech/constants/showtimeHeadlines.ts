// Show Time score screen: the headline under Oscar. It follows the quality of
// the performance (overall score 0..10) and a different line is picked every
// time from the tier, so the screen never reads the same twice in a row.
import type { OscarEmotion } from "@/components/OscarMascot";

type L = { ru: string; en: string; kk: string };
type Tier = { min: number; emotion: OscarEmotion; lines: L[] };

const TIERS: Tier[] = [
  {
    min: 9,
    emotion: "thumbup",
    lines: [
      { ru: "Сногсшибательное выступление!", en: "A knockout performance!", kk: "Таңғаларлық өнер көрсету!" },
      { ru: "Зал аплодирует стоя!", en: "A standing ovation!", kk: "Зал орнынан тұрып қол соғуда!" },
      { ru: "Это было блестяще!", en: "That was brilliant!", kk: "Бұл керемет болды!" },
      { ru: "Король сцены!", en: "King of the stage!", kk: "Сахна патшасы!" },
    ],
  },
  {
    min: 7.5,
    emotion: "happy",
    lines: [
      { ru: "Отличное выступление!", en: "Great performance!", kk: "Тамаша өнер көрсету!" },
      { ru: "Мощно и уверенно!", en: "Strong and confident!", kk: "Күшті әрі сенімді!" },
      { ru: "Зал под впечатлением!", en: "The hall is impressed!", kk: "Зал әсерленді!" },
    ],
  },
  {
    min: 6,
    emotion: "cool",
    lines: [
      { ru: "Хорошее выступление", en: "A good performance", kk: "Жақсы өнер көрсету" },
      { ru: "Зал тебя услышал", en: "The hall heard you", kk: "Зал сені естіді" },
      { ru: "Уверенный шаг вперёд", en: "A confident step forward", kk: "Алға сенімді қадам" },
    ],
  },
  {
    min: 4,
    emotion: "notsure",
    lines: [
      { ru: "Неплохое начало", en: "Not a bad start", kk: "Жаман бастама емес" },
      { ru: "Ты на верном пути", en: "You're on the right track", kk: "Сен дұрыс жолдасың" },
      { ru: "Есть над чем поработать", en: "Some things to work on", kk: "Жұмыс істейтін тұстар бар" },
    ],
  },
  {
    min: 0,
    emotion: "sad",
    lines: [
      { ru: "Сцена ждёт реванша", en: "The stage awaits a rematch", kk: "Сахна қайта шығуды күтеді" },
      { ru: "Попробуй ещё раз", en: "Give it another go", kk: "Тағы бір рет байқап көр" },
      { ru: "Разогрев засчитан", en: "Warm-up counted", kk: "Жаттығу есептелді" },
    ],
  },
];

const SILENT: L = { ru: "Тебя не было слышно", en: "We couldn't hear you", kk: "Сенің дауысың естілмеді" };

/** Headline + Oscar's emotion for a score; `seed` (0..1) picks the line. */
export function showtimeHeadline(score10: number | null, silent: boolean, seed: number): { line: L; emotion: OscarEmotion } {
  if (silent) return { line: SILENT, emotion: "notsure" };
  const s = score10 ?? 0;
  const tier = TIERS.find((t) => s >= t.min) ?? TIERS[TIERS.length - 1];
  return { line: tier.lines[Math.floor(seed * tier.lines.length) % tier.lines.length], emotion: tier.emotion };
}
