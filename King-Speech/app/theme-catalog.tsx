// «Каталог тем» — Figma "Screen / 03c · Каталог тем" (399:1177 dark, Light mode instance).
// Full Show Time theme catalog: search, category chips, «Тема недели» featured
// card and a 2-column grid of gradient covers. Tapping a theme opens that
// theme's stage directly (showtime-stage starts on its «Превью темы» card) via
// the normal free-entry / coin flow; closing the preview comes back here.
import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  TextInput,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "@/lib/haptics";
import { getSpeechThemes, type SpeechTheme } from "@/app/showtime-stage";
import { useLang } from "@/context/LangContext";
import { useTheme } from "@/context/ThemeContext";
import { ShowTimeLogo } from "@/components/showtime/ShowTimeLogo";
import { PlayTriangleIcon, SearchIcon } from "@/components/showtime/ShowTimeIcons";
import { useShowTimeEntry } from "@/components/showtime/useShowTimeEntry";
import { THEME_CATEGORIES, categoryOf, type ThemeCategoryId } from "@/components/showtime/themeCategories";

const POPULAR_COUNT = 10;

function durationOf(t: SpeechTheme, en: boolean) {
  if (t.timerSeconds !== null) return en ? `${t.timerSeconds} sec` : `${t.timerSeconds} сек`;
  return en ? "1–2 min" : "1–2 мин";
}

function themesWord(n: number, en: boolean) {
  if (en) return n === 1 ? "topic" : "topics";
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return "тема";
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return "темы";
  return "тем";
}

// ISO-ish week number — «Тема недели» rotates once a week, deterministically.
function weekIndex() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  return Math.floor((now.getTime() - start.getTime()) / (7 * 86400000)) + now.getFullYear() * 53;
}

export default function ThemeCatalogScreen() {
  const insets = useSafeAreaInsets();
  const { lang } = useLang();
  const en = lang === "en";
  const { theme: c, themeMode } = useTheme();
  const isLight = themeMode === "light";
  const { width: winW } = useWindowDimensions();

  const stroke = isLight ? "rgba(38,38,40,0.08)" : "rgba(240,238,233,0.06)";
  const topPad = Platform.OS === "web" ? 54 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const speechThemes = getSpeechThemes(lang);
  const ALL_KEYS = useMemo(() => Object.keys(speechThemes), [speechThemes]);
  const [query, setQuery] = useState("");
  const [activeCat, setActiveCat] = useState<ThemeCategoryId>("popular");

  const featuredKey = ALL_KEYS.length ? ALL_KEYS[weekIndex() % ALL_KEYS.length] : null;
  const featured = featuredKey ? speechThemes[featuredKey] : null;

  const q = query.trim().toLowerCase();
  const keys = useMemo(() => {
    if (q) return ALL_KEYS.filter((k) => speechThemes[k].title.toLowerCase().includes(q));
    if (activeCat === "popular") return ALL_KEYS.slice(0, POPULAR_COUNT);
    return ALL_KEYS.filter((k) => categoryOf(k) === activeCat);
  }, [q, activeCat, ALL_KEYS, speechThemes]);

  const contentW = Math.min(winW, 480) - 40;
  const cardW = Math.floor((contentW - 12) / 2);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/showtime");
  };

  const entry = useShowTimeEntry();
  const pick = (key: string) => {
    const t = speechThemes[key];
    if (t) entry.start(t.levelId);
  };

  return (
    <View style={[s.container, { backgroundColor: c.bg }]}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.content, { paddingTop: topPad + 8, paddingBottom: bottomPad + 40 }]}
      >
        {/* Back chevron (no circle) + Show Time logo */}
        <View style={s.topRow}>
          <Pressable onPress={goBack} hitSlop={12} style={s.back} accessibilityRole="button">
            <Ionicons name="chevron-back" size={26} color={c.text} />
          </Pressable>
          <ShowTimeLogo width={83} color={isLight ? c.text : c.accent} />
        </View>

        <Text style={[s.title, { color: c.text }]}>{en ? "Topic catalog" : "Каталог тем"}</Text>
        <Text style={[s.subtitle, { color: c.textMuted }]}>
          {en ? "Pick a topic and take the stage" : "Выбери тему и выходи на сцену"}
        </Text>

        <View style={[s.search, { backgroundColor: c.card, borderColor: stroke }]}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={en ? "Find a topic" : "Найти тему"}
            placeholderTextColor={c.textMuted}
            returnKeyType="search"
            style={[s.searchInput, { color: c.text }, Platform.OS === "web" && ({ outlineStyle: "none" } as any)]}
          />
          <SearchIcon color={c.text} />
        </View>

        {!q && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            alwaysBounceHorizontal={false}
            style={s.chipsScroll}
            contentContainerStyle={s.chips}
          >
            {THEME_CATEGORIES.map((cat) => {
              const active = cat.id === activeCat;
              return (
                <Pressable
                  key={cat.id}
                  onPress={() => {
                    setActiveCat(cat.id);
                    if (Platform.OS !== "web") Haptics.selectionAsync();
                  }}
                  style={[
                    s.chip,
                    active
                      ? { backgroundColor: c.text, borderColor: c.text }
                      : { backgroundColor: c.card, borderColor: stroke },
                  ]}
                >
                  <Text style={[s.chipText, { color: active ? c.bg : c.textSecondary }]}>
                    {en ? cat.en : cat.ru}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        {/* «Тема недели» */}
        {featured && featuredKey && !q && (
          <Animated.View entering={FadeInDown.delay(80).duration(400)}>
            <Pressable onPress={() => pick(featuredKey)} style={s.featured}>
              <LinearGradient
                colors={["#FFD857", "#FFA53A"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={s.fill}
              />
              <View style={s.featuredOrb} />
              <LinearGradient
                colors={["rgba(255,140,0,0)", "rgba(230,110,0,0.28)"]}
                style={s.featuredBand}
                pointerEvents="none"
              />
              <View style={s.tag}>
                <Text style={s.tagText}>{en ? "TOPIC OF THE WEEK" : "ТЕМА НЕДЕЛИ"}</Text>
              </View>
              <View style={s.featuredBottom}>
                <View style={{ flex: 1 }}>
                  <Text style={s.featuredTitle} numberOfLines={1}>
                    {en ? `“${featured.title}”` : `«${featured.title}»`}
                  </Text>
                  <Text style={s.featuredSub} numberOfLines={1}>
                    {durationOf(featured, en)}
                    {en ? " · perfect to start" : " · идеально для старта"}
                  </Text>
                </View>
                <View style={s.featuredPlay}>
                  <PlayTriangleIcon color="#262628" />
                </View>
              </View>
            </Pressable>
          </Animated.View>
        )}

        <View style={s.sectionHead}>
          <Text style={[s.sectionTitle, { color: c.text }]}>
            {q ? (en ? "Found" : "Найдено") : en ? "All topics" : "Все темы"}
          </Text>
          <Text style={[s.sectionCount, { color: c.textMuted }]}>
            {keys.length} {themesWord(keys.length, en)}
          </Text>
        </View>

        {keys.length === 0 ? (
          <Text style={[s.empty, { color: c.textMuted }]}>{en ? "Nothing found" : "Ничего не найдено"}</Text>
        ) : (
          <View style={s.grid}>
            {keys.map((k, i) => {
              const t = speechThemes[k];
              return (
                <Animated.View key={k} entering={FadeInDown.delay(120 + Math.min(i, 8) * 40).duration(380)}>
                  <Pressable
                    onPress={() => pick(k)}
                    style={({ pressed }) => [
                      s.card,
                      { width: cardW, backgroundColor: c.card, borderColor: stroke, opacity: pressed ? 0.85 : 1 },
                    ]}
                  >
                    <View style={s.cover}>
                      <LinearGradient
                        colors={t.gradientColors}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 0.4, y: 1 }}
                        style={s.fill}
                      />
                      <View style={s.coverOrb} />
                    </View>
                    <Text style={[s.cardTitle, { color: c.text }]} numberOfLines={2}>
                      {t.title}
                    </Text>
                    <Text style={[s.cardMeta, { color: c.textMuted }]}>{durationOf(t, en)}</Text>
                  </Pressable>
                </Animated.View>
              );
            })}
          </View>
        )}
      </ScrollView>
      {entry.dialog}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20, width: "100%", maxWidth: 480, alignSelf: "center" },
  fill: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", height: 48 },
  back: { width: 44, height: 44, justifyContent: "center", marginLeft: -4 },
  title: { fontSize: 32, letterSpacing: -0.5, fontFamily: "Geologica_800ExtraBold", marginTop: 14 },
  subtitle: { fontSize: 14, fontFamily: "Geologica_500Medium", marginTop: 2 },

  search: {
    height: 48,
    borderRadius: 32,
    borderWidth: 2,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 20,
    paddingRight: 16,
    gap: 8,
    marginTop: 16,
  },
  searchInput: { flex: 1, height: 44, fontSize: 15, fontFamily: "Geologica_600SemiBold", padding: 0 },

  chipsScroll: { marginTop: 18, marginHorizontal: -20 },
  chips: { paddingHorizontal: 20, gap: 8 },
  chip: { height: 36, borderRadius: 18, borderWidth: 1, paddingHorizontal: 15, justifyContent: "center" },
  chipText: { fontSize: 13, fontFamily: "Geologica_700Bold" },

  featured: { height: 168, borderRadius: 24, overflow: "hidden", marginTop: 20 },
  featuredOrb: {
    position: "absolute",
    left: 190,
    top: -80,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  featuredBand: { position: "absolute", left: 0, right: 0, top: 78, bottom: 0 },
  tag: {
    position: "absolute",
    left: 18,
    top: 18,
    height: 23,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: "#18181A",
    justifyContent: "center",
  },
  tagText: { color: "#FFD857", fontSize: 10, letterSpacing: 0.4, fontFamily: "Geologica_800ExtraBold" },
  featuredBottom: {
    position: "absolute",
    left: 18,
    right: 18,
    bottom: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  featuredTitle: { color: "#FFFFFF", fontSize: 25, letterSpacing: -0.3, fontFamily: "Geologica_800ExtraBold" },
  featuredSub: { color: "rgba(255,255,255,0.9)", fontSize: 13, fontFamily: "Geologica_600SemiBold", marginTop: 2 },
  featuredPlay: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    paddingLeft: 2,
  },

  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 24,
    marginBottom: 14,
  },
  sectionTitle: { fontSize: 19, letterSpacing: -0.2, fontFamily: "Geologica_800ExtraBold" },
  sectionCount: { fontSize: 13, fontFamily: "Geologica_600SemiBold" },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  card: { height: 214, borderRadius: 22, borderWidth: 2, padding: 6, overflow: "hidden" },
  cover: { height: 128, borderRadius: 16, overflow: "hidden" },
  coverOrb: {
    position: "absolute",
    right: -34,
    top: -40,
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  cardTitle: { fontSize: 15, lineHeight: 18, fontFamily: "Geologica_700Bold", marginTop: 10, marginHorizontal: 6 },
  cardMeta: { position: "absolute", left: 12, bottom: 12, fontSize: 12, fontFamily: "Geologica_600SemiBold" },
  empty: { fontSize: 13, fontFamily: "Geologica_600SemiBold", marginTop: 24, textAlign: "center" },
});
