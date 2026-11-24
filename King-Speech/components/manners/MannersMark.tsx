import React from "react";
import Svg, { Circle, Path, Rect } from "react-native-svg";

// «Королевские манеры» mark: the King Speech crown wearing a bow tie.
// Clean geometric rebuild (symmetric, one even gap between crown, wings and
// knot) of the generated logo in «Лого Королевские манеры/wrap-3.png».
const VB_X = 232, VB_Y = 170, VB_W = 560, VB_H = 686;
export const MANNERS_MARK_RATIO = VB_W / VB_H; // width / height

const CROWN =
  "M 266 366 C 296 412 340 416 378 416 C 430 416 482 372 504 293 L 520 293 C 542 372 594 416 646 416 C 684 416 728 412 758 366 L 758 586 Q 758 592 752 594 L 578 653 L 446 653 L 272 594 Q 266 592 266 586 Z";
const WING_L =
  "M 432 667.26 L 292 619.82 C 259 607.82 237 637.82 237 675.82 L 237 788 C 237 838 263 856 296 848 L 432 790 Z";
const WING_R =
  "M 592 667.26 L 732 619.82 C 765 607.82 787 637.82 787 675.82 L 787 788 C 787 838 761 856 728 848 L 592 790 Z";

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
      <Circle cx={512} cy={225} r={50} {...paint} />
      <Circle cx={282} cy={296} r={52} {...paint} />
      <Circle cx={742} cy={296} r={52} {...paint} />
      <Path d={CROWN} {...paint} />
      <Path d={WING_L} {...paint} />
      <Path d={WING_R} {...paint} />
      <Rect x={450} y={671} width={124} height={119} rx={28} {...paint} />
    </Svg>
  );
}
