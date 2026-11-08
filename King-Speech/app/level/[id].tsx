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
import LevelCompleteModal from "@/components/LevelCompleteModal";
import AppDialog from "@/components/AppDialog";
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
import { READING_BG_DARK } from "@/components/reading/readingTheme";
import StageGlassDialog from "@/components/showtime/StageGlassDialog";
import { aspectsFromScore10, ASPECT_META } from "@/components/ScoreFlower";
import OscarMascot from "@/components/OscarMascot";
import { Image as ExpoImage } from "expo-image";
import { useTheme } from "@/context/ThemeContext";

// Figma "Оскар · все позы" exports for the level score screen, keyed to alpha.
const OSCAR_SCORE_HAPPY = require("@/assets/figma/levels/oscar-happy.png");
const OSCAR_SCORE_SAD = require("@/assets/figma/levels/oscar-sad.png");
import TaskFlowView from "@/components/TaskFlowView";
import { aggregateAnalyses } from "@/services/analyzeGenericTask";
import WarmupLevelView from "@/components/warmup/WarmupLevelView";
import DevSkipButton from "@/components/DevSkipButton";
import { getModuleFromLevelId, getInterviewVariantsForLevel } from "@/constants/contentLoader";
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
const RS_HIGH = "#FFEDA8";   // royal gold  (>=8)
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
        <Text style={[rs.feedbackTitle, { color: fgText, fontFamily: "Geologica_600SemiBold" }]}>
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
        <Text style={[rs.transcriptText, { color: fgText, fontFamily: "Geologica_400Regular" }]}>
          {segments.map((seg, i) =>
            seg.isFiller ? (
              <Text
                key={i}
                style={{
                  color: accent,
                  backgroundColor: fillerBg,
                  fontFamily: "Geologica_600SemiBold",
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
            <Text style={[rs.transcriptToggleText, { color: fgMuted, fontFamily: "Geologica_500Medium" }]}>
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

  const { theme } = useTheme();
  // Figma (37:5981 / 37:6190): the score + tier are always the gold accent
  // (ink on the light theme), regardless of tier.
  const scoreColor = theme.accentInk;

  // Oscar reacts to the result: thumbs-up for excellent (Rive), joy for good
  // and sadness for a weak take — the latter two use the Figma pose exports
  // ("Oscar 02 · Радуется", "Oscar 03 · Грустит").
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

  const fgText = theme.text;
  const fgMuted = isDark ? "rgba(240,238,233,0.62)" : theme.textSecondary;
  const cardBg = isDark ? "rgba(255,237,168,0.07)" : "rgba(255,237,168,0.14)";
  const cardBorder = isDark ? "rgba(240,238,233,0.06)" : "rgba(38,38,40,0.08)"; // stroke/shape
  const retryBg = isDark ? "rgba(240,238,233,0.06)" : "rgba(38,38,40,0.04)";
  const retryBorder = isDark ? "rgba(240,238,233,0.10)" : "rgba(38,38,40,0.08)";

  // Merge the coaching tip + growth points into ONE message (tip leads, the
  // remaining growth points become supporting lines).
  const tipText = (tip ?? "").trim();
  const growthLines = (growth ?? [])
    .map((g) => g.trim())
    .filter((g) => g && g.toLowerCase() !== tipText.toLowerCase());
  const hasAdvice = !!tipText || growthLines.length > 0;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[rs.content, { paddingTop: topPad + 28, paddingBottom: bottomPad + 8 }]}
      >
        {/* Oscar leads the screen — big, centered, no card around him */}
        <Animated.View entering={FadeIn.duration(450)} style={rs.oscarSection}>
          {oscarEmotion === "thumbup" ? (
            <OscarMascot emotion="thumbup" size={312} />
          ) : (
            <ExpoImage
              source={oscarEmotion === "happy" ? OSCAR_SCORE_HAPPY : OSCAR_SCORE_SAD}
              style={rs.oscarPose}
              contentFit="contain"
            />
          )}
        </Animated.View>

        {/* Overall score right under the mascot — plain number, no circle */}
        <Animated.View entering={FadeIn.delay(80).duration(350)} style={rs.heroSection}>
          <View style={rs.scoreRow}>
            <Text style={[rs.scoreHeroNum, { color: scoreColor, fontFamily: "Geologica_700Bold" }]}>
              {overall.toFixed(1)}
            </Text>
            <Text style={[rs.scoreHeroDenom, { color: fgMuted, fontFamily: "Geologica_600SemiBold" }]}>
              /10
            </Text>
          </View>
          <Text style={[rs.tierLabel, { color: scoreColor, fontFamily: "Geologica_600SemiBold" }]}>
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
                style={[rs.metricLabel, { color: fgMuted, fontFamily: "Geologica_500Medium" }]}
              >
                {a.label}
              </Text>
              <Text style={[rs.metricValue, { color: fgText, fontFamily: "Geologica_700Bold" }]}>
                {a.score.toFixed(1)}
              </Text>
            </View>
          ))}
        </Animated.View>

        {/* One combined "what to improve" message (tip + growth merged) */}
        {hasAdvice ? (
          <Animated.View
            entering={FadeInDown.delay(220).duration(400)}
            style={[rs.adviceCard, { backgroundColor: cardBg, borderColor: cardBorder }]}
          >
            <View style={rs.adviceHead}>
              <Text style={[rs.adviceTitle, { color: scoreColor, fontFamily: "Geologica_600SemiBold" }]}>
                {lang === "ru" ? "Над чем поработать" : "What to work on"}
              </Text>
            </View>
            {tipText ? (
              <Text style={[rs.adviceLead, { color: fgText, fontFamily: "Geologica_700Bold" }]}>{tipText}</Text>
            ) : null}
            {growthLines.map((g, i) => (
              <Text key={i} style={[rs.adviceText, { color: fgMuted, fontFamily: "Geologica_400Regular" }]}>{g}</Text>
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
              <Text style={[rs.retryBtnText, { color: fgMuted, fontFamily: "Geologica_600SemiBold" }]}>{t("again")}</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={onPrimary}
            style={({ pressed }) => [
              rs.nextBtn,
              rs.flowerNextBtn,
              { backgroundColor: theme.accent, borderColor: theme.ctaStroke, opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
            ]}
          >
            <Text style={[rs.nextBtnText, { fontFamily: "Geologica_700Bold", color: theme.accentText }]}>{primaryLabel}</Text>
            <Ionicons name="arrow-forward" size={17} color={theme.accentText} />
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
          <Text style={[ers.title, { color: fg, fontFamily: "Geologica_700Bold" }]}>
            {lang === "ru" ? "Кажется, мы тебя не услышали" : "We didn't quite hear you"}
          </Text>
          <Text style={[ers.body, { color: muted, fontFamily: "Geologica_400Regular" }]}>
            {lang === "ru"
              ? "Чтобы пройти уровень, нужно говорить вслух. Ничего страшного — попробуй ещё раз, чуть увереннее и ближе к микрофону."
              : "To pass this level you need to speak out loud. No worries — give it another go, a little louder and closer to the mic."}
          </Text>
          <Pressable
            onPress={onRetry}
            style={({ pressed }) => [ers.btn, { backgroundColor: btnBg, opacity: pressed ? 0.85 : 1 }]}
          >
            <Ionicons name="refresh" size={18} color={btnFg} />
            <Text style={[ers.btnText, { color: btnFg, fontFamily: "Geologica_700Bold" }]}>
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


// Level complete window → components/LevelCompleteModal.tsx (Figma 37:5107).

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
  const [allDoneOpen, setAllDoneOpen] = useState(false);
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
  const [readingWaveform, setReadingWaveform] = useState<number[] | null>(null);
  // When each line lit up during the capture — replays the karaoke on listen-back.
  const [readingLineTimes, setReadingLineTimes] = useState<number[] | null>(null);
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
      // Alert.alert is a no-op on web — use the shared glass dialog (Figma
      // 133:167 "Путь · Все уровни пройдены").
      setAllDoneOpen(true);
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
    // Asked from the listen-back screen: drop the review first.
    setShowReadingReview(false);
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
    waveform?: number[],
    lineTimesMs?: number[],
  ) => {
    if (isReadingLevel) {
      // Reading levels open the self-review screen immediately (so the player
      // can listen back) and analyze in the background — no blocking loader.
      setReadingAudioUri(audioUri ?? null);
      setReadingWaveform(waveform ?? null);
      setReadingLineTimes(lineTimesMs ?? null);
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
  const handleReadingSave = async (selfRating: number, saveToLibrary: boolean = true) => {
    if (readingSaving) return;
    setReadingSaving(true);
    const overall = currentAnalysis?.score.overall ?? 0;
    // The score is now the player's own self-rating (scaled to /10); the AI
    // overall is only used if it happens to exist (kept for the library entry).
    const finalScore = Math.max(2, selfRating * 2);

    if (saveToLibrary) {
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
            waveform: readingWaveform ?? undefined,
          });
        }
      } catch (e) {
        console.warn("save reading recording failed:", e);
      }
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
      // Complete the level atomically so "Выход" leaves it marked as passed.
      const avg = payload.scores.length
        ? payload.scores.reduce((a, b) => a + b, 0) / payload.scores.length
        : 0;
      completeAllTasksForLevel(levelId, avg);
      setTimeout(() => setShowLevelComplete(true), 400);
    },
    [completeAllTasksForLevel, levelId],
  );

  // New one-task-per-screen flow (tongue twisters / interview levels): the
  // player finished the last task. Aggregate every per-task take into one
  // level flower; continuing from it opens the LevelComplete celebration.
  const handleFlowFinished = React.useCallback(
    (payload: { scores: number[]; analyses: SpeechAnalysis[]; durationSec: number }) => {
      setScores(payload.scores);
      setLevelDurationSec(payload.durationSec);
      setLevelFlower(aggregateAnalyses(payload.analyses, lang));
      // Mark the whole level complete + unlock the next one in a single atomic
      // update. (Completing tasks one-by-one in a synchronous loop read stale
      // state and lost all but the last task, so the level looked unfinished
      // on the map after "Выход".)
      const avg = payload.scores.length
        ? payload.scores.reduce((a, b) => a + b, 0) / payload.scores.length
        : 0;
      completeAllTasksForLevel(levelId, avg);
    },
    [lang, completeAllTasksForLevel, levelId],
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
        <AppDialog
          visible={allDoneOpen}
          title={t("allLevelsDone")}
          buttons={[{ label: t("okBtn"), variant: "primary", onPress: () => { setAllDoneOpen(false); router.replace("/(tabs)"); } }]}
          onRequestClose={() => { setAllDoneOpen(false); router.replace("/(tabs)"); }}
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
    // Reading runs on a neutral page (Figma 312:4346: #0E0E10 dark / app bg
    // light); the MODULE colour (67-colour ranks palette) only tints the
    // current line, the progress fill and the listen-back kicker.
    const readingBg = isDark ? READING_BG_DARK : colors.background;
    const readingModuleColor = getPathColors(level.module, isDark).brick;
    return (
      <View style={[styles.container, { backgroundColor: readingBg }]}>
        <ReadingLevelView
          fullText={fullText}
          accentColor={accent}
          moduleColor={readingModuleColor}
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
              waveform={readingWaveform ?? undefined}
              fullText={fullText}
              lineTimesMs={readingLineTimes ?? undefined}
              moduleColor={readingModuleColor}
              onClose={() => setReadingExitConfirm(true)}
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
        <AppDialog
          visible={allDoneOpen}
          title={t("allLevelsDone")}
          buttons={[{ label: t("okBtn"), variant: "primary", onPress: () => { setAllDoneOpen(false); router.replace("/(tabs)"); } }]}
          onRequestClose={() => { setAllDoneOpen(false); router.replace("/(tabs)"); }}
        />

        {/* Close X (top-right, above ReadingLevelView header) — hidden while
            the self-review overlay is up so it doesn't sit over the hero. */}
        {!showReadingReview && (
        <Pressable
          onPress={openReadingExit}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={lang === "ru" ? "Выйти из чтения" : "Leave the reading"}
          style={({ pressed }) => [
            styles.closeBtnAbs,
            { top: topPad + 8, opacity: pressed ? 0.6 : 1, backgroundColor: "transparent" },
          ]}
        >
          <Ionicons name="close" size={24} color={colors.text} />
        </Pressable>
        )}

        {/* Exit confirmation (Figma 37:2945 liquid glass) — «Читать заново»
            restarts the reading from the top, «Выйти» → map. */}
        <StageGlassDialog
          visible={readingExitConfirm}
          title={lang === "ru" ? "Выйти из чтения?" : "Leave the reading?"}
          message={
            lang === "ru"
              ? "Прогресс этого чтения не сохранится — придётся читать заново."
              : "This reading won't be saved — you'll have to read it again."
          }
          onRequestClose={cancelReadingExit}
          dismissOnBackdrop={false}
          overlay={0.55}
          buttons={[
            {
              label: lang === "ru" ? "Читать заново" : "Read again",
              variant: "secondary",
              onPress: cancelReadingExit,
            },
            {
              label: lang === "ru" ? "Выйти" : "Leave",
              variant: "primary",
              onPress: confirmReadingExit,
            },
          ]}
        />

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
        interviewVariants={isInterviewLevel ? getInterviewVariantsForLevel(levelId, lang) : null}
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
          darkens → flower appears" moment after the last task. Rendered as an
          in-tree full-screen overlay (NOT a RN <Modal>): on the New
          Architecture a Modal can fail to unmount on state change/navigation,
          leaving the mascot ghosted over the next level. An overlay unmounts
          cleanly the moment `levelFlower` is cleared. */}
      {levelFlower ? (
        <View style={StyleSheet.absoluteFill}>
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
        </View>
      ) : null}

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
      <AppDialog
        visible={allDoneOpen}
        title={t("allLevelsDone")}
        buttons={[{ label: t("okBtn"), variant: "primary", onPress: () => { setAllDoneOpen(false); router.replace("/(tabs)"); } }]}
        onRequestClose={() => { setAllDoneOpen(false); router.replace("/(tabs)"); }}
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

  // Flower result window (Figma 37:5981 "Оценка уровня")
  heroSection: { alignItems: "center", gap: 4, marginTop: -14 },
  oscarPose: { width: 406, height: 406 },
  flowerNextBtn: { height: 48, paddingVertical: 0, borderRadius: 32, borderWidth: 4 },
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
    borderWidth: 2,
    borderRadius: 22,
    paddingHorizontal: 13,
    paddingVertical: 11,
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
  adviceCard: { borderWidth: 2, borderRadius: 22, padding: 16, gap: 9 },
  adviceHead: { flexDirection: "row", alignItems: "center", gap: 7 },
  adviceTitle: { fontSize: 13, letterSpacing: 0.6, textTransform: "uppercase" },
  adviceLead: { fontSize: 15.5, lineHeight: 22 },
  adviceRow: { flexDirection: "row", alignItems: "flex-start", gap: 9 },
  adviceText: { flex: 1, fontSize: 14, lineHeight: 20 },
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
    fontFamily: "Geologica_700Bold",
    letterSpacing: -0.3,
  },
  readingExitMsg: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: "Geologica_400Regular",
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
    fontFamily: "Geologica_700Bold",
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
    fontFamily: "Geologica_600SemiBold",
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
