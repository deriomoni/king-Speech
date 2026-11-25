// Welcome — the sign-in look: the dusk aurora draws itself out of black, the
// logo lands as in the splash, then the white greeting fades up with one flare
// of light. The language lives behind a globe button: tap it and
// РУС / ҚАЗ / ENG roll out as circles. The black «Начать» comes last and fades
// into sign-in, which keeps the same aurora and logo.
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, Platform, StatusBar } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import MaskedViewBase from "@react-native-masked-view/masked-view";
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { useLang, Lang, LANG_NAMES } from "@/context/LangContext";
import { rs } from "@/lib/responsive";
import { useScreenMusic } from "@/lib/music";
import { useSplashDone } from "@/lib/splashState";
import { AnimatedBrandLogo } from "@/components/AnimatedBrandLogo";
import AuroraBackground, { AURORA_DUSK } from "@/components/subscription/AuroraBackground";

const MaskedView = MaskedViewBase as unknown as React.ComponentType<any>;

const CREAM = "#FFF7F0";
const LOGO_AT = 700; // the aurora is drawing out of black meanwhile
const GREET_AT = LOGO_AT + 1050; // with the wordmark sliding out
const APPEAR_MS = 1600; // greeting fades up
const SHINE_MS = 1200; // the light sweeping through it
const SUB_AT = GREET_AT + 700;
const CTA_AT = GREET_AT + 1500;

const LANG_ORDER: Lang[] = ["ru", "kk", "en"];
const LANG_LABEL: Record<Lang, string> = { ru: "РУС", kk: "ҚАЗ", en: "ENG" };

/** The greeting: fades up, then glows and a bright band of light runs through it. */
function Greeting({ text, run, delay }: { text: string; run: boolean; delay: number }) {
  const appear = useSharedValue(0);
  const glow = useSharedValue(0);
  const shine = useSharedValue(0);
  const [boxW, setBoxW] = useState(0);

  useEffect(() => {
    if (!run) return;
    appear.value = withDelay(delay, withTiming(1, { duration: APPEAR_MS, easing: Easing.out(Easing.cubic) }));
    // once it's fully there: one flare of light that fades away
    glow.value = withDelay(
      delay + APPEAR_MS - 200,
      withSequence(
        withTiming(1, { duration: 500, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 1400, easing: Easing.inOut(Easing.quad) }),
      ),
    );
    shine.value = withDelay(delay + APPEAR_MS - 300, withTiming(1, { duration: SHINE_MS, easing: Easing.inOut(Easing.cubic) }));
  }, [run, delay, appear, glow, shine]);

  const textStyle = useAnimatedStyle(() => ({
    opacity: appear.value,
    transform: [{ translateY: (1 - appear.value) * 14 }, { scale: 0.96 + appear.value * 0.04 }],
  }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value }));
  const bandStyle = useAnimatedStyle(() => ({ transform: [{ translateX: -boxW + shine.value * boxW * 2 }] }));

  return (
    <Animated.View style={textStyle}>
      {/* soft white glow behind the letters */}
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
    // roll out to the left: travel + a turn; the farther circles start a touch
    // earlier so they lead and nothing overlaps on the way
    const start = (2 - index) * 0.08;
    const lag = Math.max(0, Math.min(1, (p.value - start) / (1 - start)));
    return {
      opacity: lag,
      transform: [
        { translateX: -(index + 1) * 54 * lag },
        { rotate: `${(1 - lag) * -240}deg` },
        { scale: 0.7 + lag * 0.3 },
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
    p.value = withTiming(open ? 1 : 0, { duration: open ? 650 : 450, easing: Easing.inOut(Easing.cubic) });
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
        <Ionicons name={open ? "close" : "globe-outline"} size={rs(24)} color="#FFFFFF" />
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
  const sub = useSharedValue(0);
  const [ctaShown, setCtaShown] = useState(false);
  // after a language switch the greeting comes back right away
  const [greetDelay, setGreetDelay] = useState(GREET_AT);

  useEffect(() => {
    if (!run) return;
    sub.value = withDelay(SUB_AT, withTiming(1, { duration: 900, easing: Easing.out(Easing.quad) }));
    const id = setTimeout(() => setCtaShown(true), CTA_AT);
    return () => clearTimeout(id);
  }, [run, sub]);

  const subStyle = useAnimatedStyle(() => ({ opacity: sub.value, transform: [{ translateY: (1 - sub.value) * 10 }] }));

  const chooseLang = (l: Lang) => {
    setGreetDelay(0);
    setLang(l);
  };

  // sign-in shares the aurora and the logo, so a plain fade is seamless
  const start = () => router.push("/(auth)/login");

  return (
    <View style={[s.root, { paddingTop: topPad, paddingBottom: bottomPad + rs(20) }]}>
      <StatusBar barStyle="light-content" />
      {/* black until the splash is gone, then the aurora draws out of it */}
      {run ? <AuroraBackground palette={AURORA_DUSK} dim={false} rim fromBlack shade={0} initialShade={0} /> : null}

      <View style={s.topRow}>
        <LangGlobe lang={lang} onPick={chooseLang} />
      </View>

      <View style={s.center}>
        {run ? <AnimatedBrandLogo width={rs(220)} color={CREAM} delay={LOGO_AT} /> : null}
        <View style={s.greetBox}>
          {/* key = language: a new language fades up and shines again */}
          <Greeting key={lang} text={text} run={run} delay={greetDelay} />
          <Animated.Text style={[s.sub, subStyle]}>{t("welcomeSub")}</Animated.Text>
        </View>
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
    </View>
  );
}

const CIRCLE = 46;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000000" },
  topRow: { flexDirection: "row", justifyContent: "flex-end", paddingHorizontal: 20, marginTop: 8, height: CIRCLE, zIndex: 2 },
  globeWrap: { width: CIRCLE, height: CIRCLE },
  globe: {
    width: CIRCLE,
    height: CIRCLE,
    alignItems: "center",
    justifyContent: "center",
  },
  globeOpen: {},
  langCircle: {
    position: "absolute",
    left: 0,
    top: 0,
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
    backgroundColor: "rgba(10,8,30,0.45)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
  },
  langCircleOn: { backgroundColor: "#FFFFFF", borderColor: "#FFFFFF" },
  langHit: { flex: 1, alignItems: "center", justifyContent: "center" },
  langTxt: { fontSize: 11.5, letterSpacing: 0.4, color: "#FFFFFF", fontFamily: "Geologica_800ExtraBold" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  // the logo sits in the middle as on sign-in; the words hang below it
  greetBox: { position: "absolute", left: 24, right: 24, top: "50%", marginTop: rs(70), alignItems: "center" },
  greeting: {
    fontSize: 46,
    lineHeight: 50,
    letterSpacing: -0.8,
    textAlign: "center",
    color: "#FFFFFF",
    fontFamily: "Geologica_900Black",
  },
  glow: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    textShadowColor: "rgba(255,255,255,0.95)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 22,
  },
  sub: {
    marginTop: 14,
    fontSize: 16,
    lineHeight: 23,
    textAlign: "center",
    color: "rgba(255,247,240,0.9)",
    textShadowColor: "rgba(10,8,30,0.45)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
    fontFamily: "Geologica_500Medium",
    maxWidth: 320,
  },
  btnBlock: { height: 58, marginHorizontal: 24 },
  btn: { height: 58, borderRadius: 32, backgroundColor: "#0A0A0C", alignItems: "center", justifyContent: "center" },
  btnTxt: { fontSize: 17, color: "#FFFFFF", fontFamily: "Geologica_800ExtraBold" },
});
