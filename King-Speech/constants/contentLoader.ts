import type { Lang } from "@/context/LangContext";
import type { TaskData } from "@/constants/gameContent";

import warmupData from "@/assets/content/king_speech_warmup_content.json";

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

export function getNormalizedWarmup(moduleId: number): NormalizedWarmup | null {
  const mod = getWarmup(moduleId);
  return mod ? normalizeWarmupModule(mod) : null;
}

/** Two synthetic tasks for GameContext progress tracking. */
export function getWarmupTasksForLevel(moduleId: number, lang: Lang): TaskData[] {
  const mod = getWarmup(moduleId);
  if (!mod) {
    return [
      {
        taskNumber: 1,
        title: lang === "ru" ? "Распевка" : "Vocal warm-up",
        instruction: "",
        content: "",
        tips: [],
      },
      {
        taskNumber: 2,
        title: lang === "ru" ? "Разминка рта" : "Mouth exercise",
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
      title: lang === "ru" ? `Распевка: ${norm.sound}` : `Chant: ${norm.sound}`,
      instruction:
        lang === "ru"
          ? `Спой слоги по нотам. Темп: ${norm.tempo}.`
          : `Sing syllables along the notes. Tempo: ${norm.tempo}.`,
      content: norm.syllables.join(" · "),
      tips:
        lang === "ru"
          ? ["Дыши спокойно", "Следи за высотой тона", norm.tempo]
          : ["Breathe calmly", "Follow the pitch", norm.tempo],
    },
    {
      taskNumber: 2,
      title: mouth.name,
      instruction: mouth.instruction,
      content: mouth.gesture,
      tips: lang === "ru" ? [mouth.gesture] : [mouth.gesture],
    },
  ];
}
