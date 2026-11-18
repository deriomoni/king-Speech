// Weekly daily-reward calendar for the «Монеты» screen.
// A 7-day streak: claim once per local day. Missing a day (or finishing day 7)
// starts the week over. Past days show a check, today is the gold tile with the
// claim button, future days are blurred behind a lock.
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "@/lib/haptics";
import { useTheme } from "@/context/ThemeContext";
import CoinIcon, { COIN_GOLD } from "@/components/GoldCoin";

const KEY = "@kingspeech_daily_streak_v1";
// Days 1–6 give 20 coins, day 7 closes the week with a bigger reward.
export const DAILY_REWARDS = [20, 20, 20, 20, 20, 20, 50];
const INK = "#262628";

function dayStr(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type Saved = { last: string; streak: number };

// → index of today's tile (0..6) and whether it is already claimed
function resolve(saved: Saved | null): { idx: number; claimed: boolean } {
  if (saved && saved.last === dayStr()) return { idx: saved.streak - 1, claimed: true };
  if (saved && saved.last === dayStr(-1) && saved.streak < 7) return { idx: saved.streak, claimed: false };
  return { idx: 0, claimed: false };
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

function daysWord(n: number, en: boolean) {
  if (en) return n === 1 ? "day" : "days";
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return "день";
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return "дня";
  return "дней";
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
  const [saved, setSaved] = useState<Saved | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [, tick] = useState(0);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (raw) setSaved(JSON.parse(raw));
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
    const t = setInterval(() => tick((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  const { idx, claimed } = resolve(saved);
  const ready = loaded && !claimed;
  const streak = claimed ? idx + 1 : idx; // days already collected this week

  // soft breathing glow on today's tile while it waits to be claimed
  const glow = useSharedValue(0);
  useEffect(() => {
    glow.value = ready
      ? withRepeat(withSequence(withTiming(1, { duration: 900 }), withTiming(0, { duration: 900 })), -1)
      : withTiming(0, { duration: 200 });
  }, [ready]);
  const glowStyle = useAnimatedStyle(() => ({ opacity: 0.25 + glow.value * 0.55 }));

  const pop = useSharedValue(1);
  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));

  const claim = () => {
    if (!ready) return;
    const next: Saved = { last: dayStr(), streak: idx + 1 };
    setSaved(next);
    AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
    onClaim(DAILY_REWARDS[idx]);
    pop.value = withSequence(
      withTiming(1.12, { duration: 110, easing: Easing.out(Easing.quad) }),
      withTiming(1, { duration: 180, easing: Easing.inOut(Easing.quad) }),
    );
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  };

  const inner = width - 28;
  const gap = 8;
  const tileW = (inner - gap * 3) / 4;
  const wideW = tileW * 2 + gap;

  const tile = (i: number) => {
    const isWide = i === 6;
    const w = isWide ? wideW : tileW;
    const past = i < idx || (i === idx && claimed);
    const today = i === idx && !claimed;
    const future = i > idx;
    const reward = DAILY_REWARDS[i];
    const label = today ? (en ? "Today" : "Сегодня") : en ? `Day ${i + 1}` : `День ${i + 1}`;

    const body = (
      <View style={[s.tileBody, isWide && s.tileBodyWide]}>
        <View>
          {isWide ? (
            <View style={{ width: 46, height: 34 }}>
              <View style={{ position: "absolute", left: 0, top: 8 }}><CoinIcon size={26} /></View>
              <View style={{ position: "absolute", left: 10, top: 4 }}><CoinIcon size={26} /></View>
              <View style={{ position: "absolute", left: 20, top: 0 }}><CoinIcon size={26} /></View>
            </View>
          ) : (
            <CoinIcon size={26} />
          )}
        </View>
        <Text style={[s.reward, { color: today ? INK : c.text }]}>+{reward}</Text>
      </View>
    );

    return (
      <Animated.View
        key={i}
        entering={FadeInDown.delay(140 + i * 45).duration(360)}
        style={[{ width: w }, today && popStyle]}
      >
        {today && <Animated.View style={[s.glow, glowStyle]} pointerEvents="none" />}
        <View
          style={[
            s.tile,
            {
              borderColor: today ? "#FFE89A" : c.tileStroke,
              backgroundColor: today ? COIN_GOLD : dark ? "rgba(255,255,255,0.04)" : "rgba(38,38,40,0.04)",
            },
          ]}
        >
          {today && (
            <LinearGradient colors={["#FFE680", "#FFC23A"]} style={StyleSheet.absoluteFill} pointerEvents="none" />
          )}
          <Text style={[s.day, { color: today ? INK : c.textMuted }]}>
            {isWide && !today ? (en ? "Day 7 · Big prize" : "День 7 · Большой приз") : label}
          </Text>
          <View style={{ opacity: past ? 0.45 : 1 }}>{body}</View>

          {past && (
            <View style={s.check}>
              <Ionicons name="checkmark" size={15} color={INK} />
            </View>
          )}
          {future && (
            <>
              <BlurView
                intensity={Platform.OS === "android" ? 0 : 22}
                tint={dark ? "dark" : "light"}
                style={s.veil}
              />
              <View style={[s.veil, { backgroundColor: dark ? "rgba(24,24,26,0.45)" : "rgba(255,255,255,0.45)" }]} />
              <View style={s.lockWrap} pointerEvents="none">
                <View style={[s.lock, { backgroundColor: dark ? "rgba(240,238,233,0.12)" : "rgba(38,38,40,0.10)" }]}>
                  <Ionicons name="lock-closed" size={14} color={c.text} />
                </View>
              </View>
            </>
          )}
        </View>
      </Animated.View>
    );
  };

  return (
    <View style={[s.card, { borderColor: c.tileStroke, width }]}>
      <LinearGradient colors={[c.tileTop, c.tileBottom]} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <View style={s.head}>
        <View style={{ flex: 1 }}>
          <Text style={[s.title, { color: c.text }]}>{en ? "Daily bonus" : "Ежедневный бонус"}</Text>
          <Text style={[s.sub, { color: c.textMuted }]}>
            {en ? "Don't break your 7-day streak" : "Не прерывай серию 7 дней"}
          </Text>
        </View>
        <View style={[s.streak, { backgroundColor: dark ? "rgba(255,138,31,0.14)" : "rgba(255,138,31,0.12)" }]}>
          <Ionicons name="flame" size={14} color="#FF8A1F" />
          <Text style={s.streakText}>
            {streak} {daysWord(streak, en)}
          </Text>
        </View>
      </View>

      <View style={[s.row, { gap }]}>{[0, 1, 2, 3].map(tile)}</View>
      <View style={[s.row, { gap, marginTop: gap }]}>{[4, 5, 6].map(tile)}</View>

      {ready ? (
        <Pressable onPress={claim} style={({ pressed }) => [s.cta, { opacity: pressed ? 0.9 : 1 }]}>
          <LinearGradient colors={["#FFE680", "#FFC23A"]} style={StyleSheet.absoluteFill} pointerEvents="none" />
          <Text style={s.ctaText}>{en ? "Claim" : "Забрать"}</Text>
          <View>
            <CoinIcon size={18} />
          </View>
          <Text style={s.ctaText}>+{DAILY_REWARDS[idx]}</Text>
        </Pressable>
      ) : (
        <View style={[s.cta, { backgroundColor: dark ? "rgba(240,238,233,0.08)" : "rgba(38,38,40,0.06)" }]}>
          <Ionicons name="time-outline" size={16} color={c.textMuted} />
          <Text style={[s.waitText, { color: c.textMuted }]}>
            {loaded ? (en ? `Next reward in ${untilMidnight(en)}` : `Следующая награда через ${untilMidnight(en)}`) : " "}
          </Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderRadius: 24, borderWidth: 1, overflow: "hidden", padding: 14 },
  head: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 14 },
  title: { fontSize: 17, letterSpacing: -0.2, fontFamily: "Geologica_800ExtraBold" },
  sub: { fontSize: 12, fontFamily: "Geologica_600SemiBold", marginTop: 3 },
  streak: { flexDirection: "row", alignItems: "center", gap: 4, height: 28, borderRadius: 14, paddingHorizontal: 10 },
  streakText: { color: "#FF8A1F", fontSize: 12, fontFamily: "Geologica_800ExtraBold" },
  row: { flexDirection: "row" },
  glow: {
    position: "absolute",
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: 20,
    backgroundColor: "rgba(255,200,58,0.55)",
  },
  tile: { height: 92, borderRadius: 16, borderWidth: 1.5, overflow: "hidden", paddingTop: 9, alignItems: "center" },
  day: { fontSize: 11, fontFamily: "Geologica_700Bold" },
  tileBody: { alignItems: "center", marginTop: 7, gap: 3 },
  tileBodyWide: { flexDirection: "row", gap: 8, marginTop: 14 },
  reward: { fontSize: 16, letterSpacing: -0.2, fontFamily: "Geologica_900Black" },
  check: {
    position: "absolute",
    top: 33,
    alignSelf: "center",
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COIN_GOLD,
    alignItems: "center",
    justifyContent: "center",
  },
  veil: { position: "absolute", top: 26, left: 0, right: 0, bottom: 0 },
  lockWrap: { position: "absolute", top: 26, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" },
  lock: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  cta: {
    height: 50,
    borderRadius: 25,
    marginTop: 14,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  ctaText: { color: INK, fontSize: 16, fontFamily: "Geologica_900Black" },
  waitText: { fontSize: 13, fontFamily: "Geologica_700Bold" },
});
