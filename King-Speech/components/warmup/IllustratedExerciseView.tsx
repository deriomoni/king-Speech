import React from "react";
import NextChevron from "@/components/NextChevron";
import { View, Text, StyleSheet, Pressable, useWindowDimensions } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/context/ThemeContext";
import { useLang, pickLang } from "@/context/LangContext";
import { warmupFonts } from "@/components/warmup/warmupTheme";
import { rs } from "@/lib/responsive";
import IllustratedDrill, { ILLUSTRATED_EXERCISES, type IllustratedExercise } from "@/components/warmup/IllustratedDrill";

export { ILLUSTRATED_EXERCISES };
export type { IllustratedExercise };

interface Props {
  exercise: IllustratedExercise;
  /** 0-based position and count, for the step segments at the top. */
  index: number;
  count: number;
  topPad: number;
  onDone: () => void;
  onSkip: () => void;
  onBack: () => void;
}

/**
 * One illustrated mouth warm-up exercise (Figma portraits): name, one how-to
 * line, the animated portrait with the rhythm word, and «Пропустить».
 */
export default function IllustratedExerciseView({ exercise, index, count, topPad, onDone, onSkip, onBack }: Props) {
  const { theme } = useTheme();
  const { lang } = useLang();
  const { height: winH } = useWindowDimensions();
  // Portrait height: Figma draws them ~310pt tall; keep room for the texts.
  const artH = Math.min(rs(300), winH * 0.4);

  return (
    <View style={[styles.root, { backgroundColor: theme.bg, paddingTop: topPad + rs(8) }]}>
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={12} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={rs(24)} color={theme.textSecondary} />
        </Pressable>
        <View style={styles.segs}>
          {Array.from({ length: count }).map((_, k) => (
            <View
              key={k}
              style={[
                styles.seg,
                { backgroundColor: k < index ? theme.text : k === index ? theme.accent : theme.text + "1F" },
              ]}
            />
          ))}
        </View>
        <Text style={[styles.count, { color: theme.textMuted }]}>
          {index + 1} / {count}
        </Text>
      </View>

      <View style={styles.center}>
        <Animated.View key={exercise.key} entering={FadeIn.duration(320)} style={styles.texts}>
          <Text style={[styles.title, { color: theme.text }]}>{pickLang(lang, exercise.title)}</Text>
          <Text style={[styles.desc, { color: theme.textSecondary }]}>{pickLang(lang, exercise.desc)}</Text>
        </Animated.View>
        <IllustratedDrill key={`drill-${exercise.key}`}exercise={exercise} lang={lang} height={artH} onDone={onDone} />
      </View>

      <View style={styles.footer}>
        <Pressable onPress={onSkip} hitSlop={8} style={styles.skip}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: rs(6) }}>
            <Text style={[styles.skipText, { color: theme.textMuted }]}>
              {pickLang(lang, { ru: "Пропустить", en: "Skip", kk: "Өткізіп жіберу" })}
            </Text>
            <NextChevron color={theme.textMuted} size={rs(12)} />
          </View>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 24 },
  header: { flexDirection: "row", alignItems: "center", gap: 10 },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  segs: { flex: 1, flexDirection: "row", gap: 6 },
  seg: { flex: 1, height: 5, borderRadius: 3 },
  count: { fontFamily: warmupFonts.body, fontSize: 13, minWidth: 34, textAlign: "right" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  texts: { alignItems: "center", marginBottom: 22 },
  title: {
    fontFamily: warmupFonts.title,
    fontSize: 26,
    lineHeight: 31,
    letterSpacing: -0.26,
    textAlign: "center",
    maxWidth: 320,
  },
  desc: {
    fontFamily: warmupFonts.body,
    fontSize: 15,
    lineHeight: 21,
    textAlign: "center",
    marginTop: 8,
    maxWidth: 310,
  },
  footer: { paddingBottom: 24, alignItems: "center" },
  skip: { padding: 10 },
  skipText: { fontFamily: warmupFonts.body, fontSize: 14 },
});
