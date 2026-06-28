import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  Modal,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  Easing,
  FadeIn,
  FadeInDown,
  SlideInUp,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useAppColors } from "@/hooks/useAppColors";
import { useGame, LevelType, Task, getBaseType } from "@/context/GameContext";
import { useLang } from "@/context/LangContext";
import { useDevTools } from "@/context/DevToolsContext";
import VoiceRecorder from "@/components/WaveformVoiceRecorder";
import ReadingLevelView from "@/components/ReadingLevelView";
import ReadingResultsView from "@/components/ReadingResultsView";
import WarmupLevelView from "@/components/warmup/WarmupLevelView";
import DevSkipButton from "@/components/DevSkipButton";
import { getModuleFromLevelId } from "@/constants/contentLoader";
import SpeechAnalyzingLoader from "@/components/SpeechAnalyzingLoader";
import { getReadingMeta, getLevelsData } from "@/constants/gameContent";
import {
  getLiterature,
  getModuleFromReadingId,
  getLiteratureFullText,
  literatureCategory,
} from "@/constants/literatureLoader";
import {
  getTongueTwistersForModule,
  getModuleFromTongueTwisterId,
} from "@/constants/tongueTwisterLoader";
import { analyzeSpeech, generateTips, FILLERS, type SpeechAnalysis } from "@/services/speechAnalysis";
import { getApiUrl } from "@/lib/query-client";
import { fetch as expoFetch } from "expo/fetch";
import { ActivityIndicator } from "react-native";

// ---- Results screen (premium gaming look) ----
// Score palette is exclusive to this evaluation surface — replaces the
// app-wide gold/emerald pair with cooler, premium tones (mint / lavender /
// coral) so the eval feels like a distinct "judging" moment.
const RS_HIGH = "#5EEAD4";   // aqua mint  (>=8)
const RS_MID  = "#C4B5FD";   // lavender    (>=6)
const RS_LOW  = "#FB7185";   // coral pink  (<6) — only red-ish tone in app, intentionally allowed here

// Transcript display: collapse anything longer than this so the sheet stays
// scannable at a glance. The user can tap to reveal the rest.
const TRANSCRIPT_COLLAPSED_CHARS = 180;

// Split transcript into ordered segments, marking which segments are filler
// words. Multi-word fillers ("you know", "как бы") match too, and word
// boundaries are checked so "umpire" doesn't get tagged as "um".
function highlightFillers(
  text: string,
  lang: "ru" | "en",
): Array<{ text: string; isFiller: boolean }> {
  if (!text) return [];
  const lower = text.toLowerCase();
  const fillers = FILLERS[lang] ?? [];
  // Longest first so multi-word fillers win over their single-word prefixes.
  const sorted = [...fillers].sort((a, b) => b.length - a.length);
  const isWordChar = (c: string) => /[\p{L}\p{N}]/u.test(c);
  const ranges: Array<[number, number]> = [];

  for (const filler of sorted) {
    const len = filler.length;
    let idx = 0;
    while ((idx = lower.indexOf(filler, idx)) !== -1) {
      const before = idx === 0 ? " " : lower[idx - 1];
      const after = idx + len >= lower.length ? " " : lower[idx + len];
      if (!isWordChar(before) && !isWordChar(after)) {
        const overlaps = ranges.some(([s, e]) => idx < e && idx + len > s);
        if (!overlaps) ranges.push([idx, idx + len]);
      }
      idx += 1;
    }
  }

  ranges.sort((a, b) => a[0] - b[0]);
  const segs: Array<{ text: string; isFiller: boolean }> = [];
  let pos = 0;
  for (const [start, end] of ranges) {
    if (start > pos) segs.push({ text: text.slice(pos, start), isFiller: false });
    segs.push({ text: text.slice(start, end), isFiller: true });
    pos = end;
  }
  if (pos < text.length) segs.push({ text: text.slice(pos), isFiller: false });
  return segs;
}

const TranscriptBlock = React.memo(function TranscriptBlock({
  transcript,
  lang,
  fgText,
  fgMuted,
  cardBg,
  cardBorder,
  accent,
  fillerBg,
}: {
  transcript: string;
  lang: "ru" | "en";
  fgText: string;
  fgMuted: string;
  cardBg: string;
  cardBorder: string;
  accent: string;
  fillerBg: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const isLong = transcript.length > TRANSCRIPT_COLLAPSED_CHARS;
  const visibleText =
    !isLong || expanded
      ? transcript
      : transcript.slice(0, TRANSCRIPT_COLLAPSED_CHARS).trimEnd() + "…";
  const segments = React.useMemo(
    () => highlightFillers(visibleText, lang),
    [visibleText, lang],
  );

  const toggle = () => {
    if (!isLong) return;
    setExpanded((v) => !v);
  };

  const expandLabel = expanded
    ? lang === "ru" ? "Свернуть" : "Show less"
    : lang === "ru" ? "Показать всё" : "Show all";

  const cardA11yLabel = lang === "ru"
    ? "Что мы услышали из вашей записи"
    : "What we heard from your recording";
  const cardA11yHint = isLong
    ? (expanded
        ? (lang === "ru" ? "Нажмите, чтобы свернуть полный текст" : "Tap to collapse the full transcript")
        : (lang === "ru" ? "Нажмите, чтобы показать полный текст" : "Tap to show the full transcript"))
    : undefined;

  return (
    <Animated.View
      entering={FadeInDown.delay(250).duration(400)}
      style={rs.feedbackSection}
      testID="transcript-block"
    >
      <View style={rs.transcriptHeader}>
        <Ionicons name="ear-outline" size={16} color={fgMuted} />
        <Text style={[rs.feedbackTitle, { color: fgText, fontFamily: "Inter_600SemiBold" }]}>
          {lang === "ru" ? "Что мы услышали" : "What we heard"}
        </Text>
      </View>
      <Pressable
        onPress={toggle}
        disabled={!isLong}
        accessibilityRole={isLong ? "button" : undefined}
        accessibilityState={isLong ? { expanded } : undefined}
        accessibilityLabel={cardA11yLabel}
        accessibilityHint={cardA11yHint}
        testID="transcript-toggle"
        style={({ pressed }) => [
          rs.transcriptCard,
          {
            backgroundColor: cardBg,
            borderColor: cardBorder,
            opacity: pressed && isLong ? 0.85 : 1,
          },
        ]}
      >
        <Text style={[rs.transcriptText, { color: fgText, fontFamily: "Inter_400Regular" }]}>
          {segments.map((seg, i) =>
            seg.isFiller ? (
              <Text
                key={i}
                style={{
                  color: accent,
                  backgroundColor: fillerBg,
                  fontFamily: "Inter_600SemiBold",
                }}
              >
                {seg.text}
              </Text>
            ) : (
              <Text key={i}>{seg.text}</Text>
            ),
          )}
        </Text>
        {isLong ? (
          <View style={rs.transcriptToggleRow}>
            <Text style={[rs.transcriptToggleText, { color: fgMuted, fontFamily: "Inter_500Medium" }]}>
              {expandLabel}
            </Text>
            <Ionicons
              name={expanded ? "chevron-up" : "chevron-down"}
              size={14}
              color={fgMuted}
            />
          </View>
        ) : null}
      </Pressable>
    </Animated.View>
  );
});

function ResultsSheet({
  visible,
  analysis,
  task,
  analyzing,
  onRetry,
  onNext,
  colors,
  isDark,
  t,
  lang,
}: {
  visible: boolean;
  analysis: SpeechAnalysis | null;
  task: Task | null;
  analyzing: boolean;
  onRetry: () => void;
  onNext: () => void;
  colors: import("@/constants/colors").AppColors;
  isDark: boolean;
  t: (key: any) => string;
  lang: "ru" | "en";
}) {
  if (!task) return null;

  // Loading state is now owned by the full-screen `SpeechAnalyzingLoader`
  // (rendered next to this sheet by the parent screen). Returning null
  // here while `analyzing === true` — or while the analysis result hasn't
  // arrived yet — prevents the old modal "Analyzing your recording…"
  // sheet from sitting on top of (and hiding) the new animated loader.
  if (!analysis || analyzing) {
    return null;
  }

  const params: Array<{ key: keyof typeof analysis.score; label: string }> = [
    { key: "clarity", label: t("clarity") },
    { key: "confidence", label: t("confidence") },
    { key: "volume", label: t("volume") },
    { key: "tempo", label: t("tempo") },
    { key: "expressiveness", label: t("expressiveness") },
    { key: "pauses", label: t("pauses") },
  ];

  const score = analysis.score.overall;
  const tone = (v: number) => (v >= 8 ? RS_HIGH : v >= 6 ? RS_MID : RS_LOW);
  const scoreColor = tone(score);

  // Premium background: deep black gradient (dark mode) or soft cream
  // gradient (light mode). Both have a subtle accent halo behind the score.
  const bgColors = isDark
    ? (["#06060A", "#15151F", "#0A0A12"] as const)
    : (["#F8FAFC", "#EEF1F7", "#F4F4F7"] as const);
  const haloColor = isDark ? "rgba(124,58,237,0.18)" : "rgba(124,58,237,0.10)";
  const fgText = isDark ? "#F8F8FB" : colors.text;
  const fgMuted = isDark ? "rgba(248,248,251,0.55)" : colors.textSecondary;
  const fgFaint = isDark ? "rgba(248,248,251,0.35)" : colors.textMuted;
  const trackBg = isDark ? "rgba(255,255,255,0.07)" : "rgba(15,15,30,0.07)";
  const handleBg = isDark ? "rgba(255,255,255,0.18)" : "rgba(15,15,30,0.18)";
  const retryBg = isDark ? "rgba(255,255,255,0.06)" : "rgba(15,15,30,0.04)";
  const retryBorder = isDark ? "rgba(255,255,255,0.10)" : "rgba(15,15,30,0.08)";
  const nextBg = isDark ? "#FFFFFF" : "#0F0F1E";
  const nextFg = isDark ? "#0A0A12" : "#FFFFFF";

  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen">
      <View style={rs.overlay}>
        <View style={[rs.sheet, { backgroundColor: bgColors[0] }]}>
          <LinearGradient
            colors={bgColors}
            style={StyleSheet.absoluteFill}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
          />
          {/* Soft accent halo behind score */}
          <View pointerEvents="none" style={[rs.halo, { backgroundColor: haloColor }]} />

          <View style={[rs.handle, { backgroundColor: handleBg }]} />

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={rs.content}>
            {/* Score */}
            <Animated.View entering={FadeIn.duration(400)} style={rs.scoreSection}>
              <View style={[rs.scoreBig, { borderColor: scoreColor, shadowColor: scoreColor }]}>
                <Text style={[rs.scoreNumber, { color: scoreColor, fontFamily: "Inter_700Bold" }]}>
                  {score}
                </Text>
                <Text style={[rs.scoreDenom, { color: fgFaint, fontFamily: "Inter_400Regular" }]}>
                  /10
                </Text>
              </View>
              <Text style={[rs.scoreSummary, { color: fgText, fontFamily: "Inter_600SemiBold" }]}>
                {analysis.summary}
              </Text>
            </Animated.View>

            {/* Param bars */}
            <Animated.View entering={FadeInDown.delay(100).duration(400)} style={rs.paramsSection}>
              {params.map((p) => {
                const val = analysis.score[p.key] as number;
                return (
                  <View key={p.key} style={rs.paramRow}>
                    <Text style={[rs.paramLabel, { color: fgMuted, fontFamily: "Inter_400Regular" }]}>
                      {p.label}
                    </Text>
                    <View style={[rs.paramBarBg, { backgroundColor: trackBg }]}>
                      <Animated.View
                        style={[
                          rs.paramBarFill,
                          {
                            backgroundColor: tone(val),
                            width: `${(val / 10) * 100}%` as any,
                          },
                        ]}
                      />
                    </View>
                    <Text style={[rs.paramValue, { color: fgText, fontFamily: "Inter_600SemiBold" }]}>
                      {val.toFixed(1)}
                    </Text>
                  </View>
                );
              })}
            </Animated.View>

            {/* Strengths */}
            <Animated.View entering={FadeInDown.delay(200).duration(400)} style={rs.feedbackSection}>
              <Text style={[rs.feedbackTitle, { color: fgText, fontFamily: "Inter_600SemiBold" }]}>
                {t("strengths")}
              </Text>
              {analysis.strengths.map((s, i) => (
                <View key={i} style={rs.feedbackRow}>
                  <View style={[rs.dot, { backgroundColor: RS_HIGH }]} />
                  <Text style={[rs.feedbackText, { color: fgMuted, fontFamily: "Inter_400Regular" }]}>
                    {s}
                  </Text>
                </View>
              ))}
            </Animated.View>

            {/* Recommendations */}
            <Animated.View entering={FadeInDown.delay(300).duration(400)} style={rs.feedbackSection}>
              <Text style={[rs.feedbackTitle, { color: fgText, fontFamily: "Inter_600SemiBold" }]}>
                {t("growthPoints")}
              </Text>
              {analysis.recommendations.map((r, i) => (
                <View key={i} style={rs.feedbackRow}>
                  <View style={[rs.dot, { backgroundColor: RS_MID }]} />
                  <Text style={[rs.feedbackText, { color: fgMuted, fontFamily: "Inter_400Regular" }]}>
                    {r}
                  </Text>
                </View>
              ))}
            </Animated.View>

            {/* What we heard — surfaces the raw transcript so users can
                see what the analyzer actually scored against. Filler words
                are highlighted in the score-tone accent so the clarity /
                confidence drop becomes visible at a glance. */}
            {analysis.transcript && analysis.transcript.trim().length > 0 ? (
              <TranscriptBlock
                transcript={analysis.transcript.trim()}
                lang={lang}
                fgText={fgText}
                fgMuted={fgMuted}
                cardBg={isDark ? "rgba(255,255,255,0.04)" : "rgba(15,15,30,0.03)"}
                cardBorder={isDark ? "rgba(255,255,255,0.08)" : "rgba(15,15,30,0.08)"}
                accent={RS_LOW}
                fillerBg={RS_LOW + "22"}
              />
            ) : null}

            {/* Personal tip — derived from the weakest criterion. */}
            {analysis.tip ? (
              <Animated.View entering={FadeInDown.delay(350).duration(400)} style={[rs.tipCard, { borderColor: scoreColor + "55", backgroundColor: scoreColor + "12" }]}>
                <View style={rs.tipHeader}>
                  <Ionicons name="bulb" size={16} color={scoreColor} />
                  <Text style={[rs.tipLabel, { color: scoreColor, fontFamily: "Inter_600SemiBold" }]}>
                    {lang === "ru" ? "Совет на следующий раз" : "Tip for next take"}
                  </Text>
                </View>
                <Text style={[rs.tipText, { color: fgText, fontFamily: "Inter_500Medium" }]}>
                  {analysis.tip}
                </Text>
              </Animated.View>
            ) : null}

            {/* Buttons */}
            <Animated.View entering={FadeInDown.delay(400).duration(400)} style={rs.btnRow}>
              <Pressable
                onPress={onRetry}
                style={({ pressed }) => [
                  rs.retryBtn,
                  { backgroundColor: retryBg, borderColor: retryBorder, opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <Ionicons name="refresh" size={18} color={fgMuted} />
                <Text style={[rs.retryBtnText, { color: fgMuted, fontFamily: "Inter_600SemiBold" }]}>
                  {t("again")}
                </Text>
              </Pressable>
              <Pressable
                onPress={onNext}
                style={({ pressed }) => [
                  rs.nextBtn,
                  { backgroundColor: nextBg, opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <Text style={[rs.nextBtnText, { fontFamily: "Inter_700Bold", color: nextFg }]}>{t("forward")}</Text>
                <Ionicons name="arrow-forward" size={18} color={nextFg} />
              </Pressable>
            </Animated.View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ---- Empty recording (player stayed silent) ----
// Shown instead of the results sheet when speech-to-text heard nothing. The
// take is NOT scored or counted — the only action is a gentle re-record.
function EmptyRecordingSheet({
  visible,
  onRetry,
  colors,
  isDark,
  lang,
}: {
  visible: boolean;
  onRetry: () => void;
  colors: import("@/constants/colors").AppColors;
  isDark: boolean;
  lang: "ru" | "en";
}) {
  const cardBg = isDark ? "#15151F" : "#FFFFFF";
  const fg = isDark ? "#F8F8FB" : colors.text;
  const muted = isDark ? "rgba(248,248,251,0.6)" : colors.textSecondary;
  const accent = "#0EA5E9";
  const btnBg = isDark ? "#FFFFFF" : "#0F0F1E";
  const btnFg = isDark ? "#0A0A12" : "#FFFFFF";
  return (
    <Modal visible={visible} animationType="fade" transparent presentationStyle="overFullScreen">
      <View style={ers.overlay}>
        <View style={[ers.card, { backgroundColor: cardBg }]}>
          <View style={[ers.iconCircle, { backgroundColor: accent + "1A" }]}>
            <Ionicons name="mic-off-outline" size={34} color={accent} />
          </View>
          <Text style={[ers.title, { color: fg, fontFamily: "Inter_700Bold" }]}>
            {lang === "ru" ? "Кажется, мы тебя не услышали" : "We didn't quite hear you"}
          </Text>
          <Text style={[ers.body, { color: muted, fontFamily: "Inter_400Regular" }]}>
            {lang === "ru"
              ? "Чтобы пройти уровень, нужно говорить вслух. Ничего страшного — попробуй ещё раз, чуть увереннее и ближе к микрофону."
              : "To pass this level you need to speak out loud. No worries — give it another go, a little louder and closer to the mic."}
          </Text>
          <Pressable
            onPress={onRetry}
            style={({ pressed }) => [ers.btn, { backgroundColor: btnBg, opacity: pressed ? 0.85 : 1 }]}
          >
            <Ionicons name="refresh" size={18} color={btnFg} />
            <Text style={[ers.btnText, { color: btnFg, fontFamily: "Inter_700Bold" }]}>
              {lang === "ru" ? "Записать снова" : "Record again"}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const ers = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center", alignItems: "center", padding: 28 },
  card: { width: "100%", maxWidth: 380, borderRadius: 24, paddingVertical: 30, paddingHorizontal: 24, alignItems: "center", gap: 14 },
  iconCircle: { width: 68, height: 68, borderRadius: 34, justifyContent: "center", alignItems: "center" },
  title: { fontSize: 19, textAlign: "center" },
  body: { fontSize: 15, lineHeight: 22, textAlign: "center" },
  btn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, alignSelf: "stretch", height: 52, borderRadius: 16, marginTop: 6 },
  btnText: { fontSize: 16 },
});

// ---- Level Complete (modern celebration) ----
function ConfettiSpark({ delay, x, color }: { delay: number; x: number; color: string }) {
  const ty = useSharedValue(-20);
  const op = useSharedValue(0);
  const rot = useSharedValue(0);
  useEffect(() => {
    ty.value = withTiming(220, { duration: 2200 });
    op.value = withSequence(
      withTiming(1, { duration: 350 }),
      withTiming(0, { duration: 1500 }),
    );
    rot.value = withTiming(540, { duration: 2200 });
  }, []);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: ty.value }, { rotate: `${rot.value}deg` }],
    opacity: op.value,
  }));
  return (
    <Animated.View
      style={[
        { position: "absolute", top: 0, left: x, width: 6, height: 12, borderRadius: 1.5, backgroundColor: color },
        style,
      ]}
    />
  );
}

function LevelCompleteModal({
  visible,
  levelTitle,
  xpEarned,
  avgScore,
  bestScore,
  durationSec,
  hasNext,
  onNext,
  onMap,
  onClose,
  colors,
  isDark,
  t,
  lang,
}: {
  visible: boolean;
  levelTitle: string;
  xpEarned: number;
  avgScore: number;
  bestScore: number;
  durationSec: number;
  hasNext: boolean;
  onNext: () => void;
  onMap: () => void;
  onClose: () => void;
  colors: import("@/constants/colors").AppColors;
  isDark: boolean;
  t: (key: any) => string;
  lang: "ru" | "en";
}) {
  const scale = useSharedValue(0.7);
  const opacity = useSharedValue(0);
  const trophyScale = useSharedValue(0.4);
  const trophyRot = useSharedValue(-12);
  const ringPulse = useSharedValue(0.6);

  useEffect(() => {
    if (visible) {
      scale.value = withSpring(1, { damping: 13 });
      opacity.value = withTiming(1, { duration: 300 });
      trophyScale.value = withSpring(1, { damping: 8, stiffness: 110 });
      trophyRot.value = withSequence(
        withTiming(8, { duration: 220 }),
        withTiming(-4, { duration: 180 }),
        withTiming(0, { duration: 160 }),
      );
      ringPulse.value = withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      scale.value = 0.7;
      opacity.value = 0;
      trophyScale.value = 0.4;
      trophyRot.value = -12;
      ringPulse.value = 0.6;
    }
  }, [visible]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));
  const trophyStyle = useAnimatedStyle(() => ({
    transform: [{ scale: trophyScale.value }, { rotate: `${trophyRot.value}deg` }],
  }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: 1 - ringPulse.value,
    transform: [{ scale: 0.7 + ringPulse.value * 0.9 }],
  }));

  // Eye-catching gradient: deep amethyst → indigo → midnight
  const cardGradient = isDark
    ? (["#1A1033", "#241544", "#0F0820"] as const)
    : (["#5B21B6", "#7C3AED", "#312E81"] as const);
  const sparkColors = ["#FFD166", "#5EEAD4", "#C4B5FD", "#F5A623", "#A78BFA"];
  const sparkXs = [40, 90, 150, 210, 260, 310, 70, 200, 130, 280];

  return (
    <Modal visible={visible} transparent animationType="none">
      <View style={lc.overlay}>
        <Animated.View style={[lc.card, animStyle]}>
          <LinearGradient
            colors={cardGradient}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          {/* Confetti above content */}
          <View pointerEvents="none" style={lc.confetti}>
            {visible && sparkXs.map((x, i) => (
              <ConfettiSpark key={i} delay={i * 80} x={x} color={sparkColors[i % sparkColors.length]} />
            ))}
          </View>

          {/* Trophy with pulsing rings */}
          <View style={lc.trophyWrap}>
            <Animated.View style={[lc.ring, ringStyle]} />
            <View style={lc.trophyBubble}>
              <Animated.View style={trophyStyle}>
                <Ionicons name="trophy" size={56} color="#FFD166" />
              </Animated.View>
            </View>
          </View>

          {/* Close button */}
          <Pressable
            onPress={onClose}
            hitSlop={12}
            style={({ pressed }) => [lc.closeBtn, { opacity: pressed ? 0.6 : 1 }]}
          >
            <Ionicons name="close" size={22} color="rgba(255,255,255,0.85)" />
          </Pressable>

          <Text style={[lc.title, { fontFamily: "Inter_700Bold" }]}>
            {t("levelComplete")}
          </Text>
          <Text style={[lc.levelName, { fontFamily: "Inter_500Medium" }]}>
            {levelTitle}
          </Text>

          {/* Stars */}
          <View style={lc.starsRow}>
            {[1, 2, 3].map((i) => {
              const stars = avgScore < 5 ? 1 : avgScore < 8 ? 2 : 3;
              const filled = i <= stars;
              return (
                <Ionicons
                  key={i}
                  name={filled ? "star" : "star-outline"}
                  size={28}
                  color={filled ? "#FFD166" : "rgba(255,255,255,0.3)"}
                  style={{ marginHorizontal: 4 }}
                />
              );
            })}
          </View>

          {/* Stats card */}
          <View style={lc.statsCard}>
            <View style={lc.statBox}>
              <View style={[lc.statIcon, { backgroundColor: "rgba(255,209,102,0.18)" }]}>
                <Ionicons name="flash" size={16} color="#FFD166" />
              </View>
              <Text style={[lc.statValue, { fontFamily: "Inter_700Bold" }]}>+{xpEarned}</Text>
              <Text style={[lc.statLabel, { fontFamily: "Inter_500Medium" }]}>XP</Text>
            </View>
            <View style={lc.statDivider} />
            <View style={lc.statBox}>
              <View style={[lc.statIcon, { backgroundColor: "rgba(94,234,212,0.18)" }]}>
                <Ionicons name="trophy" size={16} color="#5EEAD4" />
              </View>
              <Text style={[lc.statValue, { fontFamily: "Inter_700Bold" }]}>{bestScore.toFixed(1)}</Text>
              <Text style={[lc.statLabel, { fontFamily: "Inter_500Medium" }]}>/ 10</Text>
            </View>
            <View style={lc.statDivider} />
            <View style={lc.statBox}>
              <View style={[lc.statIcon, { backgroundColor: "rgba(196,181,253,0.18)" }]}>
                <Ionicons name="time-outline" size={16} color="#C4B5FD" />
              </View>
              <Text style={[lc.statValue, { fontFamily: "Inter_700Bold" }]}>
                {Math.floor(durationSec / 60)}:{String(Math.floor(durationSec % 60)).padStart(2, "0")}
              </Text>
              <Text style={[lc.statLabel, { fontFamily: "Inter_500Medium" }]}>{t("timeLabel")}</Text>
            </View>
          </View>

          {!hasNext && (
            <Text style={[lc.allDone, { fontFamily: "Inter_600SemiBold" }]}>
              {t("allLevelsDone")}
            </Text>
          )}

          <Pressable
            onPress={onNext}
            style={({ pressed }) => [
              lc.nextBtn,
              { opacity: pressed ? 0.88 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
            ]}
          >
            <LinearGradient
              colors={["#FFD166", "#F5A623"]}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            <Text style={[lc.nextBtnText, { fontFamily: "Inter_700Bold" }]}>
              {t("nextLevel")}
            </Text>
            <Ionicons name="arrow-forward" size={18} color="#1A1033" />
          </Pressable>

          {hasNext && (
            <Pressable
              onPress={onMap}
              hitSlop={8}
              style={({ pressed }) => [lc.mapLink, { opacity: pressed ? 0.6 : 1 }]}
            >
              <Text style={[lc.mapLinkText, { fontFamily: "Inter_500Medium" }]}>
                {t("toMap")}
              </Text>
            </Pressable>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

// ---- Main Level Screen ----
export default function LevelScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const levelId = id as LevelType;
  const { colors, colorScheme, isDark } = useAppColors();
  const insets = useSafeAreaInsets();
  const { getLevelById, completeTask, completeAllTasksForLevel, addReadingRecording } = useGame();
  const { t, lang } = useLang();
  const { isOpenTestingEnabled } = useDevTools();

  // Tongue-twister levels (RU) pull their text from JSON (see
  // tongueTwisterLoader). We keep the SAME number of tasks — only the text is
  // swapped — so completion/indexing logic is unaffected. EN keeps legacy text.
  const baseLevel = getLevelById(levelId);
  const level =
    baseLevel && lang === "ru" && levelId.startsWith("tonguetwister")
      ? {
          ...baseLevel,
          tasks: (() => {
            const tts = getTongueTwistersForModule(
              getModuleFromTongueTwisterId(levelId),
              baseLevel.tasks.length,
            );
            return baseLevel.tasks.map((tk, i) =>
              tts[i] ? { ...tk, content: tts[i] } : tk,
            );
          })(),
        }
      : baseLevel;
  const [activeTaskIndex, setActiveTaskIndex] = useState<number | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [currentAnalysis, setCurrentAnalysis] = useState<SpeechAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  // True when speech-to-text ran but heard essentially nothing — the player
  // stayed silent. We don't score or count such a take; we invite a re-record.
  const [emptyRecording, setEmptyRecording] = useState(false);
  const [showLevelComplete, setShowLevelComplete] = useState(false);
  const [scores, setScores] = useState<number[]>([]);
  const [readingResetSignal, setReadingResetSignal] = useState(0);
  const [levelStartTime] = useState(() => Date.now());
  const [levelDurationSec, setLevelDurationSec] = useState(0);
  // Reading self-review (poetry/prose levels): instead of the AI results
  // sheet, the player listens back to their own take, self-rates with stars,
  // and the AI verdict streams in underneath. The take is saved to their
  // private library.
  const [showReadingReview, setShowReadingReview] = useState(false);
  const [readingAudioUri, setReadingAudioUri] = useState<string | null>(null);
  const [readingDurationSec, setReadingDurationSec] = useState(0);
  const [readingSaving, setReadingSaving] = useState(false);

  // Compute next level
  const allLevels = React.useMemo(() => getLevelsData(lang), [lang]);
  const currentIdx = React.useMemo(
    () => allLevels.findIndex((l) => l.id === levelId),
    [allLevels, levelId],
  );
  const nextLevel = currentIdx >= 0 && currentIdx < allLevels.length - 1
    ? allLevels[currentIdx + 1]
    : null;
  const hasNext = !!nextLevel;
  const bestScore = scores.length > 0 ? Math.max(...scores) : 0;

  const handleLevelCompleteNext = React.useCallback(() => {
    setShowLevelComplete(false);
    setScores([]);
    if (!nextLevel) {
      Alert.alert(t("allLevelsDone"), "", [
        { text: t("okBtn"), onPress: () => router.replace("/(tabs)") },
      ]);
      return;
    }
    // Route by level type — Show Time and Vocabulary have dedicated screens.
    // Previously every "next level" opened /level/[id], so advancing into a
    // Show Time level showed the generic task screen (looked like Interview).
    if (nextLevel.id.startsWith("showtime")) {
      router.replace({ pathname: "/showtime-stage", params: { levelId: nextLevel.id, mode: "game" } });
    } else if (nextLevel.id.startsWith("vocabulary")) {
      router.replace({ pathname: "/vocabulary-level", params: { levelId: nextLevel.id, moduleId: String(nextLevel.module) } });
    } else {
      router.replace({ pathname: "/level/[id]", params: { id: nextLevel.id } });
    }
  }, [nextLevel, t]);

  const handleLevelCompleteMap = React.useCallback(() => {
    setShowLevelComplete(false);
    setScores([]);
    router.replace("/(tabs)");
  }, []);

  // Snapshot duration when modal opens
  useEffect(() => {
    if (showLevelComplete) {
      setLevelDurationSec(Math.max(1, Math.floor((Date.now() - levelStartTime) / 1000)));
    }
  }, [showLevelComplete, levelStartTime]);

  const handleExitPress = React.useCallback(() => {
    const inTask = activeTaskIndex !== null || showResults || analyzing;
    const doExit = () => router.replace("/(tabs)");
    if (inTask) {
      Alert.alert(
        t("exitTaskTitle"),
        t("exitTaskMsg"),
        [
          { text: t("stayBtn"), style: "cancel" },
          { text: t("leaveBtn"), style: "destructive", onPress: doExit },
        ],
      );
    } else {
      doExit();
    }
  }, [activeTaskIndex, showResults, analyzing, t]);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  // Auto-scroll plumbing: keep a ref to the main ScrollView and to each
  // task card so that when activeTaskIndex changes (player tapped Next in
  // the results sheet), we can smoothly bring the freshly-expanded task
  // into view. Without this, the new task expands BELOW the viewport and
  // the player thinks the level is stuck on the old task.
  const scrollRef = useRef<ScrollView | null>(null);
  const taskRefs = useRef<Record<number, View | null>>({});
  const lastScrolledIndexRef = useRef<number | null>(null);

  useEffect(() => {
    if (activeTaskIndex === null) {
      lastScrolledIndexRef.current = null;
      return;
    }
    if (lastScrolledIndexRef.current === activeTaskIndex) return;
    lastScrolledIndexRef.current = activeTaskIndex;
    // Defer to next frame so the just-expanded panel has been laid out
    // and measure() returns a stable y position.
    const timer = setTimeout(() => {
      const node = taskRefs.current[activeTaskIndex];
      const scroller = scrollRef.current;
      if (!node || !scroller) return;
      try {
        node.measureLayout(
          // @ts-ignore — RN typings allow ScrollView as a relative node
          scroller,
          (_x: number, y: number) => {
            const offset = Math.max(0, y - 12);
            scroller.scrollTo({ y: offset, animated: true });
          },
          () => {},
        );
      } catch {}
    }, 80);
    return () => clearTimeout(timer);
  }, [activeTaskIndex]);

  const tips = generateTips(levelId, lang);

  if (!level) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <Text>{t("levelNotFound")}</Text>
      </View>
    );
  }

  const isReadingLevel = levelId.startsWith("reading");
  const isWarmupLevel = getBaseType(levelId) === "warmup";

  // Reading metadata (work title / author / category / full text) lifted here
  // so both the recording handler and the render below share one source.
  // Plain computation (not a hook) — this runs after the `if (!level)` guard.
  const readingMeta = (() => {
    if (!isReadingLevel || !level) return null;
    const lit = lang === "ru" ? getLiterature(getModuleFromReadingId(levelId)) : null;
    const legacyText = level.tasks
      .map((tk) => tk.content)
      .filter((c) => !!c)
      .join("\n\n");
    const fullText = lit ? getLiteratureFullText(lit) : legacyText;
    const m = getReadingMeta(levelId);
    const author = lit
      ? lit.author
      : m
        ? lang === "ru" ? m.authorRu : m.authorEn
        : undefined;
    const workTitle = lit
      ? lit.work
      : m
        ? lang === "ru" ? m.titleRu : m.titleEn
        : undefined;
    const category = lit ? literatureCategory(lit.kind) : m?.category;
    return { fullText, author, workTitle, category };
  })();

  const activeTask = activeTaskIndex !== null ? level.tasks[activeTaskIndex] : null;

  const handleRecordingComplete = async (
    durationSeconds: number,
    audioBase64?: string,
    audioUri?: string,
  ) => {
    if (isReadingLevel) {
      // Reading levels open the self-review screen immediately (so the player
      // can listen back) and analyze in the background — no blocking loader.
      setReadingAudioUri(audioUri ?? null);
      setReadingDurationSec(durationSeconds);
      setCurrentAnalysis(null);
      setShowReadingReview(true);
      setAnalyzing(true);
    } else {
      setAnalyzing(true);
      setShowResults(true);
    }
    try {
      // 1) Transcribe — only if we actually captured audio. Falling back to
      //    an empty transcript yields conservative, low-but-honest scores
      //    instead of fake high ones.
      let transcript = "";
      // Server echoes audioDurationSeconds back so we score against the
      // canonical value the analyzer endpoint saw (currently the same as
      // our local clock, but a single source of truth keeps client/server
      // honest if the server ever starts deriving it from the audio).
      let serverDuration = durationSeconds;
      // Real loudness measured by ffmpeg's volumedetect on the server.
      // Undefined when the server didn't return it (older builds, network
      // failure, etc.) — analyzer falls back to its duration heuristic.
      let audioRms: number | undefined;
      // Whether speech-to-text actually ran (a successful response came back).
      // We only treat an empty transcript as "the player was silent" when STT
      // genuinely ran — otherwise (offline / backend down) an empty transcript
      // just means we couldn't transcribe, which must NOT be blamed on the user.
      let transcribedOk = false;
      if (audioBase64 && audioBase64.length > 100) {
        try {
          const url = new URL("/api/transcribe", getApiUrl()).toString();
          const res = await expoFetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ audioBase64, audioDurationSeconds: durationSeconds }),
          });
          if (res.ok) {
            transcribedOk = true;
            const data = await res.json();
            if (typeof data.transcript === "string") transcript = data.transcript;
            if (typeof data.audioDurationSeconds === "number" && data.audioDurationSeconds > 0) {
              serverDuration = data.audioDurationSeconds;
            }
            if (typeof data.audioRms === "number" && Number.isFinite(data.audioRms)) {
              audioRms = data.audioRms;
            }
          }
        } catch (e) {
          console.warn("transcribe failed:", e);
        }
      }

      // Empty-recording guard: STT ran but heard essentially nothing (fewer
      // than 2 recognized words). The player stayed silent — don't score it,
      // don't count the level, and invite a friendly re-record instead.
      // Reading levels skip this: the self-review still lets the player listen
      // back and self-rate even on a quiet take (the AI verdict just lands low).
      const spokenWords = transcript.trim().split(/\s+/).filter(Boolean).length;
      if (!isReadingLevel && transcribedOk && spokenWords < 2) {
        setShowResults(false);
        setCurrentAnalysis(null);
        setEmptyRecording(true);
        return;
      }

      // 2) For reading levels, the prompt text is the merged task content —
      //    the analyzer uses it for textMatch scoring.
      const originalText = isReadingLevel
        ? (readingMeta?.fullText ||
            level.tasks.map((tk) => tk.content).filter(Boolean).join("\n\n"))
        : activeTask?.content || activeTask?.instruction || "";

      try {
        const analysis = await analyzeSpeech({
          transcript,
          originalText,
          audioDurationSeconds: serverDuration,
          levelType: levelId,
          lang,
          levelNumber: level.levelNumber,
          audioRms,
        });
        setCurrentAnalysis(analysis);
      } catch (e) {
        // Never leave the user staring at a spinner. Build a minimal
        // fallback analysis so the sheet can render with a retry button.
        console.warn("analyzeSpeech failed:", e);
        const errMsg = lang === "ru"
          ? "Не удалось проанализировать запись. Попробуй ещё раз."
          : "Couldn't analyze the recording. Please try again.";
        setCurrentAnalysis({
          summary: errMsg,
          score: { overall: 0, clarity: 0, confidence: 0, volume: 0, tempo: 0, expressiveness: 0, pauses: 0 },
          strengths: [],
          recommendations: [errMsg],
          tip: errMsg,
          transcript,
          fillerCount: 0,
          textMatchRatio: null,
          xpBonus: 0,
        });
      }
    } finally {
      setAnalyzing(false);
    }
  };

  const handleNextTask = () => {
    if (!currentAnalysis) return;

    // Reading levels are a single continuous read — mark all 3 tasks done
    // and award XP exactly once.
    if (isReadingLevel) {
      const overall = currentAnalysis.score.overall;
      completeAllTasksForLevel(levelId, overall);
      setScores([overall, overall, overall]);
      setShowResults(false);
      setCurrentAnalysis(null);
      setActiveTaskIndex(null);
      setTimeout(() => setShowLevelComplete(true), 400);
      return;
    }

    if (!activeTask) return;
    completeTask(levelId, activeTask.taskNumber, currentAnalysis.score.overall);
    const newScores = [...scores, currentAnalysis.score.overall];
    setScores(newScores);
    setShowResults(false);
    setCurrentAnalysis(null);

    const isLastTask = activeTask.taskNumber === 3;
    if (isLastTask) {
      setActiveTaskIndex(null);
      setTimeout(() => setShowLevelComplete(true), 400);
    } else {
      const nextIndex = (activeTaskIndex ?? 0) + 1;
      if (nextIndex < level.tasks.length) {
        setActiveTaskIndex(nextIndex);
      } else {
        setActiveTaskIndex(null);
      }
    }
  };

  const handleRetry = () => {
    setShowResults(false);
    setCurrentAnalysis(null);
    setAnalyzing(false);
    setEmptyRecording(false);
    setShowReadingReview(false);
    setReadingAudioUri(null);
    if (isReadingLevel) setReadingResetSignal((n) => n + 1);
  };

  // Copy a freshly-recorded reading take to a durable location so it survives
  // in the player's library (expo-av records into the cache, which the OS can
  // clear). Web object URLs are session-only; we keep them as-is.
  const persistReadingAudio = async (uri: string | null): Promise<string | null> => {
    if (!uri) return null;
    if (Platform.OS === "web") return uri;
    try {
      const FileSystem = require("expo-file-system/legacy");
      const dir = `${FileSystem.documentDirectory}reading/`;
      try {
        await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
      } catch {}
      const ext = (uri.split("?")[0].split(".").pop() || "m4a").slice(0, 5);
      const dest = `${dir}take_${Date.now()}.${ext}`;
      await FileSystem.copyAsync({ from: uri, to: dest });
      return dest;
    } catch (e) {
      console.warn("persistReadingAudio failed:", e);
      return uri;
    }
  };

  // Save & continue from the reading self-review: persist the take to the
  // private library (with the player's self-rating + the AI verdict), mark the
  // level complete, then show the celebration.
  const handleReadingSave = async (selfRating: number) => {
    if (readingSaving) return;
    setReadingSaving(true);
    const overall = currentAnalysis?.score.overall ?? 0;
    // Fall back to the self-rating (scaled to /10) for XP/stars if the AI
    // analysis never arrived (offline / backend down).
    const finalScore = overall > 0 ? overall : Math.max(2, selfRating * 2);

    try {
      const durableUri = await persistReadingAudio(readingAudioUri);
      if (durableUri) {
        addReadingRecording({
          uri: durableUri,
          title: readingMeta?.workTitle || level.title,
          author: readingMeta?.author,
          category: readingMeta?.category,
          date: Date.now(),
          durationSec: readingDurationSec,
          selfRating,
          aiStars: overall > 0 ? Math.round(overall / 2) : undefined,
          aiScore: overall > 0 ? overall : undefined,
        });
      }
    } catch (e) {
      console.warn("save reading recording failed:", e);
    }

    completeAllTasksForLevel(levelId, finalScore);
    setScores([finalScore, finalScore, finalScore]);
    setShowReadingReview(false);
    setReadingAudioUri(null);
    setCurrentAnalysis(null);
    setActiveTaskIndex(null);
    setReadingSaving(false);
    setTimeout(() => setShowLevelComplete(true), 400);
  };

  const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

  const handleWarmupTaskComplete = React.useCallback(
    (taskNumber: number, score: number) => {
      completeTask(levelId, taskNumber, score);
      setScores((prev) => {
        const next = [...prev];
        next[taskNumber - 1] = score;
        return next;
      });
    },
    [completeTask, levelId],
  );

  const handleWarmupAllComplete = React.useCallback(
    (payload: { scores: number[]; durationSec: number }) => {
      setScores(payload.scores);
      setLevelDurationSec(payload.durationSec);
      setTimeout(() => setShowLevelComplete(true), 400);
    },
    [],
  );

  // Warm-up: Pitch Game + mouth exercise (2 tasks from JSON).
  if (isWarmupLevel) {
    const accent = level.color || colors.gold;
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <WarmupLevelView
          moduleId={getModuleFromLevelId(levelId)}
          topPad={topPad}
          onTaskComplete={handleWarmupTaskComplete}
          onAllComplete={handleWarmupAllComplete}
        />
        <LevelCompleteModal
          visible={showLevelComplete}
          levelTitle={level.title}
          xpEarned={12 + scores.filter((s) => s >= 8).length * 2}
          avgScore={avgScore}
          bestScore={bestScore}
          durationSec={levelDurationSec}
          hasNext={hasNext}
          onNext={handleLevelCompleteNext}
          onMap={handleLevelCompleteMap}
          onClose={handleLevelCompleteMap}
          lang={lang}
          colors={colors}
          isDark={isDark}
          t={t}
        />
        <DevSkipButton levelId={levelId} />
      </View>
    );
  }

  // Reading / poetry levels use a single-text karaoke flow.
  if (isReadingLevel) {
    // Metadata (work / author / category / full text) is computed once in
    // `readingMeta` above so the recording handler and this render agree.
    const fullText = readingMeta?.fullText ?? "";
    const accent = level.color || colors.gold;
    const author = readingMeta?.author;
    const workTitle = readingMeta?.workTitle;
    const category = readingMeta?.category;
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <LinearGradient
          colors={
            isDark
              ? [colors.background, colors.backgroundSecondary]
              : ["#F0ECE3", "#EDE8DC"]
          }
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        />
        <ReadingLevelView
          fullText={fullText}
          accentColor={accent}
          colors={colors}
          topPad={topPad}
          bottomPad={bottomPad}
          title={level.title}
          subtitle={level.subtitle}
          author={author}
          workTitle={workTitle}
          category={category}
          onBack={() => router.back()}
          onRecordingComplete={handleRecordingComplete}
          resetSignal={readingResetSignal}
        />

        {/* Reading self-review — listen back, self-rate, AI verdict streams
            in underneath. Full-screen overlay above the karaoke view. */}
        {showReadingReview && (
          <View style={StyleSheet.absoluteFill}>
            <ReadingResultsView
              title={workTitle || level.title}
              author={author}
              category={category}
              audioUri={readingAudioUri ?? ""}
              durationSec={readingDurationSec}
              analysis={currentAnalysis}
              analyzing={analyzing}
              colors={colors}
              isDark={isDark}
              t={t}
              lang={lang}
              onRetry={handleRetry}
              onSave={handleReadingSave}
              saving={readingSaving}
            />
          </View>
        )}

        <EmptyRecordingSheet
          visible={emptyRecording}
          onRetry={handleRetry}
          colors={colors}
          isDark={isDark}
          lang={lang}
        />

        <LevelCompleteModal
          visible={showLevelComplete}
          levelTitle={level.title}
          xpEarned={12 + (scores.filter((s) => s >= 8).length * 2)}
          avgScore={avgScore}
          bestScore={bestScore}
          durationSec={levelDurationSec}
          hasNext={hasNext}
          onNext={handleLevelCompleteNext}
          onMap={handleLevelCompleteMap}
          onClose={handleLevelCompleteMap}
          lang={lang}
          colors={colors}
          isDark={isDark}
          t={t}
        />

        {/* Close X (top-right, above ReadingLevelView header) — hidden while
            the self-review overlay is up so it doesn't sit over the hero. */}
        {!showReadingReview && (
        <Pressable
          onPress={handleExitPress}
          hitSlop={12}
          style={({ pressed }) => [
            styles.closeBtnAbs,
            { top: topPad + 8, opacity: pressed ? 0.6 : 1 },
          ]}
        >
          <Ionicons name="close" size={24} color={colors.text} />
        </Pressable>
        )}
        <DevSkipButton levelId={levelId} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={
          isDark
            ? [colors.background, colors.backgroundSecondary]
            : [colors.background, colors.backgroundSecondary]
        }
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.7 : 1 }]}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={[styles.levelTitle, { color: colors.text, fontFamily: "Inter_700Bold" }]}>
            {level.title}
          </Text>
          <Text style={[styles.levelSubtitle, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>
            {level.subtitle}
          </Text>
        </View>
        <Pressable
          onPress={handleExitPress}
          hitSlop={12}
          style={({ pressed }) => [styles.headerRight, styles.closeBtnInline, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Ionicons name="close" size={24} color={colors.text} />
        </Pressable>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad + 40 }]}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
      >
        {/* Level description */}
        <Animated.View entering={FadeInDown.duration(400)}>
          <View style={[styles.descCard, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}>
            <LinearGradient
              colors={[colors.backgroundSecondary, colors.surface]}
              style={StyleSheet.absoluteFill}
            />
            <Ionicons name={level.icon as any} size={26} color={level.color || colors.gold} />
            <Text style={[styles.descText, { color: colors.text, fontFamily: "Inter_400Regular" }]}>
              {level.description}
            </Text>
          </View>
        </Animated.View>

        {/* Tips */}
        <Animated.View entering={FadeInDown.delay(100).duration(400)}>
          <Text style={[styles.sectionLabel, { color: colors.textMuted, fontFamily: "Inter_500Medium" }]}>
            {t("tipsForLevel")}
          </Text>
          <View style={[styles.tipsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {tips.map((tip, i) => (
              <View key={i} style={styles.tipRow}>
                <View style={[styles.tipDot, { backgroundColor: level.color || colors.gold }]} />
                <Text style={[styles.tipText, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>
                  {tip}
                </Text>
              </View>
            ))}
          </View>
        </Animated.View>

        {/* Tasks */}
        <Text style={[styles.sectionLabel, { color: colors.textMuted, fontFamily: "Inter_500Medium", marginTop: 8 }]}>
          {t("tasks")}
        </Text>

        {level.tasks.map((task, i) => {
          const effectiveStatus =
            isOpenTestingEnabled && task.status === "locked" ? "available" : task.status;
          const isActive = activeTaskIndex === i;
          const isDone = effectiveStatus === "completed";
          const isAvailable = effectiveStatus === "available";
          const isLocked = effectiveStatus === "locked";
          // Completed tasks should be re-openable so the player (or a
          // tester in Open Testing) can retake them. Only truly locked
          // tasks block interaction.
          const canOpen = isAvailable || isActive || isDone;

          return (
            <Animated.View
              key={task.id}
              entering={FadeInDown.delay(200 + i * 80).duration(400)}
              ref={(node) => {
                // Animated.View forwards its ref to the underlying View,
                // which exposes measureLayout used by the auto-scroll
                // effect above.
                taskRefs.current[i] = (node as unknown as View) ?? null;
              }}
            >
              <Pressable
                onPress={() => {
                  if (!canOpen) return;
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setActiveTaskIndex(isActive ? null : i);
                  setCurrentAnalysis(null);
                  setShowResults(false);
                }}
                disabled={isLocked}
                style={({ pressed }) => [
                  styles.taskCard,
                  {
                    backgroundColor: isActive
                      ? isDark
                        ? colors.backgroundSecondary
                        : colors.surface
                      : colors.surface,
                    borderColor: isActive
                      ? level.color || colors.accent
                      : isDone
                      ? colors.green
                      : colors.border,
                    borderWidth: isActive ? 2 : isDone ? 1.5 : 1,
                    opacity: isLocked ? 0.45 : pressed ? 0.9 : 1,
                  },
                ]}
              >
                <View style={styles.taskHeader}>
                  <View
                    style={[
                      styles.taskNum,
                      {
                        backgroundColor: isDone
                          ? colors.green
                          : isActive
                          ? (level.color || colors.gold)
                          : isAvailable
                          ? (level.color || colors.stepAvailable) + "80"
                          : colors.border,
                      },
                    ]}
                  >
                    {isDone ? (
                      <Ionicons name="checkmark" size={14} color="#fff" />
                    ) : (
                      <Text
                        style={[
                          styles.taskNumText,
                          {
                            color:
                              isDone || isLocked
                                ? colors.textMuted
                                : isActive || isAvailable
                                ? "#1A1A2E"
                                : colors.textMuted,
                            fontFamily: "Inter_700Bold",
                          },
                        ]}
                      >
                        {task.taskNumber}
                      </Text>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.taskTitle,
                        {
                          color: colors.text,
                          fontFamily: "Inter_600SemiBold",
                        },
                      ]}
                    >
                      {task.title}
                    </Text>
                    {task.bestScore !== undefined && (
                      <Text
                        style={[
                          styles.taskScore,
                          {
                            color: isActive ? colors.accent : colors.textMuted,
                            fontFamily: "Inter_400Regular",
                          },
                        ]}
                      >
                        {t("bestScore")}: {task.bestScore.toFixed(1)}/10
                      </Text>
                    )}
                  </View>
                  {isLocked ? (
                    <Ionicons name="lock-closed" size={16} color={colors.textMuted} />
                  ) : isActive ? (
                    <Ionicons name="chevron-up" size={18} color={level.color || colors.gold} />
                  ) : isDone ? (
                    <Ionicons name="star" size={16} color={colors.green} />
                  ) : (
                    <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
                  )}
                </View>

                {/* Expanded task content */}
                {isActive && (
                  <Animated.View
                    entering={FadeIn.duration(300)}
                    style={styles.taskExpanded}
                  >
                    {/* Instruction */}
                    <View
                      style={[
                        styles.instructionBox,
                        {
                          backgroundColor: isDark
                            ? "rgba(255,255,255,0.06)"
                            : "rgba(14,14,16,0.05)",
                          borderColor: colors.border,
                          borderWidth: 1,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.instructionText,
                          {
                            color: colors.textSecondary,
                            fontFamily: "Inter_400Regular",
                          },
                        ]}
                      >
                        {task.instruction}
                      </Text>
                    </View>

                    {/* Content to read / question */}
                    <View
                      style={[
                        styles.contentBox,
                        {
                          backgroundColor: (level.color || colors.gold) + (isDark ? "22" : "20"),
                          borderColor: (level.color || colors.gold) + (isDark ? "55" : "45"),
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.contentText,
                          {
                            color: colors.text,
                            fontFamily: "Inter_500Medium",
                          },
                        ]}
                      >
                        {task.content}
                      </Text>
                    </View>

                    {/* Voice recorder */}
                    <VoiceRecorder
                      onRecordingComplete={handleRecordingComplete}
                      colors={colors}
                    />
                  </Animated.View>
                )}
              </Pressable>
            </Animated.View>
          );
        })}
      </ScrollView>

      {/* Results Modal */}
      <ResultsSheet
        visible={showResults}
        analysis={currentAnalysis}
        analyzing={analyzing}
        task={activeTask}
        onRetry={handleRetry}
        onNext={handleNextTask}
        colors={colors}
        isDark={colorScheme === "dark"}
        t={t}
        lang={lang}
      />

      <EmptyRecordingSheet
        visible={emptyRecording}
        onRetry={handleRetry}
        colors={colors}
        isDark={colorScheme === "dark"}
        lang={lang}
      />

      <SpeechAnalyzingLoader visible={analyzing} lang={lang} />

      {/* Level Complete Modal */}
      <LevelCompleteModal
        visible={showLevelComplete}
        levelTitle={level.title}
        xpEarned={12 + (scores.filter((s) => s >= 8).length * 2)}
        avgScore={avgScore}
        bestScore={bestScore}
        durationSec={levelDurationSec}
        hasNext={hasNext}
        onNext={handleLevelCompleteNext}
        onMap={handleLevelCompleteMap}
        onClose={handleLevelCompleteMap}
          lang={lang}
        colors={colors}
        isDark={colorScheme === "dark"}
        t={t}
      />

      <View style={[styles.selfAnalysisFooter, { paddingBottom: bottomPad + 10 }]}>
        <Ionicons name="eye-outline" size={14} color={colors.textMuted} />
        <Text style={[styles.selfAnalysisText, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>
          {t("selfAnalysis")}
        </Text>
      </View>

      <DevSkipButton levelId={levelId} />
    </View>
  );
}

// Results sheet styles
const rs = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    maxHeight: "92%",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 16,
  },
  halo: {
    position: "absolute",
    top: -120, left: "50%", marginLeft: -200,
    width: 400, height: 400, borderRadius: 200,
  },
  handle: {
    width: 44,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 12,
  },
  content: {
    padding: 24,
    paddingBottom: 48,
    gap: 22,
  },
  scoreSection: {
    alignItems: "center",
    gap: 12,
    marginTop: 6,
  },
  scoreBig: {
    width: 108,
    height: 108,
    borderRadius: 54,
    borderWidth: 3,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 22,
  },
  scoreNumber: { fontSize: 38 },
  scoreDenom: { fontSize: 18, marginTop: 10 },
  scoreSummary: { fontSize: 16, textAlign: "center" },
  paramsSection: { gap: 10 },
  paramRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  paramLabel: { fontSize: 13, width: 110 },
  paramBarBg: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  paramBarFill: { height: 6, borderRadius: 3 },
  paramValue: { fontSize: 13, width: 34, textAlign: "right" },
  feedbackSection: { gap: 8 },
  feedbackTitle: { fontSize: 16 },
  feedbackRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  feedbackText: { flex: 1, fontSize: 14, lineHeight: 20 },
  tipCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 6,
  },
  tipHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  tipLabel: { fontSize: 12, letterSpacing: 0.4, textTransform: "uppercase" },
  tipText: { fontSize: 14, lineHeight: 20 },
  transcriptHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  transcriptCard: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  transcriptText: { fontSize: 14, lineHeight: 21 },
  transcriptToggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  transcriptToggleText: { fontSize: 12, letterSpacing: 0.3 },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 14,
  },
  loadingText: { fontSize: 17, textAlign: "center" },
  loadingHint: { fontSize: 13, textAlign: "center", lineHeight: 18 },
  btnRow: { flexDirection: "row", gap: 10, marginTop: 4 },
  retryBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  retryBtnText: { fontSize: 15 },
  nextBtn: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 16,
  },
  nextBtnText: { fontSize: 16 },
});

// Level complete styles (modern celebration)
const lc = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 32,
    padding: 28,
    paddingTop: 36,
    alignItems: "center",
    gap: 8,
    overflow: "hidden",
    shadowColor: "#5B21B6",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.45,
    shadowRadius: 32,
    elevation: 24,
  },
  confetti: {
    position: "absolute",
    top: 0, left: 0, right: 0, height: 240,
    overflow: "hidden",
  },
  trophyWrap: {
    width: 120, height: 120,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  ring: {
    position: "absolute",
    width: 120, height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: "rgba(255,209,102,0.55)",
  },
  trophyBubble: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.18)",
    alignItems: "center", justifyContent: "center",
  },
  title: { fontSize: 28, color: "#FFFFFF", letterSpacing: 0.3 },
  levelName: {
    fontSize: 14,
    color: "rgba(255,255,255,0.65)",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginTop: 2,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 22,
    marginBottom: 6,
    width: "100%",
    paddingHorizontal: 8,
  },
  statBox: {
    flex: 1,
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
  },
  statIcon: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: "center", justifyContent: "center",
    marginBottom: 2,
  },
  statValue: { fontSize: 24, color: "#FFFFFF" },
  statLabel: { fontSize: 12, color: "rgba(255,255,255,0.55)", letterSpacing: 0.5 },
  statDivider: {
    width: 1, height: 56,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  closeBtn: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.10)",
    zIndex: 10,
  },
  starsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
  },
  statsCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 18,
    marginBottom: 4,
    width: "100%",
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  allDone: {
    marginTop: 14,
    fontSize: 14,
    color: "#FFD166",
    textAlign: "center",
    letterSpacing: 0.3,
  },
  nextBtn: {
    marginTop: 18,
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 22,
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    overflow: "hidden",
    shadowColor: "#F5A623",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 8,
  },
  nextBtnText: { fontSize: 16, color: "#1A1033", letterSpacing: 0.3 },
  mapLink: {
    marginTop: 12,
    paddingVertical: 6,
  },
  mapLinkText: {
    fontSize: 13,
    color: "rgba(255,255,255,0.65)",
    letterSpacing: 0.3,
    textDecorationLine: "underline",
  },
});

// Main screen styles
const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 14,
    gap: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
  },
  headerCenter: { flex: 1, alignItems: "center" },
  headerRight: { width: 40 },
  closeBtnInline: {
    alignItems: "center",
    justifyContent: "center",
    height: 40,
  },
  closeBtnAbs: {
    position: "absolute",
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.04)",
    zIndex: 50,
  },
  levelTitle: { fontSize: 20 },
  levelSubtitle: { fontSize: 13, marginTop: 2 },
  scrollContent: { padding: 20, gap: 14 },
  descCard: {
    borderRadius: 20,
    padding: 20,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    overflow: "hidden",
  },
  descText: { flex: 1, fontSize: 14, lineHeight: 22, color: "rgba(255,255,255,0.85)" },
  sectionLabel: { fontSize: 11, letterSpacing: 1.5, marginBottom: 2 },
  tipsCard: {
    borderRadius: 16,
    padding: 14,
    gap: 8,
    borderWidth: 1,
  },
  tipRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  tipDot: { width: 6, height: 6, borderRadius: 3 },
  tipText: { flex: 1, fontSize: 13, lineHeight: 18 },
  taskCard: {
    borderRadius: 18,
    marginBottom: 10,
    overflow: "hidden",
  },
  taskHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
  },
  taskNum: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  taskNumText: { fontSize: 13 },
  taskTitle: { fontSize: 15 },
  taskScore: { fontSize: 12, marginTop: 2 },
  taskExpanded: {
    padding: 16,
    paddingTop: 0,
    gap: 14,
  },
  instructionBox: {
    borderRadius: 12,
    padding: 12,
  },
  instructionText: {
    fontSize: 14,
    lineHeight: 20,
  },
  contentBox: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
  },
  contentText: {
    fontSize: 16,
    lineHeight: 26,
    textAlign: "center",
  },
  selfAnalysisFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 20,
    paddingTop: 12,
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "transparent",
  },
  selfAnalysisText: {
    fontSize: 12,
    fontStyle: "italic",
    textAlign: "center",
  },
});
