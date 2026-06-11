import type { ComponentProps } from "react";
import type { Ionicons } from "@expo/vector-icons";
import type { Lang } from "@/context/LangContext";

export type RankPattern = "sketch" | "pop-art" | "tech-grid" | "art-deco" | "cosmos";
export type StepShape = "circle" | "hexagon" | "rect-glass" | "octagon" | "crystal";
export type IoniconName = ComponentProps<typeof Ionicons>["name"];

export interface RankTopic {
  ru: string;
  en: string;
}

export interface RankTheme {
  index: number;          // 1..5
  fromSection: number;
  toSection: number;
  nameKey: "rank1" | "rank2" | "rank3" | "rank4" | "rank5";
  // Visual identity
  fontFamily: string;
  fontFamilyTitle: string;
  bgColors: readonly [string, string, string];
  accent: string;
  accentDark: string;
  accentSoft: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  borderColor: string;
  cardBg: string;
  stepShape: StepShape;
  pattern: RankPattern;
  isDark: boolean;
  // Portal styling
  portalIcon: IoniconName;
  portalGradient: readonly [string, string];
  portalGlow: string;
  portalLabel: { ru: string; en: string };
  portalCaption: { ru: string; en: string };
  portalShape: "door" | "neon-arch" | "hologram" | "gold-gate" | "star-crown";
  // Content
  jennyTopics: RankTopic[];
  motivationalQuote: { ru: string; en: string };
  motivationalAuthor: { ru: string; en: string };
}

export const RANK_THEMES: RankTheme[] = [
  // 1 — Новичок: cream sketch aesthetic, handwritten font, dotted circles
  {
    index: 1,
    fromSection: 1,
    toSection: 14,
    nameKey: "rank1",
    fontFamily: "Rubik_400Regular",
    fontFamilyTitle: "Rubik_700Bold",
    bgColors: ["#FFF8EC", "#FBEFD7", "#F5E5C0"] as const,
    accent: "#E0A234",
    accentDark: "#A86E14",
    accentSoft: "#FFE7B0",
    textPrimary: "#3D2A0F",
    textSecondary: "#6E5230",
    textMuted: "#8B7350",
    borderColor: "#D9B97A",
    cardBg: "#FFFBF1",
    stepShape: "crystal",
    pattern: "sketch",
    isDark: false,
    portalIcon: "leaf-outline",
    portalGradient: ["#FFE082", "#E0A234"] as const,
    portalGlow: "#E0A234",
    portalLabel: { ru: "Дверь к Любителю", en: "Door to Amateur" },
    portalCaption: { ru: "Следующий ранг", en: "Next rank" },
    portalShape: "door",
    jennyTopics: [
      {
        ru: "Что для тебя «голос» — звук, инструмент или нечто большее?",
        en: "What does «voice» mean to you — a sound, a tool, or something bigger?",
      },
      {
        ru: "Когда тебе впервые захотелось говорить вслух перед людьми?",
        en: "When did you first want to speak out loud in front of people?",
      },
      {
        ru: "Чему тебя научил этот первый ранг?",
        en: "What did this first rank teach you?",
      },
    ],
    motivationalQuote: {
      ru: "«Голос — это самый сильный инструмент, который есть у каждого человека.»",
      en: "«The voice is the most powerful instrument every person owns.»",
    },
    motivationalAuthor: { ru: "Майя Энджелоу", en: "Maya Angelou" },
  },
  // 2 — Любитель: retro notebook, pop-art 80s, hexagons, Fredoka
  {
    index: 2,
    fromSection: 15,
    toSection: 28,
    nameKey: "rank2",
    fontFamily: "Rubik_500Medium",
    fontFamilyTitle: "Rubik_700Bold",
    bgColors: ["#FFF4E6", "#FFE4D6", "#FFD2C2"] as const,
    accent: "#FF5C8A",
    accentDark: "#C03868",
    accentSoft: "#FFD2DD",
    textPrimary: "#2A1B3D",
    textSecondary: "#5C3A6A",
    textMuted: "#7E5A88",
    borderColor: "#FF8AB0",
    cardBg: "#FFFCF6",
    stepShape: "crystal",
    pattern: "pop-art",
    isDark: false,
    portalIcon: "radio-outline",
    portalGradient: ["#FF6FB5", "#7C3AED"] as const,
    portalGlow: "#FF6FB5",
    portalLabel: { ru: "Сцена Уверенного", en: "Confident's Stage" },
    portalCaption: { ru: "Следующий ранг", en: "Next rank" },
    portalShape: "neon-arch",
    jennyTopics: [
      {
        ru: "Что в твоём голосе уже зазвучало по-новому за этот ранг?",
        en: "What has already sounded new in your voice during this rank?",
      },
      {
        ru: "Какой момент здесь был самым ярким и почему?",
        en: "Which moment here felt the most vivid and why?",
      },
      {
        ru: "Кому ты хотел бы рассказать о своём прогрессе?",
        en: "Who would you want to tell about your progress?",
      },
    ],
    motivationalQuote: {
      ru: "«Не бойся ошибиться. Бойся не сказать.»",
      en: "«Don't fear making a mistake. Fear staying silent.»",
    },
    motivationalAuthor: { ru: "Анджела Дакворт", en: "Angela Duckworth" },
  },
  // 3 — Уверенный: dark tech-minimalism, glassmorphism, neon, Space Mono
  {
    index: 3,
    fromSection: 29,
    toSection: 41,
    nameKey: "rank3",
    fontFamily: "Rubik_400Regular",
    fontFamilyTitle: "Rubik_700Bold",
    bgColors: ["#04060B", "#0A0F1C", "#070A14"] as const,
    accent: "#22D3EE",
    accentDark: "#0891B2",
    accentSoft: "rgba(34,211,238,0.18)",
    textPrimary: "#E8F6FF",
    textSecondary: "rgba(232,246,255,0.72)",
    textMuted: "rgba(232,246,255,0.45)",
    borderColor: "rgba(34,211,238,0.35)",
    cardBg: "rgba(255,255,255,0.04)",
    stepShape: "crystal",
    pattern: "tech-grid",
    isDark: true,
    portalIcon: "scan-outline",
    portalGradient: ["#22D3EE", "#7C3AED"] as const,
    portalGlow: "#22D3EE",
    portalLabel: { ru: "Голограмма Мастера", en: "Master Hologram" },
    portalCaption: { ru: "Следующий ранг", en: "Next rank" },
    portalShape: "hologram",
    jennyTopics: [
      {
        ru: "Когда ты говоришь — что для тебя важнее: точность или эмоция?",
        en: "When you speak, what matters more — precision or emotion?",
      },
      {
        ru: "Какие три слова описывают твой стиль речи сейчас?",
        en: "Which three words describe your speech style now?",
      },
      {
        ru: "Что хочешь добавить в свой голос в следующем ранге?",
        en: "What do you want to add to your voice in the next rank?",
      },
    ],
    motivationalQuote: {
      ru: "«Слова — это, конечно, наркотик. Но самый сильный.»",
      en: "«Words are, of course, a drug — but the most powerful one.»",
    },
    motivationalAuthor: { ru: "Редьярд Киплинг", en: "Rudyard Kipling" },
  },
  // 4 — Мастер: dark emerald + gold, art deco, octagons, Playfair
  {
    index: 4,
    fromSection: 42,
    toSection: 54,
    nameKey: "rank4",
    fontFamily: "Rubik_400Regular",
    fontFamilyTitle: "Rubik_700Bold",
    bgColors: ["#06231C", "#0B3329", "#06231C"] as const,
    accent: "#D4A24C",
    accentDark: "#9C7A2C",
    accentSoft: "rgba(212,162,76,0.18)",
    textPrimary: "#F5E9CB",
    textSecondary: "rgba(245,233,203,0.72)",
    textMuted: "rgba(245,233,203,0.45)",
    borderColor: "rgba(212,162,76,0.4)",
    cardBg: "rgba(212,162,76,0.06)",
    stepShape: "crystal",
    pattern: "art-deco",
    isDark: true,
    portalIcon: "trophy-outline",
    portalGradient: ["#F1C672", "#9C7A2C"] as const,
    portalGlow: "#D4A24C",
    portalLabel: { ru: "Золотые врата Профи", en: "Pro's Golden Gate" },
    portalCaption: { ru: "Следующий ранг", en: "Next rank" },
    portalShape: "gold-gate",
    jennyTopics: [
      {
        ru: "Что значит «мастер слова» для тебя?",
        en: "What does «master of words» mean to you?",
      },
      {
        ru: "Какую речь, которую ты однажды услышал, ты не забудешь никогда?",
        en: "Which speech you once heard will you never forget?",
      },
      {
        ru: "Если бы у тебя было ровно одно предложение для всего мира, что бы ты сказал?",
        en: "If you had exactly one sentence for the whole world, what would you say?",
      },
    ],
    motivationalQuote: {
      ru: "«Гений говорит — и эпоха слушает.»",
      en: "«Genius speaks — and the era listens.»",
    },
    motivationalAuthor: { ru: "Уинстон Черчилль", en: "Winston Churchill" },
  },
  // 5 — Профи: cosmos, stars, crystal buttons, Cormorant Garamond
  {
    index: 5,
    fromSection: 55,
    toSection: 67,
    nameKey: "rank5",
    fontFamily: "Rubik_400Regular",
    fontFamilyTitle: "Rubik_700Bold",
    bgColors: ["#040618", "#0A0E2E", "#04061A"] as const,
    accent: "#A78BFA",
    accentDark: "#6D28D9",
    accentSoft: "rgba(167,139,250,0.18)",
    textPrimary: "#F1ECFF",
    textSecondary: "rgba(241,236,255,0.72)",
    textMuted: "rgba(241,236,255,0.45)",
    borderColor: "rgba(167,139,250,0.4)",
    cardBg: "rgba(167,139,250,0.06)",
    stepShape: "crystal",
    pattern: "cosmos",
    isDark: true,
    portalIcon: "star-outline",
    portalGradient: ["#C4B5FD", "#6D28D9"] as const,
    portalGlow: "#A78BFA",
    portalLabel: { ru: "Звезда Легенды", en: "Star of Legend" },
    portalCaption: { ru: "Финал пути", en: "End of the path" },
    portalShape: "star-crown",
    jennyTopics: [
      {
        ru: "Какой след ты хочешь оставить своим голосом?",
        en: "What trace do you want to leave with your voice?",
      },
      {
        ru: "Кому ты больше всего благодарен за свой путь к этому моменту?",
        en: "Who are you most grateful to for your path to this moment?",
      },
      {
        ru: "Что ты теперь знаешь о себе, чего не знал в начале?",
        en: "What do you now know about yourself that you didn't know at the start?",
      },
    ],
    motivationalQuote: {
      ru: "«Тот, у кого есть голос, не имеет права молчать.»",
      en: "«Those who have a voice have no right to stay silent.»",
    },
    motivationalAuthor: { ru: "Эли Визель", en: "Elie Wiesel" },
  },
];

export function getRankTheme(rankIndex: number): RankTheme {
  return RANK_THEMES[Math.max(0, Math.min(4, rankIndex - 1))];
}

// Coaching prompts Jenny can ask when the player has a real, measured
// weakness in a given metric. Each prompt gently invites practice in that
// area — slow tempo gets a story to tell unhurriedly, weak volume gets a
// stage moment, etc. These are layered into `jennyTopics` only when the
// player actually has below-threshold averages for the metric.
export const METRIC_JENNY_QUESTIONS: Record<string, RankTopic> = {
  clarity: {
    ru: "Расскажи историю, в которой важно каждое слово — постарайся не проглатывать окончания.",
    en: "Tell a story where every word matters — try not to swallow the endings.",
  },
  tempo: {
    ru: "Опиши момент, который хочется рассказать неспешно — как будто рядом с другом у костра.",
    en: "Describe a moment you'd want to tell unhurriedly — as if sitting by a campfire with a friend.",
  },
  expressiveness: {
    ru: "Расскажи историю, в которой эмоция должна прозвучать в голосе, а не только в словах.",
    en: "Tell a story where the emotion has to come through your voice, not just the words.",
  },
  confidence: {
    ru: "Расскажи о решении, в котором ты был полностью уверен — пусть это услышится в голосе.",
    en: "Tell about a decision you were completely sure of — let that certainty be heard.",
  },
  volume: {
    ru: "Представь, что говоришь со сцены перед сотней людей — что ты скажешь первым?",
    en: "Imagine you're on stage in front of a hundred people — what's the first thing you'd say?",
  },
  pauses: {
    ru: "Расскажи короткую историю, оставляя место для пауз — где они нужнее всего?",
    en: "Tell a short story, leaving room for pauses — where do they belong most?",
  },
};

// Build the question list Jenny will ask. When the player has measured
// weak metrics for the rank, swap the trailing rank-themed prompts with
// metric-focused coaching prompts (worst-first), keeping the opening
// question intact so the interview still feels grounded in the rank's
// narrative. With no weakness data, returns the original topics unchanged.
export function buildJennyTopics(theme: RankTheme, weakMetrics: string[]): RankTopic[] {
  const base = theme.jennyTopics;
  if (!base.length || !weakMetrics?.length) return base;

  const focused: RankTopic[] = [];
  const seen = new Set<string>();
  for (const m of weakMetrics) {
    const q = METRIC_JENNY_QUESTIONS[m];
    if (!q || seen.has(q.en)) continue;
    focused.push(q);
    seen.add(q.en);
    // Leave at least the opening rank question intact.
    if (focused.length >= base.length - 1) break;
  }
  if (focused.length === 0) return base;

  return [base[0], ...focused, ...base.slice(1 + focused.length)].slice(0, base.length);
}

export function getRankForModule(moduleNum: number): RankTheme {
  for (const r of RANK_THEMES) {
    if (moduleNum >= r.fromSection && moduleNum <= r.toSection) return r;
  }
  return RANK_THEMES[0];
}

export function pickLocalized<T extends { ru: string; en: string }>(o: T, lang: Lang): string {
  return lang === "en" ? o.en : o.ru;
}
