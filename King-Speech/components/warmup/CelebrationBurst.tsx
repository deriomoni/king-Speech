import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import { warmupSpring, warmupTheme } from "@/components/warmup/warmupTheme";

/**
 * Celebratory қошқар-мүйіз (ram's-horn) ornament sparkles.
 * Used only for success moments — 3 stars, calibration done, exercise finish.
 */

// Symmetric double-spiral ram's-horn glyph (stroke only) in a 48×36 viewBox.
const KOSHKAR_PATH =
  "M24 31 L24 18 " +
  "M24 18 C18 8 6 8 6 18 C6 25 14 26 14 19 C14 15 9 15 10 19 " +
  "M24 18 C30 8 42 8 42 18 C42 25 34 26 34 19 C34 15 39 15 38 19";

interface Particle {
  dx: number;
  dy: number;
  size: number;
  rot: number;
  delay: number;
  color: string;
}

const PARTICLES: Particle[] = [
  { dx: 0, dy: -70, size: 34, rot: 0, delay: 0, color: warmupTheme.gold },
  { dx: -88, dy: -34, size: 26, rot: -18, delay: 70, color: warmupTheme.cleanMint },
  { dx: 88, dy: -34, size: 26, rot: 18, delay: 70, color: warmupTheme.cleanMint },
  { dx: -120, dy: 40, size: 22, rot: -26, delay: 150, color: warmupTheme.gold },
  { dx: 120, dy: 40, size: 22, rot: 26, delay: 150, color: warmupTheme.gold },
  { dx: -54, dy: 96, size: 20, rot: -12, delay: 220, color: warmupTheme.touchLavender },
  { dx: 54, dy: 96, size: 20, rot: 12, delay: 220, color: warmupTheme.touchLavender },
];

function Ornament({ dx, dy, size, rot, delay, color }: Particle) {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);
  const drift = useSharedValue(0);

  useEffect(() => {
    scale.value = withDelay(delay, withSpring(1, warmupSpring));
    opacity.value = withDelay(
      delay,
      withSequence(
        withTiming(1, { duration: 160 }),
        withTiming(0, { duration: 950 }),
      ),
    );
    drift.value = withDelay(
      delay,
      withTiming(-24, { duration: 1100, easing: Easing.out(Easing.quad) }),
    );
  }, [delay, drift, opacity, scale]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateX: dx },
      { translateY: dy + drift.value },
      { scale: scale.value },
      { rotate: `${rot}deg` },
    ],
  }));

  return (
    <Animated.View style={[styles.particle, style]}>
      <Svg width={size} height={size * 0.75} viewBox="0 0 48 36">
        <Path
          d={KOSHKAR_PATH}
          stroke={color}
          strokeWidth={2.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </Svg>
    </Animated.View>
  );
}

interface Props {
  play: boolean;
  burstKey?: number;
}

export default function CelebrationBurst({ play, burstKey = 0 }: Props) {
  if (!play) return null;
  return (
    <View style={styles.root} pointerEvents="none">
      {PARTICLES.map((p, i) => (
        <Ornament key={`${burstKey}-${i}`} {...p} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 5,
  },
  particle: {
    position: "absolute",
  },
});
