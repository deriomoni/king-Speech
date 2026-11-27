// First-run tour over the main app, right after sign-up. Two cards, no buttons
// to skip or page through:
//   1. Oscar presents the app by voice, live: the card shows the phrase he is
//      saying, the app switches to the section he names and that tab is cut
//      out of the dimmed screen. When he finishes, the next card opens itself.
//   2. His send-off («По глазам вижу…») and «Начать путь» → the Path; the tour
//      never shows again.
import React, { useEffect, useMemo, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Svg, { Path } from "react-native-svg";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { Easing, FadeIn, FadeInDown, FadeOut, useAnimatedProps, useSharedValue, withTiming } from "react-native-reanimated";
import { useLang, pickLang } from "@/context/LangContext";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { rs } from "@/lib/responsive";
import { playUi } from "@/lib/uiSound";
import { DONE, OVERVIEW_CUES, cueAt, useOscarVoice, type OverviewFocus } from "@/lib/oscarVoice";
import OscarMascot from "@/components/OscarMascot";

const AnimatedPath = Animated.createAnimatedComponent(Path);

type L = { ru: string; en: string; kk: string };

// Must match the tab bar in app/(tabs)/_layout.tsx
const BAR_H = 64;
const BAR_MAX_W = 480;
const BAR_SIDE = 16;
const BAR_BORDER = 5;
const BAR_PAD = 8;

// the screen behind each part of the overview
const FOCUS_ROUTE: Record<string, string> = {
  bar: "/(tabs)",
  "0": "/(tabs)",
  "2": "/(tabs)/showtime",
  profileSettings: "/(tabs)/profile",
};

const SENDOFF: L = {
  ru: "По глазам вижу — тебе уже не терпится приступить! Поэтому не буду тебя томить. Вперёд и с песней!",
  en: "I can see it in your eyes — you can't wait to get started! So I won't keep you waiting. Off you go, and good luck!",
  kk: "Көріп тұрмын, бастағың келіп тұр! Сені ұстамайын. Алға, сәттілік!",
};

function rrect(x: number, y: number, w: number, h: number, r: number) {
  "worklet";
  const rr = Math.min(r, w / 2, h / 2);
  return (
    `M${x + rr},${y}H${x + w - rr}A${rr},${rr} 0 0 1 ${x + w},${y + rr}V${y + h - rr}` +
    `A${rr},${rr} 0 0 1 ${x + w - rr},${y + h}H${x + rr}A${rr},${rr} 0 0 1 ${x},${y + h - rr}` +
    `V${y + rr}A${rr},${rr} 0 0 1 ${x + rr},${y}Z`
  );
}

export default function AppTour() {
  const { width: W, height: H } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { lang } = useLang();
  const tr = (v: L) => pickLang(lang, v);
  const { themeMode } = useTheme();
  const { completeOnboarding } = useAuth();
  const [step, setStep] = useState<"overview" | "done">("overview");
  const [closing, setClosing] = useState(false);

  // ── 1. the overview, live with his voice
  const cues = OVERVIEW_CUES[lang] ?? OVERVIEW_CUES.ru!;
  const pos = useOscarVoice("overview", step === "overview" && !closing, 500);
  const cue = Math.max(0, cueAt(cues, pos));
  const focus: OverviewFocus = step === "overview" ? cues[cue].focus : "bar";

  // the app shows the section he is talking about
  useEffect(() => {
    if (step === "overview") router.navigate(FOCUS_ROUTE[String(focus)] as never);
  }, [step, focus, router]);

  // after his last word the send-off opens by itself
  useEffect(() => {
    if (step !== "overview" || pos !== DONE) return;
    const id = setTimeout(() => setStep("done"), 700);
    return () => clearTimeout(id);
  }, [step, pos]);

  // ── 2. the send-off
  useOscarVoice("sendoff", step === "done" && !closing, 400);

  const finish = async () => {
    if (closing) return;
    playUi("tapPrimary");
    setClosing(true);
    router.navigate("/(tabs)" as never);
    await completeOnboarding();
  };

  // the tab bar's geometry (same maths as the bar itself)
  const bottomInset = Platform.OS === "web" ? rs(18) : Math.max(insets.bottom, rs(12));
  const barW = Math.min(W - BAR_SIDE * 2, BAR_MAX_W);
  const barX = (W - barW) / 2;
  const barY = H - bottomInset - BAR_H;
  const slotW = (barW - BAR_BORDER * 2 - BAR_PAD * 2) / 5;

  // the cut-out in the dimmed screen: the whole bar, one tab or two
  const hole = useMemo(() => {
    const slotX = (k: number) => barX + BAR_BORDER + BAR_PAD + slotW * k;
    const d = rs(56);
    const cy = barY + BAR_H / 2 - d / 2;
    if (step === "done") return { x: W / 2, y: barY + BAR_H / 2, w: 0, h: 0, r: 0 };
    if (typeof focus === "number") return { x: slotX(focus + 0.5) - d / 2, y: cy, w: d, h: d, r: d / 2 };
    if (focus === "profileSettings") {
      const x0 = slotX(3.5) - d / 2;
      return { x: x0, y: cy, w: slotX(4.5) + d / 2 - x0, h: d, r: d / 2 };
    }
    return { x: barX, y: barY, w: barW, h: BAR_H, r: BAR_H / 2 };
  }, [step, focus, barX, barY, barW, slotW, W]);

  const hx = useSharedValue(hole.x);
  const hy = useSharedValue(hole.y);
  const hw = useSharedValue(hole.w);
  const hh = useSharedValue(hole.h);
  const hr = useSharedValue(hole.r);
  useEffect(() => {
    const cfg = { duration: 520, easing: Easing.inOut(Easing.cubic) };
    hx.value = withTiming(hole.x, cfg);
    hy.value = withTiming(hole.y, cfg);
    hw.value = withTiming(hole.w, cfg);
    hh.value = withTiming(hole.h, cfg);
    hr.value = withTiming(hole.r, cfg);
  }, [hole, hx, hy, hw, hh, hr]);
  const dimProps = useAnimatedProps(() => ({
    d: `M0,0H${W}V${H}H0Z` + (hw.value > 0.5 ? rrect(hx.value, hy.value, hw.value, hh.value, hr.value) : ""),
  }));

  const dark = themeMode === "dark";
  const card = dark ? "rgba(62,62,68,0.6)" : "rgba(255,255,255,0.8)";
  const edge = dark ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.95)";
  const ink = dark ? "#F0EEE9" : "#262628";

  return (
    <Animated.View
      entering={FadeIn.duration(500)}
      exiting={FadeOut.duration(400)}
      style={StyleSheet.absoluteFill}
      pointerEvents={closing ? "none" : "auto"}
    >
      {/* the dimmed screen with the cut-out; it also swallows taps on the app */}
      <Pressable style={StyleSheet.absoluteFill} onPress={() => {}}>
        <Svg width={W} height={H} style={StyleSheet.absoluteFill}>
          <AnimatedPath animatedProps={dimProps} fill="rgba(0,0,0,0.72)" fillRule="evenodd" />
        </Svg>
      </Pressable>

      <View
        pointerEvents="box-none"
        style={[
          s.cardWrap,
          step === "done" ? { top: 0, bottom: 0, justifyContent: "center" } : { bottom: H - barY + rs(22) },
        ]}
      >
        <Animated.View key={step} entering={FadeInDown.duration(450)} style={[s.card, { backgroundColor: card, borderColor: edge }]}>
          <BlurView intensity={60} tint={dark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
          <LinearGradient
            pointerEvents="none"
            colors={[dark ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.7)", "rgba(255,255,255,0)"]}
            style={[StyleSheet.absoluteFill, { bottom: "55%" }]}
          />

          {step === "overview" ? (
            // the phrase he is saying right now
            <View style={s.phraseBox}>
              <Animated.Text key={cue} entering={FadeIn.duration(450)} style={[s.phrase, { color: ink }]}>
                {cues[cue].text}
              </Animated.Text>
            </View>
          ) : (
            <>
              <View style={s.oscar}>
                <OscarMascot emotion="happy" size={rs(190)} />
              </View>
              <Text style={[s.phrase, s.center, { color: ink }]}>{tr(SENDOFF)}</Text>
              <Pressable onPress={finish} style={({ pressed }) => [s.btn, dark && s.btnDark, { opacity: pressed ? 0.85 : 1 }]}>
                <Text style={s.btnTxt}>{tr({ ru: "Начать путь", en: "Start the Path", kk: "Жолды бастау" })}</Text>
              </Pressable>
            </>
          )}
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  cardWrap: { position: "absolute", left: 16, right: 16, alignItems: "center" },
  card: { width: "100%", maxWidth: 440, borderRadius: 28, padding: 22, overflow: "hidden", borderWidth: 1 },
  phraseBox: { minHeight: 27 * 4 },
  phrase: { fontSize: 21, lineHeight: 27, letterSpacing: -0.2, fontFamily: "Geologica_800ExtraBold" },
  center: { textAlign: "center" },
  oscar: { alignItems: "center", marginBottom: 10 },
  btn: { marginTop: 22, height: 54, borderRadius: 27, backgroundColor: "#0A0A0C", alignItems: "center", justifyContent: "center" },
  btnDark: { backgroundColor: "rgba(255,255,255,0.12)" },
  btnTxt: { fontSize: 17, color: "#FFFFFF", fontFamily: "Geologica_800ExtraBold" },
});
