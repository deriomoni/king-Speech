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
import * as Haptics from "expo-haptics";
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
import { Audio } from "expo-av";
import { RankBackground } from "./RankBackground";
import { useTheme } from "@/context/ThemeContext";
import { getRankTheme, pickLocalized, type RankTheme } from "./rankTheme";
import { useLang } from "@/context/LangContext";
import { useGame, type MetricTrend } from "@/context/GameContext";

interface Props {
  fromRank: number;
  /**
   * When true, the screen is opened from the Worlds map as a re-watchable
   * memento. The CTA does not advance the rank — it simply closes back to
   * the previous screen, and copy is adjusted to feel like a keepsake rather
   * than a celebration.
   */
  memento?: boolean;
}

const METRIC_LABELS: Record<string, { ru: string; en: string }> = {
  pauses: { ru: "паузы", en: "pauses" },
  tempo: { ru: "темп речи", en: "speech tempo" },
  expressiveness: { ru: "выразительность", en: "expressiveness" },
  confidence: { ru: "уверенность", en: "confidence" },
  clarity: { ru: "чёткость", en: "clarity" },
  volume: { ru: "громкость", en: "volume" },
};

const METRIC_TIPS: Record<string, { ru: string; en: string }> = {
  pauses: {
    ru: "Не бойся пауз — они подчёркивают самое важное.",
    en: "Don't fear pauses — they highlight what matters most.",
  },
  tempo: {
    ru: "Найди свой темп: не торопись, но и не растягивай.",
    en: "Find your tempo: don't rush, don't drag.",
  },
  expressiveness: {
    ru: "Меняй интонацию — голос должен звучать живо.",
    en: "Vary your intonation — let your voice sound alive.",
  },
  confidence: {
    ru: "Говори громче, чем тебе кажется нужным — это придаёт уверенности.",
    en: "Speak a little louder than you think — it brings confidence.",
  },
  clarity: {
    ru: "Заверши каждое слово — звуки в конце не должны проглатываться.",
    en: "Finish every word — don't swallow the endings.",
  },
  volume: {
    ru: "Дыши глубже — звук опирается на дыхание.",
    en: "Breathe deeper — sound rests on breath.",
  },
};

function HeroBlock({ theme, lang, memento = false }: { theme: RankTheme; lang: "ru" | "en"; memento?: boolean }) {
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
            style={[StyleSheet.absoluteFill, { borderRadius: 90 }]}
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
            size={56}
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
          ? lang === "en"
            ? "A world you've completed."
            : "Мир, который ты прошёл."
          : targetIsFinal
          ? lang === "en"
            ? "You finished the path."
            : "Ты завершил путь."
          : lang === "en"
          ? "You unlocked a new rank."
          : "Ты открыл новый ранг."}
      </Text>
      <Text
        style={[
          heroStyles.title,
          { color: theme.textPrimary, fontFamily: display.fontFamilyTitle },
        ]}
      >
        {lang === "en"
          ? display.index === 1
            ? "Novice"
            : display.index === 2
            ? "Amateur"
            : display.index === 3
            ? "Confident"
            : display.index === 4
            ? "Master"
            : "Pro"
          : display.index === 1
          ? "Новичок"
          : display.index === 2
          ? "Любитель"
          : display.index === 3
          ? "Уверенный"
          : display.index === 4
          ? "Мастер"
          : "Профи"}
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
    shadowOffset: { width: 0, height: 8 },
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

function ShowtimeRecording({ uri, theme, lang }: { uri?: string; theme: RankTheme; lang: "ru" | "en" }) {
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
        {lang === "en" ? "Block 1 · The beginning" : "Блок 1 · Начало"}
      </Text>
      <Text style={[blockStyles.heading, { color: theme.textPrimary, fontFamily: theme.fontFamilyTitle }]}>
        {lang === "en" ? "This is who you were…" : "Вот каким ты был в начале…"}
      </Text>
      {uri ? (
        <Pressable
          onPress={play}
          style={({ pressed }) => [
            blockStyles.playBtn,
            { borderColor: theme.accent, opacity: pressed ? 0.85 : 1 },
          ]}
          accessibilityRole="button"
          accessibilityLabel={lang === "en" ? "Play first recording" : "Воспроизвести первую запись"}
          testID="rankup-play-recording"
        >
          <Ionicons
            name={playing ? "pause" : "play"}
            size={22}
            color={theme.accent}
          />
          <Text style={[blockStyles.playText, { color: theme.accent, fontFamily: theme.fontFamilyTitle }]}>
            {playing
              ? lang === "en"
                ? "Playing your first take…"
                : "Слушаем твою первую запись…"
              : lang === "en"
              ? "Play first Show Time"
              : "Воспроизвести первый Show Time"}
          </Text>
        </Pressable>
      ) : (
        <View style={[blockStyles.empty, { borderColor: theme.borderColor }]}>
          <Ionicons name="mic-outline" size={20} color={theme.textMuted} />
          <Text style={[blockStyles.emptyText, { color: theme.textMuted, fontFamily: theme.fontFamily }]}>
            {lang === "en"
              ? "No early Show Time recording yet — your future self will hear it."
              : "Ранней записи Show Time пока нет — твой будущий ты её услышит."}
          </Text>
        </View>
      )}
    </View>
  );
}

function QuoteBlock({ theme, lang }: { theme: RankTheme; lang: "ru" | "en" }) {
  return (
    <View style={[blockStyles.card, { borderColor: theme.borderColor, backgroundColor: theme.cardBg }]}>
      <Text style={[blockStyles.label, { color: theme.accent, fontFamily: theme.fontFamily }]}>
        {lang === "en" ? "Block 2 · A great voice" : "Блок 2 · Великий голос"}
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
  lang: "ru" | "en";
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
        lang === "en"
          ? `Before ${fmt(trend.before)}, now ${fmt(trend.now)}`
          : `Было ${fmt(trend.before)}, сейчас ${fmt(trend.now)}`
      }
    >
      <Text style={[blockStyles.trendNumber, { color, fontFamily: theme.fontFamilyTitle }]}>
        {fmt(trend.before)}
      </Text>
      <Ionicons name={icon} size={12} color={color} />
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
  lang: "ru" | "en";
  metrics: string[];
  trends: Record<string, MetricTrend | null>;
}) {
  return (
    <View style={[blockStyles.card, { borderColor: theme.borderColor, backgroundColor: theme.cardBg }]}>
      <Text style={[blockStyles.label, { color: theme.accent, fontFamily: theme.fontFamily }]}>
        {lang === "en" ? "Block 3 · For your next rank" : "Блок 3 · Для следующего ранга"}
      </Text>
      <Text style={[blockStyles.heading, { color: theme.textPrimary, fontFamily: theme.fontFamilyTitle }]}>
        {lang === "en" ? "Three things to refine" : "Три вещи, которые стоит отточить"}
      </Text>
      {metrics.map((m, i) => {
        const label = METRIC_LABELS[m] ?? { ru: m, en: m };
        const tip = METRIC_TIPS[m] ?? { ru: "Продолжай практиковаться.", en: "Keep practicing." };
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

export default function RankUpScreen({ fromRank, memento = false }: Props) {
  const theme = getRankTheme(fromRank);
  const next = getRankTheme(fromRank + 1);
  const isFinal = fromRank >= 5;
  const { lang } = useLang();
  const { themeMode } = useTheme();
  const insets = useSafeAreaInsets();
  const { showTimeRecordings, getWorstMetricsForRank, getMetricTrendForRank, advanceRank, portalCompleted } = useGame();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

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
  // Only allow advance when the portal is actually completed.
  const portalDone = !!portalCompleted[fromRank];

  const handleStart = () => {
    if (memento) {
      if (Platform.OS !== "web") {
        Haptics.selectionAsync().catch(() => {});
      }
      if (router.canGoBack()) router.back();
      else router.replace("/worlds");
      return;
    }
    if (!portalDone) {
      router.replace("/portal-interview");
      return;
    }
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    // Final rank already at the top — just return home, no advance.
    if (!isFinal) {
      advanceRank();
    }
    router.replace("/");
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.bgColors[0] }}>
      <RankBackground theme={theme} themeMode={themeMode} />

      <ScrollView
        contentContainerStyle={[
          rankUpStyles.scroll,
          { paddingTop: topPad + 16, paddingBottom: bottomPad + 110 },
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
              ? lang === "en"
                ? "Block 4 · A keepsake"
                : "Блок 4 · Воспоминание"
              : isFinal
              ? lang === "en"
                ? "You completed every rank"
                : "Ты прошёл все ранги"
              : lang === "en"
              ? "Block 4 · Welcome to"
              : "Блок 4 · Добро пожаловать в"}
          </Text>
          <Text style={[rankUpStyles.bigTitle, { color: memento ? theme.accent : (next.textPrimary === theme.textPrimary ? theme.textPrimary : next.accent), fontFamily: (memento ? theme : next).fontFamilyTitle }]}>
            {memento
              ? lang === "en"
                ? theme.index === 1 ? "Novice" : theme.index === 2 ? "Amateur" : theme.index === 3 ? "Confident" : theme.index === 4 ? "Master" : "Pro"
                : theme.index === 1 ? "Новичок" : theme.index === 2 ? "Любитель" : theme.index === 3 ? "Уверенный" : theme.index === 4 ? "Мастер" : "Профи"
              : isFinal
              ? lang === "en" ? "The Voice is Yours" : "Твой Голос"
              : lang === "en"
              ? next.index === 2 ? "Amateur" : next.index === 3 ? "Confident" : next.index === 4 ? "Master" : "Pro"
              : next.index === 2 ? "Любитель" : next.index === 3 ? "Уверенный" : next.index === 4 ? "Мастер" : "Профи"}
          </Text>
        </Animated.View>
      </ScrollView>

      <Animated.View
        // In memento mode the close affordance fades in a beat after mount so
        // the keepsake feels intentional, not a re-used celebration screen.
        entering={memento ? FadeIn.duration(420).delay(420) : undefined}
        style={[rankUpStyles.ctaWrap, { paddingBottom: bottomPad + 16 }]}
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
              ? lang === "en" ? "Close memory" : "Закрыть воспоминание"
              : lang === "en" ? "Start the new rank" : "Начать новый ранг"
          }
          testID="rankup-cta"
        >
          <LinearGradient
            colors={memento ? theme.portalGradient : next.portalGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[StyleSheet.absoluteFill, { borderRadius: 28 }]}
          />
          <Text style={[rankUpStyles.ctaText, { fontFamily: (memento ? theme : next).fontFamilyTitle }]}>
            {memento
              ? lang === "en" ? "Close memory" : "Закрыть воспоминание"
              : isFinal
              ? lang === "en" ? "Return home" : "Вернуться на главный"
              : lang === "en" ? "Start the new rank" : "Начать новый ранг"}
          </Text>
          <Ionicons name={memento ? "close" : "arrow-forward"} size={20} color="#fff" />
        </Pressable>
      </Animated.View>
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
    gap: 12,
    height: 56,
    borderRadius: 28,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  ctaText: { fontSize: 17, color: "#fff", letterSpacing: 0.4 },
});
