import { pickLang, type Lang } from "@/context/LangContext";
import type { TaskData } from "@/constants/gameContent";

import warmupData from "@/assets/content/king_speech_warmup_content.json";
import interviewData from "@/assets/content/king_speech_interview_content.json";
import warmupKkData from "@/assets/content/kk/warmup_kk.json";
import warmupEnData from "@/assets/content/en/warmup_en.json";

export interface WarmupChant {
  sound: string;
  row: string[];
  notes: string[];
  noteOffsets: number[];
  syllables: string[];
  repeats: number;
  tempo: string;
}

export interface WarmupMouth {
  name: string;
  instruction: string;
  durationSec: number;
  gesture: string;
  /** Guided step prompts shown one-by-one with a short timer each (optional). */
  steps?: string[];
  /** Seconds per step (default 2). */
  stepSec?: number;
  /** How many times to repeat the step list (default 2). */
  rounds?: number;
}

export interface WarmupModule {
  module: number;
  title: string;
  rank: number;
  task1_chant: WarmupChant;
  task2_mouth: WarmupMouth;
}

/** Normalized module ready for pitch game runtime. */
export interface NormalizedWarmup {
  module: number;
  title: string;
  rank: 1 | 2 | 3 | 4 | 5;
  sound: string;
  syllables: string[];
  notes: string[];
  noteOffsetsNormalized: number[];
  noteDurationsSec: number[];
  repeatsEffective: number;
  totalDurationSec: number;
  tempo: string;
  task2_mouth: WarmupMouth;
}

const WARMUP = warmupData as WarmupModule[];
const MIN_TASK1_SEC = 120;

const SEC_PER_NOTE_BY_RANK: Record<number, number> = {
  1: 1.45,
  2: 1.25,
  3: 1.1,
  4: 1.0,
  5: 0.92,
};

const TOLERANCE_CENTS_BY_RANK: Record<number, number> = {
  1: 150,
  2: 120,
  3: 90,
  4: 60,
  5: 40,
};

/** warmup → 1, warmup17 → 17 */
export function getModuleFromLevelId(levelId: string): number {
  const base = levelId.replace(/\d+$/, "");
  if (base !== "warmup") return 1;
  const suffix = levelId.slice("warmup".length);
  return suffix ? parseInt(suffix, 10) : 1;
}

export function getWarmup(moduleId: number): WarmupModule | null {
  return WARMUP.find((m) => m.module === moduleId) ?? null;
}

export function getPitchToleranceCents(rank: number): number {
  return TOLERANCE_CENTS_BY_RANK[rank] ?? 150;
}

export function normalizeWarmupModule(mod: WarmupModule): NormalizedWarmup {
  const chant = mod.task1_chant;
  const rank = Math.min(5, Math.max(1, mod.rank)) as 1 | 2 | 3 | 4 | 5;
  const offsets = chant.noteOffsets;
  const minO = Math.min(...offsets);
  const maxO = Math.max(...offsets);
  const span = Math.max(maxO - minO, 1);
  const noteOffsetsNormalized = offsets.map((o) => (o - minO) / span);

  const baseSec = SEC_PER_NOTE_BY_RANK[rank] ?? 1.2;
  const noteDurationsSec = offsets.map((o, i) => {
    const next = offsets[i + 1];
    const hold = next === undefined ? true : next === o;
    const prevSame = i > 0 && offsets[i - 1] === o;
    if (hold || prevSame) return baseSec * 1.35;
    return baseSec;
  });

  const passSec = noteDurationsSec.reduce((a, b) => a + b, 0);
  const repeatsEffective = Math.max(
    chant.repeats,
    Math.ceil(MIN_TASK1_SEC / Math.max(passSec, 1)),
  );
  const totalDurationSec = passSec * repeatsEffective;

  return {
    module: mod.module,
    title: mod.title,
    rank,
    sound: chant.sound,
    syllables: chant.syllables,
    notes: chant.notes,
    noteOffsetsNormalized,
    noteDurationsSec,
    repeatsEffective,
    totalDurationSec,
    tempo: chant.tempo,
    task2_mouth: mod.task2_mouth,
  };
}

interface WarmupKk {
  module: number;
  title: string;
  tempo: string;
  mouth: { name: string; instruction: string; gesture: string; steps?: string[] };
}
const WARMUP_KK = new Map<number, WarmupKk>(
  (warmupKkData as WarmupKk[]).map((m) => [m.module, m]),
);
const WARMUP_EN = new Map<number, WarmupKk>(
  (warmupEnData as WarmupKk[]).map((m) => [m.module, m]),
);

// English chant labels: the syllables and solfège in Latin letters. Applied to
// the normalized module (after the pitch offsets were computed from the
// Russian note names), so only what's displayed changes.
const LAT: Record<string, string> = {
  а: "a", э: "e", и: "i", о: "o", у: "u", м: "m", н: "n", л: "l", д: "d", р: "r",
  в: "v", б: "b", г: "g", з: "z", к: "k", т: "t", ф: "f", с: "s", ь: "", я: "ya", е: "e",
};
const SOLFEGE_EN: Record<string, string> = { до: "do", ре: "re", ми: "mi", фа: "fa", соль: "sol", ля: "la", си: "ti" };
function latinSyllable(s: string): string {
  const out = [...s.toLowerCase()].map((ch) => LAT[ch] ?? ch).join("");
  return s[0] && s[0] !== s[0].toLowerCase() ? out.charAt(0).toUpperCase() + out.slice(1) : out;
}
function latinNote(n: string): string {
  const m = /^([а-яё]+)(\d*)$/i.exec(n.trim());
  if (!m) return n;
  return (SOLFEGE_EN[m[1].toLowerCase()] ?? latinSyllable(m[1])) + m[2];
}

/**
 * Warm-up module with its texts localized. Kazakh and English replace the
 * title, tempo and mouth-exercise texts (falling back to RU per field when a
 * translation is missing); English chant labels are latinized in
 * getNormalizedWarmup.
 */
export function getLocalizedWarmup(moduleId: number, lang: Lang = "ru"): WarmupModule | null {
  const mod = getWarmup(moduleId);
  if (!mod || lang === "ru") return mod;
  const kk = (lang === "en" ? WARMUP_EN : WARMUP_KK).get(moduleId);
  if (!kk) return mod;
  return {
    ...mod,
    title: kk.title || mod.title,
    task1_chant: { ...mod.task1_chant, tempo: kk.tempo || mod.task1_chant.tempo },
    task2_mouth: {
      ...mod.task2_mouth,
      name: kk.mouth?.name || mod.task2_mouth.name,
      instruction: kk.mouth?.instruction || mod.task2_mouth.instruction,
      gesture: kk.mouth?.gesture || mod.task2_mouth.gesture,
      steps:
        kk.mouth?.steps && mod.task2_mouth.steps && kk.mouth.steps.length === mod.task2_mouth.steps.length
          ? kk.mouth.steps
          : mod.task2_mouth.steps,
    },
  };
}

export function getNormalizedWarmup(moduleId: number, lang: Lang = "ru"): NormalizedWarmup | null {
  const mod = getLocalizedWarmup(moduleId, lang);
  if (!mod) return null;
  const norm = normalizeWarmupModule(mod);
  if (lang !== "en") return norm;
  return {
    ...norm,
    sound: norm.sound ? latinSyllable(norm.sound).toUpperCase() : norm.sound,
    syllables: norm.syllables.map(latinSyllable),
    notes: norm.notes.map(latinNote),
  };
}

// ===================== Interview ("Путь") =====================
// Light, theme-bound interview questions live in the content pipeline (one
// entry per module). Each module holds 3 task slots × 3 interchangeable
// variants = 9 questions. The level shows the first variant of each slot; the
// remaining variants back the future "replace question" button (task 1.11).

export interface InterviewModuleContent {
  module: number;
  theme: string;
  theme_en: string;
  /** 3 task slots, each with 3 variant questions (RU). */
  q: string[][];
  /** 3 task slots, each with 3 variant questions (EN). */
  q_en: string[][];
  theme_kk?: string;
  /** 3 task slots, each with 3 variant questions (KK). */
  q_kk?: string[][];
}

function interviewSlots(mod: InterviewModuleContent, lang: Lang): string[][] {
  if (lang === "en") return mod.q_en;
  if (lang === "kk" && mod.q_kk && mod.q_kk.length) return mod.q_kk;
  return mod.q;
}

const INTERVIEW = interviewData as InterviewModuleContent[];

// Generic, reusable framing for interview tasks (title/instruction/tips) by
// task position, so the JSON only carries the questions themselves. Kept light
// and supportive to match the new tone.
const INTERVIEW_TASK_META: Record<Lang, { title: string; instruction: string; tips: string[] }[]> = {
  ru: [
    { title: "Лёгкий вопрос", instruction: "Ответь голосом — спокойно, как другу. 30–60 секунд.", tips: ["Не торопись", "Говори своими словами", "Здесь нет неправильных ответов"] },
    { title: "Расскажи историю", instruction: "Поделись маленькой историей из жизни. Можно с примером.", tips: ["Добавь деталь или эмоцию", "Говори искренне", "Не бойся пауз"] },
    { title: "Твоё мнение", instruction: "Скажи, что думаешь — своими словами, без правильных ответов.", tips: ["Будь собой", "Поясни почему", "Заверши спокойно"] },
  ],
  en: [
    { title: "Easy question", instruction: "Answer with your voice — calmly, like to a friend. 30–60 seconds.", tips: ["Take your time", "Use your own words", "There are no wrong answers here"] },
    { title: "Tell a story", instruction: "Share a small story from your life. An example is welcome.", tips: ["Add a detail or emotion", "Speak sincerely", "Don't fear pauses"] },
    { title: "Your opinion", instruction: "Say what you think — in your own words, no right answers.", tips: ["Be yourself", "Explain why", "Finish calmly"] },
  ],
  kk: [
    { title: "Жеңіл сұрақ", instruction: "Дауыспен жауап беріңіз — досыңызбен сөйлескендей, сабырлы. 30–60 секунд.", tips: ["Асықпаңыз", "Өз сөзіңізбен айтыңыз", "Мұнда қате жауап жоқ"] },
    { title: "Оқиға айтып беріңіз", instruction: "Өміріңізден шағын бір оқиғамен бөлісіңіз. Мысал келтірсеңіз болады.", tips: ["Бір деталь не сезім қосыңыз", "Шын жүректен сөйлеңіз", "Үзілістен қорықпаңыз"] },
    { title: "Сіздің пікіріңіз", instruction: "Не ойлайтыныңызды өз сөзіңізбен айтыңыз — дұрыс жауап деген жоқ.", tips: ["Өзіңіз болыңыз", "Неге екенін түсіндіріңіз", "Сабырмен аяқтаңыз"] },
  ],
};

/** interview → 1, interview2 → 2; 0 when the id isn't an interview level. */
export function getInterviewModuleFromLevelId(levelId: string): number {
  const base = levelId.replace(/\d+$/, "");
  if (base !== "interview") return 0;
  const suffix = levelId.slice("interview".length);
  return suffix ? parseInt(suffix, 10) : 1;
}

export function getInterviewModuleContent(moduleId: number): InterviewModuleContent | null {
  return INTERVIEW.find((m) => m.module === moduleId) ?? null;
}

/**
 * Three light, theme-bound interview tasks for a Path level (first variant of
 * each slot). Returns null when the id isn't an interview level or no content
 * exists for the module, so the caller can fall back to legacy tasks.
 */
export function getInterviewTasksForLevel(levelId: string, lang: Lang): TaskData[] | null {
  const moduleId = getInterviewModuleFromLevelId(levelId);
  if (moduleId <= 0) return null;
  const mod = getInterviewModuleContent(moduleId);
  if (!mod) return null;
  const slots = interviewSlots(mod, lang);
  const meta = INTERVIEW_TASK_META[lang];
  return slots.slice(0, 3).map((variants, i) => ({
    taskNumber: i + 1,
    title: meta[i]?.title ?? pickLang(lang, { ru: "Вопрос", en: "Question", kk: "Сұрақ" }),
    instruction: meta[i]?.instruction ?? "",
    content: variants[0] ?? "",
    tips: meta[i]?.tips ?? [],
  }));
}

/**
 * All 3 variant questions for each of the 3 interview task slots, ready for the
 * future "replace question" button (task 1.11). null when not applicable.
 */
export function getInterviewVariantsForLevel(levelId: string, lang: Lang): string[][] | null {
  const moduleId = getInterviewModuleFromLevelId(levelId);
  if (moduleId <= 0) return null;
  const mod = getInterviewModuleContent(moduleId);
  if (!mod) return null;
  return interviewSlots(mod, lang).map((variants) => variants.slice());
}

/** Two synthetic tasks for GameContext progress tracking. */
export function getWarmupTasksForLevel(moduleId: number, lang: Lang): TaskData[] {
  const mod = getLocalizedWarmup(moduleId, lang);
  if (!mod) {
    return [
      {
        taskNumber: 1,
        title: pickLang(lang, { ru: "Распевка", en: "Vocal warm-up", kk: "Дауыс жаттығуы" }),
        instruction: "",
        content: "",
        tips: [],
      },
      {
        taskNumber: 2,
        title: pickLang(lang, { ru: "Разминка рта", en: "Mouth exercise", kk: "Ауыз жаттығуы" }),
        instruction: "",
        content: "",
        tips: [],
      },
    ];
  }
  const norm = normalizeWarmupModule(mod);
  const mouth = mod.task2_mouth;
  return [
    {
      taskNumber: 1,
      title: pickLang(lang, { ru: `Распевка: ${norm.sound}`, en: `Chant: ${norm.sound}`, kk: `Дауыс жаттығуы: ${norm.sound}` }),
      instruction: pickLang(lang, {
        ru: `Спой слоги по нотам. Темп: ${norm.tempo}.`,
        en: `Sing syllables along the notes. Tempo: ${norm.tempo}.`,
        kk: `Буындарды ноталар бойынша айтып шығыңыз. Қарқын: ${norm.tempo}.`,
      }),
      content: norm.syllables.join(" · "),
      tips: pickLang(lang, {
        ru: ["Дыши спокойно", "Следи за высотой тона", norm.tempo],
        en: ["Breathe calmly", "Follow the pitch", norm.tempo],
        kk: ["Сабырлы дем алыңыз", "Дауыс биіктігін қадағалаңыз", norm.tempo],
      }),
    },
    {
      taskNumber: 2,
      title: mouth.name,
      instruction: mouth.instruction,
      content: mouth.gesture,
      tips: [mouth.gesture],
    },
  ];
}
