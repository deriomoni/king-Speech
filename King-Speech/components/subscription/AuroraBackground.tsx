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
import { Image, Platform, StyleSheet, View, useWindowDimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import MaskedViewBase from "@react-native-masked-view/masked-view";
import Svg, { Defs, FeGaussianBlur, Filter, LinearGradient as SvgLinearGradient, Rect, Stop } from "react-native-svg";
import Animated, {
  Easing,
  useAnimatedStyle,
  useFrameCallback,
  runOnJS,
  useSharedValue,
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
  "#1C0F52",
  "#1838B8",
  "#6A5AC4",
  "#FFB42E",
  "#FFF1B8",
  "#FF8E3A",
  "#D2589A",
  "#F0C8DC",
  "#8C3484",
  "#1C0F52",
] as const;

// three periods (column = exactly 3 periods tall) so the scroll wraps seamlessly
const tripled = (b: readonly string[]) => [...b, ...b.slice(1), ...b.slice(1)];

const hexRgb = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const rgbHex = (c: number[]) => "#" + c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
/** The same colour, darker: value scaled down, saturation nudged up — hue kept. */
function deepen(hex: string, k = 0.42): string {
  const [r, g, b] = hexRgb(hex);
  const m = (r + g + b) / 3;
  const sat = 1.15;
  return rgbHex([r, g, b].map((v) => Math.max(0, Math.min(255, (m + (v - m) * sat) * k))));
}

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

// its class typings predate the current React types; the component itself is fine
const MaskedView = MaskedViewBase as unknown as React.ComponentType<any>;

const COLUMNS = 72;
/** Soft mode (sign-in): the screen is cut into STRIPES; each stripe is built
 *  from SLICES thin slices, every slice a little higher than the one before,
 *  so the light runs diagonally through the stripe's own shape and steps
 *  back down at the next stripe — a sawtooth of light. */
const STRIPES = 9;
const SLICES = 8;
const SOFT_COLUMNS = STRIPES * SLICES;
/** how far the gradient climbs across one stripe (share of the period) */
const SAW = 0.12;
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
      {soft ? (
        // fluted glass: every stripe is a rounded glass blade — shaded where
        // it begins, catching more light across its width, with a bright
        // glint along its far edge
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor:
                slice === 0
                  ? "rgba(0,0,0,0.10)"
                  : slice === 1
                    ? "rgba(0,0,0,0.04)"
                    : `rgba(255,255,255,${(0.01 + 0.06 * (slice / (SLICES - 1)) ** 2).toFixed(3)})`,
            },
          ]}
        />
      ) : null}
      {soft && slice === SLICES - 1 ? (
        <LinearGradient
          colors={["rgba(255,255,255,0)", "rgba(255,255,255,0.18)"]}
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
  shade = 0,
  initialShade,
  shadeMs = 1100,
}: {
  /** Recolour the whole gradient darker (0 = normal, 1 = dark), washing in from the top — animated on change. */
  shade?: number;
  /** Where the darkening starts on mount (default: = shade, no animation). */
  initialShade?: number;
  shadeMs?: number;
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
  const darkStops = React.useMemo(() => (palette ? stops.map((c) => deepen(c)) : undefined), [palette, stops]);
  // one palette period ≈ 1.15 screens: about one band of each colour on screen
  // custom palettes (sign-in) read as one calm sweep: a longer period
  const period = H * (palette ? 2.2 : 1.15);
  const cols = palette ? SOFT_COLUMNS : COLUMNS;
  const colW = W / cols;
  const clock = useSharedValue(0);
  const shadeV = useSharedValue(initialShade ?? shade);
  // the rim dims together with the recolour
  const rimStyle = useAnimatedStyle(() => ({ opacity: 1 - 0.65 * shadeV.value }));
  // the dark layer only exists while it's (becoming) visible
  const [darkOn, setDarkOn] = React.useState((initialShade ?? shade) > 0 || shade > 0);
  useEffect(() => {
    if (shade > 0) setDarkOn(true);
    shadeV.value = withTiming(shade, { duration: shadeMs, easing: Easing.inOut(Easing.sin) }, (done) => {
      if (done && shade === 0) runOnJS(setDarkOn)(false);
    });
  }, [shade, shadeMs, shadeV]);
  // a tall soft mask slides down: opaque on top, a full screen of feather below
  const webDarkStyle = useAnimatedStyle(() => ({ opacity: shadeV.value }));
  const maskStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -2 * H * (1 - shadeV.value) }] }));

  // the clock follows the frame timestamp (system time), so every copy of the
  // aurora — e.g. sign-in and the email screen fading over it — is in phase
  useFrameCallback((frame) => {
    clock.value = (frame.timestamp % LOOP_MS) / LOOP_MS;
  });

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.root]}>
      {Array.from({ length: cols }, (_, i) => (
        <Column key={i} i={i} colW={colW} period={period} clock={clock} stops={stops} locs={locs} soft={!!palette} />
      ))}
      {palette && darkStops && darkOn && Platform.OS === "web" ? (
        // web: MaskedView renders only its mask there — fade the dark copy in whole
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, webDarkStyle]}>
          {Array.from({ length: cols }, (_, i) => (
            <Column key={`w${i}`} i={i} colW={colW} period={period} clock={clock} stops={darkStops} locs={locs} soft />
          ))}
        </Animated.View>
      ) : null}
      {palette && darkStops && darkOn && Platform.OS !== "web" ? (
        // the same aurora, recoloured darker, revealed top → bottom through a
        // soft gradient mask — the colours themselves deepen, no black veil
        <MaskedView
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
          maskElement={
            <Animated.View style={[{ position: "absolute", left: 0, right: 0, top: 0, height: 2 * H }, maskStyle]}>
              <LinearGradient
                colors={["#000000", "#000000", "rgba(0,0,0,0)"]}
                locations={[0, 0.5, 1]}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
          }
        >
          {Array.from({ length: cols }, (_, i) => (
            <Column key={`d${i}`} i={i} colW={colW} period={period} clock={clock} stops={darkStops} locs={locs} soft />
          ))}
        </MaskedView>
      ) : null}
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
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, rimStyle]}>
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
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: "#08061A", overflow: "hidden" },
});
