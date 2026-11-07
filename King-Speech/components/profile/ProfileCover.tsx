import React, { useState } from "react";
import { View, type LayoutChangeEvent } from "react-native";
import Svg, { Defs, LinearGradient, Stop, Path } from "react-native-svg";

// Figma "Cover photo" (node 308:3365) — the gold→card gradient banner with the
// circular notch cut around the avatar (bottom-left). Geometry is the exported
// Figma path (assets/figma/profile/cover.svg, 358×128 incl. a 1pt stroke
// overhang); only the right edge is parametrised so the banner stretches with
// the screen width while the avatar notch keeps its exact shape.

export const COVER_HEIGHT = 126;

function coverPath(w: number) {
  // w = outer width of the exported svg (358 at the design width).
  const R = w - 1; // right edge of the shape (357)
  return (
    `M${R - 23} 1C${R - 10.297} 1 ${R} 11.2975 ${R} 24V104C${R} 116.703 ${R - 10.297} 127 ${R - 23} 127` +
    `H127.99C127.996 126.667 128 126.334 128 126C128 93.9675 102.033 68 70 68C38.7535 68 13.2782 92.7088 12.0469 123.653` +
    `C5.42296 119.616 1 112.325 1 104V24C1 11.2975 11.2975 1 24 1H${R - 23}Z`
  );
}

export default function ProfileCover({
  fill,
  stroke,
  gold,
}: {
  fill: string;
  stroke: string;
  gold: string;
}) {
  const [width, setWidth] = useState(356);
  const onLayout = (e: LayoutChangeEvent) => {
    const w = Math.round(e.nativeEvent.layout.width);
    if (w > 0 && w !== width) setWidth(w);
  };
  const svgW = width + 2;
  const d = coverPath(svgW);
  return (
    <View style={{ height: COVER_HEIGHT }} onLayout={onLayout}>
      <Svg
        width={svgW}
        height={128}
        viewBox={`0 0 ${svgW} 128`}
        style={{ position: "absolute", left: -1, top: -1 }}
      >
        <Defs>
          <LinearGradient
            id="profileCoverGrad"
            x1={-62.2889}
            y1={45.8}
            x2={69.7515}
            y2={232.333}
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset={0} stopColor={gold} stopOpacity={0.55} />
            <Stop offset={1} stopColor={gold} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Path d={d} fill={fill} />
        <Path d={d} fill="url(#profileCoverGrad)" />
        <Path d={d} stroke={stroke} strokeWidth={2} fill="none" />
      </Svg>
    </View>
  );
}
