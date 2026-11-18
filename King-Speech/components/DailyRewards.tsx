// Daily bonus for the «Монеты» screen: one claim of DAILY_BONUS coins per local
// day. After claiming, the button turns into a countdown to local midnight.
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSequence, withTiming } from "react-native-reanimated";
import * as Haptics from "@/lib/haptics";
import { useTheme } from "@/context/ThemeContext";
import GoldCoin from "@/components/GoldCoin";

const KEY = "@kingspeech_daily_streak_v1"; // { last: "YYYY-MM-DD" }
export const DAILY_BONUS = 20;
const INK = "#262628";

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function untilMidnight(en: boolean) {
  const now = new Date();
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  const mins = Math.max(1, Math.ceil((next.getTime() - now.getTime()) / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return en ? `${h}h ${m}m` : `${h} ч ${m} мин`;
}

export default function DailyRewards({
  width,
  en,
  onClaim,
}: {
  width: number;
  en: boolean;
  onClaim: (coins: number) => void;
}) {
  const { theme: c } = useTheme();
  const dark = c.mode === "dark";
  const [last, setLast] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [, tick] = useState(0);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (raw) setLast(JSON.parse(raw).last ?? null);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
    // refresh the countdown, and flip back to «Забрать» after midnight
    const t = setInterval(() => tick((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  const ready = loaded && last !== today();

  const pop = useSharedValue(1);
  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));

  const claim = () => {
    if (!ready) return;
    const day = today();
    setLast(day);
    AsyncStorage.setItem(KEY, JSON.stringify({ last: day })).catch(() => {});
    onClaim(DAILY_BONUS);
    pop.value = withSequence(
      withTiming(1.06, { duration: 90, easing: Easing.out(Easing.quad) }),
      withTiming(1, { duration: 150, easing: Easing.inOut(Easing.quad) }),
    );
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  };

  return (
    <Animated.View style={[s.card, { borderColor: ready ? "#FFD857" : c.tileStroke, width }, popStyle]}>
      <LinearGradient colors={[c.tileTop, c.tileBottom]} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <Text style={[s.title, { color: c.text }]}>{en ? "Daily bonus" : "Ежедневный бонус"}</Text>

      {ready ? (
        <Pressable onPress={claim} style={({ pressed }) => [s.cta, { opacity: pressed ? 0.9 : 1 }]}>
          <LinearGradient colors={["#FFE680", "#FFC23A"]} style={StyleSheet.absoluteFill} pointerEvents="none" />
          <Text style={s.ctaText}>{en ? "Claim" : "Забрать"}</Text>
          <View>
            <GoldCoin size={20} />
          </View>
          <Text style={s.ctaText}>+{DAILY_BONUS}</Text>
        </Pressable>
      ) : (
        <View style={[s.cta, { backgroundColor: dark ? "rgba(240,238,233,0.08)" : "rgba(38,38,40,0.06)" }]}>
          <Ionicons name="time-outline" size={16} color={c.textMuted} />
          <Text style={[s.waitText, { color: c.textMuted }]}>
            {loaded ? (en ? `Next reward in ${untilMidnight(en)}` : `Следующая награда через ${untilMidnight(en)}`) : " "}
          </Text>
        </View>
      )}
    </Animated.View>
  );
}

const s = StyleSheet.create({
  card: { borderRadius: 24, borderWidth: 1.5, overflow: "hidden", padding: 14 },
  title: { fontSize: 17, letterSpacing: -0.2, fontFamily: "Geologica_800ExtraBold", marginLeft: 4 },
  cta: {
    height: 52,
    borderRadius: 26,
    marginTop: 12,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  ctaText: { color: INK, fontSize: 16, fontFamily: "Geologica_900Black" },
  waitText: { fontSize: 13, fontFamily: "Geologica_700Bold" },
});
