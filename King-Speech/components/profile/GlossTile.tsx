import React from "react";
import { Text, StyleSheet, Pressable, Platform, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Defs, RadialGradient, Stop, Circle } from "react-native-svg";
import * as Haptics from "expo-haptics";
import type { ThemeMode } from "@/context/ThemeContext";

// Figma "Row · …" / "Button · …" tiles on Screen / 04 · Profile (e.g. 391:1169).
// Dark: black glossy vertical gradient, 1pt gradient hairline, soft white
// spotlight at 10% in the top-right. Light: warm white tile, 7% ink hairline,
// bright spotlight. Text is white / #1F1F1F with the subtitle at 55%.

const RADIUS = 26;

const LOOK = {
  dark: {
    fill: ["#2A2A2D", "#151517", "#0B0B0C"] as const,
    fillLoc: [0, 0.55, 1] as const,
    stroke: ["rgba(255,255,255,0.10)", "rgba(255,255,255,0.04)", "rgba(255,255,255,0.08)"] as const,
    spotColor: "#FFFFFF",
    spotOpacity: 0.1,
    spotStop: 0.12,
    ink: "#FFFFFF",
    shadow: { y: 10, blur: 24, color: "rgba(0,0,0,0.22)", opacity: 0.22 },
  },
  light: {
    // #F6F5F2 with a white 70%→0 overlay over the top half.
    fill: ["#FDFDFC", "#F6F5F2", "#F6F5F2"] as const,
    fillLoc: [0, 0.5, 1] as const,
    stroke: ["rgba(38,38,40,0.07)", "rgba(38,38,40,0.07)", "rgba(38,38,40,0.07)"] as const,
    spotColor: "#FFFFFF",
    spotOpacity: 1,
    spotStop: 0.9,
    ink: "#1F1F1F",
    shadow: { y: 6, blur: 18, color: "rgba(0,0,0,0.06)", opacity: 0.06 },
  },
};

export type TileText = {
  title: string;
  sub: string;
  /** Title box origin inside the tile (Figma x/y). */
  x: number;
  y: number;
  titleSize: number;
  subSize: number;
  /** Gap from title top to subtitle top. */
  subOffset: number;
};

export default function GlossTile({
  mode,
  height,
  text,
  spot,
  art,
  onPress,
  style,
  idSuffix,
}: {
  mode: ThemeMode;
  height: number;
  text: TileText;
  /** Spotlight ellipse in tile coords: left, top, size. */
  spot: { x: number; y: number; size: number };
  /** Absolutely positioned illustration. */
  art: React.ReactNode;
  onPress: () => void;
  style?: ViewStyle;
  /** Unique id for the svg gradient (several tiles share the web DOM). */
  idSuffix: string;
}) {
  const look = LOOK[mode];
  const shadow =
    Platform.OS === "web"
      ? ({ boxShadow: `0px ${look.shadow.y}px ${look.shadow.blur}px ${look.shadow.color}` } as any)
      : {
          // Opaque fill under the gradients: lets iOS build the shadow from the
          // rounded bounds instead of re-rendering every tile offscreen to find
          // its alpha mask (a real cost with 5 tiles in a scrolling screen).
          backgroundColor: look.fill[2],
          shadowColor: "#000",
          shadowOpacity: look.shadow.opacity,
          shadowRadius: look.shadow.blur / 2,
          shadowOffset: { width: 0, height: look.shadow.y },
          elevation: mode === "dark" ? 6 : 2,
        };
  const gradId = `glossSpot_${idSuffix}`;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onPress();
      }}
      style={({ pressed }) => [
        styles.outer,
        { height },
        shadow,
        pressed && { opacity: 0.88, transform: [{ scale: 0.99 }] },
        style,
      ]}
    >
      <LinearGradient colors={look.stroke} locations={[0, 0.5, 1]} style={styles.stroke}>
        <LinearGradient colors={look.fill} locations={look.fillLoc} style={styles.fill}>
          <Svg
            pointerEvents="none"
            width={spot.size}
            height={spot.size}
            style={{ position: "absolute", left: spot.x - 1, top: spot.y - 1, opacity: look.spotOpacity }}
          >
            <Defs>
              <RadialGradient id={gradId} cx="50%" cy="50%" r="50%">
                <Stop offset={0} stopColor={look.spotColor} stopOpacity={look.spotStop} />
                <Stop offset={1} stopColor={look.spotColor} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Circle cx={spot.size / 2} cy={spot.size / 2} r={spot.size / 2} fill={`url(#${gradId})`} />
          </Svg>
          {art}
          <Text
            numberOfLines={1}
            style={[
              styles.title,
              { color: look.ink, left: text.x - 1, top: text.y - 1, fontSize: text.titleSize },
            ]}
          >
            {text.title}
          </Text>
          <Text
            numberOfLines={1}
            style={[
              styles.sub,
              {
                color: look.ink,
                left: text.x - 1,
                top: text.y - 1 + text.subOffset,
                fontSize: text.subSize,
              },
            ]}
          >
            {text.sub}
          </Text>
        </LinearGradient>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  outer: { borderRadius: RADIUS },
  stroke: { flex: 1, borderRadius: RADIUS, padding: 1 },
  fill: { flex: 1, borderRadius: RADIUS - 1, overflow: "hidden" },
  title: { position: "absolute", fontFamily: "Geologica_800ExtraBold", letterSpacing: -0.1 },
  sub: { position: "absolute", fontFamily: "Geologica_400Regular", opacity: 0.55 },
});
