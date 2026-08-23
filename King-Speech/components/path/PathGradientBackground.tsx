import React from "react";
import { View, StyleSheet } from "react-native";
import type { ThemeMode } from "@/context/ThemeContext";

/**
 * Full-screen SOLID background for the Path ("Путь") screen.
 *
 * One flat color for the whole ladder — the app's own theme background, light
 * in the light theme and dark in the dark theme. It no longer changes from
 * module to module: the curated Path palette still exists and is still used,
 * but only for the level bricks, not for what they sit on.
 */
function PathGradientBackgroundBase({
  color,
}: {
  color: string;
  themeMode: ThemeMode;
}) {
  return (
    <View
      style={[StyleSheet.absoluteFill, { backgroundColor: color }]}
      pointerEvents="none"
    />
  );
}

/** Memoized so it only re-renders when the color / theme change. */
export const PathGradientBackground = React.memo(PathGradientBackgroundBase);
