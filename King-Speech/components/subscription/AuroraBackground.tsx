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
import Svg, { Defs, FeGaussianBlur, Filter, LinearGradient as SvgLinearGradient, Rect, Stop } from "react-native-svg";
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
/** Sign-in palette (the glowing-card reference): deep navy → blue → lavender →
 *  orange → pink → hot red, back through violet to navy. */
export const AURORA_DUSK = [
  "#070423",
  "#1238C8",
  "#9C92D8",
  "#F29A52",
  "#F78AD6",
  "#6A2BB8",
  "#070423",
] as const;

// three periods (column = exactly 3 periods tall) so the scroll wraps seamlessly
const tripled = (b: readonly string[]) => [...b, ...b.slice(1), ...b.slice(1)];
const locsOf = (stops: readonly string[]) => stops.map((_, i) => i / (stops.length - 1));
const STOPS = tripled(BANDS);
const LOCS = locsOf(STOPS);

const COLUMNS = 72;
const LOOP_MS = 18000;

function Column({
  i,
  colW,
  period,
  clock,
  stops,
  locs,
  soft,
}: {
  soft: boolean;
  i: number;
  colW: number;
  period: number;
  clock: SharedValue<number>;
  stops: string[];
  locs: number[];
}) {
  const x = i / COLUMNS;
  const style = useAnimatedStyle(() => {
    const t = clock.value; // 0 → 1 per loop
    const TAU = Math.PI * 2;
    // integer time multipliers keep the loop seamless
    const wave = soft
      ? // one long wave across the screen: wide, rounded arcs
        period * 0.07 * Math.sin(TAU * (x * 0.5 + t)) + period * 0.015 * Math.sin(TAU * (x * 0.8 - t) + 0.9)
      : period * 0.085 * Math.sin(TAU * (x * 0.9 + t)) +
        period * 0.04 * Math.sin(TAU * (x * 1.8 - 2 * t) + 1.3);
    return { transform: [{ translateY: -period * t + wave - period * 0.15 }] };
  });
  return (
    <Animated.View
      style={[{ position: "absolute", top: 0, left: Math.floor(i * colW), width: Math.ceil(colW) + 1, height: period * 3 }, style]}
    >
      <LinearGradient colors={stops as unknown as readonly [string, string, ...string[]]} locations={locs as unknown as readonly [number, number, ...number[]]} style={StyleSheet.absoluteFill} />
    </Animated.View>
  );
}

export default function AuroraBackground({
  palette,
  dim = true,
  rim = false,
}: {
  /** One palette period, top → bottom (default: the paywall's pink/indigo/orange). */
  palette?: readonly string[];
  /** Darken top and bottom for legibility (paywall). */
  dim?: boolean;
  /** A soft coloured glow around the screen edges: blue top, violet sides, red bottom. */
  rim?: boolean;
}) {
  const { width: W, height: H } = useWindowDimensions();
  const stops = React.useMemo(() => (palette ? tripled(palette) : STOPS), [palette]);
  const locs = React.useMemo(() => (palette ? locsOf(stops) : LOCS), [palette, stops]);
  // one palette period ≈ 1.15 screens: about one band of each colour on screen
  // custom palettes (sign-in) read as one calm sweep: a longer period
  const period = H * (palette ? 2.2 : 1.15);
  const colW = W / COLUMNS;
  const clock = useSharedValue(0);

  useEffect(() => {
    clock.value = withRepeat(withTiming(1, { duration: LOOP_MS, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(clock);
  }, [clock]);

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.root]}>
      {Array.from({ length: COLUMNS }, (_, i) => (
        <Column key={i} i={i} colW={colW} period={period} clock={clock} stops={stops} locs={locs} soft={!!palette} />
      ))}
      {/* keep the UI readable: deep top and bottom, softer middle */}
      {dim ? (
        <LinearGradient
          colors={["rgba(8,6,26,0.55)", "rgba(8,6,26,0.05)", "rgba(8,6,26,0.05)", "rgba(8,6,26,0.6)"]}
          locations={[0, 0.3, 0.65, 1]}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      {rim ? (
        // the glowing rim of the reference card, along the screen edges (static)
        <Svg width={W} height={H} style={StyleSheet.absoluteFill}>
          <Defs>
            <SvgLinearGradient id="auroraRim" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#2F4BFF" />
              <Stop offset="0.45" stopColor="#8A4BE0" />
              <Stop offset="0.75" stopColor="#FF5FA8" />
              <Stop offset="1" stopColor="#FF3B2F" />
            </SvgLinearGradient>
            <Filter id="auroraRimBlur" x="-20%" y="-20%" width="140%" height="140%">
              <FeGaussianBlur stdDeviation={W * 0.045} />
            </Filter>
          </Defs>
          <Rect
            x={0}
            y={0}
            width={W}
            height={H}
            rx={W * 0.12}
            fill="none"
            stroke="url(#auroraRim)"
            strokeWidth={W * 0.16}
            filter="url(#auroraRimBlur)"
            opacity={0.9}
          />
        </Svg>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: "#08061A", overflow: "hidden" },
});
