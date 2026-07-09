import React, { useMemo } from "react";
import { View, Text, StyleSheet, Dimensions, Platform } from "react-native";
import Animated, {
  useAnimatedStyle,
  type SharedValue,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import { GlowSphere } from "@/components/ds";
import { warmupFonts, warmupTheme } from "@/components/warmup/warmupTheme";
import type { HitZone } from "@/services/warmupScoring";
import {
  BALL_R,
  BALL_X_RATIO,
  PLATFORM_BASE_Y,
  PX_PER_SEC,
  TRACK_HEIGHT,
  auraColorForZone,
  buildTrackSegments,
  passDurationSec,
  passWidthPx,
  segW,
  segX,
  toothSvgPath,
  yForOffset,
  type TrackSegment,
} from "@/components/warmup/pitchTrackGeometry";

// Re-export so existing import chains (PitchTrackSkia → PitchGameView) keep working.
export { buildTrackSegments, passDurationSec };
export type { TrackSegment };

const TRACK_W = Dimensions.get("window").width - 40;
const BALL_X = TRACK_W * BALL_X_RATIO;
const AURA_R = 26;
const TRAIL_W = 48;
const SPOT = 210;
const SPARK_ANGLES = [0, 60, 120, 180, 240, 300];
const SPARK_RADIUS = 30;

interface Props {
  segments: TrackSegment[];
  passSec: number;
  clockSec: SharedValue<number>;
  ballY01: SharedValue<number>;
  glow01: SharedValue<number>;
  burst01: SharedValue<number>;
  activeIndex: number;
  activeFill01: number;
  held: boolean;
  moduleColor: string;
  hitZone: HitZone;
}

const NoteCopy = React.memo(function NoteCopy({
  segments,
  moduleColor,
  passW,
  offsetX,
}: {
  segments: TrackSegment[];
  moduleColor: string;
  passW: number;
  offsetX: number;
}) {
  return (
    <View style={[styles.copy, { left: offsetX, width: passW }]}>
      <Svg width={passW} height={TRACK_HEIGHT}>
        {segments.map((seg) => {
          const x = segX(seg);
          const w = segW(seg);
          const apexY = yForOffset(seg.offsetNorm);
          return (
            <Path
              key={seg.index}
              d={toothSvgPath(x, w, apexY, PLATFORM_BASE_Y)}
              fill={moduleColor + "59"}
              stroke={moduleColor + "99"}
              strokeWidth={1}
            />
          );
        })}
      </Svg>
      {segments.map((seg) => {
        const x = segX(seg);
        const w = segW(seg);
        const apexY = yForOffset(seg.offsetNorm);
        return (
          <Text
            key={seg.index}
            style={[styles.noteLabel, { left: x, top: apexY - 17, width: w }]}
          >
            {seg.noteLabel}
          </Text>
        );
      })}
    </View>
  );
});

export default function PitchTrack({
  segments,
  passSec,
  clockSec,
  ballY01,
  glow01,
  burst01,
  activeIndex,
  activeFill01,
  held,
  moduleColor,
  hitZone,
}: Props) {
  const passW = useMemo(() => passWidthPx(passSec), [passSec]);
  const auraColor = auraColorForZone(hitZone);
  const active = segments[activeIndex];

  const worldStyle = useAnimatedStyle(() => {
    const scrollPx = (clockSec.value % passSec) * PX_PER_SEC;
    return { transform: [{ translateX: BALL_X - scrollPx }] };
  });

  const spotlightStyle = useAnimatedStyle(() => ({
    opacity: 0.14 + glow01.value * 0.28,
    transform: [{ scale: 0.85 + glow01.value * 0.2 }],
  }));

  const ballRigStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: yForOffset(ballY01.value) }],
  }));

  const auraStyle = useAnimatedStyle(() => ({
    opacity: 0.3 + glow01.value * 0.45 + burst01.value * 0.25,
    transform: [{ scale: 1.25 + glow01.value * 0.45 + burst01.value * 0.7 }],
  }));

  const sparkContainerStyle = useAnimatedStyle(() => ({
    opacity: burst01.value,
  }));

  return (
    <View style={styles.wrap}>
      <GlowSphere
        size={200}
        top={10}
        left={-40}
        color="rgba(148,104,251,0.30)"
      />
      <GlowSphere
        size={220}
        bottom={-30}
        right={-50}
        color="rgba(148,104,251,0.22)"
      />

      <Animated.View
        pointerEvents="none"
        style={[styles.spotlight, { left: BALL_X - SPOT / 2 }, spotlightStyle]}
      />

      {[0.28, 0.5, 0.72].map((f) => (
        <View key={f} style={[styles.line, { top: 20 + f * (TRACK_HEIGHT - 60) }]} />
      ))}

      <Animated.View style={[styles.world, worldStyle]} pointerEvents="none">
        {[-1, 0, 1].map((k) => (
          <NoteCopy
            key={k}
            segments={segments}
            moduleColor={moduleColor}
            passW={passW}
            offsetX={k * passW}
          />
        ))}

        {active && (
          <View style={[styles.copy, { left: 0, width: passW }]}>
            <Svg width={passW} height={TRACK_HEIGHT}>
              <Path
                d={toothSvgPath(
                  segX(active),
                  segW(active),
                  yForOffset(active.offsetNorm),
                  PLATFORM_BASE_Y,
                )}
                fill={moduleColor}
                stroke="#FFFFFF"
                strokeWidth={1.5}
              />
            </Svg>
            {held && (
              <View
                style={[
                  styles.fillBar,
                  {
                    left: segX(active),
                    top: PLATFORM_BASE_Y - 5,
                    width: Math.max(0, segW(active) * activeFill01),
                    backgroundColor: warmupTheme.cleanMint,
                  },
                ]}
              />
            )}
          </View>
        )}
      </Animated.View>

      <Animated.View
        style={[styles.ballRig, { left: BALL_X }, ballRigStyle]}
        pointerEvents="none"
      >
        <LinearGradient
          colors={["transparent", warmupTheme.gold + "00", warmupTheme.gold + "99"]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.trail}
        />

        <Animated.View
          style={[styles.aura, { backgroundColor: auraColor }, auraStyle]}
        />

        <Animated.View style={[styles.sparks, sparkContainerStyle]}>
          {SPARK_ANGLES.map((deg, i) => {
            const rad = (deg * Math.PI) / 180;
            return (
              <View
                key={i}
                style={[
                  styles.spark,
                  {
                    transform: [
                      { translateX: Math.cos(rad) * SPARK_RADIUS },
                      { translateY: Math.sin(rad) * SPARK_RADIUS },
                    ],
                  },
                ]}
              />
            );
          })}
        </Animated.View>

        <View style={[styles.ball, { shadowColor: auraColor }]} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: TRACK_W,
    height: TRACK_HEIGHT,
    alignSelf: "center",
    position: "relative",
    overflow: "hidden",
    borderRadius: 24,
  },
  spotlight: {
    position: "absolute",
    top: TRACK_HEIGHT / 2 - SPOT / 2,
    width: SPOT,
    height: SPOT,
    borderRadius: SPOT / 2,
    backgroundColor: warmupTheme.gold,
    ...(Platform.OS === "web" ? ({ filter: "blur(60px)" } as object) : { opacity: 0.5 }),
  },
  line: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "#ffffff12",
  },
  world: {
    ...StyleSheet.absoluteFillObject,
  },
  copy: {
    position: "absolute",
    top: 0,
    height: TRACK_HEIGHT,
  },
  noteLabel: {
    position: "absolute",
    textAlign: "center",
    fontSize: 10,
    color: "#cfc9dd",
    fontFamily: warmupFonts.body,
  },
  fillBar: {
    position: "absolute",
    height: 5,
    borderRadius: 3,
  },
  ballRig: {
    position: "absolute",
    top: 0,
    width: 0,
    height: 0,
  },
  trail: {
    position: "absolute",
    left: -TRAIL_W,
    top: -BALL_R + 2,
    width: TRAIL_W,
    height: (BALL_R - 2) * 2,
    borderRadius: BALL_R,
  },
  aura: {
    position: "absolute",
    left: -AURA_R,
    top: -AURA_R,
    width: AURA_R * 2,
    height: AURA_R * 2,
    borderRadius: AURA_R,
  },
  sparks: {
    position: "absolute",
    left: 0,
    top: 0,
    width: 0,
    height: 0,
  },
  spark: {
    position: "absolute",
    left: -2.5,
    top: -2.5,
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: warmupTheme.gold,
  },
  ball: {
    position: "absolute",
    left: -BALL_R,
    top: -BALL_R,
    width: BALL_R * 2,
    height: BALL_R * 2,
    borderRadius: BALL_R,
    backgroundColor: warmupTheme.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 12,
    elevation: 8,
  },
});
