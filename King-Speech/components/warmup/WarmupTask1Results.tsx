import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  useSharedValue,
  withSpring,
  useAnimatedStyle,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import OreoMascot from "@/components/OreoMascot";
import { GlassCard, PrimaryButton } from "@/components/ds";
import { warmupFonts, warmupSpring, warmupTheme } from "@/components/warmup/warmupTheme";
import type { WarmupScoreResult } from "@/services/warmupScoring";

interface Props {
  result: WarmupScoreResult;
  onNext: () => void;
}

export default function WarmupTask1Results({ result, onNext }: Props) {
  const [displayPct, setDisplayPct] = useState(0);
  const star0 = useSharedValue(0);
  const star1 = useSharedValue(0);
  const star2 = useSharedValue(0);
  const starScales = [star0, star1, star2];

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    let frame = 0;
    const target = result.accuracy;
    const id = setInterval(() => {
      frame += 1;
      setDisplayPct(Math.min(target, Math.round((frame / 30) * target)));
      if (frame >= 30) clearInterval(id);
    }, 30);

    for (let i = 0; i < result.stars; i++) {
      setTimeout(() => {
        starScales[i].value = withSpring(1, warmupSpring);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }, 200 + i * 180);
    }
    return () => clearInterval(id);
  }, [result.accuracy, result.stars, star0, star1, star2]);

  const starStyle0 = useAnimatedStyle(() => ({ transform: [{ scale: star0.value }] }));
  const starStyle1 = useAnimatedStyle(() => ({ transform: [{ scale: star1.value }] }));
  const starStyle2 = useAnimatedStyle(() => ({ transform: [{ scale: star2.value }] }));
  const starStyles = [starStyle0, starStyle1, starStyle2];

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[warmupTheme.bg, "#1a1030", warmupTheme.bg]}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View entering={FadeIn.duration(400)} style={styles.body}>
        <OreoMascot size={120} shouldPlay />
        <Text style={styles.cheer}>
          {result.stars >= 3
            ? "Блестяще! Голос разогрет."
            : result.stars >= 2
              ? "Хорошо! Голос разогревается."
              : "Отличное начало — продолжай!"}
        </Text>

        <View style={styles.starsRow}>
          {[0, 1, 2].map((i) => (
            <Animated.View key={i} style={starStyles[i]}>
              <Ionicons
                name={i < result.stars ? "star" : "star-outline"}
                size={40}
                color={warmupTheme.gold}
              />
            </Animated.View>
          ))}
        </View>

        <GlassCard glow style={styles.card}>
          <Text style={styles.pctLabel}>Точность</Text>
          <Text style={styles.pct}>{displayPct}%</Text>
          {result.comboMax > 2 && (
            <Text style={styles.combo}>Комбо ×{result.comboMax}</Text>
          )}
        </GlassCard>

        <Animated.View entering={FadeInDown.delay(400).duration(300)}>
          <PrimaryButton label="Дальше" onPress={onNext} />
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: warmupTheme.bg },
  body: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  cheer: {
    fontFamily: warmupFonts.body,
    fontSize: 17,
    color: "#C9C9D1",
    textAlign: "center",
    marginVertical: 16,
  },
  starsRow: { flexDirection: "row", gap: 10, marginBottom: 20 },
  card: { width: "100%", alignItems: "center", marginBottom: 24 },
  pctLabel: {
    fontFamily: warmupFonts.body,
    color: "#aaa",
    fontSize: 14,
    marginBottom: 4,
  },
  pct: {
    fontFamily: warmupFonts.digit,
    fontSize: 56,
    color: "#fff",
  },
  combo: {
    fontFamily: warmupFonts.label,
    color: warmupTheme.gold,
    marginTop: 8,
    fontSize: 16,
  },
});
