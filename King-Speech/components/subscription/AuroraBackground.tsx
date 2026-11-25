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
import { Image, StyleSheet, View, useWindowDimensions } from "react-native";
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
  "#05031A",
  "#0D2897",
  "#5E52A8",
  "#C46A2E",
  "#B8508E",
  "#4A1F86",
  "#05031A",
] as const;

// three periods (column = exactly 3 periods tall) so the scroll wraps seamlessly
const tripled = (b: readonly string[]) => [...b, ...b.slice(1), ...b.slice(1)];

const hexRgb = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const rgbHex = (c: number[]) => "#" + c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
/** Adds eased (smoothstep) in-between tones so neighbouring colours melt into each other. */
function blended(b: readonly string[], steps = 4): string[] {
  const out: string[] = [];
  for (let i = 0; i < b.length - 1; i++) {
    const a = hexRgb(b[i]), c = hexRgb(b[i + 1]);
    for (let k = 0; k < steps; k++) {
      const t = k / steps;
      const e = t * t * (3 - 2 * t);
      out.push(rgbHex(a.map((v, j) => v + (c[j] - v) * e)));
    }
  }
  out.push(b[b.length - 1]);
  return out;
}
const locsOf = (stops: readonly string[]) => stops.map((_, i) => i / (stops.length - 1));
const STOPS = tripled(BANDS);
const LOCS = locsOf(STOPS);

const COLUMNS = 72;
/** Soft mode (sign-in): the screen is cut into STRIPES; each stripe is built
 *  from SLICES thin slices, every slice a little higher than the one before,
 *  so the light runs diagonally through the stripe's own shape and steps
 *  back down at the next stripe — a sawtooth of light. */
const STRIPES = 9;
const SLICES = 8;
const SOFT_COLUMNS = STRIPES * SLICES;
/** how far the gradient climbs across one stripe (share of the period) */
const SAW = 0.15;
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
  const stripe = Math.floor(i / SLICES);
  const slice = i % SLICES;
  // soft: the whole stripe moves as one (wave sampled at its centre)
  const x = soft ? (stripe + 0.5) / STRIPES : i / COLUMNS;
  const saw = soft ? -(slice / (SLICES - 1)) * SAW * period : 0;
  const style = useAnimatedStyle(() => {
    const t = clock.value; // 0 → 1 per loop
    const TAU = Math.PI * 2;
    // integer time multipliers keep the loop seamless
    const wave = soft
      ? // one long wave across the screen: wide, rounded arcs
        period * 0.07 * Math.sin(TAU * (x * 0.5 + t)) + period * 0.015 * Math.sin(TAU * (x * 0.8 - t) + 0.9)
      : period * 0.085 * Math.sin(TAU * (x * 0.9 + t)) +
        period * 0.04 * Math.sin(TAU * (x * 1.8 - 2 * t) + 1.3);
    return { transform: [{ translateY: -period * t + wave + saw - period * 0.15 }] };
  });
  return (
    <Animated.View
      style={[{ position: "absolute", top: 0, left: Math.floor(i * colW), width: Math.ceil(colW) + 1, height: period * 3 }, style]}
    >
      <LinearGradient colors={stops as unknown as readonly [string, string, ...string[]]} locations={locs as unknown as readonly [number, number, ...number[]]} style={StyleSheet.absoluteFill} />
      {soft && slice === 0 ? (
        // a soft shade where a stripe begins, so each stripe reads as its own blade
        <LinearGradient
          colors={["rgba(0,0,0,0.14)", "rgba(0,0,0,0)"]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
    </Animated.View>
  );
}

export default function AuroraBackground({
  palette,
  dim = true,
  rim = false,
  grain = false,
}: {
  /** Fine film grain on top. */
  grain?: boolean;
  /** One palette period, top → bottom (default: the paywall's pink/indigo/orange). */
  palette?: readonly string[];
  /** Darken top and bottom for legibility (paywall). */
  dim?: boolean;
  /** A soft coloured glow around the screen edges: blue top, violet sides, red bottom. */
  rim?: boolean;
}) {
  const { width: W, height: H } = useWindowDimensions();
  const stops = React.useMemo(() => (palette ? tripled(blended(palette)) : STOPS), [palette]);
  const locs = React.useMemo(() => (palette ? locsOf(stops) : LOCS), [palette, stops]);
  // one palette period ≈ 1.15 screens: about one band of each colour on screen
  // custom palettes (sign-in) read as one calm sweep: a longer period
  const period = H * (palette ? 2.2 : 1.15);
  const cols = palette ? SOFT_COLUMNS : COLUMNS;
  const colW = W / cols;
  const clock = useSharedValue(0);

  useEffect(() => {
    clock.value = withRepeat(withTiming(1, { duration: LOOP_MS, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(clock);
  }, [clock]);

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.root]}>
      {Array.from({ length: cols }, (_, i) => (
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
      {grain ? (
        <Image
          source={require("@/assets/images/noise.png")}
          resizeMode="repeat"
          style={[StyleSheet.absoluteFill, { width: W, height: H, opacity: 0.09 }]}
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
            <Filter id="auroraRimBlur" x="-30%" y="-30%" width="160%" height="160%">
              <FeGaussianBlur stdDeviation={W * 0.055} />
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
            strokeWidth={W * 0.18}
            filter="url(#auroraRimBlur)"
            opacity={0.6}
          />
        </Svg>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: "#08061A", overflow: "hidden" },
});
