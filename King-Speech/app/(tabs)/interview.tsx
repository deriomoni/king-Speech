import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import * as Haptics from "@/lib/haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "expo-router";
import Animated, { FadeIn } from "react-native-reanimated";
import { useLang, pickLang, type Lang } from "@/context/LangContext";
import { useAppColors } from "@/hooks/useAppColors";
import { useTheme } from "@/context/ThemeContext";
import { fonts } from "@/constants/colors";
import { rs } from "@/lib/responsive";
import { ROUTES, type CheatRoute } from "@/constants/cheatsheetData";
import CheatSheetRunner from "@/components/cheatsheet/CheatSheetRunner";
import CheatSheetWheel from "@/components/cheatsheet/CheatSheetWheel";

// Vertical stretch of the hero title (King Speech logo letters are tall).
const HERO_STRETCH = 1.15;

// Encouraging one-liners shown under the title; rotates once per day so the
// screen feels fresh. Source: тексты для Шпаргалки.docx (updates daily).
// Subtitle under «Разогрев»: one line per calendar day, always a nudge to get
// ready before an important talk.
const DAILY_TEXTS: { ru: string; en: string; kk: string }[] = [
  { ru: "Быстро подготовься перед важным выходом.", en: "Get ready fast before your big moment.", kk: "Маңызды шығар алдында тез дайындал." },
  { ru: "Пара минут — и ты готов к выступлению.", en: "A couple of minutes and you're ready to speak.", kk: "Бірнеше минут — және сен сөйлеуге дайынсың." },
  { ru: "Разогрей голос, прежде чем выйти к людям.", en: "Warm up your voice before you face the room.", kk: "Адамдарға шықпас бұрын дауысыңды қыздыр." },
  { ru: "Важная речь впереди? Начни с разминки.", en: "Big talk ahead? Start with a warm-up.", kk: "Алда маңызды сөз бе? Жаттығудан баста." },
  { ru: "Соберись за пару минут перед выходом.", en: "Pull yourself together in a couple of minutes.", kk: "Шығар алдында бірнеше минутта жинақтал." },
  { ru: "Подготовь голос и мысли — сцена ждёт.", en: "Ready your voice and thoughts — the stage is waiting.", kk: "Дауыс пен ойды дайында — сахна күтіп тұр." },
  { ru: "Перед выступлением загляни сюда.", en: "Stop by here before you speak.", kk: "Сөйлер алдында осында кір." },
  { ru: "Короткая разминка — уверенный старт.", en: "A short warm-up, a confident start.", kk: "Қысқа жаттығу — сенімді бастама." },
  { ru: "Настройся на речь, пока есть минута.", en: "Tune in to your talk while you have a minute.", kk: "Бір минутың барда сөзге бейімдел." },
  { ru: "Выйди к слушателям готовым.", en: "Walk out to your audience ready.", kk: "Тыңдаушыларға дайын күйде шық." },
];

function useDailyText(lang: Lang): string {
  // Day index since epoch → same line for the whole calendar day, rotates daily.
  const day = Math.floor((Date.now() - new Date().getTimezoneOffset() * 60_000) / 86_400_000);
  return pickLang(lang, DAILY_TEXTS[day % DAILY_TEXTS.length]);
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
  const { theme } = useTheme();
  const dailyText = useDailyText(lang);
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
          paddingHorizontal: rs(22),
          paddingTop: insets.top + rs(22),
          paddingBottom: insets.bottom + rs(14),
        }}
      >
        {/* Hero */}
        <Animated.View entering={FadeIn.duration(400)} style={{ gap: rs(10) }}>
          {/* Set like the King Speech logo: Geologica Bold, tight tracking,
              stretched a little in height (scaleY; the margin makes room). */}
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            style={[styles.hero, styles.heroTall, { color: colors.text, fontSize: rs(43), lineHeight: rs(50), letterSpacing: -rs(1.7), marginBottom: rs(50) * (HERO_STRETCH - 1) }]}
          >
            {pickLang(lang, { ru: "Разогрев", en: "Get Ready", kk: "Дайын бол!" })}
          </Text>
          <Text style={[styles.heroSub, { color: colors.textSecondary }]}>
            {dailyText}
          </Text>
        </Animated.View>

        {/* Minutes wheel — scroll to pick how long a warm-up you want. */}
        <CheatSheetWheel
          routes={ROUTES}
          lang={lang}
          colors={colors}
          isDark={isDark}
          // Figma 12:202 / 12:203 — arc = getready/wheel-arc, gold dot,
          // gold "Начать" pill with the ctaStroke border.
          arcColor={isDark ? "rgba(240,238,233,0.16)" : "rgba(38,38,40,0.14)"}
          markerColor={theme.accent}
          startStyle={{ bg: theme.accent, border: theme.ctaStroke, ink: theme.accentText }}
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
            {pickLang(lang, { ru: "Приготовьтесь", en: "Get ready", kk: "Дайындалыңыз" })}
          </Text>
          <Text style={[styles.countNum, { color: pending.accent }]}>
            {count}
          </Text>
          <Text style={[styles.countHint, { color: colors.textMuted }]}>
            {pickLang(lang, { ru: "Нажмите, чтобы отменить", en: "Tap to cancel", kk: "Болдырмау үшін басыңыз" })}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  // Handwritten title (Caveat Bold — already loaded in _layout).
  hero: { fontSize: 58, fontFamily: "Geologica_700Bold", lineHeight: 62, marginTop: -4 },
  heroTall: { transform: [{ scaleY: HERO_STRETCH }], transformOrigin: "left top" },
  heroSub: { fontSize: 16, lineHeight: 23, fontFamily: fonts.body },

  countdown: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    zIndex: 50,
  },
  countKicker: { fontSize: 16, fontFamily: fonts.bodySemibold, letterSpacing: 1 },
  countNum: { fontSize: 150, lineHeight: 158, fontFamily: fonts.display },
  countHint: { fontSize: 13, fontFamily: fonts.body, marginTop: 10 },
});
