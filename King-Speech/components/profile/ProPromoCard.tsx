import React from "react";
import NextChevron from "@/components/NextChevron";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SvgXml } from "react-native-svg";
import type { Theme } from "@/context/ThemeContext";
import { pickLang, type Lang } from "@/context/LangContext";
import { rs } from "@/lib/responsive";
import {
  CROWN_SVG,
  SPARKLE_SVG,
  SPARKLE1_SVG,
  SPARKLE2_SVG,
} from "@/assets/figma/profile/svgs";

// Figma "Card · Подписка (Pro)" (node 128:1130). The card is the same dark
// glass slab in both themes (see the Light instance 12:358).

export default function ProPromoCard({
  theme,
  lang,
  onUpgrade,
}: {
  theme: Theme;
  lang: Lang;
  onUpgrade: () => void;
}) {
  return (
    <View style={styles.card}>
      <LinearGradient
        colors={["rgba(240,238,233,0.12)", "rgba(240,238,233,0)"]}
        style={styles.sheen}
        pointerEvents="none"
      />

      {/* Crown — 14° tilt; frame 71.5×57.6, svg overhangs for its drop shadow */}
      <View style={styles.crownFrame} pointerEvents="none">
        <View style={styles.crownBox}>
          <SvgXml xml={CROWN_SVG} width={rs(99.5318)} height={rs(85.59)} style={styles.crownSvg} />
        </View>
      </View>
      <SvgXml xml={SPARKLE_SVG} width={rs(24)} height={rs(24)} style={[styles.abs, { top: rs(12), right: rs(122) }]} />
      <SvgXml xml={SPARKLE1_SVG} width={rs(21)} height={rs(21)} style={[styles.abs, { top: rs(68), right: rs(5) }]} />
      <SvgXml xml={SPARKLE2_SVG} width={rs(18)} height={rs(18)} style={[styles.abs, { top: rs(58), right: rs(142) }]} />

      <Text style={styles.title}>
        {pickLang(lang, { ru: "Стань королём\nсцены", en: "Become the king\nof the stage", kk: "Сахнаның\nпатшасы болыңыз" })}
      </Text>
      <Text style={styles.sub}>
        {pickLang(lang, { ru: "Все темы и режимы без ограничений", en: "All topics and modes, no limits", kk: "Барлық тақырып пен режим — шексіз" })}
      </Text>

      <Pressable
        onPress={onUpgrade}
        style={({ pressed }) => [
          styles.btn,
          { backgroundColor: theme.accent, borderColor: theme.ctaStroke },
          pressed && { opacity: 0.85 },
        ]}
      >
        <Text style={styles.btnTxt}>{pickLang(lang, { ru: "Улучшить", en: "Upgrade", kk: "Жаңарту" })}</Text>
        <NextChevron color="#262628" size={rs(14)} />
      </Pressable>

      <View style={styles.innerHighlight} pointerEvents="none" />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    height: 150,
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: "#2F2F31",
  },
  abs: { position: "absolute" },
  sheen: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 70,
  },
  crownFrame: {
    position: "absolute",
    top: 6,
    right: 10.65,
    width: 83.3,
    height: 73.2,
    alignItems: "center",
    justifyContent: "center",
  },
  crownBox: {
    width: 71.5,
    height: 57.6,
    transform: [{ rotate: "14deg" }],
  },
  crownSvg: {
    position: "absolute",
    left: -14,
    top: -6,
  },
  title: {
    position: "absolute",
    left: 20,
    top: 38,
    width: 210,
    fontSize: 24,
    lineHeight: 28.8,
    letterSpacing: -0.12,
    fontFamily: "Geologica_900Black",
    color: "#F0EEE9",
  },
  sub: {
    position: "absolute",
    left: 20,
    top: 96,
    width: 170,
    fontSize: 13,
    lineHeight: 15.6,
    fontFamily: "Geologica_600SemiBold",
    color: "rgba(240,238,233,0.7)",
  },
  btn: {
    position: "absolute",
    right: 20,
    top: 86,
    minWidth: 132,
    height: 44,
    paddingHorizontal: 18,
    borderRadius: 32,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  btnTxt: {
    fontSize: 15,
    fontFamily: "Geologica_900Black",
    color: "#262628",
  },
  innerHighlight: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 22,
    borderTopWidth: 1.5,
    borderColor: "rgba(240,238,233,0.22)",
  },
});
