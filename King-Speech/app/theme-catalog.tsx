// «Каталог тем» — Figma "Screen / 03c · Каталог тем" (399:1177 dark, Light mode instance).
// Full Show Time theme catalog: search, category chips, «Тема недели» featured
// card and a 2-column grid of gradient covers. Tapping a theme opens that
// theme's «Превью темы» right away (showtime-stage starts on it); the free
// entry / coin payment happens only on the preview's start button. Closing the
// preview comes back here.
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  TextInput,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "@/lib/haptics";
import { getSpeechThemes, type SpeechTheme } from "@/app/showtime-stage";
import { useLang, pickLang, type Lang } from "@/context/LangContext";
import { useTheme } from "@/context/ThemeContext";
import { ShowTimeLogo } from "@/components/showtime/ShowTimeLogo";
import { PlayTriangleIcon, SearchIcon } from "@/components/showtime/ShowTimeIcons";
import { openShowTimeStage } from "@/components/showtime/useShowTimeEntry";
import { showtimeCover, showtimeCoverFocusY } from "@/constants/showtimeCovers";
import CoverImage from "@/components/showtime/CoverImage";
import { CoverFlight, previewRect, type CoverRect } from "@/components/showtime/CoverFlight";
import { markFlightLaunch, subscribeFlightReturn } from "@/components/showtime/coverFlightStore";
import { THEME_CATEGORIES, categoryOf, type ThemeCategoryId } from "@/components/showtime/themeCategories";
import { rs } from "@/lib/responsive";
import Svg, { Path } from "react-native-svg";

/**
 * One outline around cover + name plate: the cover's squircle top, straight
 * sides running down past the cover, softly rounded bottom corners. Same
 * squircle as CoverImage (corner reach 0.42·w, control offset 0.14·reach).
 */
function cardOutline(w: number, h: number, bottomR: number, inset: number) {
  const r = w * 0.42;
  const t = r * 0.14;
  const x0 = inset, y0 = inset, x1 = w - inset, y1 = h - inset;
  const R = bottomR - inset;
  const n = (v: number) => v.toFixed(2);
  return [
    `M ${n(r)} ${n(y0)}`,
    `L ${n(w - r)} ${n(y0)}`,
    `C ${n(w - t)} ${n(y0)} ${n(x1)} ${n(t)} ${n(x1)} ${n(r)}`,
    `L ${n(x1)} ${n(y1 - R)}`,
    `Q ${n(x1)} ${n(y1)} ${n(x1 - R)} ${n(y1)}`,
    `L ${n(x0 + R)} ${n(y1)}`,
    `Q ${n(x0)} ${n(y1)} ${n(x0)} ${n(y1 - R)}`,
    `L ${n(x0)} ${n(r)}`,
    `C ${n(x0)} ${n(t)} ${n(t)} ${n(y0)} ${n(r)} ${n(y0)}`,
    "Z",
  ].join(" ");
}

const POPULAR_COUNT = 10;

function durationOf(t: SpeechTheme, lang: Lang) {
  const en = lang === "en";
  if (t.timerSeconds !== null) return en ? `${t.timerSeconds} sec` : `${t.timerSeconds} сек`;
  return en ? "1–2 min" : "1–2 мин";
}

function themesWord(n: number, lang: Lang) {
  if (lang === "en") return n === 1 ? "topic" : "topics";
  if (lang === "kk") return "тақырып";
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
  const tr = (ru: string, en: string, kk: string) => pickLang(lang, { ru, en, kk });
  const { theme: c, themeMode } = useTheme();
  const isLight = themeMode === "light";
  const { width: winW } = useWindowDimensions();

  const stroke = isLight ? "rgba(38,38,40,0.08)" : "rgba(240,238,233,0.06)";
  // Name plate (like the reference's beige block): no card frame any more —
  // the cover sits on top of a rounded plate that starts behind its lower part
  // and shows in the squircle's bottom corners. Dark plate in dark, light in light.
  const plate = isLight ? "#EFEDE8" : "#2A2A2C";
  const strokeLine = isLight ? "rgba(38,38,40,0.12)" : "rgba(240,238,233,0.10)";
  const topPad = Platform.OS === "web" ? rs(54) : insets.top;
  const bottomPad = Platform.OS === "web" ? rs(34) : insets.bottom;

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

  // Mirrors s.content (maxWidth 480, paddingHorizontal 20) and s.grid gap 12,
  // which StyleSheet auto-scales on tablets.
  const contentW = Math.min(winW, rs(480)) - rs(40);
  const cardW = Math.floor((contentW - rs(12)) / 2);
  // square cover + room for two title lines and the meta
  // title (≤2 lines × 16) starts 9 under the cover; the meta (≈13 tall) sits
  // 10 from the bottom — 70 keeps a 4pt gap even with a two-line title
  const cardH = cardW + rs(70);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/showtime");
  };

  // A tapped cover flies into the theme preview; the preview's X flies it back.
  const coverRefs = useRef<Record<string, View | null>>({});
  const lastTap = useRef<{ ref: string; radius: number } | null>(null);
  const [flight, setFlight] = useState<
    { levelId: string; cover: CoverRect; radius: number; dir: "out" | "back" } | null
  >(null);
  const stagePad = Platform.OS === "web" ? rs(67) : insets.top; // the stage screen's top inset
  useFocusEffect(
    React.useCallback(() => {
      setFlight((f) => (f?.dir === "back" ? f : null));
    }, []),
  );
  const measure = (ref: string, cb: (r: CoverRect) => void) => {
    const node = coverRefs.current[ref];
    if (!node) return false;
    node.measureInWindow((x, y, w, h) => cb({ x, y, w, h }));
    return true;
  };
  useEffect(
    () =>
      subscribeFlightReturn((origin, levelId) => {
        const tap = lastTap.current;
        if (origin !== "catalog" || !tap) return;
        measure(tap.ref, (cover) => setFlight({ levelId, cover, radius: tap.radius, dir: "back" }));
      }),
    [],
  );
  const pick = (key: string, ref: string = key, radius = rs(16)) => { // radius matches s.cover (auto-scaled)
    const t = speechThemes[key];
    if (!t || flight) return;
    lastTap.current = { ref, radius };
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const ok = measure(ref, (cover) => setFlight({ levelId: t.levelId, cover, radius, dir: "out" }));
    if (!ok) openShowTimeStage(t.levelId);
  };
  const onFlightDone = () => {
    if (!flight) return;
    if (flight.dir === "out") {
      markFlightLaunch("catalog", flight.levelId);
      openShowTimeStage(flight.levelId);
    } else {
      setFlight(null);
    }
  };

  return (
    <View style={[s.container, { backgroundColor: c.bg }]}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.content, { paddingTop: topPad + rs(8), paddingBottom: bottomPad + rs(40) }]}
      >
        {/* Back chevron (no circle) + Show Time logo */}
        <View style={s.topRow}>
          <Pressable onPress={goBack} hitSlop={12} style={s.back} accessibilityRole="button">
            <Ionicons name="chevron-back" size={rs(26)} color={c.text} />
          </Pressable>
          <ShowTimeLogo width={rs(83)} color={isLight ? c.text : c.accent} />
        </View>

        <Text style={[s.title, { color: c.text }]}>{tr("Каталог тем", "Topic catalog", "Тақырыптар каталогы")}</Text>
        <Text style={[s.subtitle, { color: c.textMuted }]}>
          {tr("Выбери тему и выходи на сцену", "Pick a topic and take the stage", "Тақырып таңдап, сахнаға шығыңыз")}
        </Text>

        <View style={[s.search, { backgroundColor: c.card, borderColor: stroke }]}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={tr("Найти тему", "Find a topic", "Тақырып іздеу")}
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
                    {pickLang(lang, cat)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        {/* «Тема недели» */}
        {featured && featuredKey && !q && (
          <Animated.View entering={FadeInDown.delay(80).duration(400)}>
            <Pressable
              ref={(n) => {
                coverRefs.current["featured"] = n as unknown as View | null;
              }}
              onPress={() => pick(featuredKey, "featured", rs(24))}
              style={s.featured}
            >
              <CoverImage source={showtimeCover(featuredKey)} focusY={showtimeCoverFocusY(featuredKey)} shape="squircle" shadeFrom={0.45} />
              <View style={s.tag}>
                <Text style={s.tagText}>{tr("ТЕМА НЕДЕЛИ", "TOPIC OF THE WEEK", "АПТА ТАҚЫРЫБЫ")}</Text>
              </View>
              <View style={s.featuredBottom}>
                <View style={{ flex: 1 }}>
                  <Text style={s.featuredTitle} numberOfLines={1}>
                    {lang === "en" ? `“${featured.title}”` : `«${featured.title}»`}
                  </Text>
                  <Text style={s.featuredSub} numberOfLines={1}>
                    {durationOf(featured, lang)}
                    {tr(" · идеально для старта", " · perfect to start", " · бастау үшін тамаша")}
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
            {q ? tr("Найдено", "Found", "Табылды") : tr("Все темы", "All topics", "Барлық тақырыптар")}
          </Text>
          <Text style={[s.sectionCount, { color: c.textMuted }]}>
            {keys.length} {themesWord(keys.length, lang)}
          </Text>
        </View>

        {keys.length === 0 ? (
          <Text style={[s.empty, { color: c.textMuted }]}>{tr("Ничего не найдено", "Nothing found", "Ештеңе табылмады")}</Text>
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
                      // square cover + room for two title lines and the meta
                      { width: cardW, height: cardH, opacity: pressed ? 0.85 : 1 },
                    ]}
                  >
                    <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width={cardW} height={cardH}>
                      <Path d={cardOutline(cardW, cardH, rs(30), 0)} fill={plate} />
                    </Svg>
                    <View
                      ref={(n) => {
                        coverRefs.current[k] = n;
                      }}
                      collapsable={false}
                      style={s.cover}
                    >
                      <CoverImage source={showtimeCover(k)} focusY={showtimeCoverFocusY(k)} shape="squircle" />
                    </View>
                    <Text style={[s.cardTitle, { color: c.text }]} numberOfLines={2}>
                      {t.title}
                    </Text>
                    <Text style={[s.cardMeta, { color: c.textMuted }]}>{durationOf(t, lang)}</Text>
                    {/* the outline goes over the cover so it rings both shapes as one */}
                    <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width={cardW} height={cardH}>
                      <Path d={cardOutline(cardW, cardH, rs(30), 0.75)} fill="none" stroke={strokeLine} strokeWidth={1.5} />
                    </Svg>
                  </Pressable>
                </Animated.View>
              );
            })}
          </View>
        )}
      </ScrollView>
      {flight && (
        <CoverFlight
          key={flight.levelId + flight.dir}
          source={showtimeCover(flight.levelId)}
          cover={flight.cover}
          coverRadius={flight.radius}
          preview={previewRect(winW, stagePad)}
          direction={flight.dir}
          delay={flight.dir === "back" ? 320 : 0}
          bg={c.bg}
          onDone={onFlightDone}
        />
      )}
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

  featured: { aspectRatio: 1, marginTop: 20 },
  featuredOrb: {
    position: "absolute",
    left: 190,
    top: -80,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  featuredBand: { position: "absolute", left: 0, right: 0, top: 40, bottom: 0 },
  tag: {
    position: "absolute",
    left: 34,
    top: 30,
    height: 23,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: "#18181A",
    justifyContent: "center",
  },
  tagText: { color: "#FFD857", fontSize: 10, letterSpacing: 0.4, fontFamily: "Geologica_800ExtraBold" },
  featuredBottom: {
    position: "absolute",
    left: 34,
    right: 36,
    bottom: 36,
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
  card: {},
  photo: { position: "absolute", left: 0, top: 0, right: 0, bottom: 0, width: "100%", height: "100%" },
  cover: { aspectRatio: 1 },
  coverOrb: {
    position: "absolute",
    right: -34,
    top: -40,
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  cardTitle: { fontSize: 13, lineHeight: 16, fontFamily: "Geologica_700Bold", marginTop: 9, marginHorizontal: 12 },
  cardMeta: { position: "absolute", left: 12, bottom: 10, fontSize: 10, fontFamily: "Geologica_600SemiBold" },
  empty: { fontSize: 13, fontFamily: "Geologica_600SemiBold", marginTop: 24, textAlign: "center" },
});
