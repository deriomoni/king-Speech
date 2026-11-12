import React from "react";
import { View, Text, StyleSheet, Pressable, Modal, Platform } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { SvgXml } from "react-native-svg";
import type { Theme } from "@/context/ThemeContext";
import {
  CAMERA_SVG,
  IMAGE_SVG,
  PENCIL_SVG,
  ADDACTIVE_SVG,
  tintSvg,
} from "@/assets/figma/profile/svgs";

// Figma "Профиль · меню «+» (фото, фон, имя)" (node 130:3): dimmed + blurred
// screen, the "+" turns into "×", and a glass popover hangs under it with
// three options. An optional 4th danger row removes the current photo.

export type MenuAnchor = { x: number; y: number; width: number; height: number };

export type MenuOption = {
  key: string;
  icon: "camera" | "image" | "pencil" | "trash";
  label: string;
  danger?: boolean;
  onPress: () => void;
};

const POPOVER_W = 292;
const BTN = 40;

const TRASH_SVG =
  '<svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 6.5H18M9 6.5V4.5H13V6.5M6 6.5L6.8 18.2C6.85 18.9 7.4 19.5 8.1 19.5H13.9C14.6 19.5 15.15 18.9 15.2 18.2L16 6.5" stroke="#F0EEE9" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

export default function ProfileMenuPopover({
  visible,
  anchor,
  theme,
  options,
  onClose,
}: {
  visible: boolean;
  anchor: MenuAnchor | null;
  theme: Theme;
  options: MenuOption[];
  onClose: () => void;
}) {
  const isDark = theme.mode === "dark";
  const ink = isDark ? "#F0EEE9" : "#262628";
  const a = anchor ?? { x: 0, y: 0, width: BTN, height: BTN };
  const btnRight = a.x + a.width;
  // Popover right edge aligns with the button's right edge, 12pt below it.
  const popLeft = Math.max(16, btnRight - POPOVER_W);
  const popTop = a.y + a.height + 12;

  const iconXml = (icon: MenuOption["icon"], danger?: boolean) => {
    const base =
      icon === "camera" ? CAMERA_SVG : icon === "image" ? IMAGE_SVG : icon === "pencil" ? PENCIL_SVG : TRASH_SVG;
    return tintSvg(base, "#F0EEE9", danger ? "#E5484D" : ink);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
        <BlurView
          intensity={Platform.OS === "web" ? 6 : 12}
          tint={isDark ? "dark" : "light"}
          style={StyleSheet.absoluteFill}
        />
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: isDark ? "rgba(38,38,40,0.55)" : "rgba(250,249,246,0.55)" },
          ]}
        />
      </Pressable>

      {/* "×" in place of the "+" button */}
      <Pressable
        onPress={onClose}
        hitSlop={8}
        style={[styles.closeBtn, { left: a.x, top: a.y }]}
      >
        <SvgXml xml={tintSvg(ADDACTIVE_SVG, "#F0EEE9", ink)} width={BTN} height={BTN} />
      </Pressable>

      <View style={[styles.popoverShadow, { left: popLeft, top: popTop }]}>
      <View
        style={[
          styles.popover,
          {
            borderColor: isDark ? "rgba(240,238,233,0.4)" : "rgba(255,255,255,0.9)",
          },
        ]}
      >
        {/* Glass layers clipped to the inner radius (22 − 4) so their square
            corners don't show through the translucent rim. */}
        <View pointerEvents="none" style={styles.glass}>
        <BlurView
          intensity={40}
          tint={isDark ? "dark" : "light"}
          style={StyleSheet.absoluteFill}
        />
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: isDark ? "rgba(55,55,56,0.78)" : "rgba(250,249,246,0.82)" },
          ]}
        />
        <LinearGradient
          colors={
            isDark
              ? ["rgba(240,238,233,0.12)", "rgba(240,238,233,0)"]
              : ["rgba(255,255,255,0.6)", "rgba(255,255,255,0)"]
          }
          locations={[0, 0.6]}
          style={StyleSheet.absoluteFill}
        />
        </View>
        <View style={styles.list}>
          {options.map((o, i) => (
            <React.Fragment key={o.key}>
              {i > 0 && (
                <View
                  style={[
                    styles.sep,
                    { backgroundColor: isDark ? "rgba(240,238,233,0.08)" : "rgba(38,38,40,0.08)" },
                  ]}
                />
              )}
              <Pressable
                onPress={o.onPress}
                style={({ pressed }) => [
                  styles.row,
                  pressed && { backgroundColor: theme.rowPressed },
                ]}
              >
                <View
                  style={[
                    styles.plate,
                    { backgroundColor: isDark ? "rgba(240,238,233,0.08)" : "rgba(38,38,40,0.06)" },
                  ]}
                >
                  <SvgXml xml={iconXml(o.icon, o.danger)} width={22} height={22} />
                </View>
                <Text
                  style={[styles.label, { color: o.danger ? "#E5484D" : ink }]}
                  numberOfLines={1}
                >
                  {o.label}
                </Text>
              </Pressable>
            </React.Fragment>
          ))}
        </View>
      </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  closeBtn: {
    position: "absolute",
    width: BTN,
    height: BTN,
  },
  popover: {
    borderRadius: 22,
    borderWidth: 4,
    overflow: "hidden",
  },
  glass: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 18,
    overflow: "hidden",
  },
  popoverShadow: {
    position: "absolute",
    width: POPOVER_W,
    borderRadius: 22,
    ...(Platform.OS === "web"
      ? ({ boxShadow: "0px 18px 40px rgba(0,0,0,0.55)" } as any)
      : {
          shadowColor: "#000",
          shadowOpacity: 0.55,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: 18 },
          elevation: 16,
        }),
  },
  list: {
    paddingVertical: 2,
    paddingHorizontal: 2,
  },
  row: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingLeft: 14,
    borderRadius: 16,
  },
  plate: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 15,
    fontFamily: "Geologica_700Bold",
    flexShrink: 1,
  },
  sep: {
    height: 1,
    marginLeft: 40,
    marginRight: 22,
  },
});
