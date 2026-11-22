// «Королевские манеры» quiz: a situation, three ways to act, then the right
// answer with the reason why. Used full-screen by the mode (with a result
// screen) and embedded in Path levels / quick prep (questions only).
import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, Platform } from "react-native";
import Animated, { FadeIn, FadeInDown, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "@/lib/haptics";
import NextChevron from "@/components/NextChevron";
import { useAppColors } from "@/hooks/useAppColors";
import { colors as brand } from "@/theme/tokens";
import { fonts } from "@/constants/colors";
import { pickLang, type Lang } from "@/context/LangContext";
import { rs } from "@/lib/responsive";
import { type MannersRule, tl } from "@/constants/mannersData";
import { recordMannersAnswer } from "@/lib/mannersProgress";

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

// ── one answer option ─────────────────────────────────────────────────────────
function Option({
  letter,
  text,
  state,
  onPress,
  disabled,
}: {
  letter: string;
  text: string;
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
    state === "right" ? GOOD + (isDark ? "26" : "22") : state === "wrong" ? BAD + (isDark ? "22" : "1C") : theme.card;
  return (
    <Animated.View style={[anim, { opacity: state === "dim" ? 0.45 : 1 }]}>
      <Pressable
        disabled={disabled}
        onPress={onPress}
        onPressIn={() => (scale.value = withSpring(0.97, { damping: 18, stiffness: 340 }))}
        // settle back to 1 without overshooting past full size
        onPressOut={() => (scale.value = withSpring(1, { damping: 16, stiffness: 300, overshootClamping: true }))}
        style={[
          styles.option,
          { backgroundColor: bg, borderColor: tint ?? "transparent" },
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
            <Ionicons name="checkmark" size={rs(16)} color="#FFFFFF" />
          ) : state === "wrong" ? (
            <Ionicons name="close" size={rs(16)} color="#FFFFFF" />
          ) : (
            <Text style={[styles.badgeTxt, { color: theme.textSecondary }]}>{letter}</Text>
          )}
        </View>
        <Text style={[styles.optionTxt, { color: theme.text }]}>{text}</Text>
      </Pressable>
    </Animated.View>
  );
}

// ── one question ──────────────────────────────────────────────────────────────
export function MannersQuestion({
  rule,
  lang,
  onAnswered,
}: {
  rule: MannersRule;
  lang: Lang;
  onAnswered: (correct: boolean) => void;
}) {
  const { theme } = useAppColors();
  const order = useMemo(() => shuffledOrder(rule.options.length), [rule.id]);
  const [picked, setPicked] = useState<number | null>(null);
  const answered = picked !== null;
  const isRight = picked === rule.correct;

  const pick = (i: number) => {
    if (answered) return;
    setPicked(i);
    const ok = i === rule.correct;
    recordMannersAnswer(rule.id, ok);
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(ok ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error).catch(() => {});
    }
    onAnswered(ok);
  };

  return (
    <View style={styles.q}>
      <Text style={[styles.kicker, { color: theme.textMuted }]}>
        {pickLang(lang, { ru: "Как ты поступишь?", en: "What would you do?", kk: "Сіз не істейсіз?" })}
      </Text>
      <Text style={[styles.question, { color: theme.text }]}>{tl(rule.question, lang)}</Text>

      <View style={styles.options}>
        {order.map((oi, k) => {
          const state: "idle" | "right" | "wrong" | "missed" | "dim" = !answered
            ? "idle"
            : oi === picked
              ? oi === rule.correct
                ? "right"
                : "wrong"
              : oi === rule.correct
                ? "missed"
                : "dim";
          return (
            <Animated.View key={oi} entering={FadeInDown.duration(320).delay(80 + k * 70)}>
              <Option letter={LETTERS[k]} text={tl(rule.options[oi], lang)} state={state} disabled={answered} onPress={() => pick(oi)} />
            </Animated.View>
          );
        })}
      </View>

      {answered && (
        <Animated.View entering={FadeInDown.duration(360)} style={[styles.reveal, { backgroundColor: theme.card }]}>
          <View style={styles.revealHead}>
            <View style={[styles.revealIcon, { backgroundColor: (isRight ? GOOD : BAD) + "26" }]}>
              <Ionicons name={isRight ? "checkmark-circle" : "information-circle"} size={rs(20)} color={isRight ? GOOD : BAD} />
            </View>
            <Text style={[styles.revealTitle, { color: isRight ? GOOD : BAD }]}>
              {isRight
                ? pickLang(lang, { ru: "Верно!", en: "Correct!", kk: "Дұрыс!" })
                : pickLang(lang, { ru: "Не совсем", en: "Not quite", kk: "Толық емес" })}
            </Text>
          </View>
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
      {!embedded && (
        <View style={[styles.top, { paddingTop: topPad + rs(10) }]}>
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
  kicker: { fontSize: 13, fontFamily: fonts.bodySemibold, letterSpacing: 0.2 },
  question: { fontSize: 25, lineHeight: 32, fontFamily: fonts.display, marginTop: 10, letterSpacing: -0.3 },
  options: { gap: 10, marginTop: 26 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  badge: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  badgeTxt: { fontSize: 13, fontFamily: fonts.bodyBold },
  optionTxt: { flex: 1, fontSize: 16, lineHeight: 22, fontFamily: fonts.body },

  reveal: { marginTop: 18, borderRadius: 22, padding: 18 },
  revealHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  revealIcon: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
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
