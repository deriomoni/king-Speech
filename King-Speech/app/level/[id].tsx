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
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { ROLES, tx as roleTx } from "@/constants/rolesData";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  withRepeat,
  cancelAnimation,
  Easing,
  FadeIn,
  FadeInDown,
  SlideInUp,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path, Defs, LinearGradient as SvgLinearGradient, Stop } from "react-native-svg";
import RiveAnim from "@/components/RiveAnim";
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
import { aspectsFromScore10, ASPECT_META } from "@/components/ScoreFlower";
import OscarMascot from "@/components/OscarMascot";
import TaskFlowView from "@/components/TaskFlowView";
import { aggregateAnalyses } from "@/services/analyzeGenericTask";
import WarmupLevelView from "@/components/warmup/WarmupLevelView";
import DevSkipButton from "@/components/DevSkipButton";
import { getModuleFromLevelId } from "@/constants/contentLoader";
import { getPathColors, readableText } from "@/constants/pathPalette";
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
import { analyzeSpeech, analyzeSpeechPro, generateTips, FILLERS, type SpeechAnalysis } from "@/services/speechAnalysis";
import { getApiUrl } from "@/lib/query-client";
import { fetch as expoFetch } from "expo/fetch";
import { ActivityIndicator } from "react-native";

// ---- Results screen (premium gaming look) ----
// Brand-aligned evaluation palette: King Speech royal gold + violet on a
// purple-black canvas. Gold = strong, violet = good, coral = weak — the same
// heat map the ScoreFlower petals use, so score screen + flower read as one.
const RS_HIGH = "#FFD230";   // royal gold  (>=8)
const RS_GREEN = "#4ADE80";  // glowing green for high metric values (>=8)
const RS_MID  = "#B79BFF";   // light violet (>=6)
const RS_LOW  = "#FB7185";   // coral        (<6) — honest "low" tone

// Transcript display: collapse anything longer than this so the sheet stays
// scannable at a glance. The user can tap to reveal the rest.
const TRANSCRIPT_COLLAPSED_CHARS = 180;

// DEV preview data for the Skip button — showcases the score window (flower)
// without a real recording. Scores deliberately span the colour tiers so every
// petal tone (mint / teal / amber / coral) is visible at a glance.
const DEMO_ANALYSIS: SpeechAnalysis = {
  score: { overall: 7.0, clarity: 9.0, confidence: 7.0, volume: 5.0, tempo: 8.0, expressiveness: 9.5, pauses: 3.5 },
  strengths: ["Пример: яркая интонация", "Пример: чёткая дикция"],
  recommendations: ["Пример: добавь паузы после знаков препинания", "Пример: говори чуть громче к финалу"],
  summary: "Пример оценки: выразительное и чёткое прочтение — поработай над паузами и громкостью.",
  xpBonus: 2,
  tip: "Совет (пример): делай чуть больше осмысленных пауз после ключевых строк — сейчас они проскакивают.",
  transcript: "Пример распознанного текста вашего выступления для предпросмотра дизайна.",
  fillerCount: 1,
  textMatchRatio: 0.86,
};

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
        <Text style={[rs.feedbackTitle, { color: fgText, fontFamily: "Nunito_600SemiBold" }]}>
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
        <Text style={[rs.transcriptText, { color: fgText, fontFamily: "Nunito_400Regular" }]}>
          {segments.map((seg, i) =>
            seg.isFiller ? (
              <Text
                key={i}
                style={{
                  color: accent,
                  backgroundColor: fillerBg,
                  fontFamily: "Nunito_600SemiBold",
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
            <Text style={[rs.transcriptToggleText, { color: fgMuted, fontFamily: "Nunito_500Medium" }]}>
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

  return (
    <Modal visible={visible} animationType="slide" transparent={false} presentationStyle="fullScreen">
      <FlowerResultWindow
        overall={analysis.score.overall}
        aspects={aspectsFromScore10(analysis.score, lang)}
        summary={analysis.summary}
        tip={analysis.tip}
        growth={analysis.recommendations}
        strengths={analysis.strengths}
        isDark={isDark}
        colors={colors}
        t={t}
        lang={lang}
        primaryLabel={t("forward")}
        onPrimary={onNext}
        onRetry={onRetry}
      />
    </Modal>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Shared full-screen "score window": dark-neon flower + a single combined
// "what to improve" message (tip + growth points merged). Reused by the
// generic level results sheet; the reading self-review embeds its own variant.
// ───────────────────────────────────────────────────────────────────────────
export function FlowerResultWindow({
  overall,
  aspects,
  summary,
  tip,
  growth,
  strengths,
  isDark,
  colors,
  t,
  lang,
  primaryLabel,
  onPrimary,
  onRetry,
}: {
  overall: number;
  aspects: ReturnType<typeof aspectsFromScore10>;
  summary?: string;
  tip?: string;
  growth?: string[];
  strengths?: string[];
  isDark: boolean;
  colors: import("@/constants/colors").AppColors;
  t: (key: any) => string;
  lang: "ru" | "en";
  primaryLabel: string;
  onPrimary: () => void;
  onRetry?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 28 : insets.top + 8;
  const bottomPad = Platform.OS === "web" ? 28 : insets.bottom + 10;

  const tone = (v: number) => (v >= 8 ? RS_HIGH : v >= 6 ? RS_MID : v >= 4 ? "#FF9E4A" : RS_LOW);
  const scoreColor = tone(overall);

  // Oscar reacts to the result: thumbs-up for excellent, joy for good,
  // honest sadness for a weak take. Rendered at a fixed size — never scaled.
  const oscarEmotion: "thumbup" | "happy" | "sad" =
    overall >= 8 ? "thumbup" : overall >= 6 ? "happy" : "sad";
  const tierLabel =
    overall >= 8
      ? lang === "ru" ? "Отлично!" : "Excellent!"
      : overall >= 6
        ? lang === "ru" ? "Хорошо" : "Good"
        : overall >= 4
          ? lang === "ru" ? "Неплохо" : "Not bad"
          : lang === "ru" ? "Есть над чем поработать" : "Room to grow";

  // Signature purple-black canvas to match the re-skinned flower.
  const bgColors = isDark
    ? (["#0F0E14", "#15121F", "#0F0E14"] as const)
    : (["#F5F3FB", "#EEEAF7", "#F5F3FB"] as const);
  const fgText = isDark ? "#F2EEFB" : colors.text;
  const fgMuted = isDark ? "rgba(242,238,251,0.62)" : colors.textSecondary;
  const cardBg = isDark ? "rgba(124,77,255,0.07)" : "rgba(91,44,224,0.05)";
  const cardBorder = isDark ? "rgba(124,120,168,0.20)" : "rgba(91,44,224,0.12)";
  const retryBg = isDark ? "rgba(255,255,255,0.06)" : "rgba(30,20,50,0.04)";
  const retryBorder = isDark ? "rgba(255,255,255,0.10)" : "rgba(30,20,50,0.08)";

  // Merge the coaching tip + growth points into ONE message (tip leads, the
  // remaining growth points become supporting lines).
  const tipText = (tip ?? "").trim();
  const growthLines = (growth ?? [])
    .map((g) => g.trim())
    .filter((g) => g && g.toLowerCase() !== tipText.toLowerCase());
  const hasAdvice = !!tipText || growthLines.length > 0;

  return (
    <View style={{ flex: 1, backgroundColor: bgColors[0] }}>
      <LinearGradient colors={bgColors} style={StyleSheet.absoluteFill} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[rs.content, { paddingTop: topPad + 28, paddingBottom: bottomPad + 8 }]}
      >
        {/* Oscar leads the screen — big, centered, no card around him */}
        <Animated.View entering={FadeIn.duration(450)} style={rs.oscarSection}>
          <OscarMascot emotion={oscarEmotion} size={312} />
        </Animated.View>

        {/* Overall score right under the mascot — plain number, no circle */}
        <Animated.View entering={FadeIn.delay(80).duration(350)} style={rs.heroSection}>
          <View style={rs.scoreRow}>
            <Text style={[rs.scoreHeroNum, { color: scoreColor, fontFamily: "Rubik_700Bold" }]}>
              {overall.toFixed(1)}
            </Text>
            <Text style={[rs.scoreHeroDenom, { color: fgMuted, fontFamily: "Rubik_600SemiBold" }]}>
              /10
            </Text>
          </View>
          <Text style={[rs.tierLabel, { color: scoreColor, fontFamily: "Rubik_600SemiBold" }]}>
            {tierLabel}
          </Text>
        </Animated.View>

        {/* All six criteria in ONE compact widget: name + score, no bars.
            High scores (>=8) glow green. */}
        <Animated.View
          entering={FadeInDown.delay(160).duration(350)}
          style={[rs.metricsCard, { backgroundColor: cardBg, borderColor: cardBorder }]}
        >
          {aspects.map((a) => (
            <View key={a.key} style={rs.metricItem}>
              <Text
                numberOfLines={1}
                style={[rs.metricLabel, { color: fgMuted, fontFamily: "Nunito_500Medium" }]}
              >
                {a.label}
              </Text>
              <Text style={[rs.metricValue, { color: fgText, fontFamily: "Rubik_700Bold" }]}>
                {a.score.toFixed(1)}
              </Text>
            </View>
          ))}
        </Animated.View>

        {/* One combined "what to improve" message (tip + growth merged) */}
        {hasAdvice ? (
          <Animated.View
            entering={FadeInDown.delay(220).duration(400)}
            style={[rs.adviceCard, { backgroundColor: scoreColor + "12", borderColor: scoreColor + "40" }]}
          >
            <View style={rs.adviceHead}>
              <Text style={[rs.adviceTitle, { color: scoreColor, fontFamily: "Rubik_600SemiBold" }]}>
                {lang === "ru" ? "Над чем поработать" : "What to work on"}
              </Text>
            </View>
            {tipText ? (
              <Text style={[rs.adviceLead, { color: fgText, fontFamily: "Nunito_700Bold" }]}>{tipText}</Text>
            ) : null}
            {growthLines.map((g, i) => (
              <Text key={i} style={[rs.adviceText, { color: fgMuted, fontFamily: "Nunito_400Regular" }]}>{g}</Text>
            ))}
          </Animated.View>
        ) : null}

        {/* Buttons */}
        <Animated.View entering={FadeInDown.delay(380).duration(400)} style={rs.btnRow}>
          {onRetry ? (
            <Pressable
              onPress={onRetry}
              style={({ pressed }) => [
                rs.retryBtn,
                { backgroundColor: retryBg, borderColor: retryBorder, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Ionicons name="refresh" size={18} color={fgMuted} />
              <Text style={[rs.retryBtnText, { color: fgMuted, fontFamily: "Rubik_600SemiBold" }]}>{t("again")}</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={onPrimary}
            style={({ pressed }) => [rs.nextBtn, { backgroundColor: "#FFD230", opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }]}
          >
            <Text style={[rs.nextBtnText, { fontFamily: "Rubik_700Bold", color: "#3A2C00" }]}>{primaryLabel}</Text>
            <Ionicons name="arrow-forward" size={18} color="#3A2C00" />
          </Pressable>
        </Animated.View>
      </ScrollView>
    </View>
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
          {/* Oscar is puzzled — we didn't hear anything */}
          <OscarMascot emotion="notsure" size={110} />
          <View style={[ers.micBadge, { backgroundColor: accent + "1A" }]}>
            <Ionicons name="mic-off-outline" size={18} color={accent} />
          </View>
          <Text style={[ers.title, { color: fg, fontFamily: "Nunito_700Bold" }]}>
            {lang === "ru" ? "Кажется, мы тебя не услышали" : "We didn't quite hear you"}
          </Text>
          <Text style={[ers.body, { color: muted, fontFamily: "Nunito_400Regular" }]}>
            {lang === "ru"
              ? "Чтобы пройти уровень, нужно говорить вслух. Ничего страшного — попробуй ещё раз, чуть увереннее и ближе к микрофону."
              : "To pass this level you need to speak out loud. No worries — give it another go, a little louder and closer to the mic."}
          </Text>
          <Pressable
            onPress={onRetry}
            style={({ pressed }) => [ers.btn, { backgroundColor: btnBg, opacity: pressed ? 0.85 : 1 }]}
          >
            <Ionicons name="refresh" size={18} color={btnFg} />
            <Text style={[ers.btnText, { color: btnFg, fontFamily: "Nunito_700Bold" }]}>
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
  micBadge: { width: 36, height: 36, borderRadius: 18, justifyContent: "center", alignItems: "center", marginTop: -26 },
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

// Confetti burst over the victory title. Only the lower ~half is shown (the
// container clips the top); the .riv renders on a transparent background.
const CONFETTI_RIVE = require("@/assets/rive/confetti.riv");
const SCREEN_H = Dimensions.get("window").height;

// ── Trophy-on-a-column mark for the level-complete screen ────────────────────
// Line + column are black in light mode, white in dark; the cup keeps its
// yellow gradient in both. Inline SVG (Victory DRAW).
const TROPHY_COLUMN_PATH =
  "M337.005 1040C336.705 1039.98 336.405 1039.89 335.875 1039.73C333.416 1038.99 331.317 1037.78 330.747 1036.79C329.997 1035.46 329.567 1030.07 329.308 1018.46C329.138 1011.32 329.228 984.854 329.447 973.3C329.537 968.7 329.567 918.19 329.557 819.191C329.537 717.393 329.577 671.347 329.667 670.025C329.797 668.169 329.807 668.078 330.237 667.309C330.837 666.213 331.577 665.489 333.246 664.357C333.716 664.031 334.186 663.714 334.656 663.397C335.435 663.397 336.225 663.397 337.005 663.397C337.785 663.397 338.564 663.397 339.344 663.397C339.814 663.714 340.284 664.031 340.754 664.357C342.423 665.489 343.163 666.213 343.763 667.309C344.192 668.078 344.212 668.169 344.342 670.025C344.432 671.347 344.462 717.393 344.452 819.191C344.432 918.19 344.472 968.7 344.552 973.3C344.782 984.854 344.862 1011.32 344.702 1018.46C344.442 1030.07 344.012 1035.46 343.253 1036.79C342.683 1037.78 340.584 1038.99 338.124 1039.73C337.605 1039.89 337.305 1039.98 337.005 1040ZM250.005 1037.45C246.696 1035.22 246.336 1034.55 245.986 1029.84C245.546 1024.14 245.486 997.251 245.856 980.146C246.026 972.44 246.016 954.04 245.836 898.541C245.646 843.25 245.646 740.103 245.826 717.32C246.026 692.563 246.266 679.759 246.606 674.824C246.716 673.222 246.776 672.869 247.046 672.371C247.735 671.058 249.255 669.971 251.544 669.165C251.984 669.011 252.424 668.848 252.854 668.694C253.184 668.776 253.513 668.848 253.843 668.93C256.172 669.473 257.942 670.224 259.082 671.157C260.121 671.999 260.241 672.316 260.351 674.426C260.531 677.622 260.711 683.318 260.851 689.648C261.021 697.87 260.901 1030.81 260.731 1032.07C260.481 1033.82 259.991 1034.8 258.872 1035.82C257.492 1037.08 255.473 1037.77 251.694 1038.31C251.424 1038.34 251.084 1038.16 250.005 1037.45ZM423.995 1037.45C422.926 1038.16 422.576 1038.34 422.306 1038.31C418.527 1037.77 416.508 1037.08 415.128 1035.82C414.009 1034.8 413.529 1033.82 413.279 1032.07C413.099 1030.81 412.979 697.87 413.159 689.648C413.289 683.318 413.479 677.622 413.649 674.426C413.769 672.316 413.889 671.999 414.928 671.157C416.068 670.224 417.827 669.473 420.156 668.93C420.486 668.848 420.816 668.776 421.146 668.694C421.586 668.848 422.026 669.011 422.466 669.165C424.745 669.971 426.264 671.058 426.964 672.371C427.224 672.869 427.284 673.222 427.404 674.824C427.744 679.759 427.974 692.563 428.174 717.32C428.364 740.103 428.354 843.25 428.174 898.541C427.984 954.04 427.974 972.44 428.144 980.146C428.524 997.251 428.454 1024.14 428.024 1029.84C427.664 1034.55 427.314 1035.22 423.995 1037.45ZM337.005 481.389C249.665 481.389 162.345 481.343 155.437 481.253C115.67 480.755 104.104 481.452 90.689 485.128C57.8702 494.12 30.3296 520.715 19.4234 553.938C14.4751 569.006 13.4754 585.296 16.5543 600.853C19.2634 614.508 25.0215 627.529 33.2986 638.713C50.7027 662.211 78.6331 678.102 108.333 681.389C114.751 682.105 122.948 682.141 129.446 681.489C155.417 678.899 178.909 666.023 193.324 646.464C200.262 637.065 205.06 626.035 206.729 615.631C207.629 610.089 207.739 603.597 207.029 597.964C205.74 587.651 201.491 577.074 195.333 568.816C191.105 563.147 185.647 557.941 179.559 553.757C163.584 542.801 143.231 539.043 125.137 543.715C111.262 547.292 99.8159 554.989 93.0182 565.33C86.1306 575.797 84.2412 587.46 87.5901 598.942C90.739 609.754 98.3664 618.882 107.733 623.047C118.829 627.982 131.115 625.519 141.392 616.301C143.121 614.753 143.291 614.553 145.44 611.33C149.399 605.39 151.378 603.533 154.247 603.062C156.377 602.709 159.266 604.122 160.415 606.078C162.305 609.301 161.025 615.015 157.006 621.336C155.597 623.554 155.047 624.188 152.708 626.316C143.521 634.665 132.915 638.866 121.079 638.857C97.4067 638.83 76.114 621.336 71.7255 598.299C68.7265 582.544 73.285 565.828 84.1113 552.933C99.7759 534.271 125.047 525.261 151.938 528.756C181.218 532.55 206.22 551.321 217.026 577.618C225.963 599.359 223.564 625.827 210.738 647.034C203.71 658.652 193.294 669.572 181.918 677.269C167.673 686.904 151.018 692.446 128.276 695.135C126.937 695.289 125.827 695.434 125.807 695.452C125.787 695.47 125.757 761.808 125.737 842.861C125.717 982.554 125.727 990.595 125.937 997.296C126.187 1004.96 126.157 1016.27 125.897 1019.76C125.277 1027.87 124.158 1032.48 122.338 1034.39C121.499 1035.26 119.869 1035.73 118.639 1035.45C115.69 1034.77 112.652 1031.71 111.402 1028.14C110.732 1026.24 110.742 1026.41 110.882 1014.55C110.972 1007.31 111.012 951.187 111.012 849.453C111.012 798.083 111.012 746.704 111.012 695.325C110.822 695.307 110.622 695.289 110.422 695.262C83.9013 692.337 65.4276 685.663 47.1039 672.38C21.9825 654.17 5.61808 628.218 1.18959 599.549C0.299897 593.772 0 589.516 0 582.851C0 576.748 0.239918 573.199 0.999659 567.747C4.9683 539.441 20.1731 512.964 43.2952 494.093C63.3284 477.739 88.0099 468.73 116.83 467.235C118.06 467.172 119.479 467.091 119.969 467.054C120.549 467.018 228.762 467 337.005 467C445.238 467 553.461 467.018 554.041 467.054C554.531 467.091 555.94 467.172 557.18 467.235C586 468.73 610.671 477.739 630.715 494.093C653.837 512.964 669.031 539.441 673 567.747C673.77 573.199 674 576.748 674 582.851C674.01 589.516 673.7 593.772 672.81 599.549C668.382 628.218 652.017 654.17 626.906 672.38C608.582 685.663 590.108 692.337 563.578 695.262C563.388 695.289 563.188 695.307 562.988 695.325C562.988 746.704 562.988 798.083 562.988 849.453C562.988 951.187 563.038 1007.31 563.118 1014.55C563.268 1026.41 563.268 1026.24 562.598 1028.14C561.348 1031.71 558.309 1034.77 555.37 1035.45C554.131 1035.73 552.501 1035.26 551.672 1034.39C549.852 1032.48 548.723 1027.87 548.113 1019.76C547.843 1016.27 547.823 1004.96 548.063 997.296C548.283 990.595 548.293 982.554 548.263 842.861C548.253 761.808 548.223 695.47 548.193 695.452C548.173 695.434 547.063 695.289 545.734 695.135C522.981 692.446 506.327 686.904 492.082 677.269C480.706 669.572 470.299 658.652 463.262 647.034C450.436 625.827 448.037 599.359 456.974 577.618C467.79 551.321 492.782 532.55 522.062 528.756C548.952 525.261 574.224 534.271 589.889 552.933C600.715 565.828 605.273 582.544 602.274 598.299C597.896 621.336 576.603 638.83 552.931 638.857C541.085 638.866 530.489 634.665 521.302 626.316C518.963 624.188 518.413 623.554 517.003 621.336C512.975 615.015 511.705 609.301 513.595 606.078C514.744 604.122 517.623 602.709 519.752 603.062C522.631 603.533 524.601 605.39 528.569 611.33C530.719 614.553 530.879 614.753 532.608 616.301C542.895 625.519 555.18 627.982 566.277 623.047C575.633 618.882 583.261 609.754 586.41 598.942C589.759 587.46 587.879 575.797 580.992 565.33C574.184 554.989 562.748 547.292 548.863 543.715C530.769 539.043 510.426 542.801 494.451 553.757C488.363 557.941 482.905 563.147 478.666 568.816C472.509 577.074 468.26 587.651 466.97 597.964C466.271 603.597 466.381 610.089 467.27 615.631C468.95 626.035 473.748 637.065 480.676 646.464C495.101 666.023 518.583 678.899 544.554 681.489C551.062 682.141 559.249 682.105 565.677 681.389C595.367 678.102 623.307 662.211 640.701 638.713C648.978 627.529 654.746 614.508 657.445 600.853C660.524 585.296 659.535 569.006 654.586 553.938C643.68 520.715 616.13 494.12 583.311 485.128C569.905 481.452 558.339 480.755 518.563 481.253C511.665 481.343 424.345 481.389 337.005 481.389ZM180.388 998.192C177.289 997.83 175.63 996.517 174.87 993.846C174.49 992.506 174.38 990.659 174.25 983.541C174.101 975.89 174.041 721.712 174.181 716.08C174.27 712.286 174.35 711.733 174.98 710.619C175.36 709.931 176.49 708.537 177.419 707.595C177.599 707.405 177.789 707.224 177.969 707.034C178.859 707.034 179.749 707.034 180.638 707.034C182.858 707.025 183.437 707.061 184.117 707.233C187.406 708.075 188.666 709.859 189.015 714.196C189.195 716.351 189.305 978.887 189.125 987.39C188.975 994.742 189.035 994.525 186.496 996.861C186.016 997.296 185.537 997.731 185.057 998.174C184.767 998.192 184.467 998.22 184.177 998.247C183.057 998.337 181.398 998.31 180.388 998.192ZM493.611 998.192C492.602 998.31 490.942 998.337 489.823 998.247C489.533 998.22 489.243 998.192 488.953 998.174C488.473 997.731 487.993 997.296 487.513 996.861C484.964 994.525 485.024 994.742 484.874 987.39C484.704 978.887 484.814 716.351 484.984 714.196C485.344 709.859 486.604 708.075 489.883 707.233C490.562 707.061 491.152 707.025 493.371 707.034C494.261 707.034 495.151 707.034 496.041 707.034C496.22 707.224 496.4 707.405 496.59 707.595C497.52 708.537 498.64 709.931 499.03 710.619C499.649 711.733 499.729 712.286 499.829 716.08C499.969 721.712 499.899 975.89 499.759 983.541C499.629 990.659 499.509 992.506 499.139 993.846C498.38 996.517 496.72 997.83 493.611 998.192Z";
const TROPHY_CUP_PATH =
  "M334.885 517C375.38 517 414.448 513.104 444.595 506.059C474.742 499.015 493.844 489.318 498.236 478.829C502.627 468.341 492 457.8 468.392 449.226C444.784 440.654 409.858 434.656 370.316 432.38V432.183V336.745C400.741 326.976 429.621 300.343 448.079 275.248C459.967 276.002 470.593 276.291 482.508 275.024C609.524 275.024 638.626 124.65 609.524 79.8567C586.516 44.4453 514.34 59.6527 514.34 59.6527C514.355 50.0776 514.503 40.1647 514.042 30.6282C514.042 30.6282 443.173 7 334.885 7C226.597 7 155.728 30.6282 155.728 30.6282C155.266 40.1647 155.414 50.0776 155.43 59.6527C155.43 59.6527 83.2537 44.4453 60.2458 79.8567C31.1433 124.65 60.2458 275.024 187.262 275.024C199.176 276.291 209.802 276.002 221.69 275.248C240.148 300.343 269.028 326.976 299.453 336.745V432.183V432.38C259.911 434.656 224.986 440.654 201.378 449.226C177.77 457.8 167.142 468.341 171.533 478.829C175.926 489.318 195.027 499.015 225.174 506.059C255.321 513.104 294.389 517 334.885 517ZM90.3326 147.456C78.9182 68.5904 147.354 87.2019 152.821 104.48C152.821 104.48 152.821 128.622 166.707 172.937C180.593 217.253 193.771 230.238 199.108 241.18C109.38 257.946 90.3326 147.456 90.3326 147.456ZM579.437 147.456C579.437 147.456 560.39 257.946 470.661 241.18C475.998 230.238 489.176 217.253 503.063 172.937C516.949 128.622 516.949 104.48 516.949 104.48C522.415 87.2019 590.851 68.5904 579.437 147.456Z";

function TrophyColumn({ lineColor, width }: { lineColor: string; width: number }) {
  const height = Math.round(width * (1040 / 674));
  return (
    <Svg width={width} height={height} viewBox="0 0 674 1040">
      <Defs>
        <SvgLinearGradient id="lcTrophy" x1="334.885" y1="7" x2="334.885" y2="517" gradientUnits="userSpaceOnUse">
          <Stop stopColor="#FFEB56" />
          <Stop offset="0.524038" stopColor="#FFC62D" />
          <Stop offset="1" stopColor="#FFC62D" />
        </SvgLinearGradient>
      </Defs>
      <Path d={TROPHY_COLUMN_PATH} fill={lineColor} fillRule="evenodd" clipRule="evenodd" />
      <Path d={TROPHY_CUP_PATH} fill="url(#lcTrophy)" stroke={lineColor} strokeWidth={14} />
    </Svg>
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
  roleBonus,
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
  roleBonus?: { emoji: string; title: string; onPlay: () => void } | null;
}) {
  // Everything is static (scaling the SVG trophy rasterizes it). Only the
  // "level complete" title gently pulses.
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (visible) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      pulse.value = withRepeat(
        withTiming(1.05, { duration: 900, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      );
    } else {
      cancelAnimation(pulse);
      pulse.value = 1;
    }
  }, [visible]);

  const titlePulse = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  // Line/column: black on light, white on dark. Cup keeps its yellow gradient.
  const lineColor = isDark ? "#F5F5F7" : "#141414";
  const yellow = "#FFC62D"; // solid trophy gold for the CTA
  const scoreStr = Number.isInteger(bestScore) ? String(bestScore) : bestScore.toFixed(1);
  const timeStr = `${Math.floor(durationSec / 60)}:${String(Math.floor(durationSec % 60)).padStart(2, "0")}`;

  const statLabel = {
    fontFamily: "Rubik_600SemiBold" as const,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: "uppercase" as const,
    color: colors.textMuted,
    marginBottom: 6,
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {/* Confetti pinned flush to the top edge; only the lower ~half shows
            (top clipped), transparent background. A soft fade at the bottom
            dissolves it into the background so there's no hard cut edge. */}
        {visible && (
          <>
            <View
              style={{ position: "absolute", top: 0, left: 0, right: 0, height: 210, overflow: "hidden" }}
              pointerEvents="none"
            >
              <RiveAnim
                source={CONFETTI_RIVE}
                autoplay
                fit="cover"
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  bottom: 0,
                  height: 360,
                  backgroundColor: "transparent",
                  transform: [{ scale: 1.19 }],
                }}
              />
            </View>
            <LinearGradient
              colors={["transparent", colors.background]}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              pointerEvents="none"
              style={{ position: "absolute", top: 150, left: 0, right: 0, height: 70 }}
            />
          </>
        )}

        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "flex-start",
            paddingTop: SCREEN_H * 0.22,
            paddingHorizontal: 30,
          }}
        >
        <Animated.Text
          style={[
            { fontFamily: "Rubik_700Bold", fontSize: 26, color: colors.text, marginBottom: 26, textAlign: "center" },
            titlePulse,
          ]}
        >
          {t("levelComplete")}
        </Animated.Text>

        <TrophyColumn lineColor={lineColor} width={148} />

        {/* Score + time, labelled */}
        <View style={{ flexDirection: "row", marginTop: 28, gap: 46 }}>
          <View style={{ alignItems: "center" }}>
            <Text style={statLabel}>{lang === "en" ? "Score" : "Оценка"}</Text>
            <View style={{ flexDirection: "row", alignItems: "baseline" }}>
              <Text style={{ fontFamily: "Rubik_700Bold", fontSize: 40, color: colors.text }}>{scoreStr}</Text>
              <Text style={{ fontFamily: "Rubik_600SemiBold", fontSize: 20, color: colors.textSecondary }}>/10</Text>
            </View>
          </View>
          <View style={{ alignItems: "center" }}>
            <Text style={statLabel}>{lang === "en" ? "Time" : "Время"}</Text>
            <Text style={{ fontFamily: "Rubik_700Bold", fontSize: 40, color: colors.text }}>{timeStr}</Text>
          </View>
        </View>

        <Pressable
          onPress={onNext}
          style={({ pressed }) => [
            {
              marginTop: 44,
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              paddingHorizontal: 32,
              height: 48,
              borderRadius: 24,
              backgroundColor: yellow,
              opacity: pressed ? 0.9 : 1,
            },
          ]}
        >
          <Text style={{ fontFamily: "Rubik_700Bold", fontSize: 16, color: "#3A2C00" }}>
            {t("nextLevel")}
          </Text>
          <Ionicons name="arrow-forward" size={17} color="#3A2C00" />
        </Pressable>

        <Pressable
          onPress={onMap}
          hitSlop={8}
          style={({ pressed }) => [{ marginTop: 16, opacity: pressed ? 0.6 : 1 }]}
        >
          <Text style={{ fontFamily: "Rubik_500Medium", fontSize: 15, color: colors.textMuted }}>
            {lang === "en" ? "Exit" : "Выход"}
          </Text>
        </Pressable>
        </View>
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
  // New one-task-per-screen flow: the aggregate level flower shown after the
  // last task (null = hidden). Its own dark canvas + bloom is the "screen
  // darkens → flower appears" moment.
  const [levelFlower, setLevelFlower] = useState<SpeechAnalysis | null>(null);
  const [scores, setScores] = useState<number[]>([]);
  const [readingResetSignal, setReadingResetSignal] = useState(0);
  const [readingRestartSignal, setReadingRestartSignal] = useState(0);
  const [readingExitConfirm, setReadingExitConfirm] = useState(false);
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

  // Bonus role — deterministically surfaced on a subset of «Путь» levels to add
  // variety. Same level always maps to the same role/mode; ~1 in 3 levels show one.
  const roleBonus = React.useMemo(() => {
    let h = 0;
    for (let i = 0; i < levelId.length; i++) h = (h * 31 + levelId.charCodeAt(i)) >>> 0;
    if (h % 3 !== 0) return null;
    const role = ROLES[h % ROLES.length];
    const mode = h % 2 === 0 ? "scripted" : "improv";
    return {
      emoji: role.emoji,
      title: roleTx(role.title, lang),
      onPlay: () => {
        setShowLevelComplete(false);
        router.push({ pathname: "/role-stage", params: { roleId: role.id, mode } });
      },
    };
  }, [levelId, lang]);

  const handleLevelCompleteNext = React.useCallback(() => {
    // Keep the opaque victory widget up until navigation swaps the screen —
    // hiding it first briefly revealed the finished level during the transition.
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
    // Don't hide the widget first — it covers the finished level until the tabs
    // screen replaces it.
    setScores([]);
    router.replace("/(tabs)");
  }, []);

  // If this screen is reused for a different level (router.replace to
  // /level/[id]), make sure a leftover victory widget doesn't linger.
  useEffect(() => {
    setShowLevelComplete(false);
  }, [levelId]);

  // Snapshot duration when modal opens
  useEffect(() => {
    if (showLevelComplete) {
      setLevelDurationSec(Math.max(1, Math.floor((Date.now() - levelStartTime) / 1000)));
    }
  }, [showLevelComplete, levelStartTime]);

  // Reading exit flow: the ✕ is the only way out. It asks "Sure you want to
  // leave?" — Yes → back to the map; No → restart the reading from the top.
  const openReadingExit = React.useCallback(() => {
    setReadingResetSignal((n) => n + 1); // stop the mic, drop to idle behind the prompt
    setReadingExitConfirm(true);
  }, []);
  const confirmReadingExit = React.useCallback(() => {
    setReadingExitConfirm(false);
    router.replace("/(tabs)");
  }, []);
  const cancelReadingExit = React.useCallback(() => {
    setReadingExitConfirm(false);
    setReadingRestartSignal((n) => n + 1); // countdown → read again from line 1
  }, []);

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
    const year = lit?.meta || undefined;
    const about = lit?.teaser || undefined;
    return { fullText, author, workTitle, category, year, about };
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
      // Reading levels: grade with the professional, signal-grounded Claude
      // scorer (honest per-aspect 1..5 + a result-based tip). Falls back to the
      // local heuristic below if the server is unreachable.
      if (isReadingLevel && audioBase64 && audioBase64.length > 100) {
        const pro = await analyzeSpeechPro({
          audioBase64,
          title: readingMeta?.workTitle,
          moduleNumber: level.module,
          lang,
          durationSeconds,
        });
        if (pro) {
          setCurrentAnalysis(pro);
          return;
        }
        // else: fall through to transcribe + local heuristic
      }

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

  // DEV-only: open this screen's score window with example data so the new
  // flower design can be previewed instantly (wired to the Skip button).
  const handlePreviewResults = React.useCallback(() => {
    setCurrentAnalysis(DEMO_ANALYSIS);
    setAnalyzing(false);
    setEmptyRecording(false);
    if (isReadingLevel) {
      setReadingAudioUri(null);
      setReadingDurationSec(0);
      setShowReadingReview(true);
    } else {
      // New flow preview: bloom the aggregate level flower directly.
      setLevelFlower(DEMO_ANALYSIS);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReadingLevel]);

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

  // New one-task-per-screen flow (tongue twisters / interview levels): the
  // player finished the last task. Aggregate every per-task take into one
  // level flower; continuing from it opens the LevelComplete celebration.
  const handleFlowFinished = React.useCallback(
    (payload: { scores: number[]; analyses: SpeechAnalysis[]; durationSec: number }) => {
      setScores(payload.scores);
      setLevelDurationSec(payload.durationSec);
      setLevelFlower(aggregateAnalyses(payload.analyses, lang));
    },
    [lang],
  );
  const handleFlowScored = React.useCallback(
    (taskNumber: number, score: number) => {
      completeTask(levelId, taskNumber, score);
    },
    [completeTask, levelId],
  );
  const handleFlowerContinue = React.useCallback(() => {
    setLevelFlower(null);
    setShowLevelComplete(true);
  }, []);

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
          roleBonus={roleBonus}
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
    // Reading wears the module's Path background (light theme = the raw palette
    // color, dark theme = the muted variant), same as the map.
    const readingBg = getPathColors(level.module, isDark).bg;
    return (
      <View style={[styles.container, { backgroundColor: readingBg }]}>
        <ReadingLevelView
          fullText={fullText}
          accentColor={accent}
          bgColor={readingBg}
          colors={colors}
          topPad={topPad}
          bottomPad={bottomPad}
          title={level.title}
          subtitle={level.subtitle}
          author={author}
          workTitle={workTitle}
          category={category}
          year={readingMeta?.year}
          about={readingMeta?.about}
          onBack={() => router.back()}
          onRecordingComplete={handleRecordingComplete}
          resetSignal={readingResetSignal}
          restartSignal={readingRestartSignal}
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
          roleBonus={roleBonus}
        />

        {/* Close X (top-right, above ReadingLevelView header) — hidden while
            the self-review overlay is up so it doesn't sit over the hero. */}
        {!showReadingReview && (
        <Pressable
          onPress={openReadingExit}
          hitSlop={12}
          style={({ pressed }) => [
            styles.closeBtnAbs,
            { top: topPad + 8, opacity: pressed ? 0.6 : 1 },
          ]}
        >
          <Ionicons name="close" size={24} color={readableText(readingBg)} />
        </Pressable>
        )}

        {/* Exit confirmation — Yes → map, No → restart reading from the top. */}
        <Modal
          visible={readingExitConfirm}
          transparent
          animationType="fade"
          onRequestClose={cancelReadingExit}
        >
          <View style={styles.readingExitBackdrop}>
            <View
              style={[
                styles.readingExitCard,
                { backgroundColor: colors.backgroundSecondary, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.readingExitTitle, { color: colors.text }]}>
                {lang === "ru" ? "Выйти из чтения?" : "Leave the reading?"}
              </Text>
              <Text style={[styles.readingExitMsg, { color: colors.textSecondary }]}>
                {lang === "ru"
                  ? "Прогресс этого чтения не сохранится — придётся читать заново."
                  : "This reading won't be saved — you'll have to read it again."}
              </Text>
              <Pressable
                onPress={confirmReadingExit}
                style={({ pressed }) => [
                  styles.readingExitLeave,
                  { opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <Text style={styles.readingExitLeaveTxt}>
                  {lang === "ru" ? "Да, выйти" : "Yes, leave"}
                </Text>
              </Pressable>
              <Pressable
                onPress={cancelReadingExit}
                style={({ pressed }) => [
                  styles.readingExitStay,
                  { borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <Text style={[styles.readingExitStayTxt, { color: colors.text }]}>
                  {lang === "ru" ? "Нет, читать заново" : "No, read again"}
                </Text>
              </Pressable>
            </View>
          </View>
        </Modal>

        <DevSkipButton levelId={levelId} onPreviewResults={handlePreviewResults} />
      </View>
    );
  }

  // Interview & tongue-twister levels wear the SAME palette as the Path map for
  // their module: background = module bg, accent = module brick. Interview
  // levels are the exception — they run on a clean theme background (light in
  // light mode, dark in dark mode) with no module tint.
  const pathCols = getPathColors(level.module, isDark);
  const isInterviewLevel = getBaseType(levelId) === "interview";
  const isTongueLevel = levelId.startsWith("tonguetwister");
  // Interview & tongue-twister levels run on a clean theme background.
  const isCleanLevel = isInterviewLevel || isTongueLevel;
  const flowBg = isCleanLevel ? colors.background : pathCols.bg;

  return (
    <View style={[styles.container, { backgroundColor: flowBg }]}>
      <LinearGradient
        colors={[flowBg, flowBg]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      {/* One task = one screen. Big text card, record→Next morph, a very
          short score summary between tasks. Reading / warm-up / show-time
          levels return earlier with their own dedicated views. */}
      <TaskFlowView
        tasks={level.tasks}
        levelId={levelId}
        levelNumber={level.levelNumber}
        title={level.title}
        subtitle={level.subtitle}
        accent={isCleanLevel ? colors.gold : pathCols.brick}
        screenBg={isCleanLevel ? undefined : pathCols.bg}
        isInterview={isInterviewLevel}
        isTongue={isTongueLevel}
        colors={colors}
        isDark={isDark}
        lang={lang}
        topPad={topPad}
        bottomPad={bottomPad}
        onTaskScored={handleFlowScored}
        onAllComplete={handleFlowFinished}
        onExit={handleExitPress}
      />

      {/* Aggregate level flower — its dark canvas + bloom IS the "screen
          darkens → flower appears" moment after the last task. */}
      <Modal visible={!!levelFlower} animationType="fade" transparent={false} presentationStyle="fullScreen">
        {levelFlower ? (
          <FlowerResultWindow
            overall={levelFlower.score.overall}
            aspects={aspectsFromScore10(levelFlower.score, lang)}
            summary={levelFlower.summary}
            tip={levelFlower.tip}
            growth={levelFlower.recommendations}
            strengths={levelFlower.strengths}
            isDark={isDark}
            colors={colors}
            t={t}
            lang={lang}
            primaryLabel={t("forward")}
            onPrimary={handleFlowerContinue}
          />
        ) : null}
      </Modal>

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
        roleBonus={roleBonus}
      />

      <DevSkipButton levelId={levelId} onPreviewResults={handlePreviewResults} />
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
  flowerSection: {
    alignItems: "center",
    gap: 14,
    marginTop: 2,
    marginBottom: 4,
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

  // Flower result window
  heroSection: { alignItems: "center", gap: 4, marginTop: -4 },
  scoreRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  scoreHeroNum: { fontSize: 46 },
  scoreHeroDenom: { fontSize: 17, marginTop: 16 },
  tierLabel: { fontSize: 15, letterSpacing: 0.4 },
  metricsCard: {
    flexDirection: "row",
    flexWrap: "wrap",
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    rowGap: 12,
  },
  metricItem: {
    flexBasis: "50%",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 4,
  },
  // Fixed label width → values line up in a column (comfortable), but sit right
  // after the longest label instead of at the far cell edge (close to param).
  metricLabel: { width: 108, fontSize: 12.5 },
  metricValue: { fontSize: 14 },
  oscarSection: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    marginBottom: -4,
  },
  adviceCard: { borderWidth: 1, borderRadius: 18, padding: 16, gap: 9 },
  adviceHead: { flexDirection: "row", alignItems: "center", gap: 7 },
  adviceTitle: { fontSize: 13, letterSpacing: 0.6, textTransform: "uppercase" },
  adviceLead: { fontSize: 15.5, lineHeight: 22 },
  adviceRow: { flexDirection: "row", alignItems: "flex-start", gap: 9 },
  adviceText: { flex: 1, fontSize: 14, lineHeight: 20 },
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
  roleBonus: {
    marginTop: 16,
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 18,
    overflow: "hidden",
  },
  roleBonusEmoji: { fontSize: 26 },
  roleBonusLabel: { fontSize: 10, color: "rgba(255,255,255,0.8)", letterSpacing: 1.2 },
  roleBonusTitle: { fontSize: 15, color: "#fff", marginTop: 1 },
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
  readingExitBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
  },
  readingExitCard: {
    width: "100%",
    maxWidth: 380,
    borderRadius: 24,
    borderWidth: 1,
    padding: 22,
    gap: 12,
  },
  readingExitTitle: {
    fontSize: 20,
    fontFamily: "Nunito_700Bold",
    letterSpacing: -0.3,
  },
  readingExitMsg: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: "Nunito_400Regular",
    marginBottom: 6,
  },
  readingExitLeave: {
    height: 50,
    borderRadius: 15,
    backgroundColor: "#E5484D",
    alignItems: "center",
    justifyContent: "center",
  },
  readingExitLeaveTxt: {
    color: "#FFFFFF",
    fontSize: 16,
    fontFamily: "Nunito_700Bold",
  },
  readingExitStay: {
    height: 50,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  readingExitStayTxt: {
    fontSize: 16,
    fontFamily: "Nunito_600SemiBold",
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
