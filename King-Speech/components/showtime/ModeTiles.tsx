// Figma "Modes · bento" (380:1122) on Screen / 03b · Show Time — full:
// two glossy tiles, «Королевские манеры» (was «Роли», 382:1134) and
// «Подсказки» (382:1147), 236 pt tall,
// radius 28, sitting on the dark backing under the top plate. Same glossy look
// as the Profile tiles (components/profile/GlossTile.tsx): dark = black
// vertical gradient + 1 pt gradient hairline + white spotlight at 10 %;
// light = warm white #F6F5F2 with a white top glaze and dark art.
import React from "react";
import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Defs, RadialGradient, Stop, Circle } from "react-native-svg";
import * as Haptics from "@/lib/haptics";
import MannersMark, { MANNERS_MARK_RATIO } from "@/components/manners/MannersMark";
import { rs } from "@/lib/responsive";
import { pickLang, type Lang } from "@/context/LangContext";

type Mode = "dark" | "light";

const RADIUS = 28;
const HEIGHT = 236;
const SPOT = 220;

const LOOK = {
  dark: {
    fill: ["#2A2A2D", "#151517", "#0B0B0C"] as const,
    fillLoc: [0, 0.55, 1] as const,
    stroke: ["rgba(255,255,255,0.10)", "rgba(255,255,255,0.04)", "rgba(255,255,255,0.08)"] as const,
    spotOpacity: 0.1,
    spotStop: 0.16,
    ink: "#FFFFFF",
    shadow: { y: 10, blur: 24, color: "rgba(0,0,0,0.22)", opacity: 0.22 },
    // art
    mask: "#FFFFFF",
    maskEcho: "rgba(255,255,255,0.22)",
    sheetBack: "rgba(255,255,255,0.16)",
    sheet: "#F4F3EF",
    line: "rgba(24,24,26,0.18)",
    whisper: "#FFFFFF",
    whisperBar: "#18181A",
  },
  light: {
    fill: ["#FDFDFC", "#F6F5F2", "#F6F5F2"] as const,
    fillLoc: [0, 0.5, 1] as const,
    stroke: ["rgba(38,38,40,0.07)", "rgba(38,38,40,0.07)", "rgba(38,38,40,0.07)"] as const,
    spotOpacity: 1,
    spotStop: 0.9,
    ink: "#1F1F1F",
    shadow: { y: 6, blur: 18, color: "rgba(0,0,0,0.06)", opacity: 0.06 },
    mask: "#1F1F1F",
    maskEcho: "rgba(31,31,31,0.22)",
    sheetBack: "rgba(31,31,31,0.16)",
    sheet: "#2A2A2A",
    line: "rgba(226,226,231,0.18)",
    whisper: "#1F1F1F",
    whisperBar: "#E2E2E7",
  },
};

type Look = (typeof LOOK)[Mode];

function ModeTile({
  mode,
  title,
  sub,
  spotX,
  idSuffix,
  onPress,
  children,
  titleLines = 1,
}: {
  mode: Mode;
  title: string;
  /** Two-line titles sit one line higher so the subtitle keeps its place. */
  titleLines?: 1 | 2;
  sub: string;
  /** Spotlight ellipse left edge in tile coords (Figma). */
  spotX: number;
  idSuffix: string;
  onPress: () => void;
  children: React.ReactNode;
}) {
  const look = LOOK[mode];
  const shadow =
    Platform.OS === "web"
      ? ({ boxShadow: `0px ${look.shadow.y}px ${look.shadow.blur}px ${look.shadow.color}` } as any)
      : {
          shadowColor: "#000",
          shadowOpacity: look.shadow.opacity,
          shadowRadius: rs(look.shadow.blur / 2),
          shadowOffset: { width: 0, height: look.shadow.y },
          elevation: mode === "dark" ? 6 : 2,
        };
  const gradId = `modeSpot_${idSuffix}`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={() => {
        if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onPress();
      }}
      style={({ pressed }) => [
        styles.outer,
        shadow,
        pressed && { opacity: 0.88, transform: [{ scale: 0.99 }] },
      ]}
    >
      <LinearGradient colors={look.stroke} locations={[0, 0.5, 1]} style={styles.stroke}>
        <LinearGradient colors={look.fill} locations={look.fillLoc} style={styles.fill}>
          <Svg
            pointerEvents="none"
            width={rs(SPOT)}
            height={rs(SPOT)}
            style={{ position: "absolute", left: rs(spotX - 1), top: rs(-41), opacity: look.spotOpacity }}
          >
            <Defs>
              <RadialGradient id={gradId} cx="50%" cy="50%" r="50%">
                <Stop offset={0} stopColor="#FFFFFF" stopOpacity={look.spotStop} />
                <Stop offset={1} stopColor="#FFFFFF" stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Circle cx={rs(SPOT) / 2} cy={rs(SPOT) / 2} r={rs(SPOT) / 2} fill={`url(#${gradId})`} />
          </Svg>
          {children}
          <Text numberOfLines={titleLines} style={[styles.title, { color: look.ink }, titleLines === 2 && { top: rs(142), right: rs(6), fontSize: rs(17), lineHeight: rs(22) }]}>
            {title}
          </Text>
          <Text numberOfLines={2} style={[styles.sub, { color: look.ink }]}>
            {sub}
          </Text>
        </LinearGradient>
      </LinearGradient>
    </Pressable>
  );
}

// Figma rotation is counter-clockwise around the node's top-left corner;
// RN rotates clockwise, so the sign flips and the origin is pinned top-left.
// (−1 compensates for the 1 pt hairline the fill sits inside.)
function placed(x: number, y: number, w: number, h: number, figmaRot: number) {
  return {
    position: "absolute" as const,
    left: rs(x - 1),
    top: rs(y - 1),
    width: rs(w),
    height: rs(h),
    transformOrigin: "top left",
    transform: [{ rotate: `${-figmaRot}deg` }],
  };
}

// The «Королевские манеры» mark (crown + bow tie), sized like the old crown.
const MARK_H = 84;
const MARK_W = MARK_H * MANNERS_MARK_RATIO;

function MannersArt({ look }: { look: Look }) {
  return (
    <>
      {/* Outlined echo behind */}
      <View pointerEvents="none" style={placed(52, 18, MARK_W, MARK_H, 9)}>
        <MannersMark height={rs(MARK_H)} color={look.maskEcho} outline={look.maskEcho} />
      </View>
      {/* Solid mark */}
      <View pointerEvents="none" style={placed(26, 34, MARK_W, MARK_H, -6)}>
        <MannersMark height={rs(MARK_H)} color={look.mask} />
      </View>
    </>
  );
}

// Script sheet lines (382:1158…1165): [x, y, w].
const LINES_TOP: [number, number, number][] = [
  [12, 16, 64],
  [12, 27, 76],
  [12, 38, 50],
];
const LINES_BOTTOM: [number, number, number][] = [
  [12, 80, 70],
  [12, 91, 52],
  [12, 102, 62],
];

function HintsArt({ look }: { look: Look }) {
  const line = ([x, y, w]: [number, number, number], i: number) => (
    <View
      key={`${x}-${y}-${i}`}
      style={[styles.bar, { left: rs(x), top: rs(y), width: rs(w), backgroundColor: look.line }]}
    />
  );
  return (
    <>
      {/* Translucent sheet behind (382:1156) */}
      <View
        pointerEvents="none"
        style={[placed(50, 46, 100, 118, -9), styles.sheet, { backgroundColor: look.sheetBack }]}
      />
      {/* Script sheet (382:1157) */}
      <View pointerEvents="none" style={[placed(36, 48, 100, 118, 5), styles.sheet, { backgroundColor: look.sheet }]}>
        {LINES_TOP.map(line)}
        {/* Highlighted cue line — two dark dashes, no word (382:1161) */}
        <View style={styles.hint}>
          <View style={[styles.dash, { left: rs(9), width: rs(30) }]} />
          <View style={[styles.dash, { left: rs(44), width: rs(20) }]} />
        </View>
        {LINES_BOTTOM.map(line)}
      </View>
      {/* Whisper badge with 3 sound bars (382:1166) */}
      <View pointerEvents="none" style={[styles.whisper, { backgroundColor: look.whisper }]}>
        <View style={[styles.wbar, { left: rs(11), top: rs(14.5), height: rs(7), backgroundColor: look.whisperBar }]} />
        <View style={[styles.wbar, { left: rs(17), top: rs(11.5), height: rs(13), backgroundColor: look.whisperBar }]} />
        <View style={[styles.wbar, { left: rs(23), top: rs(14.5), height: rs(7), backgroundColor: look.whisperBar }]} />
      </View>
    </>
  );
}

export function ShowTimeModeTiles({
  mode,
  lang,
  onManners,
  onHints,
}: {
  mode: Mode;
  lang: Lang;
  onManners: () => void;
  onHints: () => void;
}) {
  const look = LOOK[mode];
  return (
    <View style={styles.row}>
      <ModeTile
        mode={mode}
        idSuffix="manners"
        spotX={-10}
        titleLines={2}
        title={pickLang(lang, { ru: "Королевские\nманеры", en: "Royal\nmanners", kk: "Корольдік\nәдеп" })}
        sub={pickLang(lang, { ru: "Квиз об этикете", en: "An etiquette quiz", kk: "Әдеп туралы квиз" })}
        onPress={onManners}
      >
        <MannersArt look={look} />
      </ModeTile>
      <ModeTile
        mode={mode}
        idSuffix="hints"
        spotX={-30}
        title={pickLang(lang, { ru: "Подсказки", en: "Hints", kk: "Кеңестер" })}
        sub={pickLang(lang, { ru: "Подскажет, как держать зал", en: "How to hold the room", kk: "Залды қалай ұстауды үйретеді" })}
        onPress={onHints}
      >
        <HintsArt look={look} />
      </ModeTile>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 12 },
  outer: { flex: 1, height: HEIGHT, borderRadius: RADIUS },
  stroke: { flex: 1, borderRadius: RADIUS, padding: 1 },
  fill: { flex: 1, borderRadius: RADIUS - 1, overflow: "hidden" },
  title: {
    position: "absolute",
    left: 17,
    right: 12,
    top: 159,
    fontSize: 22,
    lineHeight: 28,
    fontFamily: "Geologica_800ExtraBold",
    letterSpacing: -0.1,
  },
  sub: {
    position: "absolute",
    left: 17,
    right: 12,
    top: 191,
    fontSize: 12,
    lineHeight: 15,
    fontFamily: "Geologica_400Regular",
    opacity: 0.55,
  },
  sheet: { borderRadius: 12, overflow: "hidden" },
  bar: { position: "absolute", height: 4, borderRadius: 2 },
  hint: {
    position: "absolute",
    left: 10,
    top: 50,
    width: 74,
    height: 20,
    borderRadius: 6,
    backgroundColor: "#FFD857",
  },
  dash: {
    position: "absolute",
    top: 8,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(58,42,5,0.75)",
  },
  whisper: {
    position: "absolute",
    left: 117,
    top: 123,
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  wbar: { position: "absolute", width: 3, borderRadius: 1.5 },
});
