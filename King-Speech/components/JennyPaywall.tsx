import React from "react";
import {
  View,
  Text,
  Image,
  Pressable,
  StyleSheet,
  Platform,
  Dimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";

const jennyHero = require("@/assets/jenny/jenny_smiling.png");
const { height: SH } = Dimensions.get("window");

const GOLD = "#F5C451";
const BG_TOP = "#140B2E";
const BG_BOT = "#0A0F28";

type Lang = "ru" | "en";

const COPY: Record<Lang, {
  badge: string;
  title: string;
  subtitle: string;
  benefits: { icon: keyof typeof Ionicons.glyphMap; title: string; desc: string }[];
  cta: string;
  note: string;
  dev: string;
  close: string;
}> = {
  ru: {
    badge: "PREMIUM",
    title: "Интервью с Дженни",
    subtitle: "Живой разговор с ИИ-интервьюером, который слушает и отвечает голосом.",
    benefits: [
      { icon: "mic", title: "Живой голос", desc: "Дженни говорит как человек, а не робот" },
      { icon: "sparkles", title: "Умные вопросы", desc: "Настоящая беседа — она слышит твои ответы" },
      { icon: "stats-chart", title: "Разбор речи", desc: "Оценка по ораторским стандартам" },
    ],
    cta: "Открыть Premium",
    note: "Оплата за интервью — без подписки впустую",
    dev: "Разблокировать для теста",
    close: "Позже",
  },
  en: {
    badge: "PREMIUM",
    title: "Interview with Jenny",
    subtitle: "A living conversation with an AI interviewer who listens and replies with a real voice.",
    benefits: [
      { icon: "mic", title: "Human voice", desc: "Jenny speaks like a person, not a robot" },
      { icon: "sparkles", title: "Smart questions", desc: "A real dialogue — she hears your answers" },
      { icon: "stats-chart", title: "Speech analysis", desc: "Scored against oratory standards" },
    ],
    cta: "Unlock Premium",
    note: "Pay per interview — nothing wasted on idle subscriptions",
    dev: "Unlock for testing",
    close: "Later",
  },
};

export default function JennyPaywall({
  lang = "ru",
  onPurchase,
  onDevUnlock,
  onClose,
}: {
  lang?: Lang;
  onPurchase: () => void;
  onDevUnlock: () => void;
  onClose?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const c = COPY[lang];

  return (
    <View style={styles.root}>
      <LinearGradient colors={[BG_TOP, BG_BOT]} style={StyleSheet.absoluteFill} />

      {onClose ? (
        <Pressable
          onPress={onClose}
          style={[styles.closeBtn, { top: insets.top + 8 }]}
          hitSlop={12}
          accessibilityRole="button"
        >
          <Ionicons name="close" size={22} color="rgba(255,255,255,0.7)" />
        </Pressable>
      ) : null}

      <View style={[styles.content, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 20 }]}>
        {/* Hero */}
        <Animated.View entering={FadeIn.duration(400)} style={styles.heroWrap}>
          <View style={styles.heroGlow} />
          <Image source={jennyHero} style={styles.hero} resizeMode="contain" />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(80).duration(360)} style={styles.badge}>
          <Ionicons name="star" size={12} color="#3A2A00" />
          <Text style={styles.badgeText}>{c.badge}</Text>
        </Animated.View>

        <Animated.Text entering={FadeInDown.delay(140).duration(360)} style={styles.title}>
          {c.title}
        </Animated.Text>
        <Animated.Text entering={FadeInDown.delay(180).duration(360)} style={styles.subtitle}>
          {c.subtitle}
        </Animated.Text>

        {/* Benefits */}
        <View style={styles.benefits}>
          {c.benefits.map((b, i) => (
            <Animated.View
              key={b.title}
              entering={FadeInDown.delay(240 + i * 70).duration(360)}
              style={styles.benefitRow}
            >
              <View style={styles.benefitIcon}>
                <Ionicons name={b.icon} size={20} color={GOLD} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.benefitTitle}>{b.title}</Text>
                <Text style={styles.benefitDesc}>{b.desc}</Text>
              </View>
            </Animated.View>
          ))}
        </View>

        <View style={{ flex: 1 }} />

        {/* CTA */}
        <Animated.View entering={FadeInDown.delay(460).duration(360)} style={{ width: "100%" }}>
          <Pressable
            onPress={onPurchase}
            style={({ pressed }) => [styles.cta, { opacity: pressed ? 0.9 : 1 }]}
            accessibilityRole="button"
          >
            <Text style={styles.ctaText}>{c.cta}</Text>
          </Pressable>
          <Text style={styles.note}>{c.note}</Text>
          <Pressable onPress={onDevUnlock} hitSlop={8} style={styles.devBtn}>
            <Text style={styles.devText}>{c.dev}</Text>
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG_BOT },
  closeBtn: {
    position: "absolute",
    right: 16,
    zIndex: 10,
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  content: { flex: 1, paddingHorizontal: 24, alignItems: "center" },
  heroWrap: {
    width: "100%",
    height: SH * 0.26,
    alignItems: "center",
    justifyContent: "flex-end",
    marginBottom: 4,
  },
  heroGlow: {
    position: "absolute",
    bottom: 0,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: GOLD,
    opacity: 0.12,
  },
  hero: { width: "100%", height: "100%" },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: GOLD,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginTop: 8,
  },
  badgeText: {
    color: "#3A2A00",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.5,
    fontFamily: "Inter_700Bold",
  },
  title: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "800",
    marginTop: 14,
    textAlign: "center",
    fontFamily: "Inter_700Bold",
  },
  subtitle: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 15,
    lineHeight: 21,
    marginTop: 10,
    textAlign: "center",
    fontFamily: "Inter_400Regular",
  },
  benefits: { width: "100%", marginTop: 26, gap: 12 },
  benefitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.10)",
    borderRadius: 16,
    padding: 14,
  },
  benefitIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(245,196,81,0.12)",
  },
  benefitTitle: {
    color: "#fff",
    fontSize: 15.5,
    fontWeight: "700",
    fontFamily: "Inter_600SemiBold",
  },
  benefitDesc: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 13,
    marginTop: 2,
    fontFamily: "Inter_400Regular",
  },
  cta: {
    width: "100%",
    height: 56,
    borderRadius: 28,
    backgroundColor: GOLD,
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      ios: { shadowColor: GOLD, shadowOpacity: 0.4, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } },
      android: { elevation: 6 },
      default: {},
    }),
  },
  ctaText: {
    color: "#2A1E00",
    fontSize: 17,
    fontWeight: "800",
    fontFamily: "Inter_700Bold",
  },
  note: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 12.5,
    textAlign: "center",
    marginTop: 12,
    fontFamily: "Inter_400Regular",
  },
  devBtn: { alignSelf: "center", marginTop: 14, padding: 6 },
  devText: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 12,
    textDecorationLine: "underline",
    fontFamily: "Inter_400Regular",
  },
});
