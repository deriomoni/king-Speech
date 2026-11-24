import React from "react";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { BALLS, BALL_R, CROWN, KNOT, VB_H, VB_W, VB_X, VB_Y, WING_LEFT, WING_RIGHT } from "@/constants/mannersMark";

// «Королевские манеры» mark: the King Speech crown wearing a bow tie
// (geometry in constants/mannersMark.ts).
export const MANNERS_MARK_RATIO = VB_W / VB_H; // width / height

export default function MannersMark({
  height,
  color,
  outline,
  outlineWidth = 1.5,
}: {
  /** Rendered height; width follows the mark's proportions. */
  height: number;
  color: string;
  /** Draw only the contour in this colour (the faint «echo» on the mode tile). */
  outline?: string;
  outlineWidth?: number;
}) {
  const width = height * MANNERS_MARK_RATIO;
  const k = VB_H / height; // view-box units per point
  const paint = outline
    ? { fill: "none", stroke: outline, strokeWidth: outlineWidth * k, strokeLinejoin: "round" as const }
    : { fill: color };
  return (
    <Svg width={width} height={height} viewBox={`${VB_X} ${VB_Y} ${VB_W} ${VB_H}`}>
      {BALLS.map(([cx, cy]) => (
        <Circle key={cx} cx={cx} cy={cy} r={BALL_R} {...paint} />
      ))}
      <Path d={CROWN} {...paint} />
      <Path d={WING_LEFT} {...paint} />
      <Path d={WING_RIGHT} {...paint} />
      <Rect x={KNOT.x} y={KNOT.y} width={KNOT.w} height={KNOT.h} rx={KNOT.r} {...paint} />
    </Svg>
  );
}

