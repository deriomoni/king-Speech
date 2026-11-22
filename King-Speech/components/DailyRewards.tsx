// Daily bonus for the «Монеты» screen: a 7-day streak shown as a track with a
// mark per day (reward above, day below) and a black pill to claim. Claiming
// on consecutive days walks up the track; a missed day starts it over, and
// after day 7 it loops back to day 1.
import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSequence, withTiming } from "react-native-reanimated";
import * as Haptics from "@/lib/haptics";
import { useTheme } from "@/context/ThemeContext";
import { useLang, pickLang, type Lang } from "@/context/LangContext";
import GoldCoin from "@/components/GoldCoin";
import { rs } from "@/lib/responsive";

const KEY = "@kingspeech_daily_streak_v1"; // { last: "YYYY-MM-DD", day: 1..7 }
/** Coins for day 1..7 of a claim streak. */
export const DAILY_REWARDS = [10, 15, 20, 25, 30, 40, 60];
/** @deprecated the reward now depends on the streak day — see DAILY_REWARDS. */
export const DAILY_BONUS = DAILY_REWARDS[0];

const STEP = rs(78); // distance between day marks
const SIDE = rs(34); // track overhang before day 1 / after day 7
const TRACK_H = rs(12);
const FILL = "#FFF1A8";
const DOT = rs(8);
const KNOB = rs(20);

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
  const ink = c.text; // outlines + pill: black in light, light in dark
  const [saved, setSaved] = useState<Saved>({ last: null, day: 0 });
  const [loaded, setLoaded] = useState(false);
  const [, tick] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

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
  // Day (1..7) that today's claim is / was for.
  const today = claimedToday ? saved.day : onStreak ? (saved.day % 7) + 1 : 1;
  // Days already taken in this cycle (drives the fill).
  const taken = claimedToday ? today : today - 1;
  const ready = loaded && !claimedToday;
  const reward = DAILY_REWARDS[today - 1];

  const trackW = SIDE * 2 + STEP * 6;
  const xOf = (i: number) => SIDE + STEP * i;
  // Fill runs to the last taken mark (a stub before day 1 when none yet).
  const fillW = taken > 0 ? xOf(taken - 1) : SIDE * 0.6;

  // Keep today's mark in view.
  useEffect(() => {
    if (!loaded) return;
    const x = Math.max(0, xOf(today - 1) - width / 2);
    const id = setTimeout(() => scrollRef.current?.scrollTo({ x, animated: false }), 0);
    return () => clearTimeout(id);
  }, [loaded, today, width]); // eslint-disable-line react-hooks/exhaustive-deps

  const pop = useSharedValue(1);
  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));

  const claim = () => {
    if (!ready) return;
    const next = { last: dayStr(), day: today };
    setSaved(next);
    AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
    onClaim(reward);
    pop.value = withSequence(
      withTiming(1.05, { duration: 90, easing: Easing.out(Easing.quad) }),
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

      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginHorizontal: -rs(4) }}
        contentContainerStyle={{ paddingHorizontal: rs(4) }}
      >
        <View style={{ width: trackW }}>
          {/* rewards above each mark */}
          <View style={s.labelRow}>
            {DAILY_REWARDS.map((r, i) => (
              <View key={i} style={[s.reward, { left: xOf(i) - STEP / 2, width: STEP }]}>
                <Text style={[s.rewardText, { color: c.text, opacity: i < taken ? 0.45 : 1 }]}>{r}</Text>
                <GoldCoin size={rs(15)} />
              </View>
            ))}
          </View>
          {/* ticks */}
          <View style={s.tickRow}>
            {DAILY_REWARDS.map((_, i) => (
              <View key={i} style={[s.tick, { left: xOf(i) - 1, backgroundColor: ink }]} />
            ))}
          </View>
          {/* track */}
          <View style={[s.track, { width: trackW, borderColor: ink }]}>
            <View style={[s.fill, { width: fillW, backgroundColor: FILL, borderColor: ink }]} />
          </View>
          {DAILY_REWARDS.map((_, i) =>
            i === today - 1 ? null : (
              <View
                key={i}
                style={[s.dot, { left: xOf(i) - DOT / 2, backgroundColor: ink }]}
              />
            ),
          )}
          <View style={[s.knob, { left: xOf(today - 1) - KNOB / 2, borderColor: ink, backgroundColor: claimedToday ? FILL : "#FFFFFF" }]} />
          {/* days below */}
          <View style={s.labelRow}>
            {DAILY_REWARDS.map((_, i) => (
              <Text
                key={i}
                style={[
                  s.day,
                  { left: xOf(i) - STEP / 2, width: STEP, color: c.text, opacity: i === today - 1 ? 1 : 0.55 },
                ]}
              >
                {`${dayWord} ${i + 1}`}
              </Text>
            ))}
          </View>
        </View>
      </ScrollView>

      <Animated.View style={popStyle}>
        <Pressable
          onPress={claim}
          disabled={!ready}
          style={({ pressed }) => [s.pill, { backgroundColor: ink, opacity: !ready ? 0.55 : pressed ? 0.88 : 1 }]}
        >
          <View style={[s.badge, { borderColor: ink }]}>
            <GoldCoin size={rs(40)} />
          </View>
          <Text style={[s.chev, { color: c.bg }]}>»</Text>
          <Text style={[s.pillText, { color: c.bg }]} numberOfLines={1}>
            {!loaded
              ? " "
              : ready
                ? pickLang(lang, { ru: `Забрать +${reward}`, en: `Claim +${reward}`, kk: `Алу +${reward}` })
                : pickLang(lang, {
                    ru: `Через ${untilMidnight(lang)}`,
                    en: `In ${untilMidnight(lang)}`,
                    kk: `${untilMidnight(lang)} кейін`,
                  })}
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  title: { fontSize: 17, letterSpacing: -0.2, fontFamily: "Geologica_800ExtraBold", marginLeft: 4, marginBottom: rs(10) },
  labelRow: { height: rs(24) },
  reward: { position: "absolute", top: 0, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: rs(3) },
  rewardText: { fontSize: rs(15), fontFamily: "Geologica_800ExtraBold", fontStyle: "italic" },
  tickRow: { height: rs(7) },
  tick: { position: "absolute", top: 0, width: 2, height: rs(7), borderRadius: 1 },
  track: { height: TRACK_H, borderRadius: TRACK_H / 2, borderWidth: 2, overflow: "hidden", marginBottom: rs(6) },
  fill: { height: "100%", borderRightWidth: 2, borderTopRightRadius: TRACK_H / 2, borderBottomRightRadius: TRACK_H / 2 },
  dot: { position: "absolute", top: rs(31) + TRACK_H / 2 - DOT / 2, width: DOT, height: DOT, borderRadius: DOT / 2 },
  knob: { position: "absolute", top: rs(31) + TRACK_H / 2 - KNOB / 2, width: KNOB, height: KNOB, borderRadius: KNOB / 2, borderWidth: 2.5 },
  day: { position: "absolute", top: rs(2), textAlign: "center", fontSize: rs(14), fontFamily: "Geologica_700Bold" },
  pill: {
    marginTop: rs(14),
    height: rs(52),
    borderRadius: rs(26),
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: rs(4),
    paddingRight: rs(18),
  },
  badge: { width: rs(46), height: rs(46), borderRadius: rs(23), borderWidth: 2, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  chev: { marginLeft: rs(14), fontSize: rs(20), fontFamily: "Geologica_700Bold" },
  pillText: { flex: 1, textAlign: "center", fontSize: rs(16), fontFamily: "Geologica_800ExtraBold", marginRight: rs(20) },
});
