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
import { useTheme } from "@/context/ThemeContext";
import { useFonts, Literata_600SemiBold } from "@expo-google-fonts/literata";
import {
  ReadingGlassCard,
  readingInk,
  readingTint,
} from "@/components/reading/readingTheme";

// Figma 312:4346 reading canvas: Literata 20 on a 34pt line step. The IDLE
// cover shows the same canvas scaled to 16.56pt (37:5850).
const BODY_SIZE = 20;
const BODY_LINE = 34;
const IDLE_BODY_SCALE = 16.56 / 20;

type ReadingCategory = "prose" | "poetry" | "fable";

interface Props {
  fullText: string;
  accentColor: string;
  /** Module colour (getPathColors(module).brick) — tints the current line
   *  and the progress fill. */
  moduleColor?: string;
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
    waveform?: number[],
    /** When each line lit up, ms from the start of the capture (by line k). */
    lineTimesMs?: number[],
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

// Figma cover hero: Geologica Bold 40 (37:5850). Very long titles step down.
function heroSizeFor(title: string): number {
  return title.length > 34 ? 34 : 40;
}

const WORD_RE = /[\p{L}\p{N}]+(?:[’'\-][\p{L}\p{N}]+)*/gu;
function wordsIn(text: string): number {
  return (text.match(WORD_RE) ?? []).length;
}

export default function ReadingLevelView({
  fullText,
  accentColor,
  moduleColor,
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
  const { theme, themeMode } = useTheme();
  // Literata SemiBold is only used for the current karaoke line — load it here.
  useFonts({ Literata_600SemiBold });

  // Neutral reading page (Figma 312:4346): ink text, the MODULE colour only on
  // the current line + progress fill.
  const dark = themeMode === "dark";
  const ink = theme.text;
  const inkFaint = readingInk(dark, 0.46);
  const tint = readingTint(moduleColor || accentColor || "#FFD857", dark);
  // "Читать" — Figma 62:123: neutral pill with the stroke/shape rim.
  const btnBg = dark ? "#555455" : "#262628";
  const btnRim = dark ? "rgba(240,238,233,0.06)" : "rgba(38,38,40,0.08)";
  const btnInk = "#FFFFFF";

  const displayTitle = workTitle ?? title;
  const heroSize = heroSizeFor(displayTitle);
  const heroLine = Math.round(heroSize * 1.025);

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
  const kicker = [author, genre].filter(Boolean).join(" · ");

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
  // Reading phase = the karaoke canvas is up (recording, or wrapping up).
  const reading = isRecording || phase === "saving";

  // Canvas word colours. IDLE: one calm tone (the body itself is dimmed by its
  // container opacity, Figma 37:5850). READING (312:4346): read 60% · current =
  // module tint · upcoming 26%.
  const wordColors = useMemo(
    () =>
      reading
        ? { read: readingInk(dark, 0.6), active: tint, unread: readingInk(dark, 0.26) }
        : { read: readingInk(dark, 0.42), active: tint, unread: readingInk(dark, 0.42) },
    [reading, dark, tint],
  );

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

  const lineTimesRef = useRef<number[]>([]);
  const recStartRef = useRef<number>(0);
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
      lineTimesRef.current[k] = Date.now();
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
    lineTimesRef.current = [];
    recStartRef.current = Date.now();
    setPhase("recording");
    enterReading();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    await begin();
    // The capture really starts once begin() resolves — line times are
    // measured from here so playback can re-light the same lines.
    recStartRef.current = Date.now();
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
    const { durationSec, audioBase64, audioUri, waveform } = await finish();
    const t0 = recStartRef.current;
    const lineTimesMs = lines.map((_, k) => {
      const t = lineTimesRef.current[k];
      return t ? Math.max(0, t - t0) : -1;
    });
    onRecordingComplete(durationSec, audioBase64, audioUri, waveform, lineTimesMs);
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
      { scale: interpolate(bodyP.value, [0, 1], [IDLE_BODY_SCALE, 1]) },
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
  // Reading progress strip (Figma 312:4372/4373) — fades in with the canvas,
  // the module-tinted fill follows the current line.
  const progP = useSharedValue(0);
  useEffect(() => {
    const n = lines.length || 1;
    const target = activeK >= 0 ? Math.min(1, (activeK + 0.5) / n) : 0;
    progP.value = withTiming(target, { duration: 600, easing: BEZ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeK, lines.length]);
  const progressWrapStyle = useAnimatedStyle(() => ({ opacity: phaseP.value }));
  const progressFillStyle = useAnimatedStyle(() => ({ width: `${progP.value * 100}%` }));

  const speedLabel = R.pace.labels[speedIdx] ?? "1×";
  const bio = getAuthorBio(author);
  // Info sheet ink (Figma 37:2876): heading ink, meta #969593, body #CCCAC6.
  const infoMeta = dark ? "#969593" : "rgba(38,38,40,0.5)";
  const infoBody = dark ? "#CCCAC6" : "rgba(38,38,40,0.78)";

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
                fontFamily: "Geologica_700Bold",
                fontSize: heroSize,
                lineHeight: heroLine,
                letterSpacing: -heroSize * 0.02,
                color: ink,
              }}
            >
              {displayTitle}
            </Text>
            {kicker ? (
              <Text
                numberOfLines={1}
                style={{
                  marginTop: 11,
                  fontFamily: "Geologica_700Bold",
                  fontSize: 11,
                  letterSpacing: 0.55,
                  color: readingInk(dark, 0.55),
                }}
              >
                {kicker.toUpperCase()}
              </Text>
            ) : null}
          </Animated.View>

          <Animated.View style={[st.captionAbs, captionStyle]} pointerEvents="none">
            <Text
              numberOfLines={1}
              style={{ fontFamily: "Geologica_700Bold", fontSize: 15, color: ink }}
            >
              {displayTitle}
            </Text>
            {author ? (
              <Text
                numberOfLines={1}
                style={{
                  marginTop: 3,
                  fontFamily: "Geologica_600SemiBold",
                  fontSize: 11,
                  letterSpacing: 0.55,
                  color: readingInk(dark, 0.45),
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
            activeFontFamily="Literata_600SemiBold"
            fontSize={BODY_SIZE}
            lineHeight={BODY_LINE}
            onTextLayout={onCanvasTextLayout}
          />
        </Animated.View>
      </ScrollView>

      {/* Reading progress — module tint on a 12% track (READING only) */}
      <Animated.View
        pointerEvents="none"
        style={[st.progressTrack, { bottom: bottomPad + 47, backgroundColor: readingInk(dark, 0.12) }, progressWrapStyle]}
      >
        <Animated.View style={[st.progressFill, { backgroundColor: tint }, progressFillStyle]} />
      </Animated.View>

      {/* Footer: reading speed + learn more — stays put; quieter while reading */}
      <View
        style={[st.footer, { bottom: bottomPad + (reading ? 12 : 22) }]}
        pointerEvents={showCountdown ? "none" : "box-none"}
      >
        <Pressable
          onPress={cycleSpeed}
          disabled={showCountdown}
          hitSlop={10}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <Text
            style={[
              st.speedText,
              { color: readingInk(dark, reading ? 0.6 : 0.7), fontSize: reading ? 12 : 15 },
            ]}
          >
            {speedLabel}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setShowInfo(true)}
          disabled={busy}
          hitSlop={10}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <Text style={[st.learnText, { color: readingInk(dark, reading ? 0.6 : 0.7) }]}>
            {(lang === "ru" ? "Узнать больше" : "Learn more").toUpperCase()}
          </Text>
        </Pressable>
      </View>

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
            {
              backgroundColor: btnBg,
              borderColor: btnRim,
              transform: [{ scale: pressed ? 0.96 : 1 }],
            },
          ]}
        >
          <Ionicons name="play" size={13} color={btnInk} />
          <Text style={[st.startLabel, { color: btnInk }]}>
            {lang === "ru" ? "Читать" : "Read"}
          </Text>
        </Pressable>
      </Animated.View>

      {/* Countdown overlay */}
      {showCountdown && (
        <View
          style={[st.overlay, { backgroundColor: bgColor + "F2" }]}
          pointerEvents="none"
        >
          <Animated.View
            entering={FadeIn.duration(180)}
            exiting={FadeOut.duration(220)}
            style={st.overlayInner}
          >
            <Animated.Text
              key={`cd-${countdown}`}
              entering={FadeIn.duration(200)}
              exiting={FadeOut.duration(200)}
              style={[st.countdownNum, { color: ink }]}
            >
              {countdown}
            </Animated.Text>
            <Text style={[st.countdownHint, { color: inkFaint }]}>
              {(lang === "ru" ? "Приготовься" : "Get ready").toUpperCase()}
            </Text>
          </Animated.View>
        </View>
      )}

      {/* Loading curtain — mascot + line; the level renders behind it */}
      {loading && (
        <View style={[st.overlay, { backgroundColor: bgColor }]}>
          <Animated.View exiting={FadeOut.duration(420)} style={st.overlayInner}>
            <OscarMascot emotion="happy" size={180} />
            <Text style={[st.loadQuote, { color: ink, fontFamily: R.type.bodyFont }]}>
              {lang === "ru"
                ? "Речь — это сцена. Выходи и говори."
                : "Speech is a stage. Step up and speak."}
            </Text>
            <Text style={[st.loadHint, { color: inkFaint }]}>
              {(lang === "ru" ? "Готовим полотно" : "Preparing the canvas").toUpperCase()}
            </Text>
          </Animated.View>
        </View>
      )}

      {/* "Узнать больше" — Figma 37:2876 liquid-glass card, ✕ top-right */}
      <Modal
        visible={showInfo}
        transparent
        animationType="fade"
        onRequestClose={() => setShowInfo(false)}
      >
        <Pressable
          style={[st.infoOverlay, { backgroundColor: dark ? "rgba(14,14,16,0.6)" : "rgba(38,38,40,0.32)" }]}
          onPress={() => setShowInfo(false)}
        >
          <Pressable onPress={() => {}} style={st.infoPress}>
            <ReadingGlassCard isDark={dark} style={st.infoCard}>
              <Pressable
                onPress={() => setShowInfo(false)}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel={lang === "ru" ? "Закрыть" : "Close"}
                style={({ pressed }) => [st.infoClose, { opacity: pressed ? 0.6 : 1 }]}
              >
                <Ionicons name="close" size={22} color={readingInk(dark, 0.85)} />
              </Pressable>

              {author ? (
                <Text style={[st.infoAuthor, { color: ink }]}>{author}</Text>
              ) : null}
              {bio?.life ? (
                <Text style={[st.infoLife, { color: infoMeta }]}>{bio.life}</Text>
              ) : null}
              {bio?.bio ? (
                <Text style={[st.infoText, { color: infoBody }]}>{bio.bio}</Text>
              ) : null}

              <View style={[st.infoDivider, { backgroundColor: theme.divider }]} />

              <Text style={[st.infoWork, { color: ink }]}>{displayTitle}</Text>
              {year ? (
                <Text style={[st.infoLife, { color: infoMeta }]}>{year}</Text>
              ) : null}
              {about ? (
                <Text style={[st.infoText, { color: infoBody }]}>{about}</Text>
              ) : null}
            </ReadingGlassCard>
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
  progressTrack: {
    position: "absolute",
    left: 30,
    right: 30,
    height: 3,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: { height: 3, borderRadius: 2 },
  footer: {
    position: "absolute",
    left: 30,
    right: 30,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  speedText: { fontFamily: "Geologica_700Bold" },
  learnText: { fontFamily: "Geologica_700Bold", fontSize: 11, letterSpacing: 0.55 },
  centerDock: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  // Figma 62:123 — 154×51 pill, 2pt rim, radius 32.
  startBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 13,
    height: 51,
    minWidth: 154,
    paddingHorizontal: 36,
    borderRadius: 32,
    borderWidth: 2,
  },
  startLabel: { fontFamily: "Geologica_800ExtraBold", fontSize: 16 },
  overlay: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
  },
  // Inner holds the centered content; positioning + bg live on the plain outer
  // View (reanimated 4 layout anims override position:absolute).
  overlayInner: { alignItems: "center" },
  loadQuote: {
    fontSize: 20,
    lineHeight: 29,
    textAlign: "center",
    marginTop: 26,
  },
  loadHint: { fontFamily: "Geologica_700Bold", fontSize: 11, letterSpacing: 2, marginTop: 18 },
  countdownNum: { fontFamily: "Geologica_700Bold", fontSize: 140, lineHeight: 150 },
  countdownHint: { fontFamily: "Geologica_700Bold", fontSize: 12, marginTop: 8, letterSpacing: 2 },
  infoOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 28,
  },
  infoPress: { width: "100%", maxWidth: 346, alignItems: "center" },
  infoCard: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 26 },
  infoClose: { position: "absolute", top: 12, right: 12, padding: 4, zIndex: 2 },
  infoAuthor: { fontFamily: "Geologica_700Bold", fontSize: 28, letterSpacing: -0.28, paddingRight: 12 },
  infoLife: { fontFamily: "Geologica_700Bold", fontSize: 13, marginTop: 2 },
  infoText: { fontFamily: "Literata_400Regular", fontSize: 16, lineHeight: 25, marginTop: 10 },
  infoDivider: { height: 1, marginTop: 14, marginBottom: 18 },
  infoWork: { fontFamily: "Literata_400Regular", fontSize: 19, lineHeight: 26 },
});
