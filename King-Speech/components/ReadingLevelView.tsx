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
import { readingLines } from "@/src/speech-engine/core/text/reading";
import { useReadingCapture } from "@/hooks/useReadingCapture";
import { getAuthorBio } from "@/constants/authorBios";
import OscarMascot from "@/components/OscarMascot";
import type { AppColors } from "@/constants/colors";

type ReadingCategory = "prose" | "poetry" | "fable";

interface Props {
  fullText: string;
  accentColor: string;
  /** Per-module Path background color (already theme-resolved). */
  bgColor: string;
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
  /** Bumped to restart the reading from the top (countdown → read again). */
  restartSignal: number;
  author?: string;
  workTitle?: string;
  category?: ReadingCategory;
  /** "1825 год" — writing year for the info sheet. */
  year?: string;
  /** Short "what it's about" blurb for the info sheet. */
  about?: string;
}

type Phase = "idle" | "countdown" | "recording" | "saving";

const BEZ = Easing.bezier(0.22, 1, 0.36, 1);
const READING_HEADER_H = 46; // collapsed caption header height
const LOADING_MS = 5000;

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
  bgColor,
  colors,
  topPad,
  bottomPad,
  title,
  onRecordingComplete,
  resetSignal,
  restartSignal,
  author,
  workTitle,
  category = "poetry",
  year,
  about,
}: Props) {
  const { lang } = useLang();

  // Everything is keyed to the MODULE background now, so text/karaoke/button
  // stay readable whether that colour is light or dark.
  const dark = isDarkBg(bgColor);
  const ink = dark ? "#FFFFFF" : "#1A1A2E";
  const inkSoft = dark ? "rgba(255,255,255,0.70)" : "rgba(20,22,26,0.66)";
  const inkFaint = dark ? "rgba(255,255,255,0.46)" : "rgba(20,22,26,0.42)";
  // "Читать" button: black on a light background, white on a dark one. Flat, no
  // gradient; label/icon take the opposite ink.
  const btnBg = dark ? "#FFFFFF" : "#000000";
  const btnInk = dark ? "#000000" : "#FFFFFF";
  // Reading canvas ("полотно") word colours, readable on the module background.
  const wordColors = {
    unread: dark ? "rgba(255,255,255,0.42)" : "rgba(20,22,26,0.40)",
    read: dark ? "rgba(255,255,255,0.42)" : "rgba(20,22,26,0.40)",
    active: ink,
  };

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

  const { tokens } = useMemo(() => tokenizeReading(fullText), [fullText]);
  const lines = useMemo(() => readingLines(tokens), [tokens]);

  const [phase, setPhase] = useState<Phase>("idle");
  const [countdown, setCountdown] = useState<number>(3);
  const [activeK, setActiveK] = useState<number>(-1); // index into `lines`
  const [speedIdx, setSpeedIdx] = useState<number>(R.pace.defaultIndex);
  const [showInfo, setShowInfo] = useState(false);
  const [loading, setLoading] = useState(true);
  const isRecording = phase === "recording";
  const showCountdown = phase === "countdown";
  const busy = isRecording || showCountdown;

  const activeLine = activeK >= 0 && activeK < lines.length ? lines[activeK].line : -1;

  const speedRef = useRef(speedIdx);
  useEffect(() => {
    speedRef.current = speedIdx;
  }, [speedIdx]);

  const { begin, finish, cancel } = useReadingCapture();

  // 5s loading curtain shown once on entry (not on retry): the level mounts +
  // renders the full poem behind it so a long piece is ready when it lifts.
  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), LOADING_MS);
    return () => clearTimeout(timer);
  }, []);

  // ── Mirror transition — header cross-fades big title ↔ caption (no text
  //    scaling, so the caption always renders crisply). ─────────────────────
  const phaseP = useSharedValue(0);
  const bodyP = useSharedValue(0);
  const btnP = useSharedValue(0);
  const stopP = useSharedValue(0);
  const heroH = useSharedValue(0);

  const enterReading = () => {
    btnP.value = withTiming(1, { duration: 240, easing: BEZ });
    phaseP.value = withDelay(60, withTiming(1, { duration: 780, easing: BEZ }));
    bodyP.value = withDelay(150, withTiming(1, { duration: 840, easing: BEZ }));
    stopP.value = withDelay(380, withSpring(1, { damping: 15, stiffness: 120 }));
  };
  const exitReading = (instant = false) => {
    if (instant) {
      phaseP.value = 0;
      bodyP.value = 0;
      btnP.value = 0;
      stopP.value = 0;
      return;
    }
    stopP.value = withTiming(0, { duration: 200, easing: BEZ });
    bodyP.value = withTiming(0, { duration: 480, easing: BEZ });
    phaseP.value = withTiming(0, { duration: 500, easing: BEZ });
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
  // While the reader scrolls by hand, pause autoscroll so it doesn't fight them;
  // it resumes a few seconds after they let go.
  const autoscrollPausedRef = useRef(false);
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onUserScrollStart = () => {
    autoscrollPausedRef.current = true;
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
  };
  const onUserScrollEnd = () => {
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = setTimeout(() => {
      autoscrollPausedRef.current = false;
    }, 3500);
  };

  useEffect(() => {
    return () => {
      generationRef.current += 1;
      if (countdownTimerRef.current) clearTimeout(countdownTimerRef.current);
      if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
      cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    generationRef.current += 1;
    setPhase("idle");
    setCountdown(3);
    setActiveK(-1);
    if (countdownTimerRef.current) clearTimeout(countdownTimerRef.current);
    cancel();
    exitReading(true);
    lastScrolledLineRef.current = -1;
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetSignal]);

  // ── Paced guide: highlight one full line, timed so the reader can read it ───
  const delayForLine = (k: number): number => {
    const wpm = R.pace.wpm[speedRef.current] ?? R.pace.wpm[1];
    const wc = lines[k]?.wordCount ?? 4;
    const sec = wc / (wpm / 60);
    return Math.max(1100, sec * 1000) + R.pace.commaPauseMs;
  };

  useEffect(() => {
    if (phase !== "recording" || lines.length === 0) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const advance = (k: number) => {
      if (cancelled) return;
      setActiveK(k);
      if (k >= lines.length - 1) {
        // Reached the end of the poem — auto-finish once the last line has had
        // its reading time (there's no manual Stop button anymore).
        timer = setTimeout(() => {
          if (!cancelled) stopRecording();
        }, delayForLine(k));
        return;
      }
      timer = setTimeout(() => advance(k + 1), delayForLine(k));
    };
    setActiveK(-1);
    timer = setTimeout(() => advance(0), R.pace.leadInMs);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, lines.length]);

  const beginRecording = async () => {
    setPhase("recording");
    enterReading();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    await begin();
  };

  const runCountdown = () => {
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

  const startCountdown = () => {
    if (phase !== "idle") return;
    runCountdown();
  };

  // Restart from the top (the ✕ "exit?" prompt → "No, keep reading"): reset the
  // canvas, then immediately run the countdown and read again from line 1.
  useEffect(() => {
    if (!restartSignal) return;
    generationRef.current += 1;
    setActiveK(-1);
    if (countdownTimerRef.current) clearTimeout(countdownTimerRef.current);
    cancel();
    exitReading(true);
    lastScrolledLineRef.current = -1;
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    runCountdown();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restartSignal]);

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

  // ── Autoscroll (map active line's first word → a visual line) ────────────────
  const onCanvasTextLayout = (visLines: TextLayoutLine[]) => {
    const cum: number[] = [];
    const ys: number[] = [];
    let acc = 0;
    for (const ln of visLines) {
      acc += wordsIn(ln.text);
      cum.push(acc);
      ys.push(ln.y);
    }
    lineOffsetsRef.current = cum;
    lineYRef.current = ys;
  };

  useEffect(() => {
    if (!isRecording || activeK < 0 || autoscrollPausedRef.current) return;
    const firstWord = lines[activeK]?.firstWordIndex ?? 0;
    const cum = lineOffsetsRef.current;
    if (cum.length === 0) return;
    let line = cum.findIndex((c) => firstWord < c);
    if (line === -1) line = cum.length - 1;
    if (line === lastScrolledLineRef.current) return;
    lastScrolledLineRef.current = line;
    const y = lineYRef.current[line] ?? 0;
    const vp = viewportHRef.current || 600;
    const target = Math.max(0, canvasTopRef.current + y - vp * 0.4);
    scrollRef.current?.scrollTo({ y: target, animated: true });
  }, [activeK, isRecording, lines]);

  // ── Animated styles ─────────────────────────────────────────────────────────
  const headerStyle = useAnimatedStyle(() => ({
    height:
      heroH.value > 0
        ? interpolate(phaseP.value, [0, 1], [heroH.value, READING_HEADER_H])
        : undefined,
  }));
  const idleGroupStyle = useAnimatedStyle(() => ({
    opacity: interpolate(phaseP.value, [0, 1], [1, 0]),
  }));
  const captionStyle = useAnimatedStyle(() => ({ opacity: phaseP.value }));
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
  // Footer controls fade away smoothly once reading starts.
  const footerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(btnP.value, [0, 1], [1, 0]),
  }));

  const speedLabel = R.pace.labels[speedIdx] ?? "1×";
  const bio = getAuthorBio(author);

  return (
    <View style={[st.container, { backgroundColor: bgColor }]}>
      {/* Scrollable stage — no left arrow; the top-right ✕ lives in level/[id]. */}
      <ScrollView
        ref={scrollRef}
        style={st.scroll}
        contentContainerStyle={[
          st.scrollContent,
          { paddingTop: topPad + 52, paddingBottom: bottomPad + 150 },
        ]}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!showCountdown}
        onScrollBeginDrag={onUserScrollStart}
        onScrollEndDrag={onUserScrollEnd}
        onMomentumScrollEnd={onUserScrollEnd}
        onLayout={(e: LayoutChangeEvent) => {
          viewportHRef.current = e.nativeEvent.layout.height;
        }}
      >
        {/* Header: big hero title (IDLE) cross-fades to a small caption (READING) */}
        <Animated.View style={[st.header, headerStyle]}>
          <Animated.View
            entering={FadeInDown.delay(120).duration(460)}
            onLayout={(e) => {
              if (heroH.value === 0) heroH.value = e.nativeEvent.layout.height;
            }}
            style={idleGroupStyle}
          >
            <Text
              style={{
                fontFamily: R.type.heroFont,
                fontSize: heroSize,
                lineHeight: heroLine,
                letterSpacing: R.type.heroTracking,
                color: ink,
              }}
            >
              {displayTitle}
            </Text>
            {kicker ? (
              <Text
                numberOfLines={1}
                style={{
                  marginTop: 18,
                  fontFamily: R.type.kickerFont,
                  fontSize: R.type.kickerSize,
                  letterSpacing: R.type.kickerTracking,
                  color: ink,
                  opacity: R.type.kickerOpacity,
                }}
              >
                {kicker.toUpperCase()}
              </Text>
            ) : null}
          </Animated.View>

          <Animated.View style={[st.captionAbs, captionStyle]} pointerEvents="none">
            <Text
              numberOfLines={1}
              style={{
                fontFamily: R.type.kickerFont,
                fontSize: 20,
                letterSpacing: 0.2,
                color: ink,
                opacity: 0.85,
              }}
            >
              {displayTitle}
            </Text>
            {author ? (
              <Text
                numberOfLines={1}
                style={{
                  marginTop: 3,
                  fontFamily: R.type.metaFont,
                  fontSize: R.type.metaSize,
                  letterSpacing: R.type.metaTracking,
                  color: ink,
                  opacity: R.type.metaOpacity,
                }}
              >
                {author.toUpperCase()}
              </Text>
            ) : null}
          </Animated.View>
        </Animated.View>

        {/* Body: dim preview → crisp reading canvas (per-line highlight) */}
        <Animated.View
          entering={FadeInDown.delay(240).duration(520)}
          onLayout={(e) => {
            canvasTopRef.current = e.nativeEvent.layout.y;
          }}
          style={[st.bodyWrap, bodyStyle]}
        >
          <ReadingText
            tokens={tokens}
            activeLine={activeLine}
            colors={wordColors}
            fontFamily={R.type.bodyFont}
            fontSize={R.type.bodySize}
            lineHeight={Math.round(R.type.bodySize * R.type.bodyLineRatio)}
            onTextLayout={onCanvasTextLayout}
          />
        </Animated.View>
      </ScrollView>

      {/* Footer: reading speed + learn more — plain text, fade out while reading */}
      <Animated.View
        style={[st.footer, { bottom: bottomPad + 22 }, footerStyle]}
        pointerEvents={busy ? "none" : "auto"}
      >
        <Pressable
          onPress={cycleSpeed}
          disabled={busy}
          hitSlop={10}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <Text style={[st.speedText, { color: inkSoft, fontFamily: R.type.metaFont }]}>
            {speedLabel}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setShowInfo(true)}
          disabled={busy}
          hitSlop={10}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <Text style={[st.learnText, { color: inkSoft, fontFamily: R.type.metaFont }]}>
            {(lang === "ru" ? "Узнать больше" : "Learn more").toUpperCase()}
          </Text>
        </Pressable>
      </Animated.View>

      {/* Start button — centered (IDLE) */}
      <Animated.View
        style={[st.centerDock, { bottom: bottomPad + 70 }, startBtnStyle]}
        pointerEvents={busy ? "none" : "auto"}
      >
        <Pressable
          onPress={startCountdown}
          disabled={phase !== "idle"}
          style={({ pressed }) => [
            st.startBtn,
            { backgroundColor: btnBg, transform: [{ scale: pressed ? 0.96 : 1 }] },
          ]}
        >
          <Ionicons name="play" size={15} color={btnInk} />
          <Text style={[st.startLabel, { fontFamily: R.type.heroFont, color: btnInk }]}>
            {lang === "ru" ? "Читать" : "Read"}
          </Text>
        </Pressable>
      </Animated.View>

      {/* Countdown overlay */}
      {showCountdown && (
        <Animated.View
          entering={FadeIn.duration(180)}
          exiting={FadeOut.duration(220)}
          style={[st.overlay, { backgroundColor: bgColor + "F2" }]}
          pointerEvents="none"
        >
          <Animated.Text
            key={`cd-${countdown}`}
            entering={FadeIn.duration(200)}
            exiting={FadeOut.duration(200)}
            style={[st.countdownNum, { color: ink, fontFamily: R.type.heroFont }]}
          >
            {countdown}
          </Animated.Text>
          <Text
            style={[st.countdownHint, { color: inkFaint, fontFamily: R.type.kickerFont }]}
          >
            {(lang === "ru" ? "Приготовься" : "Get ready").toUpperCase()}
          </Text>
        </Animated.View>
      )}

      {/* Loading curtain — mascot + line; the level renders behind it */}
      {loading && (
        <Animated.View
          exiting={FadeOut.duration(420)}
          style={[st.overlay, { backgroundColor: bgColor }]}
        >
          <OscarMascot emotion="happy" size={150} />
          <Text style={[st.loadQuote, { color: ink, fontFamily: R.type.bodyFont }]}>
            {lang === "ru"
              ? "Речь — это сцена. Выходи и говори."
              : "Speech is a stage. Step up and speak."}
          </Text>
          <Text style={[st.loadHint, { color: inkFaint, fontFamily: R.type.kickerFont }]}>
            {(lang === "ru" ? "Готовим полотно" : "Preparing the canvas").toUpperCase()}
          </Text>
        </Animated.View>
      )}

      {/* "Узнать больше" sheet — neutral text only, author name big, ✕ top-right */}
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
            <Pressable
              onPress={() => setShowInfo(false)}
              hitSlop={12}
              style={({ pressed }) => [st.infoClose, { opacity: pressed ? 0.6 : 1 }]}
            >
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </Pressable>

            {author ? (
              <Text style={[st.infoAuthor, { color: colors.text, fontFamily: R.type.kickerFont }]}>
                {author}
              </Text>
            ) : null}
            {bio?.life ? (
              <Text style={[st.infoLife, { color: colors.textMuted, fontFamily: R.type.metaFont }]}>
                {bio.life}
              </Text>
            ) : null}
            {bio?.bio ? (
              <Text style={[st.infoText, { color: colors.textSecondary, fontFamily: R.type.bodyFont }]}>
                {bio.bio}
              </Text>
            ) : null}

            <View style={[st.infoDivider, { backgroundColor: colors.border }]} />

            <Text style={[st.infoWork, { color: colors.text, fontFamily: R.type.bodyFont }]}>
              {displayTitle}
            </Text>
            {year ? (
              <Text style={[st.infoLife, { color: colors.textMuted, fontFamily: R.type.metaFont }]}>
                {year}
              </Text>
            ) : null}
            {about ? (
              <Text style={[st.infoText, { color: colors.textSecondary, fontFamily: R.type.bodyFont }]}>
                {about}
              </Text>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 30 },
  header: { justifyContent: "flex-start", overflow: "hidden" },
  captionAbs: { position: "absolute", left: 0, top: 0, right: 0 },
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
  speedText: { fontSize: 15, letterSpacing: 0.5 },
  learnText: { fontSize: R.type.metaSize + 1, letterSpacing: R.type.metaTracking },
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
    paddingHorizontal: 40,
  },
  loadQuote: {
    fontSize: 20,
    lineHeight: 29,
    textAlign: "center",
    marginTop: 26,
  },
  loadHint: { fontSize: 11, letterSpacing: 2, marginTop: 18 },
  countdownNum: { fontSize: 140, lineHeight: 150 },
  countdownHint: { fontSize: 12, marginTop: 8, letterSpacing: 2 },
  infoOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    padding: 28,
  },
  infoCard: { borderRadius: 22, padding: 24, paddingTop: 28 },
  infoClose: { position: "absolute", top: 14, right: 14, padding: 4, zIndex: 2 },
  infoAuthor: { fontSize: 28, letterSpacing: 0.2 },
  infoLife: { fontSize: 13, letterSpacing: 0.5, marginTop: 4 },
  infoText: { fontSize: 16, lineHeight: 25, marginTop: 10 },
  infoDivider: { height: StyleSheet.hairlineWidth, marginVertical: 18, opacity: 0.6 },
  infoWork: { fontSize: 19, lineHeight: 26 },
});
