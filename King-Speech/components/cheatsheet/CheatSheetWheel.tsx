import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  Dimensions,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  interpolate,
  interpolateColor,
  Extrapolation,
  runOnJS,
  type SharedValue,
} from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { fonts } from "@/constants/colors";
import { tx, type CheatRoute } from "@/constants/cheatsheetData";

const { width: SW, height: SH } = Dimensions.get("window");
const ITEM_H = 108;
const WHEEL_H = Math.min(Math.round(SH * 0.46), 360);
const PAD_V = (WHEEL_H - ITEM_H) / 2; // lets the first/last item reach the centre
const MARKER_X = 34; // arc dot x — the fixed selection marker

// Short bold name shown to the right (like "Flexible" in the reference).
const NAME: Record<string, { ru: string; en: string }> = {
  warmup: { ru: "Разминка", en: "Warm-up" },
  quick: { ru: "Экспресс", en: "Express" },
  balanced: { ru: "Баланс", en: "Balanced" },
  full: { ru: "Полная", en: "Full" },
};

type AppColors = import("@/constants/colors").AppColors;

const fmt = (m: number) => (m < 10 ? `0${m}` : `${m}`);

function tick() {
  if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
}

function WheelRow({
  route,
  index,
  scrollY,
  lang,
  colors,
}: {
  route: CheatRoute;
  index: number;
  scrollY: SharedValue<number>;
  lang: string;
  colors: AppColors;
}) {
  // Curve the item along the arc: it hugs the marker at the centre and swings
  // left + tilts as it moves away — matches the reference carousel motion.
  const rowStyle = useAnimatedStyle(() => {
    const off = index - scrollY.value / ITEM_H;
    const abs = Math.abs(off);
    const translateX = -Math.min(abs * abs * 26, 130);
    const scale = Math.max(1 - abs * 0.3, 0.48);
    const opacity = Math.max(1 - abs * 0.55, 0.14);
    return {
      opacity,
      transform: [
        { translateX },
        { rotateZ: `${off * 7}deg` },
        { scale },
      ],
    };
  });
  const numStyle = useAnimatedStyle(() => {
    const abs = Math.abs(index - scrollY.value / ITEM_H);
    return {
      color: interpolateColor(abs, [0, 0.7], [colors.text, colors.textMuted]),
    };
  });
  // Title/description only appear for the centred item.
  const textStyle = useAnimatedStyle(() => {
    const abs = Math.abs(index - scrollY.value / ITEM_H);
    return { opacity: interpolate(abs, [0, 0.5], [1, 0], Extrapolation.CLAMP) };
  });

  return (
    <Animated.View style={[styles.row, rowStyle]}>
      <View style={styles.numWrap}>
        <Animated.Text style={[styles.num, numStyle]}>{fmt(route.minutes)}</Animated.Text>
        <Text style={[styles.unit, { color: colors.textMuted }]}>{lang === "en" ? "min" : "мин"}</Text>
      </View>
      <Animated.View style={[styles.textWrap, textStyle]}>
        <Text style={[styles.title, { color: colors.text }]}>{NAME[route.id]?.[lang as "ru" | "en"] ?? tx(route.title, lang)}</Text>
        <Text style={[styles.desc, { color: colors.textSecondary }]}>{tx(route.subtitle, lang)}</Text>
      </Animated.View>
    </Animated.View>
  );
}

export default function CheatSheetWheel({
  routes,
  lang,
  colors,
  isDark,
  onStart,
}: {
  routes: CheatRoute[];
  lang: string;
  colors: AppColors;
  isDark: boolean;
  onStart: (route: CheatRoute) => void;
}) {
  const scrollY = useSharedValue(0);
  const lastIdx = useSharedValue(0);
  const [idx, setIdx] = useState(0);
  const selected = routes[Math.max(0, Math.min(routes.length - 1, idx))];

  const onIndex = (i: number) => {
    setIdx(i);
    tick(); // detent haptic each time a new number snaps to the centre
  };

  const handler = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollY.value = e.contentOffset.y;
      const i = Math.round(e.contentOffset.y / ITEM_H);
      if (i !== lastIdx.value) {
        lastIdx.value = i;
        runOnJS(onIndex)(i);
      }
    },
  });

  return (
    <View style={styles.wrap}>
      <View style={styles.wheel}>
        {/* Arc + fixed selection dot on the left */}
        <Svg
          width={SW}
          height={WHEEL_H}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        >
          <Circle
            cx={MARKER_X - 560}
            cy={WHEEL_H / 2}
            r={560}
            stroke={isDark ? "rgba(255,255,255,0.16)" : "rgba(14,14,16,0.14)"}
            strokeWidth={1}
            fill="none"
          />
          <Circle cx={MARKER_X} cy={WHEEL_H / 2} r={5} fill={selected.accent} />
        </Svg>

        <Animated.ScrollView
          onScroll={handler}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          snapToInterval={ITEM_H}
          decelerationRate="fast"
          contentContainerStyle={{ paddingVertical: PAD_V }}
        >
          {routes.map((r, i) => (
            <WheelRow key={r.id} route={r} index={i} scrollY={scrollY} lang={lang} colors={colors} />
          ))}
        </Animated.ScrollView>
      </View>

      {/* Start the selected warm-up */}
      <Pressable
        onPress={() => {
          if (Platform.OS !== "web")
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
          onStart(selected);
        }}
        style={({ pressed }) => [
          styles.startBtn,
          { backgroundColor: selected.accent, opacity: pressed ? 0.88 : 1 },
        ]}
      >
        <Ionicons name="play" size={15} color="#20160A" />
        <Text style={styles.startTxt}>{lang === "en" ? "Start" : "Начать"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: "center", gap: 18 },
  wheel: { height: WHEEL_H, overflow: "hidden" },

  row: {
    height: ITEM_H,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 58,
    gap: 18,
  },
  numWrap: { flexDirection: "row", alignItems: "flex-end" },
  num: { fontSize: 76, lineHeight: 82, fontFamily: fonts.display, color: "#fff" },
  unit: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 14,
    fontFamily: fonts.bodySemibold,
    marginBottom: 16,
    marginLeft: 6,
  },
  textWrap: { flex: 1 },
  title: { color: "#fff", fontSize: 19, fontFamily: fonts.bodyBold },
  desc: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 14,
    lineHeight: 19,
    fontFamily: fonts.body,
    marginTop: 3,
  },

  startBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    gap: 7,
    height: 44,
    paddingHorizontal: 32,
    borderRadius: 22,
  },
  startTxt: { color: "#20160A", fontSize: 15, fontFamily: fonts.bodyBold },
});
