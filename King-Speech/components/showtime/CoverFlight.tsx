import React, { useEffect } from "react";
import { rs } from "@/lib/responsive";
import { Image, StyleSheet, type ImageSourcePropType } from "react-native";
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

// Theme cover ⇄ theme preview photo.
//  • "out":  «Начать выступление» / a catalog card — the cover lifts out, grows
//    and glides into the exact spot of the photo on the theme preview while the
//    screen washes to the preview background; then the preview is pushed (fade)
//    on top of an identical picture, so the hand-off is invisible.
//  • "back": the preview's X — the screen starts covered with the photo at the
//    preview spot (under the fading preview), then the photo shrinks back into
//    its cover and the screen clears.

export type CoverRect = { x: number; y: number; w: number; h: number };

// Must match the preview layout in app/showtime-stage.tsx (pvScroll / pvArt).
// (scaled like the preview's stylesheet on tablets)
const PV_SIDE = rs(28);
const PV_TOP = rs(43);
const PV_RATIO = 1.35;
export const PREVIEW_RADIUS = rs(22);
/** Corner radius that matches CoverImage's squircle (reach 0.42·w, tight control). */
export const squircleRadius = (w: number) => w * 0.255;

/** Where the photo sits on the theme preview. */
export function previewRect(winW: number, topPad: number): CoverRect {
  const w = winW - PV_SIDE * 2;
  return { x: PV_SIDE, y: topPad + PV_TOP, w, h: w / PV_RATIO };
}

const DURATION = 560;

export function CoverFlight({
  source,
  cover,
  coverRadius,
  preview,
  direction,
  bg,
  delay = 0,
  focusY = 0.5,
  onDone,
}: {
  /** Vertical crop focus — same as the CoverImage on both ends, so the picture never jumps. */
  focusY?: number;
  source: ImageSourcePropType;
  /** The cover on the origin screen. */
  cover: CoverRect;
  coverRadius: number;
  /** The photo on the preview. */
  preview: CoverRect;
  direction: "out" | "back";
  bg: string;
  delay?: number;
  onDone: () => void;
}) {
  // p: 0 = at the cover, 1 = at the preview.
  const p = useSharedValue(direction === "out" ? 0 : 1);
  useEffect(() => {
    const anim = withTiming(
      direction === "out" ? 1 : 0,
      { duration: DURATION, easing: Easing.bezier(0.25, 0.8, 0.25, 1) },
      (done) => {
        if (done) runOnJS(onDone)();
      },
    );
    p.value = delay ? withDelay(delay, anim) : anim;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const backdrop = useAnimatedStyle(() => ({
    opacity:
      direction === "out"
        ? interpolate(p.value, [0, 0.7], [0, 1], "clamp")
        : interpolate(p.value, [0.3, 1], [0, 1], "clamp"),
  }));
  const card = useAnimatedStyle(() => {
    const t = p.value;
    return {
      left: cover.x + (preview.x - cover.x) * t,
      top: cover.y + (preview.y - cover.y) * t,
      width: cover.w + (preview.w - cover.w) * t,
      height: cover.h + (preview.h - cover.h) * t,
      borderRadius: coverRadius + (PREVIEW_RADIUS - coverRadius) * t,
    };
  });

  // Like CoverImage: a square photo as wide as the card, shifted by focusY
  // when the card is wider than tall (the preview).
  const photo = useAnimatedStyle(() => {
    const t = p.value;
    const w = cover.w + (preview.w - cover.w) * t;
    const h = cover.h + (preview.h - cover.h) * t;
    const side = Math.max(w, h);
    return {
      width: side,
      height: side,
      left: (w - side) / 2,
      top: -(side - h) * Math.max(0, Math.min(1, focusY)),
    };
  });

  return (
    <>
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: bg, zIndex: 50 }, backdrop]}
      />
      <Animated.View pointerEvents="none" style={[styles.card, card]}>
        <Animated.Image source={source} style={[styles.photo, photo]} resizeMode="cover" />
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  card: { position: "absolute", overflow: "hidden", zIndex: 51 },
  photo: { position: "absolute" },
});
