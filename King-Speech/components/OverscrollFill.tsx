import React from "react";
import { View } from "react-native";

// iOS rubber-band overscroll reveals whatever sits behind the ScrollView —
// usually the screen container colour, which matched neither the top plate
// nor the bottom of the backing gradient (a black / flat band when the user
// drags past either edge). Drop this as the FIRST child of the ScrollView's
// content: it extends the top plate colour upward and the backing's end colour
// downward, so the screen looks continuous beyond both edges.
//
// The content container must not clip (React Native's default); the views sit
// outside the content box and never take part in layout or touches.
const EXTENT = 3000;

export default function OverscrollFill({ top, bottom }: { top?: string; bottom?: string }) {
  return (
    <>
      {top ? (
        <View
          pointerEvents="none"
          style={{ position: "absolute", left: 0, right: 0, top: -EXTENT, height: EXTENT, backgroundColor: top }}
        />
      ) : null}
      {bottom ? (
        <View
          pointerEvents="none"
          style={{ position: "absolute", left: 0, right: 0, bottom: -EXTENT, height: EXTENT, backgroundColor: bottom }}
        />
      ) : null}
    </>
  );
}
