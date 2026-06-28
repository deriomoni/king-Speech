import React, { useEffect } from "react";
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
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useLang } from "@/context/LangContext";
import { MODULE_COLORS, getModuleQuote } from "@/context/GameContext";

/**
 * Full-screen module-transition — a continuation of the reward screen. A custom
 * (no-Rive) epic animation: the old module number flips away and the new one
 * punches into place over a glowing reflective floor, the whole background
 * morphing from the old module color to the new one, with a motivating quote
 * and a "Next" button that carries the player into the new module.
 */

function clampByte(n: number) {
  return Math.max(0, Math.min(255, Math.round(n)));
}
function parseHex(hex: string): [number, number, number] {
  const h = (hex || "").replace("#", "");
  if (h.length < 6) return [148, 104, 251];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function mix(hex: string, amount: number, toward: number): string {
  const [r, g, b] = parseHex(hex);
  return `rgb(${clampByte(r + (toward - r) * amount)},${clampByte(g + (toward - g) * amount)},${clampByte(b + (toward - b) * amount)})`;
}
function rgba(hex: string, a: number): string {
  const [r, g, b] = parseHex(hex);
  return `rgba(${r},${g},${b},${a})`;
}

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

function Particle({ index, color, areaW, areaH }: { index: number; color: string; areaW: number; areaH: number }) {
  const p = useSharedValue(0);
  const x = ((index * 97) % 100) / 100; // deterministic spread
  const size = 4 + (index % 3) * 2;
  const dur = 2200 + (index % 5) * 350;
  useEffect(() => {
    p.value = withDelay(
      index * 160,
      withRepeat(withTiming(1, { duration: dur, easing: Easing.out(Easing.quad) }), -1, false),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0, 0.15, 0.85, 1], [0, 0.9, 0.5, 0]),
    transform: [
      { translateY: interpolate(p.value, [0, 1], [areaH * 0.32, -areaH * 0.34]) },
      { translateX: interpolate(p.value, [0, 1], [0, (index % 2 ? 1 : -1) * 24]) },
      { scale: interpolate(p.value, [0, 1], [0.6, 1.2]) },
    ],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: "absolute",
          left: areaW * x,
          top: areaH * 0.5,
          width: size,
          height: size,
          borderRadius: size,
          backgroundColor: rgba(color, 0.9),
          shadowColor: color,
          shadowOpacity: 0.9,
          shadowRadius: 8,
        },
        style,
      ]}
    />
  );
}

export default function ModuleTransitionOverlay({
  from,
  to,
  color,
  onDone,
}: {
  from: number;
  to: number;
  color: string;
  onDone: () => void;
}) {
  const { lang } = useLang();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  const fromColor = MODULE_COLORS[from]?.color ?? color;
  const toColor = color || MODULE_COLORS[to]?.color || "#9468FB";

  const quote =
    getModuleQuote(to, lang) ||
    FALLBACK_QUOTES[lang === "en" ? "en" : "ru"][to % FALLBACK_QUOTES.ru.length];

  const NUM = Math.min(width * 0.5, height * 0.28, 220);
  const NUM_H = NUM * 1.12;

  const root = useSharedValue(0);
  const enter = useSharedValue(0);
  const roll = useSharedValue(0);
  const pop = useSharedValue(0);
  const flash = useSharedValue(0);
  const bgShift = useSharedValue(0);
  const glow = useSharedValue(0);
  const sweep = useSharedValue(0);

  const proceed = () => {
    if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
    root.value = withTiming(0, { duration: 300, easing: Easing.in(Easing.quad) });
    setTimeout(onDone, 300);
  };

  useEffect(() => {
    root.value = withTiming(1, { duration: 380, easing: Easing.out(Easing.quad) });
    enter.value = withSpring(1, { damping: 15, stiffness: 120 });
    bgShift.value = withDelay(380, withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.cubic) }));
    glow.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1050, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.4, { duration: 1050, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true,
    );
    sweep.value = withDelay(900, withRepeat(withTiming(1, { duration: 1700, easing: Easing.inOut(Easing.quad) }), -1, false));
    roll.value = withDelay(620, withTiming(1, { duration: 720, easing: Easing.inOut(Easing.cubic) }));
    pop.value = withDelay(880, withSpring(1, { damping: 9, stiffness: 140 }));
    flash.value = withDelay(
      880,
      withSequence(
        withTiming(1, { duration: 160, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 520, easing: Easing.in(Easing.quad) }),
      ),
    );

    // Android hardware back proceeds too.
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      proceed();
      return true;
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rootStyle = useAnimatedStyle(() => ({ opacity: root.value }));
  const bgStyle = useAnimatedStyle(() => ({ opacity: bgShift.value }));
  const stageStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: interpolate(enter.value, [0, 1], [0.85, 1]) },
      { translateY: interpolate(enter.value, [0, 1], [26, 0]) },
    ],
  }));

  const oldStyle = useAnimatedStyle(() => ({
    opacity: interpolate(roll.value, [0, 0.5], [1, 0], "clamp"),
    transform: [
      { perspective: 700 },
      { translateY: interpolate(roll.value, [0, 1], [0, -NUM_H * 0.8]) },
      { rotateX: `${interpolate(roll.value, [0, 1], [0, -80])}deg` },
      { scale: interpolate(roll.value, [0, 1], [1, 0.8]) },
    ],
  }));
  const newStyle = useAnimatedStyle(() => ({
    opacity: interpolate(roll.value, [0.3, 0.7], [0, 1], "clamp"),
    transform: [
      { perspective: 700 },
      { translateY: interpolate(roll.value, [0, 1], [NUM_H * 0.8, 0]) },
      { scale: 0.8 + 0.2 * pop.value },
    ],
  }));
  const flashStyle = useAnimatedStyle(() => ({
    opacity: flash.value * 0.85,
    transform: [{ scale: interpolate(flash.value, [0, 1], [0.6, 1.5]) }],
  }));
  const reflStyle = useAnimatedStyle(() => ({
    opacity: interpolate(roll.value, [0.5, 1], [0, 0.34], "clamp"),
    transform: [{ scaleY: -1 }, { translateY: interpolate(roll.value, [0, 1], [-NUM_H * 0.6, 0]) }],
  }));
  const floorStyle = useAnimatedStyle(() => ({
    opacity: interpolate(glow.value, [0.4, 1], [0.55, 1]),
    transform: [{ scaleX: interpolate(glow.value, [0.4, 1], [0.9, 1.08]) }],
  }));
  const haloStyle = useAnimatedStyle(() => ({
    opacity: interpolate(glow.value, [0.4, 1], [0.22, 0.5]),
    transform: [{ scale: interpolate(glow.value, [0.4, 1], [0.9, 1.15]) }],
  }));
  const sweepStyle = useAnimatedStyle(() => ({
    opacity: interpolate(sweep.value, [0, 0.5, 1], [0, 0.7, 0]),
    transform: [{ translateX: interpolate(sweep.value, [0, 1], [-NUM, NUM]) }],
  }));

  const numberBox: any = { width: NUM * 1.9, height: NUM_H, alignItems: "center", justifyContent: "center" };

  return (
    <Animated.View style={[styles.root, rootStyle]}>
      {/* Background morph: old module color → new module color */}
      <LinearGradient
        colors={[mix(fromColor, 0.6, 0), mix(fromColor, 0.26, 0), mix(fromColor, 0.7, 0)]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />
      <Animated.View style={[StyleSheet.absoluteFill, bgStyle]}>
        <LinearGradient
          colors={[mix(toColor, 0.6, 0), mix(toColor, 0.26, 0), mix(toColor, 0.72, 0)]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        />
      </Animated.View>

      {/* Ambient halo */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.halo,
          { width: width * 1.25, height: width * 1.25, borderRadius: width, backgroundColor: rgba(toColor, 0.5), top: height * 0.42 - width * 0.62 },
          haloStyle,
        ]}
      />

      {/* Rising sparks */}
      {Array.from({ length: 9 }).map((_, i) => (
        <Particle key={i} index={i} color={toColor} areaW={width} areaH={height} />
      ))}

      <View style={[StyleSheet.absoluteFill, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 22, paddingHorizontal: 26 }]}>
        {/* Hero number area */}
        <Animated.View style={[styles.heroArea, stageStyle]}>
          <Text style={[styles.caption, { color: rgba(toColor, 0.95), textShadowColor: rgba(toColor, 0.6) }]}>
            {lang === "en" ? "MODULE" : "МОДУЛЬ"}
          </Text>

          <View style={numberBox}>
            {/* glow flash burst behind the new number */}
            <Animated.View
              pointerEvents="none"
              style={[styles.flash, { width: NUM, height: NUM, borderRadius: NUM, backgroundColor: rgba(toColor, 0.85) }, flashStyle]}
            />
            <Animated.Text style={[styles.num, { fontSize: NUM, lineHeight: NUM_H, textShadowColor: rgba(toColor, 0.9) }, StyleSheet.absoluteFillObject as any, oldStyle]}>
              {from}
            </Animated.Text>
            <Animated.Text style={[styles.num, { fontSize: NUM, lineHeight: NUM_H, textShadowColor: rgba(toColor, 0.95) }, StyleSheet.absoluteFillObject as any, newStyle]}>
              {to}
            </Animated.Text>
            <Animated.View pointerEvents="none" style={[styles.sweep, sweepStyle]}>
              <LinearGradient colors={["transparent", "rgba(255,255,255,0.6)", "transparent"]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={{ flex: 1 }} />
            </Animated.View>
          </View>

          {/* Glowing floor */}
          <Animated.View style={[styles.floorWrap, floorStyle]}>
            <LinearGradient colors={["transparent", toColor, "transparent"]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={[styles.floor, { width: NUM * 2.2, shadowColor: toColor }]} />
          </Animated.View>

          {/* Reflection */}
          <View style={[numberBox, { height: NUM_H * 0.62, overflow: "hidden" }]}>
            <Animated.Text style={[styles.num, { fontSize: NUM, lineHeight: NUM_H, color: rgba(toColor, 0.9), position: "absolute", top: -NUM_H * 0.34 }, reflStyle]}>
              {to}
            </Animated.Text>
            <LinearGradient colors={["transparent", mix(toColor, 0.72, 0)]} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={StyleSheet.absoluteFill} pointerEvents="none" />
          </View>
        </Animated.View>

        {/* Quote + Next button */}
        <View style={styles.footer}>
          {!!quote && (
            <Text style={[styles.quote, { color: "rgba(255,255,255,0.92)" }]}>“{quote}”</Text>
          )}
          <Pressable onPress={proceed} style={({ pressed }) => [styles.nextBtn, { backgroundColor: "#FFFFFF", opacity: pressed ? 0.88 : 1, shadowColor: toColor }]}>
            <Text style={[styles.nextText, { color: "#11111A" }]}>{lang === "en" ? "Next" : "Далее"}</Text>
            <Ionicons name="arrow-forward" size={20} color="#11111A" />
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, zIndex: 999, elevation: 30 },
  halo: { position: "absolute", alignSelf: "center" },
  heroArea: { flex: 1, alignItems: "center", justifyContent: "center" },
  caption: {
    letterSpacing: 12,
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    marginBottom: 6,
    textShadowRadius: 10,
  },
  num: {
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
    textAlign: "center",
    textShadowRadius: 30,
    includeFontPadding: false,
  },
  flash: { position: "absolute", alignSelf: "center", shadowColor: "#fff", shadowOpacity: 1, shadowRadius: 40 },
  sweep: { position: "absolute", top: 0, bottom: 0, width: 100 },
  floorWrap: { alignItems: "center", justifyContent: "center", marginVertical: 2 },
  floor: { height: 4, borderRadius: 4, shadowOpacity: 0.95, shadowRadius: 18, shadowOffset: { width: 0, height: 0 }, elevation: 8 },
  footer: { alignItems: "center", gap: 18 },
  quote: {
    fontFamily: "Inter_500Medium",
    fontSize: 17,
    lineHeight: 25,
    textAlign: "center",
    fontStyle: "italic",
    paddingHorizontal: 12,
    textShadowColor: "rgba(0,0,0,0.3)",
    textShadowRadius: 6,
  },
  nextBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    alignSelf: "stretch",
    height: 56,
    borderRadius: 28,
    shadowOpacity: 0.5,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  nextText: { fontFamily: "Inter_700Bold", fontSize: 17 },
});
