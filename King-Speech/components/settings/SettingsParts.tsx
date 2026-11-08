import React, { useEffect } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SvgXml } from "react-native-svg";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import type { Theme } from "@/context/ThemeContext";
import MatteGlass from "@/components/MatteGlass";

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
 * Figma "Switch (on|off)": 51×31 pill. On = gold fill + 4px ctaStroke ring,
 * off = switchTrackOff fill + 2px stroke/shape ring. Thumb 27pt, #F0EEE9.
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
      style={[styles.switch, { backgroundColor: value ? theme.accent : theme.switchTrackOff }]}
    >
      <View
        pointerEvents="none"
        style={[
          styles.switchRing,
          value
            ? { borderWidth: 4, borderColor: theme.ctaStroke }
            : { borderWidth: 2, borderColor: shapeStroke(themeMode) },
        ]}
      />
      <Animated.View style={[styles.thumb, thumbStyle]} />
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
        { backgroundColor: theme.cardGlass, borderColor: shapeStroke(themeMode), overflow: "hidden", zIndex: 0 },
        style,
      ]}
    >
      <MatteGlass radius={22} />
      {children}
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
        divider && { borderBottomWidth: 1, borderBottomColor: theme.divider },
        pressed && onPress ? { backgroundColor: theme.rowPressed } : null,
      ]}
    >
      <View style={styles.rowIcon}>{icon}</View>
      <Text style={[styles.rowLabel, { color: labelColor ?? theme.text }]} numberOfLines={1}>
        {label}
      </Text>
      <View style={{ flex: 1 }} />
      {value ? <Text style={[styles.rowValue, { color: theme.text }]}>{value}</Text> : null}
      {right ?? (onPress ? <Chevron theme={theme} /> : null)}
    </Pressable>
  );
}

export function Chevron({ theme }: { theme: Theme }) {
  return <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />;
}

/** Half-width tile from the "Звук и уведомления" grid. */
export function ToggleTile({
  theme,
  themeMode,
  icon,
  label,
  sub,
  value,
  onValueChange,
}: {
  theme: Theme;
  themeMode: "light" | "dark";
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sub?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  return (
    <View
      style={[
        styles.tile,
        { backgroundColor: theme.cardGlass, borderColor: shapeStroke(themeMode), overflow: "hidden", zIndex: 0 },
      ]}
    >
      <MatteGlass radius={22} />
      <View style={styles.tileHead}>
        <Ionicons name={icon} size={22} color={theme.text} style={{ marginTop: 3 }} />
        <GoldSwitch value={value} onValueChange={onValueChange} theme={theme} themeMode={themeMode} />
      </View>
      <View style={[styles.tileText, { top: sub ? 55 : 63 }]}>
        <Text style={[styles.tileLabel, { color: theme.text }]}>{label}</Text>
        {sub ? (
          <Text
            style={[
              styles.tileSub,
              { color: themeMode === "dark" ? theme.textMuted : theme.textSecondary },
            ]}
          >
            {sub}
          </Text>
        ) : null}
      </View>
    </View>
  );
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
    fontSize: 13,
    fontFamily: "Geologica_700Bold",
    letterSpacing: 0.65,
    textTransform: "uppercase",
    paddingLeft: 4,
    marginBottom: 12,
  },
  card: { borderRadius: 22, borderWidth: 2, overflow: "hidden", zIndex: 0 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    height: 56,
    paddingLeft: 16,
    paddingRight: 16,
  },
  rowIcon: { width: 22, alignItems: "center", marginRight: 14 },
  rowLabel: { fontSize: 15, fontFamily: "Geologica_400Regular", flexShrink: 1 },
  rowValue: { fontSize: 14, fontFamily: "Geologica_400Regular", marginRight: 9 },
  tile: { flex: 1, height: 104, borderRadius: 22, borderWidth: 2 },
  tileHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 11,
    paddingLeft: 13,
    paddingRight: 15,
  },
  tileText: { position: "absolute", left: 13, right: 13 },
  tileLabel: { fontSize: 14, fontFamily: "Geologica_600SemiBold" },
  tileSub: { fontSize: 12, fontFamily: "Geologica_400Regular", marginTop: 3 },
});
