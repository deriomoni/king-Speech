// Rank-up: after the door cut-scene the player lands on a calm page in the
// colour of the door they just walked through. Oscar, their very first
// reading take (to hear how far they've come), a few honest highlights of
// how they trained, and a quote — in the app's own Geologica / card style.
import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import NextChevron from "@/components/NextChevron";
import * as Haptics from "@/lib/haptics";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { router } from "expo-router";
import { leaveTo } from "@/lib/nav";
import { useScreenMusic } from "@/lib/music";
import { useLang, pickLang, type Lang } from "@/context/LangContext";
import { useGame, RANKS_MODULAR } from "@/context/GameContext";
import OscarMascot from "@/components/OscarMascot";
import RecordingPlayer from "@/components/RecordingPlayer";
import RankDoorTransition from "./RankDoorTransition";
import { doorPaletteForRank } from "./Door3D";
import { useFirstReadingTake } from "@/lib/firstTake";
import { rankHighlights } from "@/lib/rankStats";
import { rs } from "@/lib/responsive";

interface Props {
  fromRank: number;
  /**
   * Opened from the Worlds map as a re-watchable memento: no door, and the
   * CTA simply closes back instead of advancing the rank.
   */
  memento?: boolean;
  /** Dev preview: plays the door cut-scene; the CTA just goes back, no rank-up. */
  preview?: boolean;
}

function rankTitle(index: number, lang: Lang): string {
  const i = Math.max(0, Math.min(4, index - 1));
  return pickLang(lang, {
    ru: ["Новичок", "Любитель", "Уверенный", "Мастер", "Профи"],
    en: ["Novice", "Amateur", "Confident", "Master", "Pro"],
    kk: ["Бастаушы", "Әуесқой", "Сенімді", "Шебер", "Кәсіпқой"],
  })[i];
}

// One quote per finished rank.
const QUOTES = [
  {
    ru: "Путь в тысячу ли начинается с первого шага.",
    en: "A journey of a thousand miles begins with a single step.",
    kk: "Мың шақырымдық сапар бір қадамнан басталады.",
    by: { ru: "Лао-цзы", en: "Lao Tzu", kk: "Лао-цзы" },
  },
  {
    ru: "Заговори, чтобы я тебя увидел.",
    en: "Speak, so that I may see you.",
    kk: "Сөйле, сені көрейін.",
    by: { ru: "Сократ", en: "Socrates", kk: "Сократ" },
  },
  {
    ru: "Кто ясно мыслит, тот ясно излагает.",
    en: "What is well conceived is clearly said.",
    kk: "Анық ойлаған адам анық жеткізеді.",
    by: { ru: "Никола Буало", en: "Nicolas Boileau", kk: "Никола Буало" },
  },
  {
    ru: "Поэтами рождаются, ораторами становятся.",
    en: "Poets are born, orators are made.",
    kk: "Ақын болып туады, шешен болып қалыптасады.",
    by: { ru: "Цицерон", en: "Cicero", kk: "Цицерон" },
  },
  {
    ru: "Неважно, как медленно ты идёшь, — главное не останавливаться.",
    en: "It does not matter how slowly you go as long as you do not stop.",
    kk: "Қаншалықты баяу жүргеніңіз маңызды емес — бастысы, тоқтамау.",
    by: { ru: "Конфуций", en: "Confucius", kk: "Конфуций" },
  },
];

const INK = "#262628";
const ink = (a: number) => `rgba(38,38,40,${a})`;

/** `hex` blended toward white by `k` (0..1), as [r, g, b]. */
function tintRgb(hex: string, k: number) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(v + (255 - v) * k));
}
const tint = (hex: string, k: number, a = 1) => `rgba(${tintRgb(hex, k).join(",")},${a})`;

export default function RankUpScreen({ fromRank, memento = false, preview = false }: Props) {
  const isFinal = fromRank >= 5;
  const { lang } = useLang();
  const insets = useSafeAreaInsets();
  const { levels, activityLog, showTimeRecordings, readingRecordings, advanceRank, markPortalCompleted } = useGame();
  const topPad = Platform.OS === "web" ? 54 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const T = (ru: string, en: string, kk: string) => pickLang(lang, { ru, en, kk });

  // Live rank-up opens with the door cut-scene; the page mounts at the
  // white-out peak so its entrance plays as the light fades.
  const [doorScene, setDoorScene] = useState(!memento);
  const [revealed, setRevealed] = useState(memento);
  // the fanfare starts with the door itself on a live rank-up, not on re-visits
  useScreenMusic("rankUp", !memento);

  // the page wears the colour of the door the player just walked through
  const door = doorPaletteForRank(fromRank);
  // a soft gradient in the rank colour: pale casing at the top, the door's
  // own tone in the middle, a warmer glow at the bottom
  const grad = [tint(door.casing, 0.25), tint(door.slab, 0.3), tint(door.glow, 0.4)] as const;
  const bg = grad[2];
  const card = "rgba(255,255,255,0.58)";

  // their very first reading — or, for players from before it was kept,
  // the oldest take in their library
  const firstTake = useFirstReadingTake();
  const take = useMemo(() => {
    if (firstTake) return firstTake;
    const oldest = [...readingRecordings].sort((a, b) => a.date - b.date)[0];
    return oldest
      ? { uri: oldest.uri, title: oldest.title, author: oldest.author, date: oldest.date, durationSec: oldest.durationSec ?? 0, waveform: oldest.waveform }
      : null;
  }, [firstTake, readingRecordings]);

  const range = RANKS_MODULAR.find((r) => r.index === fromRank) ?? RANKS_MODULAR[0];
  const highlights = useMemo(
    () =>
      rankHighlights({
        lang,
        log: activityLog,
        levels,
        fromSection: range.fromSection,
        toSection: range.toSection,
        showTimeCount: Object.values(showTimeRecordings).reduce((n, list) => n + (list?.length ?? 0), 0),
      }),
    [lang, activityLog, levels, range, showTimeRecordings],
  );
  const quote = QUOTES[Math.max(0, Math.min(QUOTES.length - 1, fromRank - 1))];

  const lead = memento
    ? T("Воспоминание о ранге", "A rank to remember", "Есте сақтар дәреже")
    : isFinal
      ? T("Ты прошёл все ранги", "You completed every rank", "Сен барлық дәрежеден өттің")
      : T("Ты переходишь на следующий ранг", "You're moving up to the next rank", "Сен келесі дәрежеге өтесің");
  const title = memento
    ? rankTitle(fromRank, lang)
    : isFinal
      ? T("Твой Голос", "The Voice is Yours", "Дауыс — сенікі")
      : rankTitle(fromRank + 1, lang);

  const handleStart = () => {
    if (memento) {
      if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
      if (router.canGoBack()) router.back();
      else router.replace("/worlds");
      return;
    }
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    // a dev preview never changes progress; the last rank has nowhere to go
    if (!preview) markPortalCompleted(fromRank);
    if (!isFinal && !preview) advanceRank();
    leaveTo("/");
  };

  const ctaLabel = memento
    ? T("Закрыть", "Close", "Жабу")
    : isFinal
      ? T("Вернуться на главный", "Return home", "Басты бетке оралу")
      : T("Перейти на следующий ранг", "Go to the next rank", "Келесі дәрежеге өту");

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      <LinearGradient colors={grad} locations={[0, 0.5, 1]} start={{ x: 0.15, y: 0 }} end={{ x: 0.85, y: 1 }} style={StyleSheet.absoluteFill} />
      {revealed && (
        <ScrollView
          contentContainerStyle={[s.scroll, { paddingTop: topPad + rs(22), paddingBottom: bottomPad + rs(112) }]}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View entering={FadeInDown.duration(420)} style={s.head}>
            <Text style={s.lead}>{lead}</Text>
            <Text style={s.title} numberOfLines={1} adjustsFontSizeToFit>
              {title}
            </Text>
          </Animated.View>

          <Animated.View entering={FadeIn.duration(500).delay(120)} style={s.oscar}>
            <OscarMascot emotion="cool" size={rs(186)} />
          </Animated.View>

          {/* how they sounded at the very start */}
          <Animated.View entering={FadeInDown.duration(420).delay(220)} style={[s.card, { backgroundColor: card }]}>
            <Text style={s.cardTitle}>{T("Так звучал твой голос в начале", "How your voice sounded at the start", "Басында дауысың осылай естілді")}</Text>
            {take ? (
              <>
                <View style={{ marginTop: rs(14) }}>
                  <RecordingPlayer
                    minimal
                    uri={take.uri}
                    waveform={take.waveform}
                    knownDurationSec={take.durationSec}
                    accentColor={INK}
                    trackColor={ink(0.16)}
                    textColor={ink(0.6)}
                  />
                </View>
                <Text style={s.cardHint}>
                  {T("Послушай — и сравни с тем, как говоришь сейчас.", "Listen — and compare it with how you speak now.", "Тыңдап көр — қазіргі сөйлеуіңмен салыстыр.")}
                </Text>
              </>
            ) : (
              <Text style={s.cardSub}>
                {T(
                  "Первая запись чтения появится здесь — пройди уровень «Чтение», и мы её сохраним.",
                  "Your first reading will live here — finish a Reading level and we'll keep it.",
                  "Алғашқы оқу жазбаң осында болады — «Оқу» деңгейін өт, біз оны сақтаймыз.",
                )}
              </Text>
            )}
          </Animated.View>

          {/* honest highlights — only the ones worth celebrating */}
          {highlights.length > 0 && (
            <Animated.View entering={FadeInDown.duration(420).delay(320)}>
              <Text style={s.section}>{T("Твой путь в этом ранге", "Your road through this rank", "Осы дәрежедегі жолың")}</Text>
              <View style={s.grid}>
                {highlights.map((h) => (
                  <View key={h.key} style={[s.tile, { backgroundColor: card }, highlights.length === 1 && { width: "100%" }]}>
                    <Text style={[s.tileValue, !/^d+$/.test(h.value) && s.tileWord]} numberOfLines={2}>
                      {h.value}
                    </Text>
                    <Text style={s.tileLabel} numberOfLines={2}>
                      {h.label}
                    </Text>
                  </View>
                ))}
              </View>
            </Animated.View>
          )}

          <Animated.View entering={FadeInDown.duration(420).delay(420)} style={s.quote}>
            <Text style={s.quoteMark}>“</Text>
            <Text style={s.quoteText}>{pickLang(lang, quote)}</Text>
            <Text style={s.quoteBy}>{pickLang(lang, quote.by)}</Text>
          </Animated.View>
        </ScrollView>
      )}

      {revealed && (
        <Animated.View entering={FadeIn.duration(500).delay(300)} style={[s.ctaWrap, { paddingBottom: bottomPad + rs(16) }]} pointerEvents="box-none">
          <LinearGradient colors={[tint(door.glow, 0.4, 0), bg]} locations={[0, 0.45]} style={s.ctaFade} pointerEvents="none" />
          <Pressable
            onPress={handleStart}
            style={({ pressed }) => [s.cta, { transform: [{ scale: pressed ? 0.97 : 1 }] }]}
            accessibilityRole="button"
            accessibilityLabel={ctaLabel}
            testID="rankup-cta"
          >
            <Text style={s.ctaText}>{ctaLabel}</Text>
            {memento ? <Ionicons name="close" size={rs(20)} color="#fff" /> : <NextChevron size={rs(16)} color="#fff" />}
          </Pressable>
        </Animated.View>
      )}

      {doorScene && (
        <RankDoorTransition
          rank={fromRank}
          // pitch dark: the door opens out of the darkness into blinding light
          light={false}
          lead={
            isFinal
              ? T("Ты прошёл все ранги", "You completed every rank", "Сен барлық дәрежеден өттің")
              : T("Ты переходишь в новый ранг", "You're entering a new rank", "Сен жаңа дәрежеге өтесің")
          }
          title={title}
          onReveal={() => setRevealed(true)}
          onDone={() => setDoorScene(false)}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  scroll: { paddingHorizontal: 20, gap: 16 },
  head: { alignItems: "center", gap: 6 },
  lead: { color: ink(0.6), fontSize: 15, fontFamily: "Geologica_600SemiBold", textAlign: "center" },
  title: { color: INK, fontSize: 44, lineHeight: 50, letterSpacing: -0.8, fontFamily: "Geologica_900Black", textAlign: "center" },
  oscar: { alignItems: "center", marginTop: -4, marginBottom: -6 },
  card: { borderRadius: 24, padding: 18 },
  cardTitle: { color: INK, fontSize: 17, letterSpacing: -0.2, fontFamily: "Geologica_800ExtraBold" },
  cardSub: { color: ink(0.6), fontSize: 13, lineHeight: 18, fontFamily: "Geologica_500Medium", marginTop: 4 },
  cardHint: { color: ink(0.55), fontSize: 13, lineHeight: 18, fontFamily: "Geologica_400Regular", marginTop: 10 },
  section: { color: INK, fontSize: 19, letterSpacing: -0.2, fontFamily: "Geologica_800ExtraBold", marginTop: 8, marginBottom: 12 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  tile: { width: "47.5%", flexGrow: 1, borderRadius: 22, padding: 16, minHeight: 104 },
  tileValue: { color: INK, fontSize: 28, letterSpacing: -0.5, fontFamily: "Geologica_900Black" },
  // words ("по вечерам", "Скороговорки") sit smaller than numbers
  tileWord: { fontSize: 19, lineHeight: 23, letterSpacing: -0.2 },
  tileLabel: { color: ink(0.6), fontSize: 13, lineHeight: 17, fontFamily: "Geologica_500Medium", marginTop: 2 },
  quote: { alignItems: "center", paddingHorizontal: 12, marginTop: 14 },
  quoteMark: { color: ink(0.25), fontSize: 54, lineHeight: 54, fontFamily: "Geologica_900Black", marginBottom: -18 },
  quoteText: { color: INK, fontSize: 19, lineHeight: 26, fontFamily: "Geologica_600SemiBold", textAlign: "center" },
  quoteBy: { color: ink(0.5), fontSize: 13, fontFamily: "Geologica_500Medium", marginTop: 8, letterSpacing: 0.3 },
  ctaWrap: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 20 },
  ctaFade: { position: "absolute", left: 0, right: 0, top: -36, bottom: 0 },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 58,
    borderRadius: 29,
    backgroundColor: INK,
  },
  ctaText: { color: "#FFFFFF", fontSize: 17, fontFamily: "Geologica_800ExtraBold" },
});
