// Animated paywall background: soft horizontal bands of colour that drift
// upward and sway like a slow wave (motion of the user's video reference),
// in the palette of the blurred pink / indigo / orange reference, with grain.
//
// No shaders (works in Expo Go and on web): the screen is cut into thin
// vertical columns, each a tall vertical gradient of the palette repeated
// twice. Every column scrolls by exactly one palette period per loop and is
// nudged up/down by two sines of its x — neighbours differ by a few px, so
// the bands read as continuous waves. Everything runs on the UI thread.
import React, { useEffect } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

// One palette period, top → bottom (reference: near-black indigo surround,
// violet-blue, magenta-pink, pale pink, orange, peach, coral, back to dark).
const BANDS = [
  "#08061A",
  "#1E1466",
  "#4A35D8",
  "#B45AD8",
  "#EE7DD4",
  "#F6B9E6",
  "#F59A6E",
  "#F07636",
  "#E8566A",
  "#5A1E5C",
  "#08061A",
] as const;
// three periods (column = exactly 3 periods tall) so the scroll wraps seamlessly
const STOPS = [...BANDS, ...BANDS.slice(1), ...BANDS.slice(1)];
const LOCS = STOPS.map((_, i) => i / (STOPS.length - 1));

const COLUMNS = 72;
const LOOP_MS = 18000;

function Column({
  i,
  colW,
  period,
  clock,
}: {
  i: number;
  colW: number;
  period: number;
  clock: SharedValue<number>;
}) {
  const x = i / COLUMNS;
  const style = useAnimatedStyle(() => {
    const t = clock.value; // 0 → 1 per loop
    const TAU = Math.PI * 2;
    // integer time multipliers keep the loop seamless
    const wave =
      period * 0.085 * Math.sin(TAU * (x * 0.9 + t)) +
      period * 0.04 * Math.sin(TAU * (x * 1.8 - 2 * t) + 1.3);
    return { transform: [{ translateY: -period * t + wave - period * 0.15 }] };
  });
  return (
    <Animated.View
      style={[{ position: "absolute", top: 0, left: Math.floor(i * colW), width: Math.ceil(colW) + 1, height: period * 3 }, style]}
    >
      <LinearGradient colors={STOPS as unknown as readonly [string, string, ...string[]]} locations={LOCS as unknown as readonly [number, number, ...number[]]} style={StyleSheet.absoluteFill} />
    </Animated.View>
  );
}

export default function AuroraBackground() {
  const { width: W, height: H } = useWindowDimensions();
  // one palette period ≈ 1.15 screens: about one band of each colour on screen
  const period = H * 1.15;
  const colW = W / COLUMNS;
  const clock = useSharedValue(0);

  useEffect(() => {
    clock.value = withRepeat(withTiming(1, { duration: LOOP_MS, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(clock);
  }, [clock]);

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.root]}>
      {Array.from({ length: COLUMNS }, (_, i) => (
        <Column key={i} i={i} colW={colW} period={period} clock={clock} />
      ))}
      {/* keep the UI readable: deep top and bottom, softer middle */}
      <LinearGradient
        colors={["rgba(8,6,26,0.55)", "rgba(8,6,26,0.05)", "rgba(8,6,26,0.05)", "rgba(8,6,26,0.6)"]}
        locations={[0, 0.3, 0.65, 1]}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: "#08061A", overflow: "hidden" },
});
