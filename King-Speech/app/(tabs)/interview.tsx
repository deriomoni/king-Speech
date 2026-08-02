import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "expo-router";
import Animated, { FadeIn } from "react-native-reanimated";
import { useLang } from "@/context/LangContext";
import { useAppColors } from "@/hooks/useAppColors";
import { fonts } from "@/constants/colors";
import { ROUTES, type CheatRoute } from "@/constants/cheatsheetData";
import CheatSheetRunner from "@/components/cheatsheet/CheatSheetRunner";
import CheatSheetWheel from "@/components/cheatsheet/CheatSheetWheel";
import GetReadyLogo from "@/components/cheatsheet/GetReadyLogo";

// Encouraging one-liners shown under the title; rotates once per day so the
// screen feels fresh. Source: тексты для Шпаргалки.docx (updates daily).
const DAILY_TEXTS = [
  "Глубокий вдох, выдох — и шпаргалка под рукой.",
  "Волнуешься перед выступлением? Пройди быстрые задания и подготовься.",
  "Нервничаешь? Давай разомнёмся — и страх отступит.",
  "Разогреем связки и разомнёмся.",
  "Голос звучит увереннее, когда связки разогреты. Начнём?",
  "Пара минут на разминку — и вперёд.",
  "Короткий тренажёр к уверенному выходу.",
  "Экспресс-подготовка к ответственному выступлению.",
  "Быстрый способ подготовиться к важному выступлению.",
  "Твой выход, маэстро — не забудь разогреться.",
  "Разминка голоса не помешает.",
  "Оратор, вам не помешает размяться.",
  "Всё главное — в одном месте.",
  "Соберись за пару минут.",
  "Для уверенного старта.",
  "Освежись перед выходом на сцену.",
  "Быстрая подготовка — коротко и по делу.",
  "Минута пошла — собери мысли в порядок.",
  "Спокоен как удав.",
  "Перед выходом загляни сюда.",
  "Оратор рождается из подготовки.",
  "Поэтами рождаются, ораторами становятся.",
  "Сначала разогрейся — слова придут сами.",
  "Волнение — это твоя энергия. Направь её в голос.",
  "Говори не идеально — говори честно.",
];

function useDailyText(): string {
  // Day index since epoch → same line for the whole calendar day, rotates daily.
  const day = Math.floor(Date.now() / 86_400_000);
  return DAILY_TEXTS[day % DAILY_TEXTS.length];
}

function haptic() {
  if (Platform.OS !== "web")
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

// ── Main screen ────────────────────────────────────────────────────────────────
export default function CheatSheetScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { lang } = useLang();
  const { colors, isDark } = useAppColors();
  const dailyText = useDailyText();
  const [activeRoute, setActiveRoute] = useState<CheatRoute | null>(null);
  // The warm-up chosen on the wheel, held during the 5-second countdown.
  const [pending, setPending] = useState<CheatRoute | null>(null);
  const [count, setCount] = useState(5);

  // Hide the bottom tab bar while the countdown or the warm-up itself is on —
  // the runner is a full-screen flow and the nav bar shouldn't show through.
  const immersive = !!pending || !!activeRoute;
  useEffect(() => {
    navigation.setOptions({
      tabBarStyle: immersive ? { display: "none" } : undefined,
    });
  }, [immersive, navigation]);

  // 5-second countdown → then the warm-up starts.
  useEffect(() => {
    if (!pending) return;
    let n = 5;
    setCount(n);
    if (Platform.OS !== "web")
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const id = setInterval(() => {
      n -= 1;
      if (n <= 0) {
        clearInterval(id);
        setActiveRoute(pending);
        setPending(null);
      } else {
        setCount(n);
        if (Platform.OS !== "web")
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }
    }, 1000);
    return () => clearInterval(id);
  }, [pending]);

  if (activeRoute) {
    return (
      <CheatSheetRunner
        route={activeRoute}
        lang={lang}
        onExit={() => setActiveRoute(null)}
      />
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View
        style={{
          flex: 1,
          paddingHorizontal: 22,
          paddingTop: insets.top + 22,
          paddingBottom: insets.bottom + 14,
        }}
      >
        {/* Hero */}
        <Animated.View entering={FadeIn.duration(400)} style={{ gap: 10 }}>
          <GetReadyLogo width={210} color={colors.text} />
          <Text style={[styles.heroSub, { color: colors.textSecondary }]}>
            {lang === "en" ? "Your quick prep before you speak." : dailyText}
          </Text>
        </Animated.View>

        {/* Minutes wheel — scroll to pick how long a warm-up you want. */}
        <CheatSheetWheel
          routes={ROUTES}
          lang={lang}
          colors={colors}
          isDark={isDark}
          onStart={(route) => {
            haptic();
            setPending(route);
          }}
        />
      </View>

      {/* Countdown before the warm-up begins. Tap to cancel. */}
      {pending && (
        <Pressable
          style={[styles.countdown, { backgroundColor: colors.background }]}
          onPress={() => setPending(null)}
        >
          <Text style={[styles.countKicker, { color: colors.textSecondary }]}>
            {lang === "en" ? "Get ready" : "Приготовьтесь"}
          </Text>
          <Text style={[styles.countNum, { color: pending.accent }]}>
            {count}
          </Text>
          <Text style={[styles.countHint, { color: colors.textMuted }]}>
            {lang === "en" ? "Tap to cancel" : "Нажмите, чтобы отменить"}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  // Handwritten title (Caveat Bold — already loaded in _layout).
  hero: { fontSize: 58, fontFamily: "Caveat_700Bold", lineHeight: 62, marginTop: -4 },
  heroSub: { fontSize: 16, lineHeight: 23, fontFamily: fonts.body },

  countdown: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    zIndex: 50,
  },
  countKicker: { fontSize: 16, fontFamily: fonts.bodySemibold, letterSpacing: 1 },
  countNum: { fontSize: 150, lineHeight: 158, fontFamily: fonts.display },
  countHint: { fontSize: 13, fontFamily: fonts.body, marginTop: 10 },
});
