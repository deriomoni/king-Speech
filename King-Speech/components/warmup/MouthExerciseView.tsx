import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import type { WarmupMouth } from "@/constants/contentLoader";
import { warmupFonts } from "@/components/warmup/warmupTheme";
import { useAppColors } from "@/hooks/useAppColors";
import { useTheme } from "@/context/ThemeContext";
import { MouthHelpDialog } from "@/components/warmup/WarmupHelpDialog";
import IllustratedExerciseView, { ILLUSTRATED_EXERCISES } from "@/components/warmup/IllustratedExerciseView";

// Timing model:
//  · NAME_SEC   — the exercise name + short description are shown with a
//                 visible 5s countdown so the player knows what's coming.
//  · READ_SEC   — a 5s window on the *first* task only: the prompt and its
//                 form-tip are on screen (with a visible countdown, no bar) so
//                 there's time to read. Following tasks start cycles right away.
//  · CYCLE_SECS — every task is performed over two cycles: 15s then 20s.
const NAME_SEC = 5;
const READ_SEC = 5;
const CYCLE_SECS = [15, 20];

// Per-exercise content: the step prompts, a one-line "what & why" description
// (shown under the name), and a short form-tip (shown under each prompt). Edit
// the copy here to tune wording.
interface MouthInfo {
  steps: string[];
  desc: string;
  tip: string;
}
const MOUTH_INFO: Record<string, MouthInfo> = {
  "Трубочка — Улыбка": {
    steps: ["Вытяни губы вперёд трубочкой", "Теперь сделай широкую улыбку"],
    desc: "Разминает губы, переключая их между двумя формами.",
    tip: "Губы напряжены, зубы сомкнуты — работают только губы.",
  },
  "Часики": {
    steps: ["Тянись языком к левому уголку", "Теперь к правому уголку"],
    desc: "Растягивает и разогревает мышцы языка в стороны.",
    tip: "Рот приоткрыт, двигается только язык — челюсть неподвижна.",
  },
  "Лошадка": {
    steps: ["Медленно поцокай языком", "А теперь быстрее"],
    desc: "Разрабатывает кончик языка и укрепляет его мышцы.",
    tip: "Рот широко раскрыт в улыбке, нижняя челюсть неподвижна.",
  },
  "Иголочка": {
    steps: ["Высуни узкий острый язык вперёд", "Расслабь язык"],
    desc: "Учит собирать язык в узкий и напряжённый.",
    tip: "Язык узкий и острый, тянется строго вперёд.",
  },
  "Лопаточка": {
    steps: ["Положи широкий язык на нижнюю губу", "Держи ровно, не напрягай"],
    desc: "Учит расслаблять и удерживать язык широким.",
    tip: "Язык широкий и спокойный, лежит на нижней губе.",
  },
  "Качели": {
    steps: ["Тянись кончиком языка к носу", "Теперь к подбородку"],
    desc: "Разминает язык вверх-вниз, развивает подвижность.",
    tip: "Рот открыт, тянемся кончиком языка вверх и вниз.",
  },
  "Надуть — сдуть щёки": {
    steps: ["Набери воздух и надуй щёки", "Плавно сдуй"],
    desc: "Разогревает щёки и тренирует контроль дыхания.",
    tip: "Щёки надуваем плотно, воздух выпускаем плавно.",
  },
  "Чистим зубки": {
    steps: ["Проведи языком по зубам вправо", "Теперь влево"],
    desc: "Разминает язык по зубам, улучшает артикуляцию.",
    tip: "Рот закрыт, язык скользит по зубам — челюсть неподвижна.",
  },
  "Вкусное варенье": {
    steps: ["Оближи верхнюю губу сверху вниз", "И ещё раз, будто пробуешь варенье"],
    desc: "Разрабатывает подъём и гибкость языка.",
    tip: "Широким языком облизываем верхнюю губу сверху вниз.",
  },
  "Маятник": {
    steps: ["Веди нижнюю челюсть влево", "Теперь вправо"],
    desc: "Разминает нижнюю челюсть в стороны.",
    tip: "Губы расслаблены, плавно ведём челюсть влево-вправо.",
  },
  "Заборчик": {
    steps: ["Сомкни зубы, растяни губы «заборчиком»", "Удержи и расслабь"],
    desc: "Разогревает губы и мышцы улыбки.",
    tip: "Зубы сомкнуты, губы широко растянуты в улыбке.",
  },
  "Барабанчик": {
    steps: ["Постучи языком за верхними зубами: «д-д-д»", "Ускоряйся: «д-д-д-д»"],
    desc: "Тренирует кончик языка и чёткость звуков.",
    tip: "Язык стучит за верхними зубами — челюсть неподвижна.",
  },
};

function resolveMouth(ex: WarmupMouth): MouthInfo {
  const info = MOUTH_INFO[ex.name?.trim()];
  const steps = ex.steps && ex.steps.length ? ex.steps : info?.steps ?? [ex.instruction];
  return {
    steps,
    desc: info?.desc ?? "",
    tip: info?.tip ?? ex.instruction ?? "",
  };
}

// "illustrated" — after the module exercise, the illustrated drills from Figma
// (звук из груди, трубочка в сторону, речь с пробкой, язык по кругу) run in order.
type Phase = "idle" | "name" | "running" | "illustrated";

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
  const { theme } = useTheme();
  // Gold used as text: gold on dark, ink on light.
  const accent = theme.accentInk;

  const { steps, desc, tip } = resolveMouth(exercise);

  const [phase, setPhase] = useState<Phase>("idle");
  const [nameCount, setNameCount] = useState(NAME_SEC);
  const [taskIdx, setTaskIdx] = useState(0);
  const [reading, setReading] = useState(false);
  const [count, setCount] = useState(0);
  const [showHelp, setShowHelp] = useState(false);
  const [extraIdx, setExtraIdx] = useState(0);

  const startIllustrated = () => {
    setExtraIdx(0);
    setPhase("illustrated");
  };
  const nextIllustrated = () => {
    if (extraIdx + 1 >= ILLUSTRATED_EXERCISES.length) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onCompleteRef.current();
      return;
    }
    setExtraIdx((i) => i + 1);
  };

  const barP = useSharedValue(0);
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const start = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setPhase("name");
  };

  // Name + description intro with a visible 5s countdown, then run the tasks.
  useEffect(() => {
    if (phase !== "name") return;
    setNameCount(NAME_SEC);
    const ci = setInterval(() => setNameCount((c) => Math.max(0, c - 1)), 1000);
    const to = setTimeout(() => {
      clearInterval(ci);
      setPhase("running");
    }, NAME_SEC * 1000);
    return () => {
      clearInterval(ci);
      clearTimeout(to);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Task/cycle driver. Flat schedule: a 10s hidden read window before the first
  // task, then two timed cycles (15s / 20s) per task. When the schedule is
  // exhausted we jump straight to the victory screen — no interstitial.
  useEffect(() => {
    if (phase !== "running") return;
    let cancelled = false;
    const timers: Array<ReturnType<typeof setTimeout>> = [];
    let interval: ReturnType<typeof setInterval> | null = null;

    type Seg = { task: number; kind: "read" | "cycle"; sec: number };
    const schedule: Seg[] = [];
    for (let t = 0; t < steps.length; t++) {
      if (t === 0) schedule.push({ task: 0, kind: "read", sec: READ_SEC });
      CYCLE_SECS.forEach((sec) => schedule.push({ task: t, kind: "cycle", sec }));
    }

    const runSeg = (k: number) => {
      if (cancelled) return;
      if (k >= schedule.length) {
        setPhase("illustrated");
        return;
      }
      const seg = schedule[k];
      setTaskIdx(seg.task);
      setReading(seg.kind === "read");
      setCount(seg.sec);
      barP.value = 0;
      if (seg.kind === "cycle") {
        Haptics.selectionAsync().catch(() => {});
        barP.value = withTiming(1, { duration: seg.sec * 1000, easing: Easing.linear });
      }
      interval = setInterval(() => setCount((c) => Math.max(0, c - 1)), 1000);
      timers.push(
        setTimeout(() => {
          if (interval) clearInterval(interval);
          runSeg(k + 1);
        }, seg.sec * 1000),
      );
    };
    runSeg(0);

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
      if (interval) clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const barStyle = useAnimatedStyle(() => ({ width: `${barP.value * 100}%` }));

  const stepText = steps[taskIdx % steps.length];

  if (phase === "illustrated") {
    return (
      <IllustratedExerciseView
        exercise={ILLUSTRATED_EXERCISES[extraIdx]}
        topPad={topPad}
        onDone={nextIllustrated}
        onSkip={nextIllustrated}
        onBack={onBack}
      />
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: topPad + 8 }]}>
      {/* Header: back + help */}
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={12} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.textSecondary} />
        </Pressable>
        {phase === "idle" ? (
          <Pressable onPress={() => setShowHelp(true)} hitSlop={12} style={styles.iconBtn}>
            <Ionicons name="help-circle-outline" size={24} color={colors.textSecondary} />
          </Pressable>
        ) : (
          <View style={styles.iconBtn} />
        )}
      </View>

      {/* IDLE — title + start + "back" link */}
      {phase === "idle" && (
        <View style={styles.center}>
          <Text style={[styles.idleTitle, { color: colors.text }]}>Разминка полости рта</Text>
          <Animated.View entering={FadeInDown.delay(120).duration(420)} style={styles.idleActions}>
            <Pressable
              onPress={start}
              style={({ pressed }) => [
                styles.cta,
                { backgroundColor: theme.accent, borderColor: theme.ctaStroke, opacity: pressed ? 0.9 : 1 },
              ]}
            >
              <Ionicons name="play" size={13} color={theme.accentText} />
              <Text style={[styles.ctaText, { color: theme.accentText }]}>Старт</Text>
            </Pressable>
            <Pressable onPress={onBack} hitSlop={8} style={styles.backLink}>
              <Text style={[styles.backLinkText, { color: colors.textMuted }]}>Вернуться назад</Text>
            </Pressable>
          </Animated.View>
        </View>
      )}

      {/* NAME intro — countdown above, name, description below */}
      {phase === "name" && (
        <Animated.View
          entering={FadeIn.duration(300)}
          exiting={FadeOut.duration(160)}
          style={styles.center}
        >
          <Text style={[styles.nameCount, { color: colors.textMuted }]}>{nameCount}</Text>
          <Text style={[styles.exNameBig, { color: accent }]}>{exercise.name}</Text>
          {!!desc && (
            <Text style={[styles.desc, { color: colors.textSecondary }]}>{desc}</Text>
          )}
        </Animated.View>
      )}

      {/* RUNNING — name caption + small countdown on top, prompt + tip + bar */}
      {phase === "running" && (
        <>
          <View style={styles.topInfo}>
            <Text style={[styles.nameCaption, { color: accent }]}>{exercise.name}</Text>
            <Text style={[styles.topCount, { color: colors.textMuted }]}>{count}</Text>
          </View>

          <View style={styles.center} pointerEvents="none">
            <Animated.Text
              key={`task-${taskIdx}`}
              entering={FadeInDown.duration(300)}
              exiting={FadeOut.duration(160)}
              style={[styles.stepText, { color: colors.text }]}
            >
              {stepText}
            </Animated.Text>
            {!!tip && <Text style={[styles.tip, { color: colors.textSecondary }]}>{tip}</Text>}
            {!reading && (
              <View style={[styles.track, { backgroundColor: colors.border }]}>
                <Animated.View style={[styles.fill, { backgroundColor: theme.accent }, barStyle]} />
              </View>
            )}
          </View>

          {/* Task progress dots */}
          <View style={styles.dots}>
            {steps.map((_, i) => (
              <View
                key={i}
                style={[styles.dot, { backgroundColor: i <= taskIdx ? theme.accent : colors.border }]}
              />
            ))}
          </View>

          {/* Skip */}
          <View style={styles.footer}>
            <Pressable onPress={startIllustrated} hitSlop={8} style={styles.skip}>
              <Text style={[styles.skipText, { color: colors.textMuted }]}>Пропустить →</Text>
            </Pressable>
          </View>
        </>
      )}

      {/* Help (Figma 37:5074) */}
      <MouthHelpDialog visible={showHelp} onClose={() => setShowHelp(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 24 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  idleTitle: { fontFamily: warmupFonts.title, fontSize: 30, textAlign: "center", letterSpacing: -0.3 },
  idleActions: { marginTop: 34, alignItems: "center" },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingHorizontal: 40,
    height: 56,
    borderRadius: 32,
    borderWidth: 4,
  },
  ctaText: { fontSize: 17, fontFamily: warmupFonts.title },
  backLink: { marginTop: 18, padding: 8 },
  backLinkText: { fontFamily: warmupFonts.body, fontSize: 15 },

  nameCount: { fontFamily: warmupFonts.digit, fontSize: 34, marginBottom: 14 },
  exNameBig: {
    textAlign: "center",
    fontFamily: warmupFonts.title,
    fontSize: 34,
    letterSpacing: -0.3,
  },
  desc: {
    fontFamily: warmupFonts.body,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginTop: 14,
    maxWidth: 320,
  },

  topInfo: { alignItems: "center", marginTop: 4, gap: 6 },
  nameCaption: { fontFamily: warmupFonts.title, fontSize: 17, letterSpacing: -0.2 },
  topCount: { fontFamily: warmupFonts.digit, fontSize: 15 },

  stepText: {
    fontFamily: warmupFonts.title,
    fontSize: 26,
    textAlign: "center",
    lineHeight: 34,
    maxWidth: 320,
  },
  tip: {
    fontFamily: warmupFonts.body,
    fontSize: 14.5,
    lineHeight: 21,
    textAlign: "center",
    marginTop: 12,
    maxWidth: 300,
  },
  track: {
    width: 220,
    height: 6,
    borderRadius: 3,
    marginTop: 26,
    overflow: "hidden",
  },
  fill: { height: 6, borderRadius: 3 },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    paddingBottom: 8,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  footer: { paddingBottom: 24, alignItems: "center" },
  skip: { padding: 10 },
  skipText: { fontFamily: warmupFonts.body, fontSize: 14 },
});
