import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle } from "react-native-svg";
import { GlassCard, PrimaryButton } from "@/components/ds";
import type { WarmupMouth } from "@/constants/contentLoader";
import { warmupFonts, warmupTheme } from "@/components/warmup/warmupTheme";

type Phase = "intro" | "countdown" | "running" | "done";

const COUNTDOWN_SEC = 3;
const RING = 140;
const STROKE = 8;

interface Props {
  exercise: WarmupMouth;
  topPad: number;
  onComplete: () => void;
  onBack: () => void;
}

export default function MouthExerciseView({
  exercise,
  topPad,
  onComplete,
  onBack,
}: Props) {
  const [phase, setPhase] = useState<Phase>("intro");
  const [countdown, setCountdown] = useState(COUNTDOWN_SEC);
  const [remaining, setRemaining] = useState(exercise.durationSec);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const startCountdown = () => {
    setPhase("countdown");
    setCountdown(COUNTDOWN_SEC);
    let n = COUNTDOWN_SEC;
    timerRef.current = setInterval(() => {
      n -= 1;
      setCountdown(n);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (n <= 0) {
        if (timerRef.current) clearInterval(timerRef.current);
        startTimer();
      }
    }, 1000);
  };

  const startTimer = () => {
    setPhase("running");
    setRemaining(exercise.durationSec);
    timerRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          setPhase("done");
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
  };

  const progress =
    exercise.durationSec > 0
      ? (exercise.durationSec - remaining) / exercise.durationSec
      : 1;
  const circumference = 2 * Math.PI * ((RING - STROKE) / 2);
  const dashOffset = circumference * (1 - progress);

  return (
    <View style={[styles.root, { paddingTop: topPad + 8 }]}>
      <LinearGradient
        colors={[warmupTheme.bg, "#101015", warmupTheme.bg]}
        style={StyleSheet.absoluteFill}
      />

      <Pressable onPress={onBack} style={styles.back}>
        <Text style={styles.backText}>←</Text>
      </Pressable>

      <Text style={styles.heading}>Разминка полости рта</Text>
      <Text style={styles.taskBadge}>Задание 2 из 2</Text>

      <View style={styles.noMic}>
        <Ionicons name="mic-off-outline" size={16} color="#888" />
        <Text style={styles.noMicText}>Микрофон не используется</Text>
      </View>

      <GlassCard style={styles.card}>
        <Text style={styles.name}>{exercise.name}</Text>
        <Text style={styles.instruction}>{exercise.instruction}</Text>
      </GlassCard>

      <View style={styles.gestureRow}>
        <Ionicons name="hand-left-outline" size={20} color={warmupTheme.gold} />
        <Text style={styles.gesture}>{exercise.gesture}</Text>
      </View>

      {phase === "intro" && (
        <Animated.View entering={FadeInDown.duration(300)} style={styles.center}>
          <PrimaryButton
            label={`Запустить таймер (${exercise.durationSec} сек)`}
            onPress={startCountdown}
          />
        </Animated.View>
      )}

      {phase === "countdown" && (
        <View style={styles.center}>
          <Text style={styles.countdown}>{countdown || "Старт"}</Text>
        </View>
      )}

      {(phase === "running" || phase === "done") && (
        <View style={styles.center}>
          <View style={styles.ringWrap}>
            <Svg width={RING} height={RING}>
              <Circle
                cx={RING / 2}
                cy={RING / 2}
                r={(RING - STROKE) / 2}
                stroke="#ffffff22"
                strokeWidth={STROKE}
                fill="none"
              />
              <Circle
                cx={RING / 2}
                cy={RING / 2}
                r={(RING - STROKE) / 2}
                stroke={warmupTheme.gold}
                strokeWidth={STROKE}
                fill="none"
                strokeDasharray={`${circumference}`}
                strokeDashoffset={dashOffset}
                strokeLinecap="round"
                rotation={-90}
                origin={`${RING / 2}, ${RING / 2}`}
              />
            </Svg>
            <Text style={styles.ringNum}>
              {phase === "done" ? "✓" : remaining}
            </Text>
          </View>
          {phase === "done" && (
            <Animated.View entering={FadeIn.duration(300)} style={{ marginTop: 28 }}>
              <PrimaryButton label="Далее" onPress={onComplete} />
            </Animated.View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: warmupTheme.bg, paddingHorizontal: 24 },
  back: { marginBottom: 8 },
  backText: { color: "#fff", fontSize: 24 },
  heading: {
    fontFamily: warmupFonts.title,
    fontSize: 26,
    color: "#fff",
    textAlign: "center",
    marginBottom: 4,
  },
  taskBadge: {
    fontFamily: warmupFonts.body,
    color: "#888",
    textAlign: "center",
    marginBottom: 12,
  },
  noMic: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginBottom: 16,
  },
  noMicText: {
    fontFamily: warmupFonts.body,
    color: "#888",
    fontSize: 13,
  },
  card: { marginBottom: 16 },
  name: {
    fontFamily: warmupFonts.title,
    fontSize: 22,
    color: warmupTheme.gold,
    marginBottom: 8,
  },
  instruction: {
    fontFamily: warmupFonts.body,
    fontSize: 16,
    color: "#ddd",
    lineHeight: 24,
  },
  gestureRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
    marginBottom: 24,
  },
  gesture: {
    flex: 1,
    fontFamily: warmupFonts.body,
    color: "#aaa",
    fontSize: 14,
    lineHeight: 20,
  },
  center: { alignItems: "center", marginTop: 12 },
  countdown: {
    fontFamily: warmupFonts.digit,
    fontSize: 72,
    color: warmupTheme.gold,
  },
  ringWrap: {
    width: RING,
    height: RING,
    alignItems: "center",
    justifyContent: "center",
  },
  ringNum: {
    position: "absolute",
    fontFamily: warmupFonts.digit,
    fontSize: 44,
    color: "#fff",
  },
});
