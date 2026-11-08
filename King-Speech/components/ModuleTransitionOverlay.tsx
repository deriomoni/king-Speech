import React, { useEffect, useMemo } from "react";
import {
  BackHandler,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import Svg, {
  Defs,
  Ellipse,
  FeGaussianBlur,
  Filter,
  LinearGradient as SvgLinearGradient,
  RadialGradient,
  Stop,
  SvgXml,
  Text as SvgText,
} from "react-native-svg";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useLang } from "@/context/LangContext";
import { useTheme } from "@/context/ThemeContext";
import { useGame, getModuleQuote } from "@/context/GameContext";
import { getModuleColor } from "@/constants/pathPalette";
import { getLevelsData } from "@/constants/gameContent";
import CoinIcon from "@/components/CoinIcon";
import {
  MT_SPOTLIGHT_SVG,
  MT_LAMP_SVG,
  MT_FLOOR_SVG,
  MT_SPARKLE_SVG,
} from "@/assets/figma/endings/moduleTransitionSvgs";

/**
 * Full-screen module transition — Figma 134:167 "Переход · Модуль 2"
 * (section 09 · Концовки уровней). A stage under a single spotlight: the old
 * module numeral flips away and the new one punches in (gold gradient glyph),
 * kicker "МОДУЛЬ N", the module quote, "Модуль N-1 пройден", two reward tiles
 * (+50 coins, number of new levels) and the gold "Далее" CTA.
 *
 * The module colour (67-colour ranks palette, getModuleColor) tints the kicker
 * dot, the floor light and the low radial glow; the spotlight + numeral stay
 * stage-gold as in the design.
 */

const MODULE_REWARD_COINS = 50;
const REWARDED_KEY = "@kingspeech_module_rewards_v1";

const FALLBACK_QUOTES: Record<"ru" | "en", string[]> = {
  ru: [
    "Каждый шаг делает твой голос сильнее.",
    "Ты растёшь — и это слышно.",
    "Смелость говорить — уже половина успеха.",
    "Новый модуль — новая высота. Вперёд!",
    "Маленькие победы ведут к большой уверенности.",
  ],
  en: [
    "Every step makes your voice stronger.",
    "You're growing — and it shows.",
    "The courage to speak is half the battle.",
    "A new module, a new height. Let's go!",
    "Small wins build big confidence.",
  ],
};

// Sparkles / dust in iPhone-17 frame coordinates (402 wide).
const SPARKLES = [
  { x: 84, y: 216, s: 18 },
  { x: 300, y: 254, s: 12 },
  { x: 318, y: 120, s: 8 },
  { x: 96, y: 370, s: 9 },
  { x: 290, y: 460, s: 14 },
];
const DUST = [
  { x: 140, y: 140, s: 3 },
  { x: 250, y: 170, s: 2 },
  { x: 200, y: 110, s: 4 },
  { x: 120, y: 260, s: 2 },
  { x: 280, y: 300, s: 3 },
  { x: 170, y: 450, s: 2 },
  { x: 230, y: 470, s: 3 },
];

function Sparkle({ x, y, s, i }: { x: number; y: number; s: number; i: number }) {
  const tw = useSharedValue(1);
  useEffect(() => {
    tw.value = withDelay(
      i * 260,
      withRepeat(
        withSequence(
          withTiming(0.35, { duration: 900, easing: Easing.inOut(Easing.sin) }),
          withTiming(1, { duration: 900, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const st = useAnimatedStyle(() => ({ opacity: tw.value, transform: [{ scale: 0.85 + tw.value * 0.15 }] }));
  const box = (s * 34) / 18;
  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: "absolute", left: x - (box - s) / 2, top: y - (box - s) / 2, width: box, height: box }, st]}
    >
      <SvgXml xml={MT_SPARKLE_SVG} width={box} height={box} />
    </Animated.View>
  );
}

/** Gold-gradient numeral with a soft glow + drop shadow (Figma "Numeral"). */
function Numeral({ n, dark, id }: { n: number; dark: boolean; id: string }) {
  const W = 402;
  const H = 230;
  const base = 162; // baseline → glyph centred in the box
  const label = String(n);
  return (
    <Svg width={W} height={H}>
      <Defs>
        <SvgLinearGradient id={`num${id}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0.1" stopColor="#FFF2C2" />
          <Stop offset="0.55" stopColor="#FFEDA8" />
          <Stop offset="0.95" stopColor="#ED9E1F" />
        </SvgLinearGradient>
        <Filter id={`glow${id}`} x="-50%" y="-50%" width="200%" height="200%">
          <FeGaussianBlur stdDeviation="22" />
        </Filter>
        <Filter id={`drop${id}`} x="-50%" y="-50%" width="200%" height="200%">
          <FeGaussianBlur stdDeviation="10" />
        </Filter>
      </Defs>
      {dark && (
        <SvgText
          x={W / 2}
          y={base + 18}
          textAnchor="middle"
          fontFamily="Geologica_900Black"
          fontSize={128}
          fill="#000"
          fillOpacity={0.5}
          filter={`url(#drop${id})`}
        >
          {label}
        </SvgText>
      )}
      <SvgText
        x={W / 2}
        y={base}
        textAnchor="middle"
        fontFamily="Geologica_900Black"
        fontSize={128}
        fill="#FFEDA8"
        fillOpacity={0.65}
        filter={`url(#glow${id})`}
      >
        {label}
      </SvgText>
      <SvgText
        x={W / 2}
        y={base}
        textAnchor="middle"
        fontFamily="Geologica_900Black"
        fontSize={128}
        fill={`url(#num${id})`}
      >
        {label}
      </SvgText>
    </Svg>
  );
}

export default function ModuleTransitionOverlay({
  from,
  to,
  onDone,
}: {
  from: number;
  to: number;
  /** Legacy tint from callers; the module colour now comes from getModuleColor. */
  color?: string;
  onDone: () => void;
}) {
  const { lang } = useLang();
  const en = lang === "en";
  const { theme, themeMode } = useTheme();
  const dark = themeMode === "dark";
  const { addCoins } = useGame();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  const moduleColor = getModuleColor(to);
  const ink = dark ? "240,238,233" : "38,38,40";
  const fxLeft = (width - 402) / 2;

  const quote =
    getModuleQuote(to, lang) ||
    FALLBACK_QUOTES[en ? "en" : "ru"][to % FALLBACK_QUOTES.ru.length];
  const newLevels = useMemo(
    () => getLevelsData(lang).filter((l) => l.module === to).length,
    [lang, to],
  );

  // +50 coins for finishing a module — credited once per finished module.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(REWARDED_KEY);
        const done: number[] = raw ? JSON.parse(raw) : [];
        if (cancelled || done.includes(from)) return;
        addCoins(MODULE_REWARD_COINS);
        await AsyncStorage.setItem(REWARDED_KEY, JSON.stringify([...done, from]));
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from]);

  const root = useSharedValue(0);
  const enter = useSharedValue(0);
  const roll = useSharedValue(0);
  const pop = useSharedValue(0);
  const glow = useSharedValue(0);

  const proceed = () => {
    if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
    root.value = withTiming(0, { duration: 300, easing: Easing.in(Easing.quad) });
    setTimeout(onDone, 300);
  };

  useEffect(() => {
    root.value = withTiming(1, { duration: 380, easing: Easing.out(Easing.quad) });
    enter.value = withSpring(1, { damping: 15, stiffness: 120 });
    glow.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.55, { duration: 1300, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true,
    );
    roll.value = withDelay(620, withTiming(1, { duration: 720, easing: Easing.inOut(Easing.cubic) }));
    pop.value = withDelay(880, withSpring(1, { damping: 9, stiffness: 140 }));
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      proceed();
      return true;
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rootStyle = useAnimatedStyle(() => ({ opacity: root.value }));
  const stageStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: interpolate(enter.value, [0, 1], [0.92, 1]) },
      { translateY: interpolate(enter.value, [0, 1], [20, 0]) },
    ],
  }));
  const oldStyle = useAnimatedStyle(() => ({
    opacity: interpolate(roll.value, [0, 0.5], [1, 0], "clamp"),
    transform: [
      { perspective: 700 },
      { translateY: interpolate(roll.value, [0, 1], [0, -120]) },
      { rotateX: `${interpolate(roll.value, [0, 1], [0, -80])}deg` },
      { scale: interpolate(roll.value, [0, 1], [1, 0.8]) },
    ],
  }));
  const newStyle = useAnimatedStyle(() => ({
    opacity: interpolate(roll.value, [0.3, 0.7], [0, 1], "clamp"),
    transform: [
      { perspective: 700 },
      { translateY: interpolate(roll.value, [0, 1], [120, 0]) },
      { scale: 0.8 + 0.2 * pop.value },
    ],
  }));
  const lightStyle = useAnimatedStyle(() => ({ opacity: interpolate(glow.value, [0.55, 1], [0.8, 1]) }));

  return (
    <Animated.View style={[styles.root, { backgroundColor: theme.bg }, rootStyle]}>
      {/* Low radial glow in the module colour (Figma bg radial at 201,556). */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg width={width} height={height}>
          <Defs>
            <RadialGradient id="mtBg" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={moduleColor} stopOpacity={0.22} />
              <Stop offset="1" stopColor={moduleColor} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Ellipse cx={width / 2} cy={height * 0.636} rx={width * 0.8} ry={height * 0.455} fill="url(#mtBg)" />
        </Svg>
      </View>

      {/* Spotlight + lamp (frame coordinates). */}
      <Animated.View
        pointerEvents="none"
        style={[{ position: "absolute", top: 0, left: fxLeft, width: 402, height: 700 }, lightStyle]}
      >
        <View style={{ position: "absolute", left: 22.39, top: -18.5, opacity: dark ? 1 : 0.8 }}>
          <SvgXml xml={MT_SPOTLIGHT_SVG} width={355.22} height={677} />
        </View>
        <View style={{ position: "absolute", left: 146, top: -20 }}>
          <SvgXml xml={MT_LAMP_SVG} width={110} height={46} />
        </View>
      </Animated.View>
      <View pointerEvents="none" style={{ position: "absolute", top: 0, left: fxLeft, width: 402, height: 600 }}>
        {DUST.map((d, i) => (
          <View
            key={`d${i}`}
            style={{
              position: "absolute",
              left: d.x,
              top: d.y,
              width: d.s,
              height: d.s,
              borderRadius: d.s,
              backgroundColor: "rgba(255,237,168,0.6)",
            }}
          />
        ))}
        {SPARKLES.map((sp, i) => (
          <Sparkle key={`s${i}`} i={i} {...sp} />
        ))}
      </View>

      <View
        style={{
          flex: 1,
          paddingTop: Math.max(insets.top, 54) + 22,
          paddingBottom: insets.bottom + 24,
          paddingHorizontal: 30,
        }}
      >
        {/* Kicker · МОДУЛЬ N */}
        <View style={{ alignItems: "center" }}>
          <View
            style={[
              styles.kicker,
              { backgroundColor: `rgba(${ink},0.08)`, borderColor: "rgba(255,237,168,0.6)" },
            ]}
          >
            <View style={[styles.kickerDot, { backgroundColor: moduleColor, shadowColor: moduleColor }]} />
            <Text style={[styles.kickerText, { color: theme.text }]}>
              {(en ? "MODULE " : "МОДУЛЬ ") + to}
            </Text>
          </View>
        </View>

        {/* Numeral + quote + done label */}
        <Animated.View style={[styles.stage, stageStyle]}>
          <View style={styles.numeralBox}>
            <Animated.View style={[styles.numeralLayer, oldStyle]}>
              <Numeral n={from} dark={dark} id="old" />
            </Animated.View>
            <Animated.View style={[styles.numeralLayer, newStyle]}>
              <Numeral n={to} dark={dark} id="new" />
            </Animated.View>
          </View>

          <View style={{ alignItems: "center" }}>
            <View pointerEvents="none" style={styles.floor}>
              <SvgXml xml={MT_FLOOR_SVG.replace(/\{\{FLOOR\}\}/g, moduleColor)} width={340} height={70} />
            </View>
            {!!quote && <Text style={[styles.quote, { color: theme.text }]}>«{quote}»</Text>}
            <Text style={[styles.done, { color: dark ? theme.accent : theme.accentInk }]}>
              {en ? `Module ${from} complete` : `Модуль ${from} пройден`}
            </Text>
          </View>
        </Animated.View>

        {/* Rewards */}
        <View style={styles.rewards}>
          <View style={[styles.reward, { backgroundColor: `rgba(${ink},0.05)`, borderColor: `rgba(${ink},0.14)` }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Text style={[styles.rewardValue, { color: theme.text }]}>+{MODULE_REWARD_COINS}</Text>
              <CoinIcon size={22} color={theme.accent} />
            </View>
            <Text style={[styles.rewardLabel, { color: theme.text }]}>
              {en ? "coins for the module" : "монет за модуль"}
            </Text>
          </View>
          <View style={[styles.reward, { backgroundColor: `rgba(${ink},0.05)`, borderColor: `rgba(${ink},0.14)` }]}>
            <Text style={[styles.rewardValue, { color: theme.text }]}>{newLevels}</Text>
            <Text style={[styles.rewardLabel, { color: theme.text }]}>
              {en ? "new levels" : "новых уровней"}
            </Text>
          </View>
        </View>

        <Pressable
          onPress={proceed}
          style={({ pressed }) => [
            styles.cta,
            { backgroundColor: theme.accent, borderColor: theme.ctaStroke, opacity: pressed ? 0.9 : 1 },
          ]}
        >
          <Text style={[styles.ctaText, { color: theme.accentText }]}>{en ? "Next →" : "Далее →"}</Text>
        </Pressable>
        <Pressable onPress={proceed} hitSlop={10} style={({ pressed }) => [{ marginTop: 10, opacity: pressed ? 0.6 : 1 }]}>
          <Text style={[styles.later, { color: `rgba(${ink},0.5)` }]}>{en ? "Exit" : "Выйти"}</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 999, elevation: 30 },
  kicker: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 32,
    borderWidth: 1.5,
    shadowColor: "#FFEDA8",
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
  },
  kickerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    shadowOpacity: 0.9,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
  },
  kickerText: { fontFamily: "Geologica_900Black", fontSize: 12, letterSpacing: 0.6 },
  // Bottom-anchored so the numeral sits ~395pt down on iPhone 17 and the top
  // space absorbs shorter screens.
  stage: { flex: 1, justifyContent: "flex-end", alignItems: "center", paddingBottom: 94 },
  numeralBox: { width: 402, height: 150, marginBottom: -3 },
  numeralLayer: { position: "absolute", top: -40, left: 0, width: 402, height: 230 },
  floor: { position: "absolute", top: 33, width: 340, height: 70 },
  quote: {
    fontFamily: "Geologica_900Black",
    fontSize: 20,
    lineHeight: 24,
    letterSpacing: -0.1,
    textAlign: "center",
    maxWidth: 322,
  },
  done: { fontFamily: "Geologica_900Black", fontSize: 13, textAlign: "center", marginTop: 51 },
  rewards: { flexDirection: "row", gap: 10 },
  reward: {
    flex: 1,
    height: 64,
    borderRadius: 22,
    borderWidth: 2,
    paddingLeft: 14,
    paddingTop: 7,
    gap: 3,
  },
  rewardValue: { fontFamily: "Geologica_900Black", fontSize: 20, letterSpacing: -0.1 },
  rewardLabel: { fontFamily: "Geologica_700Bold", fontSize: 12 },
  cta: {
    marginTop: 24,
    height: 58,
    borderRadius: 32,
    borderWidth: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: { fontFamily: "Geologica_900Black", fontSize: 18, letterSpacing: -0.09 },
  later: { fontFamily: "Geologica_800ExtraBold", fontSize: 14, textAlign: "center" },
});
