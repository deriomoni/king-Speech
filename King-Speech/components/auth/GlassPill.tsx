// Frosted-glass pill button with a soft glow, for the sign-in screen's aurora:
// blur of whatever is behind it + a tint + a bright top sheen + a light rim,
// and a coloured halo underneath that slowly breathes (primary only).
import React, { useEffect } from "react";
import { Platform, Pressable, StyleSheet, View, type ViewStyle } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

const H = 58;
const R = 32;

export default function GlassPill({
  onPress,
  disabled,
  primary,
  glow = primary ? "#B7A4FF" : "#6E5BFF",
  style,
  children,
}: {
  onPress?: () => void;
  disabled?: boolean;
  /** brighter glass + a breathing halo */
  primary?: boolean;
  glow?: string;
  style?: ViewStyle;
  children: React.ReactNode;
}) {
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (!primary) return;
    pulse.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => cancelAnimation(pulse);
  }, [primary, pulse]);
  const halo = useAnimatedStyle(() => ({
    opacity: primary ? 0.28 + pulse.value * 0.3 : 0.18,
    transform: [{ scaleX: 1 + pulse.value * 0.02 }, { scaleY: 1 + pulse.value * 0.12 }],
  }));

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [{ transform: [{ scale: pressed ? 0.985 : 1 }], opacity: pressed ? 0.9 : 1 }, style]}
    >
      {/* glow under the glass */}
      <Animated.View pointerEvents="none" style={[styles.halo, { backgroundColor: glow }, halo]} />
      <View
        style={[
          styles.shadow,
          Platform.OS === "web"
            ? ({ boxShadow: `0 0 ${primary ? 26 : 16}px ${glow}${primary ? "88" : "55"}` } as any)
            : { shadowColor: glow, shadowOpacity: primary ? 0.6 : 0.35, shadowRadius: primary ? 16 : 10 },
        ]}
      >
        <View style={styles.clip}>
          <BlurView intensity={primary ? 40 : 30} tint={primary ? "light" : "dark"} style={StyleSheet.absoluteFill} />
          <View
            style={[StyleSheet.absoluteFill, { backgroundColor: primary ? "rgba(255,255,255,0.22)" : "rgba(10,8,30,0.30)" }]}
          />
          {/* glass sheen from the top edge */}
          <LinearGradient
            pointerEvents="none"
            colors={[primary ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.22)", "rgba(255,255,255,0)"]}
            locations={[0, 0.6]}
            style={StyleSheet.absoluteFill}
          />
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              { borderRadius: R, borderWidth: 1, borderColor: primary ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.25)" },
            ]}
          />
          <View style={styles.content}>{children}</View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  halo: { position: "absolute", left: 10, right: 10, top: 6, bottom: -2, borderRadius: R },
  shadow: { borderRadius: R, shadowOffset: { width: 0, height: 0 } },
  clip: { height: H, borderRadius: R, overflow: "hidden" },
  content: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
});
