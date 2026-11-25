// Sign-in background: brand gold with three huge soft lights drifting over it
// (cream glow, orange heat, a dark ember corner) — like a lens flare on film.
// Minimal, calm, alive: each light is a radial-gradient disc moved and scaled
// by one UI-thread clock; integer frequencies keep the loop seamless.
import React, { useEffect } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
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

export const AURA_BASE = "#FFC814";
const LOOP_MS = 9000;

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
  /** drift radius (share of width / height), phase and speed (whole turns per loop) */
  rx: number;
  ry: number;
  phase: number;
  speed: number;
  /** breathing scale amplitude */
  breathe: number;
};

// Colours after the reference photo: saturated yellow, a cream light on the
// left, hot orange → red on the right, a near-black ember in the lower right
// and an orange warmth along the bottom. Drawn back to front.
const LIGHTS: Light[] = [
  { id: "bottom", color: "#F2731C", alpha: 1, size: 0.85, x: 0.15, y: 1.02, rx: 0.22, ry: 0.06, phase: 0.1, speed: 1, breathe: 0.1 },
  { id: "heat", color: "#F0561A", alpha: 1, size: 0.9, x: 1.0, y: 0.3, rx: 0.2, ry: 0.12, phase: 0.35, speed: 1, breathe: 0.12 },
  { id: "ember", color: "#160603", alpha: 1, size: 0.62, x: 1.08, y: 0.6, rx: 0.12, ry: 0.1, phase: 0.6, speed: 1, breathe: 0.1 },
  { id: "glow", color: "#FFF1C2", alpha: 1, size: 0.95, x: -0.08, y: 0.32, rx: 0.2, ry: 0.12, phase: 0.85, speed: 2, breathe: 0.14 },
];

function LightDisc({ l, W, H, clock }: { l: Light; W: number; H: number; clock: SharedValue<number> }) {
  const D = H * l.size;
  const style = useAnimatedStyle(() => {
    const a = (clock.value * l.speed + l.phase) * Math.PI * 2;
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
            <Stop offset="0.35" stopColor={l.color} stopOpacity={l.alpha * 0.8} />
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
    </View>
  );
}
