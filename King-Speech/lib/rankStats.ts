/**
 * Highlights for the rank-up screen: a few facts about how the player trained
 * through the rank. Only real achievements make the list — a short streak or
 * a thin log is simply left out, never shown as a weak number.
 */
import type { Ionicons } from "@expo/vector-icons";
import { getBaseType, type ActivityEntry, type Level } from "@/context/GameContext";
import { pickLang, type Lang } from "@/context/LangContext";

export type RankHighlight = {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  label: string;
};

const DAY = 24 * 60 * 60 * 1000;

function dayKey(t: number) {
  const d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Longest run of consecutive calendar days with any practice. */
function bestStreak(log: ActivityEntry[]): number {
  const days = [...new Set(log.map((e) => dayKey(e.t)))].sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  for (let i = 0; i < days.length; i++) {
    // ±2h tolerates daylight-saving shifts
    run = i > 0 && Math.abs(days[i] - days[i - 1] - DAY) < 2 * 60 * 60 * 1000 ? run + 1 : 1;
    best = Math.max(best, run);
  }
  return best;
}

function ruPlural(n: number, one: string, few: string, many: string) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

const MODE_NAMES: Record<string, { ru: string; en: string; kk: string }> = {
  reading: { ru: "Чтение", en: "Reading", kk: "Оқу" },
  warmup: { ru: "Разминка", en: "Warm-up", kk: "Жаттығу" },
  interview: { ru: "Интервью", en: "Interview", kk: "Сұхбат" },
  vocabulary: { ru: "Словарь", en: "Vocabulary", kk: "Сөздік" },
  tonguetwister: { ru: "Скороговорки", en: "Tongue twisters", kk: "Жаңылтпаштар" },
  showtime: { ru: "Show Time", en: "Show Time", kk: "Show Time" },
};

const WEEKDAYS = {
  ru: ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"],
  en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  kk: ["жексенбі", "дүйсенбі", "сейсенбі", "сәрсенбі", "бейсенбі", "жұма", "сенбі"],
};

const DAY_PARTS = [
  { from: 5, to: 12, ru: "по утрам", en: "in the morning", kk: "таңертең" },
  { from: 12, to: 17, ru: "днём", en: "in the afternoon", kk: "күндіз" },
  { from: 17, to: 23, ru: "по вечерам", en: "in the evening", kk: "кешке" },
  { from: 23, to: 29, ru: "по ночам", en: "at night", kk: "түнде" },
];

export function rankHighlights(opts: {
  lang: Lang;
  log: ActivityEntry[];
  levels: Level[];
  fromSection: number;
  toSection: number;
  showTimeCount: number;
  max?: number;
}): RankHighlight[] {
  const { lang, log, levels, fromSection, toSection, showTimeCount, max = 4 } = opts;
  const L = (ru: string, en: string, kk: string) => pickLang(lang, { ru, en, kk });
  const out: RankHighlight[] = [];

  const streak = bestStreak(log);
  if (streak >= 3) {
    out.push({
      key: "streak",
      icon: "flame",
      value: String(streak),
      label: L(`${ruPlural(streak, "день", "дня", "дней")} подряд без пропусков`, "days in a row, no breaks", "күн қатарынан, үзіліссіз"),
    });
  }

  const done = levels.filter((l) => l.completed && l.module >= fromSection && l.module <= toSection);
  if (done.length > 0) {
    out.push({
      key: "levels",
      icon: "trophy",
      value: String(done.length),
      label: L(`${ruPlural(done.length, "уровень пройден", "уровня пройдено", "уровней пройдено")} в этом ранге`, "levels cleared in this rank", "деңгей осы дәрежеде өтілді"),
    });
  }

  const byMode = new Map<string, number>();
  for (const l of done) {
    const m = getBaseType(String(l.id));
    if (MODE_NAMES[m]) byMode.set(m, (byMode.get(m) ?? 0) + 1);
  }
  const topMode = [...byMode.entries()].sort((a, b) => b[1] - a[1])[0];
  if (topMode && topMode[1] >= 3) {
    out.push({
      key: "mode",
      icon: "star",
      value: pickLang(lang, MODE_NAMES[topMode[0]]),
      label: L("любимый режим", "your favourite mode", "сүйікті режиміңіз"),
    });
  }

  // when they train — only with enough history for a pattern to be real
  if (log.length >= 8) {
    const parts = DAY_PARTS.map(() => 0);
    const days = [0, 0, 0, 0, 0, 0, 0];
    for (const e of log) {
      const d = new Date(e.t);
      const h = d.getHours() < 5 ? d.getHours() + 24 : d.getHours();
      const p = DAY_PARTS.findIndex((x) => h >= x.from && h < x.to);
      if (p >= 0) parts[p]++;
      days[d.getDay()]++;
    }
    const pi = parts.indexOf(Math.max(...parts));
    if (parts[pi] / log.length >= 0.45) {
      out.push({
        key: "time",
        icon: pi === 0 ? "sunny" : pi === 3 ? "moon" : pi === 2 ? "partly-sunny" : "sunny",
        value: pickLang(lang, DAY_PARTS[pi]),
        label: L("ты в лучшей форме", "is when you shine", "сіз ең жақсы формадасыз"),
      });
    }
    const di = days.indexOf(Math.max(...days));
    if (days[di] / log.length >= 0.25) {
      out.push({
        key: "weekday",
        icon: "calendar",
        value: pickLang(lang, { ru: WEEKDAYS.ru[di], en: WEEKDAYS.en[di], kk: WEEKDAYS.kk[di] }),
        label: L("твой самый активный день", "your most active day", "ең белсенді күніңіз"),
      });
    }
  }

  if (showTimeCount >= 2) {
    out.push({
      key: "stage",
      icon: "mic",
      value: String(showTimeCount),
      label: L(`${ruPlural(showTimeCount, "выступление", "выступления", "выступлений")} на сцене`, "performances on stage", "сахнадағы өнер көрсету"),
    });
  }

  return out.slice(0, max);
}
