// "Актуальные темы для вас" carousel — Figma node 17:674 (Vinyl gallery).
// Same gesture / snapping logic as VinylGallery, restyled to the design:
// flat square covers (no 3D tilt), centre 180 pt with a gold ctaStroke frame,
// neighbours shrink to 140 / 104 pt and fade to 50 % / 25 %, gold carets.
import React, { useEffect, useMemo } from "react";
import { View, StyleSheet, Pressable, Platform, useWindowDimensions, type ViewStyle } from "react-native";
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
import { useTheme } from "@/context/ThemeContext";
import { VinylCover } from "./VinylCovers";
import { CaretBackIcon, CaretForwardIcon } from "./ShowTimeIcons";

const SECTION_HEIGHT = 230;
const CENTER_SIZE = 180;
const RADIUS = 14.5;
const ARROW_HIT = 44;
// Figma: neighbour centres sit 151 pt and 201 pt from the selected cover's centre.
const OFFSETS = [0, 151, 201];
const SCALES = [1, 140 / 180, 104 / 180];
const OPACITIES = [1, 0.5, 0.25];

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
  const { theme: c, themeMode } = useTheme();
  const isLight = themeMode === "light";
  const { width: winW } = useWindowDimensions();
  const containerWidth = Math.max(280, Math.min(winW, 480) - 40);
  const stride = OFFSETS[1];

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

  const pan = useMemo(
    () =>
      Gesture.Pan()
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
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stride, maxIdx],
  );

  const windowIndices = useMemo(() => {
    const out: number[] = [];
    for (let off = -3; off <= 3; off++) {
      const i = selectedIdx + off;
      if (i >= 0 && i < themes.length) out.push(i);
    }
    return out;
  }, [selectedIdx, themes.length]);

  const stepBy = (delta: number) => {
    const next = Math.max(0, Math.min(maxIdx, selectedIdx + delta));
    if (next !== selectedIdx) onSelect(next);
  };
  const canPrev = selectedIdx > 0;
  const canNext = selectedIdx < maxIdx;
  const sideBorder = isLight ? "rgba(38,38,40,0.14)" : "#4E4E4F";

  return (
    <View style={[styles.section, { height: SECTION_HEIGHT, width: containerWidth }]}>
      <GestureDetector gesture={pan}>
        <View style={styles.stage} collapsable={false}>
          {windowIndices.map((idx) => (
            <Slot
              key={idx}
              idx={idx}
              target={target}
              theme={themes[idx]}
              isCenter={idx === selectedIdx}
              onTap={() => onSelect(idx)}
              frameColor={idx === selectedIdx ? c.ctaStroke : sideBorder}
              cardBg={c.card}
            />
          ))}
        </View>
      </GestureDetector>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Предыдущая тема"
        onPress={() => stepBy(-1)}
        disabled={!canPrev}
        hitSlop={10}
        style={[styles.arrow, styles.arrowLeft, { opacity: canPrev ? 1 : 0.3 }]}
      >
        <CaretBackIcon color={c.accentInk} />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Следующая тема"
        onPress={() => stepBy(1)}
        disabled={!canNext}
        hitSlop={10}
        style={[styles.arrow, styles.arrowRight, { opacity: canNext ? 1 : 0.3 }]}
      >
        <CaretForwardIcon color={c.accentInk} />
      </Pressable>
    </View>
  );
}

type SlotProps = {
  idx: number;
  target: SharedValue<number>;
  theme: SpeechTheme;
  isCenter: boolean;
  onTap: () => void;
  frameColor: string;
  cardBg: string;
};

function Slot({ idx, target, theme, isCenter, onTap, frameColor, cardBg }: SlotProps) {
  const aStyle = useAnimatedStyle(() => {
    const offset = idx - target.value;
    const absOff = Math.abs(offset);
    const dist = interpolate(absOff, [0, 1, 2], OFFSETS, Extrapolation.EXTEND);
    const tx = offset < 0 ? -dist : dist;
    const scale = interpolate(absOff, [0, 1, 2], SCALES, Extrapolation.CLAMP);
    const opacity = interpolate(absOff, [0, 1, 2, 3], [...OPACITIES, 0], Extrapolation.CLAMP);
    return {
      opacity,
      transform: [{ translateX: tx }, { scale }],
      zIndex: 100 - Math.round(absOff * 10),
    };
  });

  return (
    <Animated.View
      style={[
        styles.slot,
        {
          width: CENTER_SIZE,
          height: CENTER_SIZE,
          marginLeft: -CENTER_SIZE / 2,
          marginTop: -CENTER_SIZE / 2,
          left: "50%",
          top: "50%",
        },
        aStyle,
      ]}
    >
      <Pressable
        onPress={onTap}
        disabled={isCenter}
        style={[styles.cover, { backgroundColor: cardBg }, isCenter && coverShadow]}
      >
        <View style={styles.coverClip}>
          <VinylCover size={CENTER_SIZE} accentColor={theme.accentColor} designIndex={idx} />
        </View>
        <View
          pointerEvents="none"
          style={[styles.frame, { borderColor: frameColor, borderWidth: isCenter ? 2.65 : 1.85 }]}
        />
      </Pressable>
    </Animated.View>
  );
}

type ShadowStyle = ViewStyle & { boxShadow?: string };
const coverShadow = Platform.select<ShadowStyle>({
  ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.35, shadowRadius: 14 },
  android: { elevation: 10 },
  web: { boxShadow: "0px 12px 28px -6px rgba(0,0,0,0.35)" },
  default: {},
}) as ShadowStyle;

const styles = StyleSheet.create({
  section: { alignSelf: "center", position: "relative" },
  stage: { flex: 1, overflow: "hidden" },
  slot: { position: "absolute" },
  cover: { width: CENTER_SIZE, height: CENTER_SIZE, borderRadius: RADIUS },
  coverClip: { width: CENTER_SIZE, height: CENTER_SIZE, borderRadius: RADIUS, overflow: "hidden" },
  frame: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: RADIUS,
  },
  arrow: {
    position: "absolute",
    top: "50%",
    marginTop: -ARROW_HIT / 2,
    width: ARROW_HIT,
    height: ARROW_HIT,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 200,
  },
  arrowLeft: { left: 4 },
  arrowRight: { right: 4 },
});
