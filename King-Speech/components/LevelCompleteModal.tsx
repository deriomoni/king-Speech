import React, { useEffect } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, Dimensions } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  cancelAnimation,
  Easing,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { SvgXml } from "react-native-svg";
import * as Haptics from "@/lib/haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import RiveAnim from "@/components/RiveAnim";
import { useTheme } from "@/context/ThemeContext";
import {
  BEAM_LEFT_SVG,
  BEAM_RIGHT_SVG,
  BEAM_CENTER_SVG,
  HALO_SVG,
  FLOOR_LIGHT_SVG,
  STAR_SMALL_SVG,
  STAR_BIG_SVG,
  TROPHY_SVG,
} from "@/assets/figma/endings/levelCompleteSvgs";

// ─────────────────────────────────────────────────────────────────────────────
// Level complete — Figma 37:5107 "Уровень пройден!" (section 09 · Концовки).
// Stage FX (light beams, halo, floor light) + trophy on an ionic column,
// three stars, a glass result card (score / time) with a verdict badge, gold
// "Далее" CTA and a quiet "Выход" link. In-tree full-screen overlay (not a RN
// <Modal>) — see the note in app/level/[id].tsx.
// ─────────────────────────────────────────────────────────────────────────────

const CONFETTI_RIVE = require("@/assets/rive/confetti.riv");
const SCREEN = Dimensions.get("window");

// Trophy svg is 300×518 with generous filter padding; crop to the drawn area
// (glow included) so it can sit in normal flow.
const TROPHY_W = 220.3;
const TROPHY_H = 310;
const trophyXml = (dark: boolean) =>
  TROPHY_SVG.replace(
    'width="300.305" height="518.07" viewBox="0 0 300.305 518.07"',
    `width="${TROPHY_W}" height="${TROPHY_H}" viewBox="80 208.8 ${TROPHY_W} ${TROPHY_H}"`,
  )
    .replace("{{C0}}", dark ? "#BBBAB7" : "#8F8D88")
    .replace("{{C1}}", dark ? "white" : "#D9D7D2")
    .replace("{{C2}}", dark ? "#EFEDE8" : "#B9B6AF")
    .replace("{{C3}}", dark ? "#A8A399" : "#74706A")
    // Light theme: the black drop shadows under the trophy read as a smudge
    // on the cream background — soften them.
    .replace(/0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 (0\.5|0\.45) 0/g, (m) =>
      dark ? m : "0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.1 0",
    );

const beam = (xml: string, dark: boolean) =>
  xml.replace(/\{\{BEAM\}\}/g, dark ? "#F0EEE9" : "#FFC62D");

function Star({ big, on }: { big?: boolean; on: boolean }) {
  // Box = the star itself (40 / 48); the svg carries its glow padding.
  return big ? (
    <View style={{ width: 48, height: 48, opacity: on ? 1 : 0.22 }}>
      <View style={{ position: "absolute", left: -6.71, top: -7.08 }}>
        <SvgXml xml={STAR_BIG_SVG} width={61.42} height={59.34} />
      </View>
    </View>
  ) : (
    <View style={{ width: 40, height: 40, marginTop: 12, opacity: on ? 1 : 0.22 }}>
      <View style={{ position: "absolute", left: -7.92, top: -8.24 }}>
        <SvgXml xml={STAR_SMALL_SVG} width={55.85} height={54.12} />
      </View>
    </View>
  );
}

export interface LevelCompleteModalProps {
  visible: boolean;
  levelTitle: string;
  xpEarned: number;
  avgScore: number;
  bestScore: number;
  durationSec: number;
  hasNext: boolean;
  onNext: () => void;
  onMap: () => void;
  onClose: () => void;
  colors?: unknown;
  isDark?: boolean;
  t: (key: any) => string;
  lang: "ru" | "en";
  roleBonus?: { emoji: string; title: string; onPlay: () => void } | null;
}

export default function LevelCompleteModal({
  visible,
  bestScore,
  durationSec,
  onNext,
  onMap,
  t,
  lang,
}: LevelCompleteModalProps) {
  const { theme, themeMode } = useTheme();
  const dark = themeMode === "dark";
  const insets = useSafeAreaInsets();
  const en = lang === "en";

  // Only the title breathes; everything else is static (scaling the SVG
  // trophy would rasterize it).
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (visible) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      pulse.value = withRepeat(
        withTiming(1.03, { duration: 1100, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      );
    } else {
      cancelAnimation(pulse);
      pulse.value = 1;
    }
  }, [visible]);
  const titlePulse = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  if (!visible) return null;

  const score = Math.max(0, Math.min(10, bestScore || 0));
  const scoreStr = Number.isInteger(score) ? String(score) : score.toFixed(1);
  const timeStr = `${Math.floor(durationSec / 60)}:${String(Math.floor(durationSec % 60)).padStart(2, "0")}`;
  const stars = score >= 9 ? 3 : score >= 7 ? 2 : 1;
  const verdict =
    score >= 9.5
      ? en ? "PERFECT!" : "ИДЕАЛЬНО!"
      : score >= 8
        ? en ? "GREAT!" : "ОТЛИЧНО!"
        : score >= 6
          ? en ? "GOOD!" : "ХОРОШО!"
          : en ? "PASSED!" : "ПРОЙДЕНО!";

  // Glass card / text tints follow the ink of the active theme.
  const ink = dark ? "240,238,233" : "38,38,40";
  const scoreColor = dark ? theme.accent : theme.accentInk;
  // Title sits at 184/874 of the iPhone 17 frame; never under the status bar.
  const titleTop = Math.max(insets.top + 40, Math.round(SCREEN.height * 0.21));
  const fxLeft = (SCREEN.width - 402) / 2;

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.bg }]}>
      {/* FX · свет и лучи */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <LinearGradient
          colors={[theme.bgSecondary, theme.bgSecondary, dark ? "rgba(50,50,52,0)" : "rgba(244,243,240,0)"]}
          locations={[0, 0.62, 1]}
          style={{ position: "absolute", top: 0, left: 0, right: 0, height: 320 }}
        />
        <View style={{ position: "absolute", top: 0, left: fxLeft, width: 402, height: 600, opacity: dark ? 1 : 0.55 }}>
          <View style={{ position: "absolute", left: 3.37, top: -16.5 }}>
            <SvgXml xml={beam(BEAM_LEFT_SVG, dark)} width={243.27} height={593} />
          </View>
          <View style={{ position: "absolute", left: 155.37, top: -16.5 }}>
            <SvgXml xml={beam(BEAM_RIGHT_SVG, dark)} width={243.27} height={593} />
          </View>
          <View style={{ position: "absolute", left: 149.49, top: -16.5 }}>
            <SvgXml xml={beam(BEAM_CENTER_SVG, dark)} width={103.02} height={553} />
          </View>
        </View>
      </View>

      {/* Confetti pinned to the top edge; only its lower part shows. */}
      <View
        style={{ position: "absolute", top: 0, left: 0, right: 0, height: 210, overflow: "hidden" }}
        pointerEvents="none"
      >
        <RiveAnim
          source={CONFETTI_RIVE}
          autoplay
          fit="cover"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: 360,
            backgroundColor: "transparent",
            transform: [{ scale: 1.19 }],
          }}
        />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          flexGrow: 1,
          alignItems: "center",
          paddingTop: titleTop,
          paddingHorizontal: 24,
          paddingBottom: Math.max(71, insets.bottom + 37),
        }}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <Animated.Text
          style={[
            s.title,
            { color: theme.text, textShadowColor: dark ? "rgba(255,216,87,0.5)" : "rgba(255,198,45,0.45)" },
            titlePulse,
          ]}
        >
          {t("levelComplete")}
        </Animated.Text>

        {/* Trophy + halo + floor light */}
        <View style={{ width: TROPHY_W, height: TROPHY_H, marginTop: -18 }}>
          <View style={{ position: "absolute", left: -39.83, top: -38 }} pointerEvents="none">
            <SvgXml xml={HALO_SVG} width={300} height={300} />
          </View>
          <View style={{ position: "absolute", left: -39.83, top: 243.3 }} pointerEvents="none">
            <SvgXml xml={FLOOR_LIGHT_SVG} width={300} height={60} />
          </View>
          <SvgXml xml={trophyXml(dark)} width={TROPHY_W} height={TROPHY_H} />
        </View>

        {/* Stars */}
        <View style={s.stars}>
          <Star on={stars >= 1} />
          <Star big on={stars >= 2} />
          <Star on={stars >= 3} />
        </View>

        {/* Result card + verdict badge */}
        <View style={{ alignSelf: "stretch", marginTop: 19 }}>
          <View style={[s.card, { borderColor: `rgba(${ink},${dark ? 0.35 : 0.14})` }]}>
            <LinearGradient
              colors={[`rgba(${ink},${dark ? 0.17 : 0.07})`, `rgba(${ink},${dark ? 0.07 : 0.03})`]}
              style={StyleSheet.absoluteFill}
            />
            <View style={s.col}>
              <Text style={[s.label, { color: `rgba(${ink},0.55)` }]}>{en ? "SCORE" : "ОЦЕНКА"}</Text>
              <View style={s.valueRow}>
                <Text
                  style={[
                    s.value,
                    { color: scoreColor, textShadowColor: dark ? "rgba(255,216,87,0.5)" : "transparent", textShadowRadius: 14 },
                  ]}
                >
                  {scoreStr}
                </Text>
                <Text style={[s.outOf, { color: `rgba(${ink},0.5)` }]}>/10</Text>
              </View>
            </View>
            <View style={[s.divider, { backgroundColor: `rgba(${ink},0.12)` }]} />
            <View style={[s.col, { paddingLeft: 23 }]}>
              <Text style={[s.label, { color: `rgba(${ink},0.55)` }]}>{en ? "TIME" : "ВРЕМЯ"}</Text>
              <Text style={[s.value, { color: theme.text }]}>{timeStr}</Text>
            </View>
          </View>
          <View style={s.badgeWrap} pointerEvents="none">
            <View style={[s.badge, { backgroundColor: theme.accent }]}>
              <Text style={[s.badgeText, { color: theme.accentText }]}>{verdict}</Text>
            </View>
          </View>
        </View>

        <View style={{ flex: 1, minHeight: 38 }} />

        <Pressable
          onPress={onNext}
          style={({ pressed }) => [
            s.cta,
            { backgroundColor: theme.accent, borderColor: theme.ctaStroke, opacity: pressed ? 0.9 : 1 },
          ]}
        >
          <Text style={[s.ctaText, { color: theme.accentText }]}>{`${t("nextLevel")}  →`}</Text>
        </Pressable>

        <Pressable onPress={onMap} hitSlop={10} style={({ pressed }) => [{ marginTop: 18, opacity: pressed ? 0.6 : 1 }]}>
          <Text style={[s.exit, { color: `rgba(${ink},0.5)` }]}>{en ? "Exit" : "Выход"}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  title: {
    fontFamily: "Geologica_900Black",
    fontSize: 34,
    letterSpacing: -0.34,
    textAlign: "center",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 22,
    zIndex: 2,
  },
  stars: { flexDirection: "row", alignItems: "flex-start", gap: 11, marginTop: -24 },
  card: {
    height: 104,
    borderRadius: 22,
    borderWidth: 4,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
  },
  col: { flex: 1, paddingLeft: 20, justifyContent: "center" },
  label: { fontFamily: "Geologica_900Black", fontSize: 11, letterSpacing: 0.55 },
  valueRow: { flexDirection: "row", alignItems: "flex-end" },
  value: {
    fontFamily: "Geologica_900Black",
    fontSize: 40,
    letterSpacing: -0.8,
    marginTop: 2,
    textShadowOffset: { width: 0, height: 0 },
  },
  outOf: { fontFamily: "Geologica_900Black", fontSize: 18, letterSpacing: -0.09, marginLeft: 9, marginBottom: 7 },
  divider: { width: 1, height: 60 },
  badgeWrap: { position: "absolute", top: -13, left: 0, right: 0, alignItems: "center" },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 32,
    shadowColor: "#FFD857",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 6,
  },
  badgeText: { fontFamily: "Geologica_900Black", fontSize: 11, letterSpacing: 0.55 },
  cta: {
    alignSelf: "stretch",
    height: 58,
    borderRadius: 32,
    borderWidth: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: { fontFamily: "Geologica_900Black", fontSize: 18, letterSpacing: -0.09 },
  exit: { fontFamily: "Geologica_800ExtraBold", fontSize: 15, textAlign: "center" },
});
