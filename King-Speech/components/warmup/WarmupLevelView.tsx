import React, { useCallback, useRef, useState } from "react";
import { View, StyleSheet, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import BreathingExerciseView from "@/components/warmup/BreathingExerciseView";
import MouthExerciseView from "@/components/warmup/MouthExerciseView";
import { getNormalizedWarmup } from "@/constants/contentLoader";
import type { WarmupScoreResult } from "@/services/warmupScoring";
import { warmupFonts, warmupTheme } from "@/components/warmup/warmupTheme";
import { getPathColors } from "@/constants/pathPalette";
import { useAppColors } from "@/hooks/useAppColors";
import { useTheme } from "@/context/ThemeContext";
import { useLang, pickLang } from "@/context/LangContext";
import MannersQuiz from "@/components/manners/MannersQuiz";
import { mannersForModule } from "@/constants/mannersData";
import MannersMark from "@/components/manners/MannersMark";
import { rs } from "@/lib/responsive";

export interface WarmupCompletePayload {
  scores: number[];
  durationSec: number;
  pitchResult: WarmupScoreResult | null;
}

// Three tasks: (1) breathing warm-up, (2) mouth/articulation exercise,
// (3) «Королевские манеры» — MANNERS_PER_WARMUP etiquette situation questions
// (the etiquette mode woven into the Path). The old pitch game needed a native pitch-detection module
// (unavailable in Expo Go and flaky in general), so it was replaced by the
// breathing drill.
type Step = "breathing" | "transition" | "mouth" | "transition3" | "manners";

const MANNERS_PER_WARMUP = 4;

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
  const { lang } = useLang();
  // Localized warm-up texts (kk via getLocalizedWarmup; EN currently falls back to RU).
  const data = getNormalizedWarmup(moduleId, lang);
  // RU exercise name — key for MouthExerciseView's per-exercise copy.
  const mouthInfoKey = lang === "ru" ? undefined : getNormalizedWarmup(moduleId)?.task2_mouth.name;
  const { colors } = useAppColors();
  const { theme } = useTheme();
  // Background follows the app theme (light in light mode, dark in dark mode);
  // the module hue is used only as a small accent.
  const pal = getPathColors(moduleId, true);
  const moduleColor = pal.brick;

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
    scoresRef.current = [...scoresRef.current, 10];
    setStep("transition3");
    setTimeout(() => setStep("manners"), 450);
  }, [onTaskComplete]);

  const insets = useSafeAreaInsets();
  // Four etiquette situations per warm-up (fixed per module, all different).
  const mannersRules = React.useMemo(() => mannersForModule(moduleId, MANNERS_PER_WARMUP), [moduleId]);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {step === "breathing" && (
        <BreathingExerciseView
          topPad={topPad}
          moduleColor={moduleColor}
          onComplete={handleBreathingDone}
          onBack={() => router.back()}
        />
      )}

      {step === "transition" && (
        <View style={[styles.transition, { paddingTop: topPad, backgroundColor: colors.background }]}>
          <Text style={[styles.transitionText, { color: theme.accentInk }]}>{pickLang(lang, { ru: "Задание 2 из 3", en: "Task 2 of 3", kk: "Тапсырма 2/3" })}</Text>
        </View>
      )}

      {step === "mouth" && data && (
        <MouthExerciseView
          exercise={data.task2_mouth}
          infoKey={mouthInfoKey}
          topPad={topPad}
          onComplete={handleMouthComplete}
          onBack={() => setStep("breathing")}
        />
      )}

      {step === "transition3" && (
        <View style={[styles.transition, { paddingTop: topPad, backgroundColor: colors.background }]}>
          <Text style={[styles.transitionText, { color: theme.accentInk }]}>{pickLang(lang, { ru: "Задание 3 из 3", en: "Task 3 of 3", kk: "Тапсырма 3/3" })}</Text>
        </View>
      )}

      {step === "manners" && (
        <View style={{ flex: 1, paddingTop: topPad }}>
          <View style={styles.mannersHead}>
            <MannersMark height={rs(22)} color={theme.accentInk} />
            <Text style={[styles.mannersKicker, { color: theme.accentInk }]}>
              {pickLang(lang, { ru: "Королевские манеры", en: "Royal manners", kk: "Корольдік әдеп" })}
            </Text>
          </View>
          <MannersQuiz
            embedded
            rules={mannersRules}
            lang={lang}
            bottomPad={insets.bottom}
            finishLabel={pickLang(lang, { ru: "Завершить уровень", en: "Finish the level", kk: "Деңгейді аяқтау" })}
            onFinish={() => finishAll()}
          />
        </View>
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
  mannersHead: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 22, paddingTop: 14 },
  mannersKicker: { fontFamily: warmupFonts.title, fontSize: 15 },
  transitionText: {
    fontFamily: warmupFonts.title,
    fontSize: 24,
    letterSpacing: -0.12,
  },
});
