import React from "react";
import { View, Text, StyleSheet, Pressable, Modal } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { BlurView } from "expo-blur";
import Svg, { Defs, RadialGradient, Rect, Stop, LinearGradient } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/context/ThemeContext";

/**
 * "Как выполнять?" pop-ups of the Разогрев level (Figma 37:5023 breathing,
 * 37:5074 mouth) — liquid-glass card: 4pt hairline border, blurred translucent
 * fill with a soft gold glow and a top highlight.
 */

function GlassBackground({ radius }: { radius: number }) {
  const { theme, themeMode } = useTheme();
  const dark = themeMode === "dark";
  return (
    <View style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: "hidden" }]} pointerEvents="none">
      <BlurView intensity={20} tint={dark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: dark ? "rgba(52,52,53,0.82)" : "rgba(250,249,246,0.9)" },
        ]}
      />
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} preserveAspectRatio="none">
        <Defs>
          <RadialGradient id="glow" cx="50%" cy="28%" rx="38%" ry="31%">
            <Stop offset="0" stopColor={theme.accent} stopOpacity={dark ? 0.14 : 0.2} />
            <Stop offset="1" stopColor={theme.accent} stopOpacity={0} />
          </RadialGradient>
          <LinearGradient id="hl" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={dark ? "#F0EEE9" : "#FFFFFF"} stopOpacity={dark ? 0.06 : 0.5} />
            <Stop offset="0.5" stopColor={dark ? "#F0EEE9" : "#FFFFFF"} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#glow)" />
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#hl)" />
      </Svg>
    </View>
  );
}

function Shell({
  visible,
  onClose,
  width,
  children,
  cardStyle,
}: {
  visible: boolean;
  onClose: () => void;
  width: number;
  children: React.ReactNode;
  cardStyle?: object;
}) {
  const { themeMode } = useTheme();
  const dark = themeMode === "dark";
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.backdrop, { backgroundColor: dark ? "rgba(0,0,0,0.45)" : "rgba(38,38,40,0.25)" }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View
          entering={FadeIn.duration(180)}
          style={[
            styles.card,
            {
              width,
              borderColor: dark ? "rgba(240,238,233,0.26)" : "rgba(255,255,255,0.8)",
              shadowOpacity: dark ? 0.6 : 0.18,
            },
            cardStyle,
          ]}
        >
          <GlassBackground radius={28} />
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

/** Breathing help — left-aligned copy with a close cross (Figma 37:5023). */
export function BreathingHelpDialog({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { theme } = useTheme();
  return (
    <Shell visible={visible} onClose={onClose} width={346} cardStyle={styles.breathCard}>
      <Pressable onPress={onClose} hitSlop={12} style={styles.close}>
        <Ionicons name="close" size={22} color={theme.textSecondary} />
      </Pressable>
      <Text style={[styles.bTitle, { color: theme.text }]}>Как выполнять?</Text>
      <Text style={[styles.bText, { color: theme.textSecondary }]}>
        Дышите вместе с кругом: расширяется - вдох, сжимается - выдох. Текст на круге подскажет ритм.
      </Text>
      <Text style={[styles.bText, { color: theme.textSecondary }]}>
        Дыхательная разминка - базовое упражнение перед выступлением. Успокаивает дыхание, снимает напряжение и готовит связки к работе.
      </Text>
      <Text style={[styles.bSub, { color: theme.text }]}>Разминка рта</Text>
      <Text style={[styles.bText, { color: theme.textSecondary }]}>
        Простые упражнения для мышц языка, губ и голосовых связок. Подсказки по выполнению задания появятся на экране.
      </Text>
      <Text style={[styles.bFoot, { color: theme.textMuted }]}>
        Уровень не требует микрофона. За выполнение задания начисляется 10 баллов. При желании уровень можно пройти повторно.
      </Text>
    </Shell>
  );
}

/** Mouth help — centered title/message + gold «Понятно» (Figma 37:5074). */
export function MouthHelpDialog({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { theme } = useTheme();
  return (
    <Shell visible={visible} onClose={onClose} width={330} cardStyle={styles.mouthCard}>
      <Text style={[styles.mTitle, { color: theme.text }]}>Как выполнять?</Text>
      <Text style={[styles.mText, { color: theme.textSecondary }]}>
        Сначала появится название упражнения и короткое описание. Затем - задание и подсказка, как его выполнять. Повторяй движение вместе с таймером, спокойно и без напряжения.
      </Text>
      <View style={styles.mBtns}>
        <Pressable
          onPress={onClose}
          style={({ pressed }) => [
            styles.mBtn,
            { backgroundColor: theme.accent, borderColor: theme.ctaStroke, opacity: pressed ? 0.9 : 1 },
          ]}
        >
          <Text style={[styles.mBtnText, { color: theme.accentText }]}>Понятно</Text>
        </Pressable>
      </View>
    </Shell>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28 },
  card: {
    borderRadius: 32,
    borderWidth: 4,
    maxWidth: "100%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 24 },
    shadowRadius: 30,
    elevation: 12,
  },
  breathCard: { paddingTop: 26, paddingBottom: 30, paddingHorizontal: 20, gap: 12 },
  close: { position: "absolute", top: 18, right: 18, padding: 4, zIndex: 2 },
  bTitle: { fontFamily: "Geologica_700Bold", fontSize: 20, letterSpacing: -0.1, marginBottom: 2 },
  bText: { fontFamily: "Geologica_400Regular", fontSize: 15, lineHeight: 22 },
  bSub: { fontFamily: "Geologica_700Bold", fontSize: 16, marginTop: 4 },
  bFoot: { fontFamily: "Geologica_400Regular", fontSize: 13.5, lineHeight: 20, marginTop: 4 },

  mouthCard: { paddingTop: 28, paddingBottom: 20, paddingHorizontal: 20, gap: 10, alignItems: "center" },
  mTitle: { fontFamily: "Geologica_800ExtraBold", fontSize: 19, letterSpacing: -0.1, textAlign: "center" },
  mText: { fontFamily: "Geologica_600SemiBold", fontSize: 14, lineHeight: 20, textAlign: "center" },
  mBtns: { paddingTop: 16, alignSelf: "stretch" },
  mBtn: {
    height: 52,
    borderRadius: 32,
    borderWidth: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  mBtnText: { fontFamily: "Geologica_900Black", fontSize: 16 },
});
