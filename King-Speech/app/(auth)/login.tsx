import React, { useCallback, useEffect, useState } from "react";
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
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { useLang, pickLang } from "@/context/LangContext";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { KingSpeechLogo } from "@/components/auth/AuthUI";
import AuroraBackground, { AURORA_DUSK } from "@/components/subscription/AuroraBackground";
import { rs } from "@/lib/responsive";

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
  const goEmail = () => {
    if (leaving) return;
    setLeaving(true);
    setTimeout(() => router.push("/(auth)/email"), 620);
  };
  useFocusEffect(
    useCallback(() => {
      setLeaving(false);
    }, []),
  );

  const topPad = Platform.OS === "web" ? 54 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  // When the auth state flips to a signed-in user, route based on profile
  // completeness. New accounts (no name yet) → profile-setup; existing ones
  // skip straight to onboarding or the main app.
  useEffect(() => {
    if (!user) return;
    setBusy(null);
    if (!user.profileCompleted) {
      router.replace("/(auth)/profile-setup");
    } else if (!user.onboardingCompleted) {
      router.replace("/(auth)/onboarding");
    } else {
      router.replace("/(tabs)");
    }
  }, [user, router]);

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
    if (!configured) {
      Alert.alert(pickLang(lang, { ru: "Вход", en: "Sign in", kk: "Кіру" }), pickLang(lang, { ru: "Авторизация не настроена. Добавь Firebase-ключи в Replit Secrets.", en: "Sign-in isn't configured. Add the Firebase keys to Replit Secrets.", kk: "Авторизация бапталмаған. Firebase кілттерін Replit Secrets-ке қосыңыз." }));
      return;
    }
    setBusy("google");
    await signInWithGoogle();
  };

  const handleApple = async () => {
    if (!configured) {
      Alert.alert(pickLang(lang, { ru: "Вход", en: "Sign in", kk: "Кіру" }), pickLang(lang, { ru: "Авторизация не настроена. Добавь Firebase-ключи в Replit Secrets.", en: "Sign-in isn't configured. Add the Firebase keys to Replit Secrets.", kk: "Авторизация бапталмаған. Firebase кілттерін Replit Secrets-ке қосыңыз." }));
      return;
    }
    setBusy("apple");
    await signInWithApple();
  };


  const handleOffline = async () => {
    await continueOffline();
  };

  // Sign-in on the paywall's animated aurora (same component, 1:1): light
  // logo in the middle, the ways in at the bottom.
  const INK = "#262628";
  const CREAM = "#FFF7F0";

  return (
    <View style={[s.root, { backgroundColor: "#070423", paddingTop: topPad, paddingBottom: bottomPad + rs(20) }]}>
      <StatusBar barStyle="light-content" />
      <AuroraBackground palette={AURORA_DUSK} dim={false} rim shade={leaving ? 1 : 0} initialShade={0} />

      <Animated.View entering={FadeIn.duration(500)} style={s.center}>
        <KingSpeechLogo color={CREAM} width={220} />
      </Animated.View>

      {!configured && (
        <View style={s.notConfiguredBanner}>
          <Ionicons name="warning-outline" size={rs(16)} color={CREAM} />
          <Text style={[s.notConfiguredTxt, { color: "rgba(255,247,240,0.75)" }]}>
            {pickLang(lang, { ru: "Облачная авторизация не настроена. Доступен только режим без входа.", en: "Cloud sign-in isn't configured. Only offline mode is available.", kk: "Бұлттық авторизация бапталмаған. Тек кірусіз режим қолжетімді." })}
          </Text>
        </View>
      )}

      <Animated.View entering={FadeInDown.delay(150).duration(500)} style={s.btns}>
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

      {/* Dev only: no Firebase keys yet → still let the team into the app. */}
      {__DEV__ && !configured ? (
        <Pressable onPress={handleOffline} disabled={busy !== null} hitSlop={8} style={{ alignSelf: "center", marginTop: rs(10) }}>
          <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", fontFamily: "Geologica_600SemiBold" }}>
            dev: продолжить без входа
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
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
