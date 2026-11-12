import React, { useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  StatusBar,
  ScrollView,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Animated, { FadeIn } from "react-native-reanimated";
import { Image } from "expo-image";
import { SvgXml } from "react-native-svg";
import { useLang } from "@/context/LangContext";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import OscarMascot from "@/components/OscarMascot";
import { KingSpeechLogo, PillButton, useInk } from "@/components/auth/AuthUI";
import { ICON_MIC_SVG, ICON_PATH_SVG, ICON_STAR_SVG } from "@/assets/figma/auth/svgs";

const { width: SW } = Dimensions.get("window");

// Figma "Онбординг 1/5 … 5/5" (66:2, 66:35, 66:69, 66:103, 66:137).
type Visual =
  | { kind: "oscarHi" }
  | { kind: "icon"; xml: string; w: number; h: number }
  | { kind: "oscarTux" };

interface SlideData {
  gold: boolean; // gold stage tile (acts II–IV) vs card tile
  kicker: [string, string];
  title: [string, string]; // RU, EN — "\n" splits the two headline lines
  body: [string, string];
  visual: Visual;
  numeral?: string;
}

const SLIDES: SlideData[] = [
  {
    gold: false,
    kicker: ["АКТ I · ЗНАКОМСТВО", "ACT I · HELLO"],
    title: ["Привет,\n{name}!", "Hi,\n{name}!"],
    body: ["Давай покажу, как тут всё устроено", "Let me show you how everything works"],
    visual: { kind: "oscarHi" },
    numeral: "01",
  },
  {
    gold: true,
    kicker: ["АКТ II · ПУТЬ", "ACT II · PATH"],
    title: ["Главный\nэкран", "Home\nscreen"],
    body: ["Здесь ты видишь свой путь - уровни и задания", "Here you can see your path - levels and tasks"],
    visual: { kind: "icon", xml: ICON_PATH_SVG, w: 120, h: 116.782 },
    numeral: "02",
  },
  {
    gold: true,
    kicker: ["АКТ III · РЕЖИМЫ", "ACT III · MODES"],
    title: ["Режимы\nтренировок", "Training\nmodes"],
    body: ["Выбирай режим и нажимай «Старт»", "Pick a mode and tap “Start”"],
    visual: { kind: "icon", xml: ICON_MIC_SVG, w: 83.0769, h: 120 },
    numeral: "03",
  },
  {
    gold: true,
    kicker: ["АКТ IV · НАГРАДЫ", "ACT IV · REWARDS"],
    title: ["Зарабатывай\nочки", "Earn\npoints"],
    body: ["Проходи уровни, набирай XP и прокачивай свой голос", "Complete levels, earn XP and level up your voice"],
    visual: { kind: "icon", xml: ICON_STAR_SVG, w: 120, h: 111.892 },
    numeral: "04",
  },
  {
    gold: false,
    kicker: ["ФИНАЛ · СОВЕТ ДНЯ", "FINALE · DAILY TIP"],
    title: ["Совет\nдня", "Daily\ntip"],
    body: ["Заходи каждый день - даже 5 минут делают тебя лучше!", "Come back every day - even 5 minutes makes you better!"],
    visual: { kind: "oscarTux" },
  },
];

const OSCAR_TUX = require("@/assets/figma/auth/oscar-tux-laugh.png");

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { lang } = useLang();
  const { theme } = useTheme();
  const { ink } = useInk();
  const { user, completeOnboarding } = useAuth();
  const en = lang === "en";

  const [step, setStep] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const topPad = Platform.OS === "web" ? 54 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const isLast = step === SLIDES.length - 1;

  const goNext = () => {
    if (isLast) {
      handleFinish();
      return;
    }
    const next = step + 1;
    setStep(next);
    scrollRef.current?.scrollTo({ x: next * SW, animated: true });
  };

  const handleFinish = async () => {
    await completeOnboarding();
    router.replace("/(tabs)");
  };

  const handleSkip = async () => {
    await handleFinish();
  };

  const onScroll = (e: any) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / SW);
    if (idx !== step) setStep(idx);
  };

  return (
    <View style={[s.root, { backgroundColor: theme.bg, paddingTop: topPad + 10, paddingBottom: bottomPad + 10 }]}>
      <StatusBar barStyle={theme.mode === "dark" ? "light-content" : "dark-content"} />

      {/* Logo + skip */}
      <Animated.View entering={FadeIn} style={s.topBar}>
        <KingSpeechLogo width={111.3} color={theme.text} />
        {!isLast && (
          <Pressable onPress={handleSkip} hitSlop={12}>
            <Text style={[s.skipTxt, { color: ink(0.55) }]}>{en ? "Skip" : "Пропустить"}</Text>
          </Pressable>
        )}
      </Animated.View>

      {/* Progress segments */}
      <View style={s.progress}>
        {SLIDES.map((_, i) => (
          <View key={i} style={[s.seg, { backgroundColor: i <= step ? theme.accent : ink(0.15) }]} />
        ))}
      </View>

      {/* Slides */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
        scrollEventThrottle={16}
        style={s.slider}
      >
        {SLIDES.map((sl, i) => (
          <OnboardingSlide key={i} slide={sl} en={en} userName={user?.name ?? ""} />
        ))}
      </ScrollView>

      {/* Navigation */}
      <Animated.View entering={FadeIn.delay(200)} style={s.nav}>
        <PillButton
          label={isLast ? (en ? "Let's go!" : "Погнали!") : en ? "Next  →" : "Далее  →"}
          onPress={goNext}
        />
      </Animated.View>
    </View>
  );
}

function OnboardingSlide({ slide, en, userName }: { slide: SlideData; en: boolean; userName: string }) {
  const { theme } = useTheme();
  const { ink, stroke } = useInk();
  const L = en ? 1 : 0;
  const [line1, line2] = slide.title[L].replace("{name}", userName).split("\n");
  const firstSlide = slide.visual.kind === "oscarHi";

  return (
    <View style={[s.slide, { width: SW }]}>
      {/* Stage tile */}
      <View style={[s.tile, { backgroundColor: slide.gold ? theme.accent : theme.card, borderColor: stroke }]}>
        {slide.numeral ? (
          <View style={s.numeralClip} pointerEvents="none">
            <Text
              style={[s.numeral, { color: slide.gold ? "rgba(38,38,40,0.12)" : theme.accent }]}
              numberOfLines={1}
            >
              {slide.numeral}
            </Text>
          </View>
        ) : null}

        <Text style={[s.kicker, { color: slide.gold ? "rgba(38,38,40,0.8)" : ink(0.7) }]}>{slide.kicker[L]}</Text>

        {slide.visual.kind === "oscarHi" && (
          <View style={s.oscarHi}>
            <OscarMascot emotion="hi" size={230} />
          </View>
        )}
        {slide.visual.kind === "icon" && (
          <View style={s.icon}>
            <SvgXml xml={slide.visual.xml} width={slide.visual.w} height={slide.visual.h} />
          </View>
        )}
        {slide.visual.kind === "oscarTux" && (
          <View style={s.tuxWrap}>
            <Image source={OSCAR_TUX} style={s.tux} contentFit="cover" />
          </View>
        )}
      </View>

      {/* Text */}
      <Text style={[s.slideTitle, { color: theme.text }]}>
        {line1}
        {line2 !== undefined ? "\n" : ""}
        {line2 !== undefined ? (
          <Text style={firstSlide ? { color: theme.accentInk } : undefined}>{line2}</Text>
        ) : null}
      </Text>
      <Text style={[s.slideSub, { color: ink(0.7) }]}>{slide.body[L]}</Text>
    </View>
  );
}

const TILE_H = 380;

const s = StyleSheet.create({
  root: {
    flex: 1,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    height: 37,
  },
  skipTxt: {
    fontSize: 15,
    fontFamily: "Geologica_800ExtraBold",
    textAlign: "right",
  },
  progress: {
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 24,
    marginTop: 17,
    marginBottom: 22,
  },
  seg: {
    flex: 1,
    height: 6,
    borderRadius: 3,
  },
  slider: {
    flex: 1,
  },
  slide: {
    paddingHorizontal: 24,
  },
  tile: {
    height: TILE_H,
    borderRadius: 22,
    borderWidth: 2,
  },
  numeralClip: {
    position: "absolute",
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    borderRadius: 22,
    overflow: "hidden",
  },
  numeral: {
    position: "absolute",
    left: 126,
    top: 184,
    width: 320,
    fontSize: 230,
    lineHeight: 230,
    fontFamily: "Geologica_900Black",
    letterSpacing: -13.8,
  },
  kicker: {
    position: "absolute",
    left: 20,
    top: 20,
    fontSize: 13,
    fontFamily: "Geologica_900Black",
    letterSpacing: 0.65,
  },
  oscarHi: {
    position: "absolute",
    left: -15,
    top: 22,
    width: 300,
    height: 300,
  },
  icon: {
    position: "absolute",
    left: 20,
    top: 58,
  },
  tuxWrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 24,
  },
  tux: {
    width: 270,
    height: 270,
    borderRadius: 135,
  },
  slideTitle: {
    marginTop: 26,
    fontSize: 42,
    lineHeight: 46.2,
    fontFamily: "Geologica_900Black",
    letterSpacing: -0.84,
  },
  slideSub: {
    marginTop: 8,
    maxWidth: 330,
    fontSize: 16,
    lineHeight: 19.2,
    fontFamily: "Geologica_600SemiBold",
  },
  nav: {
    paddingHorizontal: 24,
  },
});
