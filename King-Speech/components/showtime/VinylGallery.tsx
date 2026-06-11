import React, { useEffect, useMemo } from "react";
import { View, Text, StyleSheet, Pressable, useWindowDimensions } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  cancelAnimation,
  runOnJS,
  interpolate,
  Extrapolation,
  FadeIn,
  type SharedValue,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";
import type { SpeechTheme } from "@/app/showtime-stage";
import { VinylRecord } from "./VinylRecord";

const SECTION_HEIGHT = 230;
const CENTER_SIZE = 180;
const ARROW_HIT = 44;

type Props = {
  themes: SpeechTheme[];
  selectedIdx: number;
  onSelect: (idx: number) => void;
};

function clamp(v: number, lo: number, hi: number) {
  "worklet";
  return Math.max(lo, Math.min(hi, v));
}

export function VinylGallery({ themes, selectedIdx, onSelect }: Props) {
  const { width: winW } = useWindowDimensions();

  // Sizing — center 180×180; sides reach ~120 via scale 0.65.
  const containerWidth = Math.max(280, winW - 40);
  const centerSize = CENTER_SIZE;
  const stride = Math.round(centerSize * 0.6);

  const target = useSharedValue(selectedIdx);
  const startTarget = useSharedValue(selectedIdx);
  const lastIdx = useSharedValue(selectedIdx);

  // Sync with external selectedIdx (e.g. from arrow taps)
  useEffect(() => {
    cancelAnimation(target);
    lastIdx.value = selectedIdx;
    target.value = withSpring(selectedIdx, { damping: 20, stiffness: 140, mass: 0.7 });
  }, [selectedIdx, target, lastIdx]);

  const maxIdx = themes.length - 1;

  // Use a ref so the gesture worklet always sees the latest onSelect
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
          const next = clamp(startTarget.value - e.translationX / stride, 0, maxIdx);
          target.value = next;
        })
        .onEnd((e) => {
          const velocityIdx = -e.velocityX / stride;
          const projected = target.value + velocityIdx * 0.18;
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

  // Visible window: selectedIdx ± 3 (max 7 mounted)
  const windowIndices = useMemo(() => {
    const out: number[] = [];
    for (let off = -3; off <= 3; off++) {
      const i = selectedIdx + off;
      if (i >= 0 && i < themes.length) out.push(i);
    }
    return out;
  }, [selectedIdx, themes.length]);

  const centerTheme = themes[selectedIdx];

  const stepBy = (delta: number) => {
    const next = Math.max(0, Math.min(maxIdx, selectedIdx + delta));
    if (next === selectedIdx) return;
    // Haptic is fired by the parent's onSelect handler — keep it centralized.
    onSelect(next);
  };

  const canPrev = selectedIdx > 0;
  const canNext = selectedIdx < maxIdx;

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
              size={centerSize}
              stride={stride}
              isCenter={idx === selectedIdx}
              onTap={() => onSelect(idx)}
            />
          ))}
        </View>
      </GestureDetector>

      {/* Left arrow */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Предыдущая тема"
        onPress={() => stepBy(-1)}
        disabled={!canPrev}
        hitSlop={10}
        style={[styles.arrow, styles.arrowLeft, { opacity: canPrev ? 1 : 0.3 }]}
      >
        <Ionicons name="caret-back" size={28} color={centerTheme.accentColor} />
      </Pressable>

      {/* Right arrow */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Следующая тема"
        onPress={() => stepBy(1)}
        disabled={!canNext}
        hitSlop={10}
        style={[styles.arrow, styles.arrowRight, { opacity: canNext ? 1 : 0.3 }]}
      >
        <Ionicons name="caret-forward" size={28} color={centerTheme.accentColor} />
      </Pressable>

      {/* Title under center */}
      <Animated.View
        key={`title-${selectedIdx}`}
        entering={FadeIn.duration(220)}
        style={styles.titleWrap}
      >
        <Text
          style={[
            styles.title,
            { color: centerTheme.accentColor, fontFamily: "Inter_600SemiBold" },
          ]}
          numberOfLines={1}
        >
          {centerTheme.title}
        </Text>
        <Text style={[styles.counter, { fontFamily: "Inter_400Regular" }]}>
          {selectedIdx + 1} / {themes.length}
        </Text>
      </Animated.View>
    </View>
  );
}

type SlotProps = {
  idx: number;
  target: SharedValue<number>;
  theme: SpeechTheme;
  size: number;
  stride: number;
  isCenter: boolean;
  onTap: () => void;
};

function Slot({ idx, target, theme, size, stride, isCenter, onTap }: SlotProps) {
  const aStyle = useAnimatedStyle(() => {
    const offset = idx - target.value;
    const absOff = Math.abs(offset);
    const tx = offset * stride;
    const scale = interpolate(absOff, [0, 1, 2], [1, 0.65, 0.5], Extrapolation.CLAMP);
    const rotY = interpolate(offset, [-2, 0, 2], [40, 0, -40], Extrapolation.CLAMP);
    return {
      transform: [
        { perspective: 900 },
        { translateX: tx },
        { rotateY: `${rotY}deg` },
        { scale },
      ],
      zIndex: 100 - Math.round(absOff * 10),
    };
  });

  return (
    <Animated.View
      style={[
        styles.slot,
        {
          width: size,
          height: size,
          marginLeft: -size / 2,
          marginTop: -size / 2,
          left: "50%",
          top: "50%",
        },
        aStyle,
      ]}
    >
      <Pressable onPress={onTap} disabled={isCenter} style={{ width: size, height: size }}>
        <VinylRecord
          size={size}
          accentColor={theme.accentColor}
          designIndex={idx}
          isCenter={isCenter}
        />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  section: {
    alignSelf: "center",
    position: "relative",
  },
  stage: {
    flex: 1,
    overflow: "hidden",
  },
  slot: {
    position: "absolute",
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
  arrowLeft: {
    left: 4,
  },
  arrowRight: {
    right: 4,
  },
  titleWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    gap: 2,
  },
  title: {
    fontSize: 15,
    letterSpacing: 0.2,
    maxWidth: "85%",
    textAlign: "center",
  },
  counter: {
    fontSize: 11,
    color: "rgba(255,255,255,0.35)",
  },
});
