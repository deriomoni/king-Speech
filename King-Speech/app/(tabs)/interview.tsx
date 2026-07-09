import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  ScrollView,
  Dimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { useLang } from "@/context/LangContext";
import { fonts } from "@/constants/colors";
import {
  ROUTES,
  REFERENCE,
  BLOCK_META,
  DIFFICULTY_LABEL,
  tx,
  type CheatRoute,
  type CheatStep,
} from "@/constants/cheatsheetData";
import CheatSheetRunner from "@/components/cheatsheet/CheatSheetRunner";

const { width: SW } = Dimensions.get("window");
const BG = "#0E0E10";
const BG2 = "#171320";
const GOLD = "#FFCF34";
const PURPLE = "#9468FB";

function haptic() {
  if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

// ── Route card ────────────────────────────────────────────────────────────────
function RouteCard({ route, lang, onPress, delay }: {
  route: CheatRoute; lang: string; onPress: () => void; delay: number;
}) {
  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(400)}>
      <Pressable onPress={onPress} style={({ pressed }) => [rc.card, pressed && { transform: [{ scale: 0.98 }] }]}>
        <LinearGradient
          colors={[route.accent + "26", "transparent"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={[rc.iconWrap, { backgroundColor: route.accent + "22", borderColor: route.accent + "55" }]}>
          <Ionicons name={route.icon} size={26} color={route.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={rc.title}>{tx(route.title, lang)}</Text>
          <Text style={rc.subtitle}>{tx(route.subtitle, lang)}</Text>
        </View>
        <View style={[rc.go, { backgroundColor: route.accent }]}>
          <Ionicons name="arrow-forward" size={18} color="#0E0E10" />
        </View>
      </Pressable>
    </Animated.View>
  );
}
const rc = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    padding: 18,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  iconWrap: { width: 56, height: 56, borderRadius: 18, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  title: { color: "#fff", fontSize: 22, fontFamily: fonts.display },
  subtitle: { color: "rgba(255,255,255,0.6)", fontSize: 14, lineHeight: 19, fontFamily: fonts.body, marginTop: 2 },
  go: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
});

// ── Reference (Полная версия) row per step ───────────────────────────────────
function RefRow({ step, lang }: { step: CheatStep; lang: string }) {
  let title = "";
  let sub = "";
  let right = "";

  switch (step.kind) {
    case "breathing":
      title = tx(step.title, lang); sub = tx(step.intro, lang); break;
    case "action":
      title = `${step.emoji}  ${tx(step.title, lang)}`; sub = step.moves.map((m) => tx(m, lang)).join(" · "); break;
    case "articulation":
      title = tx(step.title, lang); sub = step.moves.map((m) => `${m.emoji} ${tx(m.label, lang)}`).join(" · "); break;
    case "chant":
      title = tx(step.title, lang); sub = step.syllables.join(" – "); break;
    case "twister":
      title = tx(step.text, lang); sub = tx(step.sound, lang); right = tx(DIFFICULTY_LABEL[step.difficulty], lang); break;
    case "tip":
      title = tx(step.title, lang); sub = tx(step.text, lang); break;
    case "final":
      title = tx(step.title, lang); sub = tx(step.mantra, lang); break;
  }

  return (
    <View style={styles.row}>
      <View style={styles.bullet} />
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        {!!sub && <Text style={styles.rowSub}>{sub}</Text>}
      </View>
      {!!right && (
        <View style={styles.rightChip}>
          <Text style={styles.rightTxt}>{right}</Text>
        </View>
      )}
    </View>
  );
}

// ── Full reference screen ─────────────────────────────────────────────────────
function FullReference({ lang, topPad, bottomPad, onBack }: {
  lang: string; topPad: number; bottomPad: number; onBack: () => void;
}) {
  return (
    <View style={styles.root}>
      <LinearGradient colors={[BG2, BG]} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={StyleSheet.absoluteFill} />
      <View style={[styles.refTop, { paddingTop: topPad + 10 }]}>
        <Pressable onPress={onBack} hitSlop={10} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </Pressable>
        <Text style={styles.refTopTitle}>{lang === "en" ? "Full version" : "Полная версия"}</Text>
        <View style={styles.iconBtn} />
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: bottomPad + 40, gap: 22 }} showsVerticalScrollIndicator={false}>
        {REFERENCE.map((section) => {
          const meta = BLOCK_META[section.block];
          return (
            <View key={section.block} style={{ gap: 12 }}>
              <View style={styles.secHead}>
                <Ionicons name={meta.icon} size={18} color={GOLD} />
                <Text style={styles.secTitle}>{tx(meta.title, lang)}</Text>
              </View>
              <View style={styles.secCard}>
                {section.steps.map((s, i) => (
                  <React.Fragment key={s.id}>
                    {i > 0 && <View style={styles.rowDivider} />}
                    <RefRow step={s} lang={lang} />
                  </React.Fragment>
                ))}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────────
export default function CheatSheetScreen() {
  const insets = useSafeAreaInsets();
  const { lang } = useLang();
  const [activeRoute, setActiveRoute] = useState<CheatRoute | null>(null);
  const [showFull, setShowFull] = useState(false);

  if (activeRoute) {
    return (
      <CheatSheetRunner
        route={activeRoute}
        lang={lang}
        onExit={() => setActiveRoute(null)}
      />
    );
  }

  if (showFull) {
    return (
      <FullReference
        lang={lang}
        topPad={insets.top}
        bottomPad={insets.bottom}
        onBack={() => setShowFull(false)}
      />
    );
  }

  return (
    <View style={styles.root}>
      <LinearGradient colors={[BG2, BG]} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={StyleSheet.absoluteFill} />
      <View pointerEvents="none" style={[styles.glow, { backgroundColor: PURPLE + "22", top: -SW * 0.3, right: -SW * 0.3 }]} />
      <View pointerEvents="none" style={[styles.glow, { backgroundColor: GOLD + "14", bottom: -SW * 0.25, left: -SW * 0.3 }]} />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 22,
          paddingTop: insets.top + 26,
          paddingBottom: insets.bottom + 120,
          gap: 26,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <Animated.View entering={FadeIn.duration(400)} style={{ gap: 10 }}>
          <View style={styles.kickerRow}>
            <Ionicons name="flame" size={15} color={GOLD} />
            <Text style={styles.kicker}>{lang === "en" ? "EMERGENCY PREP" : "ЭКСТРЕННАЯ ПОДГОТОВКА"}</Text>
          </View>
          <Text style={styles.hero}>{lang === "en" ? "Cheat Sheet" : "Шпаргалка"}</Text>
          <Text style={styles.heroSub}>
            {lang === "en"
              ? "Little time, shaky hands? Let's settle your nerves, voice and diction — step by step."
              : "Мало времени, дрожат руки? Быстро успокоим нервы, голос и дикцию — шаг за шагом."}
          </Text>
        </Animated.View>

        {/* Question */}
        <Animated.View entering={FadeInDown.delay(80).duration(400)} style={styles.qRow}>
          <Ionicons name="time-outline" size={18} color="rgba(255,255,255,0.7)" />
          <Text style={styles.question}>{lang === "en" ? "How much time do you have?" : "Сколько у тебя времени?"}</Text>
        </Animated.View>

        <View style={{ gap: 14 }}>
          {ROUTES.map((route, i) => (
            <RouteCard
              key={route.id}
              route={route}
              lang={lang}
              delay={140 + i * 80}
              onPress={() => {
                haptic();
                setActiveRoute(route);
              }}
            />
          ))}
        </View>

        {/* Full version */}
        <Animated.View entering={FadeInDown.delay(420).duration(400)}>
          <Pressable
            onPress={() => {
              haptic();
              setShowFull(true);
            }}
            style={({ pressed }) => [styles.fullBtn, pressed && { opacity: 0.85 }]}
          >
            <Ionicons name="list-outline" size={18} color="rgba(255,255,255,0.75)" />
            <View style={{ flex: 1 }}>
              <Text style={styles.fullTitle}>{lang === "en" ? "Full version" : "Полная версия"}</Text>
              <Text style={styles.fullSub}>
                {lang === "en" ? "Browse every exercise calmly, on your own" : "Листай все упражнения сам, спокойно"}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.4)" />
          </Pressable>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  glow: { position: "absolute", width: SW, height: SW, borderRadius: SW / 2, ...(Platform.OS === "web" ? ({ filter: "blur(120px)" } as any) : { opacity: 0.45 }) },

  kickerRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  kicker: { color: GOLD, fontSize: 12, fontFamily: fonts.bodyBold, letterSpacing: 2 },
  hero: { color: "#fff", fontSize: 40, fontFamily: fonts.display, lineHeight: 46 },
  heroSub: { color: "rgba(255,255,255,0.66)", fontSize: 16, lineHeight: 23, fontFamily: fonts.body },

  qRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  question: { color: "rgba(255,255,255,0.85)", fontSize: 17, fontFamily: fonts.bodyBold },

  fullBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  fullTitle: { color: "#fff", fontSize: 16, fontFamily: fonts.bodyBold },
  fullSub: { color: "rgba(255,255,255,0.5)", fontSize: 13, fontFamily: fonts.body, marginTop: 1 },

  // full reference
  refTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 14 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.08)" },
  refTopTitle: { color: "#fff", fontSize: 18, fontFamily: fonts.serifBold },
  secHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  secTitle: { color: "#fff", fontSize: 18, fontFamily: fonts.serifBold },
  secCard: { backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 20, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", padding: 16 },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  bullet: { width: 8, height: 8, borderRadius: 4, backgroundColor: PURPLE, marginTop: 6 },
  rowTitle: { color: "rgba(255,255,255,0.92)", fontSize: 15, lineHeight: 21, fontFamily: fonts.bodySemibold },
  rowSub: { color: "rgba(255,255,255,0.55)", fontSize: 13, lineHeight: 18, fontFamily: fonts.body, marginTop: 2 },
  rowDivider: { height: 1, backgroundColor: "rgba(255,255,255,0.06)", marginVertical: 12 },
  rightChip: { backgroundColor: "rgba(255,207,52,0.14)", borderWidth: 1, borderColor: "rgba(255,207,52,0.3)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  rightTxt: { color: GOLD, fontSize: 12, fontFamily: fonts.bodyBold },
});
