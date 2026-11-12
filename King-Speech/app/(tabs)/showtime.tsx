// Show Time tab — Figma "Screen / 03b · Show Time — full" (17:660 dark, 17:759 light).
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  ScrollView,
  TextInput,
  useWindowDimensions,
} from "react-native";
import OverscrollFill from "@/components/OverscrollFill";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { getSpeechThemes } from "@/app/showtime-stage";
import { useLang } from "@/context/LangContext";
import { useTheme } from "@/context/ThemeContext";
import { ThemeCoverGallery } from "@/components/showtime/ThemeCoverGallery";
import { ShowTimeLogo } from "@/components/showtime/ShowTimeLogo";
import { OpenCatalogIcon, SearchIcon } from "@/components/showtime/ShowTimeIcons";
import { ShowTimeModeTiles } from "@/components/showtime/ModeTiles";
import {
  THEME_CATEGORIES,
  categoryOf,
  type ThemeCategoryId,
} from "@/components/showtime/themeCategories";
import { ShowTimeStartButton, useShowTimeEntry } from "@/components/showtime/useShowTimeEntry";
import { subscribeShowTimeTheme, takePendingShowTimeTheme } from "@/components/showtime/themeSelection";

const CAROUSEL_COUNT = 10;
const COLLAPSED_TILES = 6;

// "#RRGGBB" + alpha → rgba() (used to fade the catalog veil into the card colour).
function withAlpha(hex: string, a: number) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const v = parseInt(m[1], 16);
  return `rgba(${(v >> 16) & 255},${(v >> 8) & 255},${v & 255},${a})`;
}

export default function ShowTimeScreen() {
  const insets = useSafeAreaInsets();
  const { lang } = useLang();
  const en = lang === "en";
  const { theme: c, themeMode } = useTheme();
  const isLight = themeMode === "light";
  const { width: winW } = useWindowDimensions();
  // First Show Time of the day is free; further entries cost coins.
  const entry = useShowTimeEntry();

  // Figma tokens not in ThemeContext.
  const stroke = isLight ? "rgba(38,38,40,0.08)" : "rgba(240,238,233,0.06)"; // stroke/shape
  const inkFaint = isLight ? "rgba(38,38,40,0.35)" : "rgba(240,238,233,0.35)"; // showtime/ink-faint
  const bgMid = isLight ? c.bgSecondary : "#2E2E30"; // showtime/bg-mid

  const [query, setQuery] = useState("");
  const [activeCat, setActiveCat] = useState<ThemeCategoryId>("popular");
  const [expanded, setExpanded] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const catalogY = useRef(0);

  const topPad = Platform.OS === "web" ? 54 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const speechThemes = getSpeechThemes(lang);
  const ALL_KEYS = useMemo(() => Object.keys(speechThemes), [speechThemes]);
  const BASE_KEYS = useMemo(() => ALL_KEYS.slice(0, CAROUSEL_COUNT), [ALL_KEYS]);
  const [selectedKey, setSelectedKey] = useState<string>(() => BASE_KEYS[0]);
  const safeKey = speechThemes[selectedKey] ? selectedKey : BASE_KEYS[0];

  // A theme picked on the full catalog screen (app/theme-catalog.tsx).
  useEffect(() => {
    const apply = (key: string) => {
      takePendingShowTimeTheme();
      setSelectedKey(key);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    };
    const pending = takePendingShowTimeTheme();
    if (pending) apply(pending);
    return subscribeShowTimeTheme(apply);
  }, []);

  // A theme picked from the catalog that is not among the "актуальные" ones is
  // put at the front of the carousel, so the carousel always holds the selection.
  const carouselKeys = useMemo(
    () => (BASE_KEYS.includes(safeKey) ? BASE_KEYS : [safeKey, ...BASE_KEYS.slice(0, CAROUSEL_COUNT - 1)]),
    [BASE_KEYS, safeKey],
  );
  const selectedIdx = Math.max(0, carouselKeys.indexOf(safeKey));
  const theme = speechThemes[safeKey];
  const randomSpeech = theme.speeches[0];

  const q = query.trim().toLowerCase();
  const catalogKeys = useMemo(() => {
    if (q) return ALL_KEYS.filter((k) => speechThemes[k].title.toLowerCase().includes(q));
    if (activeCat === "popular") return BASE_KEYS;
    return ALL_KEYS.filter((k) => categoryOf(k) === activeCat);
  }, [q, activeCat, ALL_KEYS, BASE_KEYS, speechThemes]);
  const canCollapse = catalogKeys.length > COLLAPSED_TILES;
  const showAll = expanded || !canCollapse;
  const visibleTiles = showAll ? catalogKeys : catalogKeys.slice(0, COLLAPSED_TILES);

  const cardW = Math.min(winW, 480) - 40;
  const tileSize = Math.floor((cardW - 4 - 34 - 16) / 3);

  const haptic = () => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
  };

  const handleCarouselSelect = (idx: number) => {
    const key = carouselKeys[idx];
    if (key) setSelectedKey(key);
    haptic();
  };

  const handleTilePress = (key: string) => {
    setSelectedKey(key);
    haptic();
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  const durationLine =
    theme.timerSeconds !== null
      ? en
        ? `${theme.timerSeconds} sec speech`
        : `${theme.timerSeconds} сек выступления`
      : en
        ? "1-2 min speech"
        : "1-2 мин выступления";

  return (
    <View style={[st.container, { backgroundColor: c.backingTop }]}>
      <ScrollView
        ref={scrollRef}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={st.scrollOuter}
        showsVerticalScrollIndicator={false}
      >
        <OverscrollFill top={c.bg} bottom={c.backingBottom} />
        {/* Top plate (Figma "Top panel" 374:1125): everything down to the catalog,
            rounded bottom corners 32, 1.5 pt panelStroke hairline. */}
        <View style={[st.plate, { borderColor: c.panelStroke, backgroundColor: c.bg }]}>
          <LinearGradient
            colors={[c.bg, bgMid, c.bg]}
            style={st.plateFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            pointerEvents="none"
          />
        <View style={[st.scroll, { paddingTop: topPad + 5, paddingBottom: 20 }]}>
        {/* Header: logo + search */}
        <Animated.View entering={FadeIn.duration(400)} style={st.headerRow}>
          <ShowTimeLogo width={83} color={isLight ? c.text : c.accent} />
          <View style={[st.search, { backgroundColor: c.cardBorder, borderColor: stroke }]}>
            <TextInput
              value={query}
              onChangeText={(v) => {
                setQuery(v);
                setExpanded(false);
              }}
              onSubmitEditing={() => scrollRef.current?.scrollTo({ y: catalogY.current - 12, animated: true })}
              placeholder={en ? "Find a topic" : "Найти тему"}
              placeholderTextColor={c.textMuted}
              returnKeyType="search"
              style={[st.searchInput, { color: c.text }, Platform.OS === "web" && ({ outlineStyle: "none" } as any)]}
            />
            <SearchIcon color={c.text} />
          </View>
        </Animated.View>

        <Text style={[st.sectionHeading, { color: c.text }]}>
          {en ? "Trending topics for you" : "Актуальные темы для вас"}
        </Text>

        <Animated.View entering={FadeInDown.delay(150).duration(400)} style={st.galleryBleed}>
          <ThemeCoverGallery
            themes={carouselKeys.map((k) => speechThemes[k])}
            selectedIdx={selectedIdx}
            onSelect={handleCarouselSelect}
          />
        </Animated.View>

        {/* Selected theme */}
        <View style={st.themeInfo}>
          <View style={st.titleRow}>
            <Text style={[st.themeTitle, { color: c.accentInk }]} numberOfLines={2}>
              {en ? `“${theme.title}”` : `«${theme.title}»`}
            </Text>
            <Text style={[st.counter, { color: inkFaint }]}>
              {selectedIdx + 1} / {carouselKeys.length}
            </Text>
          </View>
          <Text style={[st.desc, { color: c.textMuted }]}>{durationLine}</Text>
          {randomSpeech?.lines?.[0] ? (
            <Text style={[st.desc, { color: c.textMuted }]} numberOfLines={1}>
              {randomSpeech.lines[0]}
            </Text>
          ) : null}
        </View>

        <ShowTimeStartButton onPress={() => entry.start(theme.levelId)} free={entry.freeAvailable} en={en} />

        {/* Каталог тем */}
        <View
          onLayout={(e) => (catalogY.current = e.nativeEvent.layout.y)}
          style={[st.catalog, { backgroundColor: c.card, borderColor: stroke }]}
        >
          <View style={st.catalogHead}>
            <Text style={[st.catalogTitle, { color: c.text }]}>
              {q ? (en ? `Found: ${catalogKeys.length}` : `Найдено: ${catalogKeys.length}`) : en ? "Topic catalog" : "Каталог тем"}
            </Text>
            {/* ↗ opens the full catalog screen (Figma 399:1177). */}
            <Pressable hitSlop={10} onPress={() => router.push("/theme-catalog")} accessibilityRole="button">
              <OpenCatalogIcon color={c.text} />
            </Pressable>
          </View>

          {!q && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              alwaysBounceHorizontal={false}
              style={st.tabsScroll}
              contentContainerStyle={st.tabs}
            >
              {THEME_CATEGORIES.map((cat) => {
                const active = cat.id === activeCat;
                return (
                  <Pressable
                    key={cat.id}
                    onPress={() => {
                      setActiveCat(cat.id);
                      setExpanded(false);
                      haptic();
                    }}
                    style={st.tab}
                  >
                    <Text
                      style={[
                        st.tabText,
                        active
                          ? { color: c.text, fontFamily: "Geologica_800ExtraBold" }
                          : { color: c.textMuted, fontFamily: "Geologica_700Bold" },
                      ]}
                    >
                      {en ? cat.en : cat.ru}
                    </Text>
                    <View style={[st.tabUnderline, { backgroundColor: active ? c.accent : "transparent" }]} />
                  </Pressable>
                );
              })}
            </ScrollView>
          )}

          {catalogKeys.length === 0 ? (
            <Text style={[st.empty, { color: c.textMuted }]}>
              {en ? "Nothing found" : "Ничего не найдено"}
            </Text>
          ) : (
            <View style={st.grid}>
              {visibleTiles.map((k, i) => {
                const sel = k === safeKey;
                const tileBg = sel ? c.accent : i % 2 === 1 ? c.bg : c.cardBorder;
                return (
                  <Pressable
                    key={k}
                    onPress={() => handleTilePress(k)}
                    style={({ pressed }) => [
                      st.tile,
                      {
                        width: tileSize,
                        height: tileSize,
                        backgroundColor: tileBg,
                        borderColor: sel ? c.ctaStroke : stroke,
                        borderWidth: sel ? 4 : 2,
                        paddingLeft: sel ? 8 : 9,
                        paddingBottom: sel ? 10 : 12,
                        opacity: pressed ? 0.85 : 1,
                      },
                    ]}
                  >
                    <Text style={[st.tileText, { color: sel ? c.accentText : c.text }]} numberOfLines={3}>
                      {speechThemes[k].title}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          {canCollapse && !showAll && (
            <View pointerEvents="box-none" style={[st.veilWrap, { top: 17 + 22 + 14 + 27 + 18 + tileSize + 1 }]}>
              <LinearGradient
                pointerEvents="none"
                colors={[withAlpha(c.card, 0.2), withAlpha(c.card, 0.85), c.card]}
                locations={[0, 0.45, 1]}
                style={StyleSheet.absoluteFill}
              />
              <Pressable onPress={() => router.push("/theme-catalog")} style={st.seeAll} hitSlop={6}>
                <Text style={[st.seeAllText, { color: c.text }]}>
                  {en ? "See all topics" : "Смотреть все темы"}
                </Text>
              </Pressable>
            </View>
          )}
          {canCollapse && showAll && (
            <Pressable onPress={() => setExpanded(false)} style={[st.seeAll, st.seeAllInline]}>
              <Text style={[st.seeAllText, { color: c.text }]}>{en ? "Show less" : "Свернуть"}</Text>
            </Pressable>
          )}
        </View>
        </View>
        </View>

        {/* Backing (Figma 402:1303) under the plate: black in dark, #CFCECA→#FFFFFF in light. */}
        <View style={[st.backingWrap, { paddingBottom: bottomPad + 120 }]}>
          <LinearGradient
            colors={[c.backingTop, c.backingMid, c.backingBottom]}
            locations={[0, 0.65, 1]}
            style={st.backing}
            pointerEvents="none"
          />
          {/* Modes · bento (380:1122): «Роли» + «Подсказки» */}
          <View style={st.backingInner}>
            <ShowTimeModeTiles
              mode={isLight ? "light" : "dark"}
              en={en}
              onRoles={() => router.push("/roles")}
              onHints={() => router.push("/speaker-tips")}
            />
          </View>
        </View>
      </ScrollView>

      {entry.dialog}
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1 },
  scrollOuter: { flexGrow: 1 },
  plate: {
    borderWidth: 1.5,
    borderTopWidth: 0,
    marginHorizontal: -1.5,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    overflow: "hidden",
    zIndex: 1,
  },
  plateFill: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  scroll: { paddingHorizontal: 20, width: "100%", maxWidth: 480, alignSelf: "center" },
  // The cover flow spans the full content width (outer cards cut by the screen edges).
  galleryBleed: { marginHorizontal: -20 },
  backingWrap: { flexGrow: 1, paddingTop: 28 },
  backing: { position: "absolute", top: -40, left: 0, right: 0, bottom: 0 },
  backingInner: { paddingHorizontal: 20, width: "100%", maxWidth: 480, alignSelf: "center" },

  headerRow: { flexDirection: "row", alignItems: "center", gap: 15, paddingLeft: 4, marginBottom: 8 },
  search: {
    flex: 1,
    height: 44,
    borderRadius: 32,
    borderWidth: 2,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 17,
    paddingRight: 17,
    gap: 8,
  },
  searchInput: { flex: 1, height: 40, fontSize: 15, fontFamily: "Geologica_600SemiBold", padding: 0 },

  sectionHeading: { fontSize: 16, fontFamily: "Geologica_800ExtraBold", textAlign: "center", marginBottom: 2 },

  themeInfo: { paddingHorizontal: 4, marginTop: 8 },
  titleRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 6 },
  themeTitle: { flex: 1, fontSize: 24, letterSpacing: -0.12, fontFamily: "Geologica_800ExtraBold" },
  counter: { fontSize: 11, fontFamily: "Geologica_400Regular", marginTop: 10 },
  desc: { fontSize: 13, lineHeight: 15.6, fontFamily: "Geologica_600SemiBold" },

  catalog: {
    marginTop: 32,
    borderRadius: 22,
    borderWidth: 2,
    paddingTop: 15,
    paddingHorizontal: 17,
    paddingBottom: 29,
    overflow: "hidden",
  },
  catalogHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", height: 22 },
  catalogTitle: { fontSize: 18, letterSpacing: -0.09, fontFamily: "Geologica_800ExtraBold" },
  tabsScroll: { marginTop: 14, marginHorizontal: -17 },
  tabs: { paddingHorizontal: 17, gap: 20 },
  tab: { alignItems: "stretch" },
  tabText: { fontSize: 14, lineHeight: 18 },
  tabUnderline: { height: 3, borderRadius: 1.5, marginTop: 6 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 18 },
  tile: { borderRadius: 22, overflow: "hidden", justifyContent: "flex-end" },
  tileText: { fontSize: 12, lineHeight: 13, fontFamily: "Geologica_800ExtraBold" },
  empty: { fontSize: 13, fontFamily: "Geologica_600SemiBold", marginTop: 24, textAlign: "center" },
  veilWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: 13,
  },
  seeAll: { height: 44, paddingLeft: 22, paddingRight: 20, borderRadius: 32, justifyContent: "center" },
  seeAllInline: { alignSelf: "center", marginTop: 12, marginBottom: -16 },
  seeAllText: { fontSize: 15, fontFamily: "Geologica_800ExtraBold" },
});
