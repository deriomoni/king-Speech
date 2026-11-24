import React, { useState } from "react";
import { Image, View, StyleSheet, type ImageSourcePropType, type StyleProp, type ViewStyle } from "react-native";
import Svg, { ClipPath, Defs, Image as SvgImage, LinearGradient, Path, Rect, Stop } from "react-native-svg";

// A square cover shown in a frame of any shape, cropped around a vertical focus
// point (0 = keep the top, 0.5 = centre, 1 = keep the bottom) — so a wide card
// doesn't cut off the person at the bottom of the picture.
//
// shape="squircle": the theme-catalog cover — a square with straight sides
// and big smooth corners.

let clipSeq = 0;

// Squircle: straight sides, big smooth (superellipse-like) corners.
function squirclePath(w: number, h: number): string {
  const r = Math.min(w, h) * 0.3; // how far each corner reaches along a side
  const t = r * 0.14; // control-point offset from the corner vertex (smaller = squarer)
  const f = (n: number) => n.toFixed(2);
  return [
    `M ${f(r)} 0`,
    `L ${f(w - r)} 0`,
    `C ${f(w - t)} 0 ${w} ${f(t)} ${w} ${f(r)}`,
    `L ${w} ${f(h - r)}`,
    `C ${w} ${f(h - t)} ${f(w - t)} ${h} ${f(w - r)} ${h}`,
    `L ${f(r)} ${h}`,
    `C ${f(t)} ${h} 0 ${f(h - t)} 0 ${f(h - r)}`,
    `L 0 ${f(r)}`,
    `C 0 ${f(t)} ${f(t)} 0 ${f(r)} 0`,
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
  shape?: "rect" | "squircle";
  /** Squircle only: darken from this fraction of the height (0..1) to the bottom, inside the shape. */
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
      {box && shape === "squircle" ? (
        <Svg width={box.w} height={box.h}>
          <Defs>
            <ClipPath id={clipId}>
              <Path d={squirclePath(box.w, box.h)} />
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
              y={box.h * shadeFrom}
              width={box.w}
              height={box.h * (1 - shadeFrom)}
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
