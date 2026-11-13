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
import { View, Image, StyleSheet, useWindowDimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  cancelAnimation,
  runOnJS,
  interpolate,
  Extrapolation,
  type SharedValue,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import type { SpeechTheme } from "@/app/showtime-stage";
import { showtimeCover } from "@/constants/showtimeCovers";

// Everything is 1.45× the Figma frame (covers were enlarged by 45 %).
const SIZE_K = 1.45;
const STAGE_H = Math.round(180 * SIZE_K);
const CARD = Math.round(140 * SIZE_K);
const CY = Math.round(84 * SIZE_K); // card mid-height inside the 180 pt frame (Figma y 14 + 70)

// Keyframes per |offset| 0…4 (left side; mirrored for the right). Values are
// relative to the stage centre: outer edge x, inner edge x, outer / inner
// edge heights, corner radius. Index 4 is an off-screen extrapolation.
const K = [0, 1, 2, 3, 4];
const OUTER_X = [-70, -127.1, -168.7, -209.8, -251];
const INNER_X = [70, -53.7, -86.1, -118.2, -150.3];
const OUTER_H = [140, 136.4, 135.8, 135.2, 134.6];
const INNER_H = [140, 105.4, 105.0, 104.6, 104.2];
const RADII = [16, 12, 12, 12, 12].map((v) => v * SIZE_K);
// Tap zones (distance from centre) → slot index.
const ZONES = [70, 127.1, 168.7, 209.8].map((v) => v * SIZE_K);

type Props = {
  themes: SpeechTheme[];
  selectedIdx: number;
  onSelect: (idx: number) => void;
};

function clamp(v: number, lo: number, hi: number) {
  "worklet";
  return Math.max(lo, Math.min(hi, v));
}

export function ThemeCoverGallery({ themes, selectedIdx, onSelect }: Props) {
  const { width: winW } = useWindowDimensions();
  const stageW = Math.min(winW, 480);
  const cx = stageW / 2;
  // One swipe step ≈ distance between neighbouring outer edges.
  const stride = 60 * SIZE_K;

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

// Side cards are real 3D: the photo card is turned away in depth (rotateY with
// perspective), which gives the same converging top/bottom edges as the Figma
// trapezoids. Per |offset| 0…4: turn angle, scale and centre shift — tuned so
// the projected edges land on the Figma rest positions (OUTER_X / INNER_X).
const PERSPECTIVE = 441 * SIZE_K;
const ROT = [0, 55, 55, 55, 55];
const SCALE = [1, 0.85, 0.85, 0.85, 0.85];
const SHIFT = [0, -86, -123, -159, -195].map((v) => v * SIZE_K);

function Card({ idx, target, theme, cx }: CardProps) {
  const cover = useMemo(() => showtimeCover(theme.levelId), [theme.levelId]);

  const card = useAnimatedStyle(() => {
    const off = idx - target.value;
    const a = Math.min(Math.abs(off), 4);
    const s = off > 0 ? -1 : 1; // 1 = left side, -1 = right side
    return {
      zIndex: 100 - Math.round(a * 10),
      opacity: interpolate(a, [0, 3, 3.6], [1, 1, 0], Extrapolation.CLAMP),
      borderRadius: interpolate(a, K, RADII, Extrapolation.CLAMP),
      transform: [
        { perspective: PERSPECTIVE },
        { translateX: s * interpolate(a, K, SHIFT, Extrapolation.CLAMP) },
        { rotateY: `${s * interpolate(a, K, ROT, Extrapolation.CLAMP)}deg` },
        { scale: interpolate(a, K, SCALE, Extrapolation.CLAMP) },
      ],
    };
  });

  // Far (inner) edge darkening: left cards are dark on the right, right cards on the left.
  const shadeLeft = useAnimatedStyle(() => {
    const off = idx - target.value;
    return { opacity: off < 0 ? clamp(-off, 0, 1) : 0 };
  });
  const shadeRight = useAnimatedStyle(() => {
    const off = idx - target.value;
    return { opacity: off > 0 ? clamp(off, 0, 1) : 0 };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.card, { left: cx - CARD / 2, top: CY - CARD / 2 }, card]}
    >
      <Image source={cover} style={styles.photo} resizeMode="cover" />
      <Animated.View style={[StyleSheet.absoluteFill, shadeLeft]}>
        <LinearGradient
          colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.5)"]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, shadeRight]}>
        <LinearGradient
          colors={["rgba(0,0,0,0.5)", "rgba(0,0,0,0)"]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  stage: { alignSelf: "center", position: "relative", overflow: "hidden" },
  card: {
    position: "absolute",
    width: CARD,
    height: CARD,
    overflow: "hidden",
    backgroundColor: "#2E2E30",
  },
  photo: { position: "absolute", left: 0, top: 0, width: CARD, height: CARD },
});
