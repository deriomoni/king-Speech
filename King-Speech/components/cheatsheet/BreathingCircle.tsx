import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
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
import { fonts } from "@/constants/colors";
import { useAppColors } from "@/hooks/useAppColors";
import { tx, type BreathingStep, type PhaseType } from "@/constants/cheatsheetData";

// Distinct colour per phase so it's instantly obvious where you are.
const C_INHALE = "#FFCF34";
const C_HOLD = "#B7A6FF";
const C_EXHALE = "#5FD3C4";

const MIN_SCALE = 0.62;
const MAX_SCALE = 1;

function phaseColor(type: PhaseType): string {
  if (type === "inhale") return C_INHALE;
  if (type === "hold") return C_HOLD;
  return C_EXHALE;
}

function phaseIcon(type: PhaseType): keyof typeof Ionicons.glyphMap {
  if (type === "inhale") return "arrow-down";
  if (type === "hold") return "pause";
  return "arrow-up";
}

function haptic() {
  if (Platform.OS !== "web") {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }
}

/**
 * Guided breathing circle. Auto-runs the step's pattern for `cycles` loops.
 * The circle grows on inhale, holds, and shrinks on exhale, synced to a
 * per-phase countdown. Pure animation + timers — works on every platform.
 */
export default function BreathingCircle({
  step,
  lang,
  onDone,
}: {
  step: BreathingStep;
  lang: string;
  onDone?: () => void;
}) {
  const { colors } = useAppColors();
  const phases = React.useMemo(
    () => Array.from({ length: step.cycles }).flatMap(() => step.pattern),
    [step],
  );

  const [idx, setIdx] = useState(0);
  const [count, setCount] = useState(step.pattern[0]?.sec ?? 3);
  const [finished, setFinished] = useState(false);
  const scale = useSharedValue(MIN_SCALE);

  const doneRef = React.useRef(onDone);
  useEffect(() => {
    doneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    if (finished) return;
    if (idx >= phases.length) {
      setFinished(true);
      haptic();
      doneRef.current?.();
      return;
    }
    const phase = phases[idx];
    setCount(phase.sec);
    haptic();
    if (phase.type === "inhale") {
      scale.value = withTiming(MAX_SCALE, {
        duration: phase.sec * 1000,
        easing: Easing.inOut(Easing.ease),
      });
    } else if (phase.type === "exhale") {
      scale.value = withTiming(MIN_SCALE, {
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
  }, [idx, finished, phases.length]);

  useEffect(() => () => cancelAnimation(scale), [scale]);

  const circleStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const phase = !finished ? phases[Math.min(idx, phases.length - 1)] : null;
  const color = phase ? phaseColor(phase.type) : C_EXHALE;
  const cycle = Math.min(step.cycles, Math.floor(idx / step.pattern.length) + 1);

  return (
    <View style={styles.wrap}>
      <Text style={[styles.cycle, { color: colors.textMuted }]}>
        {finished
          ? lang === "en" ? "Done — nicely breathed" : "Готово — отлично подышал"
          : lang === "en"
            ? `Cycle ${cycle} of ${step.cycles}`
            : `Цикл ${cycle} из ${step.cycles}`}
      </Text>

      {phase ? (
        <Animated.View
          key={`cue-${idx}`}
          entering={FadeIn.duration(260)}
          style={[styles.cue, { backgroundColor: color + "1A", borderColor: color + "4D" }]}
        >
          <Ionicons name={phaseIcon(phase.type)} size={18} color={color} />
          <Text style={[styles.cueText, { color }]}>{tx(phase.cue, lang)}</Text>
        </Animated.View>
      ) : (
        <View style={[styles.cue, { backgroundColor: C_EXHALE + "1A", borderColor: C_EXHALE + "4D" }]}>
          <Ionicons name="checkmark" size={18} color={C_EXHALE} />
          <Text style={[styles.cueText, { color: C_EXHALE }]}>
            {lang === "en" ? "Tap Forward when ready" : "Нажми «Вперёд», когда готов"}
          </Text>
        </View>
      )}

      <View style={styles.center}>
        <View style={[styles.ring, { borderColor: color + "2E" }]} />
        <Animated.View
          style={[styles.circle, circleStyle, { backgroundColor: color + "22", borderColor: color }]}
        >
          {phase ? (
            <>
              <Text style={[styles.phaseLabel, { color }]}>{tx(phase.label, lang)}</Text>
              <Text style={[styles.phaseCount, { color: colors.text }]}>{count}</Text>
            </>
          ) : (
            <Ionicons name="leaf-outline" size={52} color={C_INHALE} />
          )}
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: "center", justifyContent: "flex-start", width: "100%" },
  cycle: { color: "rgba(255,255,255,0.6)", fontSize: 14, fontFamily: fonts.bodySemibold, textAlign: "center", marginBottom: 6 },
  cue: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 22,
    borderWidth: 1,
  },
  cueText: { fontSize: 15, fontFamily: fonts.bodySemibold },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  ring: { position: "absolute", width: 264, height: 264, borderRadius: 132, borderWidth: 1.5 },
  circle: {
    width: 208,
    height: 208,
    borderRadius: 104,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  phaseLabel: { fontSize: 19, fontFamily: fonts.bodyBold },
  phaseCount: { color: "#fff", fontSize: 54, fontFamily: fonts.display, marginTop: 2 },
});
