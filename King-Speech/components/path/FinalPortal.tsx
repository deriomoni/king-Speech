import React, { useEffect } from "react";
import { View, Text, Pressable, StyleSheet, Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSpring,
  withSequence,
  cancelAnimation,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import type { RankTheme } from "./rankTheme";
import { pickLocalized } from "./rankTheme";
import { useLang } from "@/context/LangContext";

interface Props {
  theme: RankTheme;
  status: "locked" | "available" | "completed";
  onPress: () => void;
  testID?: string;
}

function PortalShape({ theme, glowing }: { theme: RankTheme; glowing: boolean }) {
  const breathe = useSharedValue(1);
  const ring = useSharedValue(0);

  useEffect(() => {
    breathe.value = withRepeat(withTiming(1.06, { duration: 2200 }), -1, true);
    ring.value = withRepeat(withTiming(1, { duration: 2400 }), -1, false);
    return () => {
      cancelAnimation(breathe);
      cancelAnimation(ring);
    };
  }, []);

  const breatheStyle = useAnimatedStyle(() => ({
    transform: [{ scale: glowing ? breathe.value : 1 }],
  }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: glowing ? 0.5 - ring.value * 0.5 : 0,
    transform: [{ scale: 1 + ring.value * 0.6 }],
  }));

  // Different shapes per rank's portal type
  switch (theme.portalShape) {
    case "door":
      return (
        <View style={portalStyles.shapeWrap}>
          {/* Hand-drawn door */}
          <Animated.View
            style={[
              ringStyle,
              {
                position: "absolute",
                width: 150,
                height: 200,
                borderRadius: 90,
                backgroundColor: theme.portalGlow,
              },
            ]}
          />
          <Animated.View style={[breatheStyle, portalStyles.doorBox, { borderColor: theme.accentDark }]}>
            <LinearGradient
              colors={theme.portalGradient}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={[StyleSheet.absoluteFill, { borderRadius: 60 }]}
            />
            <View style={[portalStyles.doorHandle, { backgroundColor: theme.accentDark }]} />
            <Ionicons
              name={theme.portalIcon}
              size={32}
              color="#fff"
              style={{ marginTop: -8 }}
            />
          </Animated.View>
        </View>
      );

    case "neon-arch":
      return (
        <View style={portalStyles.shapeWrap}>
          <Animated.View
            style={[
              ringStyle,
              {
                position: "absolute",
                width: 180,
                height: 200,
                borderRadius: 100,
                backgroundColor: theme.portalGlow,
              },
            ]}
          />
          <Animated.View style={[breatheStyle, portalStyles.neonArch]}>
            <LinearGradient
              colors={theme.portalGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[StyleSheet.absoluteFill, { borderTopLeftRadius: 80, borderTopRightRadius: 80 }]}
            />
            <View
              style={{
                position: "absolute",
                top: 8,
                left: 8,
                right: 8,
                bottom: 0,
                borderTopLeftRadius: 70,
                borderTopRightRadius: 70,
                borderWidth: 2,
                borderColor: "rgba(255,255,255,0.5)",
                borderBottomWidth: 0,
              }}
            />
            <Ionicons name={theme.portalIcon} size={36} color="#fff" />
          </Animated.View>
        </View>
      );

    case "hologram":
      return (
        <View style={portalStyles.shapeWrap}>
          <Animated.View
            style={[
              ringStyle,
              {
                position: "absolute",
                width: 170,
                height: 170,
                borderRadius: 16,
                backgroundColor: theme.portalGlow,
              },
            ]}
          />
          <Animated.View style={[breatheStyle, portalStyles.holo, { borderColor: theme.accent }]}>
            <LinearGradient
              colors={[theme.accent + "44", theme.accentDark + "22"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[StyleSheet.absoluteFill, { borderRadius: 14 }]}
            />
            {/* hologram scanlines */}
            {Array.from({ length: 8 }).map((_, i) => (
              <View
                key={i}
                style={{
                  position: "absolute",
                  left: 8,
                  right: 8,
                  top: 12 + i * 14,
                  height: 1,
                  backgroundColor: theme.accent + "60",
                }}
              />
            ))}
            <Ionicons name={theme.portalIcon} size={36} color={theme.accent} />
          </Animated.View>
        </View>
      );

    case "gold-gate":
      return (
        <View style={portalStyles.shapeWrap}>
          <Animated.View
            style={[
              ringStyle,
              {
                position: "absolute",
                width: 180,
                height: 180,
                borderRadius: 24,
                backgroundColor: theme.portalGlow,
              },
            ]}
          />
          <Animated.View style={[breatheStyle, portalStyles.goldGate, { borderColor: theme.accent }]}>
            <LinearGradient
              colors={theme.portalGradient}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={[StyleSheet.absoluteFill, { borderRadius: 18 }]}
            />
            {/* art deco bars */}
            {[0, 1, 2].map((i) => (
              <View
                key={i}
                style={{
                  position: "absolute",
                  top: 18 + i * 22,
                  left: 18,
                  right: 18,
                  height: 2,
                  backgroundColor: "rgba(0,0,0,0.18)",
                }}
              />
            ))}
            <Ionicons name={theme.portalIcon} size={36} color="#08231C" />
          </Animated.View>
        </View>
      );

    case "star-crown":
    default:
      return (
        <View style={portalStyles.shapeWrap}>
          <Animated.View
            style={[
              ringStyle,
              {
                position: "absolute",
                width: 200,
                height: 200,
                borderRadius: 100,
                backgroundColor: theme.portalGlow,
              },
            ]}
          />
          <Animated.View style={[breatheStyle, portalStyles.starCrown, { borderColor: theme.accent }]}>
            <LinearGradient
              colors={theme.portalGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[StyleSheet.absoluteFill, { borderRadius: 70 }]}
            />
            {/* radiating lines */}
            {Array.from({ length: 8 }).map((_, i) => (
              <View
                key={i}
                style={{
                  position: "absolute",
                  width: 1.5,
                  height: 70,
                  backgroundColor: theme.accent,
                  top: 0,
                  left: "50%",
                  marginLeft: -0.75,
                  transform: [
                    { rotate: `${i * 45}deg` },
                    { translateY: -50 },
                  ],
                  opacity: 0.5,
                }}
              />
            ))}
            <Ionicons name={theme.portalIcon} size={40} color="#fff" />
          </Animated.View>
        </View>
      );
  }
}

export default function FinalPortal({ theme, status, onPress, testID }: Props) {
  const { lang } = useLang();
  const isLocked = status === "locked";
  const isDone = status === "completed";
  const press = useSharedValue(1);

  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: press.value }],
  }));

  return (
    <View style={portalStyles.outer}>
      <View style={portalStyles.captionRow}>
        <View style={[portalStyles.captionLine, { backgroundColor: theme.accent + "55" }]} />
        <Text
          style={[
            portalStyles.captionText,
            { color: theme.textSecondary, fontFamily: theme.fontFamily },
          ]}
        >
          {pickLocalized(theme.portalCaption, lang)}
        </Text>
        <View style={[portalStyles.captionLine, { backgroundColor: theme.accent + "55" }]} />
      </View>

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
        style={portalStyles.pressable}
      >
        <Animated.View style={[pressStyle, { opacity: isLocked ? 0.45 : 1 }]}>
          <PortalShape theme={theme} glowing={!isLocked && !isDone} />
        </Animated.View>
      </Pressable>

      <Text
        style={[
          portalStyles.label,
          { color: theme.textPrimary, fontFamily: theme.fontFamilyTitle },
        ]}
        numberOfLines={2}
      >
        {pickLocalized(theme.portalLabel, lang)}
      </Text>

      {isLocked && (
        <View style={[portalStyles.lockedRow, { borderColor: theme.borderColor }]}>
          <Ionicons name="lock-closed" size={12} color={theme.textMuted} />
          <Text style={[portalStyles.lockedText, { color: theme.textMuted, fontFamily: theme.fontFamily }]}>
            {lang === "en" ? "Complete all steps of this rank" : "Пройди все ступени этого ранга"}
          </Text>
        </View>
      )}

      {isDone && (
        <View style={[portalStyles.doneRow, { backgroundColor: theme.accentSoft }]}>
          <Ionicons name="checkmark-circle" size={14} color={theme.accent} />
          <Text style={[portalStyles.doneText, { color: theme.accent, fontFamily: theme.fontFamilyTitle }]}>
            {lang === "en" ? "Portal opened" : "Портал открыт"}
          </Text>
        </View>
      )}
    </View>
  );
}

const portalStyles = StyleSheet.create({
  outer: {
    alignItems: "center",
    paddingVertical: 22,
    gap: 14,
  },
  captionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 24,
  },
  captionLine: {
    width: 30,
    height: 1,
  },
  captionText: {
    fontSize: 13,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  pressable: {
    alignItems: "center",
    justifyContent: "center",
  },
  shapeWrap: {
    width: 140,
    height: 160,
    alignItems: "center",
    justifyContent: "center",
  },
  doorBox: {
    width: 110,
    height: 150,
    borderTopLeftRadius: 60,
    borderTopRightRadius: 60,
    borderRadius: 16,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  doorHandle: {
    width: 8,
    height: 8,
    borderRadius: 4,
    position: "absolute",
    right: 14,
    top: 90,
  },
  neonArch: {
    width: 130,
    height: 150,
    borderTopLeftRadius: 70,
    borderTopRightRadius: 70,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    shadowColor: "#fff",
    shadowOpacity: 0.5,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
  },
  holo: {
    width: 140,
    height: 140,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  goldGate: {
    width: 140,
    height: 150,
    borderRadius: 18,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    shadowColor: "#D4A24C",
    shadowOpacity: 0.55,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
  starCrown: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    shadowColor: "#A78BFA",
    shadowOpacity: 0.55,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
  },
  label: {
    fontSize: 22,
    textAlign: "center",
    paddingHorizontal: 20,
    lineHeight: 28,
  },
  lockedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  lockedText: { fontSize: 12 },
  doneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  doneText: { fontSize: 12, fontWeight: "600" },
});
