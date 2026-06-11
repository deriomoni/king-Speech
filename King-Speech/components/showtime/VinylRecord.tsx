import React from "react";
import { View, StyleSheet, Platform, type ViewStyle } from "react-native";
import { VinylCover } from "./VinylCovers";

type ShadowStyle = ViewStyle & { boxShadow?: string };

type Props = {
  size: number;
  accentColor: string;
  designIndex: number;
  isCenter?: boolean;
};

function VinylRecordBase({ size, accentColor, designIndex, isCenter }: Props) {
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: 6,
          overflow: "hidden",
        },
        isCenter ? styles.coverShadow : styles.coverShadowSide,
        isCenter ? { shadowColor: accentColor } : null,
      ]}
    >
      <VinylCover size={size} accentColor={accentColor} designIndex={designIndex} />
    </View>
  );
}

const coverShadowCenter: ShadowStyle = Platform.select<ShadowStyle>({
  ios: {
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
  },
  android: { elevation: 10 },
  web: { boxShadow: "0 10px 28px rgba(0,0,0,0.5)" },
  default: {},
}) as ShadowStyle;

const coverShadowSideStyle: ShadowStyle = Platform.select<ShadowStyle>({
  ios: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  android: { elevation: 4 },
  web: { boxShadow: "0 4px 12px rgba(0,0,0,0.4)" },
  default: {},
}) as ShadowStyle;

const styles = StyleSheet.create({
  coverShadow: coverShadowCenter,
  coverShadowSide: coverShadowSideStyle,
});

export const VinylRecord = React.memo(VinylRecordBase);
