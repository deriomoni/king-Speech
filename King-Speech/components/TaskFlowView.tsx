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
import type { SpeechAnalysis } from "@/services/speechAnalysis";
import type { Task } from "@/context/GameContext";
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
  /** Interview flow: clean bg, white card, deferred background analysis. */
  isInterview?: boolean;
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
  analysis: SpeechAnalysis;
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
  // Ink that reads on the palette background (which may be light OR dark,
  // independent of theme). Falls back to the theme text color.
  const ink = screenBg ? readableText(screenBg) : colors.text;
  const inkSoft = ink === "#FFFFFF" ? "rgba(255,255,255,0.62)" : "rgba(20,22,26,0.6)";
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("record");
  const [current, setCurrent] = useState<SpeechAnalysis | null>(null);
  const [emptyTake, setEmptyTake] = useState(false);
  const [darken, setDarken] = useState(false);

  // Interview-only state.
  const [corridor, setCorridor] = useState(isInterview);
  const [devRows, setDevRows] = useState<DevRow[] | null>(null);

  const analysesRef = useRef<SpeechAnalysis[]>([]);
  const scoresRef = useRef<number[]>([]);
  const startRef = useRef(Date.now());
  // Background analysis promises, one slot per question (interview flow).
  const pendingRef = useRef<Array<Promise<TaskAnalysisResult> | null>>([]);

  const total = tasks.length;
  const task = tasks[index];
  const isLast = index >= total - 1;

  // 7s mascot corridor before the interview begins (mirrors the reading level).
  useEffect(() => {
    if (!isInterview) return;
    const t = setTimeout(() => setCorridor(false), INTERVIEW_CORRIDOR_MS);
    return () => clearTimeout(t);
  }, [isInterview]);

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
    scoresRef.current = analyses.map((a) => a.score.overall);
    const rows: DevRow[] = tasks.map((t, i) => ({
      question: t.content || t.title || "",
      transcript: analyses[i]?.transcript || "",
      analysis: analyses[i] ?? emptyAnalysis(),
    }));
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    setDevRows(rows);
  };

  const handleInterviewRecorded = (durationSeconds: number, audioBase64?: string) => {
    const i = index;
    const t = tasks[i];
    // Kick off analysis in the background and stash its promise.
    pendingRef.current[i] = analyzeGenericTask({
      originalText: t.content || t.instruction || "",
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
    tasks.forEach((t, i) => onTaskScored(t.taskNumber, scoresRef.current[i] ?? 0));
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

  const cardBg = isInterview ? colors.backgroundSecondary : undefined;

  return (
    <View style={{ flex: 1 }}>
      {/* Header: exit + progress segments */}
      <View style={[st.header, { paddingTop: topPad + 8 }]}>
        <Pressable onPress={onExit} hitSlop={12} style={({ pressed }) => [st.exitBtn, { opacity: pressed ? 0.6 : 1 }]}>
          <Ionicons name="close" size={24} color={ink} />
        </Pressable>
        <View style={st.dotsRow}>
          {tasks.map((_, i) => {
            const done = isInterview
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
          entering={isInterview ? FadeIn.duration(300) : SlideInRight.duration(360)}
          exiting={isInterview ? FadeOut.duration(160) : SlideOutLeft.duration(240)}
          style={st.cardWrap}
        >
          <View
            style={[
              st.card,
              isInterview
                ? { backgroundColor: cardBg, borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(20,22,26,0.08)" }
                : { borderColor: brand.borderViolet },
            ]}
          >
            {!isInterview ? (
              <LinearGradient
                colors={isDark ? ["#1C1830", "#141221"] : ["#F3EFFB", "#EDE7FA"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
            ) : null}
            {task.instruction && !isInterview ? (
              <Text style={[st.instruction, { color: isDark ? "rgba(242,238,251,0.6)" : colors.textSecondary, fontFamily: "Nunito_600SemiBold" }]}>
                {task.instruction}
              </Text>
            ) : null}
            {/* Interview: text fades in over 1.5s each new question. */}
            <Animated.Text
              key={`q-${index}`}
              entering={isInterview ? FadeIn.duration(1500) : undefined}
              style={[
                st.contentText,
                { color: isInterview ? colors.text : isDark ? "#F5F1FF" : colors.text, fontFamily: "Rubik_700Bold" },
              ]}
            >
              {task.content || task.title}
            </Animated.Text>
          </View>
        </Animated.View>
      </View>

      {/* Bottom control — record → (analyzing) → mini-score + gold Next pill */}
      <View style={[st.controls, { paddingBottom: bottomPad + 14 }]}>
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
              onRecordingComplete={isInterview ? handleInterviewRecorded : handleRecordingComplete}
              colors={colors}
              startLabel={isInterview ? (ru ? "Ответить" : "Answer") : undefined}
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
            <Animated.View entering={ZoomIn.springify().damping(13)}>
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
          <OscarMascot emotion="happy" size={150} />
          <Text style={[st.corridorQuote, { color: colors.text, fontFamily: "Rubik_700Bold" }]}>
            {ru ? "Дыши ровно. Говори как есть." : "Breathe easy. Speak your mind."}
          </Text>
          <Text style={[st.corridorHint, { color: colors.textMuted, fontFamily: "Rubik_600SemiBold" }]}>
            {(ru ? "Готовим интервью" : "Preparing the interview").toUpperCase()}
          </Text>
        </Animated.View>
      ) : null}

      {/* Developer report — transcripts + scoring breakdown (test build) */}
      {devRows ? (
        <DevReport
          rows={devRows}
          ru={ru}
          colors={colors}
          isDark={isDark}
          topPad={topPad}
          bottomPad={bottomPad}
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

// Developer-only report shown at the end of an interview level. Lists each
// answer's transcript and per-aspect score, plus how the level score is built.
function DevReport({
  rows,
  ru,
  colors,
  isDark,
  topPad,
  bottomPad,
  onContinue,
}: {
  rows: DevRow[];
  ru: boolean;
  colors: import("@/constants/colors").AppColors;
  isDark: boolean;
  topPad: number;
  bottomPad: number;
  onContinue: () => void;
}) {
  const overalls = rows.map((r) => r.analysis.score.overall);
  const avg = overalls.reduce((s, v) => s + v, 0) / Math.max(1, overalls.length);
  const aspectKeys: Array<keyof SpeechAnalysis["score"]> = [
    "clarity",
    "confidence",
    "volume",
    "tempo",
    "expressiveness",
    "pauses",
  ];
  const aspectLabel: Record<string, string> = ru
    ? { clarity: "чёткость", confidence: "увер-ть", volume: "громкость", tempo: "темп", expressiveness: "выразит.", pauses: "паузы" }
    : { clarity: "clarity", confidence: "confidence", volume: "volume", tempo: "tempo", expressiveness: "express.", pauses: "pauses" };

  return (
    <Animated.View entering={FadeIn.duration(260)} style={[st.devRoot, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={{ paddingTop: topPad + 16, paddingBottom: bottomPad + 100, paddingHorizontal: 20, gap: 14 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={[st.devBadge, { backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(20,22,26,0.05)" }]}>
          <Ionicons name="construct-outline" size={14} color={colors.textSecondary} />
          <Text style={[st.devBadgeText, { color: colors.textSecondary, fontFamily: "Rubik_600SemiBold" }]}>
            {ru ? "ДЛЯ РАЗРАБОТЧИКОВ" : "FOR DEVELOPERS"}
          </Text>
        </View>

        <Text style={[st.devTitle, { color: colors.text, fontFamily: "Rubik_700Bold" }]}>
          {ru ? "Транскрипция и разбор оценки" : "Transcription & scoring breakdown"}
        </Text>

        {/* Aggregate */}
        <View style={[st.devCard, { backgroundColor: colors.backgroundSecondary, borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(20,22,26,0.08)" }]}>
          <Text style={[st.devAggScore, { color: colors.text, fontFamily: "Rubik_700Bold" }]}>
            {avg.toFixed(1)}<Text style={[st.devAggMax, { color: colors.textMuted }]}> / 10</Text>
          </Text>
          <Text style={[st.devAggNote, { color: colors.textSecondary, fontFamily: "Nunito_600SemiBold" }]}>
            {ru
              ? `Итог = среднее из ${rows.length} ответов (${overalls.map((v) => v.toFixed(1)).join(" + ")}) ÷ ${rows.length}.`
              : `Total = average of ${rows.length} answers (${overalls.map((v) => v.toFixed(1)).join(" + ")}) ÷ ${rows.length}.`}
          </Text>
        </View>

        {/* Per-answer rows */}
        {rows.map((r, i) => {
          const a = r.analysis;
          const wordCount = r.transcript.trim().split(/\s+/).filter(Boolean).length;
          return (
            <View
              key={i}
              style={[st.devCard, { backgroundColor: colors.backgroundSecondary, borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(20,22,26,0.08)" }]}
            >
              <View style={st.devRowHead}>
                <Text style={[st.devQNum, { color: colors.textMuted, fontFamily: "Rubik_600SemiBold" }]}>
                  {(ru ? "ВОПРОС " : "QUESTION ") + (i + 1)}
                </Text>
                <Text style={[st.devScore, { color: toneFor(a.score.overall), fontFamily: "Rubik_700Bold" }]}>
                  {a.score.overall.toFixed(1)}
                </Text>
              </View>
              <Text style={[st.devQ, { color: colors.text, fontFamily: "Nunito_700Bold" }]}>{r.question}</Text>

              <Text style={[st.devSubLabel, { color: colors.textMuted, fontFamily: "Rubik_600SemiBold" }]}>
                {ru ? `ТРАНСКРИПЦИЯ · ${wordCount} сл.` : `TRANSCRIPT · ${wordCount} w.`}
              </Text>
              <Text style={[st.devTranscript, { color: colors.textSecondary, fontFamily: "Nunito_400Regular" }]}>
                {r.transcript ? `«${r.transcript}»` : ru ? "— пусто (не распознано / нет бэкенда) —" : "— empty (not recognized / no backend) —"}
              </Text>

              <View style={st.devAspects}>
                {aspectKeys.map((k) => (
                  <View key={k} style={st.devAspect}>
                    <Text style={[st.devAspectVal, { color: colors.text, fontFamily: "Rubik_700Bold" }]}>
                      {Number(a.score[k] ?? 0).toFixed(1)}
                    </Text>
                    <Text style={[st.devAspectKey, { color: colors.textMuted, fontFamily: "Nunito_600SemiBold" }]}>
                      {aspectLabel[k]}
                    </Text>
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

  // Dev report
  devRoot: { ...StyleSheet.absoluteFillObject, zIndex: 30 },
  devBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  devBadgeText: { fontSize: 11, letterSpacing: 1.4 },
  devTitle: { fontSize: 22, lineHeight: 28 },
  devCard: { borderRadius: 18, borderWidth: 1, padding: 16, gap: 8 },
  devAggScore: { fontSize: 40, lineHeight: 46 },
  devAggMax: { fontSize: 20 },
  devAggNote: { fontSize: 13, lineHeight: 19 },
  devRowHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  devQNum: { fontSize: 11, letterSpacing: 1.2 },
  devScore: { fontSize: 22 },
  devQ: { fontSize: 16, lineHeight: 22 },
  devSubLabel: { fontSize: 10.5, letterSpacing: 1.2, marginTop: 4 },
  devTranscript: { fontSize: 14, lineHeight: 21 },
  devAspects: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 6 },
  devAspect: { alignItems: "center", minWidth: 48 },
  devAspectVal: { fontSize: 17 },
  devAspectKey: { fontSize: 11, marginTop: 1 },
  devNote: { fontSize: 12.5, lineHeight: 18, marginTop: 4 },
  devFooter: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    paddingTop: 12,
  },
});
