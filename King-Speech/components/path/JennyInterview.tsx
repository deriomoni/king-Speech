import React, { useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
} from "react-native-reanimated";
import { router } from "expo-router";
import VoiceRecorder from "@/components/VoiceRecorder";
import JennyAvatar from "@/components/JennyAvatar";
import { RankBackground } from "./RankBackground";
import { useTheme } from "@/context/ThemeContext";
import { buildJennyTopics, getRankTheme, pickLocalized, type RankTopic } from "./rankTheme";
import { useLang } from "@/context/LangContext";
import { useGame } from "@/context/GameContext";
import Colors from "@/constants/colors";

interface Props {
  rankIndex: number;
  onFinished: () => void;
}

export default function JennyInterview({ rankIndex, onFinished }: Props) {
  const theme = getRankTheme(rankIndex);
  const { lang } = useLang();
  const { themeMode } = useTheme();
  const { getWorstMetricsForRank } = useGame();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  // Snapshot the question list once on mount. We bias topic selection
  // toward the player's worst measured metrics for this rank — Jenny acts
  // like a coach instead of reciting a fixed script. With no recorded
  // metrics yet, this returns the original rank-themed topics unchanged.
  const [topics] = useState<RankTopic[]>(() =>
    buildJennyTopics(theme, getWorstMetricsForRank(rankIndex, 2))
  );
  const [step, setStep] = useState(0);
  const [done, setDone] = useState<boolean[]>(() => topics.map(() => false));
  const finishedRef = useRef(false);

  const currentQuestion = topics[step];

  const handleRecorded = (_durationSeconds: number) => {
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    setDone((prev) => {
      const next = [...prev];
      next[step] = true;
      return next;
    });
  };

  const handleSkip = () => {
    setDone((prev) => {
      const next = [...prev];
      next[step] = true;
      return next;
    });
  };

  const handleNext = () => {
    if (step < topics.length - 1) {
      setStep((s) => s + 1);
    } else if (!finishedRef.current) {
      finishedRef.current = true;
      // Small delay so the success state is visible before transitioning
      setTimeout(() => onFinished(), 280);
    }
  };

  const accentTextColor = theme.isDark ? theme.accent : theme.accentDark;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bgColors[0] }}>
      <RankBackground theme={theme} themeMode={themeMode} />

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: topPad + 12, paddingBottom: bottomPad + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => router.back()}
            style={[styles.iconBtn, { borderColor: theme.borderColor, backgroundColor: theme.cardBg }]}
            accessibilityRole="button"
            accessibilityLabel={lang === "en" ? "Back" : "Назад"}
          >
            <Ionicons name="chevron-back" size={20} color={theme.textPrimary} />
          </Pressable>
          <View style={[styles.captionBox, { borderColor: theme.borderColor, backgroundColor: theme.cardBg }]}>
            <Ionicons name="sparkles" size={12} color={accentTextColor} />
            <Text
              style={[
                styles.captionText,
                { color: accentTextColor, fontFamily: theme.fontFamily },
              ]}
            >
              {pickLocalized(theme.portalCaption, lang)}
            </Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        <Animated.View entering={FadeIn.duration(400)} style={styles.heroBlock}>
          <View style={styles.avatarWrap}>
            <JennyAvatar state="speaking" />
          </View>
          <Text style={[styles.heroName, { color: theme.textPrimary, fontFamily: theme.fontFamilyTitle }]}>
            {lang === "en" ? "Jenny" : "Дженни"}
          </Text>
          <Text style={[styles.heroSub, { color: theme.textSecondary, fontFamily: theme.fontFamily }]}>
            {lang === "en" ? "A short interview before the next rank" : "Короткое интервью перед новым рангом"}
          </Text>
        </Animated.View>

        <View style={styles.progressRow}>
          {topics.map((_, i) => (
            <View
              key={i}
              style={[
                styles.progressDot,
                {
                  backgroundColor:
                    done[i] ? theme.accent : i === step ? theme.accent + "55" : theme.borderColor,
                  width: i === step ? 28 : 10,
                },
              ]}
            />
          ))}
        </View>

        <Animated.View
          key={step}
          entering={FadeInDown.duration(360)}
          exiting={FadeOut.duration(180)}
          style={[styles.questionCard, { borderColor: theme.borderColor, backgroundColor: theme.cardBg }]}
        >
          <Text style={[styles.qLabel, { color: accentTextColor, fontFamily: theme.fontFamily }]}>
            {(lang === "en" ? "Question " : "Вопрос ") + (step + 1) + "/" + topics.length}
          </Text>
          <Text style={[styles.qText, { color: theme.textPrimary, fontFamily: theme.fontFamilyTitle }]}>
            {pickLocalized(currentQuestion, lang)}
          </Text>
        </Animated.View>

        {!done[step] ? (
          <View style={styles.recorderWrap}>
            <VoiceRecorder
              onRecordingComplete={handleRecorded}
              colors={Colors.dark}
            />
            <Pressable onPress={handleSkip} style={styles.skipBtn}>
              <Text style={[styles.skipText, { color: theme.textMuted, fontFamily: theme.fontFamily }]}>
                {lang === "en" ? "Skip this question" : "Пропустить вопрос"}
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.recordedRow}>
            <View style={[styles.recordedPill, { backgroundColor: theme.accentSoft, borderColor: theme.accent }]}>
              <Ionicons name="checkmark-circle" size={16} color={accentTextColor} />
              <Text style={[styles.recordedText, { color: accentTextColor, fontFamily: theme.fontFamilyTitle }]}>
                {lang === "en" ? "Answer saved" : "Ответ сохранён"}
              </Text>
            </View>
            <Pressable
              onPress={handleNext}
              style={({ pressed }) => [
                styles.nextBtn,
                { opacity: pressed ? 0.85 : 1 },
              ]}
              accessibilityRole="button"
              accessibilityLabel={lang === "en" ? "Next" : "Дальше"}
              testID="jenny-interview-next"
            >
              <LinearGradient
                colors={theme.portalGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[StyleSheet.absoluteFill, { borderRadius: 16 }]}
              />
              <Text style={[styles.nextText, { fontFamily: theme.fontFamilyTitle }]}>
                {step < topics.length - 1
                  ? lang === "en"
                    ? "Next question"
                    : "Следующий вопрос"
                  : lang === "en"
                  ? "Open the portal"
                  : "Открыть портал"}
              </Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: 18,
    gap: 18,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  captionBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
  },
  captionText: {
    fontSize: 12,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  heroBlock: {
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  avatarWrap: {
    width: 140,
    height: 140,
    alignItems: "center",
    justifyContent: "center",
  },
  heroName: { fontSize: 32 },
  heroSub: { fontSize: 14, textAlign: "center" },
  progressRow: {
    flexDirection: "row",
    gap: 8,
    alignSelf: "center",
    marginTop: 6,
  },
  progressDot: {
    height: 10,
    borderRadius: 5,
  },
  questionCard: {
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
    gap: 8,
  },
  qLabel: {
    fontSize: 12,
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  qText: {
    fontSize: 22,
    lineHeight: 30,
  },
  recorderWrap: {
    alignItems: "center",
    gap: 14,
    paddingVertical: 12,
  },
  skipBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  skipText: { fontSize: 13 },
  recordedRow: {
    alignItems: "center",
    gap: 14,
    paddingVertical: 12,
  },
  recordedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
  },
  recordedText: { fontSize: 13 },
  nextBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  nextText: { fontSize: 16, color: "#fff" },
});
