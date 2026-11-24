import React, { useState } from "react";
import { Image, View, StyleSheet, type ImageSourcePropType, type StyleProp, type ViewStyle } from "react-native";
import Svg, { ClipPath, Defs, Image as SvgImage, LinearGradient, Path, Rect, Stop } from "react-native-svg";

// A square cover shown in a frame of any shape, cropped around a vertical focus
// point (0 = keep the top, 0.5 = centre, 1 = keep the bottom) — so a wide card
// doesn't cut off the person at the bottom of the picture.
//
// shape="pillow": the theme-catalog tile — big soft corners and edges that
// bow slightly outward (a squircle «pillow»). Corner size comes from the
// shorter side, so wide frames keep round, not stretched, corners.

let clipSeq = 0;

function pillowPath(w: number, h: number): string {
  const m = Math.min(w, h);
  const r = m * 0.3; // corner reach along each edge
  const b = m * 0.035; // how far the edges bow out past the corners
  const k = r * 0.08; // corner tightness (lower = rounder, smoother)
  const f = (n: number) => n.toFixed(2);
  return [
    `M ${f(r)} ${f(b)}`,
    // top edge, bowing up to y = 0
    `C ${f(r + (w - 2 * r) / 3)} 0 ${f(w - r - (w - 2 * r) / 3)} 0 ${f(w - r)} ${f(b)}`,
    // top-right corner
    `C ${f(w - b - k)} ${f(b)} ${f(w - b)} ${f(b + k)} ${f(w - b)} ${f(r)}`,
    // right edge
    `C ${w} ${f(r + (h - 2 * r) / 3)} ${w} ${f(h - r - (h - 2 * r) / 3)} ${f(w - b)} ${f(h - r)}`,
    // bottom-right corner
    `C ${f(w - b)} ${f(h - b - k)} ${f(w - b - k)} ${f(h - b)} ${f(w - r)} ${f(h - b)}`,
    // bottom edge
    `C ${f(w - r - (w - 2 * r) / 3)} ${h} ${f(r + (w - 2 * r) / 3)} ${h} ${f(r)} ${f(h - b)}`,
    // bottom-left corner
    `C ${f(b + k)} ${f(h - b)} ${f(b)} ${f(h - b - k)} ${f(b)} ${f(h - r)}`,
    // left edge
    `C 0 ${f(h - r - (h - 2 * r) / 3)} 0 ${f(r + (h - 2 * r) / 3)} ${f(b)} ${f(r)}`,
    // top-left corner
    `C ${f(b)} ${f(b + k)} ${f(b + k)} ${f(b)} ${f(r)} ${f(b)}`,
    "Z",
  ].join(" ");
}

export default function CoverImage({
  source,
  focusY = 0.5,
  shape = "rect",
  shadeFrom,
  style,
}: {
  source: ImageSourcePropType;
  focusY?: number;
  shape?: "rect" | "pillow";
  /** Pillow only: darken from this y (px) to the bottom, inside the shape (for text on top). */
  shadeFrom?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const [clipId] = useState(() => `coverClip${++clipSeq}`);
  const side = box ? Math.max(box.w, box.h) : 0;
  const left = box ? (box.w - side) / 2 : 0;
  const top = box ? -(side - box.h) * Math.max(0, Math.min(1, focusY)) : 0;
  return (
    <View
      style={[StyleSheet.absoluteFill, { overflow: "hidden" }, style]}
      pointerEvents="none"
      onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
      {box && shape === "pillow" ? (
        <Svg width={box.w} height={box.h}>
          <Defs>
            <ClipPath id={clipId}>
              <Path d={pillowPath(box.w, box.h)} />
            </ClipPath>
            {shadeFrom != null ? (
              <LinearGradient id={clipId + "shade"} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#000" stopOpacity={0} />
                <Stop offset="1" stopColor="#000" stopOpacity={0.6} />
              </LinearGradient>
            ) : null}
          </Defs>
          <SvgImage
            href={source}
            x={left}
            y={top}
            width={side}
            height={side}
            preserveAspectRatio="xMidYMid slice"
            clipPath={`url(#${clipId})`}
          />
          {shadeFrom != null ? (
            <Rect
              x={0}
              y={shadeFrom}
              width={box.w}
              height={Math.max(0, box.h - shadeFrom)}
              fill={`url(#${clipId}shade)`}
              clipPath={`url(#${clipId})`}
            />
          ) : null}
        </Svg>
      ) : box ? (
        <Image
          source={source}
          resizeMode="cover"
          style={{ position: "absolute", width: side, height: side, left, top }}
        />
      ) : null}
    </View>
  );
}
