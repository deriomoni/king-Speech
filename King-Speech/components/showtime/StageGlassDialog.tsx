import React from "react";
import { View, Text, StyleSheet, Pressable, Modal, ViewStyle } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import Svg, { Defs, RadialGradient, Stop, Rect, LinearGradient as SvgLinear } from "react-native-svg";
import { BlurView } from "expo-blur";
import { useTheme } from "@/context/ThemeContext";

/**
 * Show Time pop-ups (Figma "Dialog / Liquid Glass": 37:3800 «Вы уверены?»,
 * 37:6850 «Подсказка», 36:1228 «Послушай себя»). A frosted card with a soft
 * gold glow behind the title, a 4pt pale rim and 32pt corners, over a dimmed
 * stage. Also the renderer behind the shared AppDialog (every app pop-up).
 */
export type GlassBtnVariant = "primary" | "secondary" | "link";

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
  const cardFill = isDark ? "rgba(52,52,53,0.82)" : "rgba(250,249,246,0.94)";
  const rim = isDark ? "rgba(240,238,233,0.26)" : "rgba(38,38,40,0.10)";
  const msgColor = isDark ? "rgba(240,238,233,0.6)" : "rgba(38,38,40,0.6)";
  // Secondary / disabled buttons: neutral grey glass with normal ink text.
  const secFill = isDark ? "rgba(240,238,233,0.10)" : "rgba(38,38,40,0.06)";
  const secStroke = isDark ? "rgba(240,238,233,0.14)" : "rgba(38,38,40,0.10)";
  const [size, setSize] = React.useState({ w: 330, h: 200 });
  const inW = Math.max(1, size.w - 2 * RIM);
  const inH = Math.max(1, size.h - 2 * RIM);

  const wrapStyle: ViewStyle =
    placement === "lower"
      ? { justifyContent: "flex-end", paddingBottom: "18%" as any }
      : { justifyContent: "center" };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onRequestClose}>
      <Animated.View
        entering={FadeIn.duration(160)}
        style={[
          styles.backdrop,
          wrapStyle,
          { backgroundColor: `rgba(38,38,40,${isDark ? overlay : overlay * 0.55})` },
        ]}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={dismissOnBackdrop ? onRequestClose : undefined} />
        <Animated.View entering={FadeIn.duration(220)} style={styles.shadowWrap}>
          <View
            onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
            style={[styles.card, { borderColor: rim }]}
          >
            {/* Glass layers sit INSIDE the 4pt rim with the matching inner radius
                (32 − 4): square fills poking into the rounded corners used to
                show through the translucent rim as a seam. */}
            <View pointerEvents="none" style={styles.glass}>
            <BlurView intensity={40} tint={isDark ? "dark" : "light"} experimentalBlurMethod="dimezisBlurView" style={StyleSheet.absoluteFill} />
            <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: cardFill }]} />
            {/* Gold glow behind the title + a faint top sheen. */}
            <Svg pointerEvents="none" width={inW} height={inH} style={styles.glow}>
              <Defs>
                <RadialGradient
                  id="stGlow"
                  cx={inW / 2}
                  cy={inH * 0.28}
                  rx={inW * 0.38}
                  ry={inH * 0.32}
                  gradientUnits="userSpaceOnUse"
                >
                  <Stop offset="0" stopColor="#FFD857" stopOpacity={isDark ? 0.14 : 0.2} />
                  <Stop offset="1" stopColor="#FFD857" stopOpacity={0} />
                </RadialGradient>
                <SvgLinear id="stSheen" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={isDark ? "#F0EEE9" : "#FFFFFF"} stopOpacity={isDark ? 0.06 : 0.5} />
                  <Stop offset="0.5" stopColor={isDark ? "#F0EEE9" : "#FFFFFF"} stopOpacity={0} />
                </SvgLinear>
              </Defs>
              <Rect x="0" y="0" width={inW} height={inH} fill="url(#stSheen)" />
              <Rect x="0" y="0" width={inW} height={inH} fill="url(#stGlow)" />
            </Svg>
            </View>

            {icon ? <View style={{ marginBottom: 2 }}>{icon}</View> : null}
            <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
            {message ? <Text style={[styles.message, { color: msgColor }]}>{message}</Text> : null}
            {children}

            <View style={[stacked ? styles.btnsStacked : styles.btnsRow]}>
              {buttons.map((b, i) => {
                const v = b.variant ?? "primary";
                if (v === "link") {
                  return (
                    <Pressable key={i} onPress={b.onPress} hitSlop={6} style={({ pressed }) => [styles.link, { opacity: pressed ? 0.6 : 1 }]}>
                      <Text style={[styles.linkText, { color: isDark ? "rgba(240,238,233,0.55)" : "rgba(38,38,40,0.55)" }]}>{b.label}</Text>
                    </Pressable>
                  );
                }
                const primary = v === "primary" && !b.disabled;
                return (
                  <Pressable
                    key={i}
                    onPress={b.disabled ? undefined : b.onPress}
                    disabled={b.disabled}
                    accessibilityState={{ disabled: !!b.disabled }}
                    style={({ pressed }) => [
                      stacked ? styles.btnHug : styles.btn,
                      primary
                        ? { backgroundColor: theme.accent, borderColor: theme.ctaStroke, borderWidth: 4 }
                        : { backgroundColor: secFill, borderColor: secStroke, borderWidth: 1.5 },
                      { opacity: b.disabled ? 0.6 : pressed ? 0.85 : 1 },
                    ]}
                  >
                    <Text
                      style={[
                        primary || b.disabled ? (stacked ? styles.btnTextHug : styles.btnTextPrimary) : styles.btnTextSecondary,
                        { color: primary ? theme.accentText : theme.text },
                      ]}
                    >
                      {b.label}
                    </Text>
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

const RIM = 4;
const CARD_R = 32;

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: "center", paddingHorizontal: 28 },
  shadowWrap: {
    width: "100%",
    maxWidth: 346,
    borderRadius: 32,
    shadowColor: "#000",
    shadowOpacity: 0.6,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 24 },
    elevation: 16,
  },
  card: {
    borderRadius: CARD_R,
    borderWidth: RIM,
    overflow: "hidden",
    paddingTop: 28,
    paddingBottom: 20,
    paddingHorizontal: 20,
    alignItems: "center",
    gap: 10,
  },
  glass: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: CARD_R - RIM,
    overflow: "hidden",
  },
  glow: { position: "absolute", top: 0, left: 0 },
  title: { fontFamily: "Geologica_800ExtraBold", fontSize: 19, letterSpacing: -0.1, textAlign: "center" },
  message: { fontFamily: "Geologica_600SemiBold", fontSize: 14, lineHeight: 20, textAlign: "center" },
  btnsRow: { flexDirection: "row", gap: 12, alignSelf: "stretch", paddingTop: 16 },
  btnsStacked: { alignItems: "center", alignSelf: "stretch", gap: 2, paddingTop: 2 },
  btn: { flex: 1, height: 52, borderRadius: 32, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6 },
  btnHug: { height: 48, borderRadius: 24, paddingHorizontal: 28, alignItems: "center", justifyContent: "center" },
  btnTextPrimary: { fontFamily: "Geologica_900Black", fontSize: 16 },
  btnTextHug: { fontFamily: "Geologica_700Bold", fontSize: 15 },
  btnTextSecondary: { fontFamily: "Geologica_700Bold", fontSize: 16 },
  link: { height: 40, paddingHorizontal: 20, alignItems: "center", justifyContent: "center" },
  linkText: { fontFamily: "Geologica_500Medium", fontSize: 14 },
});
