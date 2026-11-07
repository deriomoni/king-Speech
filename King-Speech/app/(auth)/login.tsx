import React, { useEffect, useState } from "react";
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
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn, FadeInDown, FadeInUp } from "react-native-reanimated";
import { useLang } from "@/context/LangContext";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { KingSpeechLogo, PillButton } from "@/components/auth/AuthUI";

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
      Alert.alert("Вход", authError);
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
      Alert.alert("Вход", "Авторизация не настроена. Добавь Firebase-ключи в Replit Secrets.");
      return;
    }
    setBusy("google");
    await signInWithGoogle();
  };

  const handleApple = async () => {
    if (!configured) {
      Alert.alert("Вход", "Авторизация не настроена. Добавь Firebase-ключи в Replit Secrets.");
      return;
    }
    setBusy("apple");
    await signInWithApple();
  };

  const handleEmail = () => {
    Alert.alert("Скоро", "Вход по Email будет добавлен позже. Сейчас доступны Google и Apple.");
  };

  const handleOffline = async () => {
    await continueOffline();
  };

  const en = lang === "en";
  // Figma "Вход · выбор способа" (65:3): a full-gold brand screen in both themes.
  const INK = theme.accentText;

  return (
    <View style={[s.root, { backgroundColor: theme.accent, paddingTop: topPad + 32, paddingBottom: bottomPad + 89 }]}>
      <StatusBar barStyle="dark-content" />

      <Animated.View entering={FadeIn} style={s.logoWrap}>
        <KingSpeechLogo color={INK} />
      </Animated.View>

      <View style={{ flex: 1 }} />

      <Animated.View entering={FadeInUp.delay(100).duration(500)}>
        <Text style={[s.headline, { color: INK }]}>{en ? "YOUR\nSTAGE." : "ТВОЙ\nВЫХОД."}</Text>
        <Text style={[s.panelNote, { color: "rgba(38,38,40,0.75)" }]}>
          {en ? "The stage awaits. Progress and crowns stay with you." : "Сцена ждёт. Прогресс и короны - с тобой."}
        </Text>
      </Animated.View>

      <Text style={[s.subtitle, { color: INK }]}>
        {en ? "Sign in to save your progress and achievements" : "Войди, чтобы сохранять прогресс и достижения"}
      </Text>

      {!configured && (
        <View style={s.notConfiguredBanner}>
          <Ionicons name="warning-outline" size={16} color={INK} />
          <Text style={[s.notConfiguredTxt, { color: "rgba(38,38,40,0.75)" }]}>
            Облачная авторизация не настроена. Доступен только режим без входа.
          </Text>
        </View>
      )}

      <Animated.View entering={FadeInDown.delay(200).duration(500)} style={s.btns}>
        {/* Google */}
        <PillButton
          label={en ? "Continue with Google" : "Войти через Google"}
          onPress={handleGoogle}
          disabled={busy !== null}
          busy={busy === "google"}
          left={
            <View style={[s.badge, { backgroundColor: INK }]}>
              <Text style={[s.badgeTxt, { color: theme.accent }]}>G</Text>
            </View>
          }
        />

        {/* Apple — iOS only (not in the Figma frame, kept as an ink pill) */}
        {Platform.OS === "ios" && (
          <Pressable
            style={({ pressed }) => [s.appleBtn, { backgroundColor: INK, opacity: pressed ? 0.85 : 1 }]}
            onPress={handleApple}
            disabled={busy !== null}
          >
            <Ionicons name="logo-apple" size={20} color={theme.accent} />
            <Text style={[s.appleTxt, { color: "#FFFFFF" }]}>{t("continueApple")}</Text>
            {busy === "apple" ? (
              <View style={s.busy}>
                <ActivityIndicator size="small" color="#FFFFFF" />
              </View>
            ) : null}
          </Pressable>
        )}

        {/* Email */}
        <PillButton
          label={en ? "Continue with email" : "Войти по email"}
          variant="secondaryOnGold"
          onPress={handleEmail}
          disabled={busy !== null}
        />
      </Animated.View>

      {/* Continue offline — always available as a fallback so the app
          remains playable when Firebase is not configured or the user
          doesn't want to sign in. Uses AsyncStorage only. */}
      <Pressable
        style={({ pressed }) => [s.skipBtn, { opacity: pressed ? 0.6 : 1 }]}
        onPress={handleOffline}
        disabled={busy !== null}
        hitSlop={10}
      >
        <Text style={[s.skipBtnTxt, { color: "#333234" }]}>
          {en ? "Continue without signing in  →" : "Продолжить без входа  →"}
        </Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: 24,
  },
  logoWrap: {
    marginLeft: 12,
    alignSelf: "flex-start",
  },
  headline: {
    marginLeft: 12,
    fontSize: 72,
    lineHeight: 70,
    paddingTop: 4,
    fontFamily: "Geologica_900Black",
    letterSpacing: -2.16,
  },
  panelNote: {
    marginLeft: 12,
    marginTop: 2,
    maxWidth: 320,
    fontSize: 15,
    lineHeight: 18,
    fontFamily: "Geologica_700Bold",
  },
  subtitle: {
    marginTop: 34,
    fontSize: 16,
    lineHeight: 19,
    fontFamily: "Geologica_600SemiBold",
  },
  notConfiguredBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: "rgba(38,38,40,0.08)",
  },
  notConfiguredTxt: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Geologica_600SemiBold",
    lineHeight: 16,
  },
  btns: {
    marginTop: 26,
    gap: 12,
  },
  badge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeTxt: {
    fontSize: 15,
    fontFamily: "Geologica_900Black",
  },
  appleBtn: {
    height: 60,
    borderRadius: 32,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  appleTxt: {
    fontSize: 17,
    fontFamily: "Geologica_800ExtraBold",
  },
  busy: {
    position: "absolute",
    right: 20,
  },
  skipBtn: {
    alignSelf: "center",
    marginTop: 20,
    paddingVertical: 0,
  },
  skipBtnTxt: {
    fontSize: 15,
    fontFamily: "Geologica_800ExtraBold",
    textAlign: "center",
  },
});
