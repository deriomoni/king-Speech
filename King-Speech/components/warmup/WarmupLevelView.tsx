import React, { useCallback, useRef, useState } from "react";
import { View, StyleSheet, Text } from "react-native";
import { router } from "expo-router";
import BreathingExerciseView from "@/components/warmup/BreathingExerciseView";
import MouthExerciseView from "@/components/warmup/MouthExerciseView";
import { getNormalizedWarmup } from "@/constants/contentLoader";
import { MODULE_COLORS } from "@/context/GameContext";
import type { WarmupScoreResult } from "@/services/warmupScoring";
import { warmupFonts, warmupTheme } from "@/components/warmup/warmupTheme";

export interface WarmupCompletePayload {
  scores: number[];
  durationSec: number;
  pitchResult: WarmupScoreResult | null;
}

// Two tasks: (1) breathing warm-up, (2) mouth/articulation exercise.
// The old pitch game needed a native pitch-detection module (unavailable in
// Expo Go and flaky in general), so it was replaced by the breathing drill.
type Step = "breathing" | "transition" | "mouth";

interface Props {
  moduleId: number;
  topPad: number;
  onTaskComplete: (taskNumber: number, score: number) => void;
  onAllComplete: (payload: WarmupCompletePayload) => void;
}

export default function WarmupLevelView({
  moduleId,
  topPad,
  onTaskComplete,
  onAllComplete,
}: Props) {
  const data = getNormalizedWarmup(moduleId);
  const moduleColor = MODULE_COLORS[moduleId]?.color ?? warmupTheme.gold;

  const [step, setStep] = useState<Step>("breathing");
  const levelStartRef = useRef(Date.now());
  const scoresRef = useRef<number[]>([]);

  const finishAll = useCallback(
    (extraScore?: number) => {
      const finalScores = extraScore != null ? [...scoresRef.current, extraScore] : scoresRef.current;
      onAllComplete({
        scores: finalScores,
        durationSec: Math.max(1, Math.floor((Date.now() - levelStartRef.current) / 1000)),
        pitchResult: null,
      });
    },
    [onAllComplete],
  );

  const handleBreathingDone = useCallback(() => {
    scoresRef.current = [10];
    onTaskComplete(1, 10);
    if (!data) {
      finishAll();
      return;
    }
    setStep("transition");
    setTimeout(() => setStep("mouth"), 450);
  }, [onTaskComplete, data, finishAll]);

  const handleMouthComplete = useCallback(() => {
    onTaskComplete(2, 10);
    finishAll(10);
  }, [onTaskComplete, finishAll]);

  return (
    <View style={styles.root}>
      {step === "breathing" && (
        <BreathingExerciseView
          topPad={topPad}
          moduleColor={moduleColor}
          onComplete={handleBreathingDone}
          onBack={() => router.back()}
        />
      )}

      {step === "transition" && (
        <View style={[styles.transition, { paddingTop: topPad }]}>
          <Text style={styles.transitionText}>Задание 2 из 2</Text>
        </View>
      )}

      {step === "mouth" && data && (
        <MouthExerciseView
          exercise={data.task2_mouth}
          topPad={topPad}
          onComplete={handleMouthComplete}
          onBack={() => setStep("breathing")}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: warmupTheme.bg },
  transition: {
    flex: 1,
    backgroundColor: warmupTheme.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  transitionText: {
    fontFamily: warmupFonts.title,
    fontSize: 24,
    color: warmupTheme.gold,
  },
});
