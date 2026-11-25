import React, { useCallback, useEffect, useRef, useState } from "react";
import NextChevron from "@/components/NextChevron";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  StatusBar,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useLang, pickLang } from "@/context/LangContext";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { AnimatedBrandLogo } from "@/components/AnimatedBrandLogo";
import AuroraBackground, { AURORA_DUSK } from "@/components/subscription/AuroraBackground";
import { rs } from "@/lib/responsive";
import { takeLogoHandoff } from "@/lib/splashState";
import { playUi } from "@/lib/uiSound";

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t, lang } = useLang();
  const { theme } = useTheme();
  const {
    user,
    signInWithGoogle,
    signInWithApple,
    continueOffline,
    authError,
    authCancelToken,
    configured,
  } = useAuth();
  const [busy, setBusy] = useState<"google" | "apple" | null>(null);
  // «Войти»: the stripes darken one by one, then the email screen (already
  // dark) takes over; coming back, they light up again the same way.
  const [leaving, setLeaving] = useState(false);
  // the logo glides down from where Welcome left it
  const handoff = useRef(takeLogoHandoff()).current;
  const logoRef = useRef<any>(null);
  const logoY = useSharedValue(0);
  const logoO = useSharedValue(handoff == null ? 1 : 0);
  const onLogoLayout = () => {
    if (handoff == null) return;
    logoRef.current?.measureInWindow((_x: number, y: number, _w: number, h: number) => {
      logoY.value = handoff - (y + h / 2);
      logoO.value = 1;
      logoY.value = withTiming(0, { duration: 1100, easing: Easing.inOut(Easing.cubic) });
    });
  };
  const logoStyle = useAnimatedStyle(() => ({ opacity: logoO.value, transform: [{ translateY: logoY.value }] }));

  const goEmail = () => {
    if (leaving) return;
    playUi("tapSecondary");
    setLeaving(true);
    setTimeout(() => router.push("/(auth)/email"), 950);
  };
  useFocusEffect(
    useCallback(() => {
      setLeaving(false);
    }, []),
  );

  const topPad = Platform.OS === "web" ? 54 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  // Signed in: the root gate (app/_layout.tsx) alone decides where to go.
  // This screen stays mounted under email/profile-setup, so routing from here
  // too re-opened profile-setup on every profile save — doubled screens and
  // Oscar talking over himself.
  useEffect(() => {
    if (user) setBusy(null);
  }, [user]);

  useEffect(() => {
    if (authError) {
      setBusy(null);
      Alert.alert(pickLang(lang, { ru: "Вход", en: "Sign in", kk: "Кіру" }), authError);
    }
  }, [authError]);

  // Instant reset whenever AuthContext signals a provider cancel/dismiss.
  useEffect(() => {
    if (authCancelToken > 0) setBusy(null);
  }, [authCancelToken]);

  // Safety reset: if any provider sheet is dismissed silently (e.g. the
  // Google web popup is closed by the OS before AuthContext sees it),
  // clear the busy flag after 30s so buttons don't stay disabled forever.
  useEffect(() => {
    if (!busy) return;
    const t = setTimeout(() => setBusy((b) => (b && !user ? null : b)), 30000);
    return () => clearTimeout(t);
  }, [busy, user]);

  const handleGoogle = async () => {
    if (!configured) playUi("tapPrimary");
    if (!configured) {
      Alert.alert(pickLang(lang, { ru: "Вход", en: "Sign in", kk: "Кіру" }), pickLang(lang, { ru: "Авторизация не настроена. Добавь Firebase-ключи в Replit Secrets.", en: "Sign-in isn't configured. Add the Firebase keys to Replit Secrets.", kk: "Авторизация бапталмаған. Firebase кілттерін Replit Secrets-ке қосыңыз." }));
      return;
    }
    playUi("tapPrimary");
    setBusy("google");
    await signInWithGoogle();
  };

  const handleApple = async () => {
    if (!configured) playUi("tapPrimary");
    if (!configured) {
      Alert.alert(pickLang(lang, { ru: "Вход", en: "Sign in", kk: "Кіру" }), pickLang(lang, { ru: "Авторизация не настроена. Добавь Firebase-ключи в Replit Secrets.", en: "Sign-in isn't configured. Add the Firebase keys to Replit Secrets.", kk: "Авторизация бапталмаған. Firebase кілттерін Replit Secrets-ке қосыңыз." }));
      return;
    }
    playUi("tapPrimary");
    setBusy("apple");
    await signInWithApple();
  };


  const handleOffline = async () => {
    playUi("tapSoft");
    await continueOffline();
  };

  // Sign-in on the paywall's animated aurora (same component, 1:1): light
  // logo in the middle, the ways in at the bottom.
  const INK = "#262628";
  // the ways in rise softly while the logo settles
  const UI_AT = 650;
  const CREAM = "#FFF7F0";

  return (
    <View style={[s.root, { backgroundColor: "#070423", paddingTop: topPad, paddingBottom: bottomPad + rs(20) }]}>
      <StatusBar barStyle="light-content" />
      <AuroraBackground palette={AURORA_DUSK} dim={false} rim shade={leaving ? 1 : 0} initialShade={0} />

      {/* the logo stays where Welcome left it */}
      <View style={s.center}>
        <Animated.View ref={logoRef} onLayout={onLogoLayout} style={logoStyle}>
          <AnimatedBrandLogo width={rs(220)} color={CREAM} instant />
        </Animated.View>
        <Animated.View entering={FadeIn.delay(UI_AT + 500).duration(1000)}>
          <QuoteRotator lang={lang} />
        </Animated.View>
      </View>

      {!configured && (
        <Animated.View entering={FadeIn.delay(UI_AT).duration(700)} style={s.notConfiguredBanner}>
          <Ionicons name="warning-outline" size={rs(16)} color={CREAM} />
          <Text style={[s.notConfiguredTxt, { color: "rgba(255,247,240,0.75)" }]}>
            {pickLang(lang, { ru: "Облачная авторизация не настроена. Доступен только режим без входа.", en: "Cloud sign-in isn't configured. Only offline mode is available.", kk: "Бұлттық авторизация бапталмаған. Тек кірусіз режим қолжетімді." })}
          </Text>
        </Animated.View>
      )}

      <Animated.View entering={FadeInDown.delay(UI_AT).duration(900)} style={s.btns}>
        {/* Google — the main way in: bright glass with a breathing glow */}
        <Pressable style={({ pressed }) => [s.btn, s.black, { opacity: pressed ? 0.85 : 1 }]} onPress={handleGoogle} disabled={busy !== null}>
          <Ionicons name="logo-google" size={rs(19)} color="#FFFFFF" />
          <Text style={[s.btnTxt, { color: "#FFFFFF" }]}>
            {pickLang(lang, { ru: "Войти через Google", en: "Continue with Google", kk: "Google арқылы кіру" })}
          </Text>
          {busy === "google" ? (
            <View style={s.busy}>
              <ActivityIndicator size="small" color="#FFFFFF" />
            </View>
          ) : null}
        </Pressable>

        {/* Apple — iOS only */}
        {Platform.OS === "ios" && (
          <Pressable style={({ pressed }) => [s.btn, s.black, { opacity: pressed ? 0.85 : 1 }]} onPress={handleApple} disabled={busy !== null}>
            <Ionicons name="logo-apple" size={rs(20)} color="#FFFFFF" />
            <Text style={[s.btnTxt, { color: "#FFFFFF" }]}>{t("continueApple")}</Text>
            {busy === "apple" ? (
              <View style={s.busy}>
                <ActivityIndicator size="small" color="#FFFFFF" />
              </View>
            ) : null}
          </Pressable>
        )}

      </Animated.View>

      {/* Email + password sign-in / sign-up */}
      <Animated.View entering={FadeIn.delay(UI_AT + 250).duration(700)}>
      <Pressable
        style={({ pressed }) => [s.skipBtn, { opacity: pressed ? 0.6 : 1 }]}
        onPress={goEmail}
        disabled={busy !== null}
        hitSlop={10}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: rs(8) }}>
          <Text style={[s.skipBtnTxt, { color: "#FFFFFF" }]}>
            {pickLang(lang, { ru: "Войти", en: "Sign in", kk: "Кіру" })}
          </Text>
          <NextChevron color="#FFFFFF" size={rs(13)} />
        </View>
      </Pressable>
      </Animated.View>

      {/* Dev only: no Firebase keys yet → still let the team into the app. */}
      {__DEV__ && !configured ? (
        <Animated.View entering={FadeIn.delay(UI_AT + 400).duration(700)}>
        <Pressable onPress={handleOffline} disabled={busy !== null} hitSlop={8} style={{ alignSelf: "center", marginTop: rs(10) }}>
          <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", fontFamily: "Geologica_600SemiBold" }}>
            dev: продолжить без входа
          </Text>
        </Pressable>
        </Animated.View>
      ) : null}
    </View>
  );
}

// Why speaking matters — in the words of people who knew. One every 15 s.
type LQ = { ru: string; en: string; kk: string };
const QUOTES: { text: LQ; who: LQ }[] = [
  {
    text: {
      ru: "Все великие ораторы поначалу были плохими ораторами.",
      en: "All the great speakers were bad speakers at first.",
      kk: "Барлық ұлы шешендер алғашында нашар сөйлеген.",
    },
    who: { ru: "Ральф Уолдо Эмерсон", en: "Ralph Waldo Emerson", kk: "Ральф Уолдо Эмерсон" },
  },
  {
    text: {
      ru: "Слово стало верным — стань верным и ты, слушатель.",
      en: "The word has been set right — listener, set yourself right too.",
      kk: "Сөз түзелді, тыңдаушы, сен де түзел.",
    },
    who: { ru: "Абай Кунанбаев", en: "Abai Kunanbayev", kk: "Абай Құнанбаев" },
  },
  {
    text: {
      ru: "Кто ясно мыслит, тот ясно излагает.",
      en: "What is well conceived is clearly said.",
      kk: "Анық ойлаған адам анық жеткізеді.",
    },
    who: { ru: "Никола Буало", en: "Nicolas Boileau", kk: "Никола Буало" },
  },
  {
    text: {
      ru: "Нет ничего столь невероятного, что слово не сделало бы убедительным.",
      en: "Nothing is so incredible that speech cannot make it convincing.",
      kk: "Сөз сендірмейтіндей мүмкін емес нәрсе жоқ.",
    },
    who: { ru: "Цицерон", en: "Cicero", kk: "Цицерон" },
  },
  {
    text: {
      ru: "Всё, что вообще может быть сказано, может быть сказано ясно.",
      en: "Whatever can be said at all can be said clearly.",
      kk: "Айтуға болатынның бәрін анық айтуға болады.",
    },
    who: { ru: "Людвиг Витгенштейн", en: "Ludwig Wittgenstein", kk: "Людвиг Витгенштейн" },
  },
];
const QUOTE_MS = 15000;

function QuoteRotator({ lang }: { lang: "ru" | "en" | "kk" }) {
  const [i, setI] = useState(0);
  const o = useSharedValue(1);
  useEffect(() => {
    const id = setInterval(() => {
      // fade out, swap, fade in
      o.value = withTiming(0, { duration: 700, easing: Easing.inOut(Easing.quad) });
      setTimeout(() => {
        setI((n) => (n + 1) % QUOTES.length);
        o.value = withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) });
      }, 720);
    }, QUOTE_MS);
    return () => clearInterval(id);
  }, [o]);
  const style = useAnimatedStyle(() => ({ opacity: o.value, transform: [{ translateY: (1 - o.value) * 6 }] }));
  const q = QUOTES[i];
  return (
    <Animated.View style={[s.quote, style]}>
      <Text style={s.quoteTxt}>«{q.text[lang]}»</Text>
      <Text style={s.quoteWho}>— {q.who[lang]}</Text>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  quote: { marginTop: 22, maxWidth: 300, alignItems: "center", minHeight: 86 },
  quoteTxt: {
    fontSize: 15,
    lineHeight: 21,
    textAlign: "center",
    color: "rgba(255,247,240,0.88)",
    fontFamily: "Geologica_500Medium",
    fontStyle: "italic",
  },
  quoteWho: { marginTop: 8, fontSize: 12.5, color: "rgba(255,247,240,0.6)", fontFamily: "Geologica_700Bold" },
  root: {
    flex: 1,
    paddingHorizontal: 24,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  notConfiguredBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: "rgba(10,8,30,0.38)",
  },
  notConfiguredTxt: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Geologica_600SemiBold",
    lineHeight: 16,
  },
  btns: {
    gap: 10,
  },
  btn: {
    height: 58,
    borderRadius: 32,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  // dark glass: reads on navy and on the bright pink / orange alike
  glass: {
    backgroundColor: "rgba(10,8,30,0.38)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
  },
  black: { backgroundColor: "#0A0A0C" },
  btnTxt: {
    fontSize: 17,
    fontFamily: "Geologica_800ExtraBold",
  },
  busy: {
    position: "absolute",
    right: 20,
  },
  skipBtn: {
    alignSelf: "center",
    marginTop: 18,
  },
  skipBtnTxt: {
    textShadowColor: "rgba(10,8,30,0.45)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
    fontSize: 15,
    fontFamily: "Geologica_700Bold",
    textAlign: "center",
  },
});
