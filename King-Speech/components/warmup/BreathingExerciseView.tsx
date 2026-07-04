import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, Platform, Image } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  cancelAnimation,
  FadeIn,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { warmupTheme, warmupFonts } from "@/components/warmup/warmupTheme";

// Custom breathing cue illustrations — inhale through the nose (gold airflow),
// exhale through the mouth (mint airflow). Unified neon line-art set.
const IMG_NOSE = require("@/assets/warmup/breathe-nose.png");
const IMG_MOUTH = require("@/assets/warmup/breathe-mouth.png");

/**
 * Breathing warm-up — the first Разагрев task. A guided breathing drill
 * (inhale through the nose → short hold → exhale through the mouth) that
 * prepares the voice and calms nerves. Pure animation + timers; works on every
 * platform (no microphone, no native module).
 *
 * Timing is deliberately in a comfortable HUMAN range — a 3s nasal inhale, a
 * light 2s hold, and a longer 4s mouth exhale (longer exhale = calming). A
 * clear per-phase cue tells the player exactly HOW to breathe (nose vs mouth),
 * and the circle only grows within a realistic range so it never feels like you
 * must over-inflate your lungs.
 */

const CYCLES = 3;
type PhaseType = "inhale" | "hold" | "exhale";
interface Phase {
  type: PhaseType;
  label: string;
  sec: number;
  via: string;
  cue: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}

// Distinct colour per phase so it's instantly obvious where you are: warm gold
// to breathe IN, calm violet to HOLD, cool mint to breathe OUT.
const C_INHALE = warmupTheme.gold;
const C_HOLD = "#B7A6FF";
const C_EXHALE = "#5FD3C4";

const PATTERN: Phase[] = [
  { type: "inhale", label: "Вдох", sec: 3, via: "носом", cue: "Вдохни через нос", icon: "arrow-down", color: C_INHALE },
  { type: "hold", label: "Задержка", sec: 2, via: "держи", cue: "Задержи дыхание", icon: "pause", color: C_HOLD },
  { type: "exhale", label: "Выдох", sec: 4, via: "ртом", cue: "Выдохни через рот", icon: "arrow-up", color: C_EXHALE },
];
const PHASES = Array.from({ length: CYCLES }).flatMap(() => PATTERN);

// Circle scale stays within a realistic breathing range (never a full balloon).
const MIN_SCALE = 0.62;
const MAX_SCALE = 1;

function haptic() {
  if (Platform.OS !== "web") {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }
}

export default function BreathingExerciseView({
  topPad,
  moduleColor,
  onComplete,
  onBack,
}: {
  topPad: number;
  moduleColor?: string;
  onComplete: () => void;
  onBack: () => void;
}) {
  const [running, setRunning] = useState(false);
  const [idx, setIdx] = useState(0);
  const [count, setCount] = useState(PATTERN[0].sec);
  const scale = useSharedValue(MIN_SCALE);

  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (!running) return;
    if (idx >= PHASES.length) {
      setRunning(false);
      haptic();
      onCompleteRef.current();
      return;
    }
    const phase = PHASES[idx];
    setCount(phase.sec);
    haptic();
    if (phase.type === "inhale") {
      scale.value = withTiming(MAX_SCALE, { duration: phase.sec * 1000, easing: Easing.inOut(Easing.ease) });
    } else if (phase.type === "exhale") {
      scale.value = withTiming(MIN_SCALE, { duration: phase.sec * 1000, easing: Easing.inOut(Easing.ease) });
    }
    const ci = setInterval(() => setCount((c) => Math.max(0, c - 1)), 1000);
    const to = setTimeout(() => setIdx((i) => i + 1), phase.sec * 1000);
    return () => {
      clearInterval(ci);
      clearTimeout(to);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, idx]);

  useEffect(() => () => cancelAnimation(scale), [scale]);

  const start = useCallback(() => {
    setIdx(0);
    setCount(PATTERN[0].sec);
    scale.value = MIN_SCALE;
    setRunning(true);
  }, [scale]);

  const circleStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const phase = running ? PHASES[Math.min(idx, PHASES.length - 1)] : null;
  const cycle = Math.min(CYCLES, Math.floor(idx / PATTERN.length) + 1);
  const phaseColor = phase?.color ?? warmupTheme.gold;

  return (
    <View style={[styles.root, { paddingTop: topPad + 8 }]}>
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={12} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={26} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>Дыхательная разминка</Text>
        <View style={styles.iconBtn} />
      </View>

      <Text style={styles.subtitle}>
        {running
          ? `Цикл ${cycle} из ${CYCLES}`
          : "Дыши вместе с кругом: вдох носом — короткая задержка — выдох ртом. Медленно и без напряжения."}
      </Text>

      {/* Per-phase cue — an illustration + text telling you HOW to breathe
          right now (in through the nose, out through the mouth). */}
      {running && phase ? (
        <Animated.View
          key={`cue-${idx}`}
          entering={FadeIn.duration(280)}
          style={[styles.cue, { backgroundColor: phaseColor + "1A", borderColor: phaseColor + "4D" }]}
        >
          {phase.type === "hold" ? (
            <Ionicons name={phase.icon} size={26} color={phaseColor} />
          ) : (
            <Image
              source={phase.type === "inhale" ? IMG_NOSE : IMG_MOUTH}
              style={styles.cueImg}
              resizeMode="contain"
            />
          )}
          <Text style={[styles.cueText, { color: phaseColor }]}>{phase.cue}</Text>
        </Animated.View>
      ) : (
        <View style={styles.cuePlaceholder} />
      )}

      <View style={styles.center}>
        <View style={[styles.ring, { borderColor: phaseColor + "2E" }]} />
        <Animated.View
          style={[
            styles.circle,
            circleStyle,
            { backgroundColor: phaseColor + "22", borderColor: phaseColor },
          ]}
        >
          {running && phase ? (
            <>
              <Text style={[styles.phaseLabel, { color: phaseColor }]}>{phase.label}</Text>
              <Text style={styles.phaseCount}>{count}</Text>
              <Text style={[styles.phaseVia, { color: phaseColor }]}>{phase.via}</Text>
            </>
          ) : (
            <Ionicons name="leaf-outline" size={52} color={warmupTheme.gold} />
          )}
        </Animated.View>
      </View>

      <View style={styles.footer}>
        {!running ? (
          <Pressable
            onPress={start}
            style={({ pressed }) => [styles.cta, { backgroundColor: warmupTheme.gold, opacity: pressed ? 0.9 : 1 }]}
          >
            <Text style={styles.ctaText}>Начать</Text>
          </Pressable>
        ) : (
          <Pressable onPress={onComplete} hitSlop={8} style={styles.skip}>
            <Text style={styles.skipText}>Пропустить →</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: warmupTheme.bg, paddingHorizontal: 22 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: {
    color: "#fff",
    fontSize: 17,
    fontFamily: warmupFonts.title,
  },
  subtitle: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 14,
    textAlign: "center",
    marginTop: 6,
    paddingHorizontal: 10,
    fontFamily: warmupFonts.body,
  },
  cue: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    alignSelf: "center",
    marginTop: 14,
    paddingLeft: 10,
    paddingRight: 20,
    paddingVertical: 8,
    borderRadius: 26,
    borderWidth: 1,
  },
  cueImg: { width: 44, height: 44 },
  cueText: { fontSize: 16, fontFamily: warmupFonts.label },
  cuePlaceholder: { height: 60 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  ring: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 140,
    borderWidth: 1.5,
  },
  circle: {
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  phaseLabel: { fontSize: 20, fontFamily: warmupFonts.label },
  phaseCount: { color: "#fff", fontSize: 54, fontFamily: warmupFonts.digit, marginTop: 2 },
  phaseVia: { fontSize: 15, fontFamily: warmupFonts.body, marginTop: 2, textTransform: "lowercase" },
  footer: { paddingBottom: 28, alignItems: "center" },
  cta: {
    width: "100%",
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: { color: warmupTheme.onGold, fontSize: 16, fontFamily: warmupFonts.title },
  skip: { padding: 10 },
  skipText: { color: "rgba(255,255,255,0.45)", fontSize: 14, fontFamily: warmupFonts.body },
});
