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
import { Ionicons } from "@expo/vector-icons";
import { useLang } from "@/context/LangContext";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import OreoMascot from "@/components/OreoMascot";

const { width: SW } = Dimensions.get("window");

interface SlideData {
  titleKey: string;
  subKey: string;
  icon: string;
  showOreo: boolean;
  iconBg: string;
}

const SLIDES: SlideData[] = [
  { titleKey: "onboarding1Title", subKey: "onboarding1Sub", icon: "hand-right", showOreo: true, iconBg: "#FFD166" },
  { titleKey: "onboarding2Title", subKey: "onboarding2Sub", icon: "map", showOreo: false, iconBg: "#2DCB8E" },
  { titleKey: "onboarding3Title", subKey: "onboarding3Sub", icon: "mic", showOreo: false, iconBg: "#7B61FF" },
  { titleKey: "onboarding4Title", subKey: "onboarding4Sub", icon: "star", showOreo: false, iconBg: "#FF6B6B" },
  { titleKey: "onboarding5Title", subKey: "onboarding5Sub", icon: "bulb", showOreo: true, iconBg: "#FFD166" },
];

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useLang();
  const { theme } = useTheme();
  const { user, completeOnboarding } = useAuth();

  const [step, setStep] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const isLast = step === SLIDES.length - 1;
  const slide = SLIDES[step];

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
    <View style={[s.root, { backgroundColor: theme.bg, paddingTop: topPad, paddingBottom: bottomPad + 16 }]}>
      <StatusBar barStyle={theme.mode === "dark" ? "light-content" : "dark-content"} />

      {/* Skip button */}
      <Animated.View entering={FadeIn} style={s.topBar}>
        <Pressable onPress={handleSkip} hitSlop={12} style={s.skipBtn}>
          <Text style={[s.skipTxt, { color: theme.textSecondary }]}>{t("skip")}</Text>
        </Pressable>
        {/* Step dots */}
        <View style={s.dots}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[
                s.dot,
                {
                  backgroundColor: i === step ? theme.accent : theme.cardBorder,
                  width: i === step ? 20 : 8,
                },
              ]}
            />
          ))}
        </View>
        <View style={{ width: 60 }} />
      </Animated.View>

      {/* Slides */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
        scrollEventThrottle={16}
        style={s.slider}
      >
        {SLIDES.map((sl, i) => (
          <OnboardingSlide
            key={i}
            slide={sl}
            isActive={i === step}
            theme={theme}
            t={t}
            userName={user?.name ?? ""}
          />
        ))}
      </ScrollView>

      {/* Navigation */}
      <Animated.View entering={FadeIn.delay(200)} style={s.nav}>
        <Pressable
          onPress={goNext}
          style={({ pressed }) => [
            s.nextBtn,
            {
              backgroundColor: theme.cta,
              opacity: pressed ? 0.88 : 1,
            },
          ]}
        >
          <Text style={[s.nextBtnTxt, { color: theme.ctaText }]}>
            {isLast ? t("letsGo") : t("next")}
          </Text>
          {!isLast && (
            <Ionicons name="arrow-forward" size={20} color={theme.ctaText} />
          )}
          {isLast && (
            <Ionicons name="rocket" size={20} color={theme.ctaText} />
          )}
        </Pressable>
      </Animated.View>
    </View>
  );
}

interface SlideProps {
  slide: SlideData;
  isActive: boolean;
  theme: any;
  t: (key: any, vars?: Record<string, string>) => string;
  userName: string;
}

function OnboardingSlide({ slide, isActive, theme, t, userName }: SlideProps) {
  const title = t(slide.titleKey as any, { name: userName });
  const sub = t(slide.subKey as any);

  return (
    <View style={[s.slide, { width: SW }]}>
      {/* Visual area */}
      <View style={s.visualWrap}>
        {slide.showOreo ? (
          <OreoMascot size={220} shouldPlay={isActive} />
        ) : (
          <View style={[s.iconWrap, { backgroundColor: slide.iconBg + "22" }]}>
            <View style={[s.iconCircle, { backgroundColor: slide.iconBg }]}>
              <Ionicons name={slide.icon as any} size={52} color="#0B1426" />
            </View>
          </View>
        )}
      </View>

      {/* Text */}
      <View style={s.textArea}>
        <Text style={[s.slideTitle, { color: theme.text }]}>{title}</Text>
        <Text style={[s.slideSub, { color: theme.textSecondary }]}>{sub}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: 0,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    marginBottom: 8,
    height: 44,
  },
  skipBtn: {
    width: 60,
  },
  skipTxt: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
  dots: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  slider: {
    flex: 1,
  },
  slide: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  visualWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    maxHeight: 320,
    width: "100%",
  },
  iconWrap: {
    width: 220,
    height: 220,
    borderRadius: 110,
    alignItems: "center",
    justifyContent: "center",
  },
  iconCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: "center",
    justifyContent: "center",
  },
  textArea: {
    alignItems: "center",
    paddingBottom: 24,
  },
  slideTitle: {
    fontSize: 30,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    marginBottom: 12,
    letterSpacing: -0.4,
  },
  slideSub: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 25,
    maxWidth: 300,
  },
  nav: {
    paddingHorizontal: 24,
  },
  nextBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderRadius: 16,
    paddingVertical: 18,
    shadowColor: "#FFD166",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 5,
  },
  nextBtnTxt: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.2,
  },
});
