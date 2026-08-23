import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withTiming,
  withSequence,
  cancelAnimation,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import RecordingPlayer from "@/components/RecordingPlayer";
import { aspectsFromScore10 } from "@/components/ScoreFlower";
import type { AppColors } from "@/constants/colors";
import type { SpeechAnalysis } from "@/services/speechAnalysis";

interface Props {
  title: string;
  author?: string;
  category?: string;
  audioUri: string;
  durationSec: number;
  analysis: SpeechAnalysis | null;
  analyzing: boolean;
  colors: AppColors;
  isDark: boolean;
  t: (key: any) => string;
  lang: "ru" | "en";
  onRetry: () => void;
  onSave: (selfRating: number, saveToLibrary: boolean) => void;
  saving?: boolean;
}

function SelfStar({
  index,
  active,
  locked,
  hint,
  accent,
  trackColor,
  onPress,
}: {
  index: number;
  active: boolean;
  locked: boolean;
  hint: boolean; // unlocked but not yet rated → glow + blink to invite a tap
  accent: string;
  trackColor: string;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);
  const blink = useSharedValue(1);
  useEffect(() => {
    if (active) {
      scale.value = withSequence(withSpring(1.25, { damping: 6 }), withSpring(1));
    }
  }, [active]);
  useEffect(() => {
    if (hint && !active) {
      blink.value = withRepeat(withTiming(0.5, { duration: 650 }), -1, true);
    } else {
      cancelAnimation(blink);
      blink.value = withTiming(1, { duration: 200 });
    }
    return () => cancelAnimation(blink);
  }, [hint, active]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }], opacity: blink.value }));
  const glow = active || hint;
  const color = locked ? trackColor : active || hint ? accent : trackColor;
  return (
    <Pressable disabled={locked} onPress={onPress} hitSlop={6} style={({ pressed }) => ({ opacity: pressed && !locked ? 0.7 : 1 })}>
      <Animated.View
        style={[
          style,
          glow
            ? { shadowColor: accent, shadowOpacity: 0.8, shadowRadius: 9, shadowOffset: { width: 0, height: 0 }, elevation: 6 }
            : null,
        ]}
      >
        <Ionicons name={active ? "star" : "star-outline"} size={44} color={color} />
      </Animated.View>
    </Pressable>
  );
}

export default function ReadingResultsView({
  title,
  author,
  audioUri,
  durationSec,
  analysis,
  analyzing,
  colors,
  isDark,
  t,
  lang,
  onRetry,
  onSave,
  saving,
}: Props) {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const accent = "#FFC531"; // clean warm gold
  // When there's no audio to play back (mic blocked), don't trap the player —
  // unlock the rating immediately so they can still self-assess and continue.
  const [listenedFully, setListenedFully] = useState(!audioUri);
  const [selfRating, setSelfRating] = useState(0);
  const [showSavePrompt, setShowSavePrompt] = useState(false);

  const fg = isDark ? "#F4F1EA" : colors.text;
  const fgMuted = isDark ? "rgba(244,241,234,0.6)" : colors.textSecondary;
  const fgFaint = isDark ? "rgba(244,241,234,0.4)" : colors.textMuted;
  const cardBg = isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.75)";
  const cardBorder = isDark ? "rgba(255,255,255,0.10)" : "rgba(40,30,10,0.10)";
  const trackColor = isDark ? "rgba(255,255,255,0.14)" : "rgba(40,30,10,0.16)";
  // Plain theme background — light in light mode, dark in dark mode.
  const bg = [colors.background, colors.background] as const;

  // Clean the work title for a single line: drop the parenthetical subtitle and
  // strip quotes/brackets so it fits fully on one line.
  const cleanTitle =
    title
      .replace(/\s*[([{（][^)\]}）]*[)\]}）]\s*/g, " ") // remove (…) groups
      .replace(/[«»„“”"']/g, "") // strip quotes
      .replace(/\s+/g, " ")
      .trim() || title;

  const handlePlaybackComplete = () => {
    if (!listenedFully) {
      setListenedFully(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
  };

  const pickRating = (n: number) => {
    if (!listenedFully) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setSelfRating(n);
    setShowSavePrompt(true);
  };

  const canSave = selfRating > 0 && !saving;

  return (
    <View style={[st.container, { backgroundColor: bg[0] }]}>
      <LinearGradient colors={bg} style={StyleSheet.absoluteFill} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[st.scroll, { paddingTop: topPad + 24, paddingBottom: bottomPad + 36 }]}
      >
        {/* Hero — work + author */}
        <Animated.View entering={FadeInDown.duration(500)} style={st.hero}>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.5}
            style={[st.workTitle, { color: fg, fontFamily: "Rubik_700Bold" }]}
          >
            {cleanTitle}
          </Text>
          {author ? (
            <Text style={[st.author, { color: fgMuted, fontFamily: "Nunito_400Regular" }]}>{author}</Text>
          ) : null}
        </Animated.View>

        {/* Listen-back */}
        <Animated.View entering={FadeInDown.delay(120).duration(500)} style={st.section}>
          <View style={st.sectionHead}>
            <Text style={[st.sectionLabel, { color: accent, fontFamily: "Rubik_600SemiBold" }]}>
              {t("listenYourself")}
            </Text>
          </View>
          <RecordingPlayer
            uri={audioUri}
            accentColor={accent}
            trackColor={trackColor}
            textColor={fgMuted}
            autoPlay
            onComplete={handlePlaybackComplete}
          />
          {!listenedFully ? (
            <View style={[st.hintRow, { backgroundColor: accent + "14", borderColor: accent + "33" }]}>
              <Ionicons name="information-circle-outline" size={15} color={accent} />
              <Text style={[st.hintText, { color: fgMuted, fontFamily: "Nunito_400Regular" }]}>
                {t("listenBackHint")}
              </Text>
            </View>
          ) : null}
        </Animated.View>

        {/* Self-rating board */}
        <Animated.View
          entering={FadeInDown.delay(220).duration(500)}
          style={[st.ratingCard, { backgroundColor: cardBg, borderColor: cardBorder, opacity: listenedFully ? 1 : 0.7 }]}
        >
          <View style={st.sectionHead}>
            <Text style={[st.sectionLabel, { color: listenedFully ? accent : fgFaint, fontFamily: "Rubik_600SemiBold" }]}>
              {t("rateYourself")}
            </Text>
          </View>

          <View style={st.starsRow}>
            {[1, 2, 3, 4, 5].map((n) => (
              <SelfStar
                key={n}
                index={n}
                active={n <= selfRating}
                locked={!listenedFully}
                hint={listenedFully && selfRating === 0}
                accent={accent}
                trackColor={trackColor}
                onPress={() => pickRating(n)}
              />
            ))}
          </View>

        </Animated.View>

        {/* Save-to-library prompt — pops up once the player has rated */}
        {showSavePrompt ? (
          <Animated.View
            entering={FadeInDown.duration(300)}
            style={[st.savePrompt, { backgroundColor: cardBg, borderColor: cardBorder }]}
          >
            <Text style={[st.savePromptText, { color: fg, fontFamily: "Rubik_600SemiBold" }]}>
              {lang === "ru" ? "Сохранить в библиотеку?" : "Save to library?"}
            </Text>
            <View style={st.savePromptBtns}>
              <Pressable
                onPress={() => canSave && onSave(selfRating, true)}
                disabled={!canSave}
                style={({ pressed }) => [st.yesNoBtn, { backgroundColor: accent + "22", borderColor: accent, opacity: !canSave ? 0.5 : pressed ? 0.8 : 1 }]}
              >
                <Text style={[st.yesNoText, { color: fg, fontFamily: "Rubik_600SemiBold" }]}>
                  {lang === "ru" ? "Да" : "Yes"}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setShowSavePrompt(false)}
                style={({ pressed }) => [st.yesNoBtn, { backgroundColor: accent + "22", borderColor: accent, opacity: pressed ? 0.8 : 1 }]}
              >
                <Text style={[st.yesNoText, { color: fg, fontFamily: "Rubik_600SemiBold" }]}>
                  {lang === "ru" ? "Нет" : "No"}
                </Text>
              </Pressable>
            </View>
          </Animated.View>
        ) : null}

        {/* Actions */}
        <Animated.View entering={FadeInDown.delay(320).duration(500)} style={st.actions}>
          <Pressable
            onPress={onRetry}
            disabled={saving}
            style={({ pressed }) => [
              st.retryBtn,
              { borderColor: cardBorder, backgroundColor: cardBg, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Ionicons name="refresh" size={18} color={fgMuted} />
            <Text style={[st.retryText, { color: fgMuted, fontFamily: "Nunito_600SemiBold" }]}>
              {t("replay")}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => canSave && onSave(selfRating, false)}
            disabled={!canSave}
            style={({ pressed }) => [
              st.saveBtn,
              { backgroundColor: accent, opacity: !canSave ? 0.4 : pressed ? 0.88 : 1 },
            ]}
          >
            <Text style={[st.saveText, { color: "#1A1404", fontFamily: "Nunito_700Bold" }]}>
              {lang === "ru" ? "Дальше" : "Next"}
            </Text>
            <Ionicons name="arrow-forward" size={18} color="#1A1404" />
          </Pressable>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

function LoadingDot({ index, color }: { index: number; color: string }) {
  const op = useSharedValue(0.3);
  useEffect(() => {
    op.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 400 }),
        withTiming(0.3, { duration: 400 }),
      ),
      -1,
      false,
    );
    return () => cancelAnimation(op);
  }, []);
  const style = useAnimatedStyle(() => ({ opacity: op.value }));
  return <Animated.View style={[{ width: 7, height: 7, borderRadius: 4, backgroundColor: color, marginLeft: index === 0 ? 0 : 6 }, style]} />;
}

const st = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 22, gap: 18 },
  hero: { alignItems: "center", gap: 6, marginBottom: 4 },
  kicker: { fontSize: 11, letterSpacing: 2 },
  workTitle: { fontSize: 22, textAlign: "center", letterSpacing: 0.2, lineHeight: 28 },
  author: { fontSize: 15, fontStyle: "italic", textAlign: "center" },
  section: { gap: 10 },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  sectionLabel: { fontSize: 12, letterSpacing: 1, textTransform: "uppercase" },
  hintRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  hintText: { flex: 1, fontSize: 12.5, lineHeight: 17 },
  ratingCard: { borderRadius: 22, borderWidth: 1, padding: 18, gap: 14 },
  savePrompt: { borderRadius: 18, borderWidth: 1, padding: 16, gap: 12, alignItems: "center" },
  savePromptText: { fontSize: 15.5, textAlign: "center" },
  savePromptBtns: { flexDirection: "row", gap: 12, justifyContent: "center" },
  yesNoBtn: { minWidth: 100, alignItems: "center", justifyContent: "center", paddingVertical: 11, borderRadius: 14, borderWidth: 1 },
  yesNoText: { fontSize: 15 },
  starsRow: { flexDirection: "row", justifyContent: "center", gap: 18, paddingVertical: 8 },
  rateHint: { fontSize: 12.5, textAlign: "center", lineHeight: 17 },
  divider: { height: 1, marginVertical: 2 },
  aiHead: { flexDirection: "row", alignItems: "center", gap: 6 },
  aiLabel: { fontSize: 11, letterSpacing: 1, textTransform: "uppercase" },
  aiLoading: { alignItems: "center", gap: 10, paddingVertical: 8 },
  dots: { flexDirection: "row" },
  aiLoadingText: { fontSize: 13, textAlign: "center" },
  aiResult: { gap: 12 },
  metricsTable: { width: "100%" },
  metricRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10 },
  metricLabel: { fontSize: 15 },
  metricValue: { fontSize: 16 },
  tipCard: { flexDirection: "row", gap: 8, alignItems: "flex-start", padding: 11, borderRadius: 12, borderWidth: 1 },
  tipText: { flex: 1, fontSize: 13, lineHeight: 18 },
  actions: { flexDirection: "row", gap: 12, marginTop: 2 },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 15,
    paddingHorizontal: 18,
    borderRadius: 16,
    borderWidth: 1,
  },
  retryText: { fontSize: 15 },
  saveBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 15,
    borderRadius: 16,
  },
  saveText: { fontSize: 15 },
});
