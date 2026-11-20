// The one rating star used across the app (everywhere except the «Уровень
// пройден» victory screen, which has its own 3D stars). Rounded corners and
// proportions come from the Figma Show Time star (starOnXml). Filled = gold,
// empty = the same shape as a soft solid tint — no outline variant.
import React from "react";
import Svg, { Path } from "react-native-svg";
import { rs } from "@/lib/responsive";

export const STAR_GOLD = "#FFD857";
const D =
  "M14.532 5.250Q15.000 4.200 15.468 5.250L17.809 10.502Q18.094 11.141 18.790 11.215L24.508 11.818Q25.652 11.939 24.798 12.709L20.526 16.558Q20.006 17.027 20.152 17.711L21.345 23.336Q21.583 24.461 20.587 23.886L15.606 21.014Q15.000 20.664 14.394 21.014L9.413 23.886Q8.417 24.461 8.655 23.336L9.848 17.711Q9.994 17.027 9.474 16.558L5.202 12.709Q4.348 11.939 5.492 11.818L11.210 11.215Q11.906 11.141 12.191 10.502Z";

export default function RoundStar({
  size = rs(24),
  filled = true,
  color = STAR_GOLD,
  emptyColor = "#8C8C96",
  emptyOpacity = 0.28,
  style,
}: {
  size?: number;
  filled?: boolean;
  color?: string;
  emptyColor?: string;
  emptyOpacity?: number;
  style?: any;
}) {
  return (
    // viewBox trimmed to the star's own bounds so `size` is the visible size
    <Svg width={size} height={size} viewBox="3.9 3.2 22.2 22.2" style={style}>
      <Path d={D} fill={filled ? color : emptyColor} fillOpacity={filled ? 1 : emptyOpacity} />
    </Svg>
  );
}
