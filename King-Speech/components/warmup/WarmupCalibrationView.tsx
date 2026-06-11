import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import OreoMascot from "@/components/OreoMascot";
import { GlassCard, PrimaryButton } from "@/components/ds";
import { usePitchDetection } from "@/hooks/usePitchDetection";
import { warmupFonts, warmupSpring, warmupTheme } from "@/components/warmup/warmupTheme";
import type { VoiceRange } from "@/services/warmupPitch";

type Step = "intro" | "low" | "high" | "done";

interface Props {
  topPad: number;
  onComplete: (range: VoiceRange) => void;
  onBack: () => void;
}

const STEP_SEC = 3;

export default function WarmupCalibrationView({ topPad, onComplete, onBack }: Props) {
  const pitch = usePitchDetection();
  const [step, setStep] = useState<Step>("intro");
  const [countdown, setCountdown] = useState(STEP_SEC);
  const [range, setRange] = useState<VoiceRange | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const orbScale = useSharedValue(1);

  const orbStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: orbScale.value },
      { translateY: (0.5 - pitch.position01) * 40 },
    ],
  }));

  useEffect(() => {
    if (pitch.voiceActive) {
      orbScale.value = withSpring(1.08, warmupSpring);
    } else {
      orbScale.value = withSpring(1, warmupSpring);
    }
  }, [pitch.voiceActive, orbScale]);

  useEffect(() => {
    if (step === "low" || step === "high") {
      if (pitch.hz) pitch.feedCalibration(pitch.hz, step);
    }
  }, [pitch.hz, pitch, step]);

  const clearTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => () => {
    clearTimer();
    pitch.stopListening();
  }, [pitch]);

  const runCapture = useCallback(
    async (which: "low" | "high") => {
      pitch.beginCalibrationStep(which);
      await pitch.startListening();
      setCountdown(STEP_SEC);
      let t = STEP_SEC;
      timerRef.current = setInterval(async () => {
        t -= 1;
        setCountdown(t);
        if (t <= 0) {
          clearTimer();
          await pitch.finishCalibrationStep(which);
          if (which === "low") {
            setStep("high");
          } else {
            const r = await pitch.completeCalibration();
            setRange(r);
            setStep("done");
            await pitch.stopListening();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
        }
      }, 1000);
    },
    [pitch],
  );

  const startLow = async () => {
    setStep("low");
    await runCapture("low");
  };

  useEffect(() => {
    if (step === "high") runCapture("high");
  }, [step, runCapture]);

  return (
    <View style={[styles.root, { paddingTop: topPad + 12 }]}>
      <LinearGradient
        colors={[warmupTheme.bg, "#141018", warmupTheme.bg]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.spotlight} pointerEvents="none" />

      <Pressable onPress={onBack} style={styles.back}>
        <Text style={styles.backText}>←</Text>
      </Pressable>

      <Animated.View entering={FadeIn.duration(400)} style={styles.body}>
        <Text style={styles.title}>Настроим под твой голос</Text>
        <Text style={styles.sub}>
          Оскар слушает и подстроит ноты под твой диапазон
        </Text>

        <OreoMascot size={140} shouldPlay={step !== "intro"} />

        {step === "intro" && (
          <Animated.View entering={FadeInDown.duration(300)}>
            <PrimaryButton label="Начать калибровку" onPress={startLow} />
          </Animated.View>
        )}

        {(step === "low" || step === "high") && (
          <GlassCard glow style={styles.card}>
            <Text style={styles.prompt}>
              {step === "low" ? "Скажи низко: Мууу" : "Скажи высоко: Миии"}
            </Text>
            <Animated.View style={[styles.orb, orbStyle]}>
              <LinearGradient
                colors={[warmupTheme.purple, warmupTheme.gold]}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
            <Text style={styles.countdown}>{countdown}</Text>
          </GlassCard>
        )}

        {step === "done" && range && (
          <Animated.View entering={FadeInDown.duration(350)} style={styles.ladderWrap}>
            <GlassCard glow>
              <Text style={styles.ladderTitle}>Твоя лестница голоса</Text>
              <View style={styles.ladder}>
                <LinearGradient
                  colors={["#4FD9A0", warmupTheme.gold]}
                  style={styles.ladderBar}
                />
                <Text style={styles.ladderLabel}>Низ · {Math.round(range.fLow)} Гц</Text>
                <Text style={styles.ladderLabel}>Верх · {Math.round(range.fHigh)} Гц</Text>
              </View>
              <PrimaryButton
                label="Готово, поехали"
                onPress={() => onComplete(range)}
              />
            </GlassCard>
          </Animated.View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: warmupTheme.bg },
  spotlight: {
    position: "absolute",
    top: "18%",
    alignSelf: "center",
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: warmupTheme.purple + "22",
  },
  back: { position: "absolute", left: 16, top: 52, zIndex: 2, padding: 8 },
  backText: { color: "#fff", fontSize: 24 },
  body: { flex: 1, alignItems: "center", paddingHorizontal: 24, paddingTop: 24 },
  title: {
    fontFamily: warmupFonts.title,
    fontSize: 28,
    color: "#F5F5F7",
    textAlign: "center",
    marginBottom: 8,
  },
  sub: {
    fontFamily: warmupFonts.body,
    fontSize: 16,
    color: "#C9C9D1",
    textAlign: "center",
    marginBottom: 20,
  },
  card: { width: "100%", alignItems: "center", marginTop: 12 },
  prompt: {
    fontFamily: warmupFonts.label,
    fontSize: 20,
    color: "#fff",
    marginBottom: 20,
    textAlign: "center",
  },
  orb: {
    width: 88,
    height: 88,
    borderRadius: 44,
    overflow: "hidden",
    marginBottom: 16,
  },
  countdown: {
    fontFamily: warmupFonts.digit,
    fontSize: 48,
    color: warmupTheme.gold,
  },
  ladderWrap: { width: "100%", marginTop: 8 },
  ladderTitle: {
    fontFamily: warmupFonts.title,
    fontSize: 22,
    color: "#fff",
    marginBottom: 16,
    textAlign: "center",
  },
  ladder: { marginBottom: 20 },
  ladderBar: {
    height: 120,
    width: 24,
    borderRadius: 12,
    alignSelf: "center",
    marginBottom: 12,
  },
  ladderLabel: {
    fontFamily: warmupFonts.body,
    color: "#C9C9D1",
    textAlign: "center",
    marginTop: 4,
  },
});
