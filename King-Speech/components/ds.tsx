/**
 * Sonic Minimalism — shared design system primitives.
 *
 * Every screen in King Speech (except Show Time, which is intentionally left
 * untouched per the brief) should compose from these primitives. They wrap
 * the right blur/glow/typography choices so individual screens stay short.
 */
import React from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  ViewStyle,
  TextStyle,
  StyleProp,
  GestureResponderEvent,
} from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSpring,
  Easing,
  cancelAnimation,
} from "react-native-reanimated";
import { sonic } from "@/constants/colors";

/* ------------------------------------------------------------------ */
/*  GlassCard — a frosted surface with primary glow option.            */
/* ------------------------------------------------------------------ */
export function GlassCard({
  children,
  style,
  intensity = 24,
  glow = false,
  padding = 24,
  radius = 28,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  intensity?: number;
  glow?: boolean;
  padding?: number;
  radius?: number;
}) {
  return (
    <View
      style={[
        gc.wrap,
        {
          borderRadius: radius,
          padding,
          backgroundColor: sonic.glassFill,
          borderColor: sonic.glassBorder,
        },
        style,
      ]}
    >
      {Platform.OS !== "web" ? (
        <BlurView
          intensity={intensity}
          tint="dark"
          style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
        />
      ) : null}

      {glow ? (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { borderRadius: radius, overflow: "hidden" },
          ]}
        >
          <LinearGradient
            colors={["rgba(148,104,251,0.18)", "transparent"]}
            start={{ x: 1, y: 0 }}
            end={{ x: 0.2, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </View>
      ) : null}

      <View style={{ zIndex: 2 }}>{children}</View>
    </View>
  );
}

const gc = StyleSheet.create({
  wrap: {
    overflow: "hidden",
    borderWidth: 1,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
});

/* ------------------------------------------------------------------ */
/*  GlowSphere — soft purple radial decoration for empty backgrounds.  */
/*  Use ≤2 per screen, otherwise the screen turns to noise.            */
/* ------------------------------------------------------------------ */
export function GlowSphere({
  size = 320,
  top,
  bottom,
  left,
  right,
  color = "rgba(148,104,251,0.45)",
  pulse = true,
}: {
  size?: number;
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
  color?: string;
  pulse?: boolean;
}) {
  const opacity = useSharedValue(pulse ? 0.6 : 1);
  React.useEffect(() => {
    if (!pulse) return;
    opacity.value = withRepeat(
      withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
    return () => cancelAnimation(opacity);
  }, [pulse]);
  const aStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: "absolute",
          width: size,
          height: size,
          borderRadius: size / 2,
          top,
          bottom,
          left,
          right,
        },
        aStyle,
      ]}
    >
      <View
        style={{
          flex: 1,
          borderRadius: size / 2,
          backgroundColor: color,
          // Web supports filter blur, native gets a softer fade via opacity.
          ...(Platform.OS === "web"
            ? ({ filter: "blur(80px)" } as any)
            : { opacity: 0.55 }),
        }}
      />
    </Animated.View>
  );
}

/* ------------------------------------------------------------------ */
/*  OrbitalRings — concentric purple rings for hero / onboarding.      */
/* ------------------------------------------------------------------ */
export function OrbitalRings({
  size = 260,
  style,
}: {
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const rot = useSharedValue(0);
  React.useEffect(() => {
    rot.value = withRepeat(
      withTiming(360, { duration: 22000, easing: Easing.linear }),
      -1,
      false,
    );
    return () => cancelAnimation(rot);
  }, []);
  const aStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rot.value}deg` }],
  }));

  const rings = [1, 0.78, 0.56, 0.34];
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        { width: size, height: size, alignItems: "center", justifyContent: "center" },
        aStyle,
        style,
      ]}
    >
      {rings.map((scale, i) => {
        const r = (size * scale) / 2;
        return (
          <View
            key={i}
            style={{
              position: "absolute",
              width: r * 2,
              height: r * 2,
              borderRadius: r,
              borderWidth: 1,
              borderColor: `rgba(148,104,251,${0.55 - i * 0.1})`,
              transform: [{ scaleY: 0.32 }],
              shadowColor: sonic.cta,
              shadowOpacity: 0.6,
              shadowRadius: 14,
              shadowOffset: { width: 0, height: 0 },
              elevation: 8,
            }}
          />
        );
      })}
    </Animated.View>
  );
}

/* ------------------------------------------------------------------ */
/*  PrimaryButton — purple gradient pill with press feedback.          */
/* ------------------------------------------------------------------ */
export function PrimaryButton({
  label,
  onPress,
  icon,
  disabled,
  style,
  testID,
  variant = "primary",
}: {
  label: string;
  onPress: (e: GestureResponderEvent) => void;
  icon?: React.ReactNode;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  variant?: "primary" | "ghost";
}) {
  const scale = useSharedValue(1);
  const aStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={[aStyle, style]}>
      <Pressable
        onPress={onPress}
        onPressIn={() => (scale.value = withSpring(0.97, { damping: 18, stiffness: 280 }))}
        onPressOut={() => (scale.value = withSpring(1, { damping: 18, stiffness: 280 }))}
        disabled={disabled}
        testID={testID}
        style={[
          pb.btn,
          variant === "ghost" && pb.btnGhost,
          disabled && { opacity: 0.45 },
        ]}
      >
        {variant === "primary" ? (
          <LinearGradient
            colors={[sonic.cta, "#E6B82E"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[StyleSheet.absoluteFill, { borderRadius: 28 }]}
          />
        ) : null}
        <View style={pb.row}>
          {icon}
          <Text style={pb.label}>{label}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const pb = StyleSheet.create({
  btn: {
    height: 56,
    borderRadius: 28,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    shadowColor: sonic.cta,
    shadowOpacity: 0.35,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  btnGhost: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: sonic.glassBorder,
    shadowOpacity: 0,
    elevation: 0,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  label: {
    color: sonic.onCta,
    fontSize: 17,
    fontFamily: "Nunito_800ExtraBold",
    letterSpacing: -0.1,
  },
});

/* ------------------------------------------------------------------ */
/*  EditorialTitle — display heading with optional italic accent word. */
/*  Use exactly one per screen.                                        */
/* ------------------------------------------------------------------ */
export function EditorialTitle({
  prefix,
  italic,
  suffix,
  size = 56,
  align = "left",
  color = "#FFFFFF",
  style,
}: {
  prefix?: string;
  italic?: string;
  suffix?: string;
  size?: number;
  align?: TextStyle["textAlign"];
  color?: string;
  style?: StyleProp<TextStyle>;
}) {
  return (
    <Text
      style={[
        {
          color,
          fontSize: size,
          lineHeight: Math.round(size * 1.05),
          letterSpacing: -size * 0.02,
          fontFamily: "Rubik_700Bold",
          textAlign: align,
        },
        style,
      ]}
    >
      {prefix ? prefix : null}
      {prefix && italic ? " " : null}
      {italic ? (
        <Text
          style={{
            fontFamily: "Rubik_500Medium",
            color,
          }}
        >
          {italic}
        </Text>
      ) : null}
      {suffix && (italic || prefix) ? " " : null}
      {suffix ? suffix : null}
    </Text>
  );
}

/* ------------------------------------------------------------------ */
/*  MicroLabel — uppercase tracker text.                                */
/* ------------------------------------------------------------------ */
export function MicroLabel({
  children,
  color = sonic.textOnDarkSecondary,
  style,
}: {
  children: React.ReactNode;
  color?: string;
  style?: StyleProp<TextStyle>;
}) {
  return (
    <Text
      style={[
        {
          color,
          fontSize: 11,
          letterSpacing: 1.4,
          textTransform: "uppercase",
          fontFamily: "Nunito_400Regular",
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
