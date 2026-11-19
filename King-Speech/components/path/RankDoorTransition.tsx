// Rank-up cut-scene: a real panel door in a dark room. Light leaks under it,
// the latch clicks, the door swings open toward the camera, blinding light
// pours out, motes get sucked into the doorway and the camera is pulled in
// after them — white-out — and the new rank is revealed underneath.
import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, Platform, useWindowDimensions } from "react-native";
import { LinearGradient as ExpoLinearGradient } from "expo-linear-gradient";
import Svg, { Defs, G, Line, Polygon, RadialGradient, Rect, Stop } from "react-native-svg";
import * as Haptics from "@/lib/haptics";
import Door3D, { DOOR_FLOOR_Y, DOOR_VB_H, DOOR_VB_W, DOORWAY_GAP_CENTER } from "./Door3D";

// ── timeline (ms) ────────────────────────────────────────────────────────────
const FADE_IN = 600;
const JIGGLE_AT = 900; // latch: the door twitches
const OPEN_AT = 1250;
const OPEN_DUR = 1450;
const PULL_AT = 2350; // camera starts getting dragged in
const PULL_DUR = 1600;
const FLASH_AT = 3250;
const FLASH_DUR = 650;
const REVEAL_AT = FLASH_AT + FLASH_DUR; // new rank mounts under the white
const OUT_DUR = 800;
const END_AT = REVEAL_AT + OUT_DUR;

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const seg = (t: number, at: number, dur: number) => clamp01((t - at) / dur);
const easeInOutCubic = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const easeInQuart = (x: number) => x * x * x * x;
const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3);

const LIGHT = "#FFD45C";
const LIGHT_CORE = "#FFFDF4";

// Deterministic "random" motes.
const MOTES = Array.from({ length: 26 }, (_, i) => {
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

function useSceneClock(totalMs: number) {
  const [t, setT] = useState(0);
  const skipRef = useRef(0);
  useEffect(() => {
    let raf = 0;
    const start = Date.now();
    const loop = () => {
      const e = Math.max(Date.now() - start, skipRef.current);
      setT(Math.min(e, totalMs));
      if (e < totalMs) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [totalMs]);
  return { t, skipTo: (ms: number) => (skipRef.current = ms) } as const;
}

type Props = {
  lead: string;
  title: string;
  /** Called at the white-out peak — mount the new-rank screen underneath. */
  onReveal: () => void;
  /** Called once the white has faded away. */
  onDone: () => void;
};

export default function RankDoorTransition({ lead, title, onReveal, onDone }: Props) {
  const { width: W, height: H } = useWindowDimensions();
  const { t, skipTo } = useSceneClock(END_AT + 30);

  // one-shot callbacks / haptics keyed off the clock
  const fired = useRef<Record<string, boolean>>({});
  const once = (k: string, at: number, fn: () => void) => {
    if (t >= at && !fired.current[k]) {
      fired.current[k] = true;
      fn();
    }
  };
  const haptic = (fn: () => Promise<void>) => {
    if (Platform.OS !== "web") fn().catch(() => {});
  };
  useEffect(() => {
    once("latch", JIGGLE_AT, () => haptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)));
    once("open", OPEN_AT, () => haptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)));
    once("pull", PULL_AT + 400, () => haptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)));
    once("reveal", REVEAL_AT, () => {
      haptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
      onReveal();
    });
    once("done", END_AT, onDone);
  });

  // ── door state ──
  const jiggle = t > JIGGLE_AT && t < OPEN_AT ? Math.sin(seg(t, JIGGLE_AT, 260) * Math.PI) * 0.035 : 0;
  // …and it keeps swinging wide as the draught pulls the camera through.
  const open = Math.max(jiggle, easeInOutCubic(seg(t, OPEN_AT, OPEN_DUR))) + 0.35 * easeOutCubic(seg(t, PULL_AT, PULL_DUR * 0.7));
  const leak = 0.35 + 0.15 * Math.sin(t / 180); // pulsing light under the shut door
  const light = t < OPEN_AT ? leak + 0.25 * seg(t, JIGGLE_AT, OPEN_AT - JIGGLE_AT) : 0.75 + 0.25 * seg(t, OPEN_AT, OPEN_DUR * 0.6);

  // ── layout ──
  const doorW = Math.min(W * 0.78, 330);
  const doorH = (doorW * DOOR_VB_H) / DOOR_VB_W;
  const doorLeft = (W - doorW) / 2;
  const doorTop = H * 0.56 - doorH * 0.5;
  const px = doorLeft + DOORWAY_GAP_CENTER.x * doorW;
  const py = doorTop + DOORWAY_GAP_CENTER.y * doorH;
  const floorY = doorTop + DOOR_FLOOR_Y * doorH;

  // ── camera pull ──
  const pull = easeInQuart(seg(t, PULL_AT, PULL_DUR));
  // a short breath back before the rush in
  const brace = Math.sin(seg(t, PULL_AT - 500, 500) * Math.PI * 0.5) * (1 - seg(t, PULL_AT, 400));
  const s = (1 - 0.05 * brace) * (1 + pull * 11);
  const shake = t > PULL_AT && t < FLASH_AT ? Math.sin(t / 23) * 2.2 * pull : 0;
  const tx = (1 - s) * (px - W / 2) + shake;
  const ty = (1 - s) * (py - H / 2) + shake * 0.6;

  const flash = easeOutCubic(seg(t, FLASH_AT, FLASH_DUR));
  const out = seg(t, REVEAL_AT, OUT_DUR);
  const sceneIn = easeOutCubic(seg(t, 0, FADE_IN));
  const textOp = sceneIn * (1 - seg(t, PULL_AT - 300, 450));
  const textRise = (1 - sceneIn) * 14;

  const rayOp = clamp01((light - 0.7) / 0.3) * open;
  const diag = Math.hypot(W, H) / 2;

  return (
    <Pressable
      style={[StyleSheet.absoluteFill, { zIndex: 50 }]}
      onPress={() => {
        if (t < FLASH_AT - 200) skipTo(FLASH_AT - 200);
      }}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <View style={[StyleSheet.absoluteFill, { opacity: 1 - out }]} pointerEvents="none">
        <View style={[StyleSheet.absoluteFill, { backgroundColor: "#0B0A0D" }]} />

        {/* the room — scales as one piece when the camera gets pulled in */}
        <View
          style={[
            StyleSheet.absoluteFill,
            { opacity: sceneIn, transform: [{ translateX: tx }, { translateY: ty }, { scale: s }] },
          ]}
        >
          <ExpoLinearGradient
            colors={["#0B0A0D", "#17131C", "#1E1822"]}
            locations={[0, 0.6, 1]}
            style={[StyleSheet.absoluteFill, { bottom: H - floorY }]}
          />
          <ExpoLinearGradient
            colors={["#2A2129", "#0E0C10"]}
            style={{ position: "absolute", left: 0, right: 0, top: floorY, bottom: 0 }}
          />

          {/* god rays fanning out of the doorway */}
          <Svg style={StyleSheet.absoluteFill} width={W} height={H}>
            <Defs>
              <RadialGradient id="rdtRay" cx={px} cy={py} r={diag * 1.1} gradientUnits="userSpaceOnUse">
                <Stop offset="0" stopColor={LIGHT_CORE} stopOpacity={0.55} />
                <Stop offset="0.35" stopColor={LIGHT} stopOpacity={0.22} />
                <Stop offset="1" stopColor={LIGHT} stopOpacity={0} />
              </RadialGradient>
              <RadialGradient id="rdtWash" cx={px} cy={py} r={diag * 0.9} gradientUnits="userSpaceOnUse">
                <Stop offset="0" stopColor={LIGHT} stopOpacity={0.5} />
                <Stop offset="1" stopColor={LIGHT} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Rect x={0} y={0} width={W} height={H} fill="url(#rdtWash)" opacity={0.25 * light + 0.5 * rayOp} />
            {rayOp > 0.01 && (
              <G opacity={rayOp}>
                {RAYS.map((r, i) => {
                  const a = r.a + Math.sin(t / 900 + i) * 0.03;
                  const L = diag * 1.3 * r.len;
                  const p1 = [px + Math.cos(a - r.spread) * L, py + Math.sin(a - r.spread) * L];
                  const p2 = [px + Math.cos(a + r.spread) * L, py + Math.sin(a + r.spread) * L];
                  return (
                    <Polygon
                      key={i}
                      points={`${px},${py} ${p1[0]},${p1[1]} ${p2[0]},${p2[1]}`}
                      fill="url(#rdtRay)"
                    />
                  );
                })}
              </G>
            )}
          </Svg>

          <View style={{ position: "absolute", left: doorLeft, top: doorTop }}>
            <Door3D width={doorW} open={open} light={light} />
          </View>
        </View>

        {/* motes sucked into the doorway (screen space) */}
        <Svg style={StyleSheet.absoluteFill} width={W} height={H}>
          {MOTES.map((m, i) => {
            const q = seg(t, m.at, m.dur);
            if (q <= 0 || q >= 1) return null;
            const e = easeInQuart(q);
            const r = diag * m.dist * (1 - e);
            const tail = 10 + 70 * e;
            const cx = Math.cos(m.angle);
            const cy = Math.sin(m.angle);
            return (
              <Line
                key={i}
                x1={px + cx * r}
                y1={py + cy * r}
                x2={px + cx * (r + tail)}
                y2={py + cy * (r + tail)}
                stroke={LIGHT_CORE}
                strokeWidth={m.w * (1 - e * 0.6)}
                strokeLinecap="round"
                opacity={Math.sin(Math.PI * q) * 0.9}
              />
            );
          })}
        </Svg>

        {/* vignette */}
        <ExpoLinearGradient
          colors={["rgba(0,0,0,0.55)", "rgba(0,0,0,0)", "rgba(0,0,0,0)", "rgba(0,0,0,0.6)"]}
          locations={[0, 0.25, 0.75, 1]}
          style={[StyleSheet.absoluteFill, { opacity: 1 - pull }]}
        />

        {/* heading */}
        <View style={[styles.heading, { top: H * 0.1, opacity: textOp, transform: [{ translateY: textRise }] }]}>
          <Text style={styles.lead}>{lead}</Text>
          <Text style={styles.title} numberOfLines={2} adjustsFontSizeToFit>
            {title}
          </Text>
        </View>

        {/* white-out */}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: LIGHT_CORE, opacity: Math.max(flash, pull * 0.35) }]} />
      </View>
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
