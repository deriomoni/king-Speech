import React from "react";
import {
  View,
  StyleSheet,
  Image,
  useWindowDimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import type { ThemeMode } from "@/context/ThemeContext";

/** Toggle off to restore the default mesh-gradient Path background. */
export const PATH_LANDSCAPE_BG_EXPERIMENT = true;

/**
 * Full-bleed landscape painting for the Path screen experiment.
 * Image uses cover sizing so it fills any viewport aspect ratio.
 */
export function PathPaintingBackground({ themeMode }: { themeMode: ThemeMode }) {
  const { width, height } = useWindowDimensions();
  const isDark = themeMode === "dark";

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Image
        source={require("@/assets/images/path-landscape-bg.png")}
        style={{ position: "absolute", top: 0, left: 0, width, height }}
        resizeMode="cover"
      />
      <LinearGradient
        colors={
          isDark
            ? [
                "rgba(7,7,10,0.28)",
                "rgba(7,7,10,0.08)",
                "rgba(7,7,10,0.12)",
                "rgba(7,7,10,0.55)",
              ]
            : [
                "rgba(255,255,255,0.38)",
                "rgba(255,255,255,0.12)",
                "rgba(255,255,255,0.06)",
                "rgba(14,14,16,0.32)",
              ]
        }
        locations={[0, 0.28, 0.58, 1]}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}
