import React, { useEffect } from "react";
import { StyleSheet, Text, Pressable, View } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  interpolateColor,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { StepStatus } from "@/context/GameContext";
import Colors from "@/constants/colors";

interface StepBlockProps {
  stepNumber: number;
  title: string;
  status: StepStatus;
  onPress: () => void;
  colorScheme: "light" | "dark";
}

export function StepBlock({ stepNumber, title, status, onPress, colorScheme }: StepBlockProps) {
  const colors = Colors[colorScheme];
  const scale = useSharedValue(1);
  const glowOpacity = useSharedValue(status === "available" ? 1 : 0);
  const colorProgress = useSharedValue(status === "completed" ? 1 : 0);

  useEffect(() => {
    if (status === "available") {
      glowOpacity.value = withSequence(
        withTiming(0.6, { duration: 900 }),
        withTiming(1, { duration: 900 })
      );
    }
    if (status === "completed") {
      colorProgress.value = withTiming(1, { duration: 400 });
    }
  }, [status]);

  const topColor =
    status === "completed"
      ? colors.stepCompleted
      : status === "available"
      ? colors.stepAvailable
      : colors.stepLocked;

  const sideColor =
    status === "completed"
      ? colors.stepCompletedSide
      : status === "available"
      ? colors.stepAvailableSide
      : colors.stepLockedSide;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: status === "available" ? glowOpacity.value : 0,
  }));

  const handlePress = () => {
    if (status === "locked") return;
    scale.value = withSequence(withSpring(0.93), withSpring(1));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress();
  };

  const BLOCK_W = 130;
  const BLOCK_H = 52;
  const SIDE_H = 18;
  const SKEW = -14;

  return (
    <Pressable
      onPress={handlePress}
      disabled={status === "locked"}
      style={styles.pressable}
    >
      <Animated.View style={animatedStyle}>
        {/* Glow for available step */}
        <Animated.View
          style={[
            glowStyle,
            {
              position: "absolute",
              top: -8,
              left: -8,
              right: -8,
              bottom: -8,
              borderRadius: 18,
              backgroundColor: topColor,
              opacity: 0.25,
            },
          ]}
        />

        {/* 3D Block — side face (bottom) */}
        <View
          style={{
            width: BLOCK_W,
            height: SIDE_H,
            backgroundColor: sideColor,
            borderBottomLeftRadius: 10,
            borderBottomRightRadius: 10,
            transform: [{ skewX: `${SKEW}deg` }],
            position: "absolute",
            top: BLOCK_H - 6,
            left: 6,
          }}
        />

        {/* 3D Block — top/main face */}
        <View
          style={{
            width: BLOCK_W,
            height: BLOCK_H,
            backgroundColor: topColor,
            borderRadius: 14,
            justifyContent: "center",
            alignItems: "center",
            shadowColor: sideColor,
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.5,
            shadowRadius: 8,
            elevation: 6,
          }}
        >
          {status === "completed" ? (
            <Ionicons name="checkmark" size={26} color="#fff" />
          ) : status === "locked" ? (
            <Ionicons name="lock-closed" size={20} color={colorScheme === "dark" ? "#4A5568" : "#A8A5B5"} />
          ) : (
            <View style={{ alignItems: "center", gap: 2 }}>
              <Text
                style={{
                  fontFamily: "Inter_700Bold",
                  fontSize: 11,
                  color: colorScheme === "dark" ? "#1A1A2E" : "#1A1A2E",
                  opacity: 0.7,
                  letterSpacing: 0.5,
                }}
                numberOfLines={1}
              >
                {stepNumber}
              </Text>
              <Text
                style={{
                  fontFamily: "Inter_600SemiBold",
                  fontSize: 12,
                  color: "#1A1A2E",
                  textAlign: "center",
                  paddingHorizontal: 8,
                }}
                numberOfLines={1}
              >
                {title}
              </Text>
            </View>
          )}
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    alignItems: "center",
    justifyContent: "center",
  },
});
