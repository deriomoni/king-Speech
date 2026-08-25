import React from "react";
import Svg, { Path } from "react-native-svg";

/**
 * The King Speech coin — a filled disc with a cut-out emblem (even-odd path).
 * Drop-in replacement for the old Ionicons "disc" glyph; `color` tints the
 * whole mark so it adapts to light/dark surfaces.
 */
export default function CoinIcon({
  size = 16,
  color = "#000000",
  style,
}: {
  size?: number;
  color?: string;
  style?: any;
}) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 897.796 897.796"
      fill="none"
      style={style}
    >
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M448.898 0A448.898 448.898 0 1 1 448.898 897.796A448.898 448.898 0 1 1 448.898 0ZM448.898 255.564L566.601 456.327L724.463 337.23L665.751 640.587L232.046 640.587L173.333 337.23L331.195 456.327Z"
        fill={color}
      />
    </Svg>
  );
}
