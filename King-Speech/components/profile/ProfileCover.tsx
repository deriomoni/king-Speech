import React, { useId, useState } from "react";
import { View, type LayoutChangeEvent } from "react-native";
import Svg, { ClipPath, Defs, G, LinearGradient, Stop, Path } from "react-native-svg";
import { CoverPatternArt, coverPatternById } from "./coverPatterns";

// Figma "Cover photo" (vector 377:1127) — neutral card banner with a circular
// notch cut around the avatar (bottom-left). Where the notch meets the bottom
// and left edges the cut has smooth rounded fillets. Geometry is the exported
// Figma path (356×126 incl. the 1pt stroke overhang); only the right edge is
// parametrised so the banner stretches with the screen width while the avatar
// notch keeps its exact shape.

export const COVER_HEIGHT = 124;

function coverPath(w: number) {
  // w = outer width of the svg (356 at the design width); R = right edge.
  const R = w - 1;
  return (
    `M25 1H${R - 24}C${R - 10.75} 1 ${R} 11.75 ${R} 25V101C${R} 114.25 ${R - 10.75} 125 ${R - 24} 125` +
    `H137.96C132.13 125 127.14 120.8 126.14 115.06C122.17 92.26 105.04 74 82.54 68.6` +
    `C60.04 63.2 36.48 71.69 22.6 90.2C19.5 94.33 14.11 96.02 9.21 94.38` +
    `C4.31 92.75 1 88.17 1 83V25C1 11.75 11.75 1 25 1Z`
  );
}

export default function ProfileCover({
  fill,
  stroke,
  sheen,
  pattern,
}: {
  fill: string;
  stroke: string;
  /** Colour of the soft top-left sheen (Figma: #F0EEE9 @55% → 0). */
  sheen: string;
  /** Background from the catalogue (null = the plain neutral plate). */
  pattern?: string | null;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const pat = coverPatternById(pattern);
  const [width, setWidth] = useState(354);
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
        height={COVER_HEIGHT + 2}
        viewBox={`0 0 ${svgW} ${COVER_HEIGHT + 2}`}
        style={{ position: "absolute", left: -1, top: -1 }}
      >
        <Defs>
          <LinearGradient
            id={`profileCoverGrad${uid}`}
            x1={-61.93}
            y1={45.08}
            x2={67.55}
            y2={229.92}
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset={0} stopColor={sheen} stopOpacity={pat ? 0.3 : 0.55} />
            <Stop offset={1} stopColor={sheen} stopOpacity={0} />
          </LinearGradient>
          <ClipPath id={`profileCoverClip${uid}`}>
            <Path d={d} />
          </ClipPath>
        </Defs>
        <Path d={d} fill={pat ? pat.bg : fill} />
        {pat && (
          <G clipPath={`url(#profileCoverClip${uid})`}>
            <CoverPatternArt id={pat.id} w={svgW} h={COVER_HEIGHT + 2} uid={uid} />
          </G>
        )}
        <Path d={d} fill={`url(#profileCoverGrad${uid})`} />
        <Path d={d} stroke={stroke} strokeWidth={2} fill="none" />
      </Svg>
    </View>
  );
}
