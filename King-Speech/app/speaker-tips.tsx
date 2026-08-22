import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useLang } from "@/context/LangContext";

const GOLD = "#F5A623";
const BG = "#070D1A";
const TEXT = "#F2EEE4";
const MUTED = "rgba(255,255,255,0.55)";

type Tip = {
  ru: { title: string; text: string };
  en: { title: string; text: string };
};

type Section = {
  icon: keyof typeof Ionicons.glyphMap;
  ru: string;
  en: string;
  tips: Tip[];
};

const SECTIONS: Section[] = [
  {
    icon: "mic-outline",
    ru: "Голос",
    en: "Voice",
    tips: [
      {
        ru: { title: "Громкость", text: "Говори громче, чем обычно. Тебя должен слышать последний ряд." },
        en: { title: "Projection", text: "Speak louder than usual. The back row should hear you." },
      },
      {
        ru: { title: "Пауза", text: "Пауза после ключевой фразы — это сила. Не бойся тишины." },
        en: { title: "The pause", text: "A pause after a key phrase is powerful. Don't fear silence." },
      },
      {
        ru: { title: "Темп", text: "Не торопись. Медленная речь звучит увереннее быстрой." },
        en: { title: "Pace", text: "Don't rush. Slow speech sounds more confident than fast." },
      },
    ],
  },
  {
    icon: "body-outline",
    ru: "Тело",
    en: "Body",
    tips: [
      {
        ru: { title: "Осанка", text: "Стой прямо, плечи расправлены — это передаёт уверенность." },
        en: { title: "Posture", text: "Stand straight, shoulders back — it conveys confidence." },
      },
      {
        ru: { title: "Взгляд", text: "Смотри вперёд, в зал, а не в текст или в пол." },
        en: { title: "Eye contact", text: "Look forward at the audience, not at the text or the floor." },
      },
      {
        ru: { title: "Жесты", text: "Руки помогают речи. Открытые жесты — да, руки в карманах — нет." },
        en: { title: "Gestures", text: "Hands support your speech. Open gestures — yes, hands in pockets — no." },
      },
    ],
  },
  {
    icon: "sparkles-outline",
    ru: "Подача",
    en: "Delivery",
    tips: [
      {
        ru: { title: "Улыбка", text: "Лёгкая улыбка расслабляет зал — и тебя самого." },
        en: { title: "The smile", text: "A slight smile relaxes the audience — and you." },
      },
      {
        ru: { title: "Начало", text: "Первую фразу выучи наизусть — уверенный старт задаёт весь тон." },
        en: { title: "The opening", text: "Memorize your first line — a confident start sets the tone." },
      },
      {
        ru: { title: "Финал", text: "Закончи чётко и остановись. Не бормочи и не извиняйся." },
        en: { title: "The ending", text: "End clearly and stop. Don't mumble or apologize." },
      },
    ],
  },
];

export default function SpeakerTipsScreen() {
  const insets = useSafeAreaInsets();
  const { t, lang } = useLang();
  const topPad = Platform.OS === "web" ? 24 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const goBack = () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)/showtime");
    }
  };

  let n = 0;

  return (
    <View style={[st.container, { backgroundColor: BG }]}>
      <LinearGradient
        colors={["#070D1A", "#0D1830", "#070D1A"]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      <View style={[st.header, { paddingTop: topPad + 8 }]}>
        <Pressable onPress={goBack} style={({ pressed }) => [st.backBtn, { opacity: pressed ? 0.7 : 1 }]} accessibilityRole="button">
          <Ionicons name="chevron-back" size={22} color={TEXT} />
        </Pressable>
        <Text style={[st.headerTitle, { fontFamily: "Nunito_700Bold" }]} numberOfLines={1}>{t("speakerTips")}</Text>
        <View style={st.backBtn} />
      </View>

      <ScrollView
        contentContainerStyle={[st.scroll, { paddingBottom: bottomPad + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[st.lead, { fontFamily: "Nunito_400Regular" }]}>
          {lang === "en"
            ? "Nine simple rules. Glance through them before you go on stage."
            : "Девять простых правил. Пробеги глазами перед выходом на сцену."}
        </Text>

        {SECTIONS.map((section, si) => (
          <Animated.View key={si} entering={FadeInDown.delay(100 + si * 80).duration(350)} style={st.section}>
            <View style={st.sectionHeader}>
              <Ionicons name={section.icon} size={15} color={GOLD} />
              <Text style={[st.sectionTitle, { fontFamily: "Nunito_600SemiBold" }]}>
                {(lang === "en" ? section.en : section.ru).toUpperCase()}
              </Text>
              <View style={st.sectionRule} />
            </View>

            {section.tips.map((tip, ti) => {
              n += 1;
              const c = lang === "en" ? tip.en : tip.ru;
              return (
                <View key={ti} style={st.tipRow}>
                  <View style={st.tipNum}>
                    <Text style={[st.tipNumText, { fontFamily: "Nunito_700Bold" }]}>{n}</Text>
                  </View>
                  <View style={st.tipBody}>
                    <Text style={[st.tipTitle, { fontFamily: "Nunito_600SemiBold" }]}>{c.title}</Text>
                    <Text style={[st.tipText, { fontFamily: "Nunito_400Regular" }]}>{c.text}</Text>
                  </View>
                </View>
              );
            })}
          </Animated.View>
        ))}
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { color: TEXT, fontSize: 17, letterSpacing: 0.2, flex: 1, textAlign: "center" },
  scroll: { paddingHorizontal: 20, paddingTop: 4, gap: 24 },
  lead: { color: MUTED, fontSize: 14, lineHeight: 21 },
  section: { gap: 14 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionTitle: { color: GOLD, fontSize: 12, letterSpacing: 2 },
  sectionRule: { flex: 1, height: 1, backgroundColor: "rgba(245,166,35,0.18)" },
  tipRow: {
    flexDirection: "row",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  tipNum: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "rgba(245,166,35,0.45)",
    backgroundColor: "rgba(245,166,35,0.10)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  tipNumText: { color: GOLD, fontSize: 12 },
  tipBody: { flex: 1, gap: 3 },
  tipTitle: { color: TEXT, fontSize: 15 },
  tipText: { color: MUTED, fontSize: 13.5, lineHeight: 20 },
});
