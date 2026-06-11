import React from "react";
import Svg, { Path, Circle, Line, Rect } from "react-native-svg";

interface IconProps {
  size?: number;
  color?: string;
}

const STROKE = 1.9;

// All icons share viewBox 32×32 with their visible bbox roughly y∈[4..28],
// geometric centre at (16, 16). This keeps every icon optically aligned
// inside its tab slot.

export function IconHome({ size = 30, color = "#FCF6E6" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <Path
        d="M5 14.2 L16 5 L27 14.2 V25.5 a1.5 1.5 0 0 1 -1.5 1.5 H6.5 a1.5 1.5 0 0 1 -1.5 -1.5 Z"
        stroke={color}
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// Classic microphone — capsule + U-shaped cradle + stem + base.
// Resized so the visible bbox matches the other icons (~4..28 vertically).
export function IconMic({ size = 30, color = "#FCF6E6" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      {/* Capsule */}
      <Rect
        x={11}
        y={4}
        width={10}
        height={15}
        rx={5}
        ry={5}
        stroke={color}
        strokeWidth={STROKE}
        fill="none"
      />
      {/* U-shaped cradle */}
      <Path
        d="M7 14 a9 9 0 0 0 18 0"
        stroke={color}
        strokeWidth={STROKE}
        strokeLinecap="round"
        fill="none"
      />
      {/* Stem */}
      <Line
        x1={16}
        y1={23}
        x2={16}
        y2={27}
        stroke={color}
        strokeWidth={STROKE}
        strokeLinecap="round"
      />
      {/* Base */}
      <Line
        x1={10}
        y1={27.5}
        x2={22}
        y2={27.5}
        stroke={color}
        strokeWidth={STROKE}
        strokeLinecap="round"
      />
    </Svg>
  );
}

// Clapperboard — direct port of user-provided SVG.
export function IconClapperboard({ size = 30, color = "#FCF6E6" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      {/* Slate body */}
      <Path
        d="M4.78 15.20 H28.19 A1.48 1.48 0 0 1 29.67 16.68 V26.92 A2.93 2.93 0 0 1 26.74 29.85 H6.23 A2.93 2.93 0 0 1 3.30 26.92 V16.68 A1.48 1.48 0 0 1 4.78 15.20 Z"
        stroke={color}
        strokeWidth={STROKE}
        strokeLinejoin="round"
        fill="none"
      />
      {/* Tilted top arm */}
      <Path
        d="M3.36 9.89 L25.97 3.83 L27.39 9.14 L4.78 15.20 Z"
        stroke={color}
        strokeWidth={STROKE}
        strokeLinejoin="round"
        strokeLinecap="round"
        fill="none"
      />
      {/* Two diagonal stripes crossing the arm */}
      <Line x1={16.93} y1={6.25} x2={23.77} y2={10.11} stroke={color} strokeWidth={STROKE} strokeLinecap="round" />
      <Line x1={9.01} y1={8.37} x2={15.86} y2={12.23} stroke={color} strokeWidth={STROKE} strokeLinecap="round" />
    </Svg>
  );
}

// Avatar — outlined circle with stroke-only person silhouette inside.
export function IconAvatar({ size = 30, color = "#FCF6E6" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <Circle cx={16} cy={16} r={11} stroke={color} strokeWidth={STROKE} fill="none" />
      <Circle cx={16} cy={13.6} r={3.2} stroke={color} strokeWidth={STROKE} fill="none" />
      <Path
        d="M9.6 24.8 a6.4 5.4 0 0 1 12.8 0"
        stroke={color}
        strokeWidth={STROKE}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}

// Gear — 8 evenly spaced rectangular teeth around a hollow ring.
// Centred at (16, 16). Inner radius 8.5, outer (tooth tip) radius 11,
// each tooth spans 20° (±10° from its centre angle).
export function IconGear({ size = 30, color = "#FCF6E6" }: IconProps) {
  const d =
    "M24.37 14.52 L26.83 14.09 L26.83 17.91 L24.37 17.48 " +
    "A8.5 8.5 0 0 1 22.96 20.88 L25.01 22.31 L22.31 25.01 L20.88 22.96 " +
    "A8.5 8.5 0 0 1 17.48 24.37 L17.91 26.83 L14.09 26.83 L14.52 24.37 " +
    "A8.5 8.5 0 0 1 11.12 22.96 L9.69 25.01 L6.99 22.31 L9.04 20.88 " +
    "A8.5 8.5 0 0 1 7.63 17.48 L5.17 17.91 L5.17 14.09 L7.63 14.52 " +
    "A8.5 8.5 0 0 1 9.04 11.12 L6.99 9.69 L9.69 6.99 L11.12 9.04 " +
    "A8.5 8.5 0 0 1 14.52 7.63 L14.09 5.17 L17.91 5.17 L17.48 7.63 " +
    "A8.5 8.5 0 0 1 20.88 9.04 L22.31 6.99 L25.01 9.69 L22.96 11.12 " +
    "A8.5 8.5 0 0 1 24.37 14.52 Z";
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <Path
        d={d}
        stroke={color}
        strokeWidth={STROKE}
        strokeLinejoin="round"
        strokeLinecap="round"
        fill="none"
      />
      <Circle cx={16} cy={16} r={3.4} stroke={color} strokeWidth={STROKE} fill="none" />
    </Svg>
  );
}
