import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, Platform, Modal } from "react-native";
import Animated, {
  useSharedValue,
  withTiming,
  Easing,
  cancelAnimation,
  FadeIn,
  FadeInDown,
  FadeOut,
} from "react-native-reanimated";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import BreathingWaves from "@/components/warmup/BreathingWaves";
import { warmupFonts } from "@/components/warmup/warmupTheme";

const CYCLES = 3;
type PhaseType = "inhale" | "hold" | "exhale";
interface Phase {
  type: PhaseType;
  label: string;
  via: string;
  sec: number;
  color: string;
}

// Refined tones that read on a white canvas (light gold would vanish).
const C_INHALE = "#E0A020"; // warm amber — breathe in
const C_HOLD = "#7C4DFF"; // violet — hold
const C_EXHALE = "#22A79A"; // teal — breathe out
const INK = "#15151B";
const MUTED = "rgba(21,21,27,0.5)";

const PATTERN: Phase[] = [
  { type: "inhale", label: "Вдох", via: "через нос", sec: 3, color: C_INHALE },
  { type: "hold", label: "Задержка", via: "держи", sec: 2, color: C_HOLD },
  { type: "exhale", label: "Выдох", via: "через рот", sec: 4, color: C_EXHALE },
];
const PHASES = Array.from({ length: CYCLES }).flatMap(() => PATTERN);

// Water level (0 = exhaled/low, 1 = inhaled/high) — drives BreathingWaves.
const LEVEL_LOW = 0;
const LEVEL_HIGH = 1;

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
  onComplete: () => void;
  onBack: () => void;
}) {
  const [running, setRunning] = useState(false);
  const [idx, setIdx] = useState(0);
  const [count, setCount] = useState(PATTERN[0].sec);
  const [showHelp, setShowHelp] = useState(false);
  const level = useSharedValue(LEVEL_LOW);

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
    // Inhale raises the water; exhale lowers it; hold leaves the level frozen
    // where it is — the water visibly pauses.
    if (phase.type === "inhale") {
      level.value = withTiming(LEVEL_HIGH, {
        duration: phase.sec * 1000,
        easing: Easing.inOut(Easing.ease),
      });
    } else if (phase.type === "exhale") {
      level.value = withTiming(LEVEL_LOW, {
        duration: phase.sec * 1000,
        easing: Easing.inOut(Easing.ease),
      });
    }
    const ci = setInterval(() => setCount((c) => Math.max(0, c - 1)), 1000);
    const to = setTimeout(() => setIdx((i) => i + 1), phase.sec * 1000);
    return () => {
      clearInterval(ci);
      clearTimeout(to);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, idx]);

  useEffect(() => () => cancelAnimation(level), [level]);

  const start = useCallback(() => {
    setIdx(0);
    setCount(PATTERN[0].sec);
    level.value = LEVEL_LOW;
    setRunning(true);
    haptic();
  }, [level]);

  const phase = running ? PHASES[Math.min(idx, PHASES.length - 1)] : null;
  const cycle = Math.min(CYCLES, Math.floor(idx / PATTERN.length) + 1);
  const phaseColor = phase?.color ?? C_INHALE;

  return (
    <View style={styles.root}>
      {/* Full-bleed animated water — behind everything, driven by the breath */}
      <BreathingWaves level={level} />

      <View style={[styles.content, { paddingTop: topPad + 8 }]}>
      {/* Top bar: subtle back (left) + title + help (right) */}
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={12} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={24} color="rgba(21,21,27,0.55)" />
        </Pressable>
        <Text style={styles.headerTitle}>Дыхательная разминка</Text>
        <Pressable onPress={() => setShowHelp(true)} hitSlop={12} style={styles.iconBtn}>
          <Ionicons name="help-circle-outline" size={24} color="rgba(21,21,27,0.55)" />
        </Pressable>
      </View>

      {running ? (
        <Animated.Text
          key={`cyc-${cycle}`}
          entering={FadeIn.duration(300)}
          style={styles.cycle}
        >
          Цикл {cycle} из {CYCLES}
        </Animated.Text>
      ) : (
        <View style={styles.cyclePlaceholder} />
      )}

      {/* Phase readout — centered over the animated background */}
      <View style={styles.center} pointerEvents="none">
        {running && phase ? (
          <Animated.View
            key={`ph-${idx}`}
            entering={FadeInDown.duration(320)}
            exiting={FadeOut.duration(160)}
            style={styles.readout}
          >
            <View style={styles.phaseRow}>
              <View style={[styles.dot, { backgroundColor: phaseColor }]} />
              <Text style={[styles.phaseLabel, { color: phaseColor }]}>
                {phase.label.toUpperCase()}
              </Text>
            </View>
            <Text style={styles.count}>{count}</Text>
            <Text style={styles.via}>{phase.via}</Text>
          </Animated.View>
        ) : null}
      </View>

      {/* Footer: glass Start (idle) / skip (running) */}
      <View style={styles.footer}>
        {!running ? (
          <Animated.View entering={FadeInDown.delay(120).duration(420)}>
            <Pressable onPress={start} style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}>
              <View style={styles.glassBtn}>
                <BlurView intensity={28} tint="light" style={StyleSheet.absoluteFill} />
                <View style={styles.glassSheen} />
                <Text style={styles.glassText}>Начать</Text>
              </View>
            </Pressable>
          </Animated.View>
        ) : (
          <Pressable onPress={onComplete} hitSlop={8} style={styles.skip}>
            <Text style={styles.skipText}>Пропустить →</Text>
          </Pressable>
        )}
      </View>
      </View>

      {/* How-to-play instructions */}
      <Modal visible={showHelp} transparent animationType="fade" onRequestClose={() => setShowHelp(false)}>
        <Pressable style={styles.helpOverlay} onPress={() => setShowHelp(false)}>
          <Pressable style={styles.helpCard} onPress={() => {}}>
            <Pressable
              onPress={() => setShowHelp(false)}
              hitSlop={12}
              style={styles.helpClose}
            >
              <Ionicons name="close" size={22} color={MUTED} />
            </Pressable>
            <Text style={styles.helpTitle}>Как проходить</Text>
            <Text style={styles.helpLead}>Дыши вместе с волной — она подсказывает ритм.</Text>

            <View style={styles.helpStep}>
              <View style={[styles.dot, { backgroundColor: C_INHALE }]} />
              <Text style={styles.helpStepText}>
                <Text style={styles.helpStepBold}>Вдох</Text> через нос, пока волна растёт — 3 секунды.
              </Text>
            </View>
            <View style={styles.helpStep}>
              <View style={[styles.dot, { backgroundColor: C_HOLD }]} />
              <Text style={styles.helpStepText}>
                <Text style={styles.helpStepBold}>Задержка</Text> — волна замирает, держи дыхание 2 секунды.
              </Text>
            </View>
            <View style={styles.helpStep}>
              <View style={[styles.dot, { backgroundColor: C_EXHALE }]} />
              <Text style={styles.helpStepText}>
                <Text style={styles.helpStepBold}>Выдох</Text> через рот, пока волна опадает — 4 секунды.
              </Text>
            </View>
            <Text style={styles.helpFoot}>Повтори {CYCLES} цикла, медленно и без напряжения.</Text>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#FFFFFF" },
  content: { flex: 1, paddingHorizontal: 22 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: INK, fontSize: 17, fontFamily: warmupFonts.title },
  cycle: {
    color: MUTED,
    fontSize: 13,
    letterSpacing: 1.2,
    textAlign: "center",
    marginTop: 10,
    textTransform: "uppercase",
    fontFamily: warmupFonts.label,
  },
  cyclePlaceholder: { height: 23, marginTop: 10 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  readout: { alignItems: "center" },
  phaseRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  phaseLabel: { fontSize: 14, letterSpacing: 2, fontFamily: warmupFonts.label },
  count: { color: INK, fontSize: 60, fontFamily: warmupFonts.digit, marginTop: 2 },
  via: { color: MUTED, fontSize: 15, fontFamily: warmupFonts.body, marginTop: -2 },
  footer: { paddingBottom: 30, alignItems: "center", minHeight: 96, justifyContent: "center" },
  glassBtn: {
    minWidth: 220,
    paddingHorizontal: 44,
    height: 58,
    borderRadius: 29,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.45)",
    borderWidth: 1,
    borderColor: "rgba(21,21,27,0.08)",
    ...Platform.select({
      ios: {
        shadowColor: "#141419",
        shadowOpacity: 0.12,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: 10 },
      },
      android: { elevation: 6 },
      default: {},
    }),
  },
  glassSheen: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "50%",
    backgroundColor: "rgba(255,255,255,0.35)",
  },
  glassText: { color: INK, fontSize: 17, fontFamily: warmupFonts.title, letterSpacing: 0.3 },
  skip: { padding: 12 },
  skipText: { color: MUTED, fontSize: 14, fontFamily: warmupFonts.body },
  helpOverlay: {
    flex: 1,
    backgroundColor: "rgba(10,10,14,0.32)",
    justifyContent: "center",
    padding: 28,
  },
  helpCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 24,
    paddingTop: 26,
    gap: 12,
  },
  helpClose: { position: "absolute", top: 14, right: 14, padding: 4, zIndex: 2 },
  helpTitle: { color: INK, fontSize: 22, fontFamily: warmupFonts.title },
  helpLead: { color: MUTED, fontSize: 15, lineHeight: 21, fontFamily: warmupFonts.body },
  helpStep: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginTop: 2 },
  helpStepText: { flex: 1, color: "rgba(21,21,27,0.75)", fontSize: 15, lineHeight: 22, fontFamily: warmupFonts.body },
  helpStepBold: { color: INK, fontFamily: warmupFonts.label },
  helpFoot: { color: MUTED, fontSize: 14, lineHeight: 20, marginTop: 6, fontFamily: warmupFonts.body },
});
