import React, { useId, useState } from "react";
import { View, type LayoutChangeEvent } from "react-native";
import Svg, { ClipPath, Defs, G, Image as SvgImage, LinearGradient, Stop, Path } from "react-native-svg";
import { coverPatternById } from "./coverPatterns";
import { CROWN_PATH } from "@/components/roles/RoleTarotCard";

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

/**
 * The default («Без узора») plate: the King Speech logo crown tiled faintly in
 * the plate's own ink, every crown turned −12° on a half-drop grid — the same
 * ornament as the Roles screen, so the plain plate still feels branded.
 */
export function NeutralCrowns({ w, h, ink, opacity = 0.07 }: { w: number; h: number; ink: string; opacity?: number }) {
  const out: React.ReactNode[] = [];
  const dx = 44;
  const dy = 38;
  for (let col = 0, x = 14; x < w + dx; col++, x += dx) {
    for (let y = 16 + (col % 2 ? dy / 2 : 0) - dy; y < h + dy; y += dy) {
      out.push(
        <Path
          key={`${col}_${y}`}
          d={CROWN_PATH}
          fill={ink}
          fillOpacity={opacity}
          transform={`translate(${x} ${y}) rotate(-12) scale(0.4) translate(-24.13 -19)`}
        />,
      );
    }
  }
  return <G>{out}</G>;
}

/** Small preview of the plain plate (catalogue thumbnail), drawn at the design size. */
export function PlainPlateThumb({ fill, ink, stroke }: { fill: string; ink: string; stroke: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const d = coverPath(356);
  return (
    <Svg width="100%" height="100%" viewBox="0 0 356 126">
      <Defs>
        <ClipPath id={`plainThumb${uid}`}>
          <Path d={d} />
        </ClipPath>
      </Defs>
      <Path d={d} fill={fill} />
      <G clipPath={`url(#plainThumb${uid})`}>
        <NeutralCrowns w={356} h={126} ink={ink} />
      </G>
      <Path d={d} stroke={stroke} strokeWidth={2} fill="none" />
    </Svg>
  );
}

export default function ProfileCover({
  fill,
  stroke,
  sheen,
  pattern,
  ink = "#FFFFFF",
}: {
  fill: string;
  stroke: string;
  /** Colour of the faint crown ornament on the plain plate (theme text colour). */
  ink?: string;
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
            {/* artwork is the plate itself (356×126); anchor top-left so the notch lines up */}
            <SvgImage
              href={pat.image}
              x={0}
              y={0}
              width={svgW}
              height={COVER_HEIGHT + 2}
              preserveAspectRatio="xMinYMin slice"
            />
          </G>
        )}
        {!pat && (
          <G clipPath={`url(#profileCoverClip${uid})`}>
            <NeutralCrowns w={svgW} h={COVER_HEIGHT + 2} ink={ink} />
          </G>
        )}
        {!pat && <Path d={d} fill={`url(#profileCoverGrad${uid})`} />}
        <Path d={d} stroke={stroke} strokeWidth={2} fill="none" />
      </Svg>
    </View>
  );
}
