// Sign-in background: a «gradient trail» flare — a beam that starts narrow
// above the screen and opens into a wide trumpet towards the bottom, with
// warm stripes flowing out from the centre to the edges, forever.
//
// No shaders (works in Expo Go and on web): the screen is cut into thin
// horizontal rows. Every row holds the same stripe pattern, stretched
// sideways by the flare's width at that height (so the stripes bend into
// curves) and mirrored around the centre. One UI-thread clock slides the
// pattern by exactly one period per loop, so the flow is seamless.
import React, { useEffect } from "react";
import { Image, StyleSheet, View, useWindowDimensions } from "react-native";
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

/** Deep warm brown around the beam. */
export const FLARE_BG = "#1C0B06";

// One stripe period (centre → out): cream → yellow → gold → orange → ember → back.
const STRIPES = ["#FFF2C8", "#FFD84A", "#FFB21E", "#F47A1F", "#D9481B", "#F47A1F", "#FFB21E", "#FFD84A", "#FFF2C8"];
const PERIODS = 3;
const PATTERN = Array.from({ length: PERIODS }, (_, i) => (i === 0 ? STRIPES : STRIPES.slice(1))).flat();
const PATTERN_LOC = PATTERN.map((_, i) => i / (PATTERN.length - 1));

const ROWS = 96;
const LOOP_MS = 7000;

/** Half-width of the beam at height y (0..1 of the screen), as a share of half the screen. */
function spread(y: number) {
  // apex sits above the screen (u = 0 at y = -0.35)
  const u = (y + 0.35) / 1.35;
  return 0.05 + 2.6 * u * u;
}

function Half({
  s,
  mirror,
  B,
  P,
  clock,
}: {
  s: number;
  mirror: boolean;
  B: number;
  P: number;
  clock: SharedValue<number>;
}) {
  // stripes flow outward: the pattern (starting one period early) slides away from the centre
  const flow = useAnimatedStyle(() => ({ transform: [{ translateX: P * clock.value }] }));
  return (
    // halves overlap by a pixel so no hairline shows down the centre
    <View style={[styles.half, { width: B + 1 }, mirror ? { marginRight: -1, transform: [{ scaleX: -1 }] } : { marginLeft: -1 }]}>
      {/* everything inside is in «base» units, stretched by the beam's width */}
      <View style={[styles.stretch, { width: B, transform: [{ scaleX: s }] }]}>
        <Animated.View style={[styles.pattern, { left: -P, width: P * PERIODS }, flow]}>
          <LinearGradient
            colors={PATTERN as unknown as readonly [string, string, ...string[]]}
            locations={PATTERN_LOC as unknown as readonly [number, number, ...number[]]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
        {/* the beam's soft edge, then darkness beyond it */}
        <LinearGradient
          colors={["rgba(28,11,6,0)", FLARE_BG]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={{ position: "absolute", top: 0, bottom: 0, left: B * 0.55, width: B * 0.45 }}
        />
        <View style={{ position: "absolute", top: 0, bottom: 0, left: B - 0.5, width: B * 30, backgroundColor: FLARE_BG }} />
      </View>
    </View>
  );
}

export default function FlareBackground() {
  const { width: W, height: H } = useWindowDimensions();
  const B = W / 2;
  const P = B * 0.62; // one stripe period in base units
  const rowH = H / ROWS;
  const clock = useSharedValue(0);

  useEffect(() => {
    clock.value = withRepeat(withTiming(1, { duration: LOOP_MS, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(clock);
  }, [clock]);

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: FLARE_BG, overflow: "hidden" }]}>
      {Array.from({ length: ROWS }, (_, i) => {
        const s = spread((i + 0.5) / ROWS);
        return (
          <View key={i} style={[styles.row, { top: Math.floor(i * rowH), height: Math.ceil(rowH) + 2 }]}>
            <Half s={s} mirror B={B} P={P} clock={clock} />
            <Half s={s} mirror={false} B={B} P={P} clock={clock} />
          </View>
        );
      })}
      {/* film grain */}
      <Image
        source={require("@/assets/images/noise.png")}
        resizeMode="repeat"
        style={[StyleSheet.absoluteFill, { width: W, height: H, opacity: 0.06 }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { position: "absolute", left: 0, right: 0, flexDirection: "row" },
  half: { height: "100%", overflow: "hidden" },
  stretch: { position: "absolute", left: 0, top: 0, bottom: 0, transformOrigin: "left center" },
  pattern: { position: "absolute", left: 0, top: 0, bottom: 0 },
});
