import React, { useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, Platform, ActivityIndicator } from "react-native";
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
import { toneFor } from "@/components/ScoreFlower";
import { analyzeGenericTask } from "@/services/analyzeGenericTask";
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
// ───────────────────────────────────────────────────────────────────────────

interface Props {
  tasks: Task[];
  levelId: string;
  levelNumber: number;
  title: string;
  subtitle?: string;
  accent: string;
  /** Full-screen background behind the flow (module palette). Text on it adapts. */
  screenBg?: string;
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

export default function TaskFlowView({
  tasks,
  levelId,
  levelNumber,
  title,
  subtitle,
  accent,
  screenBg,
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

  const analysesRef = useRef<SpeechAnalysis[]>([]);
  const scoresRef = useRef<number[]>([]);
  const startRef = useRef(Date.now());

  const total = tasks.length;
  const task = tasks[index];
  const isLast = index >= total - 1;

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

  const kindLabel = levelId.startsWith("tonguetwister")
    ? ru ? "Скороговорка" : "Tongue twister"
    : ru ? "Задание" : "Task";

  return (
    <View style={{ flex: 1 }}>
      {/* Header: exit + progress segments */}
      <View style={[st.header, { paddingTop: topPad + 8 }]}>
        <Pressable onPress={onExit} hitSlop={12} style={({ pressed }) => [st.exitBtn, { opacity: pressed ? 0.6 : 1 }]}>
          <Ionicons name="close" size={24} color={ink} />
        </Pressable>
        <View style={st.dotsRow}>
          {tasks.map((_, i) => {
            const done = i < index || (i === index && phase === "scored");
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
          {kindLabel.toUpperCase()} · {index + 1}/{total}
        </Text>
        <Text numberOfLines={1} style={[st.levelTitle, { color: ink, fontFamily: "Rubik_700Bold" }]}>
          {title}
        </Text>
      </View>

      {/* Task card — swaps on advance */}
      <View style={st.stage}>
        <Animated.View
          key={index}
          entering={SlideInRight.duration(360)}
          exiting={SlideOutLeft.duration(240)}
          style={st.cardWrap}
        >
          <View style={[st.card, { borderColor: brand.borderViolet }]}>
            <LinearGradient
              colors={isDark ? ["#1C1830", "#141221"] : ["#F3EFFB", "#EDE7FA"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            {task.instruction ? (
              <Text style={[st.instruction, { color: isDark ? "rgba(242,238,251,0.6)" : colors.textSecondary, fontFamily: "Nunito_600SemiBold" }]}>
                {task.instruction}
              </Text>
            ) : null}
            <Text style={[st.contentText, { color: isDark ? "#F5F1FF" : colors.text, fontFamily: "Rubik_700Bold" }]}>
              {task.content || task.title}
            </Text>
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
            <WaveformVoiceRecorder onRecordingComplete={handleRecordingComplete} colors={colors} />
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
});
