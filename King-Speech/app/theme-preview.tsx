// Theme preview — opened from the full catalog (app/theme-catalog.tsx) when a
// theme is tapped. Same look as the selected-theme block of the Show Time tab
// (cover, «title», duration, first line, yellow «Начать выступление» with the
// free-entry / coin flow). Back returns to the catalog.
import React from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { getSpeechThemes } from "@/app/showtime-stage";
import { useLang } from "@/context/LangContext";
import { useTheme } from "@/context/ThemeContext";
import { ThemeCoverGallery } from "@/components/showtime/ThemeCoverGallery";
import { ShowTimeLogo } from "@/components/showtime/ShowTimeLogo";
import { ShowTimeStartButton, useShowTimeEntry } from "@/components/showtime/useShowTimeEntry";

export default function ThemePreviewScreen() {
  const insets = useSafeAreaInsets();
  const { lang } = useLang();
  const en = lang === "en";
  const { theme: c, themeMode } = useTheme();
  const isLight = themeMode === "light";
  const { key } = useLocalSearchParams<{ key?: string }>();
  const entry = useShowTimeEntry();

  const topPad = Platform.OS === "web" ? 54 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const bgMid = isLight ? c.bgSecondary : "#2E2E30"; // showtime/bg-mid

  const speechThemes = getSpeechThemes(lang);
  const theme = (key && speechThemes[key]) || speechThemes[Object.keys(speechThemes)[0]];
  const firstLine = theme.speeches?.[0]?.lines?.[0];

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/theme-catalog");
  };

  const durationLine =
    theme.timerSeconds !== null
      ? en
        ? `${theme.timerSeconds} sec speech`
        : `${theme.timerSeconds} сек выступления`
      : en
        ? "1-2 min speech"
        : "1-2 мин выступления";

  return (
    <View style={[s.container, { backgroundColor: c.bg }]}>
      <LinearGradient
        colors={[c.bg, bgMid, c.bg]}
        style={s.fill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        pointerEvents="none"
      />
      <ScrollView
        contentContainerStyle={[s.content, { paddingTop: topPad + 8, paddingBottom: bottomPad + 40 }]}
        showsVerticalScrollIndicator={false}
        alwaysBounceHorizontal={false}
      >
        <Animated.View entering={FadeIn.duration(300)} style={s.header}>
          <Pressable onPress={goBack} hitSlop={12} style={s.back} accessibilityRole="button">
            <Ionicons name="chevron-back" size={26} color={c.text} />
          </Pressable>
          <ShowTimeLogo width={83} color={isLight ? c.text : c.accent} />
          <View style={s.back} />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(80).duration(380)} style={s.galleryBleed}>
          <ThemeCoverGallery themes={[theme]} selectedIdx={0} onSelect={() => {}} />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(140).duration(380)} style={s.info}>
          <Text style={[s.title, { color: c.accentInk }]}>{en ? `“${theme.title}”` : `«${theme.title}»`}</Text>
          <Text style={[s.desc, { color: c.textMuted }]}>{durationLine}</Text>
          {firstLine ? (
            <Text style={[s.desc, { color: c.textMuted, marginTop: 4 }]} numberOfLines={3}>
              {firstLine}
            </Text>
          ) : null}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(380)}>
          <ShowTimeStartButton onPress={() => entry.start(theme.levelId)} free={entry.freeAvailable} en={en} />
        </Animated.View>
      </ScrollView>
      {entry.dialog}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  fill: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  content: { paddingHorizontal: 20, width: "100%", maxWidth: 480, alignSelf: "center" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  back: { width: 44, height: 44, justifyContent: "center" },
  galleryBleed: { marginHorizontal: -20 },
  info: { paddingHorizontal: 4, marginTop: 8 },
  title: { fontSize: 24, letterSpacing: -0.12, fontFamily: "Geologica_800ExtraBold", marginBottom: 6 },
  desc: { fontSize: 13, lineHeight: 15.6, fontFamily: "Geologica_600SemiBold" },
});
