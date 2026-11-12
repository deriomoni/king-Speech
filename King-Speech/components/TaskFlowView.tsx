import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, Platform, ActivityIndicator, ScrollView } from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  SlideInRight,
  SlideOutLeft,
  ZoomIn,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "@/lib/haptics";
import WaveformVoiceRecorder from "@/components/WaveformVoiceRecorder";
import { toneFor } from "@/components/ScoreFlower";
import { analyzeGenericTask, type TaskAnalysisResult } from "@/services/analyzeGenericTask";
import { scoreLiteracy, type LiteracyResult } from "@/services/literacyScore";
import { judgeAnswer, type AnswerJudge } from "@/services/answerJudge";
import { checkTextAccuracy, type TextAccuracy } from "@/services/textAccuracy";
import type { SpeechAnalysis } from "@/services/speechAnalysis";
import type { Task } from "@/context/GameContext";
import { useGame } from "@/context/GameContext";
import CoinIcon from "@/components/CoinIcon";
import { brand } from "@/constants/colors";
import { readableText } from "@/constants/pathPalette";
import { useTheme } from "@/context/ThemeContext";
import { aggregateAnalyses } from "@/services/analyzeGenericTask";
import { Image } from "expo-image";

// Figma "Оскар · все позы" exports (04/05): the corridor illustration. Keyed to
// transparent so they sit on the dark illustration well in both themes.
const CORRIDOR_ART = {
  interview: require("@/assets/figma/levels/oscar-corridor-interview.png"),
  tongue: require("@/assets/figma/levels/oscar-corridor-tongue.png"),
};

// ───────────────────────────────────────────────────────────────────────────
// One-task-per-screen flow for generic "speak this" levels (tongue twisters,
// interview levels, articulation…). Each task fills the screen with big, airy
// typography (ref: Agency/Studio) inside a violet "ticket" card (ref: Spiritual
// Growth). Recording → a very short score summary → the record control morphs
// into a gold "Next" pill. Advancing swaps the text card to the next task. After
// the LAST task, the screen darkens and the parent blooms the aggregate flower.
//
// Interview levels take a different route (isInterview): a clean theme
// background, a white question card whose text fades in, and — crucially —
// answers are NOT analyzed one-by-one. The player records an answer and moves
// straight to the next question; analysis for answers 1..n-1 runs in the
// background, the final answer is awaited, and a developer report (transcripts
// + score breakdown) is shown before the level's aggregate flower.
// ───────────────────────────────────────────────────────────────────────────

const INTERVIEW_CORRIDOR_MS = 7000;

interface Props {
  tasks: Task[];
  levelId: string;
  levelNumber: number;
  title: string;
  subtitle?: string;
  accent: string;
  /** Full-screen background behind the flow (module palette). Text on it adapts. */
  screenBg?: string;
  /** Interview flow: clean bg, white card, deferred analysis, AI judge + literacy. */
  isInterview?: boolean;
  /** Interview only: alternate question variants per task slot, for the
   *  "Другой вопрос" replace button. */
  interviewVariants?: string[][] | null;
  /** Tongue-twister flow: same clean/deferred UI, but scored on text accuracy
   *  (no literacy, no AI judge). */
  isTongue?: boolean;
  colors: import("@/constants/colors").AppColors;
  isDark: boolean;
  lang: "ru" | "en";
  topPad: number;
  bottomPad: number;
  onTaskScored: (taskNumber: number, score: number) => void;
  onAllComplete: (payload: {
    scores: number[];
    analyses: SpeechAnalysis[];
    durationSec: number;
  }) => void;
  onExit: () => void;
}

type Phase = "record" | "analyzing" | "scored";

interface DevRow {
  question: string;
  transcript: string;
  durationSec: number;
  analysis: SpeechAnalysis;
  literacy?: LiteracyResult; // interview only
  ai?: AnswerJudge; // interview only
  accuracy?: TextAccuracy; // tongue-twister only
  own: number; // autonomous score (0..10)
  overall10: number; // final per-answer score
}

// Autonomous ("own") weights: literacy dominates. Tempo & pauses are NOT scored
// (internal signals per the spec).
const V2_WEIGHTS = { literacy: 0.4, confidence: 0.2, expressiveness: 0.18, clarity: 0.14, volume: 0.08 };
// Final blend: 90% autonomous mechanism + 10% AI judge. AI is relevance-first.
const AI_SHARE = 0.1;
const AI_RELEVANCE_W = 0.7; // "did they answer the question" — the primary AI signal
const AI_COMPETENCE_W = 0.3;

function autonomousOverall(a: SpeechAnalysis, lit: LiteracyResult): number {
  const s = a.score;
  const litPart = lit.available ? lit.overall10 : s.overall; // fall back if no transcript
  return (
    V2_WEIGHTS.literacy * litPart +
    V2_WEIGHTS.confidence * (s.confidence ?? 0) +
    V2_WEIGHTS.expressiveness * (s.expressiveness ?? 0) +
    V2_WEIGHTS.clarity * (s.clarity ?? 0) +
    V2_WEIGHTS.volume * (s.volume ?? 0)
  );
}

// Tongue-twister: no literacy (the text is fixed) — text accuracy is the core,
// clarity next. All other aspects preserved.
const TONGUE_WEIGHTS = { accuracy: 0.5, clarity: 0.2, confidence: 0.15, expressiveness: 0.08, volume: 0.07 };

function tongueOverall(a: SpeechAnalysis, acc: TextAccuracy): number {
  const s = a.score;
  const accPart = acc.available ? acc.score10 : s.overall;
  return (
    TONGUE_WEIGHTS.accuracy * accPart +
    TONGUE_WEIGHTS.clarity * (s.clarity ?? 0) +
    TONGUE_WEIGHTS.confidence * (s.confidence ?? 0) +
    TONGUE_WEIGHTS.expressiveness * (s.expressiveness ?? 0) +
    TONGUE_WEIGHTS.volume * (s.volume ?? 0)
  );
}

// Blend the autonomous score with the AI judge. When the AI is unavailable
// (overloaded / offline / timed out) the autonomous score stands alone.
function blendFinal(own: number, ai: AnswerJudge): number {
  if (!ai.available || ai.relevance == null || ai.competence == null) return own;
  const aiScore = AI_RELEVANCE_W * ai.relevance + AI_COMPETENCE_W * ai.competence;
  return (1 - AI_SHARE) * own + AI_SHARE * aiScore;
}

// Recorded answer audio is kept ONLY in memory for the duration of the level so
// the player can replay it. Nothing is written to durable storage; temp files
// used for native playback are deleted on unmount (see the cleanup effect).
interface AnswerAudio {
  base64: string;
  mime: string;
  durationSec: number;
}

/** Replay waveform per answer slot (normalized 0..1 bars), kept in memory only. */
type Waveform = number[];

function base64ToBlob(b64: string, mime: string): Blob {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

function fmtDuration(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

// Score with the trailing ".0" trimmed: 10.0 -> "10", 7.0 -> "7", 7.5 -> "7.5".
function fmtScore(n: number): string {
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

function verdictLabel(v: AnswerJudge["verdict"], ru: boolean): string {
  if (v === "yes") return ru ? "Ответ по теме" : "On topic";
  if (v === "partial") return ru ? "Частично по теме" : "Partly on topic";
  if (v === "off") return ru ? "Не по теме" : "Off topic";
  return ru ? "Оценка ИИ" : "AI review";
}

export default function TaskFlowView({
  tasks,
  levelId,
  levelNumber,
  title,
  subtitle,
  accent,
  screenBg,
  isInterview = false,
  interviewVariants = null,
  isTongue = false,
  colors,
  isDark,
  lang,
  topPad,
  bottomPad,
  onTaskScored,
  onAllComplete,
  onExit,
}: Props) {
  const ru = lang === "ru";
  // Interview and tongue-twister levels share the same clean/deferred UI.
  const deferred = isInterview || isTongue;
  // Ink that reads on the palette background (which may be light OR dark,
  // independent of theme). Falls back to the theme text color.
  const ink = screenBg ? readableText(screenBg) : colors.text;
  const inkSoft = ink === "#FFFFFF" ? "rgba(255,255,255,0.62)" : "rgba(20,22,26,0.6)";
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("record");

  // "Другой вопрос" (interview): swap the shown question for a variant. Costs
  // coins, capped at 2 replacements per question slot.
  const { coins, spendCoins } = useGame();
  const REPLACE_Q_COST = 30;
  const MAX_REPLACES = 2;
  const [questionOverrides, setQuestionOverrides] = useState<Record<number, string>>({});
  const [replaceCounts, setReplaceCounts] = useState<Record<number, number>>({});
  // Effective question text for slot i, honoring any replacement. Used for BOTH
  // the on-screen card and the analysis/AI-judge input so scoring matches what
  // the player actually answered.
  const questionAt = (i: number) =>
    questionOverrides[i] ?? (tasks[i]?.content || "");
  const [current, setCurrent] = useState<SpeechAnalysis | null>(null);
  const [emptyTake, setEmptyTake] = useState(false);
  const [darken, setDarken] = useState(false);

  // Interview-only state.
  const [corridor, setCorridor] = useState(deferred);
  const [devRows, setDevRows] = useState<DevRow[] | null>(null);
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  // Replay progress (0..1) of the answer currently playing — drives the
  // playhead of the Figma "Recorder bar · Playback" in the breakdown.
  const [playProgress, setPlayProgress] = useState(0);
  const { theme, themeMode } = useTheme();

  const analysesRef = useRef<SpeechAnalysis[]>([]);
  const scoresRef = useRef<number[]>([]);
  const startRef = useRef(Date.now());
  // Background analysis promises, one slot per question (interview flow).
  const pendingRef = useRef<Array<Promise<TaskAnalysisResult> | null>>([]);
  // In-memory recorded answers (never persisted) + active playback handle.
  const audioRef = useRef<Array<AnswerAudio | null>>([]);
  const waveRef = useRef<Array<Waveform | null>>([]);
  const playbackRef = useRef<{ sound?: any; url?: string; el?: any; files: string[] }>({ files: [] });

  // On unmount: drop every in-memory answer, revoke URLs, unload the player and
  // delete any temp files. Leaving the level erases all audio, by design.
  useEffect(() => {
    return () => {
      const pb = playbackRef.current;
      try { pb.el?.pause?.(); } catch {}
      if (pb.url) { try { URL.revokeObjectURL(pb.url); } catch {} }
      if (pb.sound) { try { pb.sound.unloadAsync?.(); } catch {} }
      if (pb.files.length) {
        try {
          const FileSystem = require("expo-file-system/legacy");
          pb.files.forEach((f) => FileSystem.deleteAsync(f, { idempotent: true }).catch(() => {}));
        } catch {}
      }
      audioRef.current = [];
      waveRef.current = [];
    };
  }, []);

  const stopPlayback = async () => {
    const pb = playbackRef.current;
    try { pb.el?.pause?.(); } catch {}
    if (pb.url) { try { URL.revokeObjectURL(pb.url); } catch {} pb.url = undefined; }
    if (pb.sound) { try { await pb.sound.unloadAsync?.(); } catch {} pb.sound = undefined; }
    pb.el = undefined;
    setPlayingIndex(null);
    setPlayProgress(0);
  };

  const playAnswer = async (i: number) => {
    const a = audioRef.current[i];
    if (!a?.base64) return;
    if (playingIndex === i) {
      await stopPlayback();
      return;
    }
    await stopPlayback();
    setPlayingIndex(i);
    if (Platform.OS === "web") {
      try {
        const url = URL.createObjectURL(base64ToBlob(a.base64, a.mime || "audio/webm"));
        const el = new (window as any).Audio(url);
        playbackRef.current.url = url;
        playbackRef.current.el = el;
        el.onended = () => { try { URL.revokeObjectURL(url); } catch {} setPlayingIndex(null); setPlayProgress(0); };
        el.onerror = () => setPlayingIndex(null);
        // MediaRecorder webm blobs often report duration=Infinity — fall back
        // to the recorded length.
        el.ontimeupdate = () => {
          const d = Number.isFinite(el.duration) && el.duration > 0 ? el.duration : a.durationSec;
          if (d > 0) setPlayProgress(Math.min(1, el.currentTime / d));
        };
        await el.play();
      } catch {
        setPlayingIndex(null);
      }
    } else {
      try {
        const FileSystem = require("expo-file-system/legacy");
        const { Audio } = require("@/lib/av");
        const ext = (a.mime?.split("/").pop() || "m4a").replace(/[^a-z0-9]/gi, "") || "m4a";
        const path = `${FileSystem.cacheDirectory}ks_answer_${i}.${ext}`;
        await FileSystem.writeAsStringAsync(path, a.base64, { encoding: "base64" });
        playbackRef.current.files.push(path);
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
        const { sound } = await Audio.Sound.createAsync({ uri: path });
        playbackRef.current.sound = sound;
        sound.setOnPlaybackStatusUpdate((s: any) => {
          if (s?.durationMillis > 0 && s?.positionMillis != null) {
            setPlayProgress(Math.min(1, s.positionMillis / s.durationMillis));
          }
          if (s?.didJustFinish) { setPlayingIndex(null); setPlayProgress(0); }
        });
        await sound.playAsync();
      } catch {
        setPlayingIndex(null);
      }
    }
  };

  const total = tasks.length;
  const task = tasks[index];
  const isLast = index >= total - 1;

  // 7s mascot corridor before the interview begins (mirrors the reading level).
  // The timer lives in <LevelCorridor> so press-and-hold can pause it.

  // ── Standard (tongue-twister) flow: analyze each take inline ────────────────
  const handleRecordingComplete = async (durationSeconds: number, audioBase64?: string) => {
    setPhase("analyzing");
    setEmptyTake(false);
    const res = await analyzeGenericTask({
      originalText: task.content || task.instruction || "",
      levelId,
      levelNumber,
      lang,
      durationSeconds,
      audioBase64,
    });
    if (res.kind === "empty") {
      setEmptyTake(true);
      setPhase("record");
      return;
    }
    setCurrent(res.analysis);
    setPhase("scored");
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
  };

  const advance = () => {
    if (!current) return;
    const score = current.score.overall;
    analysesRef.current[index] = current;
    scoresRef.current[index] = score;
    onTaskScored(task.taskNumber, score);
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }

    if (isLast) {
      // Darken the screen, then hand the aggregate up — the parent blooms the
      // flower on its own dark canvas (continuity: screen fades → flower).
      setDarken(true);
      setTimeout(() => {
        onAllComplete({
          scores: scoresRef.current.slice(),
          analyses: analysesRef.current.slice(),
          durationSec: Math.max(1, Math.floor((Date.now() - startRef.current) / 1000)),
        });
      }, 460);
    } else {
      setCurrent(null);
      setPhase("record");
      setIndex((i) => i + 1);
    }
  };

  const retryTake = () => {
    setCurrent(null);
    setEmptyTake(false);
    setPhase("record");
  };

  // "Другой вопрос" — swap the current interview question for the next variant.
  const variantsHere = interviewVariants?.[index] ?? null;
  const usedHere = replaceCounts[index] ?? 0;
  // Cap at 2 per the spec, but never beyond the number of distinct alternates.
  const replaceLimit = variantsHere
    ? Math.min(MAX_REPLACES, variantsHere.length - 1)
    : 0;
  const canReplaceQuestion =
    isInterview && phase === "record" && !!variantsHere && usedHere < replaceLimit;

  const replaceQuestion = () => {
    if (!canReplaceQuestion || !variantsHere) return;
    if (coins < REPLACE_Q_COST) return;
    if (!spendCoins(REPLACE_Q_COST)) return;
    // variant[0] is the initial question; replace #1 → [1], #2 → [2] (wrap if
    // fewer variants exist so a replacement always changes the text).
    const nextVariant = variantsHere[(usedHere + 1) % variantsHere.length];
    setQuestionOverrides((m) => ({ ...m, [index]: nextVariant }));
    setReplaceCounts((m) => ({ ...m, [index]: usedHere + 1 }));
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
  };

  // ── Interview flow: record → next immediately; analyze in the background ────
  const emptyAnalysis = (): SpeechAnalysis => ({
    summary: ru ? "Ответ не распознан." : "Answer not recognized.",
    score: { overall: 0, clarity: 0, confidence: 0, volume: 0, tempo: 0, expressiveness: 0, pauses: 0 },
    strengths: [],
    recommendations: [],
    tip: "",
    transcript: "",
    fillerCount: 0,
    textMatchRatio: null,
    xpBonus: 0,
  });

  const finalizeInterview = async () => {
    // Await every background analysis (answers 1..n-1) plus the final one.
    const results = await Promise.all(
      pendingRef.current.map((p) =>
        (p ?? Promise.resolve<TaskAnalysisResult>({ kind: "empty" })).catch(
          () => ({ kind: "empty" } as TaskAnalysisResult),
        ),
      ),
    );
    const analyses = results.map((r) => (r.kind === "empty" ? emptyAnalysis() : r.analysis));
    analysesRef.current = analyses;
    // Compute the autonomous score, then ask the AI judge (relevance + competence)
    // in parallel. The judge self-times-out and falls back, so this never hangs.
    const rows: DevRow[] = await Promise.all(
      tasks.map(async (t, i): Promise<DevRow> => {
        const analysis = analyses[i] ?? emptyAnalysis();
        const transcript = analysis.transcript || "";
        const question = questionOverrides[i] ?? (t.content || t.title || "");
        const durationSec = audioRef.current[i]?.durationSec ?? 0;
        if (isTongue) {
          // Deterministic word-match against the printed tongue twister — no
          // literacy (fixed text) and no AI judge.
          const accuracy = checkTextAccuracy(question, transcript);
          const own = tongueOverall(analysis, accuracy);
          return { question, transcript, durationSec, analysis, accuracy, own, overall10: own };
        }
        const literacy = scoreLiteracy(transcript, durationSec);
        const own = autonomousOverall(analysis, literacy);
        const ai = await judgeAnswer({ question, transcript, lang });
        return { question, transcript, durationSec, analysis, literacy, ai, own, overall10: blendFinal(own, ai) };
      }),
    );
    // Level score = 90% autonomous + 10% AI (per answer), then averaged.
    scoresRef.current = rows.map((r) => r.overall10);
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    setDevRows(rows);
  };

  const handleInterviewRecorded = (
    durationSeconds: number,
    audioBase64?: string,
    mimeType?: string,
    waveform?: number[],
  ) => {
    const i = index;
    const t = tasks[i];
    waveRef.current[i] = waveform && waveform.length ? waveform : null;
    // Keep the take in memory only (for replay) — never written to storage.
    if (audioBase64) {
      audioRef.current[i] = {
        base64: audioBase64,
        mime: mimeType || (Platform.OS === "web" ? "audio/webm" : "audio/m4a"),
        durationSec: durationSeconds,
      };
    }
    // Kick off analysis in the background and stash its promise.
    pendingRef.current[i] = analyzeGenericTask({
      originalText: questionOverrides[i] ?? (t.content || t.instruction || ""),
      levelId,
      levelNumber,
      lang,
      durationSeconds,
      audioBase64,
    });
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    if (i >= total - 1) {
      // Final answer: wait for the whole batch, then show the dev report.
      setPhase("analyzing");
      void finalizeInterview();
    } else {
      // Move straight to the next question — no waiting on analysis.
      setIndex(i + 1);
    }
  };

  // Dev report "continue" → hand the aggregate up (flower → victory).
  const finishFromDev = () => {
    void stopPlayback();
    // Level completion is committed atomically by the parent's onAllComplete
    // (completeAllTasksForLevel) — completing tasks one-by-one here read stale
    // state and lost all but the last, so the level looked unfinished on exit.
    setDevRows(null);
    setDarken(true);
    setTimeout(() => {
      onAllComplete({
        scores: scoresRef.current.slice(),
        analyses: analysesRef.current.slice(),
        durationSec: Math.max(1, Math.floor((Date.now() - startRef.current) / 1000)),
      });
    }, 300);
  };

  const kindLabel = levelId.startsWith("tonguetwister")
    ? ru ? "Скороговорка" : "Tongue twister"
    : ru ? "Задание" : "Task";

  const isDarkTheme = themeMode === "dark";
  // Figma stroke/shape — the 2pt hairline around cards.
  const shapeStroke = isDarkTheme ? "rgba(240,238,233,0.06)" : "rgba(38,38,40,0.08)";
  const cardBg = deferred ? theme.card : undefined;
  const replaceDisabled = !canReplaceQuestion || coins < REPLACE_Q_COST;

  return (
    <View style={{ flex: 1 }}>
      {/* Header: exit + numbered step progress (Figma "Step progress" 174:1892) */}
      <View style={[st.header, { paddingTop: topPad + 8 }]}>
        <Pressable onPress={onExit} hitSlop={12} style={({ pressed }) => [st.exitBtn, { opacity: pressed ? 0.6 : 1 }]}>
          <Ionicons name="close" size={22} color={ink} />
        </Pressable>
        <StepProgress
          total={total}
          current={index}
          doneThrough={deferred ? index - 1 : phase === "scored" ? index : index - 1}
          isDark={screenBg ? ink === "#FFFFFF" : isDarkTheme}
        />
        <View style={st.exitBtn} />
      </View>

      {/* Level title (small) */}
      <View style={st.titleWrap}>
        <Text style={[st.kicker, { color: screenBg ? accent : theme.accentInk, fontFamily: "Geologica_600SemiBold" }]}>
          {isInterview
            ? `${ru ? "Вопрос" : "Question"} ${index + 1}/${total}`
            : isTongue
            ? `${ru ? "Скороговорка" : "Tongue twister"} ${index + 1}/${total}`
            : `${kindLabel} ${index + 1}/${total}`}
        </Text>
        <Text numberOfLines={1} style={[st.levelTitle, { color: ink, fontFamily: "Geologica_700Bold" }]}>
          {title}
        </Text>
      </View>

      {/* Task card — swaps on advance */}
      <View style={st.stage}>
        <Animated.View
          key={index}
          entering={deferred ? FadeIn.duration(300) : SlideInRight.duration(360)}
          exiting={deferred ? FadeOut.duration(160) : SlideOutLeft.duration(240)}
          style={st.cardWrap}
        >
          <View
            style={[
              st.card,
              deferred
                ? { backgroundColor: cardBg, borderColor: shapeStroke }
                : { borderColor: shapeStroke, backgroundColor: theme.card },
            ]}
          >
            {task.instruction && !deferred ? (
              <Text style={[st.instruction, { color: theme.textSecondary, fontFamily: "Geologica_600SemiBold" }]}>
                {task.instruction}
              </Text>
            ) : null}
            {/* Clean flow: text fades in over 1.5s each new card. */}
            <Animated.Text
              key={`q-${index}-${replaceCounts[index] ?? 0}`}
              entering={deferred ? FadeIn.duration(1500) : undefined}
              style={[st.contentText, { color: theme.text, fontFamily: "Geologica_700Bold" }]}
            >
              {(questionOverrides[index] ?? task.content) || task.title}
            </Animated.Text>
          </View>
        </Animated.View>
      </View>

      {/* Bottom control — record → (analyzing) → mini-score + gold Next pill */}
      <View style={[st.controls, { paddingBottom: bottomPad + 14 }]}>
        {isInterview && phase === "record" && !corridor ? (
          <Animated.View entering={FadeIn.duration(300)} style={st.replaceQWrap}>
            <Pressable
              onPress={replaceQuestion}
              disabled={replaceDisabled}
              style={({ pressed }) => [
                st.replaceQBtn,
                {
                  backgroundColor: theme.card,
                  borderColor: theme.cardBorder,
                  opacity: replaceDisabled ? 0.5 : pressed ? 0.7 : 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={ru ? "Другой вопрос" : "Another question"}
            >
              <Ionicons name="shuffle" size={15} color={theme.text} />
              <Text style={[st.replaceQText, { color: theme.text, fontFamily: "Geologica_700Bold" }]}>
                {usedHere >= replaceLimit
                  ? ru
                    ? "Замен больше нет"
                    : "No swaps left"
                  : ru
                    ? "Другой вопрос"
                    : "Another question"}
              </Text>
              {usedHere < replaceLimit ? (
                <View style={[st.replaceQCost, { backgroundColor: isDarkTheme ? "rgba(240,238,233,0.08)" : "rgba(38,38,40,0.06)" }]}>
                  <Text style={[st.replaceQCostText, { color: theme.text }]}>{REPLACE_Q_COST}</Text>
                  <CoinIcon size={9} color={theme.text} />
                </View>
              ) : null}
            </Pressable>
          </Animated.View>
        ) : null}

        {emptyTake ? (
          <Animated.Text
            entering={FadeIn}
            style={[st.emptyHint, { color: inkSoft, fontFamily: "Geologica_600SemiBold" }]}
          >
            {ru
              ? "Кажется, мы тебя не услышали — попробуй ещё раз, чуть увереннее."
              : "We didn't hear you — try again, a little louder."}
          </Animated.Text>
        ) : null}

        {phase === "record" ? (
          <Animated.View key="rec" entering={ZoomIn.duration(260)} style={st.controlSlot}>
            <WaveformVoiceRecorder
              onRecordingComplete={deferred ? handleInterviewRecorded : handleRecordingComplete}
              colors={colors}
              startLabel={isInterview ? (ru ? "Ответить" : "Answer") : isTongue ? (ru ? "Начать" : "Start") : undefined}
            />
          </Animated.View>
        ) : phase === "analyzing" ? (
          <Animated.View
            key="ana"
            entering={FadeIn.duration(200)}
            style={[st.analyzingPill, { backgroundColor: theme.accent, borderColor: theme.ctaStroke }]}
          >
            <ActivityIndicator size="small" color={theme.accentText} />
            <Text style={[st.pillText, { color: theme.accentText, fontFamily: "Geologica_800ExtraBold" }]}>
              {ru ? "Анализирую…" : "Analyzing…"}
            </Text>
          </Animated.View>
        ) : (
          <Animated.View key="scored" entering={FadeInDown.duration(300)} style={st.scoredWrap}>
            {current ? <MiniScore analysis={current} ru={ru} /> : null}
            <Animated.View entering={ZoomIn.duration(420)}>
              <Pressable
                onPress={advance}
                style={({ pressed }) => [
                  st.pill,
                  { backgroundColor: theme.accent, borderColor: theme.ctaStroke, borderWidth: 4, opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
                ]}
              >
                <Text style={[st.pillText, { color: theme.accentText, fontFamily: "Geologica_800ExtraBold" }]}>
                  {isLast ? (ru ? "Смотреть оценку" : "See score") : (ru ? "Далее" : "Next")}
                </Text>
                <Ionicons name="arrow-forward" size={20} color={theme.accentText} />
              </Pressable>
            </Animated.View>
            <Pressable onPress={retryTake} hitSlop={8} style={({ pressed }) => [st.retryLink, { opacity: pressed ? 0.5 : 1 }]}>
              <Ionicons name="refresh" size={14} color={inkSoft} />
              <Text style={[st.retryText, { color: inkSoft, fontFamily: "Geologica_600SemiBold" }]}>
                {ru ? "Переписать" : "Re-record"}
              </Text>
            </Pressable>
          </Animated.View>
        )}
      </View>

      {/* Fade curtain before the level score screen */}
      {darken ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Animated.View
            entering={FadeIn.duration(420)}
            pointerEvents="none"
            style={{ flex: 1, backgroundColor: theme.bg }}
          />
        </View>
      ) : null}

      {/* Corridor — 7s story-style curtain on entry (Figma 37:5228 / 37:6974) */}
      {corridor ? (
        <LevelCorridor
          isTongue={isTongue}
          ru={ru}
          topPad={topPad}
          bottomPad={bottomPad}
          onDone={() => setCorridor(false)}
          onExit={onExit}
        />
      ) : null}

      {/* Answer / tongue-twister breakdown (Figma 205:2052 / 208:2157) */}
      {devRows ? (
        <DevReport
          rows={devRows}
          waves={waveRef.current}
          ru={ru}
          isTongue={isTongue}
          topPad={topPad}
          bottomPad={bottomPad}
          playingIndex={playingIndex}
          playProgress={playProgress}
          onPlay={playAnswer}
          onContinue={finishFromDev}
        />
      ) : null}
    </View>
  );
}

// Figma "Step progress" (174:1892): numbered 28pt circles on an 8pt track. The
// active step wears the gold CTA ring; completed steps fill the track gold.
function StepProgress({
  total,
  current,
  doneThrough,
  isDark,
}: {
  total: number;
  current: number;
  doneThrough: number;
  isDark: boolean;
}) {
  const { theme } = useTheme();
  const todoFill = isDark ? "#626161" : "rgba(38,38,40,0.12)";
  const trackFill = isDark ? "#4E4E4F" : "rgba(38,38,40,0.08)";
  const todoInk = isDark ? "rgba(240,238,233,0.55)" : "rgba(38,38,40,0.5)";
  const n = Math.max(1, total);
  // Gold track reaches the furthest step that is done or active.
  const reach = Math.max(0, Math.min(n - 1, Math.max(current, doneThrough + 1)));
  const frac = n > 1 ? reach / (n - 1) : 0;
  return (
    <View style={st.stepWrap}>
      <View style={[st.stepTrack, { backgroundColor: trackFill }]}>
        <View style={[st.stepTrackDone, { width: `${frac * 100}%`, backgroundColor: theme.accent }]} />
      </View>
      {Array.from({ length: n }).map((_, i) => {
        const active = i === current;
        const done = i <= doneThrough || i < current;
        return (
          <View
            key={i}
            style={[
              st.stepDot,
              active
                ? { backgroundColor: theme.accent, borderWidth: 4, borderColor: theme.ctaStroke, width: 32, height: 32, borderRadius: 16, margin: -2 }
                : { backgroundColor: done ? theme.accent : todoFill },
            ]}
          >
            <Text style={[st.stepNum, { color: active || done ? "#262628" : todoInk }]}>{i + 1}</Text>
          </View>
        );
      })}
    </View>
  );
}

// Corridor before an interview / tongue-twister level: a story bar fills over
// 7s, a cream quote card with Oscar, and "hold to pause". Holding anywhere on
// the screen pauses the countdown.
const CORRIDOR_QUOTES = {
  interview: { ru: ["Заговори, чтобы я тебя увидел.", "Сократ"], en: ["Speak, so that I may see you.", "Socrates"] },
  tongue: { ru: ["Кто ясно мыслит, тот ясно излагает.", "Никола Буало"], en: ["What is well conceived is clearly said.", "Nicolas Boileau"] },
};

function LevelCorridor({
  isTongue,
  ru,
  topPad,
  bottomPad,
  onDone,
  onExit,
}: {
  isTongue: boolean;
  ru: boolean;
  topPad: number;
  bottomPad: number;
  onDone: () => void;
  onExit: () => void;
}) {
  const { theme, themeMode } = useTheme();
  const isDark = themeMode === "dark";
  const [elapsed, setElapsed] = useState(0);
  const pausedRef = useRef(false);
  const doneRef = useRef(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const STEP = 50;
    const id = setInterval(() => {
      if (pausedRef.current) return;
      setElapsed((e) => {
        const next = e + STEP;
        if (next >= INTERVIEW_CORRIDOR_MS && !doneRef.current) {
          doneRef.current = true;
          setTimeout(() => onDoneRef.current(), 0);
        }
        return Math.min(next, INTERVIEW_CORRIDOR_MS);
      });
    }, STEP);
    return () => clearInterval(id);
  }, []);

  const [quote, author] = CORRIDOR_QUOTES[isTongue ? "tongue" : "interview"][ru ? "ru" : "en"];
  const progress = elapsed / INTERVIEW_CORRIDOR_MS;

  return (
    <View style={[st.corridor, { backgroundColor: theme.bg }]}>
      <Pressable
        style={st.corridorPress}
        onPressIn={() => { pausedRef.current = true; }}
        onPressOut={() => { pausedRef.current = false; }}
        accessibilityLabel={ru ? "Удерживай, чтобы поставить на паузу" : "Hold to pause"}
      >
        <View style={[st.storyTrack, { top: topPad - 9, backgroundColor: isDark ? "rgba(240,238,233,0.25)" : "rgba(38,38,40,0.15)" }]}>
          <View style={[st.storyFill, { width: `${progress * 100}%`, backgroundColor: theme.text }]} />
        </View>

        <Animated.View exiting={FadeOut.duration(420)} style={st.corridorCard}>
          <View style={st.corridorArt}>
            <Image
              source={isTongue ? CORRIDOR_ART.tongue : CORRIDOR_ART.interview}
              style={{ width: "100%", height: "100%" }}
              contentFit="cover"
            />
          </View>
          <Text style={st.corridorQuote}>{quote}</Text>
          <Text style={st.corridorAuthor}>{`- ${author}`}</Text>
        </Animated.View>

        <Text style={[st.corridorHint, { bottom: bottomPad + 33, color: isDark ? "rgba(240,238,233,0.35)" : theme.textMuted }]}>
          {ru ? "Удерживай экран, чтобы поставить на паузу" : "Hold the screen to pause"}
        </Text>
      </Pressable>

      <Pressable
        onPress={onExit}
        hitSlop={14}
        style={({ pressed }) => [st.corridorClose, { top: topPad + 10, opacity: pressed ? 0.6 : 1 }]}
        accessibilityRole="button"
        accessibilityLabel={ru ? "Выйти" : "Exit"}
      >
        <Ionicons name="close" size={22} color={theme.text} />
      </Pressable>
    </View>
  );
}

// Very short between-tasks summary: score number in its tone + a 1-2 word
// verdict + stars. Deliberately compact — the full flower waits for level end.
function MiniScore({ analysis, ru }: { analysis: SpeechAnalysis; ru: boolean }) {
  const s = analysis.score.overall;
  const tone = toneFor(s);
  const stars = s < 5 ? 1 : s < 8 ? 2 : 3;
  const verdict = s >= 8 ? (ru ? "Отлично!" : "Excellent!") : s >= 6 ? (ru ? "Хорошо" : "Good") : s >= 4 ? (ru ? "Неплохо" : "Not bad") : (ru ? "Ещё разок" : "Keep trying");
  return (
    <Animated.View entering={ZoomIn.duration(320)} style={[st.mini, { borderColor: tone + "55", backgroundColor: tone + "14" }]}>
      <Text style={[st.miniScore, { color: tone, fontFamily: "Geologica_700Bold" }]}>{s.toFixed(1)}</Text>
      <View style={{ flex: 1 }}>
        <Text style={[st.miniVerdict, { color: tone, fontFamily: "Geologica_800ExtraBold" }]}>{verdict}</Text>
        <View style={st.starsRow}>
          {[1, 2, 3].map((i) => (
            <Ionicons key={i} name={i <= stars ? "star" : "star-outline"} size={14} color={i <= stars ? brand.gold : "rgba(150,150,160,0.5)"} />
          ))}
        </View>
      </View>
    </Animated.View>
  );
}

// Answer breakdown shown at the end of an interview / tongue-twister level
// (Figma 205:2052 "Разбор ответов" / 208:2157 "Разбор скороговорок"): big
// average score, one summary card (tip + notes), then a card per answer with
// the question, a replay "Recorder bar · Playback" and a collapsible
// "Характеристики" block (transcript + per-aspect bars).

// Deterministic placeholder waveform when a take has no captured bars.
const FALLBACK_WAVE = [0.35, 0.55, 0.25, 0.75, 0.45, 0.9, 0.6, 0.3, 0.7, 1, 0.5, 0.4, 0.85, 0.65, 0.25, 0.55, 0.95, 0.75, 0.35, 0.6, 0.45, 0.8, 0.3, 0.7, 0.9, 0.5, 0.65, 0.4, 0.75, 0.55];
const PLAYBACK_BARS = 30;

function resampleWave(src: number[] | null | undefined, n: number): number[] {
  const w = src && src.length ? src : FALLBACK_WAVE;
  if (w.length === n) return w;
  return Array.from({ length: n }, (_, i) => {
    const a = Math.floor((i * w.length) / n);
    const b = Math.max(a + 1, Math.floor(((i + 1) * w.length) / n));
    let m = 0;
    for (let k = a; k < b && k < w.length; k++) m = Math.max(m, w[k]);
    return m;
  });
}

function fmtClock(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

// Figma "Recorder bar" · state Playback: gold play disc, waveform with a gold
// playhead (played part solid, rest 30%), duration on the right.
function PlaybackBar({
  wave,
  durationSec,
  playing,
  progress,
  disabled,
  onPress,
  ru,
}: {
  wave: number[];
  durationSec: number;
  playing: boolean;
  progress: number;
  disabled: boolean;
  onPress: () => void;
  ru: boolean;
}) {
  const { theme, themeMode } = useTheme();
  const isDark = themeMode === "dark";
  const [w, setW] = useState(0);
  const bars = resampleWave(wave, PLAYBACK_BARS);
  // At rest the whole take reads solid; while playing, bars right of the
  // playhead dim to 30%.
  const showHead = playing || progress > 0;
  const played = showHead ? progress : 1;
  const dim = isDark ? "rgba(240,238,233,0.3)" : "rgba(38,38,40,0.25)";
  return (
    <View
      style={[
        st.pbBar,
        {
          backgroundColor: theme.cardElevated,
          borderColor: isDark ? "rgba(240,238,233,0.45)" : "rgba(38,38,40,0.3)",
        },
      ]}
    >
      <Pressable
        onPress={onPress}
        disabled={disabled}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={playing ? (ru ? "Остановить" : "Stop") : ru ? "Прослушать запись" : "Play recording"}
        style={({ pressed }) => [
          st.pbPlay,
          { backgroundColor: theme.accent, opacity: disabled ? 0.45 : pressed ? 0.8 : 1 },
        ]}
      >
        {playing ? (
          <View style={[st.pbStop, { backgroundColor: theme.accentText }]} />
        ) : (
          <Ionicons name="play" size={16} color={theme.accentText} style={{ marginLeft: 2 }} />
        )}
      </Pressable>
      <View style={st.pbWave} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
        {bars.map((v, i) => (
          <View
            key={i}
            style={[
              st.pbWaveBar,
              {
                height: 6 + v * 28,
                backgroundColor: (i + 0.5) / bars.length <= played ? theme.text : dim,
              },
            ]}
          />
        ))}
        {showHead && w > 0 ? (
          <View pointerEvents="none" style={[st.pbHead, { left: Math.max(0, Math.min(w - 2, progress * w)) - 2.5 }]}>
            <View style={[st.pbHeadDot, { backgroundColor: theme.accent }]} />
            <View style={[st.pbHeadLine, { backgroundColor: theme.accent }]} />
          </View>
        ) : null}
      </View>
      <Text style={[st.pbTime, { color: isDark ? "rgba(240,238,233,0.6)" : theme.textSecondary }]}>
        {fmtClock(durationSec)}
      </Text>
    </View>
  );
}

function MetricRow({ label, value, isDark }: { label: string; value: number | null; isDark: boolean }) {
  const { theme } = useTheme();
  const v = value == null ? null : Math.max(0, Math.min(10, value));
  return (
    <View style={st.metricRow}>
      <Text numberOfLines={1} style={[st.metricLabel, { color: isDark ? "rgba(240,238,233,0.85)" : theme.text }]}>
        {label}
      </Text>
      <View style={[st.metricTrack, { backgroundColor: isDark ? "rgba(240,238,233,0.08)" : "rgba(38,38,40,0.08)" }]}>
        {v ? <View style={[st.metricFill, { width: `${v * 10}%`, backgroundColor: theme.accent }]} /> : null}
      </View>
      <Text
        style={[
          st.metricValue,
          { color: v == null ? (isDark ? "rgba(240,238,233,0.35)" : theme.textMuted) : theme.text },
        ]}
      >
        {v == null ? "-" : fmtScore(v)}
      </Text>
    </View>
  );
}

function DevReport({
  rows,
  waves,
  ru,
  isTongue,
  topPad,
  bottomPad,
  playingIndex,
  playProgress,
  onPlay,
  onContinue,
}: {
  rows: DevRow[];
  waves: Array<Waveform | null>;
  ru: boolean;
  isTongue: boolean;
  topPad: number;
  bottomPad: number;
  playingIndex: number | null;
  playProgress: number;
  onPlay: (index: number) => void;
  onContinue: () => void;
}) {
  const { theme, themeMode } = useTheme();
  const isDark = themeMode === "dark";
  const overalls = rows.map((r) => r.overall10);
  const avg = overalls.reduce((s, v) => s + v, 0) / Math.max(1, overalls.length);
  const aiUsed = rows.filter((r) => r.ai?.available).length;
  // First card opens expanded, the rest collapsed (as in the design).
  const [open, setOpen] = useState<Record<number, boolean>>({ 0: true });

  // Summary: coaching tip + up to 3 notes merged across all takes.
  const agg = aggregateAnalyses(rows.map((r) => r.analysis), ru ? "ru" : "en");
  const tip = (agg.tip || "").trim();
  const notes = (agg.recommendations || [])
    .map((n) => n.trim())
    .filter((n) => n && n.toLowerCase() !== tip.toLowerCase())
    .slice(0, 3);

  const cardStyle = {
    backgroundColor: isDark ? "rgba(240,238,233,0.05)" : theme.card,
    borderColor: isDark ? "rgba(240,238,233,0.08)" : theme.cardBorder,
  };
  const labelColor = isDark ? "rgba(240,238,233,0.5)" : theme.textSecondary;
  const dimColor = isDark ? "rgba(240,238,233,0.35)" : theme.textMuted;
  const dividerColor = isDark ? "rgba(240,238,233,0.08)" : theme.cardBorder;

  return (
    <View style={[st.devRoot, { backgroundColor: theme.bg }]}>
      <ScrollView
        contentContainerStyle={{ paddingTop: topPad + 55, paddingBottom: bottomPad + 40, paddingHorizontal: 20 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[st.devTitle, { color: theme.text }]}>
          {isTongue ? (ru ? "Разбор\nскороговорок" : "Tongue-twister\nreview") : ru ? "Разбор ответов" : "Answer breakdown"}
        </Text>

        <View style={{ marginTop: 28, gap: 4 }}>
          <Text style={[st.devLabel, { color: labelColor }]}>{ru ? "ОЦЕНКА" : "SCORE"}</Text>
          <View style={st.devScoreRow}>
            <Text style={[st.devScore, { color: theme.accentInk }]}>{fmtScore(avg)}</Text>
            <Text style={[st.devScoreMax, { color: dimColor }]}>/10</Text>
          </View>
        </View>

        {/* Summary — tip + notes */}
        {tip || notes.length || (!isTongue && aiUsed === 0) ? (
          <View style={[st.devCard, cardStyle, { marginTop: 28, gap: 16 }]}>
            {tip ? (
              <>
                <Text style={[st.devLabel, { color: theme.accentInk }]}>{ru ? "СОВЕТ" : "TIP"}</Text>
                <Text style={[st.devTip, { color: theme.text }]}>{tip}</Text>
              </>
            ) : null}
            {tip && notes.length ? <View style={[st.devDivider, { backgroundColor: dividerColor }]} /> : null}
            {notes.length ? (
              <>
                <Text style={[st.devLabel, { color: labelColor }]}>{ru ? "ЗАМЕЧАНИЯ" : "NOTES"}</Text>
                <View style={{ gap: 10 }}>
                  {notes.map((n, k) => (
                    <View key={k} style={st.devNoteRow}>
                      <View style={[st.devNoteDot, { backgroundColor: theme.accent }]} />
                      <Text style={[st.devNote, { color: isDark ? "rgba(240,238,233,0.9)" : theme.text }]}>{n}</Text>
                    </View>
                  ))}
                </View>
              </>
            ) : null}
            {!isTongue && aiUsed === 0 ? (
              <Text style={[st.devAiNote, { color: isDark ? "rgba(240,238,233,0.4)" : theme.textMuted }]}>
                {ru
                  ? "ИИ-разбор сейчас недоступен - оценка по нашему механизму."
                  : "AI review is currently unavailable - scored by our mechanism."}
              </Text>
            ) : null}
          </View>
        ) : null}

        <Text style={[st.devLabel, { color: labelColor, marginTop: 36, marginBottom: 12 }]}>
          {isTongue ? (ru ? "СКОРОГОВОРКИ" : "TONGUE TWISTERS") : ru ? "ОТВЕТЫ" : "ANSWERS"}
        </Text>

        <View style={{ gap: 12 }}>
          {rows.map((r, i) => {
            const a = r.analysis;
            const wordCount = r.transcript.trim().split(/\s+/).filter(Boolean).length;
            const hasAudio = r.durationSec > 0;
            const expanded = !!open[i];
            const core = isTongue
              ? { label: ru ? "Точность текста" : "Text accuracy", value: r.accuracy?.available ? r.accuracy.score10 : null }
              : { label: ru ? "Грамотность" : "Literacy", value: r.literacy?.available ? r.literacy.overall10 : null };
            const metrics: Array<{ label: string; value: number | null }> = [
              core,
              { label: ru ? "Уверенность" : "Confidence", value: Number(a.score.confidence ?? 0) },
              { label: ru ? "Выразительность" : "Expressiveness", value: Number(a.score.expressiveness ?? 0) },
              { label: ru ? "Чёткость" : "Clarity", value: Number(a.score.clarity ?? 0) },
              { label: ru ? "Громкость" : "Volume", value: Number(a.score.volume ?? 0) },
            ];
            return (
              <View key={i} style={[st.devCard, cardStyle, { gap: 14 }]}>
                <View style={st.devRowHead}>
                  <Text style={[st.devLabel, { color: labelColor }]}>
                    {(isTongue ? (ru ? "СКОРОГОВОРКА " : "TWISTER ") : ru ? "ВОПРОС " : "QUESTION ") +
                      (i + 1) +
                      (hasAudio ? " · " + fmtDuration(r.durationSec) : "")}
                  </Text>
                  <View style={st.devAnsScore}>
                    <Text style={[st.devAnsScoreNum, { color: theme.accentInk }]}>{fmtScore(r.overall10)}</Text>
                    <Text style={[st.devAnsScoreMax, { color: dimColor }]}>/10</Text>
                  </View>
                </View>
                <Text style={[st.devQ, { color: theme.text }]}>{r.question}</Text>

                <PlaybackBar
                  wave={waves[i] ?? []}
                  durationSec={r.durationSec}
                  playing={playingIndex === i}
                  progress={playingIndex === i ? playProgress : 0}
                  disabled={!hasAudio}
                  onPress={() => onPlay(i)}
                  ru={ru}
                />

                <View style={[st.devDivider, { backgroundColor: dividerColor }]} />
                <Pressable
                  onPress={() => setOpen((m) => ({ ...m, [i]: !m[i] }))}
                  style={st.devToggle}
                  accessibilityRole="button"
                  accessibilityState={{ expanded }}
                >
                  <Text style={[st.devToggleText, { color: isDark ? "rgba(240,238,233,0.7)" : theme.textSecondary }]}>
                    {ru ? "Характеристики" : "Breakdown"}
                  </Text>
                  <View style={[st.devChevron, { backgroundColor: isDark ? "rgba(240,238,233,0.08)" : "rgba(38,38,40,0.06)" }]}>
                    <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={16} color={theme.text} />
                  </View>
                </Pressable>

                {expanded ? (
                  <View style={{ gap: 16 }}>
                    <View style={{ gap: 6 }}>
                      <Text style={[st.devSubLabel, { color: isDark ? "rgba(240,238,233,0.4)" : theme.textMuted }]}>
                        {ru ? `ТРАНСКРИБАЦИЯ · ${wordCount} сл.` : `TRANSCRIPTION · ${wordCount} w.`}
                      </Text>
                      <Text style={[st.devTranscript, { color: r.transcript ? theme.textSecondary : isDark ? "rgba(240,238,233,0.45)" : theme.textMuted }]}>
                        {r.transcript
                          ? `«${r.transcript}»`
                          : isTongue
                            ? ru ? "Речь не распознана - проверь микрофон и связь" : "Speech not recognized - check mic and connection"
                            : ru ? "Речь не распознана - нет связи с сервером" : "Speech not recognized - no connection to the server"}
                      </Text>
                    </View>
                    <View style={{ gap: 12 }}>
                      {metrics.map((m) => (
                        <MetricRow key={m.label} label={m.label} value={m.value} isDark={isDark} />
                      ))}
                    </View>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>

        <Pressable
          onPress={onContinue}
          style={({ pressed }) => [
            st.devContinue,
            { backgroundColor: theme.accent, borderColor: theme.ctaStroke, opacity: pressed ? 0.9 : 1 },
          ]}
        >
          <Text style={[st.devContinueText, { color: theme.accentText }]}>{ru ? "Продолжить" : "Continue"}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingLeft: 20, paddingRight: 20 },
  exitBtn: { width: 40, height: 40, alignItems: "flex-start", justifyContent: "center" },
  // Step progress (Figma 174:1892): 258pt wide, 28pt circles over an 8pt track.
  stepWrap: { width: 258, height: 28, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  stepTrack: { position: "absolute", left: 14, right: 14, top: 10, height: 8, borderRadius: 4, overflow: "hidden" },
  stepTrackDone: { height: 8, borderRadius: 4 },
  stepDot: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  stepNum: { fontFamily: "Geologica_900Black", fontSize: 13 },
  titleWrap: { paddingHorizontal: 28, paddingTop: 18, gap: 4 },
  kicker: { fontSize: 12 },
  levelTitle: { fontSize: 22, lineHeight: 28, letterSpacing: -0.11 },
  stage: { flex: 1 },
  // Absolutely filled so the entering and exiting cards overlap in the SAME
  // spot during a swap (slide / cross-fade) instead of stacking in flow — the
  // latter made both task screens visible at once under reanimated 4.
  cardWrap: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: "center",
    paddingHorizontal: 22,
  },
  card: {
    borderRadius: 22,
    borderWidth: 2,
    overflow: "hidden",
    paddingVertical: 40,
    paddingHorizontal: 24,
    minHeight: 220,
    justifyContent: "center",
    gap: 16,
  },
  instruction: { fontSize: 14, lineHeight: 20, textAlign: "center" },
  contentText: { fontSize: 27, lineHeight: 36, textAlign: "center", letterSpacing: -0.27 },
  controls: { paddingHorizontal: 24, alignItems: "center", gap: 12, minHeight: 150, justifyContent: "flex-end" },
  controlSlot: { width: "100%", alignItems: "center", minHeight: 64, justifyContent: "center" },
  emptyHint: { fontSize: 13, lineHeight: 18, textAlign: "center", paddingHorizontal: 12 },
  replaceQWrap: { alignItems: "center" },
  // "Другой вопрос" (Figma 37:5316): 40pt pill, 2pt hairline.
  replaceQBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 40,
    paddingLeft: 16,
    paddingRight: 10,
    borderRadius: 32,
    borderWidth: 2,
  },
  replaceQText: { fontSize: 13.5 },
  replaceQCost: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: 20,
    marginLeft: 2,
    paddingHorizontal: 7,
    borderRadius: 32,
  },
  replaceQCostText: { fontSize: 12, fontFamily: "Geologica_800ExtraBold" },
  scoredWrap: { width: "100%", alignItems: "center", gap: 12 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    minWidth: 240,
    paddingHorizontal: 30,
    height: 56,
    borderRadius: 32,
  },
  // "Анализирую…" (Figma 37:5601): full-width 64pt gold pill.
  analyzingPill: {
    width: "100%",
    height: 64,
    borderRadius: 32,
    borderWidth: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginBottom: 6,
  },
  pillText: { fontSize: 16 },
  retryLink: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 4 },
  retryText: { fontSize: 13 },
  mini: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 18,
    minWidth: 240,
  },
  miniScore: { fontSize: 34, letterSpacing: 0.5 },
  miniVerdict: { fontSize: 16 },
  starsRow: { flexDirection: "row", gap: 3, marginTop: 3 },

  // Corridor (Figma 37:5228). Outer plain View carries absolute fill + zIndex;
  // layout animations live on inner views only.
  corridor: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 20,
    elevation: 20,
  },
  corridorPress: { flex: 1, alignItems: "center", justifyContent: "center", paddingBottom: 80 },
  storyTrack: { position: "absolute", left: 16, right: 16, height: 3, borderRadius: 1.5, overflow: "hidden" },
  storyFill: { height: 3, borderRadius: 1.5 },
  corridorClose: { position: "absolute", right: 22, width: 24, height: 24, alignItems: "center", justifyContent: "center" },
  corridorCard: {
    width: 322,
    backgroundColor: "#F0EEE9",
    borderWidth: 2,
    borderColor: "#262628",
    borderRadius: 22,
    padding: 15,
    paddingBottom: 24,
  },
  corridorArt: { width: 288, height: 288, borderRadius: 22, overflow: "hidden", backgroundColor: "#262628" },
  corridorQuote: {
    fontFamily: "Geologica_900Black",
    fontSize: 24,
    lineHeight: 28.8,
    letterSpacing: -0.12,
    color: "#262628",
    marginTop: 18,
    paddingHorizontal: 4,
  },
  corridorAuthor: {
    fontFamily: "Geologica_700Bold",
    fontSize: 14,
    color: "rgba(38,38,40,0.55)",
    marginTop: 16,
    paddingHorizontal: 4,
  },
  corridorHint: { position: "absolute", left: 0, right: 0, textAlign: "center", fontFamily: "Geologica_600SemiBold", fontSize: 12 },

  // Answer breakdown (Figma 205:2052).
  devRoot: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 30 },
  devTitle: { fontFamily: "Geologica_900Black", fontSize: 28, lineHeight: 34, letterSpacing: -0.28 },
  devLabel: { fontFamily: "Geologica_600SemiBold", fontSize: 12, letterSpacing: 0.6 },
  devScoreRow: { flexDirection: "row", alignItems: "baseline", gap: 6 },
  devScore: { fontFamily: "Geologica_900Black", fontSize: 96, lineHeight: 100, letterSpacing: -2.88 },
  devScoreMax: { fontFamily: "Geologica_700Bold", fontSize: 30, letterSpacing: -0.3 },
  devCard: { borderRadius: 22, borderWidth: 2, padding: 18 },
  devTip: { fontFamily: "Geologica_700Bold", fontSize: 16, lineHeight: 19.2 },
  devDivider: { height: 1, alignSelf: "stretch" },
  devNoteRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  devNoteDot: { width: 6, height: 6, borderRadius: 3 },
  devNote: { flex: 1, fontFamily: "Geologica_600SemiBold", fontSize: 15, lineHeight: 19 },
  devAiNote: { fontFamily: "Geologica_400Regular", fontSize: 12.5, lineHeight: 17.5 },
  devRowHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 28 },
  devAnsScore: { flexDirection: "row", alignItems: "baseline", gap: 2 },
  devAnsScoreNum: { fontFamily: "Geologica_900Black", fontSize: 22, letterSpacing: -0.11 },
  devAnsScoreMax: { fontFamily: "Geologica_700Bold", fontSize: 13 },
  devQ: { fontFamily: "Geologica_800ExtraBold", fontSize: 17, lineHeight: 20.4 },
  devToggle: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", height: 30 },
  devToggleText: { fontFamily: "Geologica_700Bold", fontSize: 14 },
  devChevron: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  devSubLabel: { fontFamily: "Geologica_600SemiBold", fontSize: 11 },
  devTranscript: { fontFamily: "Geologica_400Regular", fontStyle: "italic", fontSize: 14, lineHeight: 18 },
  metricRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  metricLabel: { width: 134, fontFamily: "Geologica_700Bold", fontSize: 14 },
  metricTrack: { flex: 1, height: 6, borderRadius: 3, overflow: "hidden" },
  metricFill: { height: 6, borderRadius: 3 },
  metricValue: { width: 26, textAlign: "right", fontFamily: "Geologica_700Bold", fontSize: 15 },
  devContinue: {
    marginTop: 44,
    height: 58,
    borderRadius: 32,
    borderWidth: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  devContinueText: { fontFamily: "Geologica_800ExtraBold", fontSize: 17 },

  // Recorder bar · Playback (Figma 151:1584)
  pbBar: {
    height: 66,
    borderRadius: 33,
    borderWidth: 3.5,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 9,
    paddingRight: 18,
    overflow: "hidden",
  },
  pbPlay: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  pbStop: { width: 11, height: 11, borderRadius: 2 },
  pbWave: { flex: 1, height: 50, marginLeft: 12, marginRight: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  pbWaveBar: { width: 2.7, borderRadius: 1.4 },
  pbHead: { position: "absolute", top: 2, width: 7, alignItems: "center" },
  pbHeadDot: { width: 7, height: 7, borderRadius: 3.5 },
  pbHeadLine: { width: 2.3, height: 42, borderRadius: 1.2, marginTop: -3.5 },
  pbTime: { fontFamily: "Geologica_700Bold", fontSize: 12 },
});
