import React, { useEffect } from "react";
import { Image, Platform, StyleSheet, useWindowDimensions, type ImageSourcePropType } from "react-native";
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// «Начать выступление» → the theme cover lifts out of the carousel, grows and
// glides into the exact spot of the photo on the theme preview (showtime-stage
// «Превью темы»), while the screen washes to the preview background. When it
// lands, the preview is pushed with a fade on top of an identical picture, so
// the hand-off is invisible.

export type CoverRect = { x: number; y: number; w: number; h: number };

// Must match the preview layout in app/showtime-stage.tsx (pvScroll / pvArt).
const PV_SIDE = 28;
const PV_TOP = 43;
const PV_RATIO = 1.35;
const PV_RADIUS = 22;
const FROM_RADIUS = 16 * 1.45;
const DURATION = 560;

export function CoverFlight({
  source,
  from,
  bg,
  onArrive,
}: {
  source: ImageSourcePropType;
  from: CoverRect;
  bg: string;
  onArrive: () => void;
}) {
  const { width: winW } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const to: CoverRect = {
    x: PV_SIDE,
    y: topPad + PV_TOP,
    w: winW - PV_SIDE * 2,
    h: (winW - PV_SIDE * 2) / PV_RATIO,
  };

  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withTiming(1, { duration: DURATION, easing: Easing.bezier(0.25, 0.8, 0.25, 1) }, (done) => {
      if (done) runOnJS(onArrive)();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const backdrop = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0, 0.7], [0, 1], "clamp"),
  }));
  const card = useAnimatedStyle(() => {
    const t = p.value;
    return {
      left: from.x + (to.x - from.x) * t,
      top: from.y + (to.y - from.y) * t,
      width: (from.w + (to.w - from.w) * t),
      height: (from.h + (to.h - from.h) * t),
      borderRadius: FROM_RADIUS + (PV_RADIUS - FROM_RADIUS) * t,
    };
  });

  return (
    <>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: bg, zIndex: 50 }, backdrop]} />
      <Animated.View pointerEvents="none" style={[styles.card, card]}>
        <Image source={source} style={styles.photo} resizeMode="cover" />
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  card: { position: "absolute", overflow: "hidden", zIndex: 51 },
  photo: { position: "absolute", left: 0, top: 0, right: 0, bottom: 0, width: "100%", height: "100%" },
});
