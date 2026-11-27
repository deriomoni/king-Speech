import React, { useEffect, useState } from "react";
import NextChevron from "@/components/NextChevron";
import {
  BackHandler,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type LayoutRectangle,
} from "react-native";
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import Svg, {
  Defs,
  Ellipse,
  G,
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
import { useGame, getModuleQuote, getRankForSection } from "@/context/GameContext";
import RankProgressPill, { ModuleTopGlow } from "@/components/path/RankProgressPill";
import { getPathBrickColor, darkenHex, readableText } from "@/constants/pathPalette";
import { lightenHex } from "@/components/path/BrickStroke";
import GoldCoin from "@/components/GoldCoin";
import { rs } from "@/lib/responsive";
import { MT_SPARKLE_SVG } from "@/assets/figma/endings/moduleTransitionSvgs";

/**
 * Full-screen module transition. Three 3D podium blocks grow out of the floor
 * into a staircase (the tall gold one carries the new module number); behind
 * them two more rows of steps climb away into the haze. Once the gold block
 * lands, the +50 module coins burst from it and fly into a balance pill.
 */

const MODULE_REWARD_COINS = 50;
const REWARDED_KEY = "@kingspeech_module_rewards_v1";
const COIN_N = 8;

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

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
/** settles with a barely-there overshoot (~2%) */
const easeGrow = (x: number) => {
  const c = 0.7;
  return 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2;
};

// timeline (ms)
const BLOCK_AT = 380;
const BLOCK_GAP = 200;
const BLOCK_DUR = 760;
const LANDED_AT = BLOCK_AT + 2 * BLOCK_GAP + BLOCK_DUR; // gold block settled
const BACK_AT = BLOCK_AT + 3 * BLOCK_GAP; // next floors start right after the front row
const BACK_GAP = 150;
const END_AT = BACK_AT + 5 * BACK_GAP + BLOCK_DUR;
const COINS_AT = LANDED_AT + 150;

/** JS clock for the podium build-up: re-renders until `totalMs` has passed. */
function useClock(totalMs: number) {
  const [t, setT] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = Date.now();
    const loop = () => {
      const e = Date.now() - start;
      setT(Math.min(e, totalMs));
      if (e < totalMs) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [totalMs]);
  return t;
}

// «key press» wave over the front steps, repeated every PRESS_EVERY ms
const PRESS_EVERY = 5000;
const PRESS_GAP = 140;
const PRESS_DUR = 380;
const PRESS_TOTAL = 2 * PRESS_GAP + PRESS_DUR;

/** ms since the current press wave started, or -1 between waves. */
function usePressWave(firstAtMs: number) {
  const [pt, setPt] = useState(-1);
  useEffect(() => {
    let raf = 0;
    const run = () => {
      const start = Date.now();
      const loop = () => {
        const e = Date.now() - start;
        if (e >= PRESS_TOTAL) {
          setPt(-1);
          return;
        }
        setPt(e);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    };
    let iv: ReturnType<typeof setInterval> | undefined;
    const first = setTimeout(() => {
      run();
      iv = setInterval(run, PRESS_EVERY);
    }, firstAtMs);
    return () => {
      clearTimeout(first);
      if (iv) clearInterval(iv);
      cancelAnimationFrame(raf);
    };
  }, [firstAtMs]);
  return pt;
}

function mixHex(a: string, b: string, k: number) {
  const p = (h: string) => (/^#[0-9a-f]{6}$/i.test(h) ? [1, 3, 5].map((o) => parseInt(h.slice(o, o + 2), 16)) : null);
  const ca = p(a);
  const cb = p(b);
  if (!ca || !cb) return a;
  return "#" + ca.map((v, i) => Math.round(v + (cb[i] - v) * k).toString(16).padStart(2, "0")).join("");
}

/** The stone faces blended `k` of the way into the background — opaque «haze». */
function hazeFaces(f: Faces, bg: string, k: number): Faces {
  return {
    front: [mixHex(f.front[0], bg, k), mixHex(f.front[1], bg, k)],
    top: mixHex(f.top, bg, k),
    side: mixHex(f.side, bg, k),
    edge: "transparent",
    num: f.num,
  };
}

/** One extruded block standing on (x, baseY): front, lit top, shaded right side. */
function Block({
  id,
  x,
  baseY,
  w,
  h,
  dx,
  dy,
  faces,
  label,
  labelOpacity = 1,
  fontSize = 0,
}: {
  id: string;
  x: number;
  baseY: number;
  w: number;
  h: number;
  dx: number;
  dy: number;
  faces: Faces;
  label?: string;
  labelOpacity?: number;
  fontSize?: number;
}) {
  if (h <= 0.5) return null;
  const top = baseY - h;
  return (
    <G>
      <Polygon
        points={`${x + w},${top} ${x + w + dx},${top - dy} ${x + w + dx},${baseY - dy} ${x + w},${baseY}`}
        fill={faces.side}
      />
      <Polygon points={`${x},${top} ${x + dx},${top - dy} ${x + w + dx},${top - dy} ${x + w},${top}`} fill={faces.top} />
      <Rect x={x} y={top} width={w} height={h} fill={`url(#${id})`} />
      <Rect x={x} y={top} width={w} height={Math.min(2, h)} fill={faces.edge} />
      {!!label && labelOpacity > 0 && (
        <SvgText
          x={x + w / 2}
          y={top + fontSize * 1.05}
          textAnchor="middle"
          fontFamily="Geologica_900Black"
          fontSize={fontSize}
          fill={faces.num}
          opacity={labelOpacity}
        >
          {label}
        </SvgText>
      )}
    </G>
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

/** A coin that pops out of the gold block and arcs into the balance pill. */
function FlyingCoin({
  i,
  from,
  to,
  size,
  onArrive,
}: {
  i: number;
  from: [number, number];
  to: [number, number];
  size: number;
  onArrive: () => void;
}) {
  const p = useSharedValue(0);
  // a fan of slightly different arcs so the coins don't stack
  const spread = (i - (COIN_N - 1) / 2) * rs(16);
  const lift = rs(120 + (i % 3) * 26);
  useEffect(() => {
    p.value = withDelay(
      i * 85,
      withTiming(1, { duration: 1050, easing: Easing.inOut(Easing.cubic) }, (fin) => {
        if (fin) runOnJS(onArrive)();
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const st = useAnimatedStyle(() => {
    const t = p.value;
    const cx = from[0] + spread;
    const cy = from[1] - lift;
    const x = (1 - t) * (1 - t) * from[0] + 2 * (1 - t) * t * cx + t * t * to[0];
    const y = (1 - t) * (1 - t) * from[1] + 2 * (1 - t) * t * cy + t * t * to[1];
    const sc = t < 0.15 ? interpolate(t, [0, 0.15], [0.2, 1.15]) : interpolate(t, [0.15, 1], [1.15, 0.7]);
    return {
      opacity: t <= 0 || t >= 1 ? 0 : 1,
      transform: [{ translateX: x - size / 2 }, { translateY: y - size / 2 }, { scale: sc }, { rotate: `${t * 540}deg` }],
    };
  });
  return (
    <Animated.View pointerEvents="none" style={[{ position: "absolute", left: 0, top: 0 }, st]}>
      <GoldCoin size={size} />
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
  /** Legacy tint from callers; unused since the podium redesign. */
  color?: string;
  onDone: () => void;
}) {
  const { lang } = useLang();
  const { theme, themeMode } = useTheme();
  const dark = themeMode === "dark";
  const { addCoins, coins: balance } = useGame();
  const insets = useSafeAreaInsets();
  const { width: W } = useWindowDimensions();

  const ink = dark ? "240,238,233" : "38,38,40";

  // Rank progress in modules: the one just finished (`from`) counts as done.
  const rank = getRankForSection(from);
  const rankTotal = rank.toSection - rank.fromSection + 1;
  const rankDone = Math.min(rankTotal, Math.max(0, from - rank.fromSection + 1));
  const moduleColor = getPathBrickColor(to, dark);
  const lum = (() => {
    const n = parseInt(moduleColor.slice(1, 7), 16);
    return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  })();
  const HERO: Faces = {
    front: [lightenHex(moduleColor, 0.22), moduleColor],
    top: lightenHex(moduleColor, 0.55),
    side: darkenHex(moduleColor, 0.22),
    edge: "rgba(255,255,255,0.7)",
    num: lum > 0.62 ? "rgba(20,20,22,0.85)" : "#FFFFFF",
  };
  const quote =
    getModuleQuote(to, lang) ||
    (FALLBACK_QUOTES[lang] ?? FALLBACK_QUOTES.ru)[to % FALLBACK_QUOTES.ru.length];

  // +50 coins for finishing a module — credited once per finished module.
  const [rewarded, setRewarded] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(REWARDED_KEY);
        const done: number[] = raw ? JSON.parse(raw) : [];
        if (cancelled || done.includes(from)) return;
        addCoins(MODULE_REWARD_COINS);
        setRewarded(true);
        await AsyncStorage.setItem(REWARDED_KEY, JSON.stringify([...done, from]));
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from]);

  // ── stage layout (measured, so the scene fits any screen height) ──
  const [stage, setStage] = useState<LayoutRectangle | null>(null);
  const t = useClock(END_AT + 50);
  const pressT = usePressWave(END_AT + 600);

  const podW = Math.min(W - rs(56), rs(320));
  const dx = Math.round(podW * 0.09);
  const dy = Math.round(podW * 0.07);
  const sw = (podW - dx) / 3;
  const sceneH = stage ? stage.height : 0;
  const unit = Math.min(sw * 0.58, (sceneH - dy * 3 - rs(8)) / 6.9);
  const rel = [1.15, 2.0, 2.9];
  const heights = rel.map((r) => unit * r);
  const floorY = sceneH - rs(4);
  const x0 = (W - podW) / 2;
  const stone = dark ? STONE_DARK : STONE_LIGHT;
  const labels = [to - 2, to - 1, to].map((n) => (n >= 1 ? String(n) : ""));
  const numSize = Math.min(Math.round(sw * 0.42), rs(44));

  // the next floors of a switchback staircase, set back behind the front row
  // (smaller, in the haze): floor 2 climbs on from above the gold step towards
  // the LEFT, floor 3 turns and climbs to the right again. `cols` = column of
  // each step in climbing order, each step taller than the one before.
  const podCx = x0 + (podW - dx) / 2;
  const backRows = [
    { k: "r2", s: 0.8, base: floorY - unit * 0.7, op: 0.5, rel: [3.8, 4.7, 5.6], cols: [2, 1, 0], at: BACK_AT },
    { k: "r3", s: 0.6, base: floorY - unit * 1.75, op: 0.28, rel: [6.5, 7.4, 8.3], cols: [0, 1, 2], at: BACK_AT + 3 * BACK_GAP },
  ].map((r) => ({ ...r, left: podCx - (sw * r.s * 3) / 2 }));

  const grow = (i: number) => easeGrow(clamp01((t - BLOCK_AT - i * BLOCK_GAP) / BLOCK_DUR));
  const goldCx = x0 + sw * 2 + (sw + dx) / 2;
  const goldTop = floorY - heights[2] - dy;

  // ── Reanimated parts: fade in/out, glow, tail, coins pill ──
  const root = useSharedValue(0);
  const head = useSharedValue(0);
  const tail = useSharedValue(0);
  const glow = useSharedValue(0);
  const pillVis = useSharedValue(0);
  const bump = useSharedValue(0);
  const [flying, setFlying] = useState(false);
  const [landed, setLanded] = useState(0);

  const proceed = () => {
    if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
    root.value = withTiming(0, { duration: 280, easing: Easing.in(Easing.quad) });
    setTimeout(onDone, 280);
  };

  useEffect(() => {
    root.value = withTiming(1, { duration: 320, easing: Easing.out(Easing.quad) });
    head.value = withDelay(100, withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) }));
    glow.value = withDelay(
      LANDED_AT - 200,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.6, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        true,
      ),
    );
    tail.value = withDelay(LANDED_AT - 150, withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) }));
    const hap = setTimeout(() => {
      if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }, LANDED_AT - 120);
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

  // coins fly only when the reward was actually credited now
  useEffect(() => {
    if (!rewarded) return;
    const a = setTimeout(() => {
      pillVis.value = withTiming(1, { duration: 320, easing: Easing.out(Easing.cubic) });
    }, COINS_AT - 250);
    const b = setTimeout(() => setFlying(true), COINS_AT);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rewarded]);
  useEffect(() => {
    if (landed < COIN_N) return;
    const id = setTimeout(() => {
      pillVis.value = withTiming(0, { duration: 380, easing: Easing.in(Easing.cubic) });
    }, 1300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [landed]);
  const onCoin = () => {
    setLanded((n) => Math.min(COIN_N, n + 1));
    bump.value = withSequence(withTiming(1, { duration: 70 }), withTiming(0, { duration: 220 }));
    if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
  };
  const shownBalance = Math.max(0, balance - (rewarded ? MODULE_REWARD_COINS : 0)) +
    Math.round((MODULE_REWARD_COINS * landed) / COIN_N);

  // Tablet: animation distances resolved on the JS side (rs isn't a worklet).
  const headRise = rs(18);
  const tailRise = rs(16);
  const pillDrop = rs(-14);
  const rootStyle = useAnimatedStyle(() => ({ opacity: root.value }));
  const headStyle = useAnimatedStyle(() => ({
    opacity: head.value,
    transform: [{ translateY: interpolate(head.value, [0, 1], [headRise, 0]) }],
  }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value }));
  const tailStyle = useAnimatedStyle(() => ({
    opacity: tail.value,
    transform: [{ translateY: interpolate(tail.value, [0, 1], [tailRise, 0]) }],
  }));
  const pillShow = useAnimatedStyle(() => ({
    opacity: pillVis.value,
    transform: [{ translateY: (1 - pillVis.value) * pillDrop }, { scale: 1 + bump.value * 0.06 }],
  }));
  const pillGlow = useAnimatedStyle(() => ({ opacity: bump.value }));

  const pillTop = Math.max(insets.top, rs(20)) + rs(8);
  const PILL_W = rs(104);
  const coinTo: [number, number] = [W - rs(16) - PILL_W + rs(22), pillTop + rs(18)];
  const coinFrom: [number, number] = stage ? [stage.x + goldCx, stage.y + goldTop + dy / 2] : [W / 2, rs(400)];

  return (
    <Animated.View style={[styles.root, { backgroundColor: theme.bg }, rootStyle]}>
      <ModuleTopGlow color={moduleColor} isDark={dark} />
      <View
        style={{
          flex: 1,
          paddingTop: Math.max(insets.top, rs(54)) + rs(22),
          paddingBottom: insets.bottom + rs(24),
          paddingHorizontal: rs(28),
        }}
      >
        {/* Heading */}
        <Animated.View style={[{ alignItems: "center" }, headStyle]}>
          <Text style={[styles.title, { color: theme.text }]}>
            {pickLang(lang, {
              ru: "Вы переходите на\nследующий модуль",
              en: "You're moving on\nto the next module",
              kk: "Сіз келесі\nмодульге өтесіз",
            })}
          </Text>
          {!!quote && <Text style={[styles.quote, { color: `rgba(${ink},0.55)` }]}>{quote}</Text>}
        </Animated.View>

        {/* Frosted rank-progress pill above the staircase */}
        <View style={styles.rankPill}>
          <RankProgressPill
            done={rankDone}
            prevDone={rankDone - 1}
            total={rankTotal}
            color={moduleColor}
            isDark={dark}
            delay={LANDED_AT}
            enterDelay={260}
          />
        </View>

        {/* Staircase scene — full screen width */}
        <View style={styles.stage} onLayout={(e) => setStage(e.nativeEvent.layout)}>
          {stage && sceneH > 0 && (
            <>
              <Animated.View
                pointerEvents="none"
                style={[{ position: "absolute", left: goldCx - rs(160), top: goldTop - rs(120), width: rs(320), height: rs(320) }, glowStyle]}
              >
                <Svg width={rs(320)} height={rs(320)} viewBox="0 0 320 320">
                  <Defs>
                    <RadialGradient id="mtGold" cx="50%" cy="50%" r="50%">
                      <Stop offset="0" stopColor={moduleColor} stopOpacity={dark ? 0.3 : 0.4} />
                      <Stop offset="1" stopColor={moduleColor} stopOpacity={0} />
                    </RadialGradient>
                  </Defs>
                  <Ellipse cx={160} cy={160} rx={160} ry={160} fill="url(#mtGold)" />
                </Svg>
              </Animated.View>

              <Svg width={W} height={sceneH} style={StyleSheet.absoluteFill}>
                <Defs>
                  <SvgLinearGradient id="gGold" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor={HERO.front[0]} />
                    <Stop offset="1" stopColor={HERO.front[1]} />
                  </SvgLinearGradient>
                  <SvgLinearGradient id="gStone" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor={stone.front[0]} />
                    <Stop offset="1" stopColor={stone.front[1]} />
                  </SvgLinearGradient>
                  <SvgLinearGradient id="gFog" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor={theme.bg} stopOpacity={0} />
                    <Stop offset="1" stopColor={theme.bg} stopOpacity={0.95} />
                  </SvgLinearGradient>
                </Defs>

                {/* far rows first, each dissolving into a haze at its base */}
                {[...backRows].reverse().map((r) => {
                  const rsw = sw * r.s;
                  const rdx = dx * r.s;
                  const rdy = dy * r.s;
                  const tallest = unit * r.rel[2] * r.s;
                  const fogH = tallest * 0.6;
                  // opaque colours pre-mixed with the background (group opacity showed the seams)
                  const hz = hazeFaces(stone, theme.bg, 1 - r.op);
                  const gid = `gHaze${r.k}`;
                  return (
                    <G key={r.k}>
                      <Defs>
                        <SvgLinearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                          <Stop offset="0" stopColor={hz.front[0]} />
                          <Stop offset="1" stopColor={hz.front[1]} />
                        </SvgLinearGradient>
                      </Defs>
                      {/* painted left → right so each block's shaded side sits behind its right neighbour */}
                      {[0, 1, 2]
                        .map((i) => ({ i, col: r.cols[i] }))
                        .sort((a, b) => a.col - b.col)
                        .map(({ i, col }) => (
                          <Block
                            key={i}
                            id={gid}
                            x={r.left + rsw * col}
                            baseY={r.base}
                            w={rsw}
                            h={unit * r.rel[i] * r.s * easeGrow(clamp01((t - r.at - i * BACK_GAP) / BLOCK_DUR))}
                            dx={rdx}
                            dy={rdy}
                            faces={hz}
                          />
                        ))}
                      <Rect x={r.left - rs(6)} y={r.base - fogH} width={rsw * 3 + rdx + rs(12)} height={fogH + rs(3)} fill="url(#gFog)" />
                    </G>
                  );
                })}

                {/* front staircase — each block grows straight out of the floor */}
                {heights.map((h, i) => {
                  const g = grow(i);
                  // every few seconds the steps up to the current one dip in turn, like keys
                  const pl = clamp01((pressT - i * PRESS_GAP) / PRESS_DUR);
                  const dip = pressT >= 0 ? Math.sin(Math.PI * pl) * 0.06 : 0;
                  return (
                    <Block
                      key={i}
                      id={i === 2 ? "gGold" : "gStone"}
                      x={x0 + sw * i}
                      baseY={floorY}
                      w={sw}
                      h={h * g * (1 - dip)}
                      dx={dx}
                      dy={dy}
                      faces={i === 2 ? HERO : stone}
                      label={labels[i]}
                      labelOpacity={clamp01((g - 0.75) / 0.25)}
                      fontSize={i === 2 ? numSize : Math.round(numSize * 0.8)}
                    />
                  );
                })}
              </Svg>

              <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, tailStyle]}>
                <Sparkle x={goldCx + sw * 0.55} y={goldTop - rs(6)} s={rs(28)} delay={0} />
                <Sparkle x={goldCx - sw * 0.5} y={goldTop - rs(34)} s={rs(19)} delay={350} />
                <Sparkle x={goldCx + sw * 0.12} y={goldTop - rs(60)} s={rs(13)} delay={700} />
              </Animated.View>
            </>
          )}
        </View>

        {/* Reward + CTA */}
        <Animated.View style={tailStyle}>
          <RewardNote
            text={pickLang(lang, {
              ru: `+${MODULE_REWARD_COINS} монет`,
              en: `+${MODULE_REWARD_COINS} coins`,
              kk: `+${MODULE_REWARD_COINS} монета`,
            })}
            color={theme.text}
          />

          <Pressable
            onPress={proceed}
            style={({ pressed }) => [
              styles.cta,
              {
                backgroundColor: moduleColor,
                transform: [{ scale: pressed ? 0.97 : 1 }],
              },
            ]}
          >
            <View style={styles.ctaRow}>
              <Text style={[styles.ctaText, { color: readableText(moduleColor) }]}>
                {pickLang(lang, { ru: `К модулю ${to}`, en: `To module ${to}`, kk: `${to}-модульге` })}
              </Text>
              <NextChevron color={readableText(moduleColor)} size={rs(17)} />
            </View>
          </Pressable>
        </Animated.View>
      </View>

      {/* Balance pill — the coins fly in here and the number ticks up */}
      <Animated.View
        pointerEvents="none"
        style={[{ position: "absolute", top: pillTop, right: rs(16), width: PILL_W, height: rs(36) }, pillShow]}
      >
        <Animated.View
          style={[
            { position: "absolute", left: -rs(6), right: -rs(6), top: -rs(6), bottom: -rs(6), borderRadius: rs(24), backgroundColor: "rgba(255,216,87,0.3)" },
            pillGlow,
          ]}
        />
        <View
          style={[
            styles.pill,
            { backgroundColor: dark ? "rgba(255,255,255,0.08)" : "#FFFFFF", borderColor: "rgba(255,216,87,0.6)" },
          ]}
        >
          <GoldCoin size={rs(24)} />
          <Text style={[styles.pillText, { color: theme.text }]} numberOfLines={1}>
            {shownBalance}
          </Text>
        </View>
      </Animated.View>

      {flying &&
        Array.from({ length: COIN_N }, (_, i) => (
          <FlyingCoin key={i} i={i} from={coinFrom} to={coinTo} size={rs(26)} onArrive={onCoin} />
        ))}
    </Animated.View>
  );
}

/** Plain «+50 монет» line (no box) that fades out after 5 s; keeps its height
 *  so the CTA below doesn't jump. */
function RewardNote({ text, color }: { text: string; color: string }) {
  const op = useSharedValue(1);
  useEffect(() => {
    op.value = withDelay(5000, withTiming(0, { duration: 700 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const st = useAnimatedStyle(() => ({ opacity: op.value }));
  return (
    <View style={styles.reward}>
      <Animated.Text style={[styles.rewardValue, { color }, st]}>{text}</Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 999, elevation: 30 },
  title: {
    fontFamily: "Geologica_900Black",
    fontSize: 27,
    lineHeight: 32,
    letterSpacing: -0.6,
    textAlign: "center",
  },
  quote: {
    fontFamily: "Geologica_700Bold",
    fontSize: 15,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 12,
    maxWidth: 300,
  },
  stage: { flex: 1, marginHorizontal: -28, marginTop: 8, marginBottom: 40 },
  rankPill: { marginTop: 22 },
  reward: {
    height: 58,
    alignItems: "center",
    justifyContent: "center",
  },
  rewardValue: { fontFamily: "Geologica_900Black", fontSize: 20, letterSpacing: -0.1 },
  rewardLabel: { fontFamily: "Geologica_700Bold", fontSize: 14 },
  cta: {
    marginTop: 14,
    height: 58,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: { fontFamily: "Geologica_900Black", fontSize: 18, letterSpacing: -0.09 },
  ctaRow: { flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 24 },
  pill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderRadius: 18,
    borderWidth: 1.5,
    paddingLeft: 7,
    paddingRight: 12,
  },
  pillText: { fontFamily: "Geologica_900Black", fontSize: 16, fontVariant: ["tabular-nums"] },
});
