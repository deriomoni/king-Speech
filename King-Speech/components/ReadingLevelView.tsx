import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  ScrollView,
  type LayoutChangeEvent,
  type TextLayoutLine,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
  withRepeat,
  cancelAnimation,
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
import { getRankForSection } from "@/context/GameContext";
import { reading as R } from "@/theme/tokens";
import ReadingText, { tokenizeReading } from "@/components/ReadingText";
import { useReadingAlignment } from "@/hooks/useReadingAlignment";
import type { AppColors } from "@/constants/colors";

let Audio: any = null;
if (Platform.OS !== "web") {
  Audio = require("expo-av").Audio;
}

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
  /** Section/module number for the footer meta ("ЧТЕНИЕ · NN") + rank. */
  moduleNumber?: number;
}

type Phase = "idle" | "countdown" | "recording" | "saving";

const BEZ = Easing.bezier(0.22, 1, 0.36, 1);
const ROMAN = ["", "I", "II", "III", "IV", "V"];

// Adaptive hero size: long titles step down instead of being clipped.
function heroSizeFor(title: string): number {
  const n = title.length;
  if (n > 18) return R.type.heroSizeSm;
  if (n > 12) return R.type.heroSizeMd;
  return R.type.heroSizeLg;
}

// Rough luminance test so we pick the reading token theme without a new prop.
function isDarkBg(hex: string): boolean {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return true;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255,
    g = (n >> 8) & 255,
    b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.5;
}

// Count words on a laid-out line so we can map word index → line for autoscroll.
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
  moduleNumber,
}: Props) {
  const { t, lang } = useLang();

  const dark = isDarkBg(colors.background);
  const theme = dark ? R.dark : R.light;

  const displayTitle = workTitle ?? title;
  const heroSize = heroSizeFor(displayTitle);
  const heroLine = Math.round(heroSize * R.type.heroLineRatio);

  // Author · genre kicker.
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

  // Tokenize once — the karaoke canvas and word count both read from this.
  const { tokens, wordCount } = useMemo(
    () => tokenizeReading(fullText),
    [fullText],
  );

  const [phase, setPhase] = useState<Phase>("idle");
  const [countdown, setCountdown] = useState<number>(3);
  const isRecording = phase === "recording";
  const showCountdown = phase === "countdown";

  // Word index comes from the speech pipeline (or dev mock) — never invented.
  const { currentIndex } = useReadingAlignment({
    expectedText: fullText,
    active: isRecording,
    locale: lang === "ru" ? "ru-RU" : "en-US",
    resetSignal,
  });

  const progress = wordCount > 0 ? (currentIndex + 1) / wordCount : 0;

  // ── Mirror Type Transition — one shared value per layer for the stagger ─────
  const phaseP = useSharedValue(0); // hero title 1→caption
  const authorP = useSharedValue(0);
  const bodyP = useSharedValue(0); // preview 0.72 → reading 1
  const quoteP = useSharedValue(0);
  const btnP = useSharedValue(0); // start button 0 shown → 1 gone
  const stopP = useSharedValue(0); // stop control 0 hidden → 1 shown
  const heroH = useSharedValue(0); // measured hero title height

  const enterReading = () => {
    btnP.value = withTiming(1, { duration: 140, easing: BEZ });
    phaseP.value = withDelay(40, withTiming(1, { duration: 520, easing: BEZ }));
    authorP.value = withDelay(60, withTiming(1, { duration: 480, easing: BEZ }));
    bodyP.value = withDelay(110, withTiming(1, { duration: 560, easing: BEZ }));
    quoteP.value = withDelay(140, withTiming(1, { duration: 400, easing: BEZ }));
    stopP.value = withDelay(
      260,
      withSpring(1, { damping: 14, stiffness: 140 }),
    );
  };
  const exitReading = (instant = false) => {
    if (instant) {
      phaseP.value = 0;
      authorP.value = 0;
      bodyP.value = 0;
      quoteP.value = 0;
      btnP.value = 0;
      stopP.value = 0;
      return;
    }
    stopP.value = withTiming(0, { duration: 160, easing: BEZ });
    quoteP.value = withTiming(0, { duration: 300, easing: BEZ });
    bodyP.value = withTiming(0, { duration: 360, easing: BEZ });
    authorP.value = withTiming(0, { duration: 360, easing: BEZ });
    phaseP.value = withTiming(0, { duration: 380, easing: BEZ });
    btnP.value = withDelay(120, withTiming(0, { duration: 220, easing: BEZ }));
  };

  // ── Recording engine (unchanged behavior) ──────────────────────────────────
  const recordingRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioBlobRef = useRef<Blob | null>(null);
  const audioUriRef = useRef<string | null>(null);
  const stopPromiseRef = useRef<Promise<void> | null>(null);
  const stopResolveRef = useRef<(() => void) | null>(null);
  const startTsRef = useRef<number>(0);
  const countdownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const generationRef = useRef<number>(0);

  const heroGlow = useSharedValue(0);

  // Autoscroll plumbing.
  const scrollRef = useRef<ScrollView>(null);
  const lineOffsetsRef = useRef<number[]>([]); // cumulative word count per line
  const lineYRef = useRef<number[]>([]); // y of each line
  const viewportHRef = useRef<number>(0);
  const lastScrolledLineRef = useRef<number>(-1);
  const canvasTopRef = useRef<number>(0);

  useEffect(() => {
    return () => {
      generationRef.current += 1;
      if (countdownTimerRef.current) clearTimeout(countdownTimerRef.current);
      cancelAnimation(heroGlow);
      try {
        audioStreamRef.current?.getTracks().forEach((tr) => tr.stop());
      } catch {}
      if (recordingRef.current) {
        try {
          recordingRef.current.stopAndUnloadAsync?.();
        } catch {}
        recordingRef.current = null;
      }
      try {
        if (
          mediaRecorderRef.current &&
          mediaRecorderRef.current.state !== "inactive"
        ) {
          mediaRecorderRef.current.stop();
        }
      } catch {}
    };
  }, []);

  // Reset on entry / resetSignal — settle the transition back to IDLE.
  useEffect(() => {
    generationRef.current += 1;
    setPhase("idle");
    setCountdown(3);
    if (countdownTimerRef.current) clearTimeout(countdownTimerRef.current);
    exitReading(true);
    lastScrolledLineRef.current = -1;
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    cancelAnimation(heroGlow);
    heroGlow.value = 0;
    heroGlow.value = withRepeat(withTiming(1, { duration: 850 }), 4, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetSignal]);

  const beginRecording = async () => {
    setPhase("recording");
    startTsRef.current = Date.now();
    enterReading();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    if (Platform.OS === "web") {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioStreamRef.current = stream;
        const mr = new MediaRecorder(stream);
        audioChunksRef.current = [];
        audioBlobRef.current = null;
        stopPromiseRef.current = new Promise<void>((resolve) => {
          stopResolveRef.current = resolve;
        });
        mr.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
        };
        mr.onstop = () => {
          audioBlobRef.current = new Blob(audioChunksRef.current, {
            type: "audio/webm",
          });
          stopResolveRef.current?.();
          stopResolveRef.current = null;
        };
        mr.start();
        mediaRecorderRef.current = mr;
      } catch {
        // Mic blocked — keep the visual flow so the user can still practice.
      }
    } else {
      try {
        await Audio.requestPermissionsAsync();
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });
        const baseOpts = Audio.RecordingOptionsPresets.HIGH_QUALITY;
        const meteringOpts = {
          ...baseOpts,
          isMeteringEnabled: true,
          ios: { ...(baseOpts.ios ?? {}), meteringEnabled: true },
          android: { ...(baseOpts.android ?? {}) },
          web: { ...(baseOpts.web ?? {}) },
        };
        const { recording } = await Audio.Recording.createAsync(meteringOpts);
        recordingRef.current = recording;
      } catch {}
    }
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
    const durationSec = Math.max(
      1,
      Math.round((Date.now() - startTsRef.current) / 1000),
    );

    if (Platform.OS === "web") {
      try {
        if (
          mediaRecorderRef.current &&
          mediaRecorderRef.current.state !== "inactive"
        ) {
          mediaRecorderRef.current.stop();
        }
        audioStreamRef.current?.getTracks().forEach((tr) => tr.stop());
      } catch {}
    } else {
      try {
        if (recordingRef.current) {
          await recordingRef.current.stopAndUnloadAsync();
          audioUriRef.current = recordingRef.current.getURI?.() ?? null;
          recordingRef.current = null;
        }
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      } catch {}
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    if (Platform.OS === "web") {
      try {
        await Promise.race([
          stopPromiseRef.current ?? Promise.resolve(),
          new Promise<void>((resolve) => setTimeout(resolve, 1500)),
        ]);
      } catch {}
      stopPromiseRef.current = null;
    }

    let audioBase64: string | undefined;
    let playableUri: string | undefined;
    try {
      if (Platform.OS === "web") {
        const blob = audioBlobRef.current;
        if (blob) {
          try {
            playableUri = URL.createObjectURL(blob);
          } catch {}
          audioBase64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              const result = reader.result as string;
              resolve(result.split(",")[1] ?? "");
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        }
      } else {
        const uri = audioUriRef.current;
        if (uri) {
          playableUri = uri;
          const FileSystem = require("expo-file-system/legacy");
          audioBase64 = await FileSystem.readAsStringAsync(uri, {
            encoding: "base64",
          });
        }
      }
    } catch (e) {
      console.warn("ReadingLevelView: could not read audio", e);
    }
    onRecordingComplete(durationSec, audioBase64, playableUri);
  };

  // ── Autoscroll: keep the active line in the 35–50% comfort band ─────────────
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
    // First line whose cumulative word count exceeds the active word index.
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
  const quoteStyle = useAnimatedStyle(() => ({
    opacity: interpolate(quoteP.value, [0, 1], [1, 0.42]),
    transform: [{ scale: interpolate(quoteP.value, [0, 1], [1, 0.92]) }],
  }));
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
  const heroGlowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(phaseP.value, [0, 1], [0.14 + heroGlow.value * 0.16, 0]),
  }));

  const filledSegs = Math.max(
    0,
    Math.min(6, Math.round(progress * 6)),
  );
  const crownLit = progress >= 0.999;

  const rank = moduleNumber ? getRankForSection(moduleNumber) : null;
  const rankLabel = rank ? `${lang === "ru" ? "Ранг" : "Rank"} ${ROMAN[rank.index] ?? rank.index}` : null;
  const moduleLabel = `${lang === "ru" ? "Чтение" : "Reading"} · ${moduleNumber ? String(moduleNumber).padStart(2, "0") : "—"}`;

  return (
    <View style={[st.container, { backgroundColor: colors.background }]}>
      {/* Top row: swatch strip (left) + decorative quote glyph (right) */}
      <View style={[st.topRow, { paddingTop: topPad + 10 }]}>
        <Animated.View entering={FadeIn.delay(120).duration(400)} style={st.swatch}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <View
              key={i}
              style={[
                st.seg,
                { backgroundColor: i < filledSegs ? theme.seg.fill : theme.seg.empty },
              ]}
            />
          ))}
          <View
            style={[
              st.crown,
              { backgroundColor: crownLit ? theme.seg.crown : theme.seg.empty },
            ]}
          >
            <Ionicons
              name="sparkles"
              size={10}
              color={crownLit ? (dark ? "#2A2003" : "#3A2C00") : theme.word.unread}
            />
          </View>
        </Animated.View>

        <Animated.Text
          pointerEvents="none"
          entering={FadeIn.duration(500)}
          style={[st.quote, { color: theme.quote }, quoteStyle]}
        >
          {"”"}
        </Animated.Text>

        {/* Back — subtle, disabled while recording */}
        <Pressable
          onPress={onBack}
          disabled={isRecording || showCountdown}
          hitSlop={12}
          style={({ pressed }) => [
            st.backBtn,
            { opacity: pressed ? 0.6 : isRecording || showCountdown ? 0 : 0.7 },
          ]}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
      </View>

      {/* Scrollable stage */}
      <ScrollView
        ref={scrollRef}
        style={st.scroll}
        contentContainerStyle={[st.scrollContent, { paddingBottom: bottomPad + 140 }]}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!isRecording && !showCountdown}
        onLayout={(e: LayoutChangeEvent) => {
          viewportHRef.current = e.nativeEvent.layout.height;
        }}
      >
        {/* Hero title — shrinks to a caption in READING (origin left-top) */}
        <Animated.View style={[st.heroWrap, heroWrapStyle]}>
          <Animated.View
            pointerEvents="none"
            style={[st.heroGlow, { backgroundColor: accentColor }, heroGlowStyle]}
          />
          <Animated.View
            entering={FadeInDown.delay(200).duration(480)}
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

        {/* Kicker → author caption */}
        {kicker ? (
          <Animated.Text
            entering={FadeInDown.delay(260).duration(460)}
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

        {/* Body: dim preview → crisp reading canvas */}
        <Animated.View
          entering={FadeInDown.delay(320).duration(520)}
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

      {/* Footer meta */}
      <View style={[st.footer, { bottom: bottomPad + 22 }]}>
        <Text
          style={[
            st.meta,
            { fontFamily: R.type.metaFont, fontSize: R.type.metaSize, letterSpacing: R.type.metaTracking, color: colors.text, opacity: R.type.metaOpacity },
          ]}
        >
          {moduleLabel.toUpperCase()}
        </Text>
        {rankLabel ? (
          <Text
            style={[
              st.meta,
              { fontFamily: R.type.metaFont, fontSize: R.type.metaSize, letterSpacing: R.type.metaTracking, color: colors.text, opacity: R.type.metaOpacity },
            ]}
          >
            {rankLabel.toUpperCase()}
          </Text>
        ) : null}
      </View>

      {/* Start button (IDLE) — an object, not a bar */}
      <Animated.View
        style={[st.btnDock, { bottom: bottomPad + 64 }, startBtnStyle]}
        pointerEvents={isRecording || showCountdown ? "none" : "auto"}
      >
        <Pressable
          onPress={startCountdown}
          disabled={phase !== "idle"}
          style={({ pressed }) => [st.startBtn, { transform: [{ scale: pressed ? 0.96 : 1 }] }]}
        >
          <View style={[st.startGlow, { backgroundColor: accentColor }]} />
          <LinearGradient
            colors={["#FFD84D", "#FF9E2C"]}
            start={{ x: 0.1, y: 0 }}
            end={{ x: 0.9, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <Ionicons name="play" size={15} color="#2A2003" />
          <Text style={[st.startLabel, { fontFamily: R.type.heroFont }]}>
            {lang === "ru" ? "Читать" : "Read"}
          </Text>
        </Pressable>
      </Animated.View>

      {/* Stop control (READING) — a circle with a warm halo */}
      <Animated.View
        style={[st.stopDock, { bottom: bottomPad + 52 }, stopStyle]}
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
          <View style={[st.stopHalo, { borderColor: theme.seg.crown }]} />
          <View style={[st.stopSquare, { backgroundColor: theme.seg.crown }]} />
        </Pressable>
      </Animated.View>

      {/* Countdown overlay */}
      {showCountdown && (
        <Animated.View
          entering={FadeIn.duration(180)}
          exiting={FadeOut.duration(180)}
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
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1 },
  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 30,
  },
  swatch: { flexDirection: "row", alignItems: "center", gap: 3 },
  seg: { width: 24, height: 10, borderRadius: 3 },
  crown: {
    width: 16,
    height: 16,
    borderRadius: 4,
    marginLeft: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  quote: {
    position: "absolute",
    right: 26,
    top: 4,
    fontSize: R.quoteSize,
    lineHeight: R.quoteSize * 0.9,
  },
  backBtn: {
    position: "absolute",
    left: 22,
    top: 46,
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 30, paddingTop: 56 },
  heroWrap: { justifyContent: "flex-start", overflow: "hidden" },
  heroGlow: {
    position: "absolute",
    left: -10,
    right: -10,
    top: 4,
    bottom: 4,
    borderRadius: 26,
    opacity: 0.14,
  },
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
  },
  meta: {},
  btnDock: { position: "absolute", right: 30, alignItems: "flex-end" },
  startBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 30,
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
  startLabel: { fontSize: 16, letterSpacing: 0.3, color: "#2A2003" },
  stopDock: { position: "absolute", left: 0, right: 0, alignItems: "center" },
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
});
