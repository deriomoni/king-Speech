import React, { useEffect } from "react";
import { Dimensions, StyleSheet } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
  interpolate,
  type SharedValue,
} from "react-native-reanimated";
import Svg, { Path, Defs, LinearGradient, Stop } from "react-native-svg";

// ─────────────────────────────────────────────────────────────────────────────
// BreathingWaves — a hand-built, full-bleed water animation that replaces the
// Rive file so the breath drives it exactly. `level` (0..1) is the water level:
// the caller raises it on inhale, lowers it on exhale, and freezes it on hold.
// Each layer scrolls horizontally on the UI thread (ambient life), while the
// whole body rises/falls with `level` — the visible, always-synced breath.
// SVG + Reanimated only, so it runs everywhere including Expo Go.
// ─────────────────────────────────────────────────────────────────────────────

const { width: W, height: H } = Dimensions.get("window");
const TILE = W; // pattern repeats every TILE; each layer is 2×TILE wide → seamless

// Build a seamless wave surface across 2×TILE, filled far below the screen so
// lowering the water never reveals a gap at the bottom.
function wavePath(periods: number, amp: number, surfaceY: number): string {
  const width = TILE * 2;
  const wl = TILE / periods;
  const steps = Math.ceil(width / 6);
  let d = `M0 ${surfaceY.toFixed(1)}`;
  for (let i = 1; i <= steps; i++) {
    const x = (i / steps) * width;
    const y = surfaceY - Math.sin((x / wl) * Math.PI * 2) * amp;
    d += ` L${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  d += ` L${width} ${H * 2} L0 ${H * 2} Z`;
  return d;
}

interface Layer {
  id: string;
  periods: number;
  amp: number;
  surfaceY: number;
  speed: number; // ms per tile
  from: string;
  to: string;
  opacity: number;
  hi: number; // inhale surface (fraction of H)
  lo: number; // exhale surface (fraction of H)
}

// Back → front. Cool, calm water tuned to read on a white canvas.
const LAYERS: Layer[] = [
  { id: "a", periods: 2, amp: 15, surfaceY: 30, speed: 11000, from: "#DCEFF2", to: "#C4E6EC", opacity: 0.7, hi: 0.2, lo: 0.66 },
  { id: "b", periods: 3, amp: 11, surfaceY: 20, speed: 8200, from: "#B3DEE6", to: "#93D0DB", opacity: 0.7, hi: 0.24, lo: 0.62 },
  { id: "c", periods: 2.4, amp: 20, surfaceY: 40, speed: 6000, from: "#86CBD6", to: "#5CBBCB", opacity: 0.82, hi: 0.28, lo: 0.58 },
];

function WaveLayer({ layer, level }: { layer: Layer; level: SharedValue<number> }) {
  const tx = useSharedValue(0);
  useEffect(() => {
    tx.value = 0;
    tx.value = withRepeat(
      withTiming(-TILE, { duration: layer.speed, easing: Easing.linear }),
      -1,
      false,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(level.value, [0, 1], [H * layer.lo, H * layer.hi]) },
      { translateX: tx.value },
    ],
  }));

  const d = wavePath(layer.periods, layer.amp, layer.surfaceY);
  return (
    <Animated.View style={[styles.layer, { opacity: layer.opacity }, style]}>
      <Svg width={TILE * 2} height={H * 2}>
        <Defs>
          <LinearGradient id={`bw-${layer.id}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={layer.from} />
            <Stop offset="1" stopColor={layer.to} />
          </LinearGradient>
        </Defs>
        <Path d={d} fill={`url(#bw-${layer.id})`} />
      </Svg>
    </Animated.View>
  );
}

export default function BreathingWaves({ level }: { level: SharedValue<number> }) {
  return (
    <Animated.View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {LAYERS.map((l) => (
        <WaveLayer key={l.id} layer={l} level={level} />
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  layer: { position: "absolute", left: 0, top: 0, width: TILE * 2, height: H * 2 },
});
