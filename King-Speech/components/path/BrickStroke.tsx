import React, { useEffect, useId } from "react";
import { View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useIsFocused } from "expo-router";

const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

// Brick outline from the Figma spec: 4pt, centred on the brick edge (half
// outside, half over the face), round join.
//   • locked   — solid black at 9%
//   • active   — linear gradient white 77% → brick colour lightened 30% at 88%,
//                and the gradient rotates so a shine runs around the brick
//   • completed — no gradient: the same thin edge as locked (black at 9%),
//                 laid over a stroke in the brick's own colour

const STROKE = 4;
const REVOLUTION_MS = 1440; // one full lap of the shine (Figma: 8 × 0.18s)

export function lightenHex(hex: string, t: number): string {
  const n = parseInt(hex.replace("#", "").slice(0, 6), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * t);
  const r = mix((n >> 16) & 0xff);
  const g = mix((n >> 8) & 0xff);
  const b = mix(n & 0xff);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

// Mix two #rrggbb colours (t = 0 → a, 1 → b). Used to bake what used to be
// semi-transparent strokes into solid colours: translucent edges darkened
// twice where the face outline overlaps the brick's side wall, showing seams.
export function mixHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.replace("#", "").slice(0, 6), 16);
  const pb = parseInt(b.replace("#", "").slice(0, 6), 16);
  const ch = (x: number, y: number) => Math.round(x + (y - x) * t);
  const r = ch((pa >> 16) & 0xff, (pb >> 16) & 0xff);
  const g = ch((pa >> 8) & 0xff, (pb >> 8) & 0xff);
  const bl = ch(pa & 0xff, pb & 0xff);
  return `#${((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1)}`;
}

// Locked face colour (see StepBlock) and its edge: 9% black baked in.
const LOCKED_FACE = "#E8E8EE";
export const EDGE_DARKEN = 0.09;

// Gradient line for a CSS-style angle (0° = up, 90° = left→right) across a
// w×h box, in user-space coordinates.
function gradientLine(deg: number, w: number, h: number, ox: number, oy: number) {
  "worklet";
  const t = (deg * Math.PI) / 180;
  const dx = Math.sin(t);
  const dy = -Math.cos(t);
  const L = Math.abs(w * dx) + Math.abs(h * dy);
  const cx = ox + w / 2;
  const cy = oy + h / 2;
  return {
    x1: cx - (dx * L) / 2,
    y1: cy - (dy * L) / 2,
    x2: cx + (dx * L) / 2,
    y2: cy + (dy * L) / 2,
  };
}

// The shine angle lives on the UI thread (Reanimated): the old version did a
// React setState on every requestAnimationFrame — 60 re-renders a second,
// forever, even with the Path hidden under a level or another tab. That was a
// big part of the phone heating up. Now nothing re-renders, and the loop is
// paused whenever the screen holding the brick is not focused.
function useSpin(active: boolean) {
  const focused = useIsFocused();
  const deg = useSharedValue(90);
  useEffect(() => {
    if (!active || !focused) {
      cancelAnimation(deg);
      return;
    }
    deg.value = 90;
    deg.value = withRepeat(
      withTiming(450, { duration: REVOLUTION_MS, easing: Easing.linear }),
      -1,
      false,
    );
    return () => cancelAnimation(deg);
  }, [active, focused, deg]);
  return deg;
}

export default function BrickStroke({
  width,
  height,
  radius,
  variant,
  brick,
}: {
  width: number;
  height: number;
  radius: number;
  variant: "locked" | "active" | "completed";
  brick: string;
}) {
  const deg = useSpin(variant === "active");
  // Unique per brick: a shared id makes every SVG on web resolve to the first
  // gradient defined, i.e. one module colour bleeding into all bricks.
  const gid = "brickShine" + useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const W = width + STROKE;
  const H = height + STROKE;
  const o = STROKE / 2;
  const gradientProps = useAnimatedProps(() => {
    const l = gradientLine(deg.value, width, height, o, o);
    return { x1: l.x1, y1: l.y1, x2: l.x2, y2: l.y2 };
  });
  return (
    <View
      pointerEvents="none"
      style={{ position: "absolute", left: -o, top: -o, width: W, height: H, zIndex: 2 }}
    >
      <Svg width={W} height={H}>
        {variant === "active" && (
          <Defs>
            <AnimatedLinearGradient
              id={gid}
              gradientUnits="userSpaceOnUse"
              animatedProps={gradientProps}
            >
              {/* Same look as white 77% → lightened brick 88% over the brick,
                  baked opaque so nothing behind shows through the edge. */}
              <Stop offset="0" stopColor={mixHex(brick, "#FFFFFF", 0.77)} />
              <Stop offset="1" stopColor={mixHex(brick, lightenHex(brick, 0.3), 0.88)} />
            </AnimatedLinearGradient>
          </Defs>
        )}
        <Rect
          x={o}
          y={o}
          width={width}
          height={height}
          rx={radius}
          ry={radius}
          fill="none"
          strokeWidth={STROKE}
          strokeLinejoin="round"
          stroke={
            variant === "active"
              ? `url(#${gid})`
              : variant === "completed"
                ? mixHex(brick, "#000000", EDGE_DARKEN)
                : mixHex(LOCKED_FACE, "#000000", EDGE_DARKEN)
          }
        />
      </Svg>
    </View>
  );
}
