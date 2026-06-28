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
  onSave: (selfRating: number) => void;
  saving?: boolean;
}

function SelfStar({
  index,
  active,
  locked,
  accent,
  trackColor,
  onPress,
}: {
  index: number;
  active: boolean;
  locked: boolean;
  accent: string;
  trackColor: string;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);
  useEffect(() => {
    if (active) {
      scale.value = withSequence(withSpring(1.25, { damping: 6 }), withSpring(1));
    }
  }, [active]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Pressable disabled={locked} onPress={onPress} hitSlop={6} style={({ pressed }) => ({ opacity: pressed && !locked ? 0.7 : 1 })}>
      <Animated.View style={style}>
        <Ionicons
          name={active ? "star" : "star-outline"}
          size={44}
          color={locked ? trackColor : active ? accent : trackColor}
        />
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

  const accent = "#C9A227"; // warm gold, exclusive to the reading review
  // When there's no audio to play back (mic blocked), don't trap the player —
  // unlock the rating immediately so they can still self-assess and continue.
  const [listenedFully, setListenedFully] = useState(!audioUri);
  const [selfRating, setSelfRating] = useState(0);

  const fg = isDark ? "#F4F1EA" : colors.text;
  const fgMuted = isDark ? "rgba(244,241,234,0.6)" : colors.textSecondary;
  const fgFaint = isDark ? "rgba(244,241,234,0.4)" : colors.textMuted;
  const cardBg = isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.75)";
  const cardBorder = isDark ? "rgba(255,255,255,0.10)" : "rgba(40,30,10,0.10)";
  const trackColor = isDark ? "rgba(255,255,255,0.14)" : "rgba(40,30,10,0.16)";
  const bg = isDark
    ? (["#0B0A07", "#14110A", "#0B0A07"] as const)
    : (["#F3EEE2", "#EFE8D8", "#F1ECDD"] as const);

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
  };

  const aiStars = analysis ? Math.max(0, Math.min(5, Math.round(analysis.score.overall / 2))) : 0;
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
          <Text style={[st.kicker, { color: accent, fontFamily: "Inter_600SemiBold" }]}>
            {t("readingReviewTitle").toUpperCase()}
          </Text>
          <Text style={[st.workTitle, { color: fg, fontFamily: "Rubik_700Bold" }]}>{title}</Text>
          {author ? (
            <Text style={[st.author, { color: fgMuted, fontFamily: "Nunito_400Regular" }]}>{author}</Text>
          ) : null}
        </Animated.View>

        {/* Listen-back */}
        <Animated.View entering={FadeInDown.delay(120).duration(500)} style={st.section}>
          <View style={st.sectionHead}>
            <Ionicons name="headset" size={16} color={accent} />
            <Text style={[st.sectionLabel, { color: accent, fontFamily: "Inter_600SemiBold" }]}>
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
              <Text style={[st.hintText, { color: fgMuted, fontFamily: "Inter_400Regular" }]}>
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
            <Ionicons name={listenedFully ? "ribbon" : "lock-closed"} size={16} color={listenedFully ? accent : fgFaint} />
            <Text style={[st.sectionLabel, { color: listenedFully ? accent : fgFaint, fontFamily: "Inter_600SemiBold" }]}>
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
                accent={accent}
                trackColor={trackColor}
                onPress={() => pickRating(n)}
              />
            ))}
          </View>

          <Text style={[st.rateHint, { color: fgMuted, fontFamily: "Inter_400Regular" }]}>
            {listenedFully ? t("rateUnlockedHint") : t("rateLockedHint")}
          </Text>

          {/* Divider */}
          <View style={[st.divider, { backgroundColor: cardBorder }]} />

          {/* AI verdict — runs in the background while the player listens */}
          <View style={st.aiHead}>
            <Ionicons name="sparkles" size={14} color={accent} />
            <Text style={[st.aiLabel, { color: fgMuted, fontFamily: "Inter_600SemiBold" }]}>
              {t("aiVerdict")}
            </Text>
          </View>

          {analyzing && !analysis ? (
            <Animated.View entering={FadeIn.duration(300)} style={st.aiLoading}>
              <View style={st.dots}>
                {[0, 1, 2].map((i) => (
                  <LoadingDot key={i} index={i} color={accent} />
                ))}
              </View>
              <Text style={[st.aiLoadingText, { color: fgFaint, fontFamily: "Inter_400Regular" }]}>
                {t("aiListening")}
              </Text>
            </Animated.View>
          ) : analysis ? (
            <Animated.View entering={FadeInUp.duration(400)} style={st.aiResult}>
              <View style={st.aiScoreRow}>
                <View style={st.aiStarsRow}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Ionicons
                      key={n}
                      name={n <= aiStars ? "star" : "star-outline"}
                      size={18}
                      color={n <= aiStars ? accent : trackColor}
                    />
                  ))}
                </View>
                <Text style={[st.aiScoreText, { color: fg, fontFamily: "Inter_700Bold" }]}>
                  {analysis.score.overall.toFixed(1)}/10
                </Text>
              </View>
              {analysis.summary ? (
                <Text style={[st.aiSummary, { color: fg, fontFamily: "Inter_500Medium" }]}>
                  {analysis.summary}
                </Text>
              ) : null}
              {analysis.tip ? (
                <View style={[st.tipCard, { backgroundColor: accent + "12", borderColor: accent + "33" }]}>
                  <Ionicons name="bulb" size={14} color={accent} />
                  <Text style={[st.tipText, { color: fgMuted, fontFamily: "Inter_400Regular" }]}>
                    {analysis.tip}
                  </Text>
                </View>
              ) : null}
            </Animated.View>
          ) : (
            <Text style={[st.aiLoadingText, { color: fgFaint, fontFamily: "Inter_400Regular" }]}>
              {t("aiListening")}
            </Text>
          )}
        </Animated.View>

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
            <Text style={[st.retryText, { color: fgMuted, fontFamily: "Inter_600SemiBold" }]}>
              {t("replay")}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => canSave && onSave(selfRating)}
            disabled={!canSave}
            style={({ pressed }) => [
              st.saveBtn,
              { backgroundColor: accent, opacity: !canSave ? 0.4 : pressed ? 0.88 : 1 },
            ]}
          >
            <Text style={[st.saveText, { color: "#1A1404", fontFamily: "Inter_700Bold" }]}>
              {t("saveAndContinue")}
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
  workTitle: { fontSize: 26, textAlign: "center", letterSpacing: 0.2, lineHeight: 32 },
  author: { fontSize: 15, fontStyle: "italic", textAlign: "center" },
  section: { gap: 10 },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: 7 },
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
  starsRow: { flexDirection: "row", justifyContent: "center", gap: 10, paddingVertical: 4 },
  rateHint: { fontSize: 12.5, textAlign: "center", lineHeight: 17 },
  divider: { height: 1, marginVertical: 2 },
  aiHead: { flexDirection: "row", alignItems: "center", gap: 6 },
  aiLabel: { fontSize: 11, letterSpacing: 1, textTransform: "uppercase" },
  aiLoading: { alignItems: "center", gap: 10, paddingVertical: 8 },
  dots: { flexDirection: "row" },
  aiLoadingText: { fontSize: 13, textAlign: "center" },
  aiResult: { gap: 10 },
  aiScoreRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  aiStarsRow: { flexDirection: "row", gap: 3 },
  aiScoreText: { fontSize: 16 },
  aiSummary: { fontSize: 14, lineHeight: 20 },
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
