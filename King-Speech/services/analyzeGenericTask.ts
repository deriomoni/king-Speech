import { fetch as expoFetch } from "expo/fetch";
import { getApiUrl } from "@/lib/query-client";
import { analyzeSpeech, isInterviewLevel, readInterviewExtras, type SpeechAnalysis } from "@/services/speechAnalysis";
import { pickLang, type Lang } from "@/context/LangContext";

// Reusable speech-analysis pipeline for generic "speak this content" tasks
// (tongue twisters, interview levels, articulation…). Extracted from the level
// screen so the new one-task-per-screen flow (TaskFlowView) and the legacy
// path can share one honest scoring path: transcribe → analyze, with an
// empty-recording guard and a graceful fallback.
export type TaskAnalysisResult =
  | { kind: "empty" }
  | { kind: "ok"; analysis: SpeechAnalysis }
  | { kind: "error"; analysis: SpeechAnalysis };

export async function analyzeGenericTask(params: {
  originalText: string;
  levelId: string;
  levelNumber: number;
  lang: Lang;
  durationSeconds: number;
  audioBase64?: string;
}): Promise<TaskAnalysisResult> {
  const { originalText, levelId, levelNumber, lang, durationSeconds, audioBase64 } = params;

  let transcript = "";
  let serverDuration = durationSeconds;
  let audioRms: number | undefined;
  let transcribedOk = false;
  // Interview levels get logic/eloquence judged in the same request.
  const isInterview = isInterviewLevel(levelId);
  let interviewExtras: ReturnType<typeof readInterviewExtras>;

  if (audioBase64 && audioBase64.length > 100) {
    try {
      const url = new URL("/api/transcribe", getApiUrl()).toString();
      const res = await expoFetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioBase64, audioDurationSeconds: durationSeconds, lang, ...(isInterview ? { interview: true } : {}) }),
      });
      if (res.ok) {
        transcribedOk = true;
        const data = await res.json();
        if (typeof data.transcript === "string") transcript = data.transcript;
        if (typeof data.audioDurationSeconds === "number" && data.audioDurationSeconds > 0) {
          serverDuration = data.audioDurationSeconds;
        }
        if (typeof data.audioRms === "number" && Number.isFinite(data.audioRms)) {
          audioRms = data.audioRms;
        }
        interviewExtras = readInterviewExtras(data);
      }
    } catch (e) {
      console.warn("[analyzeGenericTask] transcribe failed:", e);
    }
  }

  // Empty-recording guard: STT ran but heard essentially nothing (< 2 words).
  const spokenWords = transcript.trim().split(/\s+/).filter(Boolean).length;
  if (transcribedOk && spokenWords < 2) {
    return { kind: "empty" };
  }

  try {
    const analysis = await analyzeSpeech({
      transcript,
      originalText,
      audioDurationSeconds: serverDuration,
      levelType: levelId,
      lang,
      levelNumber,
      audioRms,
      interviewExtras,
    });
    return { kind: "ok", analysis };
  } catch (e) {
    console.warn("[analyzeGenericTask] analyzeSpeech failed:", e);
    const errMsg = pickLang(lang, {
      ru: "Не удалось проанализировать запись. Попробуй ещё раз.",
      en: "Couldn't analyze the recording. Please try again.",
      kk: "Жазбаны талдау мүмкін болмады. Тағы байқап көріңіз.",
    });
    return {
      kind: "error",
      analysis: {
        summary: errMsg,
        score: { overall: 0, clarity: 0, confidence: 0, volume: 0, tempo: 0, expressiveness: 0, pauses: 0 },
        strengths: [],
        recommendations: [errMsg],
        tip: errMsg,
        transcript,
        fillerCount: 0,
        textMatchRatio: null,
        xpBonus: 0,
      },
    };
  }
}

/** Average a list of per-task analyses into one level-level SpeechAnalysis. */
export function aggregateAnalyses(analyses: SpeechAnalysis[], lang: Lang): SpeechAnalysis {
  const valid = analyses.filter(Boolean);
  const n = Math.max(1, valid.length);
  const avg = (k: keyof SpeechAnalysis["score"]) =>
    valid.reduce((s, a) => s + (Number(a.score[k]) || 0), 0) / n;

  const score = {
    overall: avg("overall"),
    clarity: avg("clarity"),
    confidence: avg("confidence"),
    volume: avg("volume"),
    tempo: avg("tempo"),
    expressiveness: avg("expressiveness"),
    pauses: avg("pauses"),
  };

  // Pick the coaching tip from the strongest task's take, merge growth points.
  const best = [...valid].sort((a, b) => b.score.overall - a.score.overall)[0];
  const recommendations = Array.from(
    new Set(valid.flatMap((a) => a.recommendations || []).filter(Boolean)),
  ).slice(0, 3);
  const strengths = Array.from(
    new Set(valid.flatMap((a) => a.strengths || []).filter(Boolean)),
  ).slice(0, 3);

  const summary =
    best?.summary ||
    pickLang(lang, { ru: "Итоговая оценка за уровень.", en: "Your level score.", kk: "Деңгей бойынша қорытынды баға." });

  return {
    summary,
    score,
    strengths,
    recommendations,
    tip: best?.tip || recommendations[0] || "",
    transcript: "",
    fillerCount: valid.reduce((s, a) => s + (a.fillerCount || 0), 0),
    textMatchRatio: null,
    xpBonus: 0,
  };
}
