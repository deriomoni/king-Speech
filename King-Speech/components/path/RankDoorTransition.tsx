// Rank-up cut-scene: a real panel door in a dark room. Light leaks under it,
// the latch clicks, the door swings open toward the camera, blinding light
// pours out, motes get sucked into the doorway and the camera is pulled in
// after them — white-out — and the new rank is revealed underneath.
//
// Performance: one shared clock on the UI thread drives everything that moves
// (camera, rays, motes, text, white-out) through animated styles; the static
// layers render once. Only the door's swing goes through React, and only
// while the door is actually moving.
import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, Platform, useWindowDimensions } from "react-native";
import { LinearGradient as ExpoLinearGradient } from "expo-linear-gradient";
import Svg, { Defs, G, Polygon, RadialGradient, Rect, Stop } from "react-native-svg";
import Animated, {
  Easing,
  cancelAnimation,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import * as Haptics from "@/lib/haptics";
import Door3D, { DOOR_FLOOR_Y, DOOR_VB_H, DOOR_VB_W, DOORWAY_GAP_CENTER, doorPaletteForRank } from "./Door3D";

// ── timeline (ms) ────────────────────────────────────────────────────────────
// Unhurried on purpose: the door gets a moment on screen before the pull.
const FADE_IN = 700;
const JIGGLE_AT = 1100; // latch: the door twitches
const OPEN_AT = 1450;
const OPEN_DUR = 2000;
const PULL_AT = 3750; // the open door is held ~300ms, then the camera is dragged in
const PULL_DUR = 1800;
const SWING_AT = 3600; // …while the draught swings the door wider
const SWING_DUR = 700;
const FLASH_AT = 4900;
const FLASH_DUR = 700;
const REVEAL_AT = FLASH_AT + FLASH_DUR; // new rank mounts under the white
const OUT_DUR = 850;
const END_AT = REVEAL_AT + OUT_DUR;
const DOOR_STILL_AT = SWING_AT + SWING_DUR; // no more door re-renders after this

function clamp01(x: number) {
  "worklet";
  return x < 0 ? 0 : x > 1 ? 1 : x;
}
function seg(t: number, at: number, dur: number) {
  "worklet";
  return clamp01((t - at) / dur);
}
function easeInOutCubic(x: number) {
  "worklet";
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}
function easeInQuart(x: number) {
  "worklet";
  return x * x * x * x;
}
function easeOutCubic(x: number) {
  "worklet";
  return 1 - Math.pow(1 - x, 3);
}
/** Door swing (0..1.35) and light behind it (0..1) at time t. */
function doorAt(t: number) {
  "worklet";
  const jiggle = t > JIGGLE_AT && t < OPEN_AT ? Math.sin(seg(t, JIGGLE_AT, 260) * Math.PI) * 0.035 : 0;
  const open = Math.max(jiggle, easeInOutCubic(seg(t, OPEN_AT, OPEN_DUR))) + 0.35 * easeOutCubic(seg(t, SWING_AT, SWING_DUR));
  // a pulsing leak while shut, then the light swells with the swing itself
  const leak = 0.3 + 0.1 * Math.sin(t / 180) * (1 - seg(t, JIGGLE_AT, OPEN_AT - JIGGLE_AT)) + 0.2 * seg(t, JIGGLE_AT, OPEN_AT - JIGGLE_AT);
  const light = leak + (1 - leak) * clamp01(open * 1.15);
  return { open, light };
}

const LIGHT = "#FFD45C";
const LIGHT_CORE = "#FFFDF4";

// Deterministic "random" motes.
const MOTES = Array.from({ length: 24 }, (_, i) => {
  const r = (n: number) => {
    const x = Math.sin((i + 1) * 12.9898 + n * 78.233) * 43758.5453;
    return x - Math.floor(x);
  };
  return {
    angle: r(1) * Math.PI * 2,
    dist: 0.55 + r(2) * 0.6, // × screen diagonal / 2
    at: PULL_AT - 350 + r(3) * 900,
    dur: 700 + r(4) * 500,
    w: 1.5 + r(5) * 2.5,
  };
});

const RAYS = Array.from({ length: 11 }, (_, i) => ({
  a: -Math.PI / 2 + (i - 5) * 0.27 + (i % 2 ? 0.05 : -0.04),
  spread: 0.05 + ((i * 7) % 5) * 0.012,
  len: 0.75 + ((i * 3) % 4) * 0.12,
}));

const MOTE_BASE = 100;

function Mote({ m, t, px, py, diag, color }: { m: (typeof MOTES)[number]; t: SharedValue<number>; px: number; py: number; diag: number; color: string }) {
  const cx = Math.cos(m.angle);
  const cy = Math.sin(m.angle);
  const style = useAnimatedStyle(() => {
    const q = seg(t.value, m.at, m.dur);
    if (q <= 0 || q >= 1) return { opacity: 0 };
    const e = easeInQuart(q);
    const r = diag * m.dist * (1 - e);
    const tail = 10 + 70 * e;
    const mid = r + tail / 2;
    return {
      opacity: Math.sin(Math.PI * q) * 0.9,
      transform: [
        { translateX: px + cx * mid - MOTE_BASE / 2 },
        { translateY: py + cy * mid - m.w / 2 },
        { rotate: `${m.angle}rad` },
        { scaleX: tail / MOTE_BASE },
        { scaleY: 1 - e * 0.6 },
      ],
    };
  });
  return (
    <Animated.View
      style={[
        { position: "absolute", left: 0, top: 0, width: MOTE_BASE, height: m.w, borderRadius: m.w / 2, backgroundColor: color },
        style,
      ]}
    />
  );
}

type Props = {
  /** Rank being completed — picks the door colour (same door as on the Path). */
  rank: number;
  /** Light theme: a clean white stage instead of the dark room. */
  light?: boolean;
  lead: string;
  title: string;
  /** Called at the white-out peak — mount the new-rank screen underneath. */
  onReveal: () => void;
  /** Called once the white has faded away. */
  onDone: () => void;
};

export default function RankDoorTransition({ rank, light: lightTheme = false, lead, title, onReveal, onDone }: Props) {
  const palette = doorPaletteForRank(rank);
  const { width: W, height: H } = useWindowDimensions();
  const t = useSharedValue(0);
  const [door, setDoor] = useState({ open: 0, light: 0.35 });

  useEffect(() => {
    t.value = withTiming(END_AT, { duration: END_AT, easing: Easing.linear });
    return () => cancelAnimation(t);
  }, []);

  // ── JS side: door re-renders (only while it moves) + one-shot cues ──
  const cbRef = useRef({ onReveal, onDone });
  cbRef.current = { onReveal, onDone };
  const cue = useCallback((name: string) => {
    const tap = (fn: () => Promise<void>) => {
      if (Platform.OS !== "web") fn().catch(() => {});
    };
    if (name === "latch") tap(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
    else if (name === "open") tap(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
    else if (name === "pull") tap(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));
    else if (name === "reveal") {
      tap(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
      cbRef.current.onReveal();
    } else if (name === "done") cbRef.current.onDone();
  }, []);

  useAnimatedReaction(
    () => {
      const tt = Math.min(t.value, DOOR_STILL_AT);
      const d = doorAt(tt);
      // quantised so React only hears about visible changes
      return Math.round(d.open * 400) * 1000 + Math.round(d.light * 100);
    },
    (key, prev) => {
      if (key !== prev) runOnJS(setDoor)({ open: Math.floor(key / 1000) / 400, light: (key % 1000) / 100 });
    },
  );
  useAnimatedReaction(
    () => t.value,
    (cur, prev) => {
      const p = prev ?? -1;
      const live = cur - p < 120; // a skip jumps the clock: no haptic barrage
      const cross = (at: number) => p < at && cur >= at;
      if (live && cross(JIGGLE_AT)) runOnJS(cue)("latch");
      if (live && cross(OPEN_AT)) runOnJS(cue)("open");
      if (live && cross(PULL_AT + 400)) runOnJS(cue)("pull");
      if (cross(REVEAL_AT)) runOnJS(cue)("reveal");
      if (cross(END_AT)) runOnJS(cue)("done");
    },
  );

  // ── layout ──
  const doorW = Math.min(W * 0.78, 330);
  const doorH = (doorW * DOOR_VB_H) / DOOR_VB_W;
  const doorLeft = (W - doorW) / 2;
  const doorTop = H * 0.56 - doorH * 0.5;
  const px = doorLeft + DOORWAY_GAP_CENTER.x * doorW;
  const py = doorTop + DOORWAY_GAP_CENTER.y * doorH;
  const floorY = doorTop + DOOR_FLOOR_Y * doorH;
  const diag = Math.hypot(W, H) / 2;

  // ── UI-thread styles ──
  const rootStyle = useAnimatedStyle(() => ({ opacity: 1 - seg(t.value, REVEAL_AT, OUT_DUR) }));
  const cameraStyle = useAnimatedStyle(() => {
    const tt = t.value;
    const pull = easeInQuart(seg(tt, PULL_AT, PULL_DUR));
    // a short breath back before the rush in
    const brace = Math.sin(seg(tt, PULL_AT - 500, 500) * Math.PI * 0.5) * (1 - seg(tt, PULL_AT, 400));
    const s = (1 - 0.05 * brace) * (1 + pull * 11);
    const shake = tt > PULL_AT && tt < FLASH_AT ? Math.sin(tt / 23) * 2.2 * pull : 0;
    return {
      opacity: easeOutCubic(seg(tt, 0, FADE_IN)),
      transform: [
        { translateX: (1 - s) * (px - W / 2) + shake },
        { translateY: (1 - s) * (py - H / 2) + shake * 0.6 },
        { scale: s },
      ],
    };
  });
  const washStyle = useAnimatedStyle(() => {
    const d = doorAt(Math.min(t.value, DOOR_STILL_AT));
    const rayOp = clamp01((d.light - 0.7) / 0.3) * Math.min(1, d.open);
    return { opacity: 0.25 * d.light + 0.5 * rayOp };
  });
  const raysStyle = useAnimatedStyle(() => {
    const d = doorAt(Math.min(t.value, DOOR_STILL_AT));
    return { opacity: clamp01((d.light - 0.7) / 0.3) * Math.min(1, d.open) };
  });
  const vignetteStyle = useAnimatedStyle(() => ({ opacity: 1 - easeInQuart(seg(t.value, PULL_AT, PULL_DUR)) }));
  const headingStyle = useAnimatedStyle(() => {
    const sceneIn = easeOutCubic(seg(t.value, 0, FADE_IN));
    return {
      opacity: sceneIn * (1 - seg(t.value, PULL_AT - 300, 450)),
      transform: [{ translateY: (1 - sceneIn) * 14 }],
    };
  });
  const flashStyle = useAnimatedStyle(() => ({
    opacity: Math.max(easeOutCubic(seg(t.value, FLASH_AT, FLASH_DUR)), easeInQuart(seg(t.value, PULL_AT, PULL_DUR)) * 0.35),
  }));

  const skip = () => {
    const to = FLASH_AT - 200;
    if (t.value < to) {
      t.value = to;
      t.value = withTiming(END_AT, { duration: END_AT - to, easing: Easing.linear });
    }
  };

  return (
    <Pressable style={[StyleSheet.absoluteFill, { zIndex: 50 }]} onPress={skip} accessibilityRole="button" accessibilityLabel={title}>
      <Animated.View style={[StyleSheet.absoluteFill, rootStyle]} pointerEvents="none">
        <View style={[StyleSheet.absoluteFill, { backgroundColor: lightTheme ? "#FFFFFF" : "#0B0A0D" }]} />

        {/* the room — scales as one piece when the camera gets pulled in */}
        <Animated.View style={[StyleSheet.absoluteFill, cameraStyle]}>
          {lightTheme ? (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: "#FFFFFF" }]} />
          ) : (
            <>
              <ExpoLinearGradient
                colors={["#0B0A0D", "#17131C", "#1E1822"]}
                locations={[0, 0.6, 1]}
                style={[StyleSheet.absoluteFill, { bottom: H - floorY }]}
              />
              <ExpoLinearGradient colors={["#2A2129", "#0E0C10"]} style={{ position: "absolute", left: 0, right: 0, top: floorY, bottom: 0 }} />
            </>
          )}

          {/* warm wash + god rays (static drawings, animated opacity) */}
          <Animated.View style={[StyleSheet.absoluteFill, washStyle]}>
            <Svg width={W} height={H}>
              <Defs>
                <RadialGradient id="rdtWash" cx={px} cy={py} r={diag * 0.9} gradientUnits="userSpaceOnUse">
                  <Stop offset="0" stopColor={LIGHT} stopOpacity={0.5} />
                  <Stop offset="1" stopColor={LIGHT} stopOpacity={0} />
                </RadialGradient>
              </Defs>
              <Rect x={0} y={0} width={W} height={H} fill="url(#rdtWash)" />
            </Svg>
          </Animated.View>
          <Animated.View style={[StyleSheet.absoluteFill, raysStyle]}>
            <Svg width={W} height={H}>
              <Defs>
                <RadialGradient id="rdtRay" cx={px} cy={py} r={diag * 1.1} gradientUnits="userSpaceOnUse">
                  <Stop offset="0" stopColor={LIGHT_CORE} stopOpacity={0.55} />
                  <Stop offset="0.35" stopColor={LIGHT} stopOpacity={0.22} />
                  <Stop offset="1" stopColor={LIGHT} stopOpacity={0} />
                </RadialGradient>
              </Defs>
              <G>
                {RAYS.map((r, i) => {
                  const len = diag * 1.3 * r.len;
                  const p1 = [px + Math.cos(r.a - r.spread) * len, py + Math.sin(r.a - r.spread) * len];
                  const p2 = [px + Math.cos(r.a + r.spread) * len, py + Math.sin(r.a + r.spread) * len];
                  return <Polygon key={i} points={`${px},${py} ${p1[0]},${p1[1]} ${p2[0]},${p2[1]}`} fill="url(#rdtRay)" />;
                })}
              </G>
            </Svg>
          </Animated.View>

          <View style={{ position: "absolute", left: doorLeft, top: doorTop }}>
            <Door3D
              width={doorW}
              open={door.open}
              light={door.light}
              palette={palette}
              shadowColor={lightTheme ? "#6E6680" : "#000000"}
            />
          </View>
        </Animated.View>

        {/* motes sucked into the doorway */}
        {MOTES.map((m, i) => (
          <Mote key={i} m={m} t={t} px={px} py={py} diag={diag} color={lightTheme ? "#F2B705" : LIGHT_CORE} />
        ))}

        {/* vignette (dark room only) */}
        <Animated.View style={[StyleSheet.absoluteFill, vignetteStyle, lightTheme && { display: "none" }]}>
          <ExpoLinearGradient
            colors={["rgba(0,0,0,0.55)", "rgba(0,0,0,0)", "rgba(0,0,0,0)", "rgba(0,0,0,0.6)"]}
            locations={[0, 0.25, 0.75, 1]}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        {/* heading */}
        <Animated.View style={[styles.heading, { top: H * 0.1 }, headingStyle]}>
          <Text style={[styles.lead, lightTheme && { color: "#6B6874" }]}>{lead}</Text>
          <Text style={[styles.title, lightTheme && { color: "#232129" }]} numberOfLines={2} adjustsFontSizeToFit>
            {title}
          </Text>
        </Animated.View>

        {/* white-out */}
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: LIGHT_CORE }, flashStyle]} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  heading: {
    position: "absolute",
    left: 28,
    right: 28,
    alignItems: "center",
    gap: 8,
  },
  lead: {
    color: "rgba(255,240,214,0.7)",
    fontFamily: "Geologica_500Medium",
    fontSize: 15,
    letterSpacing: 0.4,
    textAlign: "center",
  },
  title: {
    color: "#FFD45C",
    fontFamily: "Geologica_700Bold",
    fontSize: 46,
    lineHeight: 52,
    textAlign: "center",
  },
});
