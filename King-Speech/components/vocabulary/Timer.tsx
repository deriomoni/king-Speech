import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle, Defs, Path, RadialGradient, Rect, Stop } from "react-native-svg";

/**
 * Level timer — Figma component set "Timer" (202:2073).
 *   Default         — normal countdown (graphite glass pill).
 *   Мало времени    — red glow for the last seconds.
 *   Время добавлено — green glow at the moment bonus time is granted.
 * A 16pt ring on the left shows how much of the allotted time is left.
 * The pill is a physical "object", so it keeps its dark glass look in both
 * themes (same as the design).
 */
export type TimerState = "default" | "low" | "added";

const PALETTE: Record<
  TimerState,
  {
    grad: [string, string, string];
    shine: number;
    border: string;
    ring: string;
    track: string;
    arc: string;
    text: string;
    glow?: string;
  }
> = {
  default: {
    grad: ["rgb(114,114,113)", "rgb(63,63,64)", "rgb(42,42,43)"],
    shine: 0.42,
    border: "rgba(255,255,255,0.75)",
    ring: "#4C4C4C",
    track: "#5D5C5C",
    arc: "#F0EEE9",
    text: "#F0EEE9",
  },
  low: {
    grad: ["rgb(122,38,33)", "rgb(58,20,18)", "rgb(23,9,8)"],
    shine: 0.38,
    border: "rgba(255,77,61,0.9)",
    ring: "#4A1E1B",
    track: "#4A1E1B",
    arc: "#FF4D3D",
    text: "#FFE3E0",
    glow: "rgba(255,77,61,0.55)",
  },
  added: {
    grad: ["rgb(31,106,65)", "rgb(18,52,34)", "rgb(8,21,14)"],
    shine: 0.38,
    border: "rgba(61,220,132,0.9)",
    ring: "#173D28",
    track: "#173D28",
    arc: "#3DDC84",
    text: "#E2FBEC",
    glow: "rgba(61,220,132,0.55)",
  },
};

function formatTime(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

// Clockwise arc from 12 o'clock covering `fraction` of the circle.
function arcPath(fraction: number, cx: number, cy: number, r: number) {
  const f = Math.max(0, Math.min(0.9999, fraction));
  const a = f * Math.PI * 2;
  const x = cx + r * Math.sin(a);
  const y = cy - r * Math.cos(a);
  const large = f > 0.5 ? 1 : 0;
  return `M ${cx} ${cy - r} A ${r} ${r} 0 ${large} 1 ${x.toFixed(3)} ${y.toFixed(3)}`;
}

export default function Timer({
  seconds,
  total,
  state = "default",
}: {
  /** Seconds left. */
  seconds: number;
  /** Full allotment (for the progress ring). */
  total: number;
  state?: TimerState;
}) {
  const p = PALETTE[state];
  const [size, setSize] = useState({ w: 96, h: 38 });
  const fraction = total > 0 ? seconds / total : 0;

  return (
    <View style={[styles.wrap, p.glow ? ({ boxShadow: `0px 0px 11px 0px ${p.glow}` } as any) : null]}>
      {/* Track ring — a 3pt outline floating outside the pill. */}
      <View pointerEvents="none" style={[styles.trackRing, { borderColor: p.ring }]} />
      <View
        style={[styles.pill, { borderColor: p.border }]}
        onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      >
        <LinearGradient colors={p.grad} locations={[0, 0.55, 1]} style={StyleSheet.absoluteFill} />
        <Svg pointerEvents="none" width={size.w} height={size.h} style={styles.abs}>
          <Defs>
            <RadialGradient
              id={`tmShine-${state}`}
              cx={size.w}
              cy={size.h * 0.05}
              rx={size.w * 0.8}
              ry={size.h * 0.5}
              gradientUnits="userSpaceOnUse"
            >
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity={p.shine} />
              <Stop offset="0.55" stopColor="#FFFFFF" stopOpacity={p.shine * 0.19} />
              <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width={size.w} height={size.h} fill={`url(#tmShine-${state})`} />
        </Svg>

        {/* Wrapped in a View so it stacks above the absolute layers on web. */}
        <View style={styles.ringBox}>
          <Svg width={16} height={16} viewBox="0 0 16 16">
            <Circle cx={8} cy={8} r={6.88} stroke={p.track} strokeWidth={2.24} fill="none" />
            {fraction > 0.005 ? (
              <Path
                d={arcPath(fraction, 8, 8, 6.88)}
                stroke={p.arc}
                strokeWidth={2.4}
                strokeLinecap="round"
                fill="none"
              />
            ) : null}
          </Svg>
        </View>
        <Text style={[styles.time, { color: p.text }]}>{formatTime(seconds)}</Text>
        {/* Inner bottom shade (glass depth). */}
        <View pointerEvents="none" style={styles.innerShade} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: 32 },
  abs: { position: "absolute", top: 0, left: 0 },
  ringBox: { width: 16, height: 16 },
  trackRing: {
    position: "absolute",
    top: -7,
    left: -7,
    right: -7,
    bottom: -7,
    borderRadius: 38,
    borderWidth: 3,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 32,
    borderWidth: 1,
    overflow: "hidden",
    height: 38,
  },
  time: {
    fontFamily: "Geologica_900Black",
    fontSize: 16,
    fontVariant: ["tabular-nums"],
  },
  innerShade: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 32,
    boxShadow: "inset 0px -3px 6px 0px rgba(0,0,0,0.45)",
  } as any,
});
