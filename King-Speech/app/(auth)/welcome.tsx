// Welcome — on black. Oscar rises in softly, the gold greeting fades up and,
// once it's fully there, a bright light flares through it. The language lives
// behind a globe button: tap it and РУС / ҚАЗ / ENG roll out as circles.
// «Начать» appears after 3 s; pressing it blurs the screen out into sign-in.
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, Platform, StatusBar } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import MaskedViewBase from "@react-native-masked-view/masked-view";
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { useLang, Lang, LANG_NAMES } from "@/context/LangContext";
import { rs } from "@/lib/responsive";
import { useScreenMusic } from "@/lib/music";
import { useSplashDone } from "@/lib/splashState";
import OscarMascot from "@/components/OscarMascot";

const MaskedView = MaskedViewBase as unknown as React.ComponentType<any>;
const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);

const BRAND_GOLD = "#FFD857";
const APPEAR_MS = 1600; // greeting fades up
const SHINE_MS = 1200; // the light sweeping through it
const SUB_AT = 1700;
const CTA_AT = 3000;

const LANG_ORDER: Lang[] = ["ru", "kk", "en"];
const LANG_LABEL: Record<Lang, string> = { ru: "РУС", kk: "ҚАЗ", en: "ENG" };

/** The greeting: fades up, then glows and a bright band of light runs through it. */
function Greeting({ text, run }: { text: string; run: boolean }) {
  const appear = useSharedValue(0);
  const glow = useSharedValue(0);
  const shine = useSharedValue(0);
  const [boxW, setBoxW] = useState(0);

  useEffect(() => {
    if (!run) return;
    appear.value = withTiming(1, { duration: APPEAR_MS, easing: Easing.out(Easing.cubic) });
    // once it's fully there: a flare of light, settling into a soft glow
    glow.value = withDelay(
      APPEAR_MS - 200,
      withSequence(
        withTiming(1, { duration: 500, easing: Easing.out(Easing.quad) }),
        withTiming(0.45, { duration: 1100, easing: Easing.inOut(Easing.quad) }),
      ),
    );
    shine.value = withDelay(APPEAR_MS - 300, withTiming(1, { duration: SHINE_MS, easing: Easing.inOut(Easing.cubic) }));
  }, [run, appear, glow, shine]);

  const textStyle = useAnimatedStyle(() => ({
    opacity: appear.value,
    transform: [{ translateY: (1 - appear.value) * 14 }, { scale: 0.96 + appear.value * 0.04 }],
  }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value }));
  const bandStyle = useAnimatedStyle(() => ({ transform: [{ translateX: -boxW + shine.value * boxW * 2 }] }));

  return (
    <Animated.View style={textStyle}>
      {/* soft gold glow behind the letters */}
      <Animated.Text style={[s.greeting, s.glow, glowStyle]} pointerEvents="none">
        {text}
      </Animated.Text>
      <Text style={s.greeting} onLayout={(e) => setBoxW(e.nativeEvent.layout.width)}>
        {text}
      </Text>
      {/* a bright band of light running through the letters (native: masked by the text) */}
      {boxW > 0 && Platform.OS !== "web" ? (
        <MaskedView
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
          maskElement={<Text style={[s.greeting, { color: "#000000" }]}>{text}</Text>}
        >
          <Animated.View style={[{ position: "absolute", top: 0, bottom: 0, width: boxW }, bandStyle]}>
            <LinearGradient
              colors={["rgba(255,255,255,0)", "rgba(255,255,255,0.95)", "rgba(255,255,255,0)"]}
              locations={[0.3, 0.5, 0.7]}
              start={{ x: 0, y: 0.3 }}
              end={{ x: 1, y: 0.7 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        </MaskedView>
      ) : null}
    </Animated.View>
  );
}

function LangCircle({
  index,
  p,
  label,
  name,
  on,
  open,
  onPress,
}: {
  index: number;
  p: SharedValue<number>;
  label: string;
  name: string;
  on: boolean;
  open: boolean;
  onPress: () => void;
}) {
  const style = useAnimatedStyle(() => {
    // roll out to the left: travel + a turn, each circle a beat after the last
    const lag = Math.max(0, Math.min(1, p.value * 1.25 - index * 0.12));
    return {
      opacity: lag,
      transform: [
        { translateX: -(index + 1) * 54 * lag },
        { rotate: `${(1 - lag) * -300}deg` },
        { scale: 0.6 + lag * 0.4 },
      ],
    };
  });
  return (
    <Animated.View pointerEvents={open ? "auto" : "none"} style={[s.langCircle, on && s.langCircleOn, style]}>
      <Pressable onPress={onPress} accessibilityLabel={name} style={s.langHit}>
        <Text style={[s.langTxt, on && { color: "#000000" }]}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

/** Globe button (as in Settings); the three languages roll out of it as circles. */
function LangGlobe({ lang, onPick }: { lang: Lang; onPick: (l: Lang) => void }) {
  const [open, setOpen] = useState(false);
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withSpring(open ? 1 : 0, { damping: 15, stiffness: 140 });
  }, [open, p]);
  return (
    <View style={s.globeWrap}>
      {LANG_ORDER.map((code, i) => (
        <LangCircle
          key={code}
          index={i}
          p={p}
          label={LANG_LABEL[code]}
          name={LANG_NAMES[code]}
          on={lang === code}
          open={open}
          onPress={() => {
            onPick(code);
            setOpen(false);
          }}
        />
      ))}
      <Pressable
        onPress={() => setOpen((v) => !v)}
        style={({ pressed }) => [s.globe, open && s.globeOpen, { opacity: pressed ? 0.8 : 1 }]}
        accessibilityLabel="Language"
      >
        <Ionicons name={open ? "close" : "globe-outline"} size={rs(20)} color={open ? "#000000" : "#FFFFFF"} />
      </Pressable>
    </View>
  );
}

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t, lang, setLang } = useLang();
  useScreenMusic("welcome");

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  // «Добро пожаловать!» → two lines; «Welcome!» stays on one
  const greeting = t("welcome");
  const words = greeting.split(" ");
  const text = greeting.length > 11 && words.length > 1 ? `${words[0]}\n${words.slice(1).join(" ")}` : greeting;

  const run = useSplashDone();
  const oscar = useSharedValue(0);
  const sub = useSharedValue(0);
  const blur = useSharedValue(0);
  const out = useSharedValue(1);
  const [ctaShown, setCtaShown] = useState(false);

  useEffect(() => {
    if (!run) return;
    // Oscar: a slow, soft rise
    oscar.value = withTiming(1, { duration: 1400, easing: Easing.out(Easing.cubic) });
    sub.value = withDelay(SUB_AT, withTiming(1, { duration: 900, easing: Easing.out(Easing.quad) }));
    const id = setTimeout(() => setCtaShown(true), CTA_AT);
    return () => clearTimeout(id);
  }, [run, oscar, sub]);

  const oscarStyle = useAnimatedStyle(() => ({
    opacity: oscar.value,
    transform: [{ translateY: (1 - oscar.value) * 30 }, { scale: 0.88 + oscar.value * 0.12 }],
  }));
  const subStyle = useAnimatedStyle(() => ({ opacity: sub.value, transform: [{ translateY: (1 - sub.value) * 10 }] }));
  const outStyle = useAnimatedStyle(() => ({ opacity: out.value }));
  const blurProps = useAnimatedProps(() => ({ intensity: blur.value * 60 }));

  const start = () => {
    // the screen blurs out; sign-in then arrives blurred and clears
    blur.value = withTiming(1, { duration: 500, easing: Easing.in(Easing.quad) });
    out.value = withTiming(0, { duration: 650, easing: Easing.in(Easing.quad) });
    setTimeout(() => router.push("/(auth)/login"), 520);
  };

  return (
    <View style={[s.root, { paddingTop: topPad, paddingBottom: bottomPad + rs(16) }]}>
      <StatusBar barStyle="light-content" />
      <Animated.View style={[s.fill, outStyle]}>
        <View style={s.topRow}>
          <LangGlobe lang={lang} onPick={setLang} />
        </View>

        <View style={s.center}>
          <Animated.View style={[s.oscar, oscarStyle]}>
            <OscarMascot emotion="hi" size={rs(190)} />
          </Animated.View>
          {/* key = language: a new language fades up and shines again */}
          <Greeting key={lang} text={text} run={run} />
          <Animated.Text style={[s.sub, subStyle]}>{t("welcomeSub")}</Animated.Text>
        </View>

        <View style={s.btnBlock}>
          {ctaShown ? (
            <Animated.View entering={FadeInDown.duration(700)}>
              <Pressable onPress={start} style={({ pressed }) => [s.btn, { opacity: pressed ? 0.85 : 1 }]}>
                <Text style={s.btnTxt}>{t("start")}</Text>
              </Pressable>
            </Animated.View>
          ) : null}
        </View>
      </Animated.View>
      <AnimatedBlurView pointerEvents="none" tint="dark" animatedProps={blurProps} style={StyleSheet.absoluteFill} />
    </View>
  );
}

const CIRCLE = 46;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000000" },
  fill: { flex: 1 },
  topRow: { flexDirection: "row", justifyContent: "flex-end", paddingHorizontal: 20, marginTop: 8, height: CIRCLE },
  globeWrap: { width: CIRCLE, height: CIRCLE },
  globe: {
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  globeOpen: { backgroundColor: "#FFFFFF" },
  langCircle: {
    position: "absolute",
    left: 0,
    top: 0,
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
    backgroundColor: "#1A1A1C",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  langCircleOn: { backgroundColor: "#FFFFFF", borderColor: "#FFFFFF" },
  langHit: { flex: 1, alignItems: "center", justifyContent: "center" },
  langTxt: { fontSize: 11.5, letterSpacing: 0.4, color: "#FFFFFF", fontFamily: "Geologica_800ExtraBold" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  oscar: { marginBottom: 14, alignItems: "center", justifyContent: "center" },
  greeting: {
    fontSize: 46,
    lineHeight: 50,
    letterSpacing: -0.8,
    textAlign: "center",
    color: BRAND_GOLD,
    fontFamily: "Geologica_900Black",
  },
  glow: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    textShadowColor: "rgba(255,216,87,0.95)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 22,
  },
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
