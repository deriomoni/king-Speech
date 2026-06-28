import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, Platform, type LayoutChangeEvent } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

/**
 * Draggable vertical scrubber for the Path map. Sits on the right edge; drag
 * (or tap) the thumb to fast-scroll the whole rank up/down. Auto-hides shortly
 * after the user stops interacting so it never obscures the map.
 *
 * It writes directly to the ScrollView (via `onScrubTo`) without going through
 * React state, so dragging stays smooth and doesn't trigger extra re-renders.
 */
interface Props {
  contentH: number;
  viewportH: number;
  scrollY: number;
  topInset: number;
  bottomInset: number;
  accent: string;
  dark: boolean;
  /** y = absolute content offset (0..maxScroll). */
  onScrubTo: (y: number) => void;
}

function clampW(v: number, min: number, max: number) {
  "worklet";
  return Math.min(max, Math.max(min, v));
}

export default function PathScrubber({
  contentH,
  viewportH,
  scrollY,
  topInset,
  bottomInset,
  accent,
  dark,
  onScrubTo,
}: Props) {
  const [trackH, setTrackH] = useState(0);
  const [shown, setShown] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const maxScroll = Math.max(1, contentH - viewportH);
  const thumbH = trackH > 0 ? Math.max(44, Math.min(trackH, (viewportH / contentH) * trackH)) : 44;
  const travel = Math.max(1, trackH - thumbH);

  const thumbTop = useSharedValue(0);
  const dragging = useSharedValue(false);
  const visible = useSharedValue(0);

  // The scrubber is only useful when there's meaningfully more content than
  // fits on screen.
  const enabled = contentH > viewportH + 240 && viewportH > 0;

  const scheduleHide = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (!dragging.value) setShown(false);
    }, 1400);
  };

  const reveal = () => {
    setShown(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (!dragging.value) setShown(false);
    }, 1400);
  };

  // Reveal while the map is being scrolled (any source), then fade out.
  useEffect(() => {
    if (!enabled) return;
    reveal();
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollY, enabled]);

  // Keep the thumb synced to the real scroll position when not dragging.
  useEffect(() => {
    if (dragging.value || trackH <= 0) return;
    const r = Math.min(1, Math.max(0, scrollY / maxScroll));
    thumbTop.value = r * travel;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollY, trackH, maxScroll, travel]);

  useEffect(() => {
    visible.value = withTiming(shown ? 1 : 0, { duration: 220 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown]);

  const tick = () => {
    if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
  };

  const applyRatio = (ratio: number) => {
    onScrubTo(ratio * maxScroll);
  };

  const pan = Gesture.Pan()
    .onBegin((e) => {
      dragging.value = true;
      const tt = clampW(e.y - thumbH / 2, 0, travel);
      thumbTop.value = tt;
      runOnJS(reveal)();
      runOnJS(tick)();
      runOnJS(applyRatio)(tt / travel);
    })
    .onUpdate((e) => {
      const tt = clampW(e.y - thumbH / 2, 0, travel);
      thumbTop.value = tt;
      runOnJS(applyRatio)(tt / travel);
    })
    .onFinalize(() => {
      dragging.value = false;
      runOnJS(scheduleHide)();
    });

  const wrapStyle = useAnimatedStyle(() => ({
    opacity: visible.value,
  }));
  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: thumbTop.value }],
  }));

  if (!enabled) return null;

  const trackBg = dark ? "rgba(255,255,255,0.10)" : "rgba(15,18,32,0.12)";

  const onLayout = (e: LayoutChangeEvent) => setTrackH(e.nativeEvent.layout.height);

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        s.wrap,
        { top: topInset + 12, bottom: bottomInset + 120 },
        wrapStyle,
      ]}
    >
      <GestureDetector gesture={pan}>
        <Animated.View style={s.hit} onLayout={onLayout}>
          <Animated.View style={[s.track, { backgroundColor: trackBg }]} />
          <Animated.View
            style={[
              s.thumb,
              { height: thumbH, backgroundColor: accent },
              thumbStyle,
            ]}
          />
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  wrap: {
    position: "absolute",
    right: 0,
    width: 30,
    alignItems: "center",
  },
  hit: {
    flex: 1,
    width: 30,
    alignItems: "center",
    justifyContent: "flex-start",
  },
  track: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 4,
    borderRadius: 2,
  },
  thumb: {
    width: 6,
    borderRadius: 3,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 3,
  },
});
