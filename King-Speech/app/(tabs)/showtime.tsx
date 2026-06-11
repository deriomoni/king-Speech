import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  ScrollView,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  FadeIn,
  FadeInDown,
  cancelAnimation,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { getSpeechThemes } from "@/app/showtime-stage";
import { useLang } from "@/context/LangContext";
import { VinylGallery } from "@/components/showtime/VinylGallery";

const { width: SW, height: SH } = Dimensions.get("window");

function Spotlight() {
  const opacity = useSharedValue(0.7);
  useEffect(() => {
    opacity.value = withRepeat(withTiming(1, { duration: 2500 }), -1, true);
    return () => cancelAnimation(opacity);
  }, []);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]}>
      <LinearGradient
        colors={["transparent", "rgba(245,166,35,0.08)", "transparent"]}
        style={{ position: "absolute", top: 0, left: "30%", width: "40%", height: "55%" }}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />
    </Animated.View>
  );
}

export default function ShowTimeScreen() {
  const insets = useSafeAreaInsets();
  const { t, lang } = useLang();
  const [selectedIdx, setSelectedIdx] = useState(0);
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const speechThemes = getSpeechThemes(lang);
  const THEME_KEYS = Object.keys(speechThemes).slice(0, 10);
  const safeIdx = Math.max(0, Math.min(THEME_KEYS.length - 1, selectedIdx));
  const theme = speechThemes[THEME_KEYS[safeIdx]];
  const randomSpeech = theme.speeches[0];

  const handleThemeSelect = (idx: number) => {
    setSelectedIdx(idx);
    if (Platform.OS !== "web") {
      Haptics.selectionAsync();
    }
  };

  const handleStart = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({
      pathname: "/showtime-stage",
      params: { levelId: theme.levelId, mode: "trainer" },
    });
  };

  return (
    <View style={[st.container, { backgroundColor: "#070D1A" }]}>
      <LinearGradient
        colors={["#070D1A", "#0D1830", "#070D1A"]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <Spotlight />

      <ScrollView
        contentContainerStyle={[st.scroll, { paddingTop: topPad + 12, paddingBottom: bottomPad + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeIn.duration(400)} style={st.header}>
          <View style={st.trainerBadge}>
            <Ionicons name="barbell-outline" size={12} color="rgba(255,255,255,0.6)" />
            <Text style={[st.trainerBadgeText, { fontFamily: "Inter_500Medium" }]}>{t("trainer")}</Text>
          </View>
          <View style={[st.headerIcon, { backgroundColor: theme.accentColor + "20" }]}>
            <Ionicons name="videocam" size={22} color={theme.accentColor} />
          </View>
          <Text
            style={[
              st.headerTitle,
              {
                fontFamily: Platform.select({
                  ios: "Times New Roman",
                  android: "serif",
                  default: "Times New Roman, Times, serif",
                }),
                fontWeight: "700" as const,
              },
            ]}
          >
            Show Time
          </Text>
          <Text style={[st.headerSub, { fontFamily: "Inter_400Regular" }]}>
            {t("freeTraining")}
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(150).duration(400)}>
          <Text style={[st.sectionLabel, st.galleryHeading, { fontFamily: "Inter_600SemiBold" }]}>
            {t("chooseTopic")}
          </Text>
          <VinylGallery
            themes={THEME_KEYS.map((k) => speechThemes[k])}
            selectedIdx={safeIdx}
            onSelect={handleThemeSelect}
          />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(350).duration(400)}>
          <View style={[st.previewCard, { borderColor: theme.accentColor + "25" }]}>
            <LinearGradient
              colors={[theme.accentColor + "0A", "transparent"]}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
            />
            <View style={st.previewHeader}>
              <View style={[st.previewThemeDot, { backgroundColor: theme.accentColor }]} />
              <Text style={[st.previewThemeName, { fontFamily: "Inter_600SemiBold", color: theme.accentColor }]}>
                {theme.title}
              </Text>
              {theme.timerSeconds !== null && (
                <View style={st.previewTimerBadge}>
                  <Ionicons name="time-outline" size={12} color="rgba(255,255,255,0.5)" />
                  <Text style={[st.previewTimerText, { fontFamily: "Inter_400Regular" }]}>{theme.timerSeconds} {t("sec")}</Text>
                </View>
              )}
            </View>
            <Text style={[st.previewInterior, { fontFamily: "Inter_400Regular" }]}>{theme.interior}</Text>
            <View style={st.previewDivider} />
            <Text style={[st.previewSpeechTitle, { fontFamily: "Inter_600SemiBold" }]}>
              {randomSpeech.title}
            </Text>
            <View style={st.previewLines}>
              {randomSpeech.lines.slice(0, 4).map((line, i) => (
                <Text
                  key={i}
                  style={[st.previewLine, { fontFamily: "Inter_400Regular", opacity: 0.6 - i * 0.1 }]}
                  numberOfLines={1}
                >
                  {line}
                </Text>
              ))}
              <Text style={[st.previewLine, { fontFamily: "Inter_400Regular", opacity: 0.2 }]}>...</Text>
            </View>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(450).duration(400)}>
          <Pressable
            onPress={handleStart}
            style={({ pressed }) => [
              st.startBtn,
              { backgroundColor: theme.accentColor, shadowColor: theme.accentColor, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Ionicons name="play-circle" size={22} color="#1A1A2E" />
            <Text style={[st.startBtnText, { color: "#1A1A2E", fontFamily: "Inter_700Bold" }]}>
              {t("startTraining")}
            </Text>
          </Pressable>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(550).duration(400)}>
          <Text style={[st.sectionLabel, { fontFamily: "Inter_600SemiBold" }]}>{t("speakerTips")}</Text>
          {[
            { icon: "eye-outline" as const, tip: t("tipLookForward") },
            { icon: "megaphone-outline" as const, tip: t("tipSpeakLouder") },
            { icon: "pause-outline" as const, tip: t("tipPause") },
            { icon: "body-outline" as const, tip: t("tipStandStraight") },
            { icon: "happy-outline" as const, tip: t("tipSmile") },
          ].map((item, i) => (
            <Animated.View
              key={i}
              entering={FadeInDown.delay(600 + i * 60).duration(350)}
              style={[st.tipRow, { borderColor: theme.accentColor + "15" }]}
            >
              <View style={[st.tipIcon, { backgroundColor: theme.accentColor + "15" }]}>
                <Ionicons name={item.icon} size={18} color={theme.accentColor} />
              </View>
              <Text style={[st.tipText, { fontFamily: "Inter_400Regular" }]}>{item.tip}</Text>
            </Animated.View>
          ))}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 20, gap: 18 },

  header: { alignItems: "center", gap: 6 },
  trainerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.08)",
    marginBottom: 6,
  },
  trainerBadgeText: { fontSize: 11, color: "rgba(255,255,255,0.6)", letterSpacing: 0.5 },
  headerIcon: {
    width: 52, height: 52, borderRadius: 26,
    alignItems: "center", justifyContent: "center",
  },
  headerTitle: { fontSize: 28, color: "#fff" },
  headerSub: { fontSize: 13, color: "rgba(255,255,255,0.4)", textAlign: "center", lineHeight: 18 },

  sectionLabel: { fontSize: 16, color: "#E8E4D8", marginBottom: 8, marginTop: 4 },
  galleryHeading: { textAlign: "center", marginBottom: 4 },

  previewCard: {
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    backgroundColor: "rgba(255,255,255,0.03)",
    gap: 10,
    overflow: "hidden",
  },
  previewHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  previewThemeDot: { width: 10, height: 10, borderRadius: 5 },
  previewThemeName: { fontSize: 16, flex: 1 },
  previewTimerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  previewTimerText: { fontSize: 11, color: "rgba(255,255,255,0.5)" },
  previewInterior: { fontSize: 12, color: "rgba(255,255,255,0.35)", lineHeight: 16 },
  previewDivider: { height: 1, backgroundColor: "rgba(255,255,255,0.06)", marginVertical: 2 },
  previewSpeechTitle: { fontSize: 14, color: "rgba(255,255,255,0.7)" },
  previewLines: { gap: 3 },
  previewLine: { fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 19 },

  startBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
    borderRadius: 18,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  startBtnText: { fontSize: 18 },

  tipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: "rgba(255,255,255,0.03)",
    marginBottom: 6,
  },
  tipIcon: {
    width: 38, height: 38, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
  },
  tipText: { flex: 1, fontSize: 14, color: "rgba(255,255,255,0.7)", lineHeight: 20 },
});
