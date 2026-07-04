import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import {
  Nunito_400Regular,
  Nunito_700Bold,
  Nunito_800ExtraBold,
} from "@expo-google-fonts/nunito";
import { Literata_400Regular } from "@expo-google-fonts/literata";
import {
  Caveat_400Regular,
  Caveat_700Bold,
} from "@expo-google-fonts/caveat";
import {
  Fredoka_500Medium,
  Fredoka_700Bold,
} from "@expo-google-fonts/fredoka";
import {
  SpaceMono_400Regular,
  SpaceMono_700Bold,
} from "@expo-google-fonts/space-mono";
import {
  PlayfairDisplay_400Regular,
  PlayfairDisplay_700Bold,
} from "@expo-google-fonts/playfair-display";
import {
  CormorantGaramond_400Regular,
  CormorantGaramond_700Bold,
} from "@expo-google-fonts/cormorant-garamond";
import { YesevaOne_400Regular } from "@expo-google-fonts/yeseva-one";
import {
  PTSerif_400Regular,
  PTSerif_700Bold,
} from "@expo-google-fonts/pt-serif";
import {
  Rubik_400Regular,
  Rubik_500Medium,
  Rubik_600SemiBold,
  Rubik_700Bold,
} from "@expo-google-fonts/rubik";
import { QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, StyleSheet, Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import Animated, {
  ReducedMotionConfig,
  ReduceMotion,
  FadeIn,
  FadeOut,
} from "react-native-reanimated";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { queryClient } from "@/lib/query-client";
import { GameProvider, useGame } from "@/context/GameContext";
import { ThemeProvider, useTheme } from "@/context/ThemeContext";
import { LangProvider, useLang } from "@/context/LangContext";
import { DevToolsProvider, useDevTools } from "@/context/DevToolsContext";
import { ModuleTransitionProvider } from "@/context/ModuleTransitionContext";
import { AuthProvider, useAuth } from "@/context/AuthContext";

SplashScreen.preventAutoHideAsync();

// #region agent log
function logAppBoot() {
  const data = {
    platform: Platform.OS,
    host: typeof window !== "undefined" ? window.location?.host : null,
    href: typeof window !== "undefined" ? window.location?.href : null,
  };
  fetch("http://127.0.0.1:7856/ingest/98a765d6-b717-4812-83af-50c7a780524a", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "94a5ad" },
    body: JSON.stringify({
      sessionId: "94a5ad",
      hypothesisId: "H2",
      location: "app/_layout.tsx:boot",
      message: "app_boot",
      data,
      timestamp: Date.now(),
    }),
  }).catch(() => {});
}
// #endregion

function RootLayoutNav() {
  const { themeMode } = useTheme();
  return (
    <>
      <StatusBar style={themeMode === "dark" ? "light" : "dark"} animated />
      <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="level/[id]" options={{ headerShown: false }} />
      <Stack.Screen
        name="vocabulary-level"
        options={{ headerShown: false, presentation: "fullScreenModal" }}
      />
      <Stack.Screen
        name="showtime-stage"
        options={{ headerShown: false, presentation: "fullScreenModal" }}
      />
      <Stack.Screen
        name="showtime-playback"
        options={{ headerShown: false, presentation: "fullScreenModal" }}
      />
      <Stack.Screen
        name="portal-interview"
        options={{ headerShown: false, presentation: "fullScreenModal" }}
      />
      <Stack.Screen
        name="rank-up"
        options={{ headerShown: false, presentation: "fullScreenModal", gestureEnabled: false }}
      />
      <Stack.Screen
        name="worlds"
        options={{ headerShown: false, presentation: "fullScreenModal" }}
      />
      <Stack.Screen
        name="world/[id]"
        options={{ headerShown: false, presentation: "card" }}
      />
      <Stack.Screen
        name="reading-library"
        options={{ headerShown: false, presentation: "card" }}
      />
      </Stack>
    </>
  );
}

function LoadingScreen() {
  const { theme } = useTheme();
  const { t } = useLang();
  return (
    <Animated.View
      exiting={FadeOut.duration(220)}
      style={[loadingStyles.container, { backgroundColor: theme.bg }]}
    >
      <View style={loadingStyles.center}>
        <View
          style={[
            loadingStyles.crown,
            {
              backgroundColor: "transparent",
              borderWidth: 1,
              borderColor: "rgba(148,104,251,0.5)",
              shadowColor: "#9468FB",
              shadowOpacity: 0.6,
              shadowRadius: 30,
              shadowOffset: { width: 0, height: 0 },
            },
          ]}
        >
          <Text style={[loadingStyles.crownText, { color: "#9468FB" }]}>K</Text>
        </View>
        <Text
          style={[
            loadingStyles.title,
            { color: theme.text, fontFamily: "Rubik_700Bold" },
          ]}
        >
          King Speech
        </Text>
        <Text
          style={[
            loadingStyles.tagline,
            { color: theme.textSecondary, fontFamily: "Nunito_400Regular" },
          ]}
        >
          {t("brandTagline")}
        </Text>
        <ActivityIndicator
          size="small"
          color={theme.accent}
          style={loadingStyles.spinner}
        />
      </View>
    </Animated.View>
  );
}

function ReadinessGate({
  fontsReady,
  children,
}: {
  fontsReady: boolean;
  children: React.ReactNode;
}) {
  const game = useGame();
  const langCtx = useLang();
  const themeCtx = useTheme();
  const devTools = useDevTools();
  const auth = useAuth();

  const ready =
    fontsReady &&
    game.isLoaded &&
    langCtx.isLoaded &&
    themeCtx.isLoaded &&
    devTools.isLoaded &&
    auth.isLoaded;

  // Hide the native splash as soon as fonts/theme are ready so the in-app
  // LoadingScreen (with logo + tagline + spinner) becomes visible. Keep the
  // gate up until *all* providers are hydrated.
  const canShowLoadingScreen = fontsReady && themeCtx.isLoaded && langCtx.isLoaded;
  useEffect(() => {
    if (canShowLoadingScreen) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [canShowLoadingScreen]);

  // Root auth gate. Once everything has hydrated, push the user into the
  // correct stack based on their auth/onboarding state:
  //   no user                       -> /(auth)/welcome
  //   profile incomplete            -> /(auth)/profile-setup
  //   onboarding incomplete         -> /(auth)/onboarding
  //   fully ready                   -> /(tabs)
  // Without this, a brand-new install would land straight in /(tabs) and
  // never see the real Google/Apple sign-in flow.
  const router = useRouter();
  const segments = useSegments();
  useEffect(() => {
    if (!ready) return;
    const u = auth.user;
    const root = segments[0] as string | undefined;
    const sub = segments[1] as string | undefined;
    const inAuth = root === "(auth)";
    if (!u) {
      if (!inAuth) router.replace("/(auth)/welcome");
      return;
    }
    if (!u.profileCompleted) {
      if (sub !== "profile-setup") router.replace("/(auth)/profile-setup");
      return;
    }
    if (!u.onboardingCompleted) {
      if (sub !== "onboarding") router.replace("/(auth)/onboarding");
      return;
    }
    if (inAuth) router.replace("/(tabs)");
  }, [ready, auth.user, segments, router]);

  if (!ready) return <LoadingScreen />;
  return (
    <Animated.View entering={FadeIn.duration(220)} style={{ flex: 1 }}>
      {children}
    </Animated.View>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Nunito_400Regular,
    Nunito_700Bold,
    Nunito_800ExtraBold,
    Literata_400Regular,
    Caveat_400Regular,
    Caveat_700Bold,
    Fredoka_500Medium,
    Fredoka_700Bold,
    SpaceMono_400Regular,
    SpaceMono_700Bold,
    PlayfairDisplay_400Regular,
    PlayfairDisplay_700Bold,
    CormorantGaramond_400Regular,
    CormorantGaramond_700Bold,
    YesevaOne_400Regular,
    PTSerif_400Regular,
    PTSerif_700Bold,
    Rubik_400Regular,
    Rubik_500Medium,
    Rubik_600SemiBold,
    Rubik_700Bold,
  });

  const fontsReady = fontsLoaded || !!fontError;

  useEffect(() => {
    logAppBoot();
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <LangProvider>
            <AuthProvider>
              <GestureHandlerRootView style={{ flex: 1 }}>
                <ReducedMotionConfig mode={ReduceMotion.Never} />
                <KeyboardProvider>
                  <DevToolsProvider>
                    <GameProvider>
                      <ModuleTransitionProvider>
                        <ReadinessGate fontsReady={fontsReady}>
                          <RootLayoutNav />
                        </ReadinessGate>
                      </ModuleTransitionProvider>
                    </GameProvider>
                  </DevToolsProvider>
                </KeyboardProvider>
              </GestureHandlerRootView>
            </AuthProvider>
          </LangProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

const loadingStyles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center" },
  center: { alignItems: "center", gap: 16 },
  crown: {
    width: 72,
    height: 72,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  crownText: { fontSize: 36, fontWeight: "800" },
  title: { fontSize: 28, letterSpacing: -0.4 },
  tagline: {
    fontSize: 13,
    letterSpacing: 0.2,
    textAlign: "center",
    paddingHorizontal: 32,
  },
  spinner: { marginTop: 8 },
});
