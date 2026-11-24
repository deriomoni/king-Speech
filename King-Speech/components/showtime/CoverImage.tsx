import React, { useState } from "react";
import { Image, View, StyleSheet, type ImageSourcePropType, type StyleProp, type ViewStyle } from "react-native";

// A square cover shown in a frame of any shape, cropped around a vertical focus
// point (0 = keep the top, 0.5 = centre, 1 = keep the bottom) — so a wide card
// doesn't cut off the person at the bottom of the picture.
export default function CoverImage({
  source,
  focusY = 0.5,
  style,
}: {
  source: ImageSourcePropType;
  focusY?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const side = box ? Math.max(box.w, box.h) : 0;
  return (
    <View
      style={[StyleSheet.absoluteFill, { overflow: "hidden" }, style]}
      pointerEvents="none"
      onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
      {box ? (
        <Image
          source={source}
          resizeMode="cover"
          style={{
            position: "absolute",
            width: side,
            height: side,
            left: (box.w - side) / 2,
            top: -(side - box.h) * Math.max(0, Math.min(1, focusY)),
          }}
        />
      ) : null}
    </View>
  );
}
