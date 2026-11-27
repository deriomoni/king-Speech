import React from "react";
import { Text, StyleSheet, Pressable, Platform, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Defs, RadialGradient, Stop, Circle } from "react-native-svg";
import * as Haptics from "@/lib/haptics";
import type { ThemeMode } from "@/context/ThemeContext";
import { rs } from "@/lib/responsive";

// Figma "Row · …" / "Button · …" tiles on Screen / 04 · Profile (e.g. 391:1169).
// Dark: black glossy vertical gradient, 1pt gradient hairline, soft white
// spotlight at 10% in the top-right. Light: warm white tile, 7% ink hairline,
// bright spotlight. Text is white / #1F1F1F with the subtitle at 55%.
//
// All geometry props (height, text box, spot) are phone-design numbers; they
// are scaled with rs() here, so callers pass raw Figma values.

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

/** Flat colour tile (Wish-app look): one solid colour, no gloss or shadow,
 *  and one oversized "blob" corner. */
export type TilePalette = {
  color: string;
  /** text colour (default white) */
  ink?: string;
  /** soft vertical colour wash over the base (top → bottom) */
  /** solid fill only: no wash and no top-left light */
  flat?: boolean;
  wash?: { colors: readonly [string, string, ...string[]]; locations?: readonly [number, number, ...number[]] };
};

export type BlobCorner = "tl" | "tr" | "bl" | "br";

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
  /** Subtitle may wrap to this many lines (default 1). */
  subLines?: number;
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
  palette,
  radius = RADIUS,
  blob,
}: {
  /** Which corner gets the big rounded "blob" curve, and its radius (Figma px). */
  blob?: { corner: BlobCorner; radius: number };
  /** Corner radius (bento tiles use rounder corners). */
  radius?: number;
  /** Colourful tile (same in both themes) instead of the plain gloss slab. */
  palette?: TilePalette;
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
  if (palette) {
    const ink = palette.ink ?? "#FFFFFF";
    const big = blob ? rs(blob.radius) : radius;
    const corners = {
      borderTopLeftRadius: blob?.corner === "tl" ? big : radius,
      borderTopRightRadius: blob?.corner === "tr" ? big : radius,
      borderBottomLeftRadius: blob?.corner === "bl" ? big : radius,
      borderBottomRightRadius: blob?.corner === "br" ? big : radius,
    };
    return (
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          onPress();
        }}
        style={({ pressed }) => [
          styles.flat,
          corners,
          { height: rs(height), backgroundColor: palette.color },
          pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
          style,
        ]}
      >
        {palette.wash ? (
          <LinearGradient
            pointerEvents="none"
            colors={palette.wash.colors}
            locations={palette.wash.locations}
            style={StyleSheet.absoluteFill}
          />
        ) : null}
        {art}
        <Text
          numberOfLines={1}
          style={[styles.flatTitle, { color: ink, left: rs(text.x - 1), top: rs(text.y - 1), fontSize: rs(text.titleSize) }]}
        >
          {text.title}
        </Text>
        <Text
          numberOfLines={text.subLines ?? 1}
          style={[
            styles.flatSub,
            (text.subLines ?? 1) > 1 && { right: rs(text.x - 1), lineHeight: rs(text.subSize * 1.3) },
            { color: ink, left: rs(text.x - 1), top: rs(text.y - 1 + text.subOffset), fontSize: rs(text.subSize) },
          ]}
        >
          {text.sub}
        </Text>
      </Pressable>
    );
  }
  const look = LOOK[mode];
  const shadow =
    Platform.OS === "web"
      ? ({ boxShadow: `0px ${rs(look.shadow.y)}px ${rs(look.shadow.blur)}px ${look.shadow.color}` } as any)
      : {
          // Opaque fill under the gradients: lets iOS build the shadow from the
          // rounded bounds instead of re-rendering every tile offscreen to find
          // its alpha mask (a real cost with 5 tiles in a scrolling screen).
          backgroundColor: look.fill[2],
          shadowColor: "#000",
          shadowOpacity: look.shadow.opacity,
          shadowRadius: rs(look.shadow.blur / 2),
          shadowOffset: { width: 0, height: rs(look.shadow.y) },
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
        { height: rs(height), borderRadius: radius },
        shadow,
        pressed && { opacity: 0.88, transform: [{ scale: 0.99 }] },
        style,
      ]}
    >
      <LinearGradient colors={look.stroke} locations={[0, 0.5, 1]} style={[styles.stroke, { borderRadius: radius }]}>
        <LinearGradient
          colors={look.fill}
          locations={look.fillLoc}
          start={undefined}
          end={undefined}
          style={[styles.fill, { borderRadius: radius - 1 }]}
        >
                    <Svg
            pointerEvents="none"
            width={rs(spot.size)}
            height={rs(spot.size)}
            viewBox={`0 0 ${spot.size} ${spot.size}`}
            style={{ position: "absolute", left: rs(spot.x - 1), top: rs(spot.y - 1), opacity: look.spotOpacity }}
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
              { color: look.ink, left: rs(text.x - 1), top: rs(text.y - 1), fontSize: rs(text.titleSize) },
            ]}
          >
            {text.title}
          </Text>
          <Text
            numberOfLines={text.subLines ?? 1}
            style={[
              styles.sub,
              (text.subLines ?? 1) > 1 && { right: rs(text.x - 1), lineHeight: rs(text.subSize * 1.3) },
              {
                color: look.ink,
                left: rs(text.x - 1),
                top: rs(text.y - 1 + text.subOffset),
                fontSize: rs(text.subSize),
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
  flat: { overflow: "hidden" },
  flatTitle: { position: "absolute", fontFamily: "Geologica_700Bold", letterSpacing: -0.2 },
  flatSub: { position: "absolute", fontFamily: "Geologica_500Medium", opacity: 0.82 },
});
