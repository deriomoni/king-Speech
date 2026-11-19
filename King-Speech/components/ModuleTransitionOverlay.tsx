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
  type SharedValue,
} from "react-native-reanimated";
import Svg, {
  Defs,
  Ellipse,
  LinearGradient as SvgLinearGradient,
  Polygon,
  RadialGradient,
  Rect,
  Stop,
  SvgXml,
  Text as SvgText,
} from "react-native-svg";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "@/lib/haptics";
import { useLang, pickLang, type Lang } from "@/context/LangContext";
import { useTheme } from "@/context/ThemeContext";
import { useGame, getModuleQuote } from "@/context/GameContext";
import { getModuleColor } from "@/constants/pathPalette";
import { getLevelsData } from "@/constants/gameContent";
import CoinIcon from "@/components/CoinIcon";
import { MT_SPARKLE_SVG } from "@/assets/figma/endings/moduleTransitionSvgs";

/**
 * Full-screen module transition. Three 3D podium blocks rise out of the floor
 * one after another and settle into a staircase; the tallest (gold) block
 * carries the new module number. Title «Вы переходите на следующий модуль»
 * above, rewards (+50 coins, new levels) and the gold «Далее» CTA below.
 */

const MODULE_REWARD_COINS = 50;
const REWARDED_KEY = "@kingspeech_module_rewards_v1";

const FALLBACK_QUOTES: Record<Lang, string[]> = {
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
  kk: [
    "Әр қадам дауысыңызды күшейтеді.",
    "Сіз өсіп келесіз — бұл анық естіледі.",
    "Сөйлеуге батылдық — жеңістің жартысы.",
    "Жаңа модуль — жаңа биік. Алға!",
    "Кішкентай жеңістер үлкен сенімділікке жетелейді.",
  ],
};

type Faces = { front: [string, string]; top: string; side: string; edge: string; num: string };

const GOLD: Faces = {
  front: ["#FFE07A", "#FFB52E"],
  top: "#FFF1BF",
  side: "#E28E17",
  edge: "rgba(255,255,255,0.75)",
  num: "#2A1C02",
};
const STONE_DARK: Faces = {
  front: ["#3B3A42", "#2A2930"],
  top: "#56555E",
  side: "#1A191D",
  edge: "rgba(255,255,255,0.10)",
  num: "rgba(240,238,233,0.42)",
};
const STONE_LIGHT: Faces = {
  front: ["#F6F3EC", "#E6E0D2"],
  top: "#FFFFFF",
  side: "#D3CBB8",
  edge: "rgba(255,255,255,0.9)",
  num: "rgba(38,38,40,0.32)",
};

/** One extruded block: front face + lit top face + shaded right side. */
function Prism({
  id,
  w,
  h,
  dx,
  dy,
  faces,
  label,
  fontSize,
}: {
  id: string;
  w: number;
  h: number;
  dx: number;
  dy: number;
  faces: Faces;
  label: string;
  fontSize: number;
}) {
  return (
    <Svg width={w + dx} height={h + dy}>
      <Defs>
        <SvgLinearGradient id={`pf${id}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={faces.front[0]} />
          <Stop offset="1" stopColor={faces.front[1]} />
        </SvgLinearGradient>
      </Defs>
      <Polygon points={`${w},${dy} ${w + dx},0 ${w + dx},${h} ${w},${h + dy}`} fill={faces.side} />
      <Polygon points={`0,${dy} ${dx},0 ${w + dx},0 ${w},${dy}`} fill={faces.top} />
      <Rect x={0} y={dy} width={w} height={h} fill={`url(#pf${id})`} />
      <Rect x={0} y={dy} width={w} height={2} fill={faces.edge} />
      {!!label && (
        <SvgText
          x={w / 2}
          y={dy + fontSize * 1.05}
          textAnchor="middle"
          fontFamily="Geologica_900Black"
          fontSize={fontSize}
          fill={faces.num}
        >
          {label}
        </SvgText>
      )}
    </Svg>
  );
}

/** A block that rises out of the floor (clipped at the floor line). */
function RisingPrism({
  progress,
  left,
  boxW,
  boxH,
  children,
}: {
  progress: SharedValue<number>;
  left: number;
  boxW: number;
  boxH: number;
  children: React.ReactNode;
}) {
  const st = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(progress.value, [0, 1], [boxH + 4, 0]) }],
  }));
  return (
    <View style={{ position: "absolute", left, bottom: 0, width: boxW, height: boxH, overflow: "hidden" }}>
      <Animated.View style={st}>{children}</Animated.View>
    </View>
  );
}

function Sparkle({ x, y, s, delay }: { x: number; y: number; s: number; delay: number }) {
  const tw = useSharedValue(0);
  useEffect(() => {
    tw.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 700, easing: Easing.out(Easing.quad) }),
          withTiming(0.35, { duration: 900, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        true,
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const st = useAnimatedStyle(() => ({ opacity: tw.value, transform: [{ scale: 0.6 + tw.value * 0.4 }] }));
  return (
    <Animated.View pointerEvents="none" style={[{ position: "absolute", left: x - s / 2, top: y - s / 2 }, st]}>
      <SvgXml xml={MT_SPARKLE_SVG} width={s} height={s} />
    </Animated.View>
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
  const { theme, themeMode } = useTheme();
  const dark = themeMode === "dark";
  const { addCoins } = useGame();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const moduleColor = getModuleColor(to);
  const ink = dark ? "240,238,233" : "38,38,40";

  const quote =
    getModuleQuote(to, lang) ||
    (FALLBACK_QUOTES[lang] ?? FALLBACK_QUOTES.ru)[to % FALLBACK_QUOTES.ru.length];
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

  // ── podium geometry ──
  const podW = Math.min(width - 44, 340);
  const dx = Math.round(podW * 0.09);
  const dy = Math.round(podW * 0.07);
  const sw = (podW - dx) / 3;
  const unit = sw * 0.58;
  const heights = [unit * 1.15, unit * 2.0, unit * 2.9];
  const podH = heights[2] + dy;
  const numSize = Math.min(Math.round(sw * 0.42), 44);
  const stone = dark ? STONE_DARK : STONE_LIGHT;
  const labels = [to - 2, to - 1, to].map((n) => (n >= 1 ? String(n) : ""));

  // ── animation ──
  const root = useSharedValue(0);
  const head = useSharedValue(0);
  const b0 = useSharedValue(0);
  const b1 = useSharedValue(0);
  const b2 = useSharedValue(0);
  const tail = useSharedValue(0);
  const glow = useSharedValue(0);
  const bars = [b0, b1, b2];

  const proceed = () => {
    if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
    root.value = withTiming(0, { duration: 280, easing: Easing.in(Easing.quad) });
    setTimeout(onDone, 280);
  };

  useEffect(() => {
    const spring = { damping: 13, stiffness: 120, mass: 0.9 };
    root.value = withTiming(1, { duration: 320, easing: Easing.out(Easing.quad) });
    head.value = withDelay(120, withSpring(1, { damping: 16, stiffness: 130 }));
    b0.value = withDelay(420, withSpring(1, spring));
    b1.value = withDelay(620, withSpring(1, spring));
    b2.value = withDelay(820, withSpring(1, spring));
    glow.value = withDelay(
      1150,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.6, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        true,
      ),
    );
    tail.value = withDelay(1200, withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) }));
    const hap = setTimeout(() => {
      if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }, 1050);
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      proceed();
      return true;
    });
    return () => {
      clearTimeout(hap);
      sub.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rootStyle = useAnimatedStyle(() => ({ opacity: root.value }));
  const headStyle = useAnimatedStyle(() => ({
    opacity: head.value,
    transform: [{ translateY: interpolate(head.value, [0, 1], [18, 0]) }],
  }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value }));
  const tailStyle = useAnimatedStyle(() => ({
    opacity: tail.value,
    transform: [{ translateY: interpolate(tail.value, [0, 1], [16, 0]) }],
  }));

  // gold block centre, in podium coordinates (for glow + sparkles)
  const goldCx = sw * 2 + (sw + dx) / 2;
  const goldTop = podH - heights[2] - dy;

  return (
    <Animated.View style={[styles.root, { backgroundColor: theme.bg }, rootStyle]}>
      <View
        style={{
          flex: 1,
          paddingTop: Math.max(insets.top, 54) + 18,
          paddingBottom: insets.bottom + 24,
          paddingHorizontal: 28,
        }}
      >
        {/* Heading */}
        <Animated.View style={[{ alignItems: "center" }, headStyle]}>
          <View style={[styles.kicker, { backgroundColor: `rgba(${ink},0.06)`, borderColor: `rgba(${ink},0.12)` }]}>
            <View style={[styles.kickerDot, { backgroundColor: moduleColor }]} />
            <Text style={[styles.kickerText, { color: theme.text }]}>
              {pickLang(lang, { ru: `МОДУЛЬ ${from} ПРОЙДЕН`, en: `MODULE ${from} COMPLETE`, kk: `${from}-МОДУЛЬ ӨТІЛДІ` })}
            </Text>
          </View>
          <Text style={[styles.title, { color: theme.text }]}>
            {pickLang(lang, {
              ru: "Вы переходите на\nследующий модуль",
              en: "You're moving on\nto the next module",
              kk: "Сіз келесі\nмодульге өтесіз",
            })}
          </Text>
          {!!quote && <Text style={[styles.quote, { color: `rgba(${ink},0.55)` }]}>{quote}</Text>}
        </Animated.View>

        {/* Podium staircase */}
        <View style={styles.stage}>
          <View style={{ width: podW, height: podH }}>
            {/* gold glow behind the top block */}
            <Animated.View
              pointerEvents="none"
              style={[{ position: "absolute", left: goldCx - 150, top: goldTop - 110, width: 300, height: 300 }, glowStyle]}
            >
              <Svg width={300} height={300}>
                <Defs>
                  <RadialGradient id="mtGold" cx="50%" cy="50%" r="50%">
                    <Stop offset="0" stopColor="#FFD857" stopOpacity={dark ? 0.32 : 0.42} />
                    <Stop offset="1" stopColor="#FFD857" stopOpacity={0} />
                  </RadialGradient>
                </Defs>
                <Ellipse cx={150} cy={150} rx={150} ry={150} fill="url(#mtGold)" />
              </Svg>
            </Animated.View>

            {/* floor shadow in the module colour */}
            <View pointerEvents="none" style={{ position: "absolute", left: -30, bottom: -26, width: podW + 60, height: 52 }}>
              <Svg width={podW + 60} height={52}>
                <Defs>
                  <RadialGradient id="mtFloor" cx="50%" cy="50%" r="50%">
                    <Stop offset="0" stopColor={moduleColor} stopOpacity={dark ? 0.45 : 0.3} />
                    <Stop offset="1" stopColor={moduleColor} stopOpacity={0} />
                  </RadialGradient>
                </Defs>
                <Ellipse cx={(podW + 60) / 2} cy={26} rx={(podW + 60) / 2} ry={26} fill="url(#mtFloor)" />
              </Svg>
            </View>

            {heights.map((h, i) => (
              <RisingPrism key={i} progress={bars[i]} left={sw * i} boxW={sw + dx} boxH={h + dy}>
                <Prism
                  id={`b${i}`}
                  w={sw}
                  h={h}
                  dx={dx}
                  dy={dy}
                  faces={i === 2 ? GOLD : stone}
                  label={labels[i]}
                  fontSize={i === 2 ? numSize : Math.round(numSize * 0.8)}
                />
              </RisingPrism>
            ))}

            <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, tailStyle]}>
              <Sparkle x={goldCx + sw * 0.55} y={goldTop - 4} s={20} delay={0} />
              <Sparkle x={goldCx - sw * 0.5} y={goldTop - 30} s={13} delay={350} />
              <Sparkle x={goldCx + sw * 0.15} y={goldTop - 52} s={9} delay={700} />
            </Animated.View>
          </View>
        </View>

        {/* Rewards + CTA */}
        <Animated.View style={tailStyle}>
          <View style={styles.rewards}>
            <View style={[styles.reward, { backgroundColor: `rgba(${ink},0.05)`, borderColor: `rgba(${ink},0.12)` }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Text style={[styles.rewardValue, { color: theme.text }]}>+{MODULE_REWARD_COINS}</Text>
                <CoinIcon size={22} color={theme.accent} />
              </View>
              <Text style={[styles.rewardLabel, { color: `rgba(${ink},0.6)` }]}>
                {pickLang(lang, { ru: "монет за модуль", en: "coins for the module", kk: "модуль үшін монета" })}
              </Text>
            </View>
            <View style={[styles.reward, { backgroundColor: `rgba(${ink},0.05)`, borderColor: `rgba(${ink},0.12)` }]}>
              <Text style={[styles.rewardValue, { color: theme.text }]}>{newLevels}</Text>
              <Text style={[styles.rewardLabel, { color: `rgba(${ink},0.6)` }]}>
                {pickLang(lang, { ru: "новых уровней", en: "new levels", kk: "жаңа деңгей" })}
              </Text>
            </View>
          </View>

          <Pressable
            onPress={proceed}
            style={({ pressed }) => [
              styles.cta,
              {
                backgroundColor: theme.accent,
                borderColor: theme.ctaStroke,
                transform: [{ scale: pressed ? 0.97 : 1 }],
              },
            ]}
          >
            <Text style={[styles.ctaText, { color: theme.accentText }]}>
              {pickLang(lang, { ru: `К модулю ${to} →`, en: `To module ${to} →`, kk: `${to}-модульге →` })}
            </Text>
          </Pressable>
        </Animated.View>
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
    paddingHorizontal: 13,
    paddingVertical: 6,
    borderRadius: 32,
    borderWidth: 1.5,
  },
  kickerDot: { width: 7, height: 7, borderRadius: 4 },
  kickerText: { fontFamily: "Geologica_900Black", fontSize: 11, letterSpacing: 0.8 },
  title: {
    fontFamily: "Geologica_900Black",
    fontSize: 27,
    lineHeight: 32,
    letterSpacing: -0.6,
    textAlign: "center",
    marginTop: 18,
  },
  quote: {
    fontFamily: "Geologica_700Bold",
    fontSize: 15,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 12,
    maxWidth: 300,
  },
  stage: { flex: 1, alignItems: "center", justifyContent: "flex-end", paddingBottom: 54 },
  rewards: { flexDirection: "row", gap: 10 },
  reward: {
    flex: 1,
    height: 64,
    borderRadius: 22,
    borderWidth: 1.5,
    paddingLeft: 14,
    paddingTop: 8,
    gap: 2,
  },
  rewardValue: { fontFamily: "Geologica_900Black", fontSize: 20, letterSpacing: -0.1 },
  rewardLabel: { fontFamily: "Geologica_700Bold", fontSize: 12 },
  cta: {
    marginTop: 16,
    height: 58,
    borderRadius: 32,
    borderWidth: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: { fontFamily: "Geologica_900Black", fontSize: 18, letterSpacing: -0.09 },
});
