import React from "react";
import { View, Text, StyleSheet, Pressable, Modal, ViewStyle } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useTheme } from "@/context/ThemeContext";
import { rs } from "@/lib/responsive";

/**
 * The app's one dialog card (Show Time pop-ups, AppDialog, appAlert): a solid
 * rounded card with a centred title and grey message, pill buttons without
 * outlines — grey secondary, solid ink primary, red danger.
 */
export type GlassBtnVariant = "primary" | "secondary" | "link" | "danger";

export interface GlassBtn {
  label: string;
  onPress: () => void;
  variant?: GlassBtnVariant;
  /** Optional node after the label (e.g. a cost + coin). */
  trailing?: React.ReactNode;
  /** Inactive (e.g. not enough coins): secondary look, not pressable. */
  disabled?: boolean;
}

export default function StageGlassDialog({
  visible,
  title,
  message,
  icon,
  buttons,
  stacked = false,
  onRequestClose,
  dismissOnBackdrop = true,
  placement = "center",
  overlay = 0.78,
  children,
}: {
  visible: boolean;
  title: string;
  message?: string;
  icon?: React.ReactNode;
  buttons: GlassBtn[];
  /** Buttons one under another, hugging their label (Послушай себя). */
  stacked?: boolean;
  onRequestClose?: () => void;
  dismissOnBackdrop?: boolean;
  /** "lower" sits the card in the lower half (the stage hint). */
  placement?: "center" | "lower";
  /** How much the screen behind the card is dimmed (0 = not at all). */
  overlay?: number;
  /** Extra content between the message and the buttons (e.g. a cost row). */
  children?: React.ReactNode;
}) {
  const { theme, themeMode } = useTheme();
  const isDark = themeMode === "dark";
  // Reference style: a solid card, centred title + grey message, pill buttons
  // with no outlines — a light grey secondary next to a solid ink primary.
  const cardFill = isDark ? "#242426" : "#FFFFFF";
  const hairline = isDark ? "rgba(240,238,233,0.08)" : "rgba(38,38,40,0.08)";
  const msgColor = isDark ? "rgba(240,238,233,0.6)" : "rgba(38,38,40,0.55)";
  const secFill = isDark ? "rgba(240,238,233,0.09)" : "#F2F2F2";
  const primFill = isDark ? "#F0EEE9" : "#0B0B0C";
  const primInk = isDark ? "#141416" : "#FFFFFF";

  const wrapStyle: ViewStyle =
    placement === "lower"
      ? { justifyContent: "flex-end", paddingBottom: "18%" as any }
      : { justifyContent: "center" };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onRequestClose}>
      <Animated.View
        entering={FadeIn.duration(160)}
        style={[styles.backdrop, wrapStyle, { backgroundColor: `rgba(20,20,22,${isDark ? overlay : overlay * 0.55})` }]}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={dismissOnBackdrop ? onRequestClose : undefined} />
        <Animated.View entering={FadeIn.duration(180)} style={styles.shadowWrap}>
          <View style={[styles.card, { backgroundColor: cardFill, borderColor: hairline }]}>
            {icon ? <View style={{ marginBottom: rs(2) }}>{icon}</View> : null}
            <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
            {message ? <Text style={[styles.message, { color: msgColor }]}>{message}</Text> : null}
            {children}

            <View style={[stacked ? styles.btnsStacked : styles.btnsRow]}>
              {buttons.map((b, i) => {
                const v = b.variant ?? "primary";
                if (v === "link") {
                  return (
                    <Pressable key={i} onPress={b.onPress} hitSlop={6} style={({ pressed }) => [styles.link, { opacity: pressed ? 0.6 : 1 }]}>
                      <Text style={[styles.linkText, { color: msgColor }]}>{b.label}</Text>
                    </Pressable>
                  );
                }
                const danger = v === "danger" && !b.disabled;
                const primary = v === "primary" && !b.disabled;
                return (
                  <Pressable
                    key={i}
                    onPress={b.disabled ? undefined : b.onPress}
                    disabled={b.disabled}
                    accessibilityState={{ disabled: !!b.disabled }}
                    style={({ pressed }) => [
                      stacked ? styles.btnFull : styles.btn,
                      { backgroundColor: danger ? "#E5483B" : primary ? primFill : secFill },
                      { opacity: b.disabled ? 0.5 : pressed ? 0.85 : 1 },
                    ]}
                  >
                    <Text style={[styles.btnText, { color: danger ? "#FFFFFF" : primary ? primInk : theme.text }]}>{b.label}</Text>
                    {b.trailing ?? null}
                  </Pressable>
                );
              })}
            </View>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: "center", paddingHorizontal: 24 },
  shadowWrap: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 30,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },
  card: {
    borderRadius: 30,
    borderWidth: 1,
    paddingTop: 26,
    paddingBottom: 18,
    paddingHorizontal: 18,
    alignItems: "center",
    gap: 8,
  },
  title: { fontFamily: "Geologica_700Bold", fontSize: 18, letterSpacing: -0.1, textAlign: "center", paddingHorizontal: 6 },
  message: { fontFamily: "Geologica_500Medium", fontSize: 15, lineHeight: 21, textAlign: "center", paddingHorizontal: 6 },
  btnsRow: { flexDirection: "row", gap: 10, alignSelf: "stretch", paddingTop: 16 },
  btnsStacked: { alignSelf: "stretch", gap: 8, paddingTop: 16 },
  btn: { flex: 1, minHeight: 48, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 24, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6 },
  btnFull: { alignSelf: "stretch", minHeight: 48, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 24, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6 },
  btnText: { fontFamily: "Geologica_700Bold", fontSize: 16, textAlign: "center" },
  link: { height: 40, paddingHorizontal: 20, alignItems: "center", justifyContent: "center", alignSelf: "center" },
  linkText: { fontFamily: "Geologica_500Medium", fontSize: 14 },
});
