import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import NextChevron from "@/components/NextChevron";
import * as Haptics from "@/lib/haptics";
import Animated, {
  FadeIn,
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  cancelAnimation,
} from "react-native-reanimated";
import { router } from "expo-router";
import { leaveTo } from "@/lib/nav";
import { Audio } from "@/lib/av";
import { useScreenMusic } from "@/lib/music";
import { RankBackground } from "./RankBackground";
import { useTheme } from "@/context/ThemeContext";
import { getRankTheme, pickLocalized, type RankTheme } from "./rankTheme";
import { useLang, pickLang, type Lang } from "@/context/LangContext";
import { useGame, type MetricTrend } from "@/context/GameContext";
import OscarMascot from "@/components/OscarMascot";
import RankDoorTransition from "./RankDoorTransition";
import { rs } from "@/lib/responsive";

interface Props {
  fromRank: number;
  /**
   * When true, the screen is opened from the Worlds map as a re-watchable
   * memento. The CTA does not advance the rank — it simply closes back to
   * the previous screen, and copy is adjusted to feel like a keepsake rather
   * than a celebration.
   */
  memento?: boolean;
  /** Dev preview: plays the door cut-scene; the CTA just goes back, no rank-up. */
  preview?: boolean;
}

// Rank titles (RU / EN / KK) — used by the hero and the big title block.
function rankTitle(index: number, lang: Lang): string {
  const i = Math.max(0, Math.min(4, index - 1));
  return pickLang(lang, {
    ru: ["Новичок", "Любитель", "Уверенный", "Мастер", "Профи"],
    en: ["Novice", "Amateur", "Confident", "Master", "Pro"],
    kk: ["Бастаушы", "Әуесқой", "Сенімді", "Шебер", "Кәсіпқой"],
  })[i];
}

const METRIC_LABELS: Record<string, { ru: string; en: string; kk?: string }> = {
  pauses: { ru: "паузы", en: "pauses", kk: "үзілістер" },
  tempo: { ru: "темп речи", en: "speech tempo", kk: "сөйлеу қарқыны" },
  expressiveness: { ru: "выразительность", en: "expressiveness", kk: "мәнерлілік" },
  confidence: { ru: "уверенность", en: "confidence", kk: "сенімділік" },
  clarity: { ru: "чёткость", en: "clarity", kk: "анықтық" },
  volume: { ru: "громкость", en: "volume", kk: "дауыс қаттылығы" },
};

const METRIC_TIPS: Record<string, { ru: string; en: string; kk?: string }> = {
  pauses: {
    ru: "Не бойся пауз — они подчёркивают самое важное.",
    en: "Don't fear pauses — they highlight what matters most.",
    kk: "Үзілістерден қорықпаңыз — олар ең маңыздысын ерекшелейді.",
  },
  tempo: {
    ru: "Найди свой темп: не торопись, но и не растягивай.",
    en: "Find your tempo: don't rush, don't drag.",
    kk: "Өз қарқыныңызды табыңыз: асықпаңыз, бірақ созбаңыз да.",
  },
  expressiveness: {
    ru: "Меняй интонацию — голос должен звучать живо.",
    en: "Vary your intonation — let your voice sound alive.",
    kk: "Интонацияңызды өзгертіп отырыңыз — дауысыңыз жанды естілсін.",
  },
  confidence: {
    ru: "Говори громче, чем тебе кажется нужным — это придаёт уверенности.",
    en: "Speak a little louder than you think — it brings confidence.",
    kk: "Өзіңізге керек сияқты көрінгеннен сәл қаттырақ сөйлеңіз — бұл сенімділік береді.",
  },
  clarity: {
    ru: "Заверши каждое слово — звуки в конце не должны проглатываться.",
    en: "Finish every word — don't swallow the endings.",
    kk: "Әр сөзді соңына дейін айтыңыз — сөз соңын жұтып қоймаңыз.",
  },
  volume: {
    ru: "Дыши глубже — звук опирается на дыхание.",
    en: "Breathe deeper — sound rests on breath.",
    kk: "Тереңірек дем алыңыз — дыбыс тынысқа сүйенеді.",
  },
};

function HeroBlock({ theme, lang, memento = false }: { theme: RankTheme; lang: Lang; memento?: boolean }) {
  const next = useMemo(() => getRankTheme(theme.index + 1), [theme.index]);
  const targetIsFinal = theme.index >= 5;
  // In memento mode the user is revisiting a finished world, so the hero
  // crest reflects the rank they're remembering (not the next one).
  const display = memento || targetIsFinal ? theme : next;

  const breathe = useSharedValue(1);
  // Memento-only ambient shimmer + halo glow pulse. These shared values stay
  // at their initial idle state when not in memento mode, so the live rank-up
  // celebration is unchanged.
  const shimmer = useSharedValue(0);
  const halo = useSharedValue(0.45);
  useEffect(() => {
    breathe.value = withRepeat(withTiming(1.05, { duration: 2400 }), -1, true);
    if (memento) {
      shimmer.value = withRepeat(withTiming(1, { duration: 5200 }), -1, false);
      halo.value = withRepeat(withTiming(0.95, { duration: 2200 }), -1, true);
    }
    return () => {
      cancelAnimation(breathe);
      cancelAnimation(shimmer);
      cancelAnimation(halo);
    };
  }, [memento]);
  const breatheStyle = useAnimatedStyle(() => ({ transform: [{ scale: breathe.value }] }));
  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${shimmer.value * 360}deg` }],
  }));
  const haloStyle = useAnimatedStyle(() => ({
    opacity: halo.value,
    transform: [{ scale: 1 + halo.value * 0.08 }],
  }));

  return (
    <View style={heroStyles.wrap}>
      <View style={heroStyles.crestStage}>
        {memento ? (
          <Animated.View
            pointerEvents="none"
            style={[heroStyles.halo, haloStyle, { borderColor: display.accent, shadowColor: display.accent }]}
          />
        ) : null}
        <Animated.View style={[breatheStyle, heroStyles.crest, { borderColor: display.accent }]}>
          <LinearGradient
            colors={display.portalGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[StyleSheet.absoluteFill, { borderRadius: rs(90) }]}
          />
          {memento ? (
            <Animated.View
              pointerEvents="none"
              style={[StyleSheet.absoluteFill, shimmerStyle]}
            >
              <LinearGradient
                colors={[
                  "transparent",
                  "rgba(255,255,255,0.0)",
                  "rgba(255,255,255,0.45)",
                  "rgba(255,255,255,0.0)",
                  "transparent",
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
          ) : null}
          <Ionicons
            name={display.portalIcon}
            size={rs(56)}
            color="#fff"
          />
        </Animated.View>
      </View>
      <Text
        style={[
          heroStyles.lead,
          { color: theme.textSecondary, fontFamily: theme.fontFamily },
        ]}
      >
        {memento
          ? pickLang(lang, { ru: "Мир, который ты прошёл.", en: "A world you've completed.", kk: "Сіз өткен әлем." })
          : targetIsFinal
          ? pickLang(lang, { ru: "Ты завершил путь.", en: "You finished the path.", kk: "Сіз жолды аяқтадыңыз." })
          : pickLang(lang, { ru: "Ты открыл новый ранг.", en: "You unlocked a new rank.", kk: "Сіз жаңа дәрежеге жеттіңіз." })}
      </Text>
      <Text
        style={[
          heroStyles.title,
          { color: theme.textPrimary, fontFamily: display.fontFamilyTitle },
        ]}
      >
        {rankTitle(display.index, lang)}
      </Text>
    </View>
  );
}

const heroStyles = StyleSheet.create({
  wrap: { alignItems: "center", gap: 12, paddingTop: 8 },
  crestStage: {
    width: 160,
    height: 160,
    alignItems: "center",
    justifyContent: "center",
  },
  halo: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 1,
    shadowOpacity: 0.6,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  crest: {
    width: 130,
    height: 130,
    borderRadius: 90,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: rs(8) },
    elevation: 8,
  },
  lead: {
    fontSize: 14,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  title: {
    fontSize: 44,
    lineHeight: 50,
    textAlign: "center",
  },
});

function ShowtimeRecording({ uri, theme, lang }: { uri?: string; theme: RankTheme; lang: Lang }) {
  const [playing, setPlaying] = useState(false);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const webAudioRef = React.useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      if (sound) sound.unloadAsync().catch(() => {});
      const wa = webAudioRef.current;
      if (wa) {
        wa.pause();
        webAudioRef.current = null;
      }
    };
  }, [sound]);

  const play = useCallback(async () => {
    if (!uri) return;
    try {
      if (Platform.OS === "web") {
        // typeof window.Audio is the standard Web Audio Element constructor.
        const ctor = typeof window !== "undefined" ? window.Audio : undefined;
        if (!ctor) return;
        const audio = new ctor(uri);
        webAudioRef.current = audio;
        audio.onended = () => setPlaying(false);
        await audio.play();
        setPlaying(true);
        return;
      }
      if (sound) {
        await sound.replayAsync();
        setPlaying(true);
        sound.setOnPlaybackStatusUpdate((status) => {
          if (status.isLoaded && status.didJustFinish) setPlaying(false);
        });
        return;
      }
      const { sound: s } = await Audio.Sound.createAsync({ uri });
      setSound(s);
      s.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) setPlaying(false);
      });
      await s.playAsync();
      setPlaying(true);
    } catch {
      setPlaying(false);
    }
  }, [uri, sound]);

  return (
    <View style={[blockStyles.card, { borderColor: theme.borderColor, backgroundColor: theme.cardBg }]}>
      <Text style={[blockStyles.label, { color: theme.accent, fontFamily: theme.fontFamily }]}>
        {pickLang(lang, { ru: "Блок 1 · Начало", en: "Block 1 · The beginning", kk: "1-блок · Бастама" })}
      </Text>
      <Text style={[blockStyles.heading, { color: theme.textPrimary, fontFamily: theme.fontFamilyTitle }]}>
        {pickLang(lang, { ru: "Вот каким ты был в начале…", en: "This is who you were…", kk: "Басында сіз осындай едіңіз…" })}
      </Text>
      {uri ? (
        <Pressable
          onPress={play}
          style={({ pressed }) => [
            blockStyles.playBtn,
            { borderColor: theme.accent, opacity: pressed ? 0.85 : 1 },
          ]}
          accessibilityRole="button"
          accessibilityLabel={pickLang(lang, { ru: "Воспроизвести первую запись", en: "Play first recording", kk: "Алғашқы жазбаны ойнату" })}
          testID="rankup-play-recording"
        >
          <Ionicons
            name={playing ? "pause" : "play"}
            size={rs(22)}
            color={theme.accent}
          />
          <Text style={[blockStyles.playText, { color: theme.accent, fontFamily: theme.fontFamilyTitle }]}>
            {playing
              ? pickLang(lang, { ru: "Слушаем твою первую запись…", en: "Playing your first take…", kk: "Алғашқы жазбаңызды тыңдап жатырмыз…" })
              : pickLang(lang, { ru: "Воспроизвести первый Show Time", en: "Play first Show Time", kk: "Алғашқы Сахна уақытын ойнату" })}
          </Text>
        </Pressable>
      ) : (
        <View style={[blockStyles.empty, { borderColor: theme.borderColor }]}>
          <Ionicons name="mic-outline" size={rs(20)} color={theme.textMuted} />
          <Text style={[blockStyles.emptyText, { color: theme.textMuted, fontFamily: theme.fontFamily }]}>
            {pickLang(lang, { ru: "Ранней записи Show Time пока нет — твой будущий ты её услышит.", en: "No early Show Time recording yet — your future self will hear it.", kk: "Ерте Сахна уақыты жазбасы әзірге жоқ — болашақтағы сіз оны міндетті түрде естисіз." })}
          </Text>
        </View>
      )}
    </View>
  );
}

function QuoteBlock({ theme, lang }: { theme: RankTheme; lang: Lang }) {
  return (
    <View style={[blockStyles.card, { borderColor: theme.borderColor, backgroundColor: theme.cardBg }]}>
      <Text style={[blockStyles.label, { color: theme.accent, fontFamily: theme.fontFamily }]}>
        {pickLang(lang, { ru: "Блок 2 · Великий голос", en: "Block 2 · A great voice", kk: "2-блок · Ұлы дауыс" })}
      </Text>
      <Text style={[blockStyles.quote, { color: theme.textPrimary, fontFamily: theme.fontFamilyTitle }]}>
        {pickLocalized(theme.motivationalQuote, lang)}
      </Text>
      <View style={blockStyles.quoteAuthorRow}>
        <View style={[blockStyles.quoteDash, { backgroundColor: theme.accent }]} />
        <Text style={[blockStyles.quoteAuthor, { color: theme.textSecondary, fontFamily: theme.fontFamily }]}>
          {pickLocalized(theme.motivationalAuthor, lang)}
        </Text>
      </View>
    </View>
  );
}

// Improvement is shown in green, regression in a muted red, "no change"
// in the theme's secondary text. The threshold avoids flickering between
// states for tiny averaging noise (e.g. 3.33 → 3.34).
const TREND_EPSILON = 0.05;

function TrendChip({
  trend,
  theme,
  lang,
}: {
  trend: MetricTrend;
  theme: RankTheme;
  lang: Lang;
}) {
  const delta = trend.now - trend.before;
  const improved = delta > TREND_EPSILON;
  const regressed = delta < -TREND_EPSILON;
  const color = improved ? "#10B981" : regressed ? "#EF4444" : theme.textSecondary;
  const icon = improved ? "trending-up" : regressed ? "trending-down" : "remove";
  const fmt = (n: number) => n.toFixed(1);
  return (
    <View
      style={[
        blockStyles.trendChip,
        { borderColor: color + "55", backgroundColor: color + "14" },
      ]}
      accessibilityLabel={
        pickLang(lang, { ru: `Было ${fmt(trend.before)}, сейчас ${fmt(trend.now)}`, en: `Before ${fmt(trend.before)}, now ${fmt(trend.now)}`, kk: `Бұрын ${fmt(trend.before)}, қазір ${fmt(trend.now)}` })
      }
    >
      <Text style={[blockStyles.trendNumber, { color, fontFamily: theme.fontFamilyTitle }]}>
        {fmt(trend.before)}
      </Text>
      <Ionicons name={icon} size={rs(12)} color={color} />
      <Text style={[blockStyles.trendNumber, { color, fontFamily: theme.fontFamilyTitle }]}>
        {fmt(trend.now)}
      </Text>
    </View>
  );
}

// Generic foundation metrics surfaced when the player hasn't done enough
// real Show Time recordings yet. Exported so the parent can compute the
// surfaced list + matching trends without duplicating this list.
const FALLBACK_METRICS = ["pauses", "tempo", "expressiveness"];

export function getSurfacedMetrics(worstMetrics: string[]): string[] {
  // Worst-first metrics come from real analyses; we top up with the
  // foundation set so the block always shows three rows. Dedupe preserves
  // order so the player's actual weak spots stay above the generics.
  return Array.from(new Set([...worstMetrics, ...FALLBACK_METRICS])).slice(0, 3);
}

function TipsBlock({
  theme,
  lang,
  metrics,
  trends,
}: {
  theme: RankTheme;
  lang: Lang;
  metrics: string[];
  trends: Record<string, MetricTrend | null>;
}) {
  return (
    <View style={[blockStyles.card, { borderColor: theme.borderColor, backgroundColor: theme.cardBg }]}>
      <Text style={[blockStyles.label, { color: theme.accent, fontFamily: theme.fontFamily }]}>
        {pickLang(lang, { ru: "Блок 3 · Для следующего ранга", en: "Block 3 · For your next rank", kk: "3-блок · Келесі дәреже үшін" })}
      </Text>
      <Text style={[blockStyles.heading, { color: theme.textPrimary, fontFamily: theme.fontFamilyTitle }]}>
        {pickLang(lang, { ru: "Три вещи, которые стоит отточить", en: "Three things to refine", kk: "Шыңдай түсетін үш нәрсе" })}
      </Text>
      {metrics.map((m, i) => {
        const label = METRIC_LABELS[m] ?? { ru: m, en: m, kk: m };
        const tip = METRIC_TIPS[m] ?? { ru: "Продолжай практиковаться.", en: "Keep practicing.", kk: "Жаттығуды жалғастырыңыз." };
        const trend = trends[m];
        return (
          <View key={m + i} style={blockStyles.tipRow}>
            <View style={[blockStyles.tipBullet, { backgroundColor: theme.accent }]}>
              <Text style={[blockStyles.tipBulletText, { fontFamily: theme.fontFamilyTitle }]}>
                {i + 1}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={blockStyles.tipMetricRow}>
                <Text style={[blockStyles.tipMetric, { color: theme.textPrimary, fontFamily: theme.fontFamilyTitle }]}>
                  {pickLocalized(label, lang)}
                </Text>
                {trend ? <TrendChip trend={trend} theme={theme} lang={lang} /> : null}
              </View>
              <Text style={[blockStyles.tipText, { color: theme.textSecondary, fontFamily: theme.fontFamily }]}>
                {pickLocalized(tip, lang)}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const blockStyles = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
    gap: 10,
  },
  label: {
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  heading: { fontSize: 22, lineHeight: 28 },
  quote: {
    fontSize: 22,
    lineHeight: 30,
    fontStyle: "italic",
  },
  quoteAuthorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  quoteDash: { width: 18, height: 2, borderRadius: 1 },
  quoteAuthor: { fontSize: 13 },
  playBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    alignSelf: "flex-start",
  },
  playText: { fontSize: 14 },
  empty: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "dashed",
  },
  emptyText: { fontSize: 13, flex: 1 },
  tipRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingTop: 6,
  },
  tipBullet: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  tipBulletText: { color: "#fff", fontSize: 13 },
  tipMetricRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 2,
  },
  tipMetric: { fontSize: 16, textTransform: "capitalize" },
  tipText: { fontSize: 13, lineHeight: 18 },
  trendChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  trendNumber: {
    fontSize: 12,
    letterSpacing: 0.2,
    fontVariant: ["tabular-nums"],
  },
});

export default function RankUpScreen({ fromRank, memento = false, preview = false }: Props) {
  const theme = getRankTheme(fromRank);
  const next = getRankTheme(fromRank + 1);
  const isFinal = fromRank >= 5;
  const { lang } = useLang();
  const { themeMode } = useTheme();
  const insets = useSafeAreaInsets();
  const { showTimeRecordings, getWorstMetricsForRank, getMetricTrendForRank, advanceRank, markPortalCompleted } = useGame();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  // Live rank-up opens with the door cut-scene; the screen content mounts at
  // the white-out peak so its entrance animations play as the light fades.
  const [doorScene, setDoorScene] = useState(!memento);
  const [revealed, setRevealed] = useState(memento);
  // the fanfare comes with the reveal of a live rank-up, not on re-visits
  useScreenMusic("rankUp", revealed && !memento);

  const recordings = showTimeRecordings[fromRank] ?? [];
  const firstRecording = recordings[0]?.uri;

  // Compute the surfaced metrics + their trends together so TipsBlock can
  // render a "before → now" chip beside each one. `getSurfacedMetrics`
  // is the single source of truth for the fallback list — even with no
  // recorded data we still attempt to look up a trend (which simply
  // returns null and the chip is skipped).
  const worstMetrics = getWorstMetricsForRank(fromRank, 3);
  const surfacedMetrics = useMemo(
    () => getSurfacedMetrics(worstMetrics),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [worstMetrics.join("|")],
  );
  const metricTrends = useMemo(() => {
    const map: Record<string, MetricTrend | null> = {};
    for (const m of surfacedMetrics) {
      map[m] = getMetricTrendForRank(fromRank, m);
    }
    return map;
    // getMetricTrendForRank closes over metricSeries from context which
    // updates the provider value; safe to depend on the function ref.
  }, [surfacedMetrics, fromRank, getMetricTrendForRank]);
  const handleStart = () => {
    if (memento) {
      if (Platform.OS !== "web") {
        Haptics.selectionAsync().catch(() => {});
      }
      if (router.canGoBack()) router.back();
      else router.replace("/worlds");
      return;
    }
    // Jenny's interview was the old rank-up gate; it's been removed, so advancing
    // no longer routes through /portal-interview — the player advances directly.
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    // Final rank already at the top — just return home, no advance.
    // A dev preview never changes progress.
    if (!preview) markPortalCompleted(fromRank);
    if (!isFinal && !preview) {
      advanceRank();
    }
    // Opened from the Path tab — pop back to it (no second tabs navigator).
    leaveTo("/");
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.bgColors[0], overflow: "hidden" }}>
      <RankBackground theme={theme} themeMode={themeMode} />

      {revealed && (
      <ScrollView
        contentContainerStyle={[
          rankUpStyles.scroll,
          { paddingTop: topPad + rs(16), paddingBottom: bottomPad + rs(110) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeIn.duration(360)}>
          <HeroBlock theme={theme} lang={lang} memento={memento} />
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(400).delay(120)}>
          <ShowtimeRecording uri={firstRecording} theme={theme} lang={lang} />
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(400).delay(220)}>
          <QuoteBlock theme={theme} lang={lang} />
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(400).delay(320)}>
          <TipsBlock theme={theme} lang={lang} metrics={surfacedMetrics} trends={metricTrends} />
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(400).delay(420)} style={rankUpStyles.bigTitleBlock}>
          <Text style={[rankUpStyles.bigLead, { color: theme.textSecondary, fontFamily: theme.fontFamily }]}>
            {memento
              ? pickLang(lang, { ru: "Блок 4 · Воспоминание", en: "Block 4 · A keepsake", kk: "4-блок · Естелік" })
              : isFinal
              ? pickLang(lang, { ru: "Ты прошёл все ранги", en: "You completed every rank", kk: "Сіз барлық дәрежеден өттіңіз" })
              : pickLang(lang, { ru: "Блок 4 · Добро пожаловать в", en: "Block 4 · Welcome to", kk: "4-блок · Жаңа дәрежеңіз:" })}
          </Text>
          <Text style={[rankUpStyles.bigTitle, { color: memento ? theme.accent : (next.textPrimary === theme.textPrimary ? theme.textPrimary : next.accent), fontFamily: (memento ? theme : next).fontFamilyTitle }]}>
            {memento
              ? rankTitle(theme.index, lang)
              : isFinal
              ? pickLang(lang, { ru: "Твой Голос", en: "The Voice is Yours", kk: "Дауыс — сіздікі" })
              : rankTitle(next.index, lang)}
          </Text>
        </Animated.View>

        {/* Oscar celebrates the new rank — cool & confident */}
        <Animated.View
          entering={FadeIn.duration(450).delay(520)}
          style={{ alignItems: "center", marginTop: rs(4) }}
        >
          <OscarMascot emotion="cool" size={rs(128)} />
        </Animated.View>
      </ScrollView>
      )}

      {revealed && (
      <Animated.View
        // In memento mode the close affordance fades in a beat after mount so
        // the keepsake feels intentional, not a re-used celebration screen.
        entering={memento ? FadeIn.duration(420).delay(420) : FadeIn.duration(500).delay(300)}
        style={[rankUpStyles.ctaWrap, { paddingBottom: bottomPad + rs(16) }]}
      >
        <Pressable
          onPress={handleStart}
          style={({ pressed }) => [
            rankUpStyles.cta,
            { opacity: pressed ? 0.9 : 1 },
          ]}
          accessibilityRole="button"
          accessibilityLabel={
            memento
              ? pickLang(lang, { ru: "Закрыть воспоминание", en: "Close memory", kk: "Естелікті жабу" })
              : pickLang(lang, { ru: "Начать новый ранг", en: "Start the new rank", kk: "Жаңа дәрежені бастау" })
          }
          testID="rankup-cta"
        >
          <LinearGradient
            colors={memento ? theme.portalGradient : next.portalGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[StyleSheet.absoluteFill, { borderRadius: rs(28) }]}
          />
          <Text style={[rankUpStyles.ctaText, { fontFamily: (memento ? theme : next).fontFamilyTitle }]}>
            {memento
              ? pickLang(lang, { ru: "Закрыть воспоминание", en: "Close memory", kk: "Естелікті жабу" })
              : isFinal
              ? pickLang(lang, { ru: "Вернуться на главный", en: "Return home", kk: "Басты бетке оралу" })
              : pickLang(lang, { ru: "Начать новый ранг", en: "Start the new rank", kk: "Жаңа дәрежені бастау" })}
          </Text>
          {memento ? <Ionicons name="close" size={rs(20)} color="#fff" /> : <NextChevron size={rs(16)} color="#fff" />}
        </Pressable>
      </Animated.View>
      )}

      {doorScene && (
        <RankDoorTransition
          rank={fromRank}
          light={themeMode !== "dark"}
          lead={
            isFinal
              ? pickLang(lang, { ru: "Ты прошёл все ранги", en: "You completed every rank", kk: "Сіз барлық дәрежеден өттіңіз" })
              : pickLang(lang, { ru: "Ты переходишь в новый ранг", en: "You're entering a new rank", kk: "Сіз жаңа дәрежеге өтесіз" })
          }
          title={isFinal ? pickLang(lang, { ru: "Твой Голос", en: "The Voice is Yours", kk: "Дауыс — сіздікі" }) : rankTitle(next.index, lang)}
          onReveal={() => setRevealed(true)}
          onDone={() => setDoorScene(false)}
        />
      )}
    </View>
  );
}

const rankUpStyles = StyleSheet.create({
  scroll: {
    paddingHorizontal: 18,
    gap: 18,
  },
  bigTitleBlock: {
    alignItems: "center",
    gap: 6,
    paddingTop: 12,
  },
  bigLead: {
    fontSize: 12,
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  bigTitle: {
    fontSize: 56,
    lineHeight: 62,
    textAlign: "center",
  },
  ctaWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 18,
  },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 56,
    paddingHorizontal: 24,
    borderRadius: 28,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: rs(6) },
    elevation: 6,
  },
  ctaText: { fontSize: 17, color: "#fff", letterSpacing: 0.4 },
});
