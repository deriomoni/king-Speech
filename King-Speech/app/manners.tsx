// «Королевские манеры» — the etiquette mode (replaced «Роли»).
// Home with two tabs: «Квиз» (start a round of situations) and «Мой опыт»
// (rules the player has gone through). A round = 5 situations → result.
import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useAppColors } from "@/hooks/useAppColors";
import { useLang, pickLang, type Lang } from "@/context/LangContext";
import { colors as brand } from "@/theme/tokens";
import { fonts } from "@/constants/colors";
import { rs } from "@/lib/responsive";
import { MANNERS_RULES, MANNERS_TOTAL, pickMannersRound, tl, type MannersRule } from "@/constants/mannersData";
import { useMannersProgress } from "@/lib/mannersProgress";
import MannersQuiz, { MannersButton, type MannersResult } from "@/components/manners/MannersQuiz";
import MannersMark from "@/components/manners/MannersMark";

const ROUND = 5;
type Tab = "quiz" | "mine";
type Phase = { kind: "home" } | { kind: "quiz"; rules: MannersRule[] } | { kind: "result"; results: MannersResult[] };

export default function MannersScreen() {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useAppColors();
  const { lang } = useLang();
  const progress = useMannersProgress();
  const [tab, setTab] = useState<Tab>("quiz");
  const [phase, setPhase] = useState<Phase>({ kind: "home" });

  const seenIds = useMemo(() => Object.keys(progress), [progress]);
  const passed = seenIds.length;

  const start = () => setPhase({ kind: "quiz", rules: pickMannersRound(ROUND, seenIds) });
  const back = () => (router.canGoBack() ? router.back() : router.replace("/(tabs)/showtime"));

  if (phase.kind === "quiz") {
    return (
      <View style={[styles.root, { backgroundColor: theme.bg }]}>
        <MannersQuiz
          rules={phase.rules}
          lang={lang}
          topPad={insets.top}
          bottomPad={insets.bottom}
          onClose={() => setPhase({ kind: "home" })}
          finishLabel={pickLang(lang, { ru: "К итогам", en: "See results", kk: "Нәтижеге" })}
          onFinish={(results) => setPhase({ kind: "result", results })}
        />
      </View>
    );
  }

  if (phase.kind === "result") {
    return (
      <Result
        results={phase.results}
        lang={lang}
        topPad={insets.top}
        bottomPad={insets.bottom}
        onAgain={start}
        onMine={() => {
          setTab("mine");
          setPhase({ kind: "home" });
        }}
      />
    );
  }

  const soft = isDark ? "rgba(240,238,233,0.08)" : "rgba(38,38,40,0.06)";

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      <View style={[styles.topBar, { paddingTop: insets.top + rs(10) }]}>
        <Pressable onPress={back} hitSlop={10} style={[styles.iconBtn, { backgroundColor: soft }]} accessibilityRole="button">
          <Ionicons name="chevron-back" size={rs(22)} color={theme.text} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + rs(40) }]} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.duration(360)}>
          <Text style={[styles.title, { color: theme.text }]}>
            {pickLang(lang, { ru: "Королевские\nманеры", en: "Royal\nmanners", kk: "Корольдік\nәдеп" })}
          </Text>
          <Text style={[styles.sub, { color: theme.textSecondary }]}>
            {pickLang(lang, {
              ru: "Как держаться достойно: приветствие, разговор, субординация.",
              en: "How to carry yourself: greetings, conversation, rank.",
              kk: "Өзіңді лайықты ұстау: сәлемдесу, әңгіме, бағыныштылық.",
            })}
          </Text>
        </Animated.View>

        {/* tabs */}
        <Animated.View entering={FadeInDown.duration(360).delay(60)} style={[styles.tabs, { backgroundColor: soft }]}>
          {(["quiz", "mine"] as Tab[]).map((t) => {
            const on = tab === t;
            return (
              <Pressable
                key={t}
                onPress={() => setTab(t)}
                style={[styles.tab, on && { backgroundColor: isDark ? theme.cardElevated : "#FFFFFF" }]}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
              >
                <Text style={[styles.tabTxt, { color: on ? theme.text : theme.textMuted }]}>
                  {t === "quiz"
                    ? pickLang(lang, { ru: "Квиз", en: "Quiz", kk: "Квиз" })
                    : pickLang(lang, { ru: "Мой опыт", en: "My experience", kk: "Тәжірибем" })}
                </Text>
                {t === "mine" && passed > 0 && (
                  <View style={[styles.tabCount, { backgroundColor: theme.accent }]}>
                    <Text style={[styles.tabCountTxt, { color: theme.accentText }]}>{passed}</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </Animated.View>

        {tab === "quiz" ? (
          <Animated.View key="quiz" entering={FadeIn.duration(260)}>
            <View style={[styles.hero, { backgroundColor: theme.card }]}>
              <View style={[styles.crownWrap, { backgroundColor: theme.accentDim }]}>
                <MannersMark height={rs(36)} color={isDark ? theme.accent : "#262628"} />
              </View>
              <Text style={[styles.heroTitle, { color: theme.text }]}>
                {pickLang(lang, { ru: `Раунд из ${ROUND} ситуаций`, en: `A round of ${ROUND} situations`, kk: `${ROUND} жағдайдан тұратын раунд` })}
              </Text>
              <Text style={[styles.heroText, { color: theme.textSecondary }]}>
                {pickLang(lang, {
                  ru: "Выбери, как поступишь, — и сразу узнай, как правильно и почему.",
                  en: "Choose what you'd do — then see the right way and why.",
                  kk: "Қалай әрекет етеріңізді таңдаңыз — дұрысын және себебін бірден біліңіз.",
                })}
              </Text>

              {/* every rule is one tick; passed ones light up */}
              <View style={styles.ticks}>
                {MANNERS_RULES.map((r, i) => (
                  <View
                    key={r.id}
                    style={[
                      styles.tick,
                      { backgroundColor: i < passed ? theme.accent : isDark ? "rgba(240,238,233,0.10)" : "rgba(38,38,40,0.08)" },
                    ]}
                  />
                ))}
              </View>
              <Text style={[styles.tickCaption, { color: theme.textMuted }]}>
                {pickLang(lang, {
                  ru: `Пройдено правил: ${passed} из ${MANNERS_TOTAL}`,
                  en: `Rules passed: ${passed} of ${MANNERS_TOTAL}`,
                  kk: `Өтілген ережелер: ${MANNERS_TOTAL}-тен ${passed}`,
                })}
              </Text>

              <View style={{ marginTop: rs(22) }}>
                <MannersButton
                  label={
                    passed > 0
                      ? pickLang(lang, { ru: "Новый раунд", en: "New round", kk: "Жаңа раунд" })
                      : pickLang(lang, { ru: "Начать квиз", en: "Start the quiz", kk: "Квизді бастау" })
                  }
                  onPress={start}
                />
              </View>
            </View>
          </Animated.View>
        ) : (
          <Animated.View key="mine" entering={FadeIn.duration(260)} style={styles.mine}>
            {passed === 0 ? (
              <View style={[styles.empty, { backgroundColor: theme.card }]}>
                <Ionicons name="book-outline" size={rs(26)} color={theme.textMuted} />
                <Text style={[styles.emptyTxt, { color: theme.textSecondary }]}>
                  {pickLang(lang, {
                    ru: "Пока пусто. Пройди квиз — здесь соберутся правила, которые ты узнал.",
                    en: "Nothing yet. Take the quiz — the rules you learn will gather here.",
                    kk: "Әзірге бос. Квизден өтіңіз — үйренген ережелеріңіз осында жиналады.",
                  })}
                </Text>
              </View>
            ) : (
              MANNERS_RULES.filter((r) => progress[r.id])
                .sort((a, b) => progress[b.id].at - progress[a.id].at)
                .map((r, i) => <RuleCard key={r.id} rule={r} lang={lang} correct={progress[r.id].correct} delay={i * 50} />)
            )}
            {passed > 0 && passed < MANNERS_TOTAL && (
              <Text style={[styles.more, { color: theme.textMuted }]}>
                {pickLang(lang, {
                  ru: `Ещё ${MANNERS_TOTAL - passed} правил ждут тебя в квизе`,
                  en: `${MANNERS_TOTAL - passed} more rules are waiting in the quiz`,
                  kk: `Квизде тағы ${MANNERS_TOTAL - passed} ереже күтіп тұр`,
                })}
              </Text>
            )}
          </Animated.View>
        )}
      </ScrollView>
    </View>
  );
}

function RuleCard({ rule, lang, correct, delay }: { rule: MannersRule; lang: Lang; correct: boolean; delay: number }) {
  const { theme } = useAppColors();
  return (
    <Animated.View entering={FadeInDown.duration(320).delay(delay)} style={[styles.rule, { backgroundColor: theme.card }]}>
      <View style={[styles.ruleIcon, { backgroundColor: correct ? theme.accentDim : brand.error + "22" }]}>
        <Ionicons name={rule.icon} size={rs(20)} color={correct ? (theme.mode === "dark" ? theme.accent : "#262628") : brand.error} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.ruleTitle, { color: theme.text }]}>{tl(rule.title, lang)}</Text>
        <Text style={[styles.ruleText, { color: theme.textSecondary }]}>{tl(rule.rule, lang)}</Text>
        {!correct && (
          <Text style={[styles.ruleRetry, { color: brand.error }]}>
            {pickLang(lang, { ru: "Стоит повторить", en: "Worth revisiting", kk: "Қайталаған жөн" })}
          </Text>
        )}
      </View>
    </Animated.View>
  );
}

function Result({
  results,
  lang,
  topPad,
  bottomPad,
  onAgain,
  onMine,
}: {
  results: MannersResult[];
  lang: Lang;
  topPad: number;
  bottomPad: number;
  onAgain: () => void;
  onMine: () => void;
}) {
  const { theme } = useAppColors();
  const right = results.filter((r) => r?.correct).length;
  const total = results.length;
  const verdict =
    right === total
      ? pickLang(lang, { ru: "Безупречно. Манеры короля.", en: "Flawless. Royal manners.", kk: "Мінсіз. Король әдебі." })
      : right >= total - 1
        ? pickLang(lang, { ru: "Почти безупречно.", en: "Nearly flawless.", kk: "Мінсіз дерлік." })
        : pickLang(lang, { ru: "Хорошее начало — правила уже в «Моём опыте».", en: "Good start — the rules are in “My experience”.", kk: "Жақсы бастама — ережелер «Тәжірибем» бөлімінде." });
  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: topPad + rs(48), paddingBottom: rs(24) }]} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.duration(380)}>
          <Text style={[styles.resKicker, { color: theme.textMuted }]}>
            {pickLang(lang, { ru: "Итог раунда", en: "Round result", kk: "Раунд қорытындысы" })}
          </Text>
          <Text style={[styles.resScore, { color: theme.text }]}>
            {right}
            <Text style={{ color: theme.textMuted }}> / {total}</Text>
          </Text>
          <Text style={[styles.resVerdict, { color: theme.textSecondary }]}>{verdict}</Text>
        </Animated.View>
        <View style={styles.resList}>
          {results.map((r, i) => {
            const rule = MANNERS_RULES.find((x) => x.id === r.id);
            if (!rule) return null;
            return (
              <Animated.View key={r.id} entering={FadeInDown.duration(320).delay(120 + i * 60)} style={[styles.resRow, { backgroundColor: theme.card }]}>
                <Ionicons name={r.correct ? "checkmark-circle" : "close-circle"} size={rs(22)} color={r.correct ? brand.success : brand.error} />
                <Text style={[styles.resRowTxt, { color: theme.text }]}>{tl(rule.title, lang)}</Text>
              </Animated.View>
            );
          })}
        </View>
      </ScrollView>
      <View style={[styles.resFooter, { paddingBottom: Math.max(bottomPad, rs(16)) + rs(12) }]}>
        <MannersButton label={pickLang(lang, { ru: "Ещё раунд", en: "Another round", kk: "Тағы раунд" })} onPress={onAgain} />
        <MannersButton label={pickLang(lang, { ru: "Мой опыт", en: "My experience", kk: "Тәжірибем" })} onPress={onMine} chevron={false} secondary />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: { paddingHorizontal: 16, paddingBottom: 4, flexDirection: "row" },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  scroll: { paddingHorizontal: 20, paddingTop: 12 },

  title: { fontSize: 38, lineHeight: 42, fontFamily: "Geologica_800ExtraBold", letterSpacing: -0.8 },
  sub: { fontSize: 15, lineHeight: 22, fontFamily: fonts.body, marginTop: 10, maxWidth: 320 },

  tabs: { flexDirection: "row", borderRadius: 18, padding: 4, marginTop: 26 },
  tab: { flex: 1, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6 },
  tabTxt: { fontSize: 15, fontFamily: fonts.bodySemibold },
  tabCount: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6, alignItems: "center", justifyContent: "center" },
  tabCountTxt: { fontSize: 11, fontFamily: fonts.bodyBold },

  hero: { marginTop: 16, borderRadius: 28, padding: 22 },
  crownWrap: { width: 64, height: 64, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  heroTitle: { fontSize: 22, lineHeight: 28, fontFamily: fonts.display, marginTop: 18 },
  heroText: { fontSize: 15, lineHeight: 22, fontFamily: fonts.body, marginTop: 6 },
  ticks: { flexDirection: "row", gap: 4, marginTop: 22 },
  tick: { flex: 1, height: 8, borderRadius: 4 },
  tickCaption: { fontSize: 13, fontFamily: fonts.bodySemibold, marginTop: 10 },

  mine: { marginTop: 16, gap: 10 },
  empty: { borderRadius: 24, padding: 22, alignItems: "center", gap: 12 },
  emptyTxt: { fontSize: 15, lineHeight: 22, fontFamily: fonts.body, textAlign: "center" },
  rule: { flexDirection: "row", gap: 14, borderRadius: 22, padding: 16 },
  ruleIcon: { width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  ruleTitle: { fontSize: 16, lineHeight: 21, fontFamily: fonts.display },
  ruleText: { fontSize: 14, lineHeight: 20, fontFamily: fonts.body, marginTop: 4 },
  ruleRetry: { fontSize: 12, fontFamily: fonts.bodySemibold, marginTop: 8 },
  more: { fontSize: 13, fontFamily: fonts.body, textAlign: "center", marginTop: 10 },

  resKicker: { fontSize: 14, fontFamily: fonts.bodySemibold },
  resScore: { fontSize: 72, lineHeight: 80, fontFamily: "Geologica_800ExtraBold", letterSpacing: -2, marginTop: 6 },
  resVerdict: { fontSize: 17, lineHeight: 24, fontFamily: fonts.body, marginTop: 4, maxWidth: 320 },
  resList: { marginTop: 30, gap: 8 },
  resRow: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 18, paddingVertical: 14, paddingHorizontal: 16 },
  resRowTxt: { flex: 1, fontSize: 15, fontFamily: fonts.bodySemibold },
  resFooter: { paddingHorizontal: 20, paddingTop: 8, gap: 10 },
});
