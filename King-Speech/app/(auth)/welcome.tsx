// Welcome — on black. The greeting draws itself (white outline traced in,
// then filled), the line under it rises out of the dark, and «Начать» only
// appears after 3 s. Pressing it fades the screen out into sign-in.
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, Platform, StatusBar, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import Svg, { Text as SvgText } from "react-native-svg";
import { useLang, Lang, LANGS, LANG_NAMES } from "@/context/LangContext";
import { rs } from "@/lib/responsive";
import { useScreenMusic } from "@/lib/music";
import { useSplashDone } from "@/lib/splashState";

const LANG_SHORT: Record<Lang, string> = { ru: "RU", kk: "ҚАЗ", en: "EN" };
const AnimatedSvgText = Animated.createAnimatedComponent(SvgText);

const DRAW_MS = 1700; // outline traced in
const FILL_AT = 1100; // fill starts while the outline finishes
const SUB_AT = 1900; // the line under it
const CTA_AT = 3000; // «Начать»
const DASH = 1400; // longer than any glyph outline run

/** One line of the greeting: outline drawn in, then filled. */
function DrawnLine({ text, y, size, width, run }: { text: string; y: number; size: number; width: number; run: boolean }) {
  const draw = useSharedValue(0);
  const fill = useSharedValue(0);
  useEffect(() => {
    if (!run) return;
    draw.value = withTiming(1, { duration: DRAW_MS, easing: Easing.inOut(Easing.cubic) });
    fill.value = withDelay(FILL_AT, withTiming(1, { duration: 900, easing: Easing.out(Easing.quad) }));
  }, [run, draw, fill]);
  const props = useAnimatedProps(() => ({
    strokeDashoffset: DASH * (1 - draw.value),
    fillOpacity: fill.value,
    strokeOpacity: 1 - fill.value * 0.6,
  }));
  return (
    <AnimatedSvgText
      x={width / 2}
      y={y}
      textAnchor="middle"
      fontSize={size}
      fontFamily="Geologica_900Black"
      fontWeight="900"
      fill="#FFFFFF"
      stroke="#FFFFFF"
      strokeWidth={1.2}
      strokeDasharray={[DASH, DASH]}
      animatedProps={props}
    >
      {text}
    </AnimatedSvgText>
  );
}

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width: W } = useWindowDimensions();
  const { t, lang, setLang } = useLang();
  useScreenMusic("welcome");

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  // «Добро пожаловать!» → two lines; «Welcome!» stays on one
  const greeting = t("welcome");
  const words = greeting.split(" ");
  const lines = greeting.length > 11 && words.length > 1 ? [words[0], words.slice(1).join(" ")] : [greeting];
  const boxW = Math.min(W, 520) - 48;
  const size = rs(lines.length > 1 ? 44 : 52);
  const lineH = size * 1.12;

  // the line under it rises out of the dark
  const sub = useSharedValue(0);
  // leaving: the whole screen dims out before sign-in fades in
  const out = useSharedValue(1);
  const [ctaShown, setCtaShown] = useState(false);
  // the intro starts once the launch splash is gone, so it is actually seen
  const run = useSplashDone();
  useEffect(() => {
    if (!run) return;
    sub.value = withDelay(SUB_AT, withTiming(1, { duration: 900, easing: Easing.out(Easing.quad) }));
    const id = setTimeout(() => setCtaShown(true), CTA_AT);
    return () => clearTimeout(id);
  }, [run, sub]);
  const subStyle = useAnimatedStyle(() => ({ opacity: sub.value, transform: [{ translateY: (1 - sub.value) * 10 }] }));
  const outStyle = useAnimatedStyle(() => ({ opacity: out.value }));

  const start = () => {
    out.value = withTiming(0, { duration: 450, easing: Easing.in(Easing.quad) });
    setTimeout(() => router.push("/(auth)/login"), 420);
  };

  return (
    <View style={[s.root, { paddingTop: topPad, paddingBottom: bottomPad + rs(16) }]}>
      <StatusBar barStyle="light-content" />
      <Animated.View style={[s.fill, outStyle]}>
        {/* language — top right */}
        <Animated.View entering={FadeIn.delay(200).duration(600)} style={s.langRow}>
          {LANGS.map((code) => (
            <Pressable
              key={code}
              onPress={() => setLang(code)}
              accessibilityLabel={LANG_NAMES[code]}
              style={[s.langBtn, lang === code && s.langBtnOn]}
            >
              <Text style={[s.langTxt, { color: lang === code ? "#000000" : "rgba(255,255,255,0.55)" }]}>
                {LANG_SHORT[code]}
              </Text>
            </Pressable>
          ))}
        </Animated.View>

        <View style={s.center}>
          {/* key = text: switching language redraws the greeting */}
          <Svg key={greeting} width={boxW} height={lineH * lines.length + size * 0.25}>
            {lines.map((ln, i) => (
              <DrawnLine key={ln + i} text={ln} y={size + i * lineH} size={size} width={boxW} run={run} />
            ))}
          </Svg>
          <Animated.Text style={[s.sub, subStyle]}>{t("welcomeSub")}</Animated.Text>
        </View>

        <View style={s.btnBlock}>
          {ctaShown ? (
            <Animated.View entering={FadeInDown.duration(600)}>
              <Pressable onPress={start} style={({ pressed }) => [s.btn, { opacity: pressed ? 0.85 : 1 }]}>
                <Text style={s.btnTxt}>{t("start")}</Text>
              </Pressable>
            </Animated.View>
          ) : null}
        </View>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000000" },
  fill: { flex: 1 },
  langRow: { flexDirection: "row", gap: 8, alignSelf: "flex-end", marginRight: 20, marginTop: 8 },
  langBtn: {
    height: 30,
    minWidth: 47,
    paddingHorizontal: 10,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  langBtnOn: { backgroundColor: "#FFFFFF" },
  langTxt: { fontSize: 13, fontFamily: "Geologica_600SemiBold", letterSpacing: 0.65 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  sub: {
    marginTop: 14,
    fontSize: 16,
    lineHeight: 23,
    textAlign: "center",
    color: "rgba(255,255,255,0.65)",
    fontFamily: "Geologica_500Medium",
    maxWidth: 320,
  },
  btnBlock: { height: 58, marginHorizontal: 24 },
  btn: { height: 58, borderRadius: 32, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  btnTxt: { fontSize: 17, color: "#000000", fontFamily: "Geologica_800ExtraBold" },
});
