import React, { useEffect } from "react";
import {
  Pressable,
  StyleSheet,
  View,
  Platform,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSpring,
  withDelay,
  cancelAnimation,
  Easing,
  interpolate,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

export type MicPhase = "idle" | "recording" | "done";

export interface MicButtonProps {
  phase: MicPhase;
  onPress: () => void;
  size?: number;
  disabled?: boolean;
  accentColor?: string;
  recordingColor?: string;
}

const AnimatedLG = Animated.createAnimatedComponent(LinearGradient);

function lighten(hex: string, amount = 0.18): string {
  const m = hex.replace("#", "");
  if (m.length !== 6) return hex;
  const num = parseInt(m, 16);
  const r = (num >> 16) & 0xff;
  const g = (num >> 8) & 0xff;
  const b = num & 0xff;
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  const toHex = (c: number) => c.toString(16).padStart(2, "0");
  return `#${toHex(mix(r))}${toHex(mix(g))}${toHex(mix(b))}`;
}

function withAlpha(hex: string, alpha = 0.5): string {
  const m = hex.replace("#", "");
  if (m.length !== 6) return hex;
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255)
    .toString(16)
    .padStart(2, "0");
  return `#${m}${a}`;
}

function Ring({
  size,
  color,
  delay,
}: {
  size: number;
  color: string;
  delay: number;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = 0;
    progress.value = withDelay(
      delay,
      withRepeat(
        withTiming(1, { duration: 1500, easing: Easing.out(Easing.cubic) }),
        -1,
        false,
      ),
    );
    return () => cancelAnimation(progress);
  }, [delay, progress]);

  const style = useAnimatedStyle(() => {
    const scale = interpolate(progress.value, [0, 1], [1, 1.7]);
    const opacity = interpolate(progress.value, [0, 0.1, 1], [0, 0.55, 0]);
    return {
      transform: [{ scale }],
      opacity,
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.ring,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderColor: color,
        },
        style,
      ]}
    />
  );
}

export default function MicButton({
  phase,
  onPress,
  size = 96,
  disabled = false,
  accentColor = "#F5A623",
  recordingColor = "#0EA5E9",
}: MicButtonProps) {
  const press = useSharedValue(1);
  const breath = useSharedValue(1);
  const innerPulse = useSharedValue(1);
  const recordingProgress = useSharedValue(0); // 0 = idle/done, 1 = recording
  const doneProgress = useSharedValue(0); // 0 = not done, 1 = done

  const isRecording = phase === "recording";
  const isDone = phase === "done";

  useEffect(() => {
    cancelAnimation(breath);
    cancelAnimation(innerPulse);
    cancelAnimation(recordingProgress);
    cancelAnimation(doneProgress);

    doneProgress.value = withTiming(isDone ? 1 : 0, { duration: 280 });

    if (isRecording) {
      breath.value = 1;
      innerPulse.value = withRepeat(
        withTiming(1.06, { duration: 700, easing: Easing.inOut(Easing.quad) }),
        -1,
        true,
      );
      recordingProgress.value = withTiming(1, { duration: 280 });
    } else {
      innerPulse.value = withTiming(1, { duration: 200 });
      recordingProgress.value = withTiming(0, { duration: 280 });
      if (!isDone && !disabled) {
        breath.value = withRepeat(
          withTiming(1.035, {
            duration: 2400,
            easing: Easing.inOut(Easing.quad),
          }),
          -1,
          true,
        );
      } else {
        breath.value = withTiming(1, { duration: 200 });
      }
    }

    return () => {
      cancelAnimation(breath);
      cancelAnimation(innerPulse);
      cancelAnimation(recordingProgress);
      cancelAnimation(doneProgress);
    };
  }, [isRecording, isDone, disabled, breath, innerPulse, recordingProgress, doneProgress]);

  const wrapperStyle = useAnimatedStyle(() => ({
    transform: [{ scale: press.value * breath.value * innerPulse.value }],
  }));

  const idleLayerStyle = useAnimatedStyle(() => ({
    opacity: (1 - recordingProgress.value) * (1 - doneProgress.value),
  }));
  const recLayerStyle = useAnimatedStyle(() => ({
    opacity: recordingProgress.value * (1 - doneProgress.value),
  }));
  const doneLayerStyle = useAnimatedStyle(() => ({
    opacity: doneProgress.value,
  }));

  const handlePressIn = () => {
    if (disabled) return;
    press.value = withSpring(0.94, { damping: 14, stiffness: 220 });
  };
  const handlePressOut = () => {
    press.value = withSpring(1, { damping: 12, stiffness: 220 });
  };
  const handlePress = () => {
    if (disabled) return;
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress();
  };

  const iconSize = isRecording ? Math.round(size * 0.36) : Math.round(size * 0.42);
  const doneGreen = "#2DCB8E";
  const doneGreenDark = "#1DA872";

  const idleColors: readonly [string, string] = [
    lighten(accentColor, 0.06),
    accentColor,
  ];
  const recColors: readonly [string, string] = [
    lighten(recordingColor, 0.1),
    recordingColor,
  ];
  const doneColors: readonly [string, string] = [doneGreen, doneGreenDark];

  const accessibilityLabel = isRecording
    ? "Stop recording"
    : isDone
      ? "Saved"
      : "Record";

  return (
    <View
      style={[styles.container, { width: size * 1.7, height: size * 1.7 }]}
      pointerEvents="box-none"
    >
      {isRecording && (
        <>
          <Ring
            size={size}
            color={withAlpha(recordingColor, 0.5)}
            delay={0}
          />
          <Ring
            size={size}
            color={withAlpha(recordingColor, 0.5)}
            delay={500}
          />
          <Ring
            size={size}
            color={withAlpha(recordingColor, 0.5)}
            delay={1000}
          />
        </>
      )}

      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled }}
        testID="mic-button"
        hitSlop={10}
        style={{ opacity: disabled ? 0.5 : 1 }}
      >
        <Animated.View
          style={[
            styles.button,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
            },
            wrapperStyle,
          ]}
        >
          <AnimatedLG
            colors={idleColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[
              StyleSheet.absoluteFillObject,
              { borderRadius: size / 2 },
              idleLayerStyle,
            ]}
          />
          <AnimatedLG
            colors={recColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[
              StyleSheet.absoluteFillObject,
              { borderRadius: size / 2 },
              recLayerStyle,
            ]}
          />
          <AnimatedLG
            colors={doneColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[
              StyleSheet.absoluteFillObject,
              { borderRadius: size / 2 },
              doneLayerStyle,
            ]}
          />
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFillObject,
              {
                borderRadius: size / 2,
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.18)",
              },
            ]}
          />

          <Ionicons
            name={isRecording ? "stop" : isDone ? "checkmark" : "mic"}
            size={iconSize}
            color="#FFFFFF"
          />
        </Animated.View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  ring: {
    position: "absolute",
    borderWidth: 2,
  },
  button: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.18,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
      },
      android: {
        elevation: 6,
      },
      default: {},
    }),
  },
});
