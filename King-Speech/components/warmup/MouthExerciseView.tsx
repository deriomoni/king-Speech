import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "@/lib/haptics";
import type { WarmupMouth } from "@/constants/contentLoader";
import { warmupFonts } from "@/components/warmup/warmupTheme";
import { useAppColors } from "@/hooks/useAppColors";
import { useTheme } from "@/context/ThemeContext";
import { useLang, pickLang } from "@/context/LangContext";
import { MouthHelpDialog } from "@/components/warmup/WarmupHelpDialog";
import { rs } from "@/lib/responsive";
import IllustratedExerciseView, { ILLUSTRATED_EXERCISES } from "@/components/warmup/IllustratedExerciseView";

/**
 * «Разминка полости рта» (warm-up level, task 2). Start screen, then the four
 * illustrated exercises from the Figma portraits, each animated in rhythm:
 * звук из груди → трубочка в сторону → речь с пробкой → язык по кругу.
 * The per-module text-only exercise and the name/countdown intro were removed
 * (owner): only exercises with a portrait are shown.
 */
interface Props {
  /** Kept for the level API; the illustrated set is the same for every module. */
  exercise?: WarmupMouth;
  infoKey?: string;
  topPad: number;
  onComplete: () => void;
  onBack: () => void;
}

export default function MouthExerciseView({ topPad, onComplete, onBack }: Props) {
  const { lang } = useLang();
  const { colors } = useAppColors();
  const { theme } = useTheme();
  const [idx, setIdx] = useState<number | null>(null); // null = start screen
  const [showHelp, setShowHelp] = useState(false);
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const start = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setIdx(0);
  };
  const next = () => {
    const n = (idx ?? 0) + 1;
    if (n >= ILLUSTRATED_EXERCISES.length) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onCompleteRef.current();
      return;
    }
    setIdx(n);
  };

  if (idx !== null) {
    return (
      <IllustratedExerciseView
        exercise={ILLUSTRATED_EXERCISES[idx]}
        index={idx}
        count={ILLUSTRATED_EXERCISES.length}
        topPad={topPad}
        onDone={next}
        onSkip={next}
        onBack={onBack}
      />
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: topPad + rs(8) }]}>
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={12} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={rs(24)} color={colors.textSecondary} />
        </Pressable>
        <Pressable onPress={() => setShowHelp(true)} hitSlop={12} style={styles.iconBtn}>
          <Ionicons name="help-circle-outline" size={rs(24)} color={colors.textSecondary} />
        </Pressable>
      </View>

      <View style={styles.center}>
        <Text style={[styles.idleTitle, { color: colors.text }]}>
          {pickLang(lang, { ru: "Разминка полости рта", en: "Mouth warm-up", kk: "Ауыз жаттығуы" })}
        </Text>
        <Animated.View entering={FadeInDown.delay(120).duration(420)} style={styles.idleActions}>
          <Pressable
            onPress={start}
            style={({ pressed }) => [
              styles.cta,
              { backgroundColor: theme.accent, borderColor: theme.ctaStroke, opacity: pressed ? 0.9 : 1 },
            ]}
          >
            <Ionicons name="play" size={rs(13)} color={theme.accentText} />
            <Text style={[styles.ctaText, { color: theme.accentText }]}>
              {pickLang(lang, { ru: "Старт", en: "Start", kk: "Бастау" })}
            </Text>
          </Pressable>
          <Pressable onPress={onBack} hitSlop={8} style={styles.backLink}>
            <Text style={[styles.backLinkText, { color: colors.textMuted }]}>
              {pickLang(lang, { ru: "Вернуться назад", en: "Go back", kk: "Артқа оралу" })}
            </Text>
          </Pressable>
        </Animated.View>
      </View>

      <MouthHelpDialog visible={showHelp} onClose={() => setShowHelp(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 24 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  idleTitle: { fontFamily: warmupFonts.title, fontSize: 30, textAlign: "center", letterSpacing: -0.3 },
  idleActions: { marginTop: 34, alignItems: "center" },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingHorizontal: 40,
    height: 56,
    borderRadius: 32,
  },
  ctaText: { fontSize: 17, fontFamily: warmupFonts.title },
  backLink: { marginTop: 18, padding: 8 },
  backLinkText: { fontFamily: warmupFonts.body, fontSize: 15 },
});
