import React, { useEffect } from "react";
import { View, Pressable, StyleSheet, Platform } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSpring,
  cancelAnimation,
  Easing,
} from "react-native-reanimated";
import * as Haptics from "@/lib/haptics";
import type { RankTheme } from "./rankTheme";
import { pickLocalized } from "./rankTheme";
import { useLang } from "@/context/LangContext";
import { useIsFocused } from "expo-router";
import Svg, { Defs, Ellipse, RadialGradient, Stop } from "react-native-svg";
import Door3D, { DOOR_VB_H, DOOR_VB_W, DOORWAY_CENTER, doorPaletteForRank } from "./Door3D";
import { useAppColors } from "@/hooks/useAppColors";

interface Props {
  theme: RankTheme;
  status: "locked" | "available" | "completed";
  onPress: () => void;
  testID?: string;
  /** Open Testing: a locked door is still pressable (replays the cut-scene). */
  devPreview?: boolean;
}

const DOOR_W = 168;
const DOOR_H = (DOOR_W * DOOR_VB_H) / DOOR_VB_W;
const GLOW_W = 230;
const GLOW_H = 280;

/**
 * The rank's final step on the Path: the same panel door that opens in the
 * rank-up cut-scene. Shut while the rank is in progress, ajar with light
 * spilling out once every step is done, open after the rank is passed.
 */
export default function FinalPortal({ theme, status, onPress, testID, devPreview = false }: Props) {
  const { lang } = useLang();
  const { themeMode } = useAppColors();
  const isLocked = status === "locked" && !devPreview;
  const isDone = status === "completed";
  const glowing = status === "available";
  const press = useSharedValue(1);
  const pulse = useSharedValue(0);

  // The glow loop runs only while visible: available and the Path focused.
  const focused = useIsFocused();
  useEffect(() => {
    if (!glowing || !focused) return;
    pulse.value = withRepeat(withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => cancelAnimation(pulse);
  }, [glowing, focused]);

  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: press.value }] }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowing ? 0.35 + pulse.value * 0.35 : 0,
    transform: [{ scale: 0.92 + pulse.value * 0.12 }],
  }));

  return (
    <View style={styles.outer}>
      <Pressable
        onPress={() => {
          if (isLocked) return;
          if (Platform.OS !== "web") {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
          }
          onPress();
        }}
        onPressIn={() => {
          if (isLocked) return;
          press.value = withSpring(0.96, { damping: 18, stiffness: 320 });
        }}
        onPressOut={() => {
          press.value = withSpring(1, { damping: 18, stiffness: 320 });
        }}
        disabled={isLocked}
        accessibilityRole="button"
        accessibilityLabel={pickLocalized(theme.portalLabel, lang)}
        testID={testID ?? "final-portal"}
      >
        <Animated.View style={[pressStyle, { width: DOOR_W, height: DOOR_H }]}>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.glow,
              glowStyle,
              {
                left: DOOR_W * DOORWAY_CENTER.x - GLOW_W / 2,
                top: DOOR_H * DOORWAY_CENTER.y - GLOW_H / 2,
              },
            ]}
          >
            <Svg width={GLOW_W} height={GLOW_H}>
              <Defs>
                <RadialGradient id="fpGlow" cx="50%" cy="50%" r="50%">
                  <Stop offset="0" stopColor="#FFD45C" stopOpacity={0.9} />
                  <Stop offset="0.5" stopColor="#FFD45C" stopOpacity={0.35} />
                  <Stop offset="1" stopColor="#FFD45C" stopOpacity={0} />
                </RadialGradient>
              </Defs>
              <Ellipse cx={GLOW_W / 2} cy={GLOW_H / 2} rx={GLOW_W / 2} ry={GLOW_H / 2} fill="url(#fpGlow)" />
            </Svg>
          </Animated.View>
          <View style={{ opacity: 1 }}>
            <Door3D
              width={DOOR_W}
              open={isDone ? 0.42 : glowing ? 0.22 : 0}
              light={isDone ? 0.9 : glowing ? 0.95 : 0}
              palette={doorPaletteForRank(theme.index)}
            />
          </View>
        </Animated.View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    alignItems: "center",
    paddingTop: 22,
    paddingBottom: 8,
  },
  glow: {
    position: "absolute",
    width: GLOW_W,
    height: GLOW_H,
  },
});
