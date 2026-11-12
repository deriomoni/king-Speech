// «Монеты» — Figma "Screen / 10 · Купить монеты" (450:2332 dark, Light mode instance).
// Plate with Oscar + the gold coin stack and the real balance, then «Пополнить»
// packs, «Бесплатные монеты» and the «На что потратить» price list on the backing.
// Payments are NOT implemented: every purchase button is a TODO(payments) no-op
// and the prices are the Figma placeholders.
import React from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Platform, Image, useWindowDimensions } from "react-native";
import OverscrollFill from "@/components/OverscrollFill";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Svg, { Circle, Path, SvgXml } from "react-native-svg";
import { useGame } from "@/context/GameContext";
import { useLang } from "@/context/LangContext";
import { useTheme } from "@/context/ThemeContext";
import { COINS, themedSvg } from "@/assets/figma/profile/tiles";

const OSCAR_HAPPY = require("@/assets/figma/levels/oscar-happy.png");
const GOLD = "#FFD857";

// One gold coin with the crown mark (no bar under the crown).
function Coin({ size = 28 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 28 28">
      <Circle cx={14} cy={14} r={13.1} fill={GOLD} stroke="#E3A92B" strokeWidth={1.8} />
      <Circle cx={14} cy={14} r={10.4} fill="none" stroke="rgba(207,144,14,0.35)" strokeWidth={1} />
      <Path
        d="M7.6 10.4l3.1 3.1 3.3-5.1 3.3 5.1 3.1-3.1-1.1 7.2H8.7z"
        fill="#CF900E"
        stroke="#CF900E"
        strokeWidth={1.1}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// 1–3 overlapping coins, offsets from the Figma pack icons (40×40 frame).
function CoinPile({ count }: { count: 1 | 2 | 3 }) {
  const spots =
    count === 1
      ? [{ x: 6, y: 8 }]
      : count === 2
        ? [
            { x: 6, y: 10 },
            { x: 9, y: 6 },
          ]
        : [
            { x: 6, y: 12 },
            { x: 9, y: 8 },
            { x: 12, y: 4 },
          ];
  return (
    <View style={{ width: 44, height: 40 }}>
      {spots.map((p, i) => (
        <View key={i} style={{ position: "absolute", left: p.x, top: p.y }}>
          <Coin />
        </View>
      ))}
    </View>
  );
}

type Pack = { coins: number; price: string; pile: 1 | 2 | 3; badge?: { ru: string; en: string; kind: "popular" | "plain" } };

// TODO(payments): placeholder prices exactly as in Figma; replace with store products.
const PACKS: Pack[] = [
  { coins: 100, price: "0,99 $", pile: 1 },
  { coins: 300, price: "2,49 $", pile: 2, badge: { ru: "Популярно", en: "Popular", kind: "popular" } },
  { coins: 700, price: "4,99 $", pile: 3, badge: { ru: "+15%", en: "+15%", kind: "plain" } },
  { coins: 1500, price: "8,99 $", pile: 3, badge: { ru: "Выгодно", en: "Best value", kind: "plain" } },
];

const SPEND: { ru: string; en: string; cost: number }[] = [
  { ru: "Подсказка в словарике", en: "Vocabulary hint", cost: 15 },
  { ru: "Другой вопрос в интервью", en: "Another interview question", cost: 30 },
  { ru: "Время ×2", en: "Time ×2", cost: 25 },
  { ru: "Новая тема Show Time", en: "New Show Time topic", cost: 50 },
];

function coinsWord(n: number, en: boolean) {
  if (en) return n === 1 ? "coin" : "coins";
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return "монета";
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return "монеты";
  return "монет";
}

export default function CoinsScreen() {
  const insets = useSafeAreaInsets();
  const { lang } = useLang();
  const en = lang === "en";
  const { theme: c } = useTheme();
  const mode = c.mode;
  const { coins } = useGame();
  const { width: winW } = useWindowDimensions();

  const topPad = Platform.OS === "web" ? 54 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const contentW = Math.min(winW, 480) - 48;
  const packW = Math.floor((contentW - 12) / 2);
  const darkPill = mode === "dark" ? "rgba(240,238,233,0.10)" : "rgba(38,38,40,0.08)";

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/profile");
  };

  const buy = (_pack: Pack) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    // TODO(payments): start the in-app purchase for this pack.
  };

  const watchAd = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    // TODO(payments): rewarded video → addCoins(10).
  };

  return (
    <View style={[s.container, { backgroundColor: c.backingTop }]}>
      <ScrollView contentContainerStyle={s.scrollOuter} showsVerticalScrollIndicator={false}>
        <OverscrollFill top={c.bg} bottom={c.backingBottom} />
        {/* Top plate (Figma "Top panel" 450:2334) */}
        <View style={[s.plate, { backgroundColor: c.bg, borderColor: c.panelStroke, paddingTop: topPad + 10 }]}>
          <Pressable onPress={goBack} hitSlop={12} style={[s.back, { top: topPad + 10 }]} accessibilityRole="button">
            <Ionicons name="chevron-back" size={26} color={c.text} />
          </Pressable>
          <Text style={[s.title, { color: c.text }]}>{en ? "Coins" : "Монеты"}</Text>

          <Animated.View entering={FadeInDown.delay(60).duration(420)} style={s.hero}>
            <Image source={OSCAR_HAPPY} style={s.oscar} resizeMode="contain" />
            <SvgXml xml={themedSvg(COINS, mode)} width={162} height={98} style={s.stack} />
          </Animated.View>

          <View style={s.balanceRow}>
            <Text style={[s.balance, { color: c.text }]}>{coins}</Text>
            <Text style={[s.balanceUnit, { color: c.textMuted }]}>{coinsWord(coins, en)}</Text>
          </View>
          <Text style={[s.balanceLbl, { color: c.textMuted }]}>{en ? "Your balance" : "Твой баланс"}</Text>
        </View>

        {/* Backing (Figma 450:2333) */}
        <View style={[s.body, { paddingBottom: bottomPad + 40 }]}>
          <LinearGradient
            colors={[c.backingTop, c.backingMid, c.backingBottom]}
            locations={[0, 0.65, 1]}
            style={s.backing}
            pointerEvents="none"
          />

          <Text style={[s.section, { color: c.text }]}>{en ? "Top up" : "Пополнить"}</Text>
          <View style={s.packs}>
            {PACKS.map((p, i) => {
              const popular = p.badge?.kind === "popular";
              return (
                <Animated.View key={p.coins} entering={FadeInDown.delay(120 + i * 50).duration(380)}>
                  <Pressable
                    onPress={() => buy(p)}
                    style={({ pressed }) => [
                      s.pack,
                      {
                        width: packW,
                        borderColor: popular ? GOLD : c.tileStroke,
                        borderWidth: popular ? 2 : 1,
                        opacity: pressed ? 0.9 : 1,
                      },
                    ]}
                  >
                    <LinearGradient colors={[c.tileTop, c.tileBottom]} style={s.fill} pointerEvents="none" />
                    <View style={s.packTop}>
                      <CoinPile count={p.pile} />
                      {p.badge && (
                        <View style={[s.badge, { backgroundColor: popular ? GOLD : darkPill }]}>
                          <Text style={[s.badgeText, { color: popular ? "#262628" : c.textSecondary }]}>
                            {en ? p.badge.en : p.badge.ru}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={[s.packCoins, { color: c.text }]}>{p.coins}</Text>
                    <Text style={[s.packUnit, { color: c.textMuted }]}>{coinsWord(p.coins, en)}</Text>
                    <View style={[s.price, { backgroundColor: mode === "dark" ? "#F0EEE9" : "#FFFFFF" }]}>
                      <Text style={s.priceText}>{p.price}</Text>
                    </View>
                  </Pressable>
                </Animated.View>
              );
            })}
          </View>

          {/* «Бесплатные монеты» — same staggered entrance as the packs */}
          <Animated.View entering={FadeInDown.delay(120 + PACKS.length * 50).duration(380)}>
          <Pressable
            onPress={watchAd}
            style={({ pressed }) => [s.free, { borderColor: c.tileStroke, opacity: pressed ? 0.9 : 1 }]}
          >
            <LinearGradient colors={[c.tileTop, c.tileBottom]} style={s.fill} pointerEvents="none" />
            <View style={[s.freePlay, { backgroundColor: mode === "dark" ? "#18181A" : c.text }]}>
              <Ionicons name="play" size={16} color="#F0EEE9" style={{ marginLeft: 2 }} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.freeTitle, { color: c.text }]}>{en ? "Free coins" : "Бесплатные монеты"}</Text>
              <Text style={[s.freeSub, { color: c.textMuted }]}>
                {en ? "Watch a short video" : "Посмотри короткое видео"}
              </Text>
            </View>
            <View style={s.freePill}>
              <Text style={s.freePillText}>+10</Text>
            </View>
          </Pressable>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(120 + (PACKS.length + 1) * 50).duration(380)}>
          <Text style={[s.section, { color: c.text, marginTop: 28 }]}>{en ? "What to spend on" : "На что потратить"}</Text>
          <View style={[s.spend, { borderColor: c.tileStroke }]}>
            <LinearGradient colors={[c.tileTop, c.tileBottom]} style={s.fill} pointerEvents="none" />
            {SPEND.map((row, i) => (
              <View key={row.ru}>
                {i > 0 && <View style={[s.divider, { backgroundColor: c.divider }]} />}
                <View style={s.spendRow}>
                  <Text style={[s.spendLabel, { color: c.text }]}>{en ? row.en : row.ru}</Text>
                  <View style={s.spendCost}>
                    <Coin size={14} />
                    <Text style={[s.spendCostText, { color: c.text }]}>{row.cost}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
          </Animated.View>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  scrollOuter: { flexGrow: 1 },
  fill: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  plate: {
    borderWidth: 1.5,
    borderTopWidth: 0,
    marginHorizontal: -1.5,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    paddingBottom: 18,
    alignItems: "center",
    zIndex: 1,
  },
  back: { position: "absolute", left: 16, width: 44, height: 44, justifyContent: "center", zIndex: 2 },
  title: { fontSize: 32, letterSpacing: -0.5, fontFamily: "Geologica_800ExtraBold", marginTop: 34 },
  hero: { width: 362, maxWidth: "100%", height: 172, marginTop: 4 },
  oscar: { position: "absolute", left: 0, top: 0, width: 200, height: 200 },
  stack: { position: "absolute", left: 194, top: 50 },
  balanceRow: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  balance: { fontSize: 42, letterSpacing: -0.8, fontFamily: "Geologica_900Black" },
  balanceUnit: { fontSize: 17, fontFamily: "Geologica_700Bold" },
  balanceLbl: { fontSize: 12, fontFamily: "Geologica_600SemiBold", marginTop: 0 },

  body: { flexGrow: 1, paddingTop: 30, paddingHorizontal: 24 },
  backing: { position: "absolute", top: -40, left: 0, right: 0, bottom: 0 },
  section: { fontSize: 19, letterSpacing: -0.2, fontFamily: "Geologica_800ExtraBold", marginBottom: 13 },

  packs: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  pack: { height: 148, borderRadius: 22, overflow: "hidden", padding: 14 },
  packTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  badge: { height: 21, borderRadius: 11, paddingHorizontal: 8, justifyContent: "center", marginTop: 4 },
  badgeText: { fontSize: 10, fontFamily: "Geologica_800ExtraBold" },
  packCoins: { fontSize: 27, letterSpacing: -0.4, fontFamily: "Geologica_900Black", marginTop: 6, marginLeft: 2 },
  packUnit: { fontSize: 12, fontFamily: "Geologica_600SemiBold", marginLeft: 2, marginTop: -2 },
  price: {
    position: "absolute",
    right: 14,
    bottom: 14,
    height: 27,
    borderRadius: 14,
    paddingHorizontal: 12,
    justifyContent: "center",
  },
  priceText: { color: "#262628", fontSize: 12, fontFamily: "Geologica_800ExtraBold" },

  free: {
    height: 76,
    borderRadius: 22,
    borderWidth: 1,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    gap: 12,
    marginTop: 18,
  },
  freePlay: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  freeTitle: { fontSize: 15, fontFamily: "Geologica_800ExtraBold" },
  freeSub: { fontSize: 12, fontFamily: "Geologica_600SemiBold", marginTop: 4 },
  freePill: { height: 30, borderRadius: 15, paddingHorizontal: 12, backgroundColor: GOLD, justifyContent: "center" },
  freePillText: { color: "#262628", fontSize: 13, fontFamily: "Geologica_900Black" },

  spend: { borderRadius: 22, borderWidth: 1, overflow: "hidden", paddingHorizontal: 18 },
  spendRow: { height: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  spendLabel: { flex: 1, fontSize: 14, fontFamily: "Geologica_600SemiBold" },
  spendCost: { flexDirection: "row", alignItems: "center", gap: 5 },
  spendCostText: { fontSize: 14, fontFamily: "Geologica_800ExtraBold" },
  divider: { height: 1 },
});
