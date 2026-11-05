import React, { useEffect, useState } from "react";
import { View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

// Brick outline from the Figma spec: 4pt, centred on the brick edge (half
// outside, half over the face), round join.
//   • locked   — solid black at 9%
//   • active   — linear gradient white 77% → brick colour lightened 30% at 88%,
//                and the gradient rotates so a shine runs around the brick
//   • completed — the same gradient, standing still

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

// Gradient line for a CSS-style angle (0° = up, 90° = left→right) across a
// w×h box, in user-space coordinates.
function gradientLine(deg: number, w: number, h: number, ox: number, oy: number) {
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

function useSpin(active: boolean) {
  const [deg, setDeg] = useState(90);
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    const start = Date.now();
    const tick = () => {
      setDeg(90 + (((Date.now() - start) % REVOLUTION_MS) / REVOLUTION_MS) * 360);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active]);
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
  const W = width + STROKE;
  const H = height + STROKE;
  const o = STROKE / 2;
  const line = gradientLine(deg, width, height, o, o);
  return (
    <View
      pointerEvents="none"
      style={{ position: "absolute", left: -o, top: -o, width: W, height: H, zIndex: 2 }}
    >
      <Svg width={W} height={H}>
        {variant !== "locked" && (
          <Defs>
            <LinearGradient id="brickShine" gradientUnits="userSpaceOnUse" {...line}>
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.77} />
              <Stop offset="1" stopColor={lightenHex(brick, 0.3)} stopOpacity={0.88} />
            </LinearGradient>
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
          stroke={variant === "locked" ? "#000000" : "url(#brickShine)"}
          strokeOpacity={variant === "locked" ? 0.09 : 1}
        />
      </Svg>
    </View>
  );
}
