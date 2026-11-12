// "Актуальные темы для вас" — Figma "Themes cover flow" (371:1127 dark / 371:1138 light).
// Perspective cover-flow: the selected theme is an upright 140 pt square
// (radius 16) with its title; three cards per side recede into depth as
// trapezoids (both top and bottom edges converge toward the horizon at card
// mid-height), radius 12, darker on the far (inner) edge, the outermost cut
// by the screen edges. No box behind.
//
// Geometry: the rest positions are the exact Figma projection of a 140 pt card
// rotated 65° in depth (D = 3) — outer/inner edge x and edge heights taken from
// the vector paths of 371:1128…371:1133. While swiping, every card's edges are
// interpolated between those rest keyframes, so the resting state is 1:1 with
// Figma and the motion stays continuous. Same pan/snap logic as before.
import React, { useEffect, useMemo } from "react";
import { View, Text, StyleSheet, useWindowDimensions } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withSpring,
  cancelAnimation,
  runOnJS,
  interpolate,
  Extrapolation,
  type SharedValue,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Defs, LinearGradient as SvgLinearGradient, Stop, Path } from "react-native-svg";
import type { SpeechTheme } from "@/app/showtime-stage";

const AnimatedPath = Animated.createAnimatedComponent(Path);

const STAGE_H = 180;
const CARD = 140;
const CY = 84; // card mid-height inside the 180 pt frame (Figma y 14 + 70)

// Keyframes per |offset| 0…4 (left side; mirrored for the right). Values are
// relative to the stage centre: outer edge x, inner edge x, outer / inner
// edge heights, corner radius. Index 4 is an off-screen extrapolation.
const K = [0, 1, 2, 3, 4];
const OUTER_X = [-70, -127.1, -168.7, -209.8, -251];
const INNER_X = [70, -53.7, -86.1, -118.2, -150.3];
const OUTER_H = [140, 136.4, 135.8, 135.2, 134.6];
const INNER_H = [140, 105.4, 105.0, 104.6, 104.2];
const RADII = [16, 12, 12, 12, 12];
// Tap zones (distance from centre) → slot index.
const ZONES = [70, 127.1, 168.7, 209.8];

type Props = {
  themes: SpeechTheme[];
  selectedIdx: number;
  onSelect: (idx: number) => void;
};

function clamp(v: number, lo: number, hi: number) {
  "worklet";
  return Math.max(lo, Math.min(hi, v));
}

// "#RRGGBB" darkened toward black (Figma side gradients end at ~45 % of the top colour).
function darken(hex: string, k: number) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const v = parseInt(m[1], 16);
  const ch = (s: number) => Math.round(((v >> s) & 255) * k).toString(16).padStart(2, "0");
  return `#${ch(16)}${ch(8)}${ch(0)}`;
}

// Rounded quad: corners in order TL, TR, BR, BL; each corner is rounded with a
// quadratic curve whose arms run `r` along the two adjacent edges.
function roundedQuad(p: number[], r: number) {
  "worklet";
  const n = 4;
  let d = "";
  for (let i = 0; i < n; i++) {
    const px = p[i * 2];
    const py = p[i * 2 + 1];
    const ax = p[((i + n - 1) % n) * 2];
    const ay = p[((i + n - 1) % n) * 2 + 1];
    const bx = p[((i + 1) % n) * 2];
    const by = p[((i + 1) % n) * 2 + 1];
    const la = Math.max(0.001, Math.hypot(ax - px, ay - py));
    const lb = Math.max(0.001, Math.hypot(bx - px, by - py));
    const ra = Math.min(r, la / 2);
    const rb = Math.min(r, lb / 2);
    const x1 = px + ((ax - px) / la) * ra;
    const y1 = py + ((ay - py) / la) * ra;
    const x2 = px + ((bx - px) / lb) * rb;
    const y2 = py + ((by - py) / lb) * rb;
    d += `${i === 0 ? "M" : "L"}${x1.toFixed(2)} ${y1.toFixed(2)}Q${px.toFixed(2)} ${py.toFixed(2)} ${x2.toFixed(2)} ${y2.toFixed(2)}`;
  }
  return d + "Z";
}

// Card outline at a (fractional) carousel position: edges interpolated between
// the Figma rest keyframes; left side as drawn in Figma, right side mirrored.
function cardPath(idx: number, t: number, cx: number) {
  "worklet";
  const off = idx - t;
  const a = Math.min(Math.abs(off), 4);
  const outer = interpolate(a, K, OUTER_X, Extrapolation.CLAMP);
  const inner = interpolate(a, K, INNER_X, Extrapolation.CLAMP);
  const ho = interpolate(a, K, OUTER_H, Extrapolation.CLAMP) / 2;
  const hi = interpolate(a, K, INNER_H, Extrapolation.CLAMP) / 2;
  const r = interpolate(a, K, RADII, Extrapolation.CLAMP);
  const s = off > 0 ? -1 : 1;
  const xo = cx + s * outer;
  const xi = cx + s * inner;
  const lx = s === 1 ? xo : xi;
  const rx = s === 1 ? xi : xo;
  const lh = s === 1 ? ho : hi;
  const rh = s === 1 ? hi : ho;
  return roundedQuad([lx, CY - lh, rx, CY - rh, rx, CY + rh, lx, CY + lh], r);
}

export function ThemeCoverGallery({ themes, selectedIdx, onSelect }: Props) {
  const { width: winW } = useWindowDimensions();
  const stageW = Math.min(winW, 480);
  const cx = stageW / 2;
  // One swipe step ≈ distance between neighbouring outer edges.
  const stride = 60;

  const target = useSharedValue(selectedIdx);
  const startTarget = useSharedValue(selectedIdx);
  const lastIdx = useSharedValue(selectedIdx);

  useEffect(() => {
    cancelAnimation(target);
    lastIdx.value = selectedIdx;
    target.value = withSpring(selectedIdx, { damping: 20, stiffness: 140, mass: 0.7 });
  }, [selectedIdx, target, lastIdx]);

  const maxIdx = themes.length - 1;

  const onSelectRef = React.useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);
  const dispatchSelect = React.useCallback((idx: number) => {
    onSelectRef.current(idx);
  }, []);

  const gesture = useMemo(() => {
    const pan = Gesture.Pan()
      .activeOffsetX([-8, 8])
      .onStart(() => {
        startTarget.value = target.value;
        cancelAnimation(target);
      })
      .onUpdate((e) => {
        target.value = clamp(startTarget.value - e.translationX / stride, 0, maxIdx);
      })
      .onEnd((e) => {
        const projected = target.value + (-e.velocityX / stride) * 0.18;
        const snap = clamp(Math.round(projected), 0, maxIdx);
        target.value = withSpring(snap, { damping: 20, stiffness: 140, mass: 0.7 });
        if (snap !== lastIdx.value) {
          lastIdx.value = snap;
          runOnJS(dispatchSelect)(snap);
        }
      });
    // Tap on a side card selects it (which card is decided by the Figma edge zones).
    const tap = Gesture.Tap().onEnd((e) => {
      const dx = e.x - cx;
      const ad = Math.abs(dx);
      if (ad <= ZONES[0]) return;
      let k = 3;
      if (ad <= ZONES[1]) k = 1;
      else if (ad <= ZONES[2]) k = 2;
      const next = clamp(lastIdx.value + (dx < 0 ? -k : k), 0, maxIdx);
      if (next !== lastIdx.value) {
        lastIdx.value = next;
        runOnJS(dispatchSelect)(next);
      }
    });
    return Gesture.Race(pan, tap);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stride, maxIdx, cx]);

  const windowIndices = useMemo(() => {
    const out: number[] = [];
    for (let off = -4; off <= 4; off++) {
      const i = selectedIdx + off;
      if (i >= 0 && i < themes.length) out.push(i);
    }
    return out;
  }, [selectedIdx, themes.length]);

  const sel = themes[selectedIdx];

  return (
    <GestureDetector gesture={gesture}>
      <View
        collapsable={false}
        accessibilityRole="adjustable"
        accessibilityLabel={sel?.title}
        style={[styles.stage, { width: stageW, height: STAGE_H }]}
      >
        {windowIndices.map((idx) => (
          <Card key={idx} idx={idx} target={target} theme={themes[idx]} stageW={stageW} cx={cx} />
        ))}
      </View>
    </GestureDetector>
  );
}

type CardProps = {
  idx: number;
  target: SharedValue<number>;
  theme: SpeechTheme;
  stageW: number;
  cx: number;
};

function Card({ idx, target, theme, stageW, cx }: CardProps) {
  const top = theme.accentColor;
  const bottom = darken(theme.accentColor, 0.42);
  const gid = `cf${idx}`;

  const shapeProps = useAnimatedProps(() => ({ d: cardPath(idx, target.value, cx) }));

  // Far (inner) edge darkening: left cards are dark on the right, right cards on the left.
  const shadeLeftProps = useAnimatedProps(() => {
    const off = idx - target.value;
    return { d: cardPath(idx, target.value, cx), opacity: off < 0 ? clamp(-off, 0, 1) : 0 };
  });
  const shadeRightProps = useAnimatedProps(() => {
    const off = idx - target.value;
    return { d: cardPath(idx, target.value, cx), opacity: off > 0 ? clamp(off, 0, 1) : 0 };
  });

  const layer = useAnimatedStyle(() => {
    const a = Math.abs(idx - target.value);
    return {
      zIndex: 100 - Math.round(a * 10),
      opacity: interpolate(a, [0, 3, 3.6], [1, 1, 0], Extrapolation.CLAMP),
    };
  });

  // The upright face (sheen, bottom shade, title) belongs to the centred card only.
  const face = useAnimatedStyle(() => {
    const off = idx - target.value;
    const a = Math.abs(off);
    const s = off > 0 ? -1 : 1;
    const outer = interpolate(a, K, OUTER_X, Extrapolation.CLAMP);
    const inner = interpolate(a, K, INNER_X, Extrapolation.CLAMP);
    const mid = (outer + inner) / 2;
    return {
      opacity: interpolate(a, [0, 0.45], [1, 0], Extrapolation.CLAMP),
      transform: [{ translateX: s * mid }],
    };
  });

  return (
    <Animated.View pointerEvents="none" style={[styles.layer, { width: stageW }, layer]}>
      <Svg width={stageW} height={STAGE_H}>
        <Defs>
          <SvgLinearGradient id={`${gid}c`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={top} />
            <Stop offset="1" stopColor={bottom} />
          </SvgLinearGradient>
          <SvgLinearGradient id={`${gid}l`} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#000000" stopOpacity={0} />
            <Stop offset="1" stopColor="#000000" stopOpacity={0.45} />
          </SvgLinearGradient>
          <SvgLinearGradient id={`${gid}r`} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#000000" stopOpacity={0.45} />
            <Stop offset="1" stopColor="#000000" stopOpacity={0} />
          </SvgLinearGradient>
        </Defs>
        <AnimatedPath animatedProps={shapeProps} fill={`url(#${gid}c)`} />
        <AnimatedPath animatedProps={shadeLeftProps} fill={`url(#${gid}l)`} />
        <AnimatedPath animatedProps={shadeRightProps} fill={`url(#${gid}r)`} />
      </Svg>

      <Animated.View style={[styles.face, { left: cx - CARD / 2, top: CY - CARD / 2 }, face]}>
        <View style={styles.sheen} />
        <LinearGradient
          colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.45)"]}
          style={styles.faceShade}
        />
        <Text style={styles.title} numberOfLines={2}>
          {theme.title}
        </Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  stage: { alignSelf: "center", position: "relative", overflow: "hidden" },
  layer: { position: "absolute", top: 0, left: 0, height: STAGE_H },
  face: {
    position: "absolute",
    width: CARD,
    height: CARD,
    borderRadius: 16,
    overflow: "hidden",
  },
  // Figma 371:1135 — white 18 % ellipse 130 pt at (52, −36).
  sheen: {
    position: "absolute",
    left: 52,
    top: -36,
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  // Figma 371:1136 — bottom half fades to 45 % black.
  faceShade: { position: "absolute", left: 0, right: 0, top: 70, bottom: 0 },
  title: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 11,
    color: "#FFFFFF",
    fontSize: 15,
    lineHeight: 18,
    fontFamily: "Geologica_700Bold",
  },
});
