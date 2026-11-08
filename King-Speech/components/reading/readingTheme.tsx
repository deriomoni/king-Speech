import React from "react";
import { View, StyleSheet, type ViewStyle, type StyleProp } from "react-native";
import { BlurView } from "expo-blur";
import Svg, { Defs, RadialGradient, Stop, Rect, LinearGradient as SvgLinear } from "react-native-svg";

// ─────────────────────────────────────────────────────────────────────────────
// Reading level — shared look (Figma 34:980 "06 · Уровень 5 · Чтение").
//
// The reading flow runs on a neutral "night page" (#0E0E10 in dark, the app
// background in light). The MODULE colour (getModuleColor via getPathColors
// .brick) tints exactly three things: the current line, the progress fill and
// the "ТВОЯ ЗАПИСЬ" kicker. Figma's five demo frames (Терракота, Охра, Олива,
// Пыльный синий, Слива) show HOW it is tinted: the raw module colour is lifted
// to a light tone on the dark page (#E7725B → #F08A73, #6798BF → #8DB8DE) —
// here we pull it the other way (deeper) on the light page so it stays legible.
// ─────────────────────────────────────────────────────────────────────────────

/** Figma `bg` of the dark reading frames (312:4346 … 312:4496). */
export const READING_BG_DARK = "#0E0E10";

function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v;
}
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
    else if (max === g) h = ((b - r) / d + 2) * 60;
    else h = ((r - g) / d + 4) * 60;
  }
  return [h, s, l];
}
function hslToHex(h: number, s: number, l: number): string {
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hk = h / 360;
  const ch = (x: number) => {
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    let v: number;
    if (x < 1 / 6) v = p + (q - p) * 6 * x;
    else if (x < 1 / 2) v = q;
    else if (x < 2 / 3) v = p + (q - p) * (2 / 3 - x) * 6;
    else v = p;
    return clamp(Math.round(v * 255), 0, 255).toString(16).padStart(2, "0");
  };
  if (s === 0) {
    const g = ch(0);
    return `#${g}${g}${g}`;
  }
  return `#${ch(hk + 1 / 3)}${ch(hk)}${ch(hk - 1 / 3)}`;
}

/**
 * Module colour → the reading tint for the current theme. Dark: lightness is
 * lifted to ≥ 0.70 (matches the Figma demo frames). Light: lightness capped at
 * 0.42 so the tinted line still reads on #FAF9F6.
 */
export function readingTint(moduleColor: string, isDark: boolean): string {
  const [r, g, b] = hexToRgb(moduleColor);
  const [h, s, l] = rgbToHsl(r, g, b);
  return isDark ? hslToHex(h, s, Math.max(l, 0.7)) : hslToHex(h, clamp(s, 0, 0.75), Math.min(l, 0.42));
}

/** `rgba()` of a hex colour. */
export function withAlpha(hex: string, a: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

/** Ink of the reading page at a given opacity (#F0EEE9 dark / #262628 light). */
export function readingInk(isDark: boolean, a = 1): string {
  return isDark ? `rgba(240,238,233,${a})` : `rgba(38,38,40,${a})`;
}

/**
 * Figma "Dialog / Liquid Glass" frame (37:2876 «Узнать больше»): frosted fill,
 * soft gold glow behind the heading, faint top sheen, 4pt pale rim, 32pt corners.
 * Children are laid out inside the padded card.
 */
export function ReadingGlassCard({
  isDark,
  style,
  children,
}: {
  isDark: boolean;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  const [size, setSize] = React.useState({ w: 346, h: 400 });
  const cardFill = isDark ? "rgba(52,52,53,0.82)" : "rgba(250,249,246,0.94)";
  const rim = isDark ? "rgba(240,238,233,0.26)" : "rgba(38,38,40,0.10)";
  return (
    <View style={styles.shadowWrap}>
      <View
        onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
        style={[styles.card, { borderColor: rim }, style]}
      >
        <BlurView
          intensity={40}
          tint={isDark ? "dark" : "light"}
          experimentalBlurMethod="dimezisBlurView"
          style={StyleSheet.absoluteFill}
        />
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: cardFill }]} />
        <Svg pointerEvents="none" width={size.w} height={size.h} style={styles.glow}>
          <Defs>
            <RadialGradient
              id="rgGlow"
              cx={size.w / 2}
              cy={size.h * 0.28}
              rx={size.w * 0.38}
              ry={size.h * 0.32}
              gradientUnits="userSpaceOnUse"
            >
              <Stop offset="0" stopColor="#FFEDA8" stopOpacity={isDark ? 0.14 : 0.2} />
              <Stop offset="1" stopColor="#FFEDA8" stopOpacity={0} />
            </RadialGradient>
            <SvgLinear id="rgSheen" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={isDark ? "#F0EEE9" : "#FFFFFF"} stopOpacity={isDark ? 0.06 : 0.5} />
              <Stop offset="0.5" stopColor={isDark ? "#F0EEE9" : "#FFFFFF"} stopOpacity={0} />
            </SvgLinear>
          </Defs>
          <Rect x="0" y="0" width={size.w} height={size.h} fill="url(#rgSheen)" />
          <Rect x="0" y="0" width={size.w} height={size.h} fill="url(#rgGlow)" />
        </Svg>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shadowWrap: {
    width: "100%",
    maxWidth: 346,
    borderRadius: 32,
    shadowColor: "#000",
    shadowOpacity: 0.6,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 24 },
    elevation: 16,
  },
  card: { borderRadius: 32, borderWidth: 4, overflow: "hidden" },
  glow: { position: "absolute", top: 0, left: 0 },
});
