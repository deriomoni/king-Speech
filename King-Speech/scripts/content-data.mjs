// Static content data for King Speech 67-module expansion.
// Modules 1-6 preserve the existing hand-curated content (hardcoded in generator).
// Modules 7-67 use the data here.

// ── 67 MODULE THEMES ─────────────────────────────────────────────────────────
// Each entry: { ru, en } — short title used in subtitles and reading topics.
// Modules 1-6 keep their existing quotes from MODULE_QUOTES (hardcoded).
export const MODULE_THEMES = [
  null, // index 0 unused
  { ru: "Начало пути", en: "The beginning" },
  { ru: "Тишина - тоже часть речи", en: "Silence is also speech" },
  { ru: "Ясность - вежливость мастера", en: "Clarity is the master's courtesy" },
  { ru: "Слова - ключи к сердцам", en: "Words are keys to hearts" },
  { ru: "Действие сильнее слов", en: "Actions speak louder than words" },
  { ru: "Красота в глазах смотрящего", en: "Beauty is in the eye of the beholder" },
  // 7-67 below
  { ru: "Вера в себя", en: "Belief in yourself" },
  { ru: "Сила слов", en: "The power of words" },
  { ru: "Ошибки - не поражение", en: "Mistakes are not defeat" },
  { ru: "Если боишься - значит важно", en: "If you fear it, it matters" },
  { ru: "Жить полной жизнью", en: "Live life fully" },
  { ru: "Кто может изменить мир", en: "Who can change the world" },
  { ru: "Успех - это путь", en: "Success is a path" },
  { ru: "Идеального момента нет", en: "There is no perfect moment" },
  { ru: "Сила выбора", en: "The power of choice" },
  { ru: "Радость в каждом дне", en: "Joy in every day" },
  { ru: "Социальные сети", en: "Social media" },
  { ru: "Один шанс", en: "One chance" },
  { ru: "Сила вопроса", en: "The power of a question" },
  { ru: "Моё окружение", en: "My environment" },
  { ru: "Время - наш ресурс", en: "Time is our resource" },
  { ru: "Движение важнее скорости", en: "Movement matters more than speed" },
  { ru: "Доброта - это сила", en: "Kindness is strength" },
  { ru: "Самодисциплина", en: "Self-discipline" },
  { ru: "Роль искусства", en: "The role of art" },
  { ru: "Честность или выгода", en: "Honesty or profit" },
  { ru: "Личные границы", en: "Personal boundaries" },
  { ru: "Сила улыбки", en: "The power of a smile" },
  { ru: "Умение слушать", en: "The art of listening" },
  { ru: "Как формируется характер", en: "How character is formed" },
  { ru: "Уважение", en: "Respect" },
  { ru: "Говорить уверенно", en: "Speaking with confidence" },
  { ru: "Не сдаваться", en: "Never give up" },
  { ru: "Одно решение меняет всё", en: "One decision changes everything" },
  { ru: "Откуда уверенность", en: "Where confidence comes from" },
  { ru: "Зачем человеку мечты", en: "Why we need dreams" },
  { ru: "Бороться с волнением", en: "Conquering anxiety" },
  { ru: "Адаптивность", en: "Adaptability" },
  { ru: "Что делает человека сильным", en: "What makes a person strong" },
  { ru: "Влияние медиа на самооценку", en: "Media and self-esteem" },
  { ru: "Чему учит неудача", en: "What failure teaches" },
  { ru: "Поиск признания", en: "Searching for recognition" },
  { ru: "Что останется после меня", en: "What remains of me" },
  { ru: "Информационный шум", en: "Information noise" },
  { ru: "Работа в команде", en: "Teamwork" },
  { ru: "Ответственность", en: "Responsibility" },
  { ru: "Миллениалы", en: "Millennials" },
  { ru: "Тренды и быть в теме", en: "Trends and staying current" },
  { ru: "Сравнение с другими", en: "Comparison with others" },
  { ru: "Идеальная продуктивность", en: "Ideal productivity" },
  { ru: "Страх упустить", en: "Fear of missing out" },
  { ru: "Границы и диалог", en: "Boundaries and dialogue" },
  { ru: "Правильный путь", en: "The right path" },
  { ru: "Усталость без причины", en: "Tiredness without a cause" },
  { ru: "От мышления зависит всё", en: "Mindset shapes everything" },
  { ru: "Первое впечатление", en: "First impressions" },
  // 57-67 (new themes)
  { ru: "Любопытство", en: "Curiosity" },
  { ru: "Терпение", en: "Patience" },
  { ru: "Благодарность", en: "Gratitude" },
  { ru: "Прощение", en: "Forgiveness" },
  { ru: "Правда о себе", en: "Truth about yourself" },
  { ru: "Сила одиночества", en: "The power of solitude" },
  { ru: "Память и опыт", en: "Memory and experience" },
  { ru: "Надежда", en: "Hope" },
  { ru: "Мудрость", en: "Wisdom" },
  { ru: "Наследие", en: "Legacy" },
  { ru: "Твой голос", en: "Your voice" },
];

// ── MODULE COLOR PALETTE (cycles for modules 7-67) ────────────────────────────
// Modules 1-6 keep their fixed colors. Modules 7-67 cycle this 12-color palette.
export const COLOR_PALETTE = [
  { color: "#06B6D4", colorDark: "#0891B2" }, // cyan
  { color: "#A855F7", colorDark: "#7E22CE" }, // violet
  { color: "#22C55E", colorDark: "#15803D" }, // green
  { color: "#F97316", colorDark: "#C2410C" }, // orange
  { color: "#0EA5E9", colorDark: "#0369A1" }, // sky
  { color: "#D946EF", colorDark: "#A21CAF" }, // fuchsia
  { color: "#EAB308", colorDark: "#A16207" }, // yellow
  { color: "#4F46E5", colorDark: "#3730A3" }, // red
  { color: "#14B8A6", colorDark: "#0F766E" }, // teal
  { color: "#84CC16", colorDark: "#4D7C0F" }, // lime
  { color: "#F43F5E", colorDark: "#BE123C" }, // rose
  { color: "#6366F1", colorDark: "#4338CA" }, // indigo
];

// ── SHOW TIME GRADIENT/ACCENT (for modules 7-67) ──────────────────────────────
export const SHOWTIME_PALETTE = [
  { gradient: ["#0F172A", "#1E293B", "#0B1220"], accent: "#06B6D4" },
  { gradient: ["#1E1B4B", "#312E81", "#1B1740"], accent: "#A855F7" },
  { gradient: ["#0A1F12", "#0F2E1B", "#06170D"], accent: "#22C55E" },
  { gradient: ["#1F1004", "#2D1809", "#170B03"], accent: "#F97316" },
  { gradient: ["#082F49", "#0C4A6E", "#06243A"], accent: "#0EA5E9" },
  { gradient: ["#2A0A2E", "#420A48", "#1A0620"], accent: "#D946EF" },
  { gradient: ["#1F1503", "#3B2706", "#170F02"], accent: "#EAB308" },
  { gradient: ["#2A0A0A", "#450F0F", "#1A0606"], accent: "#EF4444" },
  { gradient: ["#062E29", "#0A453E", "#04201D"], accent: "#14B8A6" },
  { gradient: ["#1A2305", "#2C3A09", "#0F1503"], accent: "#84CC16" },
  { gradient: ["#2C0813", "#48101F", "#1B050B"], accent: "#F43F5E" },
  { gradient: ["#1A1B47", "#2B2D6E", "#10112E"], accent: "#6366F1" },
];
