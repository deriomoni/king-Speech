import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  Dimensions,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedScrollHandler,
  interpolate,
  Extrapolation,
  FadeIn,
  FadeInDown,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { getSpeechThemes } from "@/app/showtime-stage";
import { useLang } from "@/context/LangContext";
import { VinylGallery } from "@/components/showtime/VinylGallery";
import { ShowTimeLogo } from "@/components/showtime/ShowTimeLogo";

const { width: SW } = Dimensions.get("window");

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

  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });
  const logoAnim = useAnimatedStyle(() => {
    const scale = interpolate(scrollY.value, [0, 200], [1, 0.58], Extrapolation.CLAMP);
    const rotateX = interpolate(scrollY.value, [0, 200], [0, 38], Extrapolation.CLAMP);
    const translateY = interpolate(scrollY.value, [0, 200], [0, -18], Extrapolation.CLAMP);
    const opacity = interpolate(scrollY.value, [0, 200], [1, 0.45], Extrapolation.CLAMP);
    return {
      opacity,
      transform: [
        { perspective: 600 },
        { translateY },
        { rotateX: `${rotateX}deg` },
        { scale },
      ],
    };
  });

  return (
    <View style={[st.container, { backgroundColor: "#070D1A" }]}>
      <LinearGradient
        colors={["#070D1A", "#0D1830", "#070D1A"]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={[st.scroll, { paddingTop: topPad + 12, paddingBottom: bottomPad + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeIn.duration(400)} style={st.header}>
          <Animated.View style={logoAnim}>
            <ShowTimeLogo width={Math.min(SW * 0.46, 200)} color="#F5A623" />
          </Animated.View>
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

        <Animated.View entering={FadeInDown.delay(500).duration(400)}>
          <Pressable
            onPress={() => {
              if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push("/roles");
            }}
            style={({ pressed }) => [st.rolesEntry, { opacity: pressed ? 0.9 : 1 }]}
          >
            <LinearGradient
              colors={["#8E5BFF", "#E84393"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={st.rolesEntryIcon}>
              <Ionicons name="happy" size={24} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[st.rolesEntryTitle, { fontFamily: "Nunito_800ExtraBold" }]}>
                {lang === "en" ? "Roles" : "Роли"}
              </Text>
              <Text style={[st.rolesEntrySub, { fontFamily: "Inter_400Regular" }]}>
                {lang === "en"
                  ? "Play a character & train adaptability"
                  : "Играй персонажа и тренируй адаптивность"}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color="#ffffffCC" />
          </Pressable>
        </Animated.View>

        {/* Speaker tips — Oscar reading a book, glued flush on top of the
            purple button so mascot + button read as one single widget. */}
        <Animated.View entering={FadeInDown.delay(550).duration(400)} style={st.tipsUnit}>
          <Image
            source={require("@/assets/images/oscar-peek.png")}
            style={st.tipsMascot}
            resizeMode="contain"
          />
          <Pressable
            onPress={() => {
              if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push("/speaker-tips");
            }}
            style={({ pressed }) => [st.tipsBtn, { opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }]}
            accessibilityRole="button"
          >
            <View style={st.tipsBtnIcon}>
              <Ionicons name="bulb" size={18} color="#FFD230" />
            </View>
            <Text style={[st.tipsBtnText, { fontFamily: "Inter_600SemiBold" }]}>
              {t("speakerTips")}
            </Text>
            <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.7)" />
          </Pressable>
        </Animated.View>
      </Animated.ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 20, gap: 18 },

  header: { alignItems: "center", justifyContent: "center", paddingVertical: 4 },

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

  tipsUnit: {
    alignItems: "center",
    marginTop: 6,
  },
  tipsMascot: {
    width: 132,
    height: 131,
    marginBottom: -1,
    zIndex: 2,
  },
  tipsBtn: {
    alignSelf: "stretch",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 15,
    paddingHorizontal: 16,
    borderRadius: 18,
    backgroundColor: "#7C4DFF",
    shadowColor: "#7C4DFF",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 8,
  },
  tipsBtnIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  tipsBtnText: { flex: 1, color: "#FFFFFF", fontSize: 15.5 },

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
  rolesEntry: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 20,
    overflow: "hidden",
    marginTop: 16,
    marginBottom: 8,
    ...Platform.select({
      ios: { shadowColor: "#8E5BFF", shadowOpacity: 0.4, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } },
      android: { elevation: 6 },
      default: {},
    }),
  },
  rolesEntryIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  rolesEntryTitle: { fontSize: 18, color: "#fff" },
  rolesEntrySub: { fontSize: 13, color: "rgba(255,255,255,0.85)", marginTop: 2 },

});
