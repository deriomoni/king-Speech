import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Circle } from "react-native-svg";
import type { Theme } from "@/context/ThemeContext";
import MatteGlass from "@/components/MatteGlass";

// Figma "Card · В ударе" (node 117:1091): "N дня подряд в ударе" + a Mon..Sun
// row of day rings. Activity is derived from real dated data (timestamps of
// saved recordings) — no fake numbers. A day's ring fills by how many dated
// activities happened that day vs DAILY_GOAL.

const DAILY_GOAL = 1;
const DAY_MS = 24 * 60 * 60 * 1000;

const DAY_LABELS_RU = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const DAY_LABELS_EN = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

function dayKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function computeStreak(activityDates: number[], now = new Date()) {
  const counts = new Map<string, number>();
  for (const t of activityDates) {
    if (!t || !Number.isFinite(t)) continue;
    const k = dayKey(new Date(t));
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const today = startOfDay(now);

  // Consecutive active days ending today (or yesterday, if today has no
  // activity yet — the streak isn't broken until the day is over).
  let streak = 0;
  let cursor = new Date(today);
  if (!counts.has(dayKey(cursor))) cursor = new Date(cursor.getTime() - DAY_MS);
  while (counts.has(dayKey(cursor))) {
    streak += 1;
    cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() - 1);
  }

  // Current week, Monday first.
  const mondayOffset = (today.getDay() + 6) % 7;
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - mondayOffset);
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
    const n = counts.get(dayKey(d)) ?? 0;
    return {
      date: d,
      dayOfMonth: d.getDate(),
      progress: Math.min(1, n / DAILY_GOAL),
      isToday: i === mondayOffset,
      isFuture: i > mondayOffset,
    };
  });
  return { streak, week };
}

function pluralDaysRu(n: number) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return "день";
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return "дня";
  return "дней";
}

const RING = 40;
const R = 18;
const STROKE = 4;
const CIRC = 2 * Math.PI * R;

function DayRing({
  progress,
  trackColor,
  color,
}: {
  progress: number;
  trackColor: string;
  color: string;
}) {
  return (
    <Svg width={RING} height={RING} viewBox="0 0 40 40">
      <Circle cx={20} cy={20} r={R} stroke={trackColor} strokeWidth={STROKE} fill="none" />
      {progress > 0 ? (
        <Circle
          cx={20}
          cy={20}
          r={R}
          stroke={color}
          strokeWidth={STROKE}
          fill="none"
          strokeLinecap={progress >= 1 ? "butt" : "round"}
          strokeDasharray={progress >= 1 ? undefined : `${CIRC * progress} ${CIRC}`}
          // Start at 12 o'clock, run clockwise (as in the Figma arcs).
          transform="rotate(-90 20 20)"
        />
      ) : null}
    </Svg>
  );
}

export default function StreakCard({
  theme,
  activityDates,
  lang,
}: {
  theme: Theme;
  activityDates: number[];
  lang: string;
}) {
  const { streak, week } = useMemo(() => computeStreak(activityDates), [activityDates]);
  const isDark = theme.mode === "dark";
  const labels = lang === "en" ? DAY_LABELS_EN : DAY_LABELS_RU;
  const trackColor = isDark ? "rgba(240,238,233,0.10)" : "rgba(38,38,40,0.10)";
  const stroke = isDark ? "rgba(240,238,233,0.06)" : "rgba(38,38,40,0.08)";

  return (
    <View style={[styles.card, { backgroundColor: theme.cardGlass, borderColor: stroke, overflow: "hidden", zIndex: 0 }]}>
      <MatteGlass radius={22} />
      <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
        <Text style={[styles.titleNum, { color: theme.accentInk }]}>{streak}</Text>
        {lang === "en"
          ? ` ${streak === 1 ? "day" : "days"} on a roll`
          : ` ${pluralDaysRu(streak)} подряд в ударе`}
      </Text>
      <View style={styles.daysRow}>
        {week.map((d, i) => {
          const active = d.progress > 0;
          return (
            <View key={i} style={styles.day}>
              <Text
                style={[
                  styles.dayLabel,
                  d.isToday
                    ? { color: theme.accentInk, fontFamily: "Geologica_900Black" }
                    : { color: theme.textMuted },
                ]}
              >
                {labels[i]}
              </Text>
              <View style={styles.ringWrap}>
                <DayRing progress={d.progress} trackColor={trackColor} color={theme.accent} />
                <View style={styles.ringNumWrap}>
                  <Text
                    style={[
                      styles.ringNum,
                      { color: active || d.isToday ? theme.text : theme.textMuted },
                    ]}
                  >
                    {d.dayOfMonth}
                  </Text>
                </View>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    height: 124,
    borderRadius: 22,
    borderWidth: 2,
    paddingTop: 15,
    paddingHorizontal: 14,
  },
  title: {
    fontSize: 17,
    fontFamily: "Geologica_700Bold",
    paddingLeft: 3,
  },
  titleNum: {
    fontFamily: "Geologica_900Black",
  },
  daysRow: {
    marginTop: 12,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  day: {
    width: 40,
    height: 56,
    alignItems: "center",
  },
  dayLabel: {
    height: 15,
    fontSize: 11,
    fontFamily: "Geologica_700Bold",
    textAlign: "center",
  },
  ringWrap: {
    width: RING,
    height: RING,
    marginTop: -1,
  },
  ringNumWrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  ringNum: {
    fontSize: 16,
    lineHeight: 16,
    fontFamily: "Geologica_900Black",
    textAlign: "center",
  },
});
