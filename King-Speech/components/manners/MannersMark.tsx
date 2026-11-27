import React from "react";
import Svg, { Path } from "react-native-svg";
import { BOW, CROWN, SOFTEN, VB_H, VB_W, VB_X, VB_Y } from "@/constants/mannersMark";

// «Королевские манеры» mark: the King Speech app crown with a two-triangle
// bow tie under it (geometry in constants/mannersMark.ts).
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
  const line = outline
    ? { fill: "none", stroke: outline, strokeWidth: outlineWidth * k, strokeLinejoin: "round" as const }
    : null;
  return (
    <Svg width={width} height={height} viewBox={`${VB_X} ${VB_Y} ${VB_W} ${VB_H}`}>
      <Path d={CROWN} {...(line ?? { fill: color })} />
      <Path d={BOW} {...(line ?? { fill: color, stroke: color, strokeWidth: SOFTEN, strokeLinejoin: "round" as const })} />
    </Svg>
  );
}
