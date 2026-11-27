import React, { useEffect } from "react";
import { View, StyleSheet, Platform } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { rs } from "@/lib/responsive";
import { lightenHex } from "@/components/path/BrickStroke";

// Module-transition screen: a frosted glass pill showing how much of the
// current rank is left (reference: "Level 8" glass progress bar), plus a soft
// wash of the module's colour across the top of the screen.


/** Module-coloured glow across the top of the screen. */
export function ModuleTopGlow({ color, isDark }: { color: string; isDark: boolean }) {
  return (
    <View pointerEvents="none" style={styles.glow}>
      <LinearGradient
        colors={[color + (isDark ? "8C" : "B3"), color + (isDark ? "33" : "4D"), color + "00"]}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

export default function RankProgressPill({
  done,
  prevDone,
  total,
  color,
  isDark,
  delay = 0,
  enterDelay = 0,
}: {
  /** ms before the pill appears */
  enterDelay?: number;
  /** modules of the rank finished, including the one just completed */
  done: number;
  /** value the bar starts from (before this module) — it fills up to `done` */
  prevDone: number;
  total: number;
  color: string;
  isDark: boolean;
  /** ms before the bar fills */
  delay?: number;
}) {
  const frac = (n: number) => (total > 0 ? Math.min(1, Math.max(0, n / total)) : 0);
  const p = useSharedValue(frac(prevDone));
  useEffect(() => {
    p.value = withDelay(delay, withTiming(frac(done), { duration: 1100, easing: Easing.out(Easing.cubic) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, total]);
  // entrance: the glass slides down, stretches out from the centre and fades in
  const enter = useSharedValue(0);
  useEffect(() => {
    enter.value = withDelay(enterDelay, withSpring(1, { damping: 16, stiffness: 120, mass: 0.9 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const enterDrop = rs(-14);
  const enterStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, enter.value * 1.4),
    transform: [{ translateY: (1 - enter.value) * enterDrop }, { scaleX: 0.55 + 0.45 * enter.value }],
  }));
  const fillStyle = useAnimatedStyle(() => ({ width: `${Math.max(p.value, 0.1) * 100}%` }));

  return (
    <Animated.View style={[styles.wrap, enterStyle]}>
      <View style={styles.pill}>
        {Platform.OS === "web" ? (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.35)" }]} />
        ) : (
          <BlurView intensity={40} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
        )}
        {/* milky glass */}
        <LinearGradient
          colors={isDark ? ["rgba(255,255,255,0.16)", "rgba(255,255,255,0.05)"] : ["rgba(255,255,255,0.6)", "rgba(255,255,255,0.25)"]}
          style={StyleSheet.absoluteFill}
        />
        <Animated.View style={[styles.fill, fillStyle]}>
          <LinearGradient
            colors={[lightenHex(color, 0.35), lightenHex(color, 0.65)]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
          {/* glassy sheen along the top of the fill */}
          <LinearGradient
            colors={["rgba(255,255,255,0.45)", "rgba(255,255,255,0)"]}
            locations={[0, 0.6]}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  glow: { position: "absolute", top: 0, left: 0, right: 0, height: "50%" },
  wrap: { alignItems: "center", alignSelf: "stretch" },
  pill: {
    width: "86%",
    height: rs(32),
    borderRadius: rs(16),
    overflow: "hidden",
    padding: rs(4),
    justifyContent: "center",
  },
  fill: { height: "100%", borderRadius: rs(12), overflow: "hidden" },
});
