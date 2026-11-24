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
import Animated, {
  Easing,
  cancelAnimation,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "@/lib/haptics";
import Door3D, { DOOR_FLOOR_Y, DOOR_VB_H, DOOR_VB_W, DOORWAY_GAP_CENTER, doorPaletteForRank } from "./Door3D";
import { rs } from "@/lib/responsive";

// ── timeline (ms) ────────────────────────────────────────────────────────────
// Unhurried on purpose: the door gets a moment on screen before the pull.
const FADE_IN = 900;
const JIGGLE_AT = 1500; // latch: the door twitches
const OPEN_AT = 1950;
const OPEN_DUR = 2800;
const PULL_AT = 5150; // the open door is held ~400ms, then the camera is drawn in
const PULL_DUR = 2500;
const SWING_AT = 4950; // …while the draught swings the door wider
const SWING_DUR = 900;
const FLASH_AT = 6750;
const FLASH_DUR = 900;
const REVEAL_AT = FLASH_AT + FLASH_DUR; // new rank mounts under the white
const OUT_DUR = 1000;
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
function easeInCubic(x: number) {
  "worklet";
  return x * x * x;
}
function easeOutCubic(x: number) {
  "worklet";
  return 1 - Math.pow(1 - x, 3);
}
/** Door swing (0..1.35) and light behind it (0..1) at time t. */
function doorAt(t: number) {
  "worklet";
  const jiggle = t > JIGGLE_AT && t < OPEN_AT ? Math.sin(seg(t, JIGGLE_AT, 340) * Math.PI) * 0.035 : 0;
  const open = Math.max(jiggle, easeInOutCubic(seg(t, OPEN_AT, OPEN_DUR))) + 0.35 * easeOutCubic(seg(t, SWING_AT, SWING_DUR));
  // a pulsing leak while shut, then the light swells with the swing itself
  const leak = 0.3 + 0.1 * Math.sin(t / 180) * (1 - seg(t, JIGGLE_AT, OPEN_AT - JIGGLE_AT)) + 0.2 * seg(t, JIGGLE_AT, OPEN_AT - JIGGLE_AT);
  const light = leak + (1 - leak) * clamp01(open * 1.15);
  return { open, light };
}

const LIGHT_CORE = "#FFFDF4";

// The dark room: a deep indigo — the complement of the yellow door — rather
// than flat black, so the colours stay clean instead of muddy.
const ROOM = {
  wall: ["#0C0A1C", "#0A0818", "#080614"] as const,
  floorTop: "#070612",
  floorBottom: "#04030B",
};

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
  /** Called on the cut-scene's first frame — start the music here. */
  onStart?: () => void;
};

export default function RankDoorTransition({ rank, light: lightTheme = false, lead, title, onReveal, onDone, onStart }: Props) {
  const palette = doorPaletteForRank(rank);
  const { width: W, height: H } = useWindowDimensions();
  const t = useSharedValue(0);
  const [door, setDoor] = useState({ open: 0, light: 0.35 });

  useEffect(() => {
    // dev on web: ?doorT=<ms> freezes the cut-scene on one frame for design checks
    const freeze = __DEV__ && Platform.OS === "web" ? Number(new URLSearchParams(globalThis.location?.search).get("doorT")) : NaN;
    if (freeze >= 0) {
      t.value = Math.min(freeze, REVEAL_AT - 1);
      return;
    }
    // wait until mounting work is done and a frame has been painted, so the
    // cut-scene (and the music that starts with it) never begins half-loaded
    // (a short beat, then two painted frames)
    let raf = 0;
    const timer = setTimeout(() => {
      raf = requestAnimationFrame(() => {
        raf = requestAnimationFrame(() => {
          t.value = withTiming(END_AT, { duration: END_AT, easing: Easing.linear });
          cbRef.current.onStart?.();
        });
      });
    }, 250);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(raf);
      cancelAnimation(t);
    };
  }, []);

  // ── JS side: door re-renders (only while it moves) + one-shot cues ──
  const cbRef = useRef({ onReveal, onDone, onStart });
  cbRef.current = { onReveal, onDone, onStart };
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
      return Math.round(d.open * 220) * 1000 + Math.round(d.light * 60);
    },
    (key, prev) => {
      if (key !== prev) runOnJS(setDoor)({ open: Math.floor(key / 1000) / 220, light: (key % 1000) / 60 });
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
  const doorW = Math.min(W * 0.78, rs(330));
  const shakeAmp = rs(2.2);
  const headingRise = rs(14);
  const doorH = (doorW * DOOR_VB_H) / DOOR_VB_W;
  const doorLeft = (W - doorW) / 2;
  const doorTop = H * 0.56 - doorH * 0.5;
  const px = doorLeft + DOORWAY_GAP_CENTER.x * doorW;
  const py = doorTop + DOORWAY_GAP_CENTER.y * doorH;
  const floorY = doorTop + DOOR_FLOOR_Y * doorH;

  // ── UI-thread styles ──
  const rootStyle = useAnimatedStyle(() => ({ opacity: 1 - seg(t.value, REVEAL_AT, OUT_DUR) }));
  const cameraStyle = useAnimatedStyle(() => {
    const tt = t.value;
    const pull = easeInCubic(seg(tt, PULL_AT, PULL_DUR));
    // a short breath back before the rush in
    const brace = Math.sin(seg(tt, PULL_AT - 500, 500) * Math.PI * 0.5) * (1 - seg(tt, PULL_AT, 400));
    const s = (1 - 0.04 * brace) * (1 + pull * 9);
    const shake = tt > PULL_AT && tt < FLASH_AT ? Math.sin(tt / 23) * shakeAmp * pull : 0;
    return {
      opacity: easeOutCubic(seg(tt, 0, FADE_IN)),
      transform: [
        { translateX: (1 - s) * (px - W / 2) + shake },
        { translateY: (1 - s) * (py - H / 2) + shake * 0.6 },
        { scale: s },
      ],
    };
  });
  const vignetteStyle = useAnimatedStyle(() => ({ opacity: 1 - easeInQuart(seg(t.value, PULL_AT, PULL_DUR)) }));
  const headingStyle = useAnimatedStyle(() => {
    const sceneIn = easeOutCubic(seg(t.value, 0, FADE_IN));
    return {
      opacity: sceneIn * (1 - seg(t.value, PULL_AT - 300, 450)),
      transform: [{ translateY: (1 - sceneIn) * headingRise }],
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
    <Pressable style={[StyleSheet.absoluteFill, { zIndex: 50, overflow: "hidden" }]} onPress={skip} accessibilityRole="button" accessibilityLabel={title}>
      <Animated.View style={[StyleSheet.absoluteFill, rootStyle]} pointerEvents="none">
        <View style={[StyleSheet.absoluteFill, { backgroundColor: lightTheme ? "#FFFFFF" : ROOM.floorBottom }]} />

        {/* the room — scales as one piece when the camera gets pulled in */}
        <Animated.View style={[StyleSheet.absoluteFill, cameraStyle]}>
          {lightTheme ? (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: "#FFFFFF" }]} />
          ) : (
            <>
              <ExpoLinearGradient colors={ROOM.wall} locations={[0, 0.65, 1]} style={[StyleSheet.absoluteFill, { bottom: H - floorY }]} />
              <ExpoLinearGradient colors={[ROOM.floorTop, ROOM.floorBottom]} style={{ position: "absolute", left: 0, right: 0, top: floorY, bottom: 0 }} />
            </>
          )}
        </Animated.View>

        {/* the door — same camera as the room */}
        <Animated.View style={[StyleSheet.absoluteFill, cameraStyle]}>
          <View style={{ position: "absolute", left: doorLeft, top: doorTop }}>
            <Door3D width={doorW} open={door.open} light={door.light} palette={palette} fast floorLight={false} />
          </View>
        </Animated.View>

        {/* vignette (dark room only) */}
        <Animated.View style={[StyleSheet.absoluteFill, vignetteStyle, lightTheme && { display: "none" }]}>
          <ExpoLinearGradient
            colors={
              lightTheme
                ? ["rgba(120,96,60,0.10)", "rgba(120,96,60,0)", "rgba(120,96,60,0)", "rgba(120,96,60,0.14)"]
                : ["rgba(3,2,9,0.6)", "rgba(3,2,9,0)", "rgba(3,2,9,0)", "rgba(3,2,9,0.6)"]
            }
            locations={[0, 0.25, 0.75, 1]}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        {/* heading */}
        <Animated.View style={[styles.heading, { top: H * 0.1 }, headingStyle]}>
          <Text style={[styles.lead, lightTheme && { color: "#6B6874" }]}>{lead}</Text>
          <Text style={[styles.title, lightTheme && { color: "#232129", textShadowColor: "rgba(246,201,68,0.45)", textShadowRadius: 18 }]} numberOfLines={2} adjustsFontSizeToFit>
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
    textShadowColor: "rgba(255,190,60,0.55)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 22,
    fontFamily: "Geologica_700Bold",
    fontSize: 46,
    lineHeight: 52,
    textAlign: "center",
  },
});
