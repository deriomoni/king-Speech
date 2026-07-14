import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Modal,
  type LayoutChangeEvent,
  type TextLayoutLine,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
  interpolate,
  Easing,
  FadeIn,
  FadeOut,
  FadeInDown,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useLang } from "@/context/LangContext";
import { reading as R } from "@/theme/tokens";
import ReadingText, { tokenizeReading } from "@/components/ReadingText";
import { useReadingCapture } from "@/hooks/useReadingCapture";
import type { AppColors } from "@/constants/colors";

type ReadingCategory = "prose" | "poetry" | "fable";

interface Props {
  fullText: string;
  accentColor: string;
  colors: AppColors;
  topPad: number;
  bottomPad: number;
  title: string;
  subtitle: string;
  onBack: () => void;
  onRecordingComplete: (
    durationSeconds: number,
    audioBase64?: string,
    audioUri?: string,
  ) => void;
  resetSignal: number;
  author?: string;
  workTitle?: string;
  category?: ReadingCategory;
  /** "1825 год" — shown in the "Узнать больше" sheet. */
  year?: string;
  /** Short "what it's about" blurb for the "Узнать больше" sheet. */
  about?: string;
}

type Phase = "idle" | "countdown" | "recording" | "saving";

const BEZ = Easing.bezier(0.22, 1, 0.36, 1);

function heroSizeFor(title: string): number {
  const n = title.length;
  if (n > 18) return R.type.heroSizeSm;
  if (n > 12) return R.type.heroSizeMd;
  return R.type.heroSizeLg;
}

function isDarkBg(hex: string): boolean {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return true;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255,
    g = (n >> 8) & 255,
    b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.5;
}

const WORD_RE = /[\p{L}\p{N}]+(?:[’'\-][\p{L}\p{N}]+)*/gu;
function wordsIn(text: string): number {
  return (text.match(WORD_RE) ?? []).length;
}

export default function ReadingLevelView({
  fullText,
  accentColor,
  colors,
  topPad,
  bottomPad,
  title,
  onBack,
  onRecordingComplete,
  resetSignal,
  author,
  workTitle,
  category = "poetry",
  year,
  about,
}: Props) {
  const { lang } = useLang();

  const dark = isDarkBg(colors.background);
  const theme = dark ? R.dark : R.light;

  const displayTitle = workTitle ?? title;
  const heroSize = heroSizeFor(displayTitle);
  const heroLine = Math.round(heroSize * R.type.heroLineRatio);

  const genre =
    category === "poetry"
      ? lang === "ru"
        ? "Поэзия"
        : "Poetry"
      : category === "fable"
        ? lang === "ru"
          ? "Басня"
          : "Fable"
        : lang === "ru"
          ? "Проза"
          : "Prose";
  const kicker = [author, genre].filter(Boolean).join("  ·  ");

  const { tokens, wordCount } = useMemo(
    () => tokenizeReading(fullText),
    [fullText],
  );

  // Per-word pacing metadata: length + an extra dwell after punctuation / line
  // ends so the guide breathes at natural stops.
  const wordMeta = useMemo(() => {
    const arr: Array<{ len: number; pause: number }> = [];
    for (let i = 0; i < tokens.length; i++) {
      const tk = tokens[i];
      if (!tk.isWord) continue;
      const next = tokens[i + 1];
      let pause = 0;
      if (next && !next.isWord) {
        if (/[.!?…]/.test(next.text)) pause = R.pace.stopPauseMs;
        else if (/[,;:\n]/.test(next.text)) pause = R.pace.commaPauseMs;
      }
      arr[tk.wordIndex] = { len: tk.text.length, pause };
    }
    return arr;
  }, [tokens]);

  const [phase, setPhase] = useState<Phase>("idle");
  const [countdown, setCountdown] = useState<number>(3);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const [speedIdx, setSpeedIdx] = useState<number>(R.pace.defaultIndex);
  const [showInfo, setShowInfo] = useState(false);
  const isRecording = phase === "recording";
  const showCountdown = phase === "countdown";
  const busy = isRecording || showCountdown;

  const speedRef = useRef(speedIdx);
  useEffect(() => {
    speedRef.current = speedIdx;
  }, [speedIdx]);

  const { begin, finish, cancel } = useReadingCapture();

  // ── Mirror Type Transition (smoother; fires once the countdown ends) ────────
  const phaseP = useSharedValue(0);
  const authorP = useSharedValue(0);
  const bodyP = useSharedValue(0);
  const btnP = useSharedValue(0);
  const stopP = useSharedValue(0);
  const heroH = useSharedValue(0);

  const enterReading = () => {
    btnP.value = withTiming(1, { duration: 220, easing: BEZ });
    phaseP.value = withDelay(60, withTiming(1, { duration: 760, easing: BEZ }));
    authorP.value = withDelay(90, withTiming(1, { duration: 700, easing: BEZ }));
    bodyP.value = withDelay(150, withTiming(1, { duration: 820, easing: BEZ }));
    stopP.value = withDelay(360, withSpring(1, { damping: 15, stiffness: 120 }));
  };
  const exitReading = (instant = false) => {
    if (instant) {
      phaseP.value = 0;
      authorP.value = 0;
      bodyP.value = 0;
      btnP.value = 0;
      stopP.value = 0;
      return;
    }
    stopP.value = withTiming(0, { duration: 200, easing: BEZ });
    bodyP.value = withTiming(0, { duration: 460, easing: BEZ });
    authorP.value = withTiming(0, { duration: 460, easing: BEZ });
    phaseP.value = withTiming(0, { duration: 480, easing: BEZ });
    btnP.value = withDelay(160, withTiming(0, { duration: 280, easing: BEZ }));
  };

  const countdownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const generationRef = useRef<number>(0);

  const scrollRef = useRef<ScrollView>(null);
  const lineOffsetsRef = useRef<number[]>([]);
  const lineYRef = useRef<number[]>([]);
  const viewportHRef = useRef<number>(0);
  const lastScrolledLineRef = useRef<number>(-1);
  const canvasTopRef = useRef<number>(0);

  useEffect(() => {
    return () => {
      generationRef.current += 1;
      if (countdownTimerRef.current) clearTimeout(countdownTimerRef.current);
      cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    generationRef.current += 1;
    setPhase("idle");
    setCountdown(3);
    setCurrentIndex(-1);
    if (countdownTimerRef.current) clearTimeout(countdownTimerRef.current);
    cancel();
    exitReading(true);
    lastScrolledLineRef.current = -1;
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetSignal]);

  // ── Paced reading guide: advance one word at a time at the chosen speed ─────
  const delayForWord = (i: number): number => {
    const wpm = R.pace.wpm[speedRef.current] ?? R.pace.wpm[1];
    const base = 60000 / wpm;
    const m = wordMeta[i] ?? { len: 5, pause: 0 };
    const lenFactor = Math.min(1.8, Math.max(0.72, 0.55 + m.len / 7));
    return base * lenFactor + m.pause;
  };

  useEffect(() => {
    if (phase !== "recording" || wordCount === 0) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const advance = (i: number) => {
      if (cancelled) return;
      setCurrentIndex(i);
      if (i >= wordCount - 1) return;
      timer = setTimeout(() => advance(i + 1), delayForWord(i));
    };
    setCurrentIndex(-1);
    timer = setTimeout(() => advance(0), R.pace.leadInMs);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, wordCount]);

  const beginRecording = async () => {
    setPhase("recording");
    enterReading();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    await begin();
  };

  const startCountdown = () => {
    if (phase !== "idle") return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPhase("countdown");
    setCountdown(3);
    const myGen = generationRef.current;
    const tick = (n: number) => {
      if (myGen !== generationRef.current) return;
      if (n === 0) {
        beginRecording();
        return;
      }
      Haptics.selectionAsync();
      setCountdown(n);
      countdownTimerRef.current = setTimeout(() => tick(n - 1), 900);
    };
    tick(3);
  };

  const stopRecording = async () => {
    if (phase !== "recording") return;
    exitReading();
    setPhase("saving");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const { durationSec, audioBase64, audioUri } = await finish();
    onRecordingComplete(durationSec, audioBase64, audioUri);
  };

  const cycleSpeed = () => {
    Haptics.selectionAsync();
    setSpeedIdx((s) => (s + 1) % R.pace.wpm.length);
  };

  // ── Autoscroll ──────────────────────────────────────────────────────────────
  const onCanvasTextLayout = (lines: TextLayoutLine[]) => {
    const cum: number[] = [];
    const ys: number[] = [];
    let acc = 0;
    for (const ln of lines) {
      acc += wordsIn(ln.text);
      cum.push(acc);
      ys.push(ln.y);
    }
    lineOffsetsRef.current = cum;
    lineYRef.current = ys;
  };

  useEffect(() => {
    if (!isRecording || currentIndex < 0) return;
    const cum = lineOffsetsRef.current;
    if (cum.length === 0) return;
    let line = cum.findIndex((c) => currentIndex < c);
    if (line === -1) line = cum.length - 1;
    if (line === lastScrolledLineRef.current) return;
    lastScrolledLineRef.current = line;
    const y = lineYRef.current[line] ?? 0;
    const vp = viewportHRef.current || 600;
    const target = Math.max(0, canvasTopRef.current + y - vp * 0.42);
    scrollRef.current?.scrollTo({ y: target, animated: true });
  }, [currentIndex, isRecording]);

  // ── Animated styles ─────────────────────────────────────────────────────────
  const heroWrapStyle = useAnimatedStyle(() => ({
    height:
      heroH.value > 0
        ? interpolate(
            phaseP.value,
            [0, 1],
            [heroH.value, heroH.value * R.heroToCaptionScale],
          )
        : undefined,
  }));
  const titleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(phaseP.value, [0, 1], [1, R.captionOpacity]),
    transform: [
      { scale: interpolate(phaseP.value, [0, 1], [1, R.heroToCaptionScale]) },
    ],
  }));
  const authorStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      authorP.value,
      [0, 1],
      [R.type.kickerOpacity, R.type.metaOpacity],
    ),
  }));
  const bodyStyle = useAnimatedStyle(() => ({
    opacity: interpolate(bodyP.value, [0, 1], [R.idleBodyOpacity, 1]),
    transform: [
      { scale: interpolate(bodyP.value, [0, 1], [R.idleBodyScale, 1]) },
    ],
  }));
  const fadeMaskStyle = useAnimatedStyle(() => ({
    opacity: interpolate(bodyP.value, [0, 1], [1, 0]),
  }));
  const startBtnStyle = useAnimatedStyle(() => ({
    opacity: interpolate(btnP.value, [0, 1], [1, 0]),
    transform: [
      { scale: interpolate(btnP.value, [0, 1], [1, 0.9]) },
      { translateY: interpolate(btnP.value, [0, 1], [0, 10]) },
    ],
  }));
  const stopStyle = useAnimatedStyle(() => ({
    opacity: stopP.value,
    transform: [{ scale: interpolate(stopP.value, [0, 1], [0.9, 1]) }],
  }));

  const speedLabel = R.pace.labels[speedIdx] ?? "1×";

  return (
    <View style={[st.container, { backgroundColor: colors.background }]}>
      {/* Top: just back — no progress board, no quote glyph */}
      <View style={[st.topRow, { paddingTop: topPad + 10 }]}>
        <Pressable
          onPress={onBack}
          disabled={busy}
          hitSlop={12}
          style={({ pressed }) => [
            st.backBtn,
            { opacity: pressed ? 0.6 : busy ? 0 : 0.7 },
          ]}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
      </View>

      {/* Scrollable stage */}
      <ScrollView
        ref={scrollRef}
        style={st.scroll}
        contentContainerStyle={[st.scrollContent, { paddingBottom: bottomPad + 150 }]}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!busy}
        onLayout={(e: LayoutChangeEvent) => {
          viewportHRef.current = e.nativeEvent.layout.height;
        }}
      >
        <Animated.View style={[st.heroWrap, heroWrapStyle]}>
          <Animated.View
            entering={FadeInDown.delay(120).duration(460)}
            onLayout={(e) => {
              if (heroH.value === 0) heroH.value = e.nativeEvent.layout.height;
            }}
            style={[st.titleLayer, titleStyle]}
          >
            <Text
              style={{
                fontFamily: R.type.heroFont,
                fontSize: heroSize,
                lineHeight: heroLine,
                letterSpacing: R.type.heroTracking,
                color: colors.text,
              }}
            >
              {displayTitle}
            </Text>
          </Animated.View>
        </Animated.View>

        {kicker ? (
          <Animated.Text
            entering={FadeInDown.delay(200).duration(440)}
            numberOfLines={1}
            style={[
              st.kicker,
              {
                fontFamily: R.type.kickerFont,
                fontSize: R.type.kickerSize,
                letterSpacing: R.type.kickerTracking,
                color: colors.text,
              },
              authorStyle,
            ]}
          >
            {kicker.toUpperCase()}
          </Animated.Text>
        ) : null}

        <Animated.View
          entering={FadeInDown.delay(280).duration(520)}
          onLayout={(e) => {
            canvasTopRef.current = e.nativeEvent.layout.y;
          }}
          style={[st.bodyWrap, bodyStyle]}
        >
          <ReadingText
            tokens={tokens}
            currentIndex={currentIndex}
            colors={theme.word}
            fontFamily={R.type.bodyFont}
            fontSize={R.type.bodySize}
            lineHeight={Math.round(R.type.bodySize * R.type.bodyLineRatio)}
            onTextLayout={onCanvasTextLayout}
          />
        </Animated.View>
      </ScrollView>

      {/* Fade mask — hides the long text in IDLE, lifts as reading begins */}
      <Animated.View pointerEvents="none" style={[st.fadeMask, fadeMaskStyle]}>
        <LinearGradient
          colors={["transparent", colors.background]}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      {/* Footer controls: reading speed + learn more (disabled while reading) */}
      <View
        style={[st.footer, { bottom: bottomPad + 20 }]}
        pointerEvents={busy ? "none" : "auto"}
      >
        <Pressable
          onPress={cycleSpeed}
          disabled={busy}
          style={({ pressed }) => [
            st.chip,
            {
              backgroundColor: colors.backgroundSecondary,
              opacity: busy ? 0.28 : pressed ? 0.7 : 1,
            },
          ]}
        >
          <Ionicons name="speedometer-outline" size={13} color={colors.textSecondary} />
          <Text style={[st.chipText, { color: colors.textSecondary, fontFamily: R.type.metaFont }]}>
            {speedLabel}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setShowInfo(true)}
          disabled={busy}
          style={({ pressed }) => [
            st.chip,
            {
              backgroundColor: colors.backgroundSecondary,
              opacity: busy ? 0.28 : pressed ? 0.7 : 1,
            },
          ]}
        >
          <Ionicons name="book-outline" size={13} color={colors.textSecondary} />
          <Text style={[st.chipText, { color: colors.textSecondary, fontFamily: R.type.metaFont }]}>
            {(lang === "ru" ? "Узнать больше" : "Learn more").toUpperCase()}
          </Text>
        </Pressable>
      </View>

      {/* Start button — centered (IDLE) */}
      <Animated.View
        style={[st.centerDock, { bottom: bottomPad + 68 }, startBtnStyle]}
        pointerEvents={busy ? "none" : "auto"}
      >
        <Pressable
          onPress={startCountdown}
          disabled={phase !== "idle"}
          style={({ pressed }) => [st.startBtn, { transform: [{ scale: pressed ? 0.96 : 1 }] }]}
        >
          <View style={[st.startGlow, { backgroundColor: accentColor }]} />
          <LinearGradient
            colors={[R.button.from, R.button.to]}
            start={{ x: 0.1, y: 0 }}
            end={{ x: 0.9, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <Ionicons name="play" size={15} color={R.button.on} />
          <Text style={[st.startLabel, { fontFamily: R.type.heroFont, color: R.button.on }]}>
            {lang === "ru" ? "Читать" : "Read"}
          </Text>
        </Pressable>
      </Animated.View>

      {/* Stop control — centered (READING) */}
      <Animated.View
        style={[st.centerDock, { bottom: bottomPad + 60 }, stopStyle]}
        pointerEvents={isRecording ? "auto" : "none"}
      >
        <Pressable
          onPress={stopRecording}
          disabled={!isRecording}
          style={({ pressed }) => [
            st.stopBtn,
            {
              backgroundColor: colors.backgroundSecondary,
              transform: [{ scale: pressed ? 0.94 : 1 }],
            },
          ]}
        >
          <View style={[st.stopHalo, { borderColor: accentColor }]} />
          <View style={[st.stopSquare, { backgroundColor: accentColor }]} />
        </Pressable>
      </Animated.View>

      {/* Countdown overlay */}
      {showCountdown && (
        <Animated.View
          entering={FadeIn.duration(180)}
          exiting={FadeOut.duration(220)}
          style={[st.overlay, { backgroundColor: colors.background + "F2" }]}
          pointerEvents="none"
        >
          <Animated.Text
            key={`cd-${countdown}`}
            entering={FadeIn.duration(200)}
            exiting={FadeOut.duration(200)}
            style={[st.countdownNum, { color: colors.text, fontFamily: R.type.heroFont }]}
          >
            {countdown}
          </Animated.Text>
          <Text
            style={[st.countdownHint, { color: colors.textMuted, fontFamily: R.type.kickerFont }]}
          >
            {(lang === "ru" ? "Приготовься" : "Get ready").toUpperCase()}
          </Text>
        </Animated.View>
      )}

      {/* "Узнать больше" sheet */}
      <Modal
        visible={showInfo}
        transparent
        animationType="fade"
        onRequestClose={() => setShowInfo(false)}
      >
        <Pressable style={st.infoOverlay} onPress={() => setShowInfo(false)}>
          <Pressable
            style={[st.infoCard, { backgroundColor: colors.backgroundSecondary }]}
            onPress={() => {}}
          >
            <Text style={[st.infoKicker, { color: accentColor, fontFamily: R.type.kickerFont }]}>
              {(author ? `${author}  ·  ${genre}` : genre).toUpperCase()}
            </Text>
            <Text style={[st.infoTitle, { color: colors.text, fontFamily: R.type.kickerFont }]}>
              {displayTitle}
            </Text>
            {year ? (
              <View style={st.infoRow}>
                <Ionicons name="calendar-outline" size={15} color={colors.textMuted} />
                <Text style={[st.infoMeta, { color: colors.textSecondary, fontFamily: R.type.bodyFont }]}>
                  {year}
                </Text>
              </View>
            ) : null}
            {about ? (
              <Text style={[st.infoBody, { color: colors.textSecondary, fontFamily: R.type.bodyFont }]}>
                {about}
              </Text>
            ) : (
              <Text style={[st.infoBody, { color: colors.textMuted, fontFamily: R.type.bodyFont }]}>
                {lang === "ru"
                  ? "Описание появится позже."
                  : "Description coming soon."}
              </Text>
            )}
            <Pressable
              onPress={() => setShowInfo(false)}
              style={({ pressed }) => [
                st.infoClose,
                { backgroundColor: colors.background, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Text style={[st.infoCloseText, { color: colors.text, fontFamily: R.type.kickerFont }]}>
                {(lang === "ru" ? "Закрыть" : "Close").toUpperCase()}
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1 },
  topRow: { paddingHorizontal: 22, minHeight: 44 },
  backBtn: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 30, paddingTop: 40 },
  heroWrap: { justifyContent: "flex-start" },
  titleLayer: { transformOrigin: "left top" },
  kicker: { marginTop: 20 },
  bodyWrap: { marginTop: 34, transformOrigin: "left top" },
  fadeMask: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 240,
  },
  footer: {
    position: "absolute",
    left: 30,
    right: 30,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  chipText: { fontSize: R.type.metaSize, letterSpacing: R.type.metaTracking },
  centerDock: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  startBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 34,
    paddingVertical: 16,
    borderRadius: 18,
    overflow: "hidden",
  },
  startGlow: {
    position: "absolute",
    left: 6,
    right: 6,
    top: 10,
    bottom: -8,
    borderRadius: 20,
    opacity: 0.28,
  },
  startLabel: { fontSize: 16, letterSpacing: 0.3 },
  stopBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  stopHalo: {
    position: "absolute",
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    opacity: 0.4,
  },
  stopSquare: { width: 20, height: 20, borderRadius: 5 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  countdownNum: { fontSize: 140, lineHeight: 150 },
  countdownHint: { fontSize: 12, marginTop: 8, letterSpacing: 2 },
  infoOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    padding: 28,
  },
  infoCard: { borderRadius: 22, padding: 24, gap: 12 },
  infoKicker: { fontSize: 11, letterSpacing: 1.4 },
  infoTitle: { fontSize: 26, letterSpacing: 0.2, marginTop: -2 },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  infoMeta: { fontSize: 15 },
  infoBody: { fontSize: 16, lineHeight: 25 },
  infoClose: {
    alignSelf: "flex-start",
    marginTop: 6,
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 14,
  },
  infoCloseText: { fontSize: 12, letterSpacing: 1.2 },
});
