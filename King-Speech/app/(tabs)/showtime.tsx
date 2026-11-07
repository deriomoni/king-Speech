import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  Dimensions,
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
import Svg, { Path } from "react-native-svg";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { getSpeechThemes } from "@/app/showtime-stage";
import { useLang } from "@/context/LangContext";
import { useTheme } from "@/context/ThemeContext";
import { useAppColors } from "@/hooks/useAppColors";
import { useGame } from "@/context/GameContext";
import { VinylGallery } from "@/components/showtime/VinylGallery";
import { ShowTimeLogo, ShowTimeLogoLight } from "@/components/showtime/ShowTimeLogo";
import CoinIcon from "@/components/CoinIcon";
import AppDialog from "@/components/AppDialog";

const { width: SW } = Dimensions.get("window");

export default function ShowTimeScreen() {
  const insets = useSafeAreaInsets();
  const { t, lang } = useLang();
  const { themeMode } = useTheme();
  const { colors } = useAppColors();
  const isLight = themeMode === "light";
  // Background follows the app theme (same as the Path): app dark in dark mode,
  // app light in light mode — no bespoke navy stage tint.
  const bgGradient: [string, string, string] = [
    colors.background,
    colors.backgroundSecondary,
    colors.background,
  ];
  const bgColor = colors.background;
  const ink = isLight ? "#241934" : "#E8E4D8"; // section heading
  const inkSub = isLight ? "rgba(36,25,52,0.62)" : "rgba(255,255,255,0.7)";
  const inkFaint = isLight ? "rgba(36,25,52,0.45)" : "rgba(255,255,255,0.35)";
  const cardBg = isLight ? "rgba(36,25,52,0.035)" : "rgba(255,255,255,0.03)";
  const chipBg = isLight ? "rgba(36,25,52,0.06)" : "rgba(255,255,255,0.06)";
  const { coins, showTimeFreeAvailable, consumeShowTimeFree, spendCoins } = useGame();
  const SHOW_TIME_COST = 50;
  const [payModal, setPayModal] = useState(false);
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

  const goToStage = () => {
    router.push({
      pathname: "/showtime-stage",
      params: { levelId: theme.levelId, mode: "trainer" },
    });
  };

  const handleStart = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // First Show Time of the day is free; further entries cost coins.
    if (showTimeFreeAvailable) {
      consumeShowTimeFree();
      goToStage();
    } else {
      setPayModal(true);
    }
  };

  const confirmPaidEntry = () => {
    if (spendCoins(SHOW_TIME_COST)) {
      setPayModal(false);
      goToStage();
    }
  };

  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });
  const tipsAnim = useAnimatedStyle(() => {
    const scale = interpolate(scrollY.value, [0, 220], [0.72, 1.05], Extrapolation.CLAMP);
    return { transform: [{ scale }] };
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
    <View style={[st.container, { backgroundColor: bgColor }]}>
      <LinearGradient
        colors={bgGradient}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={[st.scroll, { paddingTop: topPad + 12, paddingBottom: bottomPad + 160 }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeIn.duration(400)} style={st.header}>
          <Animated.View style={logoAnim}>
            {isLight ? (
              <ShowTimeLogoLight width={Math.min(SW * 0.46, 210)} />
            ) : (
              <ShowTimeLogo width={Math.min(SW * 0.46, 200)} color="#F5A623" />
            )}
          </Animated.View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(150).duration(400)}>
          <Text style={[st.sectionLabel, st.galleryHeading, { fontFamily: "Nunito_600SemiBold", color: ink }]}>
            {t("chooseTopic")}
          </Text>
          <VinylGallery
            themes={THEME_KEYS.map((k) => speechThemes[k])}
            selectedIdx={safeIdx}
            onSelect={handleThemeSelect}
            isLight={isLight}
          />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(350).duration(400)}>
          <View style={[st.previewCard, { borderColor: theme.accentColor + "25", backgroundColor: cardBg }]}>
            <LinearGradient
              colors={[theme.accentColor + "0A", "transparent"]}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
            />
            <View style={st.previewHeader}>
              <View style={[st.previewThemeDot, { backgroundColor: theme.accentColor }]} />
              <Text style={[st.previewThemeName, { fontFamily: "Nunito_600SemiBold", color: theme.accentColor }]}>
                {theme.title}
              </Text>
              {theme.timerSeconds !== null && (
                <View style={[st.previewTimerBadge, { backgroundColor: chipBg }]}>
                  <Ionicons name="time-outline" size={12} color={inkFaint} />
                  <Text style={[st.previewTimerText, { fontFamily: "Nunito_400Regular", color: inkFaint }]}>{theme.timerSeconds} {t("sec")}</Text>
                </View>
              )}
            </View>
            <Text style={[st.previewInterior, { fontFamily: "Nunito_400Regular", color: inkFaint }]}>{theme.interior}</Text>
            <View style={[st.previewDivider, isLight && { backgroundColor: "rgba(36,25,52,0.10)" }]} />
            <Text style={[st.previewSpeechTitle, { fontFamily: "Nunito_600SemiBold", color: inkSub }]}>
              {randomSpeech.title}
            </Text>
            <View style={st.previewLines}>
              {randomSpeech.lines.slice(0, 4).map((line, i) => (
                <Text
                  key={i}
                  style={[st.previewLine, { fontFamily: "Nunito_400Regular", opacity: 0.6 - i * 0.1, color: isLight ? "#241934" : "#fff" }]}
                  numberOfLines={2}
                  ellipsizeMode="tail"
                >
                  {line}
                </Text>
              ))}
              <Text style={[st.previewLine, { fontFamily: "Nunito_400Regular", opacity: 0.2, color: isLight ? "#241934" : "#fff" }]}>...</Text>
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
            <Text style={[st.startBtnText, { color: "#1A1A2E", fontFamily: "Nunito_700Bold" }]}>
              {t("startTraining")}
            </Text>
            {showTimeFreeAvailable ? null : (
              <View style={st.startBtnCost}>
                <Text style={st.startBtnCostText}>{SHOW_TIME_COST}</Text>
                <CoinIcon size={16} color="#1A1A2E" />
              </View>
            )}
          </Pressable>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(500).duration(400)}>
          <Pressable
            onPress={() => {
              if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push("/roles");
            }}
            style={({ pressed }) => [
              st.rolesEntry,
              { opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
            ]}
          >
            <Svg width={27} height={36} viewBox="0 0 226 307">
              <Path fillRule="evenodd" clipRule="evenodd" d="M139.222 0V307C101.166 306.825 60.5922 290.874 36.7222 262C36.7222 262 0.722253 226.418 0.222241 168.709C-0.277771 111 0.222203 0 0.222203 0H139.222ZM106.409 103.131H53.3152C53.3152 96.1586 54.6885 89.2546 57.3568 82.813C60.025 76.3714 63.9359 70.5184 68.8661 65.5882C73.7964 60.6581 79.6494 56.7473 86.0911 54.0792C92.5328 51.4111 99.4369 50.0379 106.409 50.038V103.131ZM139.222 166.869H53.3152C53.3152 189.653 62.3661 211.504 78.4768 227.614C94.5875 243.725 116.438 252.776 139.222 252.776V166.869ZM172.035 103.131H225.129C225.129 96.1586 223.756 89.2546 221.088 82.813C218.419 76.3714 214.509 70.5184 209.578 65.5882C204.648 60.6581 198.795 56.7473 192.353 54.0792C185.912 51.4111 179.008 50.0379 172.035 50.038V103.131ZM139.222 166.869H225.129C225.129 178.15 222.907 189.321 218.59 199.744C214.273 210.167 207.945 219.637 199.968 227.614C191.99 235.592 182.52 241.919 172.097 246.237C161.675 250.554 150.504 252.776 139.222 252.776V166.869Z" fill={ink} />
            </Svg>
            <View style={{ flex: 1 }}>
              <Text style={[st.rolesEntryTitle, { color: ink, fontFamily: "Nunito_800ExtraBold" }]}>
                {lang === "en" ? "Roles" : "Роли"}
              </Text>
              <Text style={[st.rolesEntrySub, { color: inkSub, fontFamily: "Nunito_400Regular" }]}>
                {lang === "en"
                  ? "Play a character & train adaptability"
                  : "Играй персонажа и тренируй адаптивность"}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color={inkFaint} />
          </Pressable>
        </Animated.View>

        {/* Speaker tips. The mascot that used to peek over this button is gone
            — the button carries the row on its own. */}
        <Animated.View entering={FadeInDown.delay(550).duration(400)} style={[st.tipsUnit, tipsAnim]}>
          <Pressable
            onPress={() => {
              if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push("/speaker-tips");
            }}
            style={({ pressed }) => [st.tipsBtn, { opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }]}
            accessibilityRole="button"
          >
            <View style={st.tipsBtnIcon}>
              <Ionicons name="bulb" size={18} color="#FFD857" />
            </View>
            <Text style={[st.tipsBtnText, { fontFamily: "Nunito_600SemiBold" }]}>
              {t("speakerTips")}
            </Text>
            <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.7)" />
          </Pressable>
        </Animated.View>
      </Animated.ScrollView>

      <AppDialog
        visible={payModal}
        title={lang === "en" ? "Enter Show Time again?" : "Ещё один выход в Show Time?"}
        message={
          coins >= SHOW_TIME_COST
            ? lang === "en"
              ? `Today's free entry is used. This one costs ${SHOW_TIME_COST} coins. You have ${coins}.`
              : `Бесплатный выход на сегодня использован. Этот стоит ${SHOW_TIME_COST} монет. У вас ${coins}.`
            : lang === "en"
              ? `Not enough coins — you need ${SHOW_TIME_COST} and have ${coins}. Earn more by finishing levels.`
              : `Не хватает монет — нужно ${SHOW_TIME_COST}, у вас ${coins}. Зарабатывайте, проходя уровни.`
        }
        onRequestClose={() => setPayModal(false)}
        buttons={
          coins >= SHOW_TIME_COST
            ? [
                { label: lang === "en" ? "Cancel" : "Отмена", variant: "secondary", onPress: () => setPayModal(false) },
                { label: lang === "en" ? `Enter · ${SHOW_TIME_COST}` : `Выйти · ${SHOW_TIME_COST}`, variant: "primary", onPress: confirmPaidEntry },
              ]
            : [{ label: lang === "en" ? "Got it" : "Понятно", variant: "primary", onPress: () => setPayModal(false) }]
        }
      />
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
  tipsBtn: {
    alignSelf: "stretch",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 15,
    backgroundColor: "#7C4DFF",
    shadowColor: "#7C4DFF",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 8,
  },
  tipsBtnIcon: {
    width: 29,
    height: 29,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  tipsBtnText: { flex: 1, color: "#FFFFFF", fontSize: 14.5 },

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
  startBtnCost: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginLeft: 2,
    paddingLeft: 10,
    borderLeftWidth: 1.5,
    borderLeftColor: "rgba(26,26,46,0.22)",
  },
  startBtnCostText: {
    color: "#1A1A2E",
    fontSize: 18,
    fontFamily: "Nunito_800ExtraBold",
  },
  startBtnTag: {
    marginLeft: 2,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: "rgba(26,26,46,0.16)",
  },
  startBtnTagText: {
    color: "#1A1A2E",
    fontSize: 12.5,
    fontFamily: "Nunito_700Bold",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },

  modalOverlay: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(4,7,20,0.72)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    zIndex: 50,
  },
  modalCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#141B33",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    paddingVertical: 24,
    paddingHorizontal: 22,
    alignItems: "center",
  },
  modalIcon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "rgba(245,166,35,0.14)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  modalTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    lineHeight: 24,
    textAlign: "center",
    fontFamily: "Nunito_700Bold",
  },
  modalBody: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 13.5,
    lineHeight: 19,
    textAlign: "center",
    marginTop: 8,
    fontFamily: "Nunito_400Regular",
  },
  modalBtns: {
    flexDirection: "row",
    gap: 10,
    marginTop: 20,
    alignSelf: "stretch",
  },
  modalBtn: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  modalBtnGhost: {
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  modalBtnGhostText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 15,
    fontFamily: "Nunito_700Bold",
  },
  modalBtnPrimary: { backgroundColor: "#F5A623" },
  modalBtnPrimaryText: {
    color: "#1A1A2E",
    fontSize: 15,
    fontFamily: "Nunito_800ExtraBold",
  },
  // No plate of its own: it sits straight on the screen background in both
  // themes, so only the mark, the words and the arrow read as the control.
  rolesEntry: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    padding: 16,
    borderRadius: 20,
    marginTop: 16,
    marginBottom: 8,
  },
  rolesEntryTitle: { fontSize: 18 },
  rolesEntrySub: { fontSize: 13, marginTop: 2 },

});
