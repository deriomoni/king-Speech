import React, { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  Easing,
} from "react-native-reanimated";
import { Video, ResizeMode } from "expo-av";

interface Props {
  size?: number;
  shouldPlay?: boolean;
}

// Individual ray — thin bar rotated around the center
function Ray({ angle, delay, size }: { angle: number; delay: number; size: number }) {
  const opacity = useSharedValue(0);
  const scaleY = useSharedValue(0.6);

  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(0.7, { duration: 900, easing: Easing.out(Easing.quad) }),
          withTiming(0.15, { duration: 900, easing: Easing.in(Easing.quad) })
        ),
        -1,
        false
      )
    );
    scaleY.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 900, easing: Easing.out(Easing.quad) }),
          withTiming(0.5, { duration: 900, easing: Easing.in(Easing.quad) })
        ),
        -1,
        false
      )
    );
  }, []);

  const aStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { rotate: `${angle}deg` },
      { translateY: -(size * 0.45) },
      { scaleY: scaleY.value },
    ],
  }));

  const rayW = size * 0.042;
  const rayH = size * 0.28;

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          width: rayW,
          height: rayH,
          borderRadius: rayW / 2,
          backgroundColor: "#FFD166",
          top: "50%",
          left: "50%",
          marginTop: -rayH / 2,
          marginLeft: -rayW / 2,
        },
        aStyle,
      ]}
    />
  );
}

export default function OreoMascot({ size = 280, shouldPlay = true }: Props) {
  const spinVal = useSharedValue(0);
  const pulse = useSharedValue(1);

  useEffect(() => {
    // Slow rotation of the whole burst
    spinVal.value = withRepeat(
      withTiming(360, { duration: 12000, easing: Easing.linear }),
      -1,
      false
    );
    // Breathe pulse on the white circle
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.06, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.96, { duration: 1600, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      false
    );
  }, []);

  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spinVal.value}deg` }],
  }));

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  // 12 rays every 30°
  const RAYS = Array.from({ length: 12 }, (_, i) => i * 30);

  return (
    <View style={[s.root, { width: size, height: size }]}>
      {/* Rotating burst layer */}
      <Animated.View
        style={[s.burst, { width: size * 1.4, height: size * 1.4 }, spinStyle]}
      >
        {RAYS.map((angle, i) => (
          <Ray
            key={i}
            angle={angle}
            delay={i * 150}
            size={size * 1.4}
          />
        ))}
      </Animated.View>

      {/* White circle — natural container for the video */}
      <Animated.View
        style={[
          s.circle,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            shadowColor: "#FFFFFF",
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.6,
            shadowRadius: 24,
            elevation: 10,
          },
          pulseStyle,
        ]}
      >
        <Video
          source={require("../assets/oreo.mp4")}
          style={{ width: size * 0.9, height: size * 0.9 }}
          resizeMode={ResizeMode.CONTAIN}
          isLooping
          shouldPlay={shouldPlay}
          isMuted
        />
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    alignItems: "center",
    justifyContent: "center",
  },
  burst: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  circle: {
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
});
