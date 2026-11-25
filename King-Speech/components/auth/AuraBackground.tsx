// Sign-in background: brand gold with three huge soft lights drifting over it
// (cream glow, orange heat, a dark ember corner) — like a lens flare on film.
// Minimal, calm, alive: each light is a radial-gradient disc moved and scaled
// by one UI-thread clock; integer frequencies keep the loop seamless.
import React, { useEffect } from "react";
import { Image, StyleSheet, View, useWindowDimensions } from "react-native";
import Svg, { Defs, RadialGradient, Stop, Circle } from "react-native-svg";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

export const AURA_BASE = "#FFC21A";
const LOOP_MS = 16000;

type Light = {
  id: string;
  color: string;
  /** peak opacity at the centre */
  alpha: number;
  /** diameter as a share of the screen height */
  size: number;
  /** resting centre (share of width / height) */
  x: number;
  y: number;
  /** drift radius (share of width) and phase */
  rx: number;
  ry: number;
  phase: number;
  /** breathing scale amplitude */
  breathe: number;
};

const LIGHTS: Light[] = [
  // warm orange heat sweeping the right side
  { id: "heat", color: "#F26A1B", alpha: 0.85, size: 0.95, x: 0.95, y: 0.35, rx: 0.12, ry: 0.06, phase: 0.2, breathe: 0.08 },
  // the dark ember on the right edge (kept clear of the buttons)
  { id: "ember", color: "#2A0E08", alpha: 0.85, size: 0.62, x: 1.08, y: 0.56, rx: 0.07, ry: 0.05, phase: 0.55, breathe: 0.06 },
  // cream light pouring in from the top left
  { id: "glow", color: "#FFF3CF", alpha: 0.95, size: 1.0, x: -0.05, y: 0.28, rx: 0.1, ry: 0.07, phase: 0.85, breathe: 0.1 },
];

function LightDisc({ l, W, H, clock }: { l: Light; W: number; H: number; clock: SharedValue<number> }) {
  const D = H * l.size;
  const style = useAnimatedStyle(() => {
    const a = (clock.value + l.phase) * Math.PI * 2;
    return {
      transform: [
        { translateX: Math.sin(a) * l.rx * W },
        { translateY: Math.sin(a * 2 + 1) * l.ry * H },
        { scale: 1 + Math.sin(a + 0.7) * l.breathe },
      ],
    };
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: "absolute", left: l.x * W - D / 2, top: l.y * H - D / 2, width: D, height: D }, style]}
    >
      <Svg width={D} height={D}>
        <Defs>
          <RadialGradient id={`aura_${l.id}`} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={l.color} stopOpacity={l.alpha} />
            <Stop offset="0.45" stopColor={l.color} stopOpacity={l.alpha * 0.55} />
            <Stop offset="1" stopColor={l.color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={D / 2} cy={D / 2} r={D / 2} fill={`url(#aura_${l.id})`} />
      </Svg>
    </Animated.View>
  );
}

export default function AuraBackground() {
  const { width: W, height: H } = useWindowDimensions();
  const clock = useSharedValue(0);
  useEffect(() => {
    clock.value = withRepeat(withTiming(1, { duration: LOOP_MS, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(clock);
  }, [clock]);
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: AURA_BASE, overflow: "hidden" }]}>
      {LIGHTS.map((l) => (
        <LightDisc key={l.id} l={l} W={W} H={H} clock={clock} />
      ))}
      {/* film grain */}
      <Image
        source={require("@/assets/images/noise.png")}
        resizeMode="repeat"
        style={[StyleSheet.absoluteFill, { width: W, height: H, opacity: 0.12 }]}
      />
    </View>
  );
}
