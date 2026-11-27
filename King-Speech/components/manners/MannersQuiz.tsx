// «Королевские манеры» quiz: a situation, three ways to act, then the right
// answer with the reason why. Used full-screen by the mode (with a result
// screen) and embedded in Path levels / quick prep (questions only).
import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, Platform } from "react-native";
import Animated, { Easing, FadeIn, FadeInDown, cancelAnimation, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Path } from "react-native-svg";
import * as Haptics from "@/lib/haptics";
import NextChevron from "@/components/NextChevron";
import { useAppColors } from "@/hooks/useAppColors";
import { colors as brand } from "@/theme/tokens";
import { fonts } from "@/constants/colors";
import { pickLang, type Lang } from "@/context/LangContext";
import { rs } from "@/lib/responsive";
import { type MannersRule, correctIndexes, isCorrectOption, tl } from "@/constants/mannersData";
import { recordMannersAnswer } from "@/lib/mannersProgress";
import { useGame } from "@/context/GameContext";

export type MannersResult = { id: string; correct: boolean };

const GOOD = brand.success;
const BAD = brand.error;
const LETTERS = ["A", "B", "C", "D"];

function shuffledOrder(n: number): number[] {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── check / cross marks ───────────────────────────────────────────────────────
// Drawn by hand (not icon-font glyphs) so the stroke can be a touch heavier.
export function AnswerMark({ kind, size, color }: { kind: "check" | "cross"; size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d={kind === "check" ? "M5 12.5l4.6 4.6L19 7.5" : "M6.5 6.5l11 11M17.5 6.5l-11 11"}
        stroke={color}
        strokeWidth={3.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

// ── one answer option ─────────────────────────────────────────────────────────
function Option({
  letter,
  text,
  state,
  onPress,
  disabled,
  note,
}: {
  letter: string;
  text: string;
  /** Shown under the text once the question is answered. */
  note?: string;
  state: "idle" | "right" | "wrong" | "missed" | "dim";
  onPress: () => void;
  disabled: boolean;
}) {
  const { theme, isDark } = useAppColors();
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const tint =
    state === "right" || state === "missed" ? GOOD : state === "wrong" ? BAD : null;
  const bg =
    state === "right" || state === "missed" ? GOOD + (isDark ? "26" : "22") : state === "wrong" ? BAD + (isDark ? "22" : "1C") : theme.card;
  return (
    <Animated.View style={[anim, { opacity: state === "dim" ? (note ? 0.7 : 0.45) : 1 }]}>
      <Pressable
        disabled={disabled}
        onPress={onPress}
        onPressIn={() => (scale.value = withSpring(0.97, { damping: 18, stiffness: 340 }))}
        // settle back to 1 without overshooting past full size
        onPressOut={() => (scale.value = withSpring(1, { damping: 16, stiffness: 300, overshootClamping: true }))}
        style={[
          styles.option,
          { backgroundColor: bg },
        ]}
        accessibilityRole="button"
      >
        <View
          style={[
            styles.badge,
            { backgroundColor: tint ?? (isDark ? "rgba(240,238,233,0.08)" : "rgba(38,38,40,0.06)") },
          ]}
        >
          {state === "right" || state === "missed" ? (
            <AnswerMark kind="check" size={rs(17)} color="#FFFFFF" />
          ) : state === "wrong" ? (
            <AnswerMark kind="cross" size={rs(17)} color="#FFFFFF" />
          ) : (
            <Text style={[styles.badgeTxt, { color: theme.textSecondary }]}>{letter}</Text>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.optionTxt, { color: theme.text }]}>{text}</Text>
          {note ? (
            <Animated.Text entering={FadeIn.duration(300)} style={[styles.optionNote, { color: theme.textSecondary }]}>
              {note}
            </Animated.Text>
          ) : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ── one question ──────────────────────────────────────────────────────────────
export function MannersQuestion({
  rule,
  lang,
  onAnswered,
  countsForStreak = true,
  timed = false,
}: {
  rule: MannersRule;
  lang: Lang;
  onAnswered: (correct: boolean) => void;
  /** One «В ударе» point per answer; off inside Path levels (the level counts). */
  countsForStreak?: boolean;
  /** Decide-fast mode: a time bar; when it runs out the question counts as missed. */
  timed?: boolean;
}) {
  const { logActivity } = useGame();
  const { theme, isDark } = useAppColors();
  const order = useMemo(() => shuffledOrder(rule.options.length), [rule.id]);
  // -1 = time ran out
  const [picked, setPicked] = useState<number | null>(null);
  const answered = picked !== null;
  const timedOut = picked === -1;
  const isRight = picked !== null && picked >= 0 && isCorrectOption(rule, picked);
  const multi = correctIndexes(rule).length > 1;

  // Time to decide: enough to read the situation and the options, never a race.
  const seconds = useMemo(() => {
    const chars = tl(rule.question, lang).length + rule.options.reduce((n, o) => n + tl(o, lang).length, 0);
    return Math.round(Math.min(32, Math.max(14, 8 + chars / 22)));
  }, [rule.id, lang]); // eslint-disable-line react-hooks/exhaustive-deps
  const left = useSharedValue(1);
  const barStyle = useAnimatedStyle(() => ({ width: `${left.value * 100}%` }));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pickRef = useRef<(i: number) => void>(() => {});
  useEffect(() => {
    if (!timed) return;
    left.value = 1;
    left.value = withTiming(0, { duration: seconds * 1000, easing: Easing.linear });
    timer.current = setTimeout(() => pickRef.current(-1), seconds * 1000);
    return () => {
      if (timer.current) clearTimeout(timer.current);
      cancelAnimation(left);
    };
  }, [rule.id, timed]); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (i: number) => {
    if (answered) return;
    if (timer.current) clearTimeout(timer.current);
    cancelAnimation(left);
    setPicked(i);
    const ok = i >= 0 && isCorrectOption(rule, i);
    recordMannersAnswer(rule.id, ok);
    if (countsForStreak) logActivity("other");
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(ok ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error).catch(() => {});
    }
    onAnswered(ok);
  };
  pickRef.current = pick;

  return (
    <View style={styles.q}>
      <View style={styles.kickerRow}>
        <Text style={[styles.kicker, { color: theme.textMuted }]}>
          {pickLang(lang, { ru: "Как ты поступишь?", en: "What would you do?", kk: "Сен не істейсің?" })}
        </Text>
      </View>
      {timed && (
        <View style={[styles.timeTrack, { backgroundColor: isDark ? "rgba(240,238,233,0.08)" : "rgba(38,38,40,0.07)", opacity: answered ? 0 : 1 }]}>
          <Animated.View style={[styles.timeBar, { backgroundColor: theme.cta }, barStyle]} />
        </View>
      )}
      <Text style={[styles.question, { color: theme.text }]}>{tl(rule.question, lang)}</Text>

      <View style={styles.options}>
        {order.map((oi, k) => {
          const good = isCorrectOption(rule, oi);
          const state: "idle" | "right" | "wrong" | "missed" | "dim" = !answered
            ? "idle"
            : oi === picked
              ? good
                ? "right"
                : "wrong"
              : good
                ? "missed"
                : "dim";
          return (
            <Animated.View key={oi} entering={FadeInDown.duration(320).delay(80 + k * 70)}>
              <Option
                letter={LETTERS[k]}
                text={tl(rule.options[oi], lang)}
                note={answered && rule.notes?.[oi] ? tl(rule.notes[oi], lang) : undefined}
                state={state}
                disabled={answered}
                onPress={() => pick(oi)}
              />
            </Animated.View>
          );
        })}
      </View>

      {answered && (
        <Animated.View entering={FadeInDown.duration(360)} style={[styles.reveal, { backgroundColor: theme.card }]}>
          <View style={styles.revealHead}>
            <AnswerMark kind={isRight ? "check" : "cross"} size={rs(22)} color={isRight ? GOOD : BAD} />
            <Text style={[styles.revealTitle, { color: isRight ? GOOD : BAD }]}>
              {timedOut
                ? pickLang(lang, { ru: "Время вышло", en: "Time's up", kk: "Уақыт бітті" })
                : isRight
                  ? pickLang(lang, { ru: "Верно!", en: "Correct!", kk: "Дұрыс!" })
                  : pickLang(lang, { ru: "Не совсем", en: "Not quite", kk: "Толық емес" })}
            </Text>
          </View>
          {multi && (
            <Text style={[styles.multiNote, { color: theme.textSecondary }]}>
              {pickLang(lang, {
                ru: "Здесь подходит больше одного варианта — все верные отмечены.",
                en: "More than one answer works here — all the good ones are marked.",
                kk: "Мұнда бірнеше нұсқа дұрыс — барлығы белгіленген.",
              })}
            </Text>
          )}
          <Text style={[styles.ruleTitle, { color: theme.text }]}>{tl(rule.title, lang)}</Text>
          <Text style={[styles.why, { color: theme.textSecondary }]}>{tl(rule.why, lang)}</Text>
        </Animated.View>
      )}
    </View>
  );
}

// ── gold CTA ──────────────────────────────────────────────────────────────────
export function MannersButton({
  label,
  onPress,
  chevron = true,
  secondary = false,
}: {
  label: string;
  onPress: () => void;
  chevron?: boolean;
  secondary?: boolean;
}) {
  const { theme } = useAppColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.cta,
        { backgroundColor: secondary ? theme.btnSecondary : theme.cta, opacity: pressed ? 0.88 : 1 },
      ]}
      accessibilityRole="button"
    >
      <Text style={[styles.ctaTxt, { color: secondary ? theme.btnSecondaryText : theme.ctaText }]}>{label}</Text>
      {chevron && <NextChevron size={rs(15)} color={secondary ? theme.btnSecondaryText : theme.ctaText} />}
    </Pressable>
  );
}

// ── the quiz ──────────────────────────────────────────────────────────────────
export default function MannersQuiz({
  rules,
  lang,
  onFinish,
  onClose,
  embedded = false,
  bottomPad = 0,
  topPad = 0,
  finishLabel,
}: {
  rules: MannersRule[];
  lang: Lang;
  /** Called after the last question («Дальше» on it). */
  onFinish: (results: MannersResult[]) => void;
  /** Full variant only: the close button. */
  onClose?: () => void;
  /** Embedded in another flow: no top bar, the parent owns the chrome. */
  embedded?: boolean;
  bottomPad?: number;
  topPad?: number;
  finishLabel?: string;
}) {
  const { theme, isDark } = useAppColors();
  const [idx, setIdx] = useState(0);
  const [results, setResults] = useState<MannersResult[]>([]);
  const [answered, setAnswered] = useState(false);
  const rule = rules[idx];
  const last = idx >= rules.length - 1;

  const next = () => {
    if (last) {
      onFinish(results);
      return;
    }
    setAnswered(false);
    setIdx((i) => i + 1);
  };

  return (
    <View style={styles.root}>
      {/* progress: always in the full quiz; embedded only when there's more than one question */}
      {(!embedded || rules.length > 1) && (
        <View style={[styles.top, { paddingTop: embedded ? rs(12) : topPad + rs(10) }]}>
          <View style={styles.segs}>
            {rules.map((r, i) => {
              const res = results[i];
              const color = res ? (res.correct ? GOOD : BAD) : i === idx ? theme.text : isDark ? "rgba(240,238,233,0.12)" : "rgba(38,38,40,0.10)";
              return <View key={r.id} style={[styles.seg, { backgroundColor: color }]} />;
            })}
          </View>
          <Text style={[styles.count, { color: theme.textMuted }]}>
            {idx + 1} / {rules.length}
          </Text>
          {onClose && (
            <Pressable
              onPress={onClose}
              hitSlop={10}
              style={[styles.close, { backgroundColor: isDark ? "rgba(240,238,233,0.08)" : "rgba(38,38,40,0.06)" }]}
              accessibilityRole="button"
              accessibilityLabel={pickLang(lang, { ru: "Закрыть", en: "Close", kk: "Жабу" })}
            >
              <Ionicons name="close" size={rs(20)} color={theme.text} />
            </Pressable>
          )}
        </View>
      )}

      <ScrollView
        key={rule.id}
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scroll, embedded && { paddingTop: rs(8) }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeIn.duration(280)}>
          <MannersQuestion
            rule={rule}
            lang={lang}
            countsForStreak={!embedded}
            timed={!embedded}
            onAnswered={(ok) => {
              setAnswered(true);
              setResults((r) => {
                const n = [...r];
                n[idx] = { id: rule.id, correct: ok };
                return n;
              });
            }}
          />
        </Animated.View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(bottomPad, rs(16)) + rs(12) }]}>
        {answered ? (
          <Animated.View entering={FadeInDown.duration(260)}>
            <MannersButton
              label={
                last
                  ? finishLabel ?? pickLang(lang, { ru: "Готово", en: "Done", kk: "Дайын" })
                  : pickLang(lang, { ru: "Дальше", en: "Next", kk: "Әрі қарай" })
              }
              onPress={next}
            />
          </Animated.View>
        ) : (
          <Text style={[styles.hint, { color: theme.textMuted }]}>
            {pickLang(lang, { ru: "Выбери один вариант", en: "Pick one answer", kk: "Бір нұсқаны таңдаңыз" })}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  top: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingBottom: 8 },
  segs: { flex: 1, flexDirection: "row", gap: 6 },
  seg: { flex: 1, height: 6, borderRadius: 3 },
  count: { fontSize: 13, fontFamily: fonts.bodySemibold, fontVariant: ["tabular-nums"] },
  close: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },

  scroll: { paddingHorizontal: 22, paddingTop: 22, paddingBottom: 24 },
  q: { gap: 0 },
  kickerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  kicker: { fontSize: 13, fontFamily: fonts.bodySemibold, letterSpacing: 0.2 },
  timeTrack: { height: 4, borderRadius: 2, marginTop: 12, overflow: "hidden" },
  timeBar: { height: 4, borderRadius: 2 },
  multiNote: { fontSize: 14, lineHeight: 20, fontFamily: fonts.body, marginTop: 10 },
  question: { fontSize: 25, lineHeight: 32, fontFamily: fonts.display, marginTop: 10, letterSpacing: -0.3 },
  options: { gap: 10, marginTop: 26 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  badge: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  badgeTxt: { fontSize: 13, fontFamily: fonts.bodyBold },
  optionTxt: { fontSize: 16, lineHeight: 22, fontFamily: fonts.body },
  optionNote: { fontSize: 13, lineHeight: 18, fontFamily: fonts.body, marginTop: 4 },

  reveal: { marginTop: 18, borderRadius: 22, padding: 18 },
  revealHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  revealTitle: { fontSize: 17, fontFamily: fonts.bodyBold },
  ruleTitle: { fontSize: 17, lineHeight: 23, fontFamily: fonts.display, marginTop: 14 },
  why: { fontSize: 15, lineHeight: 22, fontFamily: fonts.body, marginTop: 6 },

  footer: { paddingHorizontal: 20, paddingTop: 8, minHeight: 84, justifyContent: "flex-end" },
  hint: { fontSize: 14, fontFamily: fonts.body, textAlign: "center", paddingBottom: 18 },
  cta: {
    height: 56,
    borderRadius: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  ctaTxt: { fontSize: 17, fontFamily: fonts.bodyBold },
});
