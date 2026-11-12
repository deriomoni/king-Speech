import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { SvgXml } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "@/lib/haptics";
import { useTheme } from "@/context/ThemeContext";
import { warmupFonts } from "@/components/warmup/warmupTheme";
import {
  type WarmupArt,
  chestArt,
  chestArrowArt,
  tubeLeftArt,
  tubeRightArt,
  arrowLeftArt,
  arrowRightArt,
  corkArt,
  circle1Art,
  circle2Art,
  circle3Art,
  circle4Art,
} from "@/assets/figma/warmup/warmupIllustrations";

/**
 * Illustrated mouth/voice warm-up exercises (Figma 02 · Уровень 1 · Разогрев,
 * frames 269–276). Each exercise is a title + short description over a line-art
 * illustration; multi-frame exercises cycle through their frames (left/right,
 * tongue circling). They run after the module's own mouth exercise.
 */

interface ExerciseFrame {
  art: WarmupArt;
  /** Gold arrow drawn on top of the figure (chest sound). */
  overlay?: WarmupArt;
  /** Gold direction arrow under the figure. */
  arrow?: WarmupArt;
  /** Frame-specific description (overrides the exercise one). */
  desc?: string;
}

export interface IllustratedExercise {
  key: string;
  title: string;
  desc?: string;
  frames: ExerciseFrame[];
  /** Seconds each frame stays on screen before switching to the next one. */
  frameSec?: number;
  /** Total exercise duration (s). */
  totalSec: number;
}

export const ILLUSTRATED_EXERCISES: IllustratedExercise[] = [
  {
    key: "chest",
    title: "Звук должен выходить из груди",
    frames: [{ art: chestArt, overlay: chestArrowArt }],
    totalSec: 15,
  },
  {
    key: "tubeSide",
    title: "Трубочка в сторону",
    frames: [
      { art: tubeLeftArt, arrow: arrowLeftArt, desc: "Вытяни губы вперёд и уведи их влево" },
      { art: tubeRightArt, arrow: arrowRightArt, desc: "Вытяни губы вперёд и уведи их вправо" },
    ],
    frameSec: 3,
    totalSec: 24,
  },
  {
    key: "cork",
    title: "Речь с пробкой",
    desc: "Зажми пробку губами и говори чётко",
    frames: [{ art: corkArt }],
    totalSec: 20,
  },
  {
    key: "tongueCircle",
    title: "Язык по кругу",
    desc: "Губы сомкнуты. Води языком по кругу\nпо часовой стрелке",
    frames: [{ art: circle1Art }, { art: circle2Art }, { art: circle3Art }, { art: circle4Art }],
    frameSec: 1,
    totalSec: 20,
  },
];

// Figma: the chest arrow starts 46.8pt below the top of the figure frame.
const CHEST_ARROW_TOP = 46.8;

interface Props {
  exercise: IllustratedExercise;
  topPad: number;
  onDone: () => void;
  onSkip: () => void;
  onBack: () => void;
}

export default function IllustratedExerciseView({ exercise, topPad, onDone, onSkip, onBack }: Props) {
  const { theme } = useTheme();
  const [frameIdx, setFrameIdx] = useState(0);
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    setFrameIdx(0);
    Haptics.selectionAsync().catch(() => {});
    let fi: ReturnType<typeof setInterval> | null = null;
    if (exercise.frames.length > 1 && exercise.frameSec) {
      fi = setInterval(
        () => setFrameIdx((i) => (i + 1) % exercise.frames.length),
        exercise.frameSec * 1000,
      );
    }
    const to = setTimeout(() => onDoneRef.current(), exercise.totalSec * 1000);
    return () => {
      if (fi) clearInterval(fi);
      clearTimeout(to);
    };
  }, [exercise]);

  const frame = exercise.frames[frameIdx] ?? exercise.frames[0];
  const desc = frame.desc ?? exercise.desc;
  // Reserve the arrow slot for every frame of an exercise that has one, so the
  // figure never jumps when frames switch.
  const hasArrow = exercise.frames.some((f) => !!f.arrow);
  const art = frame.art;

  return (
    <View style={[styles.root, { backgroundColor: theme.bg, paddingTop: topPad + 8 }]}>
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={12} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={24} color={theme.textSecondary} />
        </Pressable>
      </View>

      <Animated.View key={exercise.key} entering={FadeIn.duration(300)} style={styles.texts}>
        <Text style={[styles.title, { color: theme.text }]}>{exercise.title}</Text>
        {!!desc && <Text style={[styles.desc, { color: theme.textSecondary }]}>{desc}</Text>}
      </Animated.View>

      <View style={styles.center} pointerEvents="none">
        <View style={{ width: art.width, height: art.height }}>
          <SvgXml xml={art.xml} width={art.width} height={art.height} color={theme.text} />
          {frame.overlay && (
            <View
              style={[
                styles.overlay,
                { top: CHEST_ARROW_TOP, left: (art.width - frame.overlay.width) / 2 },
              ]}
            >
              <SvgXml xml={frame.overlay.xml} width={frame.overlay.width} height={frame.overlay.height} />
            </View>
          )}
        </View>
      </View>

      {hasArrow && (
        <View style={styles.arrowSlot} pointerEvents="none">
          {frame.arrow && (
            <Animated.View key={`arrow-${frameIdx}`} entering={FadeIn.duration(200)} exiting={FadeOut.duration(120)}>
              <SvgXml xml={frame.arrow.xml} width={frame.arrow.width} height={frame.arrow.height} />
            </Animated.View>
          )}
        </View>
      )}

      <View style={styles.footer}>
        <Pressable onPress={onSkip} hitSlop={8} style={styles.skip}>
          <Text style={[styles.skipText, { color: theme.textMuted }]}>Пропустить →</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 24 },
  header: { flexDirection: "row", alignItems: "center" },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  texts: { alignItems: "center", marginTop: 4 },
  title: {
    fontFamily: warmupFonts.title,
    fontSize: 26,
    lineHeight: 31,
    letterSpacing: -0.26,
    textAlign: "center",
    maxWidth: 320,
  },
  desc: {
    fontFamily: warmupFonts.body,
    fontSize: 14.5,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 6,
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  overlay: { position: "absolute" },
  arrowSlot: { height: 22, alignItems: "center", justifyContent: "center", marginBottom: 50 },
  footer: { paddingBottom: 24, alignItems: "center" },
  skip: { padding: 10 },
  skipText: { fontFamily: warmupFonts.body, fontSize: 14 },
});
