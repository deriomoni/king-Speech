// Roles mode — "tarot" cards and the dark crown ornament from the Figma redesign
// (Screen / 09 · Роли, node 430:1923; 09b 430:2027; 09c 446:2331).
import React from "react";
import { View, Text, StyleSheet, Platform, type ViewStyle, type StyleProp } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Path, Defs, Pattern, Rect } from "react-native-svg";
import { ROLE_ART } from "@/constants/roleArt";
import { ROLES, tx, type Role } from "@/constants/rolesData";
import type { Lang } from "@/context/LangContext";
import { RolesMaskIcon } from "@/components/showtime/ShowTimeIcons";

// Card labels are IBM Plex Mono Bold in Figma. The font isn't bundled
// (@expo-google-fonts/ibm-plex-mono is not installed) — system monospace instead.
export const MONO = Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }) as string;

export const ROLES_BG = "#141416";
const INK_DARK = "#1E1B22";
const INK_LIGHT = "#F0EEE9";

// Frame palette, assigned per role id (the first five follow the Figma frames).
const FRAME_BY_ROLE: Record<string, string> = {
  "ice-cream": "#FFF3A6",
  comedian: "#0F4A3C",
  weather: "#9AA6EE",
  showman: "#FFB3C7",
  moviestar: "#3B2F55",
  car: "#FF4E42",
  apartment: "#DDE8B0",
  handbag: "#FFB3C7",
  pen: "#2E3A6B",
  beauty: "#E5CBB9",
  humor: "#9AA6EE",
  business: "#0F4A3C",
  cinema: "#3B2F55",
  eco: "#8FA89A",
  cooking: "#C98E6B",
  travel: "#B7BCC8",
  lifestyle: "#FFF3A6",
  barista: "#C98E6B",
  stewardess: "#B7BCC8",
  reception: "#E5CBB9",
  consultant: "#DDE8B0",
  manager: "#2E3A6B",
  host: "#8FA89A",
  "voice-actor": "#FF4E42",
};
const PALETTE = [
  "#FFF3A6", "#0F4A3C", "#3B2F55", "#9AA6EE", "#FF4E42", "#FFB3C7",
  "#E5CBB9", "#8FA89A", "#B7BCC8", "#C98E6B", "#DDE8B0", "#2E3A6B",
];

export function roleFrameColor(id: string): string {
  if (FRAME_BY_ROLE[id]) return FRAME_BY_ROLE[id];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

function isDark(hex: string): boolean {
  const n = parseInt(hex.slice(1), 16);
  const lin = (c: number) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const L = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  return L < 0.32;
}

/** Ink (text / hairline colour) that sits on a role's frame. */
export function roleInk(id: string): string {
  return isDark(roleFrameColor(id)) ? INK_LIGHT : INK_DARK;
}

/** "01".."24" — the role's position in the catalogue. */
export function roleNumber(id: string): string {
  const i = ROLES.findIndex((r) => r.id === id);
  return String(i < 0 ? 0 : i + 1).padStart(2, "0");
}

const PAD = 6;
/** Card geometry shared by all card kinds so grid rows line up. */
export function tarotMetrics(width: number) {
  const artW = width - PAD * 2;
  const artH = Math.round(artW * 0.94);
  const label = Math.max(9, Math.round(width * 0.062));
  const labelH = Math.round(label * 1.3 * 2 + 14); // room for two lines
  return { artW, artH, label, labelH, height: PAD * 2 + artH + labelH, radius: Math.round(width * 0.075) };
}

export function RoleTarotCard({
  role,
  width,
  lang,
  style,
}: {
  role: Role;
  width: number;
  lang: Lang;
  style?: StyleProp<ViewStyle>;
}) {
  const m = tarotMetrics(width);
  const frame = roleFrameColor(role.id);
  const ink = roleInk(role.id);
  const hair = ink === INK_DARK ? "rgba(30,27,34,0.22)" : "rgba(240,238,233,0.22)";
  const src = ROLE_ART[role.id];
  const artRadius = {
    borderTopLeftRadius: m.artW / 2,
    borderTopRightRadius: 6,
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
  };
  return (
    <View style={[{ width, height: m.height, borderRadius: m.radius, backgroundColor: frame, padding: PAD }, style]}>
      <View
        pointerEvents="none"
        style={[styles.innerHair, { borderRadius: m.radius - 3, borderColor: hair }]}
      />
      <View style={[{ width: m.artW, height: m.artH, overflow: "hidden", backgroundColor: "#FFFFFF" }, artRadius]}>
        {src ? <Image source={src} style={{ width: m.artW, height: m.artH }} contentFit="cover" transition={0} /> : null}
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, artRadius, { borderWidth: 1, borderColor: hair }]} />
      </View>
      <Text style={[styles.num, { color: ink, fontSize: Math.max(9, m.label - 1), top: PAD + 3, left: PAD + 4 }]}>
        {roleNumber(role.id)}
      </Text>
      <View style={{ height: m.labelH, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 }}>
        <Text
          style={[styles.label, { color: ink, fontSize: m.label, lineHeight: Math.round(m.label * 1.3) }]}
          numberOfLines={2}
        >
          {tx(role.title, lang).toUpperCase()}
        </Text>
      </View>
    </View>
  );
}

/** Locked role: plain dark gradient, lock, «ЗАКРЫТО». No illustration, no blur. */
export function LockedRoleCard({ width, lang, style }: { width: number; lang: Lang; style?: StyleProp<ViewStyle> }) {
  const m = tarotMetrics(width);
  return (
    <View style={[{ width, height: m.height, borderRadius: m.radius, overflow: "hidden" }, style]}>
      <LinearGradient colors={["#342D52", "#16141F"]} start={{ x: 0, y: 0 }} end={{ x: 0.4, y: 1 }} style={StyleSheet.absoluteFill} />
      <View pointerEvents="none" style={[styles.innerHair, { borderRadius: m.radius - 3, borderColor: "rgba(255,255,255,0.14)" }]} />
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingTop: m.labelH / 2 }}>
        <Ionicons name="lock-closed" size={Math.round(width * 0.17)} color="#FFFFFF" />
      </View>
      <View style={{ height: m.labelH, alignItems: "center", justifyContent: "center" }}>
        <Text style={[styles.label, { color: INK_LIGHT, fontSize: m.label }]}>
          {lang === "en" ? "LOCKED" : "ЗАКРЫТО"}
        </Text>
      </View>
    </View>
  );
}

/** Centre card of the spin deck: violet gradient, white mask, «ROLE PLAY». */
export function RolePlayCard({ width, style }: { width: number; style?: StyleProp<ViewStyle> }) {
  const m = tarotMetrics(width);
  const maskW = Math.round(width * 0.3);
  return (
    <View style={[{ width, height: m.height, borderRadius: m.radius, overflow: "hidden" }, style]}>
      <LinearGradient
        colors={["#C07BFF", "#7A3BF0", "#3A1FD6"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View pointerEvents="none" style={[styles.innerHair, { borderRadius: m.radius - 3, borderColor: "rgba(255,255,255,0.35)" }]} />
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingTop: m.labelH / 3 }}>
        <RolesMaskIcon color="#FFFFFF" width={maskW} height={Math.round(maskW * (307 / 226))} />
      </View>
      <View style={{ height: m.labelH, alignItems: "center", justifyContent: "center" }}>
        <Text style={[styles.label, { color: "#FFFFFF", fontSize: m.label + 1, letterSpacing: 1.5 }]}>ROLE PLAY</Text>
      </View>
    </View>
  );
}

// Logo crown (Figma vector 313:3259), 48.3 × 38.9.
export const CROWN_PATH =
  "M25.58 10.7C25.81 12.65 26.69 14.46 28.07 15.84C29.46 17.22 31.27 18.08 33.21 18.29C35.14 18.5 37.09 18.03 38.74 16.98C40.38 15.92 41.61 14.34 42.24 12.48C41.02 12.2 39.95 11.46 39.26 10.41C38.56 9.36 38.29 8.08 38.5 6.84C38.71 5.59 39.38 4.47 40.38 3.71C41.38 2.95 42.63 2.6 43.87 2.73C45.12 2.87 46.27 3.48 47.08 4.44C47.9 5.4 48.32 6.63 48.26 7.89C48.2 9.15 47.67 10.34 46.76 11.22C45.86 12.1 44.66 12.59 43.41 12.61L43.41 33.18C35.15 40.75 13.11 40.75 4.86 33.18L4.86 12.61C3.61 12.59 2.4 12.1 1.5 11.22C0.6 10.34 0.07 9.15 0.01 7.89C-0.05 6.63 0.37 5.4 1.18 4.44C2 3.48 3.15 2.87 4.39 2.73C5.64 2.6 6.89 2.95 7.89 3.71C8.89 4.47 9.56 5.59 9.77 6.84C9.98 8.08 9.7 9.36 9.01 10.41C8.31 11.46 7.24 12.2 6.02 12.48C6.65 14.34 7.89 15.92 9.53 16.98C11.17 18.03 13.12 18.5 15.06 18.29C17 18.08 18.81 17.22 20.19 15.84C21.58 14.46 22.46 12.65 22.69 10.7C21.42 10.35 20.33 9.55 19.61 8.45C18.89 7.35 18.59 6.02 18.77 4.71C18.95 3.41 19.59 2.21 20.57 1.34C21.56 0.48 22.82 0 24.13 0C25.44 0 26.71 0.48 27.69 1.34C28.68 2.21 29.32 3.41 29.5 4.71C29.67 6.02 29.37 7.35 28.65 8.45C27.93 9.55 26.84 10.35 25.58 10.7Z";

const CROWN_STEP_X = 64;
const CROWN_STEP_Y = 58;
const CROWN_SCALE = 0.5; // ≈24pt crowns
/** Vertical period of the ornament (two staggered rows) — scroll offsets wrap on it. */
export const CROWN_PATTERN_PERIOD = CROWN_STEP_Y * 2;

/**
 * Faint tiled crown ornament (white ~6%, each crown rotated −12°). Drawn as one
 * Svg sized to `width × height`; place it absolutely behind the content.
 *
 * Performance: it used to stamp one <G><Use/></G> per crown — hundreds of SVG
 * nodes for a tall list, re-rendered on every parent state change (the role
 * spin re-rendered it ~30×). Now it is a single <Pattern> tile (3 crowns: one
 * row + the half-offset row, with the wrap-around copy) filling one <Rect>,
 * and the component is memoized. Same layout as before: rows 58pt apart,
 * odd rows shifted half a step, first row at y = 14.
 */
function CrownPatternBase({ width, height, opacity = 0.06 }: { width: number; height: number; opacity?: number }) {
  const pid = "crownTile" + Math.round(opacity * 1000);
  const t = (x: number, y: number) => `translate(${x} ${y}) rotate(-12) scale(${CROWN_SCALE})`;
  const y1 = 14 + CROWN_STEP_Y;
  return (
    <Svg width={width} height={height} style={{ position: "absolute", top: 0, left: 0 }} pointerEvents="none">
      <Defs>
        <Pattern
          id={pid}
          patternUnits="userSpaceOnUse"
          x={0}
          y={0}
          width={CROWN_STEP_X}
          height={CROWN_PATTERN_PERIOD}
        >
          <Path d={CROWN_PATH} fill="#FFFFFF" fillOpacity={opacity} transform={t(10, 14)} />
          <Path d={CROWN_PATH} fill="#FFFFFF" fillOpacity={opacity} transform={t(10 - CROWN_STEP_X / 2, y1)} />
          <Path
            d={CROWN_PATH}
            fill="#FFFFFF"
            fillOpacity={opacity}
            transform={t(10 + CROWN_STEP_X / 2, y1)}
          />
        </Pattern>
      </Defs>
      <Rect x={0} y={0} width={width} height={height} fill={`url(#${pid})`} />
    </Svg>
  );
}

export const CrownPattern = React.memo(CrownPatternBase);

const styles = StyleSheet.create({
  innerHair: { position: "absolute", top: 3, left: 3, right: 3, bottom: 3, borderWidth: 1 },
  num: { position: "absolute", fontFamily: MONO, fontWeight: "700" },
  label: { fontFamily: MONO, fontWeight: "700", textAlign: "center", letterSpacing: 0.5 },
});
