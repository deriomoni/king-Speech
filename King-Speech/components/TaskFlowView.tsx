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
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import WaveformVoiceRecorder from "@/components/WaveformVoiceRecorder";
import OscarMascot from "@/components/OscarMascot";
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

  const analysesRef = useRef<SpeechAnalysis[]>([]);
  const scoresRef = useRef<number[]>([]);
  const startRef = useRef(Date.now());
  // Background analysis promises, one slot per question (interview flow).
  const pendingRef = useRef<Array<Promise<TaskAnalysisResult> | null>>([]);
  // In-memory recorded answers (never persisted) + active playback handle.
  const audioRef = useRef<Array<AnswerAudio | null>>([]);
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
    };
  }, []);

  const stopPlayback = async () => {
    const pb = playbackRef.current;
    try { pb.el?.pause?.(); } catch {}
    if (pb.url) { try { URL.revokeObjectURL(pb.url); } catch {} pb.url = undefined; }
    if (pb.sound) { try { await pb.sound.unloadAsync?.(); } catch {} pb.sound = undefined; }
    pb.el = undefined;
    setPlayingIndex(null);
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
        el.onended = () => { try { URL.revokeObjectURL(url); } catch {} setPlayingIndex(null); };
        el.onerror = () => setPlayingIndex(null);
        await el.play();
      } catch {
        setPlayingIndex(null);
      }
    } else {
      try {
        const FileSystem = require("expo-file-system/legacy");
        const { Audio } = require("expo-av");
        const ext = (a.mime?.split("/").pop() || "m4a").replace(/[^a-z0-9]/gi, "") || "m4a";
        const path = `${FileSystem.cacheDirectory}ks_answer_${i}.${ext}`;
        await FileSystem.writeAsStringAsync(path, a.base64, { encoding: "base64" });
        playbackRef.current.files.push(path);
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
        const { sound } = await Audio.Sound.createAsync({ uri: path });
        playbackRef.current.sound = sound;
        sound.setOnPlaybackStatusUpdate((s: any) => {
          if (s?.didJustFinish) setPlayingIndex(null);
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
  useEffect(() => {
    if (!deferred) return;
    const t = setTimeout(() => setCorridor(false), INTERVIEW_CORRIDOR_MS);
    return () => clearTimeout(t);
  }, [deferred]);

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

  const handleInterviewRecorded = (durationSeconds: number, audioBase64?: string, mimeType?: string) => {
    const i = index;
    const t = tasks[i];
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

  const cardBg = deferred ? colors.backgroundSecondary : undefined;

  return (
    <View style={{ flex: 1 }}>
      {/* Header: exit + progress segments */}
      <View style={[st.header, { paddingTop: topPad + 8 }]}>
        <Pressable onPress={onExit} hitSlop={12} style={({ pressed }) => [st.exitBtn, { opacity: pressed ? 0.6 : 1 }]}>
          <Ionicons name="close" size={24} color={ink} />
        </Pressable>
        <View style={st.dotsRow}>
          {tasks.map((_, i) => {
            const done = deferred
              ? i < index
              : i < index || (i === index && phase === "scored");
            const active = i === index;
            return (
              <View
                key={i}
                style={[
                  st.dot,
                  {
                    flex: 1,
                    backgroundColor: done
                      ? brand.gold
                      : active
                      ? brand.violet
                      : isDark
                      ? "rgba(255,255,255,0.14)"
                      : "rgba(14,14,16,0.12)",
                  },
                ]}
              />
            );
          })}
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Level title (small) */}
      <View style={st.titleWrap}>
        <Text style={[st.kicker, { color: accent, fontFamily: "Rubik_600SemiBold" }]}>
          {isInterview
            ? `${ru ? "Вопрос" : "Question"} ${index + 1}/${total}`
            : isTongue
            ? `${ru ? "Скороговорка" : "Tongue twister"} ${index + 1}/${total}`
            : `${kindLabel.toUpperCase()} · ${index + 1}/${total}`}
        </Text>
        <Text numberOfLines={1} style={[st.levelTitle, { color: ink, fontFamily: "Rubik_700Bold" }]}>
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
                ? { backgroundColor: cardBg, borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(20,22,26,0.08)" }
                : { borderColor: brand.borderViolet },
            ]}
          >
            {!deferred ? (
              <LinearGradient
                colors={isDark ? ["#1C1830", "#141221"] : ["#F3EFFB", "#EDE7FA"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
            ) : null}
            {task.instruction && !deferred ? (
              <Text style={[st.instruction, { color: isDark ? "rgba(242,238,251,0.6)" : colors.textSecondary, fontFamily: "Nunito_600SemiBold" }]}>
                {task.instruction}
              </Text>
            ) : null}
            {/* Clean flow: text fades in over 1.5s each new card. */}
            <Animated.Text
              key={`q-${index}-${replaceCounts[index] ?? 0}`}
              entering={deferred ? FadeIn.duration(1500) : undefined}
              style={[
                st.contentText,
                { color: deferred ? colors.text : isDark ? "#F5F1FF" : colors.text, fontFamily: "Rubik_700Bold" },
              ]}
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
              disabled={!canReplaceQuestion || coins < REPLACE_Q_COST}
              style={({ pressed }) => [
                st.replaceQBtn,
                {
                  backgroundColor: colors.backgroundSecondary,
                  borderColor: colors.border,
                  opacity:
                    !canReplaceQuestion || coins < REPLACE_Q_COST
                      ? 0.5
                      : pressed
                        ? 0.7
                        : 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={ru ? "Другой вопрос" : "Another question"}
            >
              <Ionicons name="shuffle" size={16} color={ink} />
              <Text style={[st.replaceQText, { color: ink, fontFamily: "Nunito_700Bold" }]}>
                {usedHere >= replaceLimit
                  ? ru
                    ? "Замен больше нет"
                    : "No swaps left"
                  : ru
                    ? "Другой вопрос"
                    : "Another question"}
              </Text>
              {usedHere < replaceLimit ? (
                <View style={[st.replaceQCost, { backgroundColor: colors.border }]}>
                  <CoinIcon size={11} color={ink} />
                  <Text style={[st.replaceQCostText, { color: ink }]}>{REPLACE_Q_COST}</Text>
                </View>
              ) : null}
            </Pressable>
          </Animated.View>
        ) : null}

        {emptyTake ? (
          <Animated.Text
            entering={FadeIn}
            style={[st.emptyHint, { color: inkSoft, fontFamily: "Nunito_600SemiBold" }]}
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
              startLabel={isInterview ? (ru ? "Ответить" : "Answer") : isTongue ? (ru ? "Прочитать" : "Read") : undefined}
            />
          </Animated.View>
        ) : phase === "analyzing" ? (
          <Animated.View key="ana" entering={FadeIn.duration(200)} style={[st.controlSlot, st.pill, { backgroundColor: brand.gold }]}>
            <ActivityIndicator size="small" color={brand.onGold} />
            <Text style={[st.pillText, { color: brand.onGold, fontFamily: "Nunito_800ExtraBold" }]}>
              {ru ? "Анализирую…" : "Analyzing…"}
            </Text>
          </Animated.View>
        ) : (
          <Animated.View key="scored" entering={FadeInDown.duration(300)} style={st.scoredWrap}>
            {current ? <MiniScore analysis={current} ru={ru} /> : null}
            <Animated.View entering={ZoomIn.duration(420)}>
              <Pressable
                onPress={advance}
                style={({ pressed }) => [st.pill, st.nextPill, { opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }]}
              >
                <Text style={[st.pillText, { color: brand.onGold, fontFamily: "Nunito_800ExtraBold" }]}>
                  {isLast ? (ru ? "Смотреть оценку" : "See score") : (ru ? "Далее" : "Next")}
                </Text>
                <Ionicons name="arrow-forward" size={20} color={brand.onGold} />
              </Pressable>
            </Animated.View>
            <Pressable onPress={retryTake} hitSlop={8} style={({ pressed }) => [st.retryLink, { opacity: pressed ? 0.5 : 1 }]}>
              <Ionicons name="refresh" size={14} color={inkSoft} />
              <Text style={[st.retryText, { color: inkSoft, fontFamily: "Nunito_600SemiBold" }]}>
                {ru ? "Переписать" : "Re-record"}
              </Text>
            </Pressable>
          </Animated.View>
        )}
      </View>

      {/* Darken curtain before the flower blooms */}
      {darken ? (
        <Animated.View
          entering={FadeIn.duration(420)}
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: brand.ink }]}
        />
      ) : null}

      {/* Interview corridor — 7s mascot loading curtain on entry */}
      {corridor ? (
        <Animated.View exiting={FadeOut.duration(420)} style={[st.corridor, { backgroundColor: colors.background }]}>
          <OscarMascot emotion="happy" size={180} />
          <Text style={[st.corridorQuote, { color: colors.text, fontFamily: "Rubik_700Bold" }]}>
            {isTongue
              ? ru ? "Медленно и чётко. Скорость придёт." : "Slow and clear. Speed will come."
              : ru ? "Дыши ровно. Говори как есть." : "Breathe easy. Speak your mind."}
          </Text>
          <Text style={[st.corridorHint, { color: colors.textMuted, fontFamily: "Rubik_600SemiBold" }]}>
            {(isTongue ? (ru ? "Готовим скороговорки" : "Preparing tongue twisters") : ru ? "Готовим интервью" : "Preparing the interview").toUpperCase()}
          </Text>
        </Animated.View>
      ) : null}

      {/* Developer report — transcripts + scoring breakdown (test build) */}
      {devRows ? (
        <DevReport
          rows={devRows}
          ru={ru}
          isTongue={isTongue}
          colors={colors}
          isDark={isDark}
          topPad={topPad}
          bottomPad={bottomPad}
          playingIndex={playingIndex}
          onPlay={playAnswer}
          onContinue={finishFromDev}
        />
      ) : null}
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
      <Text style={[st.miniScore, { color: tone, fontFamily: "Rubik_700Bold" }]}>{s.toFixed(1)}</Text>
      <View style={{ flex: 1 }}>
        <Text style={[st.miniVerdict, { color: tone, fontFamily: "Nunito_800ExtraBold" }]}>{verdict}</Text>
        <View style={st.starsRow}>
          {[1, 2, 3].map((i) => (
            <Ionicons key={i} name={i <= stars ? "star" : "star-outline"} size={14} color={i <= stars ? brand.gold : "rgba(150,150,160,0.5)"} />
          ))}
        </View>
      </View>
    </Animated.View>
  );
}

// Answer breakdown shown at the end of an interview level. Lists each answer's
// transcription, duration, a replay control, and a per-aspect score with a
// short explanation of what each aspect measures.
interface AspectInfo {
  key: keyof SpeechAnalysis["score"];
  label: string;
  desc: string;
  internal?: boolean;
}
function DevReport({
  rows,
  ru,
  isTongue,
  colors,
  isDark,
  topPad,
  bottomPad,
  playingIndex,
  onPlay,
  onContinue,
}: {
  rows: DevRow[];
  ru: boolean;
  isTongue: boolean;
  colors: import("@/constants/colors").AppColors;
  isDark: boolean;
  topPad: number;
  bottomPad: number;
  playingIndex: number | null;
  onPlay: (index: number) => void;
  onContinue: () => void;
}) {
  const overalls = rows.map((r) => r.overall10);
  const avg = overalls.reduce((s, v) => s + v, 0) / Math.max(1, overalls.length);
  const aiUsed = rows.filter((r) => r.ai?.available).length;
  const border = isDark ? "rgba(255,255,255,0.08)" : "rgba(20,22,26,0.08)";

  // Scored aspects (v2). Grammar/literacy is rendered separately above these as
  // the weight-40 core. Tempo & pauses are NOT here — they are internal signals.
  const ASPECTS: AspectInfo[] = ru
    ? [
        { key: "confidence", label: "Уверенность", desc: "Устойчивость голоса, завершённость интонации, беглость без запинок." },
        { key: "expressiveness", label: "Выразительность", desc: "Интонационный диапазон и эмоциональная вовлечённость." },
        { key: "clarity", label: "Чёткость", desc: "Разборчивость дикции: чистота согласных и уверенность распознавания." },
        { key: "volume", label: "Громкость", desc: "Фактическая громкость голоса — не тихо и без перегруза." },
      ]
    : [
        { key: "confidence", label: "Confidence", desc: "Voice stability, finished intonation, fluency without stumbles." },
        { key: "expressiveness", label: "Expressiveness", desc: "Pitch range and emotional engagement." },
        { key: "clarity", label: "Clarity", desc: "Diction intelligibility: clean consonants and recognition confidence." },
        { key: "volume", label: "Volume", desc: "Actual loudness of your voice — not too quiet, no clipping." },
      ];

  return (
    <Animated.View entering={FadeIn.duration(260)} style={[st.devRoot, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={{ paddingTop: topPad + 20, paddingBottom: bottomPad + 100, paddingHorizontal: 20, gap: 14 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[st.devTitle, { color: colors.text, fontFamily: "Rubik_700Bold" }]}>
          {isTongue ? (ru ? "Разбор скороговорок" : "Tongue-twister review") : ru ? "Разбор ответов" : "Answer breakdown"}
        </Text>
        <Text style={[st.devLede, { color: colors.textSecondary, fontFamily: "Nunito_600SemiBold" }]}>
          {isTongue
            ? ru
              ? "Что распозналось и сколько слов совпало с текстом скороговорки."
              : "What was recognized and how many words matched the text."
            : ru
            ? "Твоя речь, распознанная в текст, и из чего сложилась оценка."
            : "Your speech turned into text, and what the score is built from."}
        </Text>

        {/* Aggregate */}
        <View style={[st.devCard, { backgroundColor: colors.backgroundSecondary, borderColor: border }]}>
          <Text style={[st.devAggScore, { color: colors.text, fontFamily: "Rubik_700Bold" }]}>
            {fmtScore(avg)}<Text style={[st.devAggMax, { color: colors.textMuted }]}> / 10</Text>
          </Text>
          <Text style={[st.devAggNote, { color: colors.textSecondary, fontFamily: "Nunito_600SemiBold" }]}>
            {isTongue
              ? ru
                ? `Средняя из ${rows.length} (${overalls.map((v) => fmtScore(v)).join(" + ")}) ÷ ${rows.length}. Каждая = 50% точность текста + 20% чёткость + 15% уверенность + 8% выразительность + 7% громкость.`
                : `Average of ${rows.length} (${overalls.map((v) => fmtScore(v)).join(" + ")}) ÷ ${rows.length}. Each = 50% text accuracy + 20% clarity + 15% confidence + 8% expressiveness + 7% volume.`
              : ru
              ? `Средняя из ${rows.length} ответов (${overalls.map((v) => fmtScore(v)).join(" + ")}) ÷ ${rows.length}. Каждый ответ = 90% наш механизм + 10% ИИ (ответил ли на вопрос + грамотность).`
              : `Average of ${rows.length} answers (${overalls.map((v) => fmtScore(v)).join(" + ")}) ÷ ${rows.length}. Each answer = 90% our mechanism + 10% AI (answered the question + literacy).`}
          </Text>
          {!isTongue && aiUsed === 0 ? (
            <Text style={[st.devAggNote, { color: colors.textMuted, fontFamily: "Nunito_600SemiBold" }]}>
              {ru ? "ИИ-разбор сейчас недоступен — оценка полностью по нашему механизму." : "AI review is currently unavailable — scored entirely by our mechanism."}
            </Text>
          ) : null}
        </View>

        {/* Per-answer rows */}
        {rows.map((r, i) => {
          const a = r.analysis;
          const wordCount = r.transcript.trim().split(/\s+/).filter(Boolean).length;
          const isPlaying = playingIndex === i;
          const hasAudio = r.durationSec > 0;
          return (
            <View key={i} style={[st.devCard, { backgroundColor: colors.backgroundSecondary, borderColor: border }]}>
              <View style={st.devRowHead}>
                <Text style={[st.devQNum, { color: colors.textMuted, fontFamily: "Rubik_600SemiBold" }]}>
                  {(isTongue ? (ru ? "СКОРОГОВОРКА " : "TWISTER ") : ru ? "ВОПРОС " : "QUESTION ") + (i + 1) + (hasAudio ? " · " + fmtDuration(r.durationSec) : "")}
                </Text>
                <Text style={[st.devScore, { color: toneFor(r.overall10), fontFamily: "Rubik_700Bold" }]}>
                  {fmtScore(r.overall10)}
                </Text>
              </View>
              <Text style={[st.devQ, { color: colors.text, fontFamily: "Nunito_700Bold" }]}>{r.question}</Text>

              {/* ИИ-судья (только интервью): ответил ли на вопрос (главное) + грамотность */}
              {!isTongue ? (
                r.ai && r.ai.available ? (
                  <View style={[st.aiRow, { borderColor: toneFor(r.ai.relevance ?? 0) + "55", backgroundColor: toneFor(r.ai.relevance ?? 0) + (isDark ? "1E" : "12") }]}>
                    <Ionicons
                      name={r.ai.verdict === "yes" ? "checkmark-circle" : r.ai.verdict === "off" ? "close-circle" : "alert-circle"}
                      size={17}
                      color={toneFor(r.ai.relevance ?? 0)}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={[st.aiTitle, { color: colors.text, fontFamily: "Nunito_800ExtraBold" }]}>
                        {`${verdictLabel(r.ai.verdict, ru)} · ${ru ? "ответ" : "answer"} ${fmtScore(r.ai.relevance ?? 0)}/10 · ${ru ? "грамотность" : "literacy"} ${fmtScore(r.ai.competence ?? 0)}/10`}
                      </Text>
                      {r.ai.note ? (
                        <Text style={[st.aiNote, { color: colors.textSecondary, fontFamily: "Nunito_400Regular" }]}>{r.ai.note}</Text>
                      ) : null}
                    </View>
                  </View>
                ) : (
                  <Text style={[st.aiOffline, { color: colors.textMuted, fontFamily: "Nunito_600SemiBold" }]}>
                    {ru ? "ИИ-разбор недоступен — оценка по нашему механизму." : "AI review unavailable — scored by our mechanism."}
                  </Text>
                )
              ) : null}

              {hasAudio ? (
                <Pressable
                  onPress={() => onPlay(i)}
                  style={({ pressed }) => [
                    st.playBtn,
                    { borderColor: brand.violet + "66", backgroundColor: brand.violet + (isDark ? "22" : "14"), opacity: pressed ? 0.7 : 1 },
                  ]}
                >
                  <Ionicons name={isPlaying ? "stop" : "play"} size={15} color={brand.violet} />
                  <Text style={[st.playText, { color: brand.violet, fontFamily: "Nunito_700Bold" }]}>
                    {isPlaying ? (ru ? "Остановить" : "Stop") : (ru ? "Прослушать запись" : "Play recording")}
                  </Text>
                </Pressable>
              ) : null}

              <Text style={[st.devSubLabel, { color: colors.textMuted, fontFamily: "Rubik_600SemiBold" }]}>
                {ru ? `ТРАНСКРИБАЦИЯ · ${wordCount} сл.` : `TRANSCRIPTION · ${wordCount} w.`}
              </Text>
              <Text style={[st.devTranscript, { color: colors.textSecondary, fontFamily: "Nunito_400Regular" }]}>
                {r.transcript ? `«${r.transcript}»` : ru ? "— пусто (не распознано / нет связи с сервером) —" : "— empty (not recognized / no server) —"}
              </Text>

              {/* Точность текста — ядро для скороговорок (вес 50) */}
              {isTongue && r.accuracy ? (
                <View style={[st.litCard, { borderColor: toneFor(r.accuracy.score10) + "44", backgroundColor: toneFor(r.accuracy.score10) + (isDark ? "1E" : "12") }]}>
                  <View style={st.litHead}>
                    <View style={{ flex: 1 }}>
                      <Text style={[st.litTitle, { color: colors.text, fontFamily: "Nunito_800ExtraBold" }]}>
                        {ru ? "Точность текста" : "Text accuracy"}
                        <Text style={[st.aspTag, { color: colors.textMuted, fontFamily: "Nunito_600SemiBold" }]}>{ru ? "  · вес 50" : "  · w 50"}</Text>
                      </Text>
                      <Text style={[st.aspDesc, { color: colors.textSecondary, fontFamily: "Nunito_400Regular" }]}>
                        {ru ? "Каждое слово скороговорки — попало в распознанный текст или нет. Повторы не штрафуют." : "Each word of the text — did it land in the recognized speech? Repeats don't count against you."}
                      </Text>
                    </View>
                    <Text style={[st.litScore, { color: toneFor(r.accuracy.score10), fontFamily: "Rubik_700Bold" }]}>
                      {r.accuracy.available ? fmtScore(r.accuracy.score10) : "—"}
                    </Text>
                  </View>
                  {r.accuracy.available ? (
                    <>
                      <Text style={[st.litSub, { color: colors.textMuted, fontFamily: "Nunito_700Bold" }]}>
                        {ru
                          ? `Точность ${Math.round(r.accuracy.accuracy * 100)}% · слов ${r.accuracy.matched}/${r.accuracy.total} · пропущено ${r.accuracy.missed}`
                          : `Accuracy ${Math.round(r.accuracy.accuracy * 100)}% · words ${r.accuracy.matched}/${r.accuracy.total} · missed ${r.accuracy.missed}`}
                      </Text>
                      {r.accuracy.missedWords.length ? (
                        <>
                          <Text style={[st.aspDesc, { color: colors.textMuted, fontFamily: "Nunito_600SemiBold" }]}>
                            {ru ? "Пропущенные слова:" : "Missed words:"}
                          </Text>
                          <View style={st.litViolWrap}>
                            {r.accuracy.missedWords.slice(0, 14).map((w, k) => (
                              <View key={`${w}-${k}`} style={[st.litChip, { backgroundColor: toneFor(2) + "22" }]}>
                                <Text style={[st.litChipText, { color: toneFor(2), fontFamily: "Nunito_700Bold" }]}>{w}</Text>
                              </View>
                            ))}
                          </View>
                        </>
                      ) : (
                        <Text style={[st.aspDesc, { color: colors.textSecondary, fontFamily: "Nunito_400Regular" }]}>
                          {ru ? "Все слова произнесены — отлично!" : "Every word was said — great!"}
                        </Text>
                      )}
                    </>
                  ) : (
                    <Text style={[st.aspDesc, { color: colors.textSecondary, fontFamily: "Nunito_400Regular" }]}>
                      {ru ? "Речь не распозналась — проверь микрофон/связь." : "Speech wasn't recognized — check mic/connection."}
                    </Text>
                  )}
                </View>
              ) : null}

              {/* Грамотность — ядро оценки (вес 40, только интервью) */}
              {!isTongue && r.literacy ? (
                <View style={[st.litCard, { borderColor: toneFor(r.literacy.overall10) + "44", backgroundColor: toneFor(r.literacy.overall10) + (isDark ? "1E" : "12") }]}>
                <View style={st.litHead}>
                  <View style={{ flex: 1 }}>
                    <Text style={[st.litTitle, { color: colors.text, fontFamily: "Nunito_800ExtraBold" }]}>
                      {ru ? "Грамотность" : "Literacy"}
                      <Text style={[st.aspTag, { color: colors.textMuted, fontFamily: "Nunito_600SemiBold" }]}>{ru ? "  · вес 40" : "  · w 40"}</Text>
                    </Text>
                    <Text style={[st.aspDesc, { color: colors.textSecondary, fontFamily: "Nunito_400Regular" }]}>
                      {ru
                        ? "Слова-паразиты и грамматика словоформ. Главный параметр речи."
                        : "Filler words and word-form grammar. The core of the score."}
                    </Text>
                  </View>
                  <Text style={[st.litScore, { color: toneFor(r.literacy.overall10), fontFamily: "Rubik_700Bold" }]}>
                    {r.literacy.available ? fmtScore(r.literacy.overall10) : "—"}
                  </Text>
                </View>

                {r.literacy.available ? (
                  <>
                    <Text style={[st.litSub, { color: colors.textMuted, fontFamily: "Nunito_700Bold" }]}>
                      {ru
                        ? `Паразиты ${fmtScore(r.literacy.g1 / 10)} · Словоформы ${fmtScore(r.literacy.g2 / 10)} · Построение ${fmtScore(r.literacy.g3 / 10)}`
                        : `Fillers ${fmtScore(r.literacy.g1 / 10)} · Word forms ${fmtScore(r.literacy.g2 / 10)} · Structure ${fmtScore(r.literacy.g3 / 10)}`}
                    </Text>
                    {r.literacy.incomplete ? (
                      <Text style={[st.litHabit, { color: toneFor(3), fontFamily: "Nunito_800ExtraBold" }]}>
                        {ru
                          ? "Мысль звучит незавершённой или ответ слишком короткий."
                          : "The thought sounds unfinished or the answer is too short."}
                      </Text>
                    ) : null}
                    {r.literacy.habit ? (
                      <Text style={[st.litHabit, { color: colors.text, fontFamily: "Nunito_800ExtraBold" }]}>
                        {ru ? `Твоё слово-паразит: «${r.literacy.habit.lemma}» ×${r.literacy.habit.count}` : `Your filler word: “${r.literacy.habit.lemma}” ×${r.literacy.habit.count}`}
                      </Text>
                    ) : null}
                    {r.literacy.violations.length ? (
                      <View style={st.litViolWrap}>
                        {r.literacy.violations.map((v) => (
                          <View key={v.lemma} style={[st.litChip, { backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(20,22,26,0.05)" }]}>
                            <Text style={[st.litChipText, { color: colors.textSecondary, fontFamily: "Nunito_700Bold" }]}>
                              «{v.lemma}» ×{v.count}
                            </Text>
                          </View>
                        ))}
                      </View>
                    ) : (
                      <Text style={[st.aspDesc, { color: colors.textSecondary, fontFamily: "Nunito_400Regular" }]}>
                        {ru ? "Паразитов и грубых форм не найдено — чисто." : "No fillers or bad forms found — clean."}
                      </Text>
                    )}
                  </>
                ) : (
                  <Text style={[st.aspDesc, { color: colors.textSecondary, fontFamily: "Nunito_400Regular" }]}>
                    {ru ? "Недостаточно распознанного текста для оценки грамотности." : "Not enough recognized text to score literacy."}
                  </Text>
                )}
                </View>
              ) : null}

              {/* Per-aspect rows with a short explanation each */}
              <View style={st.aspList}>
                {ASPECTS.map((asp) => (
                  <View key={asp.key} style={st.aspRow}>
                    <Text style={[st.aspVal, { color: asp.internal ? colors.textMuted : toneFor(Number(a.score[asp.key] ?? 0)), fontFamily: "Rubik_700Bold" }]}>
                      {fmtScore(Number(a.score[asp.key] ?? 0))}
                    </Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[st.aspLabel, { color: colors.text, fontFamily: "Nunito_800ExtraBold" }]}>
                        {asp.label}
                        {asp.internal ? (
                          <Text style={[st.aspTag, { color: colors.textMuted, fontFamily: "Nunito_600SemiBold" }]}>
                            {ru ? "  · внутр." : "  · internal"}
                          </Text>
                        ) : null}
                      </Text>
                      <Text style={[st.aspDesc, { color: colors.textSecondary, fontFamily: "Nunito_400Regular" }]}>
                        {asp.desc}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>

              {a.recommendations && a.recommendations.length ? (
                <Text style={[st.devNote, { color: colors.textSecondary, fontFamily: "Nunito_400Regular" }]}>
                  {(ru ? "Замечания: " : "Notes: ") + a.recommendations.join(" · ")}
                </Text>
              ) : null}
            </View>
          );
        })}

        <Text style={[st.devPrivacy, { color: colors.textMuted, fontFamily: "Nunito_600SemiBold" }]}>
          {ru
            ? "Записи не сохраняются на устройстве и удаляются при выходе из уровня."
            : "Recordings are never saved on the device and are erased when you leave the level."}
        </Text>
      </ScrollView>

      <View style={[st.devFooter, { paddingBottom: bottomPad + 16, backgroundColor: colors.background }]}>
        <Pressable onPress={onContinue} style={({ pressed }) => [st.pill, st.nextPill, { opacity: pressed ? 0.9 : 1 }]}>
          <Text style={[st.pillText, { color: brand.onGold, fontFamily: "Nunito_800ExtraBold" }]}>
            {ru ? "Продолжить" : "Continue"}
          </Text>
          <Ionicons name="arrow-forward" size={20} color={brand.onGold} />
        </Pressable>
      </View>
    </Animated.View>
  );
}

const st = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, gap: 12 },
  exitBtn: { width: 40, height: 40, alignItems: "flex-start", justifyContent: "center" },
  dotsRow: { flex: 1, flexDirection: "row", gap: 6, alignItems: "center" },
  dot: { height: 5, borderRadius: 3 },
  titleWrap: { paddingHorizontal: 28, paddingTop: 18, gap: 4 },
  kicker: { fontSize: 12, letterSpacing: 1.6 },
  levelTitle: { fontSize: 22, lineHeight: 28 },
  stage: { flex: 1, justifyContent: "center", paddingHorizontal: 22 },
  cardWrap: { width: "100%" },
  card: {
    borderRadius: 28,
    borderWidth: 1,
    overflow: "hidden",
    paddingVertical: 40,
    paddingHorizontal: 26,
    minHeight: 220,
    justifyContent: "center",
    gap: 16,
  },
  instruction: { fontSize: 14, lineHeight: 20, textAlign: "center" },
  contentText: { fontSize: 27, lineHeight: 36, textAlign: "center", letterSpacing: 0.2 },
  controls: { paddingHorizontal: 24, alignItems: "center", gap: 12, minHeight: 150, justifyContent: "flex-end" },
  controlSlot: { width: "100%", alignItems: "center", minHeight: 64, justifyContent: "center" },
  emptyHint: { fontSize: 13, lineHeight: 18, textAlign: "center", paddingHorizontal: 12 },
  replaceQWrap: { alignItems: "center" },
  replaceQBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
  },
  replaceQText: { fontSize: 13.5 },
  replaceQCost: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginLeft: 2,
    paddingVertical: 2,
    paddingHorizontal: 7,
    borderRadius: 10,
  },
  replaceQCostText: { fontSize: 12, fontFamily: "Nunito_800ExtraBold" },
  scoredWrap: { width: "100%", alignItems: "center", gap: 12 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    minWidth: 240,
    paddingHorizontal: 30,
    paddingVertical: 16,
    borderRadius: 30,
  },
  nextPill: {
    backgroundColor: brand.gold,
    ...Platform.select({
      ios: { shadowColor: brand.gold, shadowOpacity: 0.4, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } },
      android: { elevation: 6 },
      default: {},
    }),
  },
  pillText: { fontSize: 16, letterSpacing: 0.3 },
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

  // Interview corridor
  corridor: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    zIndex: 20,
  },
  corridorQuote: { fontSize: 22, lineHeight: 30, textAlign: "center", marginTop: 24 },
  corridorHint: { fontSize: 11, letterSpacing: 2, marginTop: 16 },

  // Answer-breakdown report
  devRoot: { ...StyleSheet.absoluteFillObject, zIndex: 30 },
  devTitle: { fontSize: 26, lineHeight: 31 },
  devLede: { fontSize: 14, lineHeight: 20, marginTop: -6 },
  devCard: { borderRadius: 18, borderWidth: 1, padding: 16, gap: 8 },
  devAggScore: { fontSize: 40, lineHeight: 46 },
  devAggMax: { fontSize: 20 },
  devAggNote: { fontSize: 13, lineHeight: 19 },
  devRowHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  devQNum: { fontSize: 11, letterSpacing: 1.2 },
  devScore: { fontSize: 22 },
  devQ: { fontSize: 16, lineHeight: 22 },
  playBtn: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 2,
  },
  playText: { fontSize: 13.5 },
  devSubLabel: { fontSize: 10.5, letterSpacing: 1.2, marginTop: 6 },
  devTranscript: { fontSize: 14, lineHeight: 21 },
  aiRow: { flexDirection: "row", alignItems: "flex-start", gap: 9, borderRadius: 12, borderWidth: 1, padding: 11, marginTop: 4 },
  aiTitle: { fontSize: 13.5, lineHeight: 19 },
  aiNote: { fontSize: 12.5, lineHeight: 18, marginTop: 3 },
  aiOffline: { fontSize: 12.5, lineHeight: 18, marginTop: 4 },
  litCard: { borderRadius: 14, borderWidth: 1, padding: 13, gap: 8, marginTop: 8 },
  litHead: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  litTitle: { fontSize: 16 },
  litScore: { fontSize: 30, lineHeight: 32 },
  litSub: { fontSize: 12.5, lineHeight: 18 },
  litHabit: { fontSize: 14, lineHeight: 19 },
  litViolWrap: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 2 },
  litChip: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 9 },
  litChipText: { fontSize: 12.5 },
  aspList: { gap: 12, marginTop: 8 },
  aspRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  aspVal: { fontSize: 20, minWidth: 34, textAlign: "right" },
  aspLabel: { fontSize: 15 },
  aspTag: { fontSize: 12 },
  aspDesc: { fontSize: 12.5, lineHeight: 18, marginTop: 2 },
  devNote: { fontSize: 12.5, lineHeight: 18, marginTop: 4 },
  devPrivacy: { fontSize: 12, lineHeight: 17, textAlign: "center", marginTop: 4, paddingHorizontal: 10 },
  devFooter: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    paddingTop: 12,
  },
});
