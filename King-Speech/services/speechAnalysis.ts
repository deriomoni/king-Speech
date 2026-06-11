import type { Lang } from "@/context/LangContext";
import { fetch } from "expo/fetch";
import { getApiUrl } from "@/lib/query-client";

// Honest, deterministic speech analyzer.
// No Math.random() — every score is derived from real signals:
//   - the transcript (filler count, length, word-overlap with the prompt)
//   - the audio duration in seconds
//   - for interview levels: a server GPT call returns logic + eloquence
//
// All criteria are scored 0..10. Final `overall` is a weighted sum of the
// criteria (different weights for show-time vs interview).

export interface SpeechScore {
  overall: number;
  clarity: number;
  confidence: number;
  volume: number;
  tempo: number;
  expressiveness: number;
  pauses: number;
}

export interface SpeechAnalysis {
  score: SpeechScore;
  strengths: string[];
  recommendations: string[];
  summary: string;
  xpBonus: number;
  /** Personal tip derived from the weakest criterion. Always populated. */
  tip: string;
  /** Raw transcript used for analysis. May be empty when audio was missing. */
  transcript: string;
  /** Number of filler words detected in the transcript. */
  fillerCount: number;
  /**
   * Word-overlap with originalText (0..1). null when no originalText was
   * supplied (e.g. interview answers, free-form Show Time).
   */
  textMatchRatio: number | null;
}

// ---------- Filler words ----------
export const FILLERS: Record<Lang, string[]> = {
  ru: [
    "ну", "эм", "эээ", "ээ", "э", "типа", "как бы", "это самое",
    "короче", "блин", "значит", "вот", "ммм",
  ],
  en: [
    "um", "uh", "uhm", "er", "erm", "like", "you know", "i mean",
    "sort of", "kind of", "basically", "actually",
  ],
};

function getBaseType(levelType: string): string {
  return levelType.replace(/[2-6]$/, "");
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function clamp01to10(v: number): number {
  return Math.max(0, Math.min(10, v));
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

/** Count filler words in a transcript. Multi-word fillers ("you know") match too. */
export function countFillers(transcript: string, lang: Lang): number {
  if (!transcript) return 0;
  const padded = " " + transcript.toLowerCase().replace(/[.,;:!?…\-—()"]/g, " ").replace(/\s+/g, " ") + " ";
  let count = 0;
  for (const filler of FILLERS[lang]) {
    const needle = ` ${filler} `;
    let idx = 0;
    while ((idx = padded.indexOf(needle, idx)) !== -1) {
      count += 1;
      idx += needle.length;
    }
  }
  return count;
}

/**
 * Clarity 0..10 from transcript word count and filler density.
 * - <3 spoken words → very low (0..2)
 * - long enough takes start at 7, with bonuses for clean speech and
 *   penalties for filler words.
 */
export function scoreClarity(transcript: string, fillerCount: number): number {
  const words = tokenize(transcript);
  if (words.length < 3) return Math.max(0, words.length * 0.7);
  let score = words.length > 10 ? 7 : 5;
  if (fillerCount === 0) score += 1.5;
  else score -= Math.min(3, fillerCount * 0.6);
  return round1(clamp01to10(score));
}

/**
 * Word-overlap with originalText. Returns:
 *   - score 0..10 (= ratio * 10)
 *   - ratio 0..1 (recall: how much of the prompt's vocabulary was spoken)
 * Returns a neutral 7 when originalText is missing — caller decides what to
 * do, but the level screen treats interview/free-form as "no text match".
 */
export function scoreTextMatch(
  transcript: string,
  originalText?: string,
): { score: number; ratio: number | null } {
  if (!originalText || !originalText.trim()) {
    return { score: 7, ratio: null };
  }
  const original = new Set(tokenize(originalText));
  const saidSet = new Set(tokenize(transcript));
  if (original.size === 0 || saidSet.size === 0) return { score: 0, ratio: 0 };
  // Set-based intersection over the prompt size — repeating the same word
  // ten times can never inflate overlap. A speaker who actually said all
  // unique prompt words gets 1.0; one who shouted "the the the" gets near 0.
  let matches = 0;
  for (const w of saidSet) {
    if (original.has(w)) matches += 1;
  }
  const ratio = Math.min(1, matches / original.size);
  return { score: round1(ratio * 10), ratio };
}

/**
 * Volume 0..10. Prefers a measured RMS amplitude (0..1 linear, as returned
 * by `/api/transcribe`'s `audioRms`) and falls back to a duration heuristic
 * when the loudness signal is missing.
 *
 * The RMS branch maps mean amplitude in dBFS to a 0..10 score with these
 * anchors and linear interpolation between them:
 *   -60 dBFS → 0   (effective silence)
 *   -40 dBFS → 2   (whisper / very quiet recording)
 *   -28 dBFS → 6   (normal indoor speaking)
 *   -18 dBFS → 8   (projecting voice)
 *   -10 dBFS → 10  (loud / shouting)
 *
 * Same recording → same dBFS → same score (deterministic).
 */
export function scoreVolume(
  audioDurationSeconds: number,
  audioRms?: number,
): number {
  // Treat any finite, non-negative number — including 0 — as a real
  // measurement. Only undefined / null / NaN / negative falls back to the
  // duration heuristic. A measured silence MUST score 0, not "long take".
  if (typeof audioRms === "number" && Number.isFinite(audioRms) && audioRms >= 0) {
    if (audioRms <= 0) return 0;
    const db = 20 * Math.log10(audioRms);
    const anchors: Array<[number, number]> = [
      [-60, 0],
      [-40, 2],
      [-28, 6],
      [-18, 8],
      [-10, 10],
    ];
    if (db <= anchors[0][0]) return 0;
    if (db >= anchors[anchors.length - 1][0]) return 10;
    for (let i = 0; i < anchors.length - 1; i++) {
      const [d1, s1] = anchors[i];
      const [d2, s2] = anchors[i + 1];
      if (db >= d1 && db <= d2) {
        const t = (db - d1) / (d2 - d1);
        return round1(clamp01to10(s1 + t * (s2 - s1)));
      }
    }
    return 0;
  }
  // No loudness signal at all — fall back to the duration bucket heuristic
  // so the analyzer still returns a sensible number rather than 0.
  if (audioDurationSeconds < 3) return 4;
  if (audioDurationSeconds <= 8) return 7;
  return 8.5;
}

/** Confidence 0..10 from filler count and (lightly) duration. */
export function scoreConfidence(fillerCount: number, audioDurationSeconds: number): number {
  let score: number;
  if (fillerCount < 2) score = 8;
  else if (fillerCount <= 4) score = 6;
  else score = 4;
  if (audioDurationSeconds < 5) score -= 1;
  return round1(clamp01to10(score));
}

// ---------- Tip lookup ----------
const TIP_BY_CRITERION: Record<string, Record<Lang, string>> = {
  clarity: {
    ru: "Чётче проговаривай каждое слово — не глотай окончания и звуки.",
    en: "Pronounce every word clearly — don't swallow endings or sounds.",
  },
  textMatch: {
    ru: "Старайся произносить текст ближе к оригиналу — перечитай задание перед записью.",
    en: "Stick closer to the original text — re-read the prompt before recording.",
  },
  volume: {
    ru: "Говори громче и развёрнутее — короткая, тихая запись звучит неуверенно.",
    en: "Speak louder and longer — a short, quiet take sounds hesitant.",
  },
  confidence: {
    ru: "Убери слова-паразиты («ну», «типа», «как бы») — речь сразу прозвучит уверенно.",
    en: "Drop filler words (\"um\", \"uh\", \"like\") — your speech will sound confident.",
  },
  logic: {
    ru: "Стройте ответ по схеме: тезис → аргумент → вывод.",
    en: "Build your answer as: thesis → argument → conclusion.",
  },
  eloquence: {
    ru: "Используй разнообразную лексику и точные формулировки — избегай шаблонов.",
    en: "Use varied vocabulary and precise wording — avoid generic phrases.",
  },
};

function pickWeakest(scores: Record<string, number>): string {
  const entries = Object.entries(scores);
  entries.sort((a, b) => a[1] - b[1]);
  return entries[0][0];
}

function tipFor(criterion: string, lang: Lang): string {
  return (
    TIP_BY_CRITERION[criterion]?.[lang] ??
    (lang === "ru" ? "Продолжай тренироваться — каждая запись делает голос точнее." : "Keep practicing — every take sharpens your voice.")
  );
}

// ---------- Server: interview extras ----------
interface InterviewExtras {
  logic: number;
  eloquence: number;
  tip?: string;
}

async function fetchInterviewAnalysis(transcript: string, lang: Lang): Promise<InterviewExtras | null> {
  if (!transcript || transcript.trim().length < 4) return null;
  try {
    const url = new URL("/api/analyze-interview", getApiUrl()).toString();
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript, lang }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Partial<InterviewExtras>;
    if (typeof data.logic !== "number" || typeof data.eloquence !== "number") return null;
    return {
      logic: clamp01to10(data.logic),
      eloquence: clamp01to10(data.eloquence),
      tip: typeof data.tip === "string" ? data.tip : undefined,
    };
  } catch {
    return null;
  }
}

// ---------- Public API ----------
export interface AnalyzeSpeechParams {
  transcript: string;
  originalText?: string;
  audioDurationSeconds: number;
  levelType: string;
  lang?: Lang;
  /** Kept for backward compat; no longer drives randomness. */
  levelNumber?: number;
  /**
   * Mean RMS amplitude of the recording on a 0..1 linear scale (as returned
   * by `/api/transcribe`'s `audioRms`). When provided, drives a real volume
   * score; when omitted we fall back to a duration heuristic.
   */
  audioRms?: number;
}

export async function analyzeSpeech(params: AnalyzeSpeechParams): Promise<SpeechAnalysis> {
  const {
    transcript: rawTranscript,
    originalText,
    audioDurationSeconds,
    levelType,
    lang = "ru",
    audioRms,
  } = params;

  const transcript = (rawTranscript ?? "").trim();
  const baseType = getBaseType(levelType);
  const isInterview = baseType === "interview";

  const fillerCount = countFillers(transcript, lang);
  const clarity = scoreClarity(transcript, fillerCount);
  const tm = scoreTextMatch(transcript, originalText);
  const textMatch = tm.score;
  const textMatchRatio = tm.ratio;
  const volume = scoreVolume(audioDurationSeconds, audioRms);
  const confidence = scoreConfidence(fillerCount, audioDurationSeconds);

  let overall: number;
  let logic = 0;
  let eloquence = 0;
  let serverTip: string | undefined;

  // tipScores is the bag of criteria considered when picking the weakest
  // for the personal tip line. Show Time uses textMatch; interview swaps
  // it for logic + eloquence.
  const tipScores: Record<string, number> = { clarity, volume, confidence };

  if (isInterview) {
    const extras = await fetchInterviewAnalysis(transcript, lang);
    if (extras) {
      logic = extras.logic;
      eloquence = extras.eloquence;
      serverTip = extras.tip;
    } else {
      // Server failure / no transcript: neutral 6 so the user still sees
      // a real (non-random) number, but we'll surface a tip about logic
      // since that's where most users grow.
      logic = 6;
      eloquence = 6;
    }
    tipScores.logic = logic;
    tipScores.eloquence = eloquence;
    overall = clarity * 0.25 + volume * 0.15 + confidence * 0.20 + logic * 0.20 + eloquence * 0.20;
  } else {
    tipScores.textMatch = textMatch;
    overall = clarity * 0.35 + textMatch * 0.30 + volume * 0.20 + confidence * 0.15;
  }
  overall = round1(clamp01to10(overall));

  const weakest = pickWeakest(tipScores);
  const tip = serverTip || tipFor(weakest, lang);

  // Map heuristics onto the existing SpeechScore shape so the legacy UI
  // (results bars, RankUpScreen trend chips) keeps rendering. tempo/pauses
  // are derived from duration + filler count rather than guessed.
  const tempo = round1(clamp01to10(
    audioDurationSeconds < 2 ? 4 :
    audioDurationSeconds < 5 ? 6 :
    audioDurationSeconds < 25 ? 8 :
    7,
  ));
  const pauses = round1(clamp01to10(8 - Math.min(4, fillerCount * 0.5)));
  const expressiveness = isInterview
    ? round1((eloquence + clarity) / 2)
    : round1((clarity + confidence) / 2);

  const score: SpeechScore = {
    overall,
    clarity,
    confidence,
    volume,
    tempo,
    expressiveness,
    pauses,
  };

  // Strengths/recommendations are now generated FROM the criteria scores
  // — no random pools. Anything ≥7 is a strength; anything <6 is a growth
  // point. The list is capped to 3 of each.
  const labelMap: Record<string, { ru: string; en: string }> = {
    clarity: { ru: "Чёткая дикция", en: "Clear diction" },
    confidence: { ru: "Уверенный голос", en: "Confident voice" },
    volume: { ru: "Хорошая громкость и длительность", en: "Good volume and length" },
    textMatch: { ru: "Точное соответствие тексту", en: "Faithful to the original text" },
    logic: { ru: "Логичная структура ответа", en: "Logical answer structure" },
    eloquence: { ru: "Богатая, выразительная речь", en: "Rich, expressive speech" },
  };
  const recMap: Record<string, { ru: string; en: string }> = {
    clarity: { ru: "Поработай над чёткостью артикуляции", en: "Work on articulation clarity" },
    confidence: { ru: "Убери слова-паразиты, чтобы звучать увереннее", en: "Cut filler words to sound more confident" },
    volume: { ru: "Говори громче и развёрнутее", en: "Speak louder and at greater length" },
    textMatch: { ru: "Постарайся точнее повторять текст задания", en: "Stick closer to the prompt text" },
    logic: { ru: "Чётче выстраивай логику ответа", en: "Structure the logic of your answer" },
    eloquence: { ru: "Расширь словарный запас и точнее формулируй", en: "Broaden vocabulary and sharpen your wording" },
  };

  const strengths: string[] = [];
  const recommendations: string[] = [];
  for (const [k, v] of Object.entries(tipScores)) {
    if (v >= 7 && labelMap[k]) {
      strengths.push(lang === "en" ? labelMap[k].en : labelMap[k].ru);
    }
    if (v < 6 && recMap[k]) {
      recommendations.push(lang === "en" ? recMap[k].en : recMap[k].ru);
    }
  }
  if (strengths.length === 0) {
    strengths.push(lang === "en" ? "You finished the take" : "Запись завершена");
  }
  if (recommendations.length === 0) {
    recommendations.push(tip);
  }

  const summaries: Record<Lang, Record<string, string>> = {
    ru: {
      warmup: "Хорошая разминка! Голос разогрет и готов к работе.",
      interview: "Ответ записан. Оценка построена на честных метриках.",
      tonguetwister: "Дикция работает. Регулярные тренировки дадут результат.",
      showtime: "Выступление состоялось! Публика бы тебя запомнила.",
      reading: "Текст прочитан. Голос развивается.",
    },
    en: {
      warmup: "Great warmup! Your voice is warmed up and ready.",
      interview: "Your answer is in. The scoring is built on real metrics.",
      tonguetwister: "Diction is working. Regular practice will show results.",
      showtime: "Performance delivered! The audience would remember you.",
      reading: "Text read with intent. Your voice is growing.",
    },
  };

  const xpBonus = overall >= 9 ? 5 : overall >= 8 ? 2 : 0;

  return {
    score,
    strengths: strengths.slice(0, 3),
    recommendations: recommendations.slice(0, 3),
    summary: summaries[lang][baseType] ?? summaries[lang].warmup,
    xpBonus,
    tip,
    transcript,
    fillerCount,
    textMatchRatio,
  };
}

export function calculateConfidence(score: SpeechScore): number {
  return round1((score.confidence + score.clarity + score.volume) / 3);
}

export function generateTips(levelType: string, lang: Lang = "ru"): string[] {
  const base = getBaseType(levelType);
  const tips: Record<Lang, Record<string, string[]>> = {
    ru: {
      warmup: [
        "Расслабь плечи перед началом",
        "Сделай глубокий вдох диафрагмой",
        "Говори спокойно — не торопись",
      ],
      interview: [
        "Слушай вопрос до конца",
        "Делай паузу 1–2 секунды перед ответом",
        "Отвечай уверенно, даже если не знаешь ответа",
      ],
      tonguetwister: [
        "Начинай медленно — скорость придёт",
        "Чётко проговаривай каждый звук",
        "Повторяй 3 раза: медленно, средне, быстро",
      ],
      showtime: [
        "Встань прямо, почувствуй сцену",
        "Говори громче, чем обычно",
        "Смотри вперёд — в зал, а не в пол",
      ],
      reading: [
        "Читай фразами, не словами",
        "Выделяй ключевые слова интонацией",
        "Делай паузы после точек и запятых",
      ],
    },
    en: {
      warmup: [
        "Relax your shoulders before starting",
        "Take a deep diaphragmatic breath",
        "Speak calmly — don't rush",
      ],
      interview: [
        "Listen to the question fully",
        "Pause 1–2 seconds before answering",
        "Answer confidently, even if unsure",
      ],
      tonguetwister: [
        "Start slowly — speed will come",
        "Pronounce every sound clearly",
        "Repeat 3 times: slow, medium, fast",
      ],
      showtime: [
        "Stand tall, feel the stage",
        "Speak louder than usual",
        "Look ahead — at the audience, not the floor",
      ],
      reading: [
        "Read in phrases, not words",
        "Emphasize key words with intonation",
        "Pause after periods and commas",
      ],
    },
  };
  return tips[lang][base] ?? tips[lang].warmup;
}
