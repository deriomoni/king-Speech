// Daily bonus for the «Монеты» screen: a claim streak shown as a track of five
// days (reward above each mark, day below). Claiming on consecutive days walks
// along the track; after the 5th day the track turns over to the next five
// (days 6–10, 11–15, …). A missed day starts the streak over from day 1.
// Reward by weekday: 10 coins, 20 on Wednesdays, Fridays and Sundays.
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSequence, withTiming } from "react-native-reanimated";
import * as Haptics from "@/lib/haptics";
import { useTheme } from "@/context/ThemeContext";
import { useLang, pickLang, type Lang } from "@/context/LangContext";
import GoldCoin from "@/components/GoldCoin";
import { rs } from "@/lib/responsive";

const KEY = "@kingspeech_daily_streak_v1"; // { last: "YYYY-MM-DD", day: streak day (1, 2, …) }
export const DAILY_BONUS = 10;
export const DAILY_BONUS_BIG = 20;
const BIG_DAYS = [0, 3, 5]; // Sunday, Wednesday, Friday (Date.getDay)
const WINDOW = 5;
/** Coins for the calendar day `offset` days from today. */
function rewardFor(offset: number) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return BIG_DAYS.includes(d.getDay()) ? DAILY_BONUS_BIG : DAILY_BONUS;
}
const MARKS = Array.from({ length: WINDOW }, (_, i) => i);

const INK = "#262628";
const SIDE = rs(26); // track overhang before the first / after the last mark
const TRACK_H = rs(12);
const FILL = "#FFF1A8";
const DOT = rs(8);
const KNOB = rs(20);
const LABEL_H = rs(24);
const GAP_H = rs(5); // between the rewards and the track

function dayStr(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function untilMidnight(lang: Lang) {
  const now = new Date();
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  const mins = Math.max(1, Math.ceil((next.getTime() - now.getTime()) / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return pickLang(lang, { ru: `${m} мин`, en: `${m}m`, kk: `${m} мин` });
  return pickLang(lang, { ru: `${h} ч ${m} мин`, en: `${h}h ${m}m`, kk: `${h} сағ ${m} мин` });
}

type Saved = { last: string | null; day: number };

export default function DailyRewards({
  width,
  onClaim,
}: {
  width: number;
  /** @deprecated language now comes from useLang(); kept for caller compatibility. */
  en?: boolean;
  onClaim: (coins: number) => void;
}) {
  const { theme: c } = useTheme();
  const { lang } = useLang();
  const dark = c.mode === "dark";
  const ink = c.text; // track outline: black in light, light in dark
  const [saved, setSaved] = useState<Saved>({ last: null, day: 0 });
  const [loaded, setLoaded] = useState(false);
  const [, tick] = useState(0);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (!raw) return;
        const v = JSON.parse(raw);
        setSaved({ last: v.last ?? null, day: typeof v.day === "number" ? v.day : 1 });
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
    // refresh the countdown, and flip back to «Забрать» after midnight
    const t = setInterval(() => tick((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  const claimedToday = saved.last === dayStr();
  const onStreak = saved.last === dayStr(-1);
  // Streak day (1, 2, …) that today's claim is / was for.
  const today = claimedToday ? saved.day : onStreak ? saved.day + 1 : 1;
  const first = Math.floor((today - 1) / WINDOW) * WINDOW + 1; // first day on the track
  const pos = today - first; // today's mark, 0..4
  const taken = claimedToday ? pos + 1 : pos; // marks already claimed in this window
  const ready = loaded && !claimedToday;
  const reward = rewardFor(0);
  const rewards = MARKS.map((i) => rewardFor(i - pos));

  const step = (width - SIDE * 2) / (WINDOW - 1);
  const xOf = (i: number) => SIDE + step * i;
  // Fill runs to the last claimed mark (a stub before the first one when none yet).
  const fillW = taken > 0 ? xOf(taken - 1) : SIDE * 0.6;

  const pop = useSharedValue(1);
  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));

  const claim = () => {
    if (!ready) return;
    const next = { last: dayStr(), day: today };
    setSaved(next);
    AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
    onClaim(reward);
    pop.value = withSequence(
      withTiming(1.06, { duration: 90, easing: Easing.out(Easing.quad) }),
      withTiming(1, { duration: 150, easing: Easing.inOut(Easing.quad) }),
    );
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  };

  const dayWord = pickLang(lang, { ru: "День", en: "Day", kk: "Күн" });

  return (
    <View style={{ width }}>
      <Text style={[s.title, { color: c.text }]}>
        {pickLang(lang, { ru: "Ежедневный бонус", en: "Daily bonus", kk: "Күнделікті бонус" })}
      </Text>

      <View style={{ width }}>
        {/* rewards above each mark */}
        <View style={{ height: LABEL_H }}>
          {rewards.map((r, i) => (
            <View key={i} style={[s.reward, { left: xOf(i) - step / 2, width: step }]}>
              <Text style={[s.rewardText, { color: c.text, opacity: i < taken ? 0.45 : 1 }]}>{r}</Text>
              <GoldCoin size={rs(15)} />
            </View>
          ))}
        </View>
        <View style={{ height: GAP_H }} />
        {/* track */}
        <View style={[s.track, { width, borderColor: ink }]}>
          <View style={[s.fill, { width: fillW, borderColor: ink }]} />
        </View>
        {MARKS.map((i) =>
          i === pos ? null : <View key={i} style={[s.dot, { left: xOf(i) - DOT / 2, backgroundColor: ink }]} />,
        )}
        <View
          style={[
            s.knob,
            { left: xOf(pos) - KNOB / 2, borderColor: ink, backgroundColor: claimedToday ? FILL : "#FFFFFF" },
          ]}
        />
        {/* days below */}
        <View style={{ height: LABEL_H }}>
          {MARKS.map((i) => (
            <Text
              key={i}
              style={[s.day, { left: xOf(i) - step / 2, width: step, color: c.text, opacity: i === pos ? 1 : 0.55 }]}
            >
              {`${dayWord} ${first + i}`}
            </Text>
          ))}
        </View>
      </View>

      <Animated.View style={popStyle}>
        {ready ? (
          <Pressable onPress={claim} style={({ pressed }) => [s.cta, { opacity: pressed ? 0.9 : 1 }]}>
            <LinearGradient colors={["#FFE680", "#FFC23A"]} style={StyleSheet.absoluteFill} pointerEvents="none" />
            <Text style={s.ctaText}>{pickLang(lang, { ru: "Забрать", en: "Claim", kk: "Алу" })}</Text>
            <View>
              <GoldCoin size={rs(20)} />
            </View>
            <Text style={s.ctaText}>+{reward}</Text>
          </Pressable>
        ) : (
          <View style={[s.cta, { backgroundColor: dark ? "rgba(240,238,233,0.08)" : "rgba(38,38,40,0.06)" }]}>
            <Text style={[s.waitText, { color: c.textMuted }]}>
              {loaded
                ? pickLang(lang, {
                    ru: `Следующая награда через ${untilMidnight(lang)}`,
                    en: `Next reward in ${untilMidnight(lang)}`,
                    kk: `Келесі сыйлыққа дейін ${untilMidnight(lang)}`,
                  })
                : " "}
            </Text>
          </View>
        )}
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  title: { fontSize: 17, letterSpacing: -0.2, fontFamily: "Geologica_800ExtraBold", marginLeft: 4, marginBottom: rs(10) },
  reward: { position: "absolute", top: 0, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: rs(3) },
  rewardText: { fontSize: rs(15), fontFamily: "Geologica_800ExtraBold", fontStyle: "italic" },
  track: { height: TRACK_H, borderRadius: TRACK_H / 2, borderWidth: 2, overflow: "hidden", marginBottom: rs(6) },
  fill: {
    height: "100%",
    backgroundColor: FILL,
    borderRightWidth: 2,
    borderTopRightRadius: TRACK_H / 2,
    borderBottomRightRadius: TRACK_H / 2,
  },
  dot: { position: "absolute", top: LABEL_H + GAP_H + TRACK_H / 2 - DOT / 2, width: DOT, height: DOT, borderRadius: DOT / 2 },
  knob: {
    position: "absolute",
    top: LABEL_H + GAP_H + TRACK_H / 2 - KNOB / 2,
    width: KNOB,
    height: KNOB,
    borderRadius: KNOB / 2,
    borderWidth: 2.5,
  },
  day: { position: "absolute", top: rs(2), textAlign: "center", fontSize: rs(14), fontFamily: "Geologica_700Bold" },
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
