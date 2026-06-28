import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  cancelAnimation,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";
import { warmupTheme, warmupFonts } from "@/components/warmup/warmupTheme";

/**
 * Breathing warm-up — the first Разогрев task. A guided diaphragmatic
 * breathing drill (inhale → hold → exhale) that prepares the voice and calms
 * nerves before speaking. Pure animation + timers: works on every platform
 * (no microphone, no native pitch module), unlike the old pitch game.
 */

const CYCLES = 3;
const PATTERN = [
  { type: "inhale" as const, label: "Вдох", sec: 4 },
  { type: "hold" as const, label: "Задержка", sec: 4 },
  { type: "exhale" as const, label: "Выдох", sec: 6 },
];
const PHASES = Array.from({ length: CYCLES }).flatMap(() => PATTERN);

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
  const accent = moduleColor ?? warmupTheme.gold;
  const [running, setRunning] = useState(false);
  const [idx, setIdx] = useState(0);
  const [count, setCount] = useState(PATTERN[0].sec);
  const scale = useSharedValue(0.55);

  // Keep onComplete out of the phase effect's deps (parent may pass a fresh
  // callback each render — including it would re-run the effect every render
  // and loop "Maximum update depth").
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
      scale.value = withTiming(1, { duration: phase.sec * 1000, easing: Easing.inOut(Easing.ease) });
    } else if (phase.type === "exhale") {
      scale.value = withTiming(0.55, { duration: phase.sec * 1000, easing: Easing.inOut(Easing.ease) });
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
    scale.value = 0.55;
    setRunning(true);
  }, [scale]);

  const circleStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const phase = running ? PHASES[Math.min(idx, PHASES.length - 1)] : null;
  const cycle = Math.min(CYCLES, Math.floor(idx / PATTERN.length) + 1);

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
          : "Дыши вместе с кругом: вдох — задержка — выдох. Это раскрепощает голос."}
      </Text>

      <View style={styles.center}>
        <View style={[styles.ring, { borderColor: accent + "33" }]} />
        <Animated.View
          style={[
            styles.circle,
            circleStyle,
            { backgroundColor: accent + "22", borderColor: accent },
          ]}
        >
          {running ? (
            <>
              <Text style={[styles.phaseLabel, { color: accent }]}>{phase?.label}</Text>
              <Text style={styles.phaseCount}>{count}</Text>
            </>
          ) : (
            <Ionicons name="leaf-outline" size={52} color={accent} />
          )}
        </Animated.View>
      </View>

      <View style={styles.footer}>
        {!running ? (
          <Pressable
            onPress={start}
            style={({ pressed }) => [styles.cta, { backgroundColor: accent, opacity: pressed ? 0.9 : 1 }]}
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
  phaseLabel: { fontSize: 22, fontFamily: warmupFonts.label },
  phaseCount: { color: "#fff", fontSize: 56, fontFamily: warmupFonts.digit, marginTop: 2 },
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
