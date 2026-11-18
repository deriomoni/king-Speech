// The one recording control used across the app: a gold circle with a flat
// glyph. record / play = rounded triangle (start / resume), pause = two
// rounded bars, stop = rounded square.
// `RecDot` is the same start triangle for pills that start a recording with a label.
import React from "react";
import { View, Pressable, StyleSheet, ViewStyle } from "react-native";
import Svg, { Path } from "react-native-svg";

export const REC_GOLD = "#FFD857";
export const REC_RED = "#FF4B3E";
const INK = "#2A1C02";
const TRI = "M6 4.2C6 2.7 7.6 1.8 8.9 2.6L21.1 10.3C22.3 11.1 22.3 12.9 21.1 13.7L8.9 21.4C7.6 22.2 6 21.3 6 19.8Z";

export type RecKind = "record" | "pause" | "stop" | "play";

export function RecGlyph({ kind, size }: { kind: RecKind; size: number }) {
  if (kind === "stop") {
    const w = size * 0.31;
    return <View style={{ width: w, height: w, borderRadius: w * 0.26, backgroundColor: INK }} />;
  }
  if (kind === "pause") {
    const h = size * 0.34;
    const bw = size * 0.105;
    return (
      <View style={{ flexDirection: "row", gap: bw * 0.8 }}>
        <View style={{ width: bw, height: h, borderRadius: bw / 2, backgroundColor: INK }} />
        <View style={{ width: bw, height: h, borderRadius: bw / 2, backgroundColor: INK }} />
      </View>
    );
  }
  // record / play: rounded triangle, nudged right to sit optically centred
  const t = size * 0.36;
  return (
    <Svg width={t} height={t} viewBox="0 0 24 24" style={{ marginLeft: t * 0.14 }}>
      <Path d={TRI} fill={INK} />
    </Svg>
  );
}

/** Start mark for labelled pills: the same rounded triangle as the round button. */
export function RecDot({ size = 14, color = INK }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={TRI} fill={color} />
    </Svg>
  );
}

export default function RecButton({
  kind,
  size = 64,
  onPress,
  disabled,
  accessibilityLabel,
  style,
  testID,
}: {
  kind: RecKind;
  size?: number;
  onPress?: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: ViewStyle;
  testID?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      style={({ pressed }) => [
        s.btn,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          opacity: disabled ? 0.5 : 1,
          transform: [{ scale: pressed && !disabled ? 0.94 : 1 }],
        },
        style,
      ]}
    >
      <RecGlyph kind={kind} size={size} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  btn: {
    backgroundColor: REC_GOLD,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "rgba(42,28,2,0.10)",
  },
});
