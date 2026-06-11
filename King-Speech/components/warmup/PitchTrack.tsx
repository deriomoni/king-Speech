import React, { useMemo } from "react";
import { View, Text, StyleSheet, Dimensions } from "react-native";
import Animated, {
  useAnimatedStyle,
  type SharedValue,
} from "react-native-reanimated";
import { warmupFonts, warmupSpring, warmupTheme } from "@/components/warmup/warmupTheme";
import type { HitZone } from "@/services/warmupScoring";

export interface TrackSegment {
  index: number;
  syllable: string;
  noteLabel: string;
  offsetNorm: number;
  durationSec: number;
  startSec: number;
}

const TRACK_W = Dimensions.get("window").width - 40;
const TRACK_H = 200;

interface Props {
  segments: TrackSegment[];
  progress01: SharedValue<number>;
  ballY01: SharedValue<number>;
  activeIndex: number;
  moduleColor: string;
  hitZone: HitZone;
}

function TriangleStep({
  x,
  y,
  width,
  color,
  active,
  label,
}: {
  x: number;
  y: number;
  width: number;
  color: string;
  active: boolean;
  label: string;
}) {
  const h = 22;
  return (
    <View
      style={[
        styles.step,
        {
          left: x,
          top: y,
          width,
          borderBottomColor: active ? color : color + "88",
        },
      ]}
    >
      <View
        style={[
          styles.stepInner,
          {
            borderLeftWidth: width / 2,
            borderRightWidth: width / 2,
            borderBottomWidth: h,
            borderBottomColor: active ? color : color + "66",
          },
        ]}
      />
      <Text style={[styles.noteLabel, { color: active ? "#fff" : "#aaa" }]}>{label}</Text>
    </View>
  );
}

export function buildTrackSegments(
  syllables: string[],
  notes: string[],
  offsets: number[],
  durations: number[],
): TrackSegment[] {
  let start = 0;
  return offsets.map((offsetNorm, i) => {
    const seg: TrackSegment = {
      index: i,
      syllable: syllables[i] ?? "",
      noteLabel: notes[i] ?? "",
      offsetNorm,
      durationSec: durations[i] ?? 1,
      startSec: start,
    };
    start += seg.durationSec;
    return seg;
  });
}

export function passDurationSec(segments: TrackSegment[]): number {
  if (segments.length === 0) return 1;
  const last = segments[segments.length - 1];
  return last.startSec + last.durationSec;
}

export default function PitchTrack({
  segments,
  progress01,
  ballY01,
  activeIndex,
  moduleColor,
  hitZone,
}: Props) {
  const passSec = useMemo(() => passDurationSec(segments), [segments]);

  const auraColor =
    hitZone === "clean"
      ? warmupTheme.cleanMint
      : hitZone === "touch"
        ? warmupTheme.touchLavender
        : warmupTheme.missRed;

  const ballStyle = useAnimatedStyle(() => {
    const p = progress01.value;
    const x = p * (TRACK_W - 28);
    const y = (1 - ballY01.value) * (TRACK_H - 50) + 8;
    return {
      transform: [{ translateX: x }, { translateY: y }],
    };
  });

  const spotlightStyle = useAnimatedStyle(() => ({
    opacity: 0.25 + ballY01.value * 0.35,
  }));

  return (
    <View style={styles.wrap}>
      <Animated.View style={[styles.spotlight, spotlightStyle]} />
      {[0.25, 0.5, 0.75].map((f) => (
        <View
          key={f}
          style={[styles.line, { top: 16 + f * (TRACK_H - 32) }]}
        />
      ))}

      {segments.map((seg, i) => {
        const x = (seg.startSec / passSec) * (TRACK_W - 40);
        const w = Math.max(18, (seg.durationSec / passSec) * (TRACK_W - 20));
        const y = (1 - seg.offsetNorm) * (TRACK_H - 40);
        return (
          <TriangleStep
            key={`${seg.index}-${i}`}
            x={x}
            y={y}
            width={w}
            color={moduleColor}
            active={i === activeIndex}
            label={seg.noteLabel}
          />
        );
      })}

      <Animated.View
        style={[
          styles.ball,
          { shadowColor: auraColor, backgroundColor: warmupTheme.gold },
          ballStyle,
        ]}
      >
        <View style={[styles.ballAura, { backgroundColor: auraColor + "55" }]} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: TRACK_W,
    height: TRACK_H + 8,
    alignSelf: "center",
    position: "relative",
  },
  spotlight: {
    position: "absolute",
    alignSelf: "center",
    top: 20,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: warmupTheme.purple,
  },
  line: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "#ffffff18",
  },
  step: {
    position: "absolute",
    height: 30,
  },
  stepInner: {
    width: 0,
    height: 0,
    backgroundColor: "transparent",
    borderStyle: "solid",
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
  },
  noteLabel: {
    position: "absolute",
    top: -16,
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: 9,
    fontFamily: warmupFonts.body,
  },
  ball: {
    position: "absolute",
    width: 24,
    height: 24,
    borderRadius: 12,
    left: 0,
    top: 0,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 10,
    elevation: 8,
  },
  ballAura: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 12,
    transform: [{ scale: 1.45 }],
  },
});
