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
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import RiveAnim from "@/components/RiveAnim";

const GOLD = "#FFD166";
const GOLD_DEEP = "#FF9F43";

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
const RIVE_SIZE = 180;

function ProgressBar() {
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
    <View style={styles.progressTrack}>
      <Animated.View style={[styles.progressFill, fillStyle]}>
        <LinearGradient
          colors={[GOLD, GOLD_DEEP]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

function RotatingPhrase({ phrases }: { phrases: string[] }) {
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
        style={styles.phraseText}
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
        { paddingTop: topPad, paddingBottom: bottomPad },
      ]}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={phrases[0]}
      testID="speech-analyzing-loader"
    >
      <View style={styles.center}>
        <RiveAnim
          source={require("@/assets/rive/loading.riv")}
          style={styles.rive}
          fit="contain"
          alignment="center"
          autoplay
        />

        <RotatingPhrase phrases={phrases} />

        <ProgressBar />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(7, 13, 26, 0.92)",
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
  rive: {
    width: RIVE_SIZE,
    height: RIVE_SIZE,
    backgroundColor: "transparent",
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
    color: "#F0EDE8",
    fontFamily: "Inter_400Regular",
    fontStyle: "italic",
    textAlign: "center",
  },
  progressTrack: {
    width: 220,
    height: 3,
    borderRadius: 2,
    backgroundColor: "rgba(255, 255, 255, 0.10)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
    overflow: "hidden",
  },
});
