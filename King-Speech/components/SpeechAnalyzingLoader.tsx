import React, { useEffect, useState } from "react";
import { View, StyleSheet, Platform } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  cancelAnimation,
  runOnJS,
  Easing,
  FadeIn,
  FadeOut,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import OscarMascot from "@/components/OscarMascot";
import { useTheme } from "@/context/ThemeContext";


const PHRASES_RU = [
  "Анализируем вашу речь…",
  "Слушаем интонации…",
  "Считаем слова-паразиты…",
  "Оцениваем чёткость дикции…",
  "Проверяем громкость…",
  "Сверяем темп речи…",
  "Готовим персональный отчёт…",
];

const PHRASES_EN = [
  "Analyzing your speech…",
  "Listening to your intonation…",
  "Counting filler words…",
  "Measuring diction clarity…",
  "Checking your volume…",
  "Tracking your tempo…",
  "Preparing your personal report…",
];

const PHRASE_INTERVAL_MS = 2000;
const PROGRESS_DURATION_MS = 4500;
// Figma 36:1252 "Show Time · Анализ речи (loader)": 200pt Oscar, 16pt line,
// 220×3 gold progress on a faint track, all on the app background.
const RIVE_SIZE = 200;

function ProgressBar() {
  const { theme, themeMode } = useTheme();
  const w = useSharedValue(0);

  useEffect(() => {
    w.value = withTiming(1, {
      duration: PROGRESS_DURATION_MS,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
    });
    return () => cancelAnimation(w);
  }, []);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${Math.min(1, w.value) * 100}%`,
  }));

  return (
    <View style={[styles.progressTrack, { backgroundColor: themeMode === "dark" ? "rgba(240,238,233,0.1)" : "rgba(38,38,40,0.1)" }]}>
      <Animated.View style={[styles.progressFill, { backgroundColor: theme.accent }, fillStyle]} />
    </View>
  );
}

function RotatingPhrase({ phrases }: { phrases: string[] }) {
  const { theme } = useTheme();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % phrases.length);
    }, PHRASE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [phrases]);

  return (
    <View style={styles.phraseRow}>
      <Animated.Text
        key={index}
        entering={FadeIn.duration(400)}
        exiting={FadeOut.duration(300)}
        style={[styles.phraseText, { color: theme.text }]}
        numberOfLines={2}
      >
        {phrases[index]}
      </Animated.Text>
    </View>
  );
}

interface Props {
  visible: boolean;
  lang: "ru" | "en";
}

export default function SpeechAnalyzingLoader({ visible, lang }: Props) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  // Keep the overlay mounted while it's visible AND while it's fading out.
  // The opacity is driven by a shared value so the FadeOut actually runs
  // before the component is removed from the tree (relying on reanimated's
  // `exiting` prop fails here because we conditionally render the overlay
  // and the parent unmounts it in the same render pass).
  const [keepMounted, setKeepMounted] = useState(visible);
  const opacity = useSharedValue(visible ? 1 : 0);

  useEffect(() => {
    if (visible) {
      setKeepMounted(true);
      opacity.value = withTiming(1, { duration: 300, easing: Easing.out(Easing.quad) });
    } else {
      opacity.value = withTiming(
        0,
        { duration: 400, easing: Easing.in(Easing.quad) },
        (finished) => {
          if (finished) runOnJS(setKeepMounted)(false);
        },
      );
    }
  }, [visible]);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  if (!keepMounted) return null;

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const phrases = lang === "en" ? PHRASES_EN : PHRASES_RU;

  return (
    <Animated.View
      style={[
        styles.overlay,
        overlayStyle,
        { backgroundColor: theme.bg },
        { paddingTop: topPad, paddingBottom: bottomPad },
      ]}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={phrases[0]}
      testID="speech-analyzing-loader"
    >
      <View style={styles.center}>
        {/* Oscar "thinks" over the recording while the AI analyzes it */}
        <OscarMascot emotion="notsure" size={RIVE_SIZE} />

        <RotatingPhrase phrases={phrases} />

        <ProgressBar />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
    elevation: 9999,
    paddingHorizontal: 24,
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
    gap: 28,
    width: "100%",
    maxWidth: 340,
  },
  phraseRow: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  phraseText: {
    fontSize: 16,
    lineHeight: 22,
    fontFamily: "Geologica_400Regular",
    textAlign: "center",
  },
  progressTrack: {
    width: 220,
    height: 3,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
    overflow: "hidden",
  },
});
