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
import Svg, { Path } from "react-native-svg";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { getSpeechThemes } from "@/app/showtime-stage";
import { useLang } from "@/context/LangContext";
import { useTheme } from "@/context/ThemeContext";
import { useGame } from "@/context/GameContext";
import { VinylGallery } from "@/components/showtime/VinylGallery";
import { ShowTimeLogo, ShowTimeLogoLight } from "@/components/showtime/ShowTimeLogo";
import CoinIcon from "@/components/CoinIcon";

const { width: SW } = Dimensions.get("window");

export default function ShowTimeScreen() {
  const insets = useSafeAreaInsets();
  const { t, lang } = useLang();
  const { themeMode } = useTheme();
  const isLight = themeMode === "light";
  // Light theme: white paper interface with the colorful wordmark. Dark theme
  // keeps the original navy stage look.
  const bgGradient: [string, string, string] = isLight
    ? ["#FFFFFF", "#F5F7FB", "#FFFFFF"]
    : ["#070D1A", "#0D1830", "#070D1A"];
  const bgColor = isLight ? "#FFFFFF" : "#070D1A";
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
        contentContainerStyle={[st.scroll, { paddingTop: topPad + 12, paddingBottom: bottomPad + 100 }]}
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
            {showTimeFreeAvailable ? (
              <View style={st.startBtnTag}>
                <Text style={st.startBtnTagText}>
                  {lang === "en" ? "free" : "бесплатно"}
                </Text>
              </View>
            ) : (
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
            style={({ pressed }) => [st.rolesEntry, { opacity: pressed ? 0.9 : 1 }]}
          >
            <LinearGradient
              colors={["#8E5BFF", "#E84393"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={st.rolesEntryIcon}>
              <Svg width={32} height={21} viewBox="0 0 450 298">
                <Path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M224.589 242.08C224.369 242.04 223.719 241.74 222.999 241.35C222.249 240.94 221.489 240.56 221.289 240.5C219.879 240.05 215.389 239.85 212.999 240.13C204.129 241.16 196.099 246.02 186.459 256.19C184.039 258.73 182.689 260.22 178.849 264.59C172.759 271.5 162.329 281.25 156.689 285.3C146.749 292.44 134.379 296.66 120.989 297.48C119.099 297.6 114.069 297.6 112.139 297.48C103.169 296.92 94.3594 294.62 86.8594 290.87C84.8894 289.89 84.7494 289.81 82.7894 288.65C77.5794 285.54 72.7394 280.04 69.3294 273.34C66.4394 267.66 65.4994 263.28 65.7394 256.56C65.9194 251.35 66.4494 249.24 67.8694 248.01C71.2294 245.12 73.6594 244.77 75.1494 246.95C75.9994 248.2 76.5294 249.91 77.1394 253.44C77.9494 258.15 78.3194 259.53 79.3494 261.69C80.5794 264.25 82.7294 266.81 84.9894 268.42C87.5294 270.21 90.9794 271.5 94.8894 272.1C97.0294 272.43 101.769 272.43 103.889 272.11C114.159 270.52 123.639 264.05 133.199 252.11C135.759 248.92 137.959 245.76 141.939 239.58C153.639 221.4 164.039 212.01 177.419 207.54C185.859 204.72 196.009 203.98 204.029 205.6C205.879 205.97 210.129 207.27 212.219 208.1C217.259 210.1 220.579 212.82 223.789 217.6C224.059 217.99 224.329 218.39 224.589 218.78C224.859 218.39 225.129 217.99 225.389 217.6C228.609 212.82 231.919 210.1 236.969 208.1C239.059 207.27 243.309 205.97 245.149 205.6C253.179 203.98 263.329 204.72 271.769 207.54C285.139 212.01 295.549 221.4 307.249 239.58C311.229 245.76 313.429 248.92 315.979 252.11C325.549 264.05 335.029 270.52 345.289 272.11C347.419 272.43 352.159 272.43 354.289 272.1C358.199 271.5 361.659 270.21 364.189 268.42C366.459 266.81 368.599 264.25 369.829 261.69C370.869 259.53 371.239 258.15 372.049 253.44C372.659 249.91 373.179 248.2 374.039 246.95C375.529 244.77 377.959 245.12 381.309 248.01C382.739 249.24 383.269 251.35 383.449 256.56C383.689 263.28 382.749 267.66 379.859 273.34C376.439 280.04 371.599 285.54 366.389 288.65C364.439 289.81 364.289 289.89 362.329 290.87C354.829 294.62 346.019 296.92 337.039 297.48C335.119 297.6 330.079 297.6 328.189 297.48C314.809 296.66 302.429 292.44 292.489 285.3C286.849 281.25 276.429 271.5 270.339 264.59C266.499 260.22 265.139 258.73 262.729 256.19C253.089 246.02 245.049 241.16 236.179 240.13C233.799 239.85 229.309 240.05 227.889 240.5C227.699 240.56 226.929 240.94 226.179 241.35C225.469 241.74 224.819 242.04 224.589 242.08ZM224.589 144.6C217.939 144.61 211.329 147.1 205.149 152.03C204.599 152.47 201.849 155.11 199.039 157.89C180.919 175.87 167.849 185.09 152.879 190.47C148.989 191.87 142.789 193.79 139.439 194.63C131.069 196.72 121.809 197.67 113.479 197.29C108.049 197.03 102.419 196.25 97.3394 195.04C94.0494 194.25 85.6594 191.85 83.2294 191C67.7894 185.59 53.0394 175.71 41.8594 163.27C38.2594 159.26 36.9494 157.55 33.1494 151.87C31.6294 149.6 29.9094 147.03 29.3194 146.17C22.1594 135.73 17.0394 123.29 12.8394 106.14C10.7194 97.4605 10.1994 94.2705 8.83938 81.2405C7.66938 69.9505 7.16938 66.4205 5.78938 59.6305C4.69938 54.2605 1.72938 41.3705 0.839379 38.1905C-0.0206209 35.1005 -0.150621 33.9805 0.139379 32.4205C0.329379 31.4605 0.409379 31.3505 1.64938 30.3005C3.35938 28.8705 6.24938 27.0405 10.2394 24.8905C21.8394 18.6205 31.7494 14.3305 43.0894 10.6505C44.8794 10.0805 48.0994 9.03047 50.2394 8.33047C55.3994 6.65047 56.5294 6.31047 59.1394 5.65047C69.3994 3.07047 80.5594 1.43047 94.9894 0.390469C109.469 -0.659531 126.879 0.440469 141.339 3.30047C160.789 7.15047 180.699 14.7205 197.389 24.6205C205.219 29.2605 218.469 40.3105 224.189 46.9605C224.319 47.1205 224.459 47.2705 224.589 47.4305C224.729 47.2705 224.859 47.1205 224.999 46.9605C230.719 40.3105 243.969 29.2605 251.789 24.6205C268.489 14.7205 288.389 7.15047 307.839 3.30047C322.309 0.440469 339.709 -0.659531 354.189 0.390469C368.629 1.43047 379.789 3.07047 390.039 5.65047C392.649 6.31047 393.789 6.65047 398.939 8.33047C401.089 9.03047 404.309 10.0805 406.089 10.6505C417.429 14.3305 427.349 18.6205 438.939 24.8905C442.929 27.0405 445.829 28.8705 447.539 30.3005C448.779 31.3505 448.859 31.4605 449.039 32.4205C449.339 33.9805 449.199 35.1005 448.349 38.1905C447.459 41.3705 444.489 54.2605 443.399 59.6305C442.019 66.4205 441.519 69.9505 440.339 81.2405C438.979 94.2705 438.469 97.4605 436.339 106.14C432.139 123.29 427.019 135.73 419.869 146.17C419.279 147.03 417.549 149.6 416.029 151.87C412.229 157.55 410.929 159.26 407.319 163.27C396.139 175.71 381.399 185.59 365.949 191C363.529 191.85 355.139 194.25 351.839 195.04C346.769 196.25 341.139 197.03 335.709 197.29C327.369 197.67 318.119 196.72 309.739 194.63C306.399 193.79 300.199 191.87 296.299 190.47C281.339 185.09 268.269 175.87 250.139 157.89C247.339 155.11 244.589 152.47 244.039 152.03C237.859 147.1 231.239 144.61 224.589 144.6ZM133.599 124.84C142.829 124.07 151.889 121.95 160.239 118.6C164.289 116.98 170.389 114.29 170.389 114.13C170.389 113.94 168.959 111.2 168.149 109.84C162.389 100.2 151.729 90.8505 139.519 84.7505C127.349 78.6705 110.809 75.3205 95.6594 75.8705C87.4394 76.1705 82.1194 76.8105 75.2394 78.3405C72.2494 79.0105 65.1094 80.8405 64.9594 80.9805C64.7994 81.1405 65.7794 84.4805 66.6894 86.8805C70.3394 96.4805 76.9894 105.25 85.4394 111.61C91.2694 115.99 99.5494 119.95 107.779 122.29C115.929 124.6 125.319 125.53 133.599 124.84ZM315.589 124.84C323.859 125.53 333.259 124.6 341.409 122.29C349.629 119.95 357.909 115.99 363.739 111.61C372.189 105.25 378.849 96.4805 382.489 86.8805C383.399 84.4805 384.389 81.1405 384.229 80.9805C384.079 80.8405 376.939 79.0105 373.939 78.3405C367.059 76.8105 361.749 76.1705 353.529 75.8705C338.369 75.3205 321.829 78.6705 309.659 84.7505C297.459 90.8505 286.789 100.2 281.029 109.84C280.219 111.2 278.789 113.94 278.799 114.13C278.799 114.29 284.899 116.98 288.939 118.6C297.289 121.95 306.359 124.07 315.589 124.84Z"
                  fill="#fff"
                />
              </Svg>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[st.rolesEntryTitle, { fontFamily: "Nunito_800ExtraBold" }]}>
                {lang === "en" ? "Roles" : "Роли"}
              </Text>
              <Text style={[st.rolesEntrySub, { fontFamily: "Nunito_400Regular" }]}>
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
        <Animated.View entering={FadeInDown.delay(550).duration(400)} style={[st.tipsUnit, tipsAnim]}>
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
            <Text style={[st.tipsBtnText, { fontFamily: "Nunito_600SemiBold" }]}>
              {t("speakerTips")}
            </Text>
            <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.7)" />
          </Pressable>
        </Animated.View>
      </Animated.ScrollView>

      {payModal ? (
        <View style={st.modalOverlay}>
          <Animated.View entering={FadeIn.duration(180)} style={st.modalCard}>
            <View style={st.modalIcon}>
              <CoinIcon size={26} color="#F5A623" />
            </View>
            <Text style={st.modalTitle}>
              {lang === "en" ? "Enter Show Time again?" : "Ещё один выход в Show Time?"}
            </Text>
            <Text style={st.modalBody}>
              {coins >= SHOW_TIME_COST
                ? lang === "en"
                  ? `Today's free entry is used. This one costs ${SHOW_TIME_COST} coins. You have ${coins}.`
                  : `Бесплатный выход на сегодня использован. Этот стоит ${SHOW_TIME_COST} монет. У вас ${coins}.`
                : lang === "en"
                  ? `Not enough coins — you need ${SHOW_TIME_COST} and have ${coins}. Earn more by finishing levels.`
                  : `Не хватает монет — нужно ${SHOW_TIME_COST}, у вас ${coins}. Зарабатывайте, проходя уровни.`}
            </Text>
            <View style={st.modalBtns}>
              <Pressable
                onPress={() => setPayModal(false)}
                style={({ pressed }) => [st.modalBtn, st.modalBtnGhost, { opacity: pressed ? 0.8 : 1 }]}
              >
                <Text style={st.modalBtnGhostText}>
                  {lang === "en" ? "Cancel" : "Отмена"}
                </Text>
              </Pressable>
              {coins >= SHOW_TIME_COST ? (
                <Pressable
                  onPress={confirmPaidEntry}
                  style={({ pressed }) => [st.modalBtn, st.modalBtnPrimary, { opacity: pressed ? 0.85 : 1 }]}
                >
                  <CoinIcon size={15} color="#1A1A2E" />
                  <Text style={st.modalBtnPrimaryText}>{SHOW_TIME_COST}</Text>
                </Pressable>
              ) : null}
            </View>
          </Animated.View>
        </View>
      ) : null}
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
    width: 108,
    height: 107,
    marginBottom: -11,
    zIndex: 2,
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
    ...StyleSheet.absoluteFillObject,
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
