import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, Platform, Modal } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  cancelAnimation,
  FadeInDown,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { warmupTheme, warmupFonts } from "@/components/warmup/warmupTheme";
import { useAppColors } from "@/hooks/useAppColors";

/**
 * Breathing warm-up — the first Разогрев task. A guided breathing drill
 * (inhale through the nose → short hold → exhale through the mouth) that
 * prepares the voice and calms nerves. Pure animation + timers; works on every
 * platform (no microphone, no native module). The canvas follows the app theme
 * (light in light mode, dark in dark mode).
 */

const CYCLES = 3;
type PhaseType = "inhale" | "hold" | "exhale";
interface Phase {
  type: PhaseType;
  label: string;
  sec: number;
  via: string;
  color: string;
}

const C_INHALE = warmupTheme.gold;
const C_HOLD = "#9B7BFF";
const C_EXHALE = "#22A79A";

const PATTERN: Phase[] = [
  { type: "inhale", label: "Вдох", sec: 3, via: "носом", color: C_INHALE },
  { type: "hold", label: "Задержка", sec: 2, via: "держи", color: C_HOLD },
  { type: "exhale", label: "Выдох", sec: 4, via: "ртом", color: C_EXHALE },
];
const PHASES = Array.from({ length: CYCLES }).flatMap(() => PATTERN);

const MIN_SCALE = 0.62;
const MAX_SCALE = 1;

function haptic() {
  if (Platform.OS !== "web") {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }
}

export default function BreathingExerciseView({
  topPad,
  onComplete,
  onBack,
}: {
  topPad: number;
  moduleColor?: string;
  bg?: string;
  onComplete: () => void;
  onBack: () => void;
}) {
  const { colors } = useAppColors();
  const [running, setRunning] = useState(false);
  const [idx, setIdx] = useState(0);
  const [count, setCount] = useState(PATTERN[0].sec);
  const [showHelp, setShowHelp] = useState(false);
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
    <View style={[styles.root, { paddingTop: topPad + 8, backgroundColor: colors.background }]}>
      {/* Header: back + title + help */}
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={12} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.textSecondary} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Дыхательная разминка</Text>
        <Pressable onPress={() => setShowHelp(true)} hitSlop={12} style={styles.iconBtn}>
          <Ionicons name="help-circle-outline" size={24} color={colors.textSecondary} />
        </Pressable>
      </View>

      {/* Cycle indicator only while running — nothing under the title at start */}
      {running ? (
        <Text style={[styles.cycle, { color: colors.textMuted }]}>Цикл {cycle} из {CYCLES}</Text>
      ) : (
        <View style={styles.cyclePlaceholder} />
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
              <Text style={[styles.phaseCount, { color: colors.text }]}>{count}</Text>
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
            <Text style={[styles.skipText, { color: colors.textMuted }]}>Пропустить →</Text>
          </Pressable>
        )}
      </View>

      {/* Help */}
      <Modal visible={showHelp} transparent animationType="fade" onRequestClose={() => setShowHelp(false)}>
        <Pressable style={styles.helpOverlay} onPress={() => setShowHelp(false)}>
          <Pressable style={[styles.helpCard, { backgroundColor: colors.backgroundSecondary }]} onPress={() => {}}>
            <Pressable onPress={() => setShowHelp(false)} hitSlop={12} style={styles.helpClose}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </Pressable>
            <Text style={[styles.helpTitle, { color: colors.text }]}>Как выполнять</Text>
            <View style={styles.helpRow}>
              <View style={[styles.dot, { backgroundColor: C_INHALE }]} />
              <Text style={[styles.helpText, { color: colors.textSecondary }]}>Вдохни через нос, пока круг растёт — 3 секунды.</Text>
            </View>
            <View style={styles.helpRow}>
              <View style={[styles.dot, { backgroundColor: C_HOLD }]} />
              <Text style={[styles.helpText, { color: colors.textSecondary }]}>Задержи дыхание — 2 секунды.</Text>
            </View>
            <View style={styles.helpRow}>
              <View style={[styles.dot, { backgroundColor: C_EXHALE }]} />
              <Text style={[styles.helpText, { color: colors.textSecondary }]}>Выдохни через рот, пока круг опадает — 4 секунды.</Text>
            </View>
            <Text style={[styles.helpFoot, { color: colors.textMuted }]}>Повтори {CYCLES} цикла, спокойно и без напряжения.</Text>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 22 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17, fontFamily: warmupFonts.title },
  cycle: {
    fontSize: 13,
    letterSpacing: 1.2,
    textAlign: "center",
    marginTop: 10,
    textTransform: "uppercase",
    fontFamily: warmupFonts.label,
  },
  cyclePlaceholder: { height: 23, marginTop: 10 },
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
  phaseCount: { fontSize: 54, fontFamily: warmupFonts.digit, marginTop: 2 },
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
  skipText: { fontSize: 14, fontFamily: warmupFonts.body },
  helpOverlay: {
    flex: 1,
    backgroundColor: "rgba(10,10,14,0.4)",
    justifyContent: "center",
    padding: 28,
  },
  helpCard: { borderRadius: 22, padding: 24, paddingTop: 26, gap: 12 },
  helpClose: { position: "absolute", top: 14, right: 14, padding: 4, zIndex: 2 },
  helpTitle: { fontSize: 20, fontFamily: warmupFonts.title, marginBottom: 2 },
  helpRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 7 },
  helpText: { flex: 1, fontSize: 15, lineHeight: 22, fontFamily: warmupFonts.body },
  helpFoot: { fontSize: 14, lineHeight: 20, marginTop: 4, fontFamily: warmupFonts.body },
});
