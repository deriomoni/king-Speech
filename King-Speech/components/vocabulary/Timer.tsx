import React, { useEffect } from "react";
import { StyleSheet } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useTheme } from "@/context/ThemeContext";
import { colors as brand } from "@/theme/tokens";

/**
 * Level timer — just the digits (owner: no box).
 *   default — theme ink.
 *   low     — last seconds: the digits turn warm orange and pulse on every tick.
 *   added   — bonus time granted: a short green flash + pop.
 */
export type TimerState = "default" | "low" | "added";

function formatTime(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export default function Timer({
  seconds,
  state = "default",
}: {
  /** Seconds left. */
  seconds: number;
  /** Full allotment (kept for API compatibility). */
  total?: number;
  state?: TimerState;
}) {
  const { theme } = useTheme();
  const scale = useSharedValue(1);
  const whole = Math.max(0, Math.floor(seconds));

  // Pulse on every second while time is running out.
  useEffect(() => {
    if (state !== "low" || whole <= 0) return;
    scale.value = withSequence(
      withTiming(1.16, { duration: 140, easing: Easing.out(Easing.quad) }),
      withSpring(1, { damping: 10, stiffness: 220, mass: 0.6 }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [whole, state]);

  // Pop when bonus time lands.
  useEffect(() => {
    if (state !== "added") return;
    scale.value = withSequence(
      withTiming(1.22, { duration: 160, easing: Easing.out(Easing.quad) }),
      withSpring(1, { damping: 9, stiffness: 200, mass: 0.7 }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const color = state === "low" ? brand.warning : state === "added" ? brand.success : theme.text;

  return (
    <Animated.Text style={[styles.time, { color }, anim]} accessibilityRole="timer">
      {formatTime(seconds)}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  time: {
    fontFamily: "Geologica_900Black",
    fontSize: 30,
    letterSpacing: -0.6,
    fontVariant: ["tabular-nums"],
    textAlign: "center",
  },
});
