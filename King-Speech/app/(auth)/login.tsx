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

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useLang();
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

  const topPad = Platform.OS === "web" ? 67 : insets.top;
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

  return (
    <View style={[s.root, { backgroundColor: theme.bg, paddingTop: topPad, paddingBottom: bottomPad + 24 }]}>
      <StatusBar barStyle={theme.mode === "dark" ? "light-content" : "dark-content"} />

      {/* Back */}
      <Animated.View entering={FadeIn} style={[s.backRow, { paddingTop: 4 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={s.backBtn}>
          <Ionicons name="chevron-back" size={28} color={theme.text} />
        </Pressable>
      </Animated.View>

      <Animated.View entering={FadeInUp.delay(100).springify()} style={s.header}>
        {/* Crown / logo mark */}
        <View style={[s.logoMark, { backgroundColor: theme.accent }]}>
          <Text style={s.logoIcon}>👑</Text>
        </View>
        <Text style={[s.title, { color: theme.text }]}>{t("loginTitle")}</Text>
        <Text style={[s.sub, { color: theme.textSecondary }]}>{t("loginSub")}</Text>
      </Animated.View>

      {!configured && (
        <View
          style={[
            s.notConfiguredBanner,
            { backgroundColor: theme.card, borderColor: theme.cardBorder },
          ]}
        >
          <Ionicons name="warning-outline" size={18} color="#FFB020" />
          <Text style={[s.notConfiguredTxt, { color: theme.textSecondary }]}>
            Облачная авторизация не настроена. Доступен только режим без входа.
          </Text>
        </View>
      )}

      <Animated.View entering={FadeInDown.delay(200).springify()} style={s.btns}>
        {/* Google */}
        <Pressable
          style={({ pressed }) => [
            s.authBtn,
            { backgroundColor: theme.card, borderColor: theme.cardBorder, opacity: pressed ? 0.85 : 1 },
          ]}
          onPress={handleGoogle}
          disabled={busy !== null}
        >
          <View style={s.authBtnInner}>
            <View style={s.providerIcon}>
              <Text style={s.googleG}>G</Text>
            </View>
            <Text style={[s.authBtnTxt, { color: theme.text }]}>{t("continueGoogle")}</Text>
          </View>
          {busy === "google" ? (
            <ActivityIndicator size="small" color={theme.textSecondary} />
          ) : (
            <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
          )}
        </Pressable>

        {/* Apple — iOS only */}
        {Platform.OS === "ios" && (
          <Pressable
            style={({ pressed }) => [
              s.authBtn,
              s.appleBtn,
              { opacity: pressed ? 0.85 : 1 },
            ]}
            onPress={handleApple}
            disabled={busy !== null}
          >
            <View style={s.authBtnInner}>
              <View style={[s.providerIcon, s.appleIcon]}>
                <Ionicons name="logo-apple" size={20} color="#fff" />
              </View>
              <Text style={[s.authBtnTxt, { color: "#fff" }]}>{t("continueApple")}</Text>
            </View>
            {busy === "apple" ? (
              <ActivityIndicator size="small" color="rgba(255,255,255,0.6)" />
            ) : (
              <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.5)" />
            )}
          </Pressable>
        )}

        {/* Divider */}
        <View style={s.dividerRow}>
          <View style={[s.dividerLine, { backgroundColor: theme.cardBorder }]} />
          <Text style={[s.dividerTxt, { color: theme.textSecondary }]}>{t("orDivider")}</Text>
          <View style={[s.dividerLine, { backgroundColor: theme.cardBorder }]} />
        </View>

        {/* Email */}
        <Pressable
          style={({ pressed }) => [
            s.emailBtn,
            { borderColor: theme.cardBorder, opacity: pressed ? 0.7 : 1 },
          ]}
          onPress={handleEmail}
          disabled={busy !== null}
        >
          <Ionicons name="mail-outline" size={20} color={theme.textSecondary} style={{ marginRight: 10 }} />
          <Text style={[s.emailBtnTxt, { color: theme.textSecondary }]}>{t("continueEmail")}</Text>
        </Pressable>

        {/* Continue offline — always available as a fallback so the app
            remains playable when Firebase is not configured or the user
            doesn't want to sign in. Uses AsyncStorage only. */}
        <Pressable
          style={({ pressed }) => [s.skipBtn, { opacity: pressed ? 0.6 : 1 }]}
          onPress={handleOffline}
          disabled={busy !== null}
        >
          <Text style={[s.skipBtnTxt, { color: theme.textSecondary }]}>
            Продолжить без входа
          </Text>
        </Pressable>
      </Animated.View>

      {/* Footer note */}
      <Animated.View entering={FadeIn.delay(400)} style={s.footer}>
        <Text style={[s.footerTxt, { color: theme.textSecondary }]}>
          King Speech
        </Text>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: 24,
  },
  backRow: {
    marginLeft: -4,
    marginBottom: 8,
  },
  backBtn: {
    padding: 4,
  },
  header: {
    alignItems: "center",
    marginBottom: 40,
    marginTop: 12,
  },
  logoMark: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  logoIcon: {
    fontSize: 36,
  },
  title: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  sub: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 22,
  },
  btns: {
    gap: 12,
    flex: 1,
  },
  authBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  skipBtn: {
    alignSelf: "center",
    paddingVertical: 14,
    paddingHorizontal: 18,
    marginTop: 8,
  },
  skipBtnTxt: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    textDecorationLine: "underline",
  },
  appleBtn: {
    backgroundColor: "#000",
    borderColor: "#000",
  },
  notConfiguredBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 4,
    marginBottom: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 12,
  },
  notConfiguredTxt: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    lineHeight: 18,
  },
  authBtnInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  providerIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#F8F8F8",
    alignItems: "center",
    justifyContent: "center",
  },
  appleIcon: {
    backgroundColor: "#1A1A1A",
  },
  googleG: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: "#4285F4",
  },
  authBtnTxt: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginVertical: 4,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerTxt: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  emailBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  emailBtnTxt: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
  footer: {
    alignItems: "center",
    paddingTop: 16,
  },
  footerTxt: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    letterSpacing: 0.5,
  },
});
