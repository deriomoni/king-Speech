import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, StyleSheet, Text } from "react-native";
import { router } from "expo-router";
import WarmupCalibrationView from "@/components/warmup/WarmupCalibrationView";
import PitchGameView from "@/components/warmup/PitchGameView";
import WarmupTask1Results from "@/components/warmup/WarmupTask1Results";
import MouthExerciseView from "@/components/warmup/MouthExerciseView";
import { getNormalizedWarmup } from "@/constants/contentLoader";
import { MODULE_COLORS } from "@/context/GameContext";
import type { WarmupScoreResult } from "@/services/warmupScoring";
import type { VoiceRange } from "@/services/warmupPitch";
import { warmupFonts, warmupTheme } from "@/components/warmup/warmupTheme";
import { usePitchDetection } from "@/hooks/usePitchDetection";

export interface WarmupCompletePayload {
  scores: number[];
  durationSec: number;
  pitchResult: WarmupScoreResult | null;
}

type Step =
  | "calibration"
  | "pitch"
  | "pitchResults"
  | "mouth"
  | "transition";

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
  const pitch = usePitchDetection();
  const moduleColor = MODULE_COLORS[moduleId]?.color ?? warmupTheme.gold;

  const [step, setStep] = useState<Step>("calibration");

  useEffect(() => {
    if (pitch.calibrated) setStep("pitch");
  }, [pitch.calibrated]);
  const [pitchResult, setPitchResult] = useState<WarmupScoreResult | null>(null);
  const levelStartRef = useRef(Date.now());
  const scoresRef = useRef<number[]>([]);

  const handleCalibrationDone = useCallback((_range: VoiceRange) => {
    setStep("pitch");
  }, []);

  const handlePitchComplete = useCallback(
    (result: WarmupScoreResult) => {
      const score = result.stars * 3;
      scoresRef.current = [score];
      setPitchResult(result);
      onTaskComplete(1, score);
      setStep("pitchResults");
    },
    [onTaskComplete],
  );

  const handlePitchResultsNext = useCallback(() => {
    setStep("transition");
    setTimeout(() => setStep("mouth"), 450);
  }, []);

  const handleMouthComplete = useCallback(() => {
    const mouthScore = 10;
    const finalScores = [...scoresRef.current, mouthScore];
    onTaskComplete(2, mouthScore);
    onAllComplete({
      scores: finalScores,
      durationSec: Math.max(1, Math.floor((Date.now() - levelStartRef.current) / 1000)),
      pitchResult,
    });
  }, [onAllComplete, onTaskComplete, pitchResult]);

  if (!data) {
    return <View style={[styles.fallback, { backgroundColor: warmupTheme.bg }]} />;
  }

  return (
    <View style={styles.root}>
      {step === "calibration" && (
        <WarmupCalibrationView
          topPad={topPad}
          onComplete={handleCalibrationDone}
          onBack={() => router.back()}
        />
      )}

      {step === "pitch" && (
        <PitchGameView
          data={data}
          moduleColor={moduleColor}
          topPad={topPad}
          onComplete={handlePitchComplete}
          onBack={() => router.back()}
        />
      )}

      {step === "pitchResults" && pitchResult && (
        <WarmupTask1Results result={pitchResult} onNext={handlePitchResultsNext} />
      )}

      {step === "transition" && (
        <View style={[styles.transition, { paddingTop: topPad }]}>
          <Text style={styles.transitionText}>Задание 2 из 2</Text>
        </View>
      )}

      {step === "mouth" && (
        <MouthExerciseView
          exercise={data.task2_mouth}
          topPad={topPad}
          onComplete={handleMouthComplete}
          onBack={() => setStep("pitchResults")}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: warmupTheme.bg },
  fallback: { flex: 1 },
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
