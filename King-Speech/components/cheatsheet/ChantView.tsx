import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { fonts } from "@/constants/colors";
import { useAppColors } from "@/hooks/useAppColors";

const ACCENT = "#FFCF34";

function Syllable({ text, active, muted }: { text: string; active: boolean; muted: string }) {
  const p = useSharedValue(active ? 1 : 0);
  useEffect(() => {
    p.value = withTiming(active ? 1 : 0, { duration: 200 });
  }, [active]);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + p.value * 0.16 }],
    opacity: 0.4 + p.value * 0.6,
  }));
  return (
    <Animated.View style={style}>
      <Text style={[styles.syl, { color: muted }, active && styles.sylActive]}>{text}</Text>
    </Animated.View>
  );
}

/**
 * Vocal chant / распевка. Highlights each syllable in rhythm (looping) so the
 * user "sings along" instead of reading. Pure timers — no audio required.
 */
export default function ChantView({
  syllables,
  tempoMs,
}: {
  syllables: string[];
  tempoMs: number;
}) {
  const [active, setActive] = useState(0);
  const { colors, isDark } = useAppColors();

  useEffect(() => {
    if (!syllables.length) return;
    const iv = setInterval(() => {
      setActive((a) => {
        const next = (a + 1) % syllables.length;
        if (Platform.OS !== "web") {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        }
        return next;
      });
    }, tempoMs);
    return () => clearInterval(iv);
  }, [syllables, tempoMs]);

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {syllables.map((s, i) => (
          <Syllable key={`${s}-${i}`} text={s} active={i === active} muted={colors.textMuted} />
        ))}
      </View>
      <View style={styles.dots}>
        {syllables.map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              { backgroundColor: isDark ? "rgba(255,255,255,0.18)" : "rgba(14,14,16,0.16)" },
              i === active && styles.dotActive,
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 28 },
  row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: 14 },
  syl: { color: "rgba(255,255,255,0.5)", fontSize: 40, fontFamily: fonts.display, letterSpacing: 1 },
  sylActive: { color: ACCENT },
  dots: { flexDirection: "row", gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.18)" },
  dotActive: { backgroundColor: ACCENT, width: 22 },
});
