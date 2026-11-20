import React from "react";
import Svg, { Path } from "react-native-svg";

/**
 * «>» for «Дальше / Next» buttons: two rounded strokes instead of an arrow.
 * The stroke is weighted to sit with Geologica Bold/ExtraBold labels at 15–17pt
 * (≈ the stem width of the letters), so icon and text read as one line.
 */
export default function NextChevron({ color, size = 14 }: { color: string; size?: number }) {
  const w = (size * 9) / 14;
  const stroke = Math.max(2, (size * 2.3) / 14);
  return (
    <Svg width={w} height={size} viewBox="0 0 9 14">
      <Path
        d="M2 2L7 7L2 12"
        stroke={color}
        strokeWidth={(stroke * 14) / size}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}
