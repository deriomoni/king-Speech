import { Ionicons } from "@expo/vector-icons";

/**
 * «Шпаргалка» (Cheat Sheet) — emergency pre-performance prep content.
 *
 * A fully OFFLINE, static feature: no AI, no scoring, no camera, no recording.
 * The design principle is "not a reference, but a guide": the user is stressed,
 * has little time and attention, so every route is a pre-built sequence that
 * leads them by the hand ("do it with me"), not a menu of 40 exercises.
 *
 * All copy is bilingual (ru primary, en mirror). Use `tx(loc, lang)`.
 */

export type IconName = keyof typeof Ionicons.glyphMap;

export interface Loc {
  ru: string;
  en: string;
}

export function tx(loc: Loc | undefined, lang: string): string {
  if (!loc) return "";
  return lang === "en" ? loc.en : loc.ru;
}

// ── Step kinds ──────────────────────────────────────────────────────────────

export type PhaseType = "inhale" | "hold" | "exhale";
export interface BreathPhase {
  type: PhaseType;
  sec: number;
  label: Loc;
  cue: Loc;
}

export interface BreathingStep {
  kind: "breathing";
  id: string;
  block: BlockKind;
  title: Loc;
  intro: Loc;
  pattern: BreathPhase[];
  cycles: number;
}

/** Guided physical action (grounding, shaking, resonators) — optional timer. */
export interface ActionStep {
  kind: "action";
  id: string;
  block: BlockKind;
  emoji: string;
  title: Loc;
  intro: Loc;
  moves: Loc[];
  seconds?: number;
}

/** Mouth/jaw/tongue warm-up — auto-cycling moves. */
export interface ArticulationStep {
  kind: "articulation";
  id: string;
  block: BlockKind;
  title: Loc;
  intro: Loc;
  moves: { emoji: string; label: Loc; secs: number }[];
}

/** Vocal chant / распевка — syllables highlighted in rhythm. */
export interface ChantStep {
  kind: "chant";
  id: string;
  block: BlockKind;
  title: Loc;
  intro: Loc;
  syllables: string[];
  tempoMs: number;
}

/** Tongue twister with a difficulty marker (1 easy → 4 hellish). */
export interface TwisterStep {
  kind: "twister";
  id: string;
  block: BlockKind;
  title: Loc;
  text: Loc;
  sound: Loc;
  difficulty: 1 | 2 | 3 | 4;
}

/** Short advice ("tip") or emergency micro-fix ("fix") card. */
export interface TipStep {
  kind: "tip";
  id: string;
  block: BlockKind;
  variant: "tip" | "fix";
  icon: IconName;
  title: Loc;
  text: Loc;
}

/** Final anchor screen — posture + one mantra + "Я готов". */
export interface FinalStep {
  kind: "final";
  id: string;
  block: BlockKind;
  title: Loc;
  lines: Loc[];
  mantra: Loc;
}

export type CheatStep =
  | BreathingStep
  | ActionStep
  | ArticulationStep
  | ChantStep
  | TwisterStep
  | TipStep
  | FinalStep;

export type BlockKind = "nerves" | "breath" | "voice" | "twister" | "fix" | "tip" | "final";

export interface BlockMeta {
  icon: IconName;
  title: Loc;
}

export const BLOCK_META: Record<BlockKind, BlockMeta> = {
  nerves: { icon: "heart-outline", title: { ru: "Нервы", en: "Nerves" } },
  breath: { icon: "leaf-outline", title: { ru: "Дыхание", en: "Breathing" } },
  voice: { icon: "musical-notes-outline", title: { ru: "Голос и дикция", en: "Voice & diction" } },
  twister: { icon: "flash-outline", title: { ru: "Скороговорки", en: "Tongue twisters" } },
  fix: { icon: "medkit-outline", title: { ru: "Быстрые фиксы", en: "Quick fixes" } },
  tip: { icon: "bulb-outline", title: { ru: "Советы", en: "Tips" } },
  final: { icon: "sparkles-outline", title: { ru: "Настрой", en: "Mindset" } },
};

// ── Exercise pool ───────────────────────────────────────────────────────────

const physiologicalSigh: BreathingStep = {
  kind: "breathing",
  id: "sigh",
  block: "nerves",
  title: { ru: "Успокоиться за 60 секунд", en: "Calm down in 60 seconds" },
  intro: {
    ru: "Физиологический вздох сбивает тревогу быстрее всего. Дыши вместе с кругом.",
    en: "The physiological sigh calms nerves fastest. Breathe with the circle.",
  },
  cycles: 3,
  pattern: [
    { type: "inhale", sec: 3, label: { ru: "Вдох", en: "Inhale" }, cue: { ru: "Вдох через нос", en: "Inhale through the nose" } },
    { type: "inhale", sec: 1, label: { ru: "Ещё чуть", en: "A bit more" }, cue: { ru: "Доберись носом", en: "Top up through the nose" } },
    { type: "exhale", sec: 6, label: { ru: "Выдох", en: "Exhale" }, cue: { ru: "Долгий выдох ртом", en: "Long exhale through the mouth" } },
  ],
};

const diaphragmatic: BreathingStep = {
  kind: "breathing",
  id: "diaphragm",
  block: "breath",
  title: { ru: "Ровное дыхание", en: "Steady breathing" },
  intro: {
    ru: "Дыши животом, а не плечами. Выдох длиннее вдоха — это успокаивает.",
    en: "Breathe with your belly, not your shoulders. A longer exhale calms you.",
  },
  cycles: 4,
  pattern: [
    { type: "inhale", sec: 4, label: { ru: "Вдох", en: "Inhale" }, cue: { ru: "Вдох носом, живот наружу", en: "Inhale, belly out" } },
    { type: "hold", sec: 2, label: { ru: "Задержка", en: "Hold" }, cue: { ru: "Задержи дыхание", en: "Hold" } },
    { type: "exhale", sec: 6, label: { ru: "Выдох", en: "Exhale" }, cue: { ru: "Медленный выдох ртом", en: "Slow exhale through the mouth" } },
  ],
};

const grounding: ActionStep = {
  kind: "action",
  id: "grounding",
  block: "nerves",
  emoji: "🌿",
  title: { ru: "Заземление 5-4-3-2-1", en: "Grounding 5-4-3-2-1" },
  intro: { ru: "Верни себя в «здесь и сейчас». Про себя назови:", en: "Bring yourself back to the here and now. Silently name:" },
  seconds: 40,
  moves: [
    { ru: "5 вещей, которые видишь", en: "5 things you can see" },
    { ru: "4 звука, которые слышишь", en: "4 sounds you can hear" },
    { ru: "3 ощущения в теле", en: "3 sensations in your body" },
    { ru: "2 запаха вокруг", en: "2 smells around you" },
    { ru: "1 медленный глубокий вдох", en: "1 slow deep breath" },
  ],
};

const shaking: ActionStep = {
  kind: "action",
  id: "shaking",
  block: "nerves",
  emoji: "🙆",
  title: { ru: "Стряхни зажим", en: "Shake off the tension" },
  intro: { ru: "Тело держит стресс. Разомни его — делай за мной:", en: "Your body holds stress. Loosen it — do it with me:" },
  seconds: 20,
  moves: [
    { ru: "Встряхни кисти рук 10 секунд", en: "Shake out your hands for 10 seconds" },
    { ru: "Покрути плечами назад", en: "Roll your shoulders backwards" },
    { ru: "Урони и расслабь челюсть", en: "Drop and relax your jaw" },
  ],
};

const resonators: ActionStep = {
  kind: "action",
  id: "resonators",
  block: "voice",
  emoji: "🎵",
  title: { ru: "Разбуди резонаторы", en: "Wake up your resonators" },
  intro: { ru: "Тихо помычи «ммм» с закрытым ртом. Почувствуй вибрацию:", en: "Hum a soft 'mmm' with your mouth closed. Feel the buzz:" },
  seconds: 20,
  moves: [
    { ru: "Вибрация в губах и носу", en: "Buzz in your lips and nose" },
    { ru: "Опусти звук ниже — в грудь", en: "Lower the tone into your chest" },
    { ru: "Голос звучит теплее и объёмнее", en: "Your voice grows warmer and fuller" },
  ],
};

const articulation: ArticulationStep = {
  kind: "articulation",
  id: "articulation",
  block: "voice",
  title: { ru: "Разомни рот", en: "Warm up your mouth" },
  intro: { ru: "Повторяй за подсказкой — по паре секунд на каждое движение.", en: "Follow the prompt — a couple of seconds each." },
  moves: [
    { emoji: "😗", label: { ru: "Губы: «трубочка» ↔ «улыбка»", en: "Lips: pucker ↔ smile" }, secs: 5 },
    { emoji: "👅", label: { ru: "Язык: круги по губам", en: "Tongue: circle your lips" }, secs: 5 },
    { emoji: "😮", label: { ru: "Челюсть: медленно вниз-вверх", en: "Jaw: slowly down and up" }, secs: 5 },
    { emoji: "😝", label: { ru: "«Пофыркай» губами: бррр", en: "Lip trill: brrr" }, secs: 5 },
  ],
};

const chant: ChantStep = {
  kind: "chant",
  id: "chant-ma",
  block: "voice",
  title: { ru: "Распевка", en: "Vocal warm-up" },
  intro: { ru: "Тяни каждый слог, будто поёшь. Веди голос за подсветкой.", en: "Draw out each syllable like a song. Follow the highlight." },
  syllables: ["МА", "МЭ", "МИ", "МО", "МУ"],
  tempoMs: 620,
};

// Tongue twisters, grouped conceptually by target sound, with difficulty 1..4.
const twSasha: TwisterStep = {
  kind: "twister",
  id: "tw-sasha",
  block: "twister",
  title: { ru: "Шипящие", en: "Hissing sounds" },
  sound: { ru: "Ш · С", en: "SH · S" },
  difficulty: 1,
  text: { ru: "Шла Саша по шоссе и сосала сушку.", en: "Shla Sasha po shosse i sosala sushku." },
};

const twTrava: TwisterStep = {
  kind: "twister",
  id: "tw-trava",
  block: "twister",
  title: { ru: "Звук «Р»", en: "The 'R' sound" },
  sound: { ru: "Р · В", en: "R · V" },
  difficulty: 2,
  text: { ru: "На дворе трава, на траве дрова.", en: "Na dvore trava, na trave drova." },
};

const twKopyt: TwisterStep = {
  kind: "twister",
  id: "tw-kopyt",
  block: "twister",
  title: { ru: "Взрывные «п/т/к»", en: "Plosives 'p/t/k'" },
  sound: { ru: "П · Т · К", en: "P · T · K" },
  difficulty: 3,
  text: { ru: "От топота копыт пыль по полю летит.", en: "Ot topota kopyt pyl po polyu letit." },
};

const twKolpak: TwisterStep = {
  kind: "twister",
  id: "tw-kolpak",
  block: "twister",
  title: { ru: "Адская", en: "Hellish" },
  sound: { ru: "К · Л · П", en: "K · L · P" },
  difficulty: 4,
  text: {
    ru: "Колпак под колпаком, а под колпаком колпак.",
    en: "Kolpak pod kolpakom, a pod kolpakom kolpak.",
  },
};

// Tips (советы)
const tipExcitement: TipStep = {
  kind: "tip", id: "tip-excite", block: "tip", variant: "tip", icon: "flash-outline",
  title: { ru: "Волнение — это топливo", en: "Nerves are fuel" },
  text: { ru: "Не гаси волнение — направь его в первую фразу. Это энергия, а не враг.", en: "Don't fight the nerves — pour them into your opening line. It's energy, not an enemy." },
};
const tipTempo: TipStep = {
  kind: "tip", id: "tip-tempo", block: "tip", variant: "tip", icon: "speedometer-outline",
  title: { ru: "Чуть медленнее", en: "A touch slower" },
  text: { ru: "Говори чуть медленнее, чем хочется. Спешка читается как волнение.", en: "Speak a little slower than feels natural. Rushing reads as anxiety." },
};
const tipPauses: TipStep = {
  kind: "tip", id: "tip-pauses", block: "tip", variant: "tip", icon: "pause-outline",
  title: { ru: "Пауза весит больше", en: "A pause carries weight" },
  text: { ru: "Пауза после важной мысли действует сильнее, чем громкость.", en: "A pause after a key point lands harder than volume ever will." },
};
const tipEyes: TipStep = {
  kind: "tip", id: "tip-eyes", block: "tip", variant: "tip", icon: "eye-outline",
  title: { ru: "Найди дружелюбные глаза", en: "Find friendly eyes" },
  text: { ru: "Выбери 2–3 доброжелательных лица и говори им, а не в пустоту.", en: "Pick 2–3 friendly faces and talk to them, not to the void." },
};
const tipPosture: TipStep = {
  kind: "tip", id: "tip-posture", block: "tip", variant: "tip", icon: "body-outline",
  title: { ru: "Тело спокойно — голос спокоен", en: "Calm body, calm voice" },
  text: { ru: "Встань устойчиво, вес на обе ноги, плечи вниз. Опора даёт уверенный звук.", en: "Stand grounded, weight on both feet, shoulders down. Stability steadies your voice." },
};

// Quick fixes (быстрые фиксы — аварии перед выходом)
const fixVoice: TipStep = {
  kind: "tip", id: "fix-voice", block: "fix", variant: "fix", icon: "mic-outline",
  title: { ru: "Севший голос", en: "Voice cracked" },
  text: { ru: "Тихо помычи «ммм» и сделай пару спокойных зевков — связки мягко проснутся.", en: "Hum a soft 'mmm' and take a couple of calm yawns — your cords wake up gently." },
};
const fixDry: TipStep = {
  kind: "tip", id: "fix-dry", block: "fix", variant: "fix", icon: "water-outline",
  title: { ru: "Сухость во рту", en: "Dry mouth" },
  text: { ru: "Слегка прикуси кончик языка — вернётся слюна. Пей только тёплую воду, не ледяную.", en: "Lightly bite the tip of your tongue — saliva returns. Drink warm water only, never ice-cold." },
};
const fixWarm: TipStep = {
  kind: "tip", id: "fix-warm", block: "fix", variant: "fix", icon: "flame-outline",
  title: { ru: "Согреть связки", en: "Warm the cords" },
  text: { ru: "Подыши на ладони тёплым воздухом, будто греешь их — то же тепло уйдёт в связки.", en: "Breathe warm air onto your palms as if warming them — that warmth reaches your cords." },
};

const finalStep: FinalStep = {
  kind: "final",
  id: "final",
  block: "final",
  title: { ru: "Ты готов", en: "You're ready" },
  lines: [
    { ru: "Плечи вниз, макушка вверх.", en: "Shoulders down, crown up." },
    { ru: "Один спокойный вдох.", en: "One calm breath." },
    { ru: "Первую фразу — уверенно и не спеша.", en: "Deliver your first line with calm confidence." },
  ],
  mantra: { ru: "Мне есть что сказать — и я скажу это спокойно.", en: "I have something to say — and I'll say it calmly." },
};

// ── Routes ──────────────────────────────────────────────────────────────────

export interface CheatRoute {
  id: "quick" | "balanced" | "full";
  minutes: number;
  accent: string;
  icon: IconName;
  title: Loc;
  subtitle: Loc;
  steps: CheatStep[];
}

export const ROUTES: CheatRoute[] = [
  {
    id: "quick",
    minutes: 2,
    accent: "#FFCF34",
    icon: "flash",
    title: { ru: "2 минуты", en: "2 minutes" },
    subtitle: { ru: "Экстренно, перед самым выходом", en: "Emergency, right before you go on" },
    steps: [physiologicalSigh, tipExcitement, chant, fixVoice, twSasha, finalStep],
  },
  {
    id: "balanced",
    minutes: 5,
    accent: "#9468FB",
    icon: "pulse",
    title: { ru: "5 минут", en: "5 minutes" },
    subtitle: { ru: "Сбалансированная разминка", en: "A balanced warm-up" },
    steps: [
      physiologicalSigh, tipExcitement,
      diaphragmatic, tipTempo,
      articulation, tipPauses,
      chant, fixVoice,
      twTrava, finalStep,
    ],
  },
  {
    id: "full",
    minutes: 10,
    accent: "#4FD9A0",
    icon: "shield-checkmark",
    title: { ru: "10 минут", en: "10 minutes" },
    subtitle: { ru: "Полная подготовка заранее", en: "Full prep, ahead of time" },
    steps: [
      physiologicalSigh, tipExcitement,
      grounding, fixWarm,
      shaking, tipPosture,
      diaphragmatic, tipTempo,
      articulation, tipPauses,
      resonators, fixDry,
      chant, tipEyes,
      twKopyt, fixVoice,
      twKolpak, finalStep,
    ],
  },
];

// ── Full reference (Полная версия) ──────────────────────────────────────────
// A flat, grouped catalogue of every distinct exercise/tip for calm browsing.

export interface RefSection {
  block: BlockKind;
  steps: CheatStep[];
}

export const REFERENCE: RefSection[] = [
  { block: "nerves", steps: [physiologicalSigh, grounding, shaking] },
  { block: "breath", steps: [diaphragmatic] },
  { block: "voice", steps: [articulation, chant, resonators] },
  { block: "twister", steps: [twSasha, twTrava, twKopyt, twKolpak] },
  { block: "fix", steps: [fixVoice, fixDry, fixWarm] },
  { block: "tip", steps: [tipExcitement, tipTempo, tipPauses, tipEyes, tipPosture] },
  { block: "final", steps: [finalStep] },
];

export const DIFFICULTY_LABEL: Record<1 | 2 | 3 | 4, Loc> = {
  1: { ru: "Лёгкая", en: "Easy" },
  2: { ru: "Средняя", en: "Medium" },
  3: { ru: "Сложная", en: "Hard" },
  4: { ru: "Адская", en: "Hellish" },
};
