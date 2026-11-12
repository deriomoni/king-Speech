import React, { useEffect } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SvgXml } from "react-native-svg";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import type { Theme } from "@/context/ThemeContext";

/** Figma "stroke/shape" — the 2px hairline around cards. */
export function shapeStroke(themeMode: "light" | "dark") {
  return themeMode === "dark" ? "rgba(240,238,233,0.06)" : "rgba(38,38,40,0.08)";
}

/** Renders a Figma-exported SVG string, swapping __FG__/__BG__ for theme colors. */
export function ThemedSvg({
  xml,
  width,
  height,
  fg,
  bg = "transparent",
}: {
  xml: string;
  width: number;
  height: number;
  fg: string;
  bg?: string;
}) {
  const themed = xml.replace(/__FG__/g, fg).replace(/__BG__/g, bg);
  return <SvgXml xml={themed} width={width} height={height} />;
}

export function tapHaptic() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

/**
 * Figma "Switch (on|off)": 51×31 pill. On = monochrome accent/ink fill with an
 * ink/on-accent thumb; off = switchTrackOff fill + 2px stroke/shape ring, #F0EEE9 thumb.
 */
export function GoldSwitch({
  value,
  onValueChange,
  theme,
  themeMode,
}: {
  value: boolean;
  onValueChange: (v: boolean) => void;
  theme: Theme;
  themeMode: "light" | "dark";
}) {
  const x = useSharedValue(value ? 22 : 2);
  useEffect(() => {
    x.value = withTiming(value ? 22 : 2, { duration: 180 });
  }, [value]);
  const thumbStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      hitSlop={8}
      onPress={() => {
        tapHaptic();
        onValueChange(!value);
      }}
      style={[styles.switch, { backgroundColor: value ? theme.switchOn : theme.switchTrackOff }]}
    >
      {!value && (
        <View
          pointerEvents="none"
          style={[styles.switchRing, { borderWidth: 2, borderColor: shapeStroke(themeMode) }]}
        />
      )}
      <Animated.View
        style={[styles.thumb, { backgroundColor: value ? theme.switchThumbOn : "#F0EEE9" }, thumbStyle]}
      />
    </Pressable>
  );
}

export function SectionLabel({ theme, children }: { theme: Theme; children: string }) {
  return <Text style={[styles.sectionLabel, { color: theme.text }]}>{children}</Text>;
}

/** Bordered card used by every grouped block on the screen. */
export function Card({
  theme,
  themeMode,
  style,
  children,
}: {
  theme: Theme;
  themeMode: "light" | "dark";
  style?: object;
  children: React.ReactNode;
}) {
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.card, borderColor: shapeStroke(themeMode) },
        style,
      ]}
    >
      {/* Rows (pressed fill) are clipped to the INNER radius (20 − 1), so
          their square corners never run under the translucent hairline. */}
      <View style={styles.cardInner}>{children}</View>
    </View>
  );
}

/** 56pt list row: icon · label · (value) · chevron | switch. */
export function ListRow({
  theme,
  icon,
  label,
  value,
  onPress,
  right,
  divider,
  labelColor,
}: {
  theme: Theme;
  icon: React.ReactNode;
  label: string;
  value?: string;
  onPress?: () => void;
  right?: React.ReactNode;
  divider?: boolean;
  labelColor?: string;
}) {
  return (
    <Pressable
      disabled={!onPress}
      onPress={() => {
        tapHaptic();
        onPress?.();
      }}
      style={({ pressed }) => [
        styles.row,
        pressed && onPress ? { backgroundColor: theme.rowPressed } : null,
      ]}
    >
      <View style={styles.rowIcon}>{icon}</View>
      <Text style={[styles.rowLabel, { color: labelColor ?? theme.text }]} numberOfLines={1}>
        {label}
      </Text>
      <View style={{ flex: 1 }} />
      {value ? <Text style={[styles.rowValue, { color: theme.textMuted }]}>{value}</Text> : null}
      {right ?? (onPress ? <Chevron theme={theme} /> : null)}
      {divider ? (
        <View pointerEvents="none" style={[styles.rowDivider, { backgroundColor: theme.divider }]} />
      ) : null}
    </Pressable>
  );
}

export function Chevron({ theme }: { theme: Theme }) {
  return <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />;
}

const styles = StyleSheet.create({
  switch: { width: 51, height: 31, borderRadius: 16, justifyContent: "center" },
  switchRing: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 16,
  },
  thumb: {
    position: "absolute",
    left: 0,
    top: 2,
    width: 27,
    height: 27,
    borderRadius: 13.5,
    backgroundColor: "#F0EEE9",
    shadowColor: "#262628",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionLabel: {
    fontSize: 12,
    fontFamily: "Geologica_600SemiBold",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    paddingLeft: 16,
    marginBottom: 8,
    opacity: 0.5,
  },
  card: { borderRadius: 20, borderWidth: 1 },
  cardInner: { borderRadius: 19, overflow: "hidden" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    height: 56,
    paddingLeft: 16,
    paddingRight: 16,
  },
  rowIcon: { width: 22, alignItems: "center", marginRight: 14 },
  rowDivider: { position: "absolute", left: 52, right: 0, bottom: 0, height: StyleSheet.hairlineWidth },
  rowLabel: { fontSize: 15, fontFamily: "Geologica_400Regular", flexShrink: 1 },
  rowValue: { fontSize: 14, fontFamily: "Geologica_400Regular", marginRight: 9 },
});
