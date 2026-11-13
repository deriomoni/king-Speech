import React, { createContext, useContext } from "react";
import { useWindowDimensions, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  measure,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";

// Scroll-driven "edge shrink": a block gently shrinks and dims as it scrolls
// past the top edge of the screen (collapsing toward its bottom, straight up),
// and while it sits under the bottom edge (collapsing toward its top). It is
// driven by the block's real on-screen position (measure on the UI thread), so
// it works for any nesting; the iOS bounce at the very top changes nothing.

type EdgeCtx = { scrollY: SharedValue<number>; topEdge: number; bottomEdge: number };
const Ctx = createContext<EdgeCtx | null>(null);

export const EDGE_RANGE = 220; // px over which the effect ramps (smooth)
export const EDGE_MIN_SCALE = 0.9;
export const EDGE_MIN_OPACITY = 0.45;

/** Scroll handler + shared value for an Animated.ScrollView. */
export function useEdgeScroll() {
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollY.value = e.contentOffset.y;
    },
  });
  return { scrollY, onScroll };
}

export function EdgeScaleProvider({
  scrollY,
  topEdge,
  bottomEdge,
  children,
}: EdgeCtx & { children: React.ReactNode }) {
  return <Ctx.Provider value={{ scrollY, topEdge, bottomEdge }}>{children}</Ctx.Provider>;
}

export function EdgeScale({
  entering,
  style,
  minOpacity = EDGE_MIN_OPACITY,
  minScale = EDGE_MIN_SCALE,
  onLayout,
  children,
}: {
  onLayout?: (e: any) => void;
  entering?: any;
  style?: StyleProp<ViewStyle>;
  minOpacity?: number;
  minScale?: number;
  children: React.ReactNode;
}) {
  const ctx = useContext(Ctx);
  const { height: screenH } = useWindowDimensions();
  const ref = useAnimatedRef<Animated.View>();
  const fallback = useSharedValue(0);
  const scrollY = ctx?.scrollY ?? fallback;
  const topEdge = ctx?.topEdge ?? 0;
  const bottomEdge = ctx?.bottomEdge ?? 0;

  const anim = useAnimatedStyle(() => {
    // Read scrollY so the style re-evaluates on every scroll frame.
    const _sy = scrollY.value;
    if (!ctx) return {};
    const m = measure(ref);
    if (!m || m.height <= 0) return {};
    const top = m.pageY;
    const bottom = top + m.height;
    const overTop = topEdge - top;
    if (overTop > 0 && _sy > 0) {
      const t = interpolate(overTop, [0, EDGE_RANGE], [0, 1], Extrapolation.CLAMP);
      const e = t * t * (3 - 2 * t); // smoothstep
      return {
        opacity: 1 - (1 - minOpacity) * e,
        transform: [{ scale: 1 - (1 - minScale) * e }],
        transformOrigin: "bottom center",
      } as any;
    }
    const overBottom = bottom - (screenH - bottomEdge);
    if (overBottom > 0) {
      const t = interpolate(overBottom, [0, EDGE_RANGE], [0, 1], Extrapolation.CLAMP);
      const e = t * t * (3 - 2 * t);
      return {
        opacity: 1 - (1 - minOpacity) * e,
        transform: [{ scale: 1 - (1 - minScale) * e }],
        transformOrigin: "top center",
      } as any;
    }
    return { opacity: 1, transform: [{ scale: 1 }] } as any;
  });

  return (
    <Animated.View ref={ref} style={[style, anim]} onLayout={onLayout}>
      {entering ? <Animated.View entering={entering}>{children}</Animated.View> : children}
    </Animated.View>
  );
}
