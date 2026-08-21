import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  Dimensions,
} from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  cancelAnimation,
  Easing,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import CelebrationBurst from "@/components/warmup/CelebrationBurst";
import type { WarmupMouth } from "@/constants/contentLoader";
import { warmupFonts, warmupTheme } from "@/components/warmup/warmupTheme";
import { useAppColors } from "@/hooks/useAppColors";

const { height: SH } = Dimensions.get("window");
const BEZ = Easing.bezier(0.22, 1, 0.36, 1);

// Guided step prompts per articulation exercise (keyed by name). Each plays as
// short alternating cues (2s each), repeated a couple of rounds — a follow-along
// drill instead of a flat "instruction + one timer". Wording is a faithful
// shortening of each exercise's content instruction; edit here to tune prompts.
interface MouthSteps {
  steps: string[];
  stepSec: number;
  rounds: number;
}
const MOUTH_STEPS: Record<string, MouthSteps> = {
  "Трубочка — Улыбка": { steps: ["Вытяни губы вперёд трубочкой", "Теперь сделай широкую улыбку"], stepSec: 2, rounds: 2 },
  "Часики": { steps: ["Тянись языком к левому уголку", "Теперь к правому уголку"], stepSec: 2, rounds: 2 },
  "Лошадка": { steps: ["Медленно поцокай языком", "А теперь быстрее"], stepSec: 2, rounds: 2 },
  "Иголочка": { steps: ["Высуни узкий острый язык вперёд", "Расслабь язык"], stepSec: 2, rounds: 2 },
  "Лопаточка": { steps: ["Положи широкий язык на нижнюю губу", "Держи ровно, не напрягай"], stepSec: 2, rounds: 2 },
  "Качели": { steps: ["Тянись кончиком языка к носу", "Теперь к подбородку"], stepSec: 2, rounds: 2 },
  "Надуть — сдуть щёки": { steps: ["Набери воздух и надуй щёки", "Плавно сдуй"], stepSec: 2, rounds: 2 },
  "Чистим зубки": { steps: ["Проведи языком по зубам вправо", "Теперь влево"], stepSec: 2, rounds: 2 },
  "Вкусное варенье": { steps: ["Оближи верхнюю губу сверху вниз", "И ещё раз, будто пробуешь варенье"], stepSec: 2, rounds: 2 },
  "Маятник": { steps: ["Веди нижнюю челюсть влево", "Теперь вправо"], stepSec: 2, rounds: 2 },
  "Заборчик": { steps: ["Сомкни зубы, растяни губы «заборчиком»", "Удержи и расслабь"], stepSec: 2, rounds: 2 },
  "Барабанчик": { steps: ["Постучи языком за верхними зубами: «д-д-д»", "Ускоряйся: «д-д-д-д»"], stepSec: 2, rounds: 2 },
};
function resolveMouthSteps(ex: WarmupMouth): MouthSteps {
  if (ex.steps && ex.steps.length) {
    return { steps: ex.steps, stepSec: ex.stepSec ?? 2, rounds: ex.rounds ?? 2 };
  }
  return MOUTH_STEPS[ex.name?.trim()] ?? { steps: [ex.instruction], stepSec: 3, rounds: 1 };
}

type Phase = "idle" | "name" | "running" | "done";

interface Props {
  exercise: WarmupMouth;
  topPad: number;
  onComplete: () => void;
  onBack: () => void;
}

export default function MouthExerciseView({
  exercise,
  topPad,
  onComplete,
  onBack,
}: Props) {
  const { colors } = useAppColors();
  const accent = warmupTheme.gold;

  const { steps, stepSec, rounds } = resolveMouthSteps(exercise);
  const total = steps.length * rounds;

  const [phase, setPhase] = useState<Phase>("idle");
  const [stepIdx, setStepIdx] = useState(0);
  const [count, setCount] = useState(stepSec);
  const [showHelp, setShowHelp] = useState(false);

  const nameP = useSharedValue(0); // 0 = big centered, 1 = small caption up top
  const barP = useSharedValue(0);

  const stepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countIntRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const nameTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = () => {
    if (stepTimerRef.current) clearTimeout(stepTimerRef.current);
    if (countIntRef.current) clearInterval(countIntRef.current);
    if (nameTimerRef.current) clearTimeout(nameTimerRef.current);
  };

  useEffect(
    () => () => {
      clearTimers();
      cancelAnimation(nameP);
      cancelAnimation(barP);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const start = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    nameP.value = 0;
    setPhase("name");
  };

  // Name intro → after 2s it shrinks, fades and lifts into a caption; steps begin.
  useEffect(() => {
    if (phase !== "name") return;
    nameTimerRef.current = setTimeout(() => {
      nameP.value = withTiming(1, { duration: 520, easing: BEZ });
      setPhase("running");
    }, 2000);
    return () => {
      if (nameTimerRef.current) clearTimeout(nameTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Guided step sequence — each prompt with its own short timer.
  useEffect(() => {
    if (phase !== "running") return;
    let cancelled = false;
    const runStep = (i: number) => {
      if (cancelled) return;
      setStepIdx(i);
      setCount(stepSec);
      Haptics.selectionAsync().catch(() => {});
      barP.value = 0;
      barP.value = withTiming(1, { duration: stepSec * 1000, easing: Easing.linear });
      countIntRef.current = setInterval(
        () => setCount((c) => Math.max(0, c - 1)),
        1000,
      );
      stepTimerRef.current = setTimeout(() => {
        if (countIntRef.current) clearInterval(countIntRef.current);
        if (cancelled) return;
        if (i + 1 < total) {
          runStep(i + 1);
        } else {
          setPhase("done");
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        }
      }, stepSec * 1000);
    };
    runStep(0);
    return () => {
      cancelled = true;
      clearTimers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const nameStyle = useAnimatedStyle(() => ({
    opacity: interpolate(nameP.value, [0, 1], [1, 0.4]),
    transform: [
      { translateY: interpolate(nameP.value, [0, 1], [0, -SH * 0.3]) },
      { scale: interpolate(nameP.value, [0, 1], [1, 0.52]) },
    ],
  }));
  const barStyle = useAnimatedStyle(() => ({ width: `${barP.value * 100}%` }));

  const stepText = steps[stepIdx % steps.length];

  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: topPad + 8 }]}>
      <CelebrationBurst play={phase === "done"} />

      {/* Header: back + help */}
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={12} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.textSecondary} />
        </Pressable>
        {phase === "idle" || phase === "done" ? (
          <Pressable onPress={() => setShowHelp(true)} hitSlop={12} style={styles.iconBtn}>
            <Ionicons name="help-circle-outline" size={24} color={colors.textSecondary} />
          </Pressable>
        ) : (
          <View style={styles.iconBtn} />
        )}
      </View>

      {/* IDLE — clean: title + start */}
      {phase === "idle" && (
        <View style={styles.center}>
          <Text style={[styles.idleTitle, { color: colors.text }]}>Разминка полости рта</Text>
          <Animated.View entering={FadeInDown.delay(120).duration(420)} style={{ marginTop: 34 }}>
            <Pressable onPress={start} style={({ pressed }) => [styles.cta, { backgroundColor: accent, opacity: pressed ? 0.9 : 1 }]}>
              <Ionicons name="play" size={16} color={warmupTheme.onGold} />
              <Text style={styles.ctaText}>Старт</Text>
            </Pressable>
          </Animated.View>
        </View>
      )}

      {/* Exercise name — big → caption */}
      {(phase === "name" || phase === "running") && (
        <Animated.Text
          entering={FadeIn.duration(320)}
          style={[styles.exName, { color: accent }, nameStyle]}
        >
          {exercise.name}
        </Animated.Text>
      )}

      {/* RUNNING — one prompt + its timer */}
      {phase === "running" && (
        <View style={styles.center} pointerEvents="none">
          <Animated.Text
            key={`step-${stepIdx}`}
            entering={FadeInDown.duration(300)}
            exiting={FadeOut.duration(160)}
            style={[styles.stepText, { color: colors.text }]}
          >
            {stepText}
          </Animated.Text>
          <View style={[styles.track, { backgroundColor: colors.border }]}>
            <Animated.View style={[styles.fill, { backgroundColor: accent }, barStyle]} />
          </View>
          <Text style={[styles.count, { color: colors.textMuted }]}>{count}</Text>
        </View>
      )}

      {/* Step progress dots */}
      {phase === "running" && (
        <View style={styles.dots}>
          {Array.from({ length: total }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                { backgroundColor: i <= stepIdx ? accent : colors.border },
              ]}
            />
          ))}
        </View>
      )}

      {/* DONE */}
      {phase === "done" && (
        <View style={styles.center}>
          <Animated.View entering={FadeIn.duration(360)} style={[styles.doneBadge, { backgroundColor: accent }]}>
            <Ionicons name="checkmark" size={54} color={warmupTheme.onGold} />
          </Animated.View>
          <Text style={[styles.doneText, { color: colors.text }]}>Отлично!</Text>
          <Animated.View entering={FadeInDown.delay(200).duration(400)} style={{ marginTop: 26 }}>
            <Pressable onPress={onComplete} style={({ pressed }) => [styles.cta, { backgroundColor: accent, opacity: pressed ? 0.9 : 1 }]}>
              <Text style={styles.ctaText}>Далее</Text>
              <Ionicons name="arrow-forward" size={16} color={warmupTheme.onGold} />
            </Pressable>
          </Animated.View>
        </View>
      )}

      {/* Skip (running) */}
      {phase === "running" && (
        <View style={styles.footer}>
          <Pressable onPress={onComplete} hitSlop={8} style={styles.skip}>
            <Text style={[styles.skipText, { color: colors.textMuted }]}>Пропустить →</Text>
          </Pressable>
        </View>
      )}

      {/* Help */}
      <Modal visible={showHelp} transparent animationType="fade" onRequestClose={() => setShowHelp(false)}>
        <Pressable style={styles.helpOverlay} onPress={() => setShowHelp(false)}>
          <Pressable style={[styles.helpCard, { backgroundColor: colors.backgroundSecondary }]} onPress={() => {}}>
            <Pressable onPress={() => setShowHelp(false)} hitSlop={12} style={styles.helpClose}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </Pressable>
            <Text style={[styles.helpTitle, { color: colors.text }]}>Как выполнять</Text>
            <Text style={[styles.helpText, { color: colors.textSecondary }]}>
              {exercise.name}: следуй подсказкам на экране и повторяй движение вместе с таймером. Спокойно, без напряжения.
            </Text>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 24 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  idleTitle: { fontFamily: warmupFonts.title, fontSize: 30, textAlign: "center", letterSpacing: -0.3 },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingHorizontal: 40,
    height: 56,
    borderRadius: 28,
  },
  ctaText: { color: warmupTheme.onGold, fontSize: 17, fontFamily: warmupFonts.title },
  exName: {
    position: "absolute",
    left: 24,
    right: 24,
    top: SH * 0.42,
    textAlign: "center",
    fontFamily: warmupFonts.title,
    fontSize: 32,
    letterSpacing: -0.3,
  },
  stepText: {
    fontFamily: warmupFonts.title,
    fontSize: 26,
    textAlign: "center",
    lineHeight: 34,
    maxWidth: 320,
  },
  track: {
    width: 220,
    height: 6,
    borderRadius: 3,
    marginTop: 26,
    overflow: "hidden",
  },
  fill: { height: 6, borderRadius: 3 },
  count: { fontFamily: warmupFonts.digit, fontSize: 20, marginTop: 12 },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    paddingBottom: 8,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  doneBadge: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  doneText: { fontFamily: warmupFonts.title, fontSize: 26, marginTop: 20 },
  footer: { paddingBottom: 24, alignItems: "center" },
  skip: { padding: 10 },
  skipText: { fontFamily: warmupFonts.body, fontSize: 14 },
  helpOverlay: {
    flex: 1,
    backgroundColor: "rgba(10,10,14,0.4)",
    justifyContent: "center",
    padding: 28,
  },
  helpCard: { borderRadius: 22, padding: 24, paddingTop: 26 },
  helpClose: { position: "absolute", top: 14, right: 14, padding: 4, zIndex: 2 },
  helpTitle: { fontFamily: warmupFonts.title, fontSize: 20 },
  helpText: { fontFamily: warmupFonts.body, fontSize: 15, lineHeight: 23, marginTop: 10 },
});
