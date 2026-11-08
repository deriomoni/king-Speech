// Show Time tab — Figma "Screen / 03b · Show Time — full" (17:660 dark, 17:759 light).
import React, { useMemo, useRef, useState } from "react";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { getSpeechThemes } from "@/app/showtime-stage";
import { useLang } from "@/context/LangContext";
import { useTheme } from "@/context/ThemeContext";
import { useGame } from "@/context/GameContext";
import { ThemeCoverGallery } from "@/components/showtime/ThemeCoverGallery";
import { ShowTimeLogo } from "@/components/showtime/ShowTimeLogo";
import {
  ChevronForwardIcon,
  OpenCatalogIcon,
  PlayCircleIcon,
  RolesMaskIcon,
  SearchIcon,
  TipBubbleIcon,
} from "@/components/showtime/ShowTimeIcons";
import {
  THEME_CATEGORIES,
  categoryOf,
  type ThemeCategoryId,
} from "@/components/showtime/themeCategories";
import CoinIcon from "@/components/CoinIcon";
import StageGlassDialog from "@/components/showtime/StageGlassDialog";
import MatteGlass from "@/components/MatteGlass";

const CAROUSEL_COUNT = 10;
const COLLAPSED_TILES = 6;
const SHOW_TIME_COST = 50;

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
  const { coins, showTimeFreeAvailable, consumeShowTimeFree, spendCoins } = useGame();

  // Figma tokens not in ThemeContext.
  const stroke = isLight ? "rgba(38,38,40,0.08)" : "rgba(240,238,233,0.06)"; // stroke/shape
  const inkFaint = isLight ? "rgba(38,38,40,0.35)" : "rgba(240,238,233,0.35)"; // showtime/ink-faint
  const inkSub = isLight ? "rgba(38,38,40,0.7)" : "rgba(240,238,233,0.7)"; // showtime/ink-sub
  const bgMid = isLight ? c.bgSecondary : "#2E2E30"; // showtime/bg-mid

  const [payModal, setPayModal] = useState(false);
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

  const goToStage = () => {
    router.push({
      pathname: "/showtime-stage",
      params: { levelId: theme.levelId, mode: "trainer" },
    });
  };

  const handleStart = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // First Show Time of the day is free; further entries cost coins.
    if (showTimeFreeAvailable) {
      consumeShowTimeFree();
      goToStage();
    } else {
      setPayModal(true);
    }
  };

  const canPay = coins >= SHOW_TIME_COST;
  const confirmPaidEntry = () => {
    if (spendCoins(SHOW_TIME_COST)) {
      setPayModal(false);
      goToStage();
    }
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
    <View style={[st.container, { backgroundColor: c.bg }]}>
      <LinearGradient
        colors={[c.bg, bgMid, c.bg]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <ScrollView
        ref={scrollRef}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[st.scroll, { paddingTop: topPad + 5, paddingBottom: bottomPad + 120 }]}
        showsVerticalScrollIndicator={false}
      >
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

        <Animated.View entering={FadeInDown.delay(150).duration(400)}>
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

        <Pressable
          onPress={handleStart}
          style={({ pressed }) => [
            st.startBtn,
            { backgroundColor: c.accent, borderColor: c.ctaStroke, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <PlayCircleIcon color="#3A3A3B" />
          <Text style={st.startBtnText}>{en ? "Start performance" : "Начать выступление"}</Text>
          {showTimeFreeAvailable ? null : (
            <View style={st.startBtnCost}>
              <Text style={st.startBtnCostText}>{SHOW_TIME_COST}</Text>
              <CoinIcon size={16} color="#3A3A3B" />
            </View>
          )}
        </Pressable>

        {/* Каталог тем */}
        <View
          onLayout={(e) => (catalogY.current = e.nativeEvent.layout.y)}
          style={[st.catalog, { backgroundColor: c.cardGlass, borderColor: stroke, overflow: "hidden", zIndex: 0 }]}
        >
          <MatteGlass radius={22} />
          <View style={st.catalogHead}>
            <Text style={[st.catalogTitle, { color: c.text }]}>
              {q ? (en ? `Found: ${catalogKeys.length}` : `Найдено: ${catalogKeys.length}`) : en ? "Topic catalog" : "Каталог тем"}
            </Text>
            {/* TODO(design): ↗ should open the full catalog screen (Flows 175:1940); until it exists it expands the grid. */}
            <Pressable hitSlop={10} onPress={() => setExpanded((v) => !v)} accessibilityRole="button">
              <OpenCatalogIcon color={c.text} />
            </Pressable>
          </View>

          {!q && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
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
              <Pressable onPress={() => setExpanded(true)} style={st.seeAll} hitSlop={6}>
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

        {/* Роли */}
        <Pressable
          onPress={() => {
            if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            router.push("/roles");
          }}
          style={({ pressed }) => [st.rolesEntry, { opacity: pressed ? 0.85 : 1 }]}
        >
          <RolesMaskIcon color={c.text} />
          <View style={{ flex: 1 }}>
            <Text style={[st.rolesTitle, { color: c.text }]}>{en ? "Roles" : "Роли"}</Text>
            <Text style={[st.rolesSub, { color: inkSub }]}>
              {en ? "Play a character & train adaptability" : "Играй персонажа и тренируй адаптивность"}
            </Text>
          </View>
          <ChevronForwardIcon color={inkFaint} />
        </Pressable>

        {/* Советы выступающему — card deck */}
        <Pressable
          onPress={() => {
            if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push("/speaker-tips");
          }}
          style={({ pressed }) => [st.deck, { opacity: pressed ? 0.85 : 1 }]}
          accessibilityRole="button"
        >
          <View style={[st.deckCard, st.deckBack2, { backgroundColor: c.card, borderColor: stroke }]} />
          <View style={[st.deckCard, st.deckBack1, { backgroundColor: c.card, borderColor: stroke }]} />
          <View style={[st.deckCard, st.deckFront, { backgroundColor: c.card, borderColor: stroke, overflow: "hidden", zIndex: 0 }]}>
            <MatteGlass radius={22} />
            <View style={[st.tipBadge, { backgroundColor: c.accent }]}>
              <TipBubbleIcon color={c.accentText} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[st.tipsTitle, { color: c.text }]} numberOfLines={1}>
                {en ? "Speaker tips" : "Советы выступающему"}
              </Text>
              <Text style={[st.tipsSub, { color: c.textMuted }]} numberOfLines={1}>
                {en ? "Pauses, voice, gestures and the room" : "Паузы, голос, жесты и работа с залом"}
              </Text>
            </View>
            <View style={{ marginLeft: -12 }}>
              <ChevronForwardIcon color={inkFaint} />
            </View>
          </View>
        </Pressable>
      </ScrollView>

      {/* Figma 37:4261 «Ещё один выход (50 монет)» / 37:3896 «Не хватает монет»:
          Liquid Glass card, cost line with a coin, "Выйти · 50 🪙" — disabled
          (secondary look) when the balance is short. */}
      <StageGlassDialog
        visible={payModal}
        title={en ? "Enter Show Time again?" : "Ещё один выход в Show Time?"}
        message={
          canPay
            ? en
              ? "Today's free entry is used."
              : "Бесплатный выход на сегодня использован."
            : en
              ? "Not enough coins — earn them by finishing levels."
              : "Не хватает монет - зарабатывайте их, проходя уровни."
        }
        overlay={0.6}
        onRequestClose={() => setPayModal(false)}
        buttons={[
          { label: en ? "Cancel" : "Отмена", variant: "secondary", onPress: () => setPayModal(false) },
          {
            label: en ? "Enter ·" : "Выйти ·",
            variant: "primary",
            disabled: !canPay,
            onPress: confirmPaidEntry,
            trailing: (
              <View style={st.payTrail}>
                <Text
                  style={[
                    st.payTrailText,
                    { color: canPay ? c.accentText : "rgba(240,238,233,0.35)" },
                  ]}
                >
                  {SHOW_TIME_COST}
                </Text>
                <CoinIcon size={20} color={canPay ? c.accentText : "rgba(240,238,233,0.35)"} />
              </View>
            ),
          },
        ]}
      >
        <View style={st.payCostRow}>
          <Text style={[st.payCostLabel, { color: isLight ? "rgba(38,38,40,0.6)" : "rgba(240,238,233,0.6)" }]}>
            {en ? "This entry costs" : "Этот выход стоит"}
          </Text>
          <Text style={[st.payCostValue, { color: isLight ? "rgba(38,38,40,0.9)" : "rgba(240,238,233,0.9)" }]}>
            {SHOW_TIME_COST}
          </Text>
          <CoinIcon size={16} color={c.accent} />
        </View>
      </StageGlassDialog>
    </View>
  );
}

const st = StyleSheet.create({
  // Pay-for-entry dialog (cost line + coin trailing on the CTA).
  payCostRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 },
  payCostLabel: { fontFamily: "Geologica_600SemiBold", fontSize: 14 },
  payCostValue: { fontFamily: "Geologica_900Black", fontSize: 14 },
  payTrail: { flexDirection: "row", alignItems: "center", gap: 6 },
  payTrailText: { fontFamily: "Geologica_900Black", fontSize: 16 },
  container: { flex: 1 },
  scroll: { paddingHorizontal: 20, width: "100%", maxWidth: 480, alignSelf: "center" },

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

  startBtn: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    height: 50,
    borderRadius: 32,
    borderWidth: 4,
    paddingLeft: 13.5,
    paddingRight: 20,
    gap: 8,
    marginTop: 33,
  },
  startBtnText: { color: "#3A3A3B", fontSize: 16, fontFamily: "Geologica_700Bold" },
  startBtnCost: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginLeft: 2,
    paddingLeft: 10,
    borderLeftWidth: 1.5,
    borderLeftColor: "rgba(58,58,59,0.22)",
  },
  startBtnCostText: { color: "#3A3A3B", fontSize: 16, fontFamily: "Geologica_800ExtraBold" },

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

  rolesEntry: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    height: 72,
    paddingLeft: 16,
    paddingRight: 14,
    marginTop: 24,
  },
  rolesTitle: { fontSize: 18, letterSpacing: -0.09, fontFamily: "Geologica_800ExtraBold" },
  rolesSub: { fontSize: 13, lineHeight: 18.2, fontFamily: "Geologica_400Regular", marginTop: 4, maxWidth: 249 },

  deck: { height: 88, marginTop: 14 },
  deckCard: { position: "absolute", height: 72, borderRadius: 22, borderWidth: 2 },
  deckBack2: { left: 24, right: 24, top: 16, opacity: 0.35 },
  deckBack1: { left: 12, right: 12, top: 8, opacity: 0.65 },
  deckFront: {
    left: 0,
    right: 0,
    top: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 12,
    paddingRight: 14,
    gap: 14,
  },
  tipBadge: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  tipsTitle: { fontSize: 16, fontFamily: "Geologica_700Bold" },
  tipsSub: { fontSize: 13, fontFamily: "Geologica_400Regular", marginTop: 4 },
});
