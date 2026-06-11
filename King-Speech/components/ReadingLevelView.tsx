import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  ScrollView,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSpring,
  withSequence,
  cancelAnimation,
  FadeIn,
  FadeOut,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import MicButton from "@/components/MicButton";
import WaveformStrip from "@/components/WaveformStrip";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useLang } from "@/context/LangContext";
import { typography } from "@/theme/tokens";

let Audio: any = null;
if (Platform.OS !== "web") {
  Audio = require("expo-av").Audio;
}

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
  /**
   * Called when the reader finishes. `audioBase64` is the recorded audio
   * encoded as base64 (no data: prefix); empty when the mic was blocked.
   */
  onRecordingComplete: (durationSeconds: number, audioBase64?: string) => void;
  resetSignal: number;
  author?: string;
  workTitle?: string;
  category?: ReadingCategory;
}

type Phase = "idle" | "countdown" | "recording" | "saving";

function estimateLineDurations(lines: string[]): number[] {
  return lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed) return 0.6;
    const words = trimmed.split(/\s+/).length;
    return Math.max(2.0, Math.min(7.0, words * 0.55));
  });
}

export default function ReadingLevelView({
  fullText,
  accentColor,
  colors,
  topPad,
  bottomPad,
  title,
  subtitle,
  onBack,
  onRecordingComplete,
  resetSignal,
  author,
  workTitle,
  category = "poetry",
}: Props) {
  const { t } = useLang();

  const isPoetry = category === "poetry";

  // Poetry uses karaoke (per-line). Prose/fable render as paragraphs split
  // on blank lines — no per-line highlight, no past-line dimming.
  const lines = useMemo(
    () => fullText.split("\n").map((l) => l.trim()),
    [fullText]
  );
  const paragraphs = useMemo(
    () =>
      fullText
        .split(/\n\s*\n/)
        .map((p) => p.replace(/\s+/g, " ").trim())
        .filter((p) => p.length > 0),
    [fullText]
  );
  const durations = useMemo(() => estimateLineDurations(lines), [lines]);
  const cumulative = useMemo(() => {
    const arr: number[] = [];
    let acc = 0;
    for (const d of durations) {
      acc += d;
      arr.push(acc);
    }
    return arr;
  }, [durations]);
  const totalEstimate = cumulative[cumulative.length - 1] ?? 8;

  const [phase, setPhase] = useState<Phase>("idle");
  const [countdown, setCountdown] = useState<number>(3);
  const [elapsedMs, setElapsedMs] = useState<number>(0);
  const [activeLine, setActiveLine] = useState<number>(-1);
  // Live recording handles for the WaveformStrip visualization.
  const [activeRecording, setActiveRecording] = useState<any | null>(null);
  const [activeStream, setActiveStream] = useState<MediaStream | null>(null);

  const recordingRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  // Captured audio for the analyzer. Web collects chunks → blob; native
  // gets a file URI from expo-av.
  const audioChunksRef = useRef<Blob[]>([]);
  const audioBlobRef = useRef<Blob | null>(null);
  const audioUriRef = useRef<string | null>(null);
  // Deterministic wait for MediaRecorder.onstop on web — see VoiceRecorder.
  const stopPromiseRef = useRef<Promise<void> | null>(null);
  const stopResolveRef = useRef<(() => void) | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTsRef = useRef<number>(0);
  const countdownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const lineYRef = useRef<Record<number, number>>({});
  // Bumped on unmount or reset so any in-flight countdown / async start aborts.
  const generationRef = useRef<number>(0);

  const pulse = useSharedValue(1);
  const micPress = useSharedValue(1);

  useEffect(() => {
    return () => {
      generationRef.current += 1;
      if (tickRef.current) clearInterval(tickRef.current);
      if (countdownTimerRef.current) clearTimeout(countdownTimerRef.current);
      cancelAnimation(pulse);
      try {
        audioStreamRef.current?.getTracks().forEach((tr) => tr.stop());
      } catch {}
      // Abort any in-flight native recording so the mic doesn't stay hot
      // when the user navigates away mid-record.
      if (recordingRef.current) {
        try {
          recordingRef.current.stopAndUnloadAsync?.();
        } catch {}
        recordingRef.current = null;
      }
      try {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
          mediaRecorderRef.current.stop();
        }
      } catch {}
    };
  }, []);

  useEffect(() => {
    generationRef.current += 1;
    setPhase("idle");
    setElapsedMs(0);
    setActiveLine(-1);
    setCountdown(3);
    if (tickRef.current) clearInterval(tickRef.current);
    if (countdownTimerRef.current) clearTimeout(countdownTimerRef.current);
    cancelAnimation(pulse);
    pulse.value = 1;
  }, [resetSignal]);

  useEffect(() => {
    if (phase !== "recording" || !isPoetry) return;
    const elapsedSec = elapsedMs / 1000;
    let idx = -1;
    for (let i = 0; i < cumulative.length; i++) {
      if (elapsedSec < cumulative[i]) {
        idx = i;
        break;
      }
    }
    if (idx === -1) idx = lines.length - 1;
    if (idx !== activeLine) {
      setActiveLine(idx);
      const y = lineYRef.current[idx];
      if (typeof y === "number" && scrollRef.current) {
        scrollRef.current.scrollTo({ y: Math.max(0, y - 80), animated: true });
      }
    }
  }, [elapsedMs, phase, cumulative, lines.length, activeLine]);

  const beginRecording = async () => {
    setPhase("recording");
    startTsRef.current = Date.now();
    setElapsedMs(0);
    setActiveLine(isPoetry ? 0 : -1);
    pulse.value = withRepeat(withTiming(1.12, { duration: 700 }), -1, true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    tickRef.current = setInterval(() => {
      setElapsedMs(Date.now() - startTsRef.current);
    }, 100);

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
          audioBlobRef.current = new Blob(audioChunksRef.current, { type: "audio/webm" });
          stopResolveRef.current?.();
          stopResolveRef.current = null;
        };
        mr.start();
        mediaRecorderRef.current = mr;
        setActiveStream(stream);
      } catch {
        // Mic blocked — keep visual flow so user can still practice
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
        setActiveRecording(recording);
      } catch {}
    }
  };

  const startCountdown = () => {
    if (phase !== "idle") return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPhase("countdown");
    setCountdown(3);

    // Snapshot the current generation; if it changes mid-countdown (unmount
    // or reset), abort instead of starting the recording.
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
    cancelAnimation(pulse);
    pulse.value = withSpring(1);
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    setPhase("saving");
    const durationSec = Math.max(1, Math.round((Date.now() - startTsRef.current) / 1000));

    if (Platform.OS === "web") {
      try {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
          mediaRecorderRef.current.stop();
        }
        audioStreamRef.current?.getTracks().forEach((tr) => tr.stop());
      } catch {}
      setActiveStream(null);
    } else {
      try {
        if (recordingRef.current) {
          await recordingRef.current.stopAndUnloadAsync();
          audioUriRef.current = recordingRef.current.getURI?.() ?? null;
          recordingRef.current = null;
        }
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      } catch {}
      setActiveRecording(null);
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Wait deterministically for the web MediaRecorder.onstop to flush the
    // blob (with a 1.5s safety cap), then read the audio into base64 for
    // the analyzer. Errors are swallowed: the caller gets duration only and
    // falls back to neutral scoring.
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
    try {
      if (Platform.OS === "web") {
        const blob = audioBlobRef.current;
        if (blob) {
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
          const FileSystem = require("expo-file-system/legacy");
          audioBase64 = await FileSystem.readAsStringAsync(uri, { encoding: "base64" });
        }
      }
    } catch (e) {
      console.warn("ReadingLevelView: could not read audio", e);
    }
    onRecordingComplete(durationSec, audioBase64);
  };

  const handleMicPress = () => {
    micPress.value = withSequence(withSpring(0.9, { damping: 12 }), withSpring(1));
    if (phase === "idle") startCountdown();
    else if (phase === "recording") stopRecording();
  };

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value * micPress.value }],
  }));

  const elapsedSec = Math.floor(elapsedMs / 1000);
  const fmt = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60)
      .toString()
      .padStart(2, "0")}`;

  const isRecording = phase === "recording";
  const showCountdown = phase === "countdown";

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[s.header, { paddingTop: topPad + 8 }]}>
        <Pressable
          onPress={onBack}
          disabled={isRecording || showCountdown}
          style={({ pressed }) => [
            s.backBtn,
            { opacity: pressed ? 0.7 : isRecording || showCountdown ? 0.35 : 1 },
          ]}
          hitSlop={12}
        >
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <View style={s.headerCenter}>
          {author ? (
            <Text
              numberOfLines={1}
              style={[
                s.author,
                {
                  color: colors.textMuted,
                  fontFamily: "Nunito_400Regular",
                  fontStyle: "italic",
                },
              ]}
            >
              {author}
            </Text>
          ) : null}
          <Text
            numberOfLines={1}
            style={[
              s.workTitle,
              {
                color: colors.text,
                fontFamily: "Rubik_700Bold",
                letterSpacing: 0.3,
              },
            ]}
          >
            {workTitle ?? title}
          </Text>
        </View>
        <View style={s.headerSide} />
      </View>

      {/* Body — karaoke for poetry, paragraphs for prose/fable */}
      <ScrollView
        ref={scrollRef}
        style={s.textScroll}
        contentContainerStyle={[s.textContent, { paddingBottom: 24 }]}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!isRecording && !showCountdown}
      >
        {!isRecording && !showCountdown && (
          <Text
            style={[s.hint, { color: colors.textMuted, fontFamily: "Nunito_400Regular" }]}
          >
            {isPoetry ? t("readingHint") : t("readingPrepHint")}
          </Text>
        )}

        {isPoetry
          ? lines.map((line, i) => {
              const isEmpty = line.length === 0;
              if (isEmpty) {
                return <View key={i} style={{ height: 12 }} />;
              }
              const isActive = isRecording && i === activeLine;
              const isPast = isRecording && i < activeLine;
              const colorVal = isActive
                ? accentColor
                : isPast
                ? colors.textMuted
                : colors.text;
              return (
                <View
                  key={i}
                  onLayout={(e) => {
                    lineYRef.current[i] = e.nativeEvent.layout.y;
                  }}
                  style={s.lineWrap}
                >
                  <Text
                    style={[
                      s.line,
                      {
                        color: colorVal,
                        fontFamily: typography.reading.fontFamily,
                        fontSize: isActive ? 20 : typography.reading.fontSize,
                        lineHeight: typography.reading.lineHeight,
                        opacity: isPast ? 0.45 : 1,
                      },
                    ]}
                  >
                    {line}
                  </Text>
                </View>
              );
            })
          : paragraphs.map((para, i) => (
              <Text
                key={i}
                style={[
                  s.paragraph,
                  {
                    color: colors.text,
                    fontFamily: typography.reading.fontFamily,
                    fontSize: typography.reading.fontSize,
                    lineHeight: typography.reading.lineHeight,
                  },
                ]}
              >
                {para}
              </Text>
            ))}
      </ScrollView>

      {/* Bottom mic dock */}
      <View style={[s.dock, { paddingBottom: bottomPad + 18, borderTopColor: colors.border }]}>
        <Text
          style={[
            s.timer,
            {
              color: isRecording ? accentColor : colors.textMuted,
              fontFamily: "Nunito_700Bold",
            },
          ]}
        >
          {fmt(elapsedSec)} {isRecording ? `· ~${fmt(Math.round(totalEstimate))}` : ""}
        </Text>
        {isRecording && (
          <View style={{ width: "100%", paddingHorizontal: 16, marginBottom: 8 }}>
            <WaveformStrip
              isRecording={isRecording}
              recording={activeRecording}
              webStream={activeStream}
              color={colors.alert}
              height={48}
            />
          </View>
        )}
        <Animated.View style={pulseStyle}>
          <MicButton
            phase={isRecording ? "recording" : phase === "saving" ? "done" : "idle"}
            onPress={handleMicPress}
            disabled={phase === "countdown" || phase === "saving"}
            size={96}
            accentColor={accentColor}
            recordingColor={colors.alert}
          />
        </Animated.View>
        <Text
          style={[s.micHint, { color: colors.textMuted, fontFamily: "Nunito_400Regular" }]}
        >
          {phase === "saving"
            ? "..."
            : isRecording
            ? t("tapToStop")
            : showCountdown
            ? t("getReady")
            : t("tapToRecord")}
        </Text>
      </View>

      {/* Countdown overlay */}
      {showCountdown && (
        <Animated.View
          entering={FadeIn.duration(180)}
          exiting={FadeOut.duration(180)}
          style={[s.overlay, { backgroundColor: colors.background + "F2" }]}
          pointerEvents="none"
        >
          <Animated.Text
            key={`cd-${countdown}`}
            entering={FadeIn.duration(200)}
            exiting={FadeOut.duration(200)}
            style={[s.countdownNum, { color: accentColor, fontFamily: "Rubik_700Bold" }]}
          >
            {countdown}
          </Animated.Text>
          <Text
            style={[
              s.countdownHint,
              { color: colors.textMuted, fontFamily: "Nunito_400Regular" },
            ]}
          >
            {t("getReady")}
          </Text>
        </Animated.View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: { flex: 1, alignItems: "center", paddingHorizontal: 8 },
  headerSide: { width: 40 },
  author: { fontSize: 11, marginBottom: 2, letterSpacing: 0.4, opacity: 0.85 },
  workTitle: { fontSize: 17 },
  textScroll: { flex: 1 },
  textContent: { paddingHorizontal: 24, paddingTop: 18 },
  hint: {
    fontSize: 13,
    textAlign: "center",
    marginBottom: 18,
    lineHeight: 18,
  },
  lineWrap: { paddingVertical: 4 },
  line: { lineHeight: 30, textAlign: "center" },
  paragraph: {
    fontSize: 17,
    lineHeight: 28,
    textAlign: "left",
    marginBottom: 16,
  },
  dock: {
    alignItems: "center",
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  timer: { fontSize: 14, marginBottom: 12, letterSpacing: 0.5 },
  micHint: { fontSize: 13, marginTop: 12, letterSpacing: 0.3 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  countdownNum: {
    fontSize: 140,
    lineHeight: 150,
  },
  countdownHint: { fontSize: 16, marginTop: 8, letterSpacing: 1 },
});
