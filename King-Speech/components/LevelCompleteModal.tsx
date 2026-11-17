import React, { useEffect } from "react";
import { View, Text, StyleSheet, Pressable, useWindowDimensions } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  cancelAnimation,
  Easing,
  ZoomIn,
  FadeIn,
  FadeInDown,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { SvgXml } from "react-native-svg";
import * as Haptics from "@/lib/haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import RiveAnim from "@/components/RiveAnim";
import {
  RAYS_SVG,
  BANDS_SVG,
  TROPHY_GLOW_SVG,
  SWOOSH_SVG,
  CONFETTI_SVG,
  PODIUM_SVG,
  TROPHY_SVG,
  STAR_ON_SVG,
  STAR_OFF_SVG,
  STAR_GLOW_SVG,
} from "@/assets/figma/victory/victorySvgs";

// ─────────────────────────────────────────────────────────────────────────────
// Level complete — Figma 510:3020 «Victory / Уровень пройден · v2».
// A violet arena: slowly turning sunburst, diagonal light bands, a gold trophy
// on a podium, three stars, a tilted white result card with a «ПРОЙДЕНО!»
// sticker and a chunky gold 3D «Далее» button. The whole 402×874 artboard is
// scaled to fit the screen; the gradient and rays run on past its edges.
// In-tree full-screen overlay (not a RN <Modal>) — see app/level/[id].tsx.
// ─────────────────────────────────────────────────────────────────────────────

const CONFETTI_RIVE = require("@/assets/rive/confetti.riv");

const ART_W = 402;
const ART_H = 874;
const INK = "#2A0A5E";
const GOLD = "#FFD857";
const GOLD_EDGE = "#C98A00";

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

/** one star of the three: lit ones get the gold glow behind them */
function Star({ on, big, rot, delay }: { on: boolean; big?: boolean; rot: number; delay: number }) {
  const w = big ? 72 : 54;
  const h = big ? 70 : 52;
  return (
    <Animated.View entering={ZoomIn.delay(delay).springify().damping(9)} style={{ width: w, height: h, transform: [{ rotate: `${rot}deg` }] }}>
      {on ? (
        <View style={{ position: "absolute", left: w / 2 - 53, top: h / 2 - 53 }} pointerEvents="none">
          <SvgXml xml={STAR_GLOW_SVG} width={106} height={106} />
        </View>
      ) : null}
      <SvgXml xml={on ? STAR_ON_SVG : STAR_OFF_SVG} width={w} height={h} />
    </Animated.View>
  );
}

export default function LevelCompleteModal({ visible, bestScore, durationSec, onNext, onMap, t, lang }: LevelCompleteModalProps) {
  const insets = useSafeAreaInsets();
  const { width: W, height: H } = useWindowDimensions();
  const en = lang === "en";

  // The title breathes and the sunburst turns very slowly.
  const pulse = useSharedValue(1);
  const spin = useSharedValue(0);
  useEffect(() => {
    if (visible) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      pulse.value = withRepeat(withTiming(1.03, { duration: 1100, easing: Easing.inOut(Easing.ease) }), -1, true);
      spin.value = 0;
      spin.value = withRepeat(withTiming(360, { duration: 90000, easing: Easing.linear }), -1, false);
    } else {
      cancelAnimation(pulse);
      cancelAnimation(spin);
      pulse.value = 1;
    }
  }, [visible]);
  const titlePulse = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));
  const raysSpin = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value}deg` }] }));

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

  // Fit the artboard (scaled about its centre), never taller than the screen.
  const k = Math.min(W / ART_W, H / ART_H);
  const artLeft = (W - ART_W) / 2;
  const artTop = (H - ART_H) / 2;
  const artBottom = H / 2 + (ART_H * k) / 2; // screen y of the artboard's bottom edge

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: "#3A0FA8" }]}>
      <LinearGradient colors={["#B44BFF", "#7B2CF0", "#3A0FA8"]} locations={[0, 0.45, 1]} style={StyleSheet.absoluteFill} />
      {/* below the artboard the dark swoosh runs on to the screen edge */}
      <View style={{ position: "absolute", left: 0, right: 0, top: artBottom - 2, bottom: 0, backgroundColor: "#1C0552" }} />

      <View style={{ position: "absolute", left: artLeft, top: artTop, width: ART_W, height: ART_H, transform: [{ scale: k }] }}>
        {/* Background · sunburst, bands, glow, swoosh, confetti bits */}
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Animated.View style={[{ position: "absolute", left: -899, top: -770, width: 2200, height: 2200 }, raysSpin]}>
            <SvgXml xml={RAYS_SVG} width={2200} height={2200} />
          </Animated.View>
          <View style={StyleSheet.absoluteFill}>
            <SvgXml xml={BANDS_SVG} width={ART_W} height={ART_H} />
          </View>
          <View style={{ position: "absolute", left: 31, top: 160 }}>
            <SvgXml xml={TROPHY_GLOW_SVG} width={340} height={340} />
          </View>
          <View style={StyleSheet.absoluteFill}>
            <SvgXml xml={SWOOSH_SVG} width={ART_W} height={ART_H} />
          </View>
          <Animated.View entering={FadeIn.duration(700)} style={StyleSheet.absoluteFill}>
            <SvgXml xml={CONFETTI_SVG} width={ART_W} height={ART_H} />
          </Animated.View>
        </View>

        {/* Title · «Уровень пройден!», tilted, glow + solid purple drop */}
        <Animated.View
          entering={ZoomIn.springify().damping(11)}
          style={{ position: "absolute", left: 201 - 173.9, top: 74.37, width: 347.8, height: 133.2, alignItems: "center", justifyContent: "center" }}
        >
          <View style={{ transform: [{ rotate: "-5deg" }] }}>
            <Animated.View style={titlePulse}>
              <Text style={[s.title, s.titleDrop]}>{t("levelComplete")}</Text>
              <Text style={[s.title, s.titleFace]}>{t("levelComplete")}</Text>
            </Animated.View>
          </View>
        </Animated.View>

        {/* Trophy on its podium */}
        <Animated.View entering={FadeInDown.delay(150).duration(500)} style={{ position: "absolute", left: 101, top: 414 }}>
          <SvgXml xml={PODIUM_SVG} width={200} height={92} />
        </Animated.View>
        <Animated.View entering={ZoomIn.delay(250).springify().damping(10)} style={{ position: "absolute", left: 106, top: 216 }}>
          <SvgXml xml={TROPHY_SVG} width={190} height={210} />
        </Animated.View>

        {/* Stars */}
        <View style={{ position: "absolute", left: 96, top: 535 }}>
          <Star on={stars >= 1} rot={-10} delay={500} />
        </View>
        <View style={{ position: "absolute", left: 165, top: 508 }}>
          <Star on={stars >= 2} big rot={0} delay={620} />
        </View>
        <View style={{ position: "absolute", left: 252, top: 535 }}>
          <Star on={stars >= 3} rot={10} delay={740} />
        </View>

        {/* Result card · tilted white ticket with a solid purple underside */}
        <Animated.View
          entering={FadeInDown.delay(750).duration(450)}
          style={{ position: "absolute", left: 29.3, top: 602.31, width: 343.4, height: 129.5, alignItems: "center", justifyContent: "center" }}
        >
          <View style={{ width: 338, height: 120, transform: [{ rotate: "-3deg" }] }}>
            <View style={[s.cardEdge, { top: 8 }]} />
            <View style={s.card}>
              <Text style={[s.label, { left: 28, top: 28 }]}>{en ? "SCORE" : "ОЦЕНКА"}</Text>
              <View style={s.valueRow}>
                <Text style={s.value}>{scoreStr}</Text>
                <Text style={s.outOf}>/10</Text>
              </View>
              <View style={s.divider} />
              <Text style={[s.label, { left: 194, top: 28 }]}>{en ? "TIME" : "ВРЕМЯ"}</Text>
              <Text style={[s.value, { position: "absolute", left: 192, top: 42 }]}>{timeStr}</Text>
            </View>
          </View>
        </Animated.View>

        {/* «ПРОЙДЕНО!» sticker on the card's top edge */}
        <Animated.View
          entering={ZoomIn.delay(950).springify().damping(9)}
          style={{ position: "absolute", left: 101, top: 595.2, width: 200, height: 42.75, alignItems: "center", justifyContent: "center" }}
          pointerEvents="none"
        >
          <View style={{ transform: [{ rotate: "-3deg" }] }}>
            <View style={s.badgeEdge} />
            <View style={s.badge}>
              <Text style={s.badgeText}>{verdict}</Text>
            </View>
          </View>
        </Animated.View>

        {/* CTA · gold 3D button: the face presses down onto its edge */}
        <Animated.View entering={FadeInDown.delay(1050).duration(450)} style={{ position: "absolute", left: 24, top: 752, width: 354, height: 66 }}>
          <Pressable onPress={onNext} style={{ flex: 1 }}>
            {({ pressed }) => (
              <>
                <View style={s.ctaEdge} />
                <View style={[s.cta, { transform: [{ translateY: pressed ? 4 : 0 }] }]}>
                  <LinearGradient colors={["#FFE27A", "#FFC92E"]} style={StyleSheet.absoluteFill} />
                  <View style={s.ctaShine} />
                  <Text style={s.ctaText}>{en ? "Next →" : "Далее →"}</Text>
                </View>
              </>
            )}
          </Pressable>
        </Animated.View>

        <Animated.View entering={FadeIn.delay(1300)} style={{ position: "absolute", left: 0, right: 0, top: 830, alignItems: "center" }}>
          <Pressable onPress={onMap} hitSlop={12} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
            <Text style={s.exit}>{en ? "Exit" : "Выход"}</Text>
          </Pressable>
        </Animated.View>
      </View>

      {/* Confetti burst from the top edge (Rive) */}
      <View
        style={{ position: "absolute", top: 0, left: 0, right: 0, height: Math.max(210, insets.top + 180), overflow: "hidden" }}
        pointerEvents="none"
      >
        <RiveAnim
          source={CONFETTI_RIVE}
          autoplay
          fit="cover"
          style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 360, backgroundColor: "transparent", transform: [{ scale: 1.19 }] }}
        />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  title: {
    width: 340,
    fontFamily: "Geologica_900Black",
    fontSize: 54,
    lineHeight: 52,
    letterSpacing: -0.81,
    textAlign: "center",
  },
  titleDrop: { position: "absolute", top: 5, left: 0, color: "#4A12B8" },
  titleFace: {
    color: "#FFFFFF",
    textShadowColor: "rgba(255,217,255,0.7)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 22,
  },
  cardEdge: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 112,
    borderRadius: 30,
    backgroundColor: "#1A0548",
    shadowColor: "#1A004D",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.35,
    shadowRadius: 15,
    elevation: 10,
  },
  card: { position: "absolute", left: 0, top: 0, width: 338, height: 112, borderRadius: 30, backgroundColor: "#FFFFFF", elevation: 11 },
  label: { position: "absolute", fontFamily: "Geologica_700Bold", fontSize: 11, letterSpacing: 1.1, color: "rgba(42,10,94,0.5)" },
  valueRow: { position: "absolute", left: 26, top: 42, flexDirection: "row", alignItems: "baseline" },
  value: { fontFamily: "Geologica_900Black", fontSize: 46, letterSpacing: -0.92, color: INK },
  outOf: { fontFamily: "Geologica_700Bold", fontSize: 18, color: "rgba(42,10,94,0.4)", marginLeft: 4 },
  divider: { position: "absolute", left: 168, top: 26, width: 2, height: 62, borderRadius: 1, backgroundColor: "rgba(42,10,94,0.1)" },
  badgeEdge: { position: "absolute", left: 0, right: 0, top: 3, bottom: -3, borderRadius: 16, backgroundColor: GOLD_EDGE },
  badge: {
    backgroundColor: GOLD,
    borderWidth: 3,
    borderColor: "#FFFFFF",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 7,
  },
  badgeText: { fontFamily: "Geologica_900Black", fontSize: 13, letterSpacing: 0.78, color: INK },
  ctaEdge: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 6,
    height: 60,
    borderRadius: 30,
    backgroundColor: GOLD_EDGE,
    shadowColor: "#140040",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 10,
  },
  cta: { height: 60, borderRadius: 30, overflow: "hidden", alignItems: "center", justifyContent: "center", elevation: 11 },
  ctaShine: { position: "absolute", left: 14, right: 14, top: 0, height: 2, borderRadius: 1, backgroundColor: "rgba(255,255,255,0.6)" },
  ctaText: { fontFamily: "Geologica_800ExtraBold", fontSize: 19, color: INK },
  exit: { fontFamily: "Geologica_700Bold", fontSize: 15, color: "rgba(255,255,255,0.6)" },
});
