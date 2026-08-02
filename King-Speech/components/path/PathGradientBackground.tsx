import React from "react";
import { View, StyleSheet } from "react-native";
import type { ThemeMode } from "@/context/ThemeContext";

/**
 * Full-screen SOLID background for the Path ("Путь") screen — one flat color
 * per module, taken straight from the curated Path palette (already resolved
 * for the active theme by getPathColors). Anchored to a module, so it stays put
 * while scrolling and only changes when the module changes.
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
