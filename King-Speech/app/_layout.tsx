import AppAlertHost from "@/components/AppAlertHost";
// Type families (per the Figma design system):
//  · Geologica = every UI string (titles, body, labels, buttons)
//  · Literata  = reading / in-level literary content
import {
  useFonts,
  Geologica_300Light,
  Geologica_400Regular,
  Geologica_500Medium,
  Geologica_600SemiBold,
  Geologica_700Bold,
  Geologica_800ExtraBold,
  Geologica_900Black,
} from "@expo-google-fonts/geologica";
import { Literata_400Regular } from "@expo-google-fonts/literata";
import { QueryClientProvider } from "@tanstack/react-query";
import {
  Stack,
  useRouter,
  useSegments,
  useNavigationContainerRef,
  ThemeProvider as NavThemeProvider,
  DarkTheme as NavDarkTheme,
  DefaultTheme as NavDefaultTheme,
} from "expo-router";
import * as SystemUI from "expo-system-ui";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useMemo, useState } from "react";
import { View, BackHandler } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import Animated, {
  ReducedMotionConfig,
  ReduceMotion,
  FadeIn,
} from "react-native-reanimated";
import { BrandSplash } from "@/components/BrandSplash";
import { playUi, preloadUiSounds } from "@/lib/uiSound";
import { markSplashDone } from "@/lib/splashState";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { queryClient } from "@/lib/query-client";
import { GameProvider, useGame } from "@/context/GameContext";
import { ThemeProvider, useTheme } from "@/context/ThemeContext";
import { LangProvider, useLang } from "@/context/LangContext";
import { DevToolsProvider, useDevTools } from "@/context/DevToolsContext";
import { SettingsProvider } from "@/context/SettingsContext";
import { ModuleTransitionProvider } from "@/context/ModuleTransitionContext";
import { AuthProvider, useAuth } from "@/context/AuthContext";

SplashScreen.preventAutoHideAsync();

/** Android's back button / back-swipe must not pull the player out of a level
 *  either: outside the main tabs it does nothing — leaving is done with the
 *  screen's own buttons. (Screens with their own back handling still get it
 *  first: their listeners are added later and run before this one.) */
function useBlockHardwareBack() {
  const segments = useSegments();
  const inTabs = segments[0] === "(tabs)" || segments[0] === "(auth)" || (segments as string[]).length === 0;
  useEffect(() => {
    if (inTabs) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => true);
    return () => sub.remove();
  }, [inTabs]);
}

/** Levels and other full-screen exercises enter AND leave with a soft cross-fade
 *  (owner: no abrupt slides when leaving a level for any other screen). */
const SOFT_FADE = { animation: "fade" as const, animationDuration: 380 };
const FULL_MODAL = "fullScreenModal" as const;

function RootLayoutNav() {
  const { themeMode, theme } = useTheme();
  useBlockHardwareBack();
  // Everything behind the screens (navigation cards, the native root view /
  // window) is the theme background — fast horizontal swipes, the iOS
  // back-swipe and overscroll never reveal a white edge.
  const bg = theme.bg;
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(bg).catch(() => {});
  }, [bg]);
  const navTheme = useMemo(() => {
    const base = themeMode === "dark" ? NavDarkTheme : NavDefaultTheme;
    return { ...base, colors: { ...base.colors, background: bg, card: bg } };
  }, [themeMode, bg]);
  return (
    <NavThemeProvider value={navTheme}>
      <StatusBar style={themeMode === "dark" ? "light" : "dark"} animated />
      {/* No swipe-back anywhere: a stray horizontal swipe (e.g. spinning the
          victory trophy) must never drop the player out of a level — screens
          are left only through their own buttons. */}
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: bg }, gestureEnabled: false, fullScreenGestureEnabled: false }}>
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="level/[id]" options={{ headerShown: false, ...SOFT_FADE }} />
      <Stack.Screen
        name="vocabulary-level"
        options={{ headerShown: false, presentation: FULL_MODAL, ...SOFT_FADE }}
      />
      <Stack.Screen
        name="showtime-stage"
        options={{ headerShown: false, presentation: FULL_MODAL, ...SOFT_FADE }}
      />
      <Stack.Screen
        name="showtime-playback"
        options={{ headerShown: false, presentation: FULL_MODAL, ...SOFT_FADE }}
      />
      <Stack.Screen
        name="portal-interview"
        options={{ headerShown: false, presentation: FULL_MODAL, ...SOFT_FADE }}
      />
      <Stack.Screen
        name="rank-up"
        options={{ headerShown: false, presentation: FULL_MODAL, gestureEnabled: false, ...SOFT_FADE }}
      />
      <Stack.Screen
        name="worlds"
        options={{ headerShown: false, presentation: FULL_MODAL }}
      />
      <Stack.Screen
        name="world/[id]"
        options={{ headerShown: false, presentation: "card" }}
      />
      <Stack.Screen
        name="reading-library"
        options={{ headerShown: false, presentation: "card" }}
      />
      <Stack.Screen
        name="manners"
        options={{ headerShown: false, presentation: "card" }}
      />
      <Stack.Screen
        name="diary-record"
        options={{ headerShown: false, presentation: FULL_MODAL, gestureEnabled: false, ...SOFT_FADE }}
      />
      </Stack>
      <AppAlertHost />
    </NavThemeProvider>
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

  // Hide the native splash as soon as the theme is known so the animated
  // BrandSplash (crown + wordmark, needs no fonts) takes over on the right
  // background. It stays on top until *all* providers are hydrated and its
  // intro has played, then fades out over the already-mounted app.
  const canShowLoadingScreen = themeCtx.isLoaded;
  const [splashGone, setSplashGone] = useState(false);
  useEffect(() => {
    if (canShowLoadingScreen) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [canShowLoadingScreen]);

  // Root auth gate. Once everything has hydrated, push the user into the
  // correct stack based on their auth/onboarding state:
  //   no user                       -> /(auth)/welcome
  //   profile incomplete            -> /(auth)/profile-setup
  //   otherwise                     -> /(tabs) (the first time with the
  //                                    guided tour on top — see AppTour)
  // Without this, a brand-new install would land straight in /(tabs) and
  // never see the real Google/Apple sign-in flow.
  const router = useRouter();
  const segments = useSegments();

  // UI sounds: warm them up, and play «back» whenever a screen is popped off
  // the root stack — by a button, a swipe or the hardware back key.
  const navRef = useNavigationContainerRef();
  useEffect(() => {
    preloadUiSounds();
  }, []);
  useEffect(() => {
    if (!ready) return;
    let depth = -1;
    const unsub = navRef.addListener("state", (e: any) => {
      const n = e?.data?.state?.routes?.length ?? 0;
      if (depth > 0 && n > 0 && n < depth) playUi("back");
      depth = n;
    });
    return unsub;
  }, [ready, navRef]);
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
      // name + age, then the short questionnaire, complete the profile
      // (welcome / sign-in / email are dropped from the stack first, so they
      // can't be swiped back to and don't linger mounted underneath)
      if (sub !== "profile-setup" && sub !== "survey") {
        try {
          if (router.canDismiss()) router.dismissAll();
        } catch {}
        router.replace("/(auth)/profile-setup");
      }
      return;
    }
    if (inAuth) router.replace("/(tabs)");
  }, [ready, auth.user, segments, router]);

  return (
    <View style={{ flex: 1, backgroundColor: themeCtx.theme.bg }}>
      {ready ? (
        <Animated.View entering={FadeIn.duration(220)} style={{ flex: 1 }}>
          {children}
        </Animated.View>
      ) : null}
      {canShowLoadingScreen && !splashGone ? (
        <BrandSplash
          ready={ready}
          onFinish={() => {
            setSplashGone(true);
            markSplashDone();
          }}
        />
      ) : null}
    </View>
  );
}

/** Gesture root painted with the theme background (no white behind screens). */
function ThemedRoot({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: theme.bg }}>
      {children}
    </GestureHandlerRootView>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Geologica_300Light,
    Geologica_400Regular,
    Geologica_500Medium,
    Geologica_600SemiBold,
    Geologica_700Bold,
    Geologica_800ExtraBold,
    Geologica_900Black,
    Literata_400Regular,
  });

  const fontsReady = fontsLoaded || !!fontError;

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <LangProvider>
            <AuthProvider>
              <ThemedRoot>
                <ReducedMotionConfig mode={ReduceMotion.Never} />
                <KeyboardProvider>
                  <DevToolsProvider>
                  <SettingsProvider>
                    <GameProvider>
                      <ModuleTransitionProvider>
                        <ReadinessGate fontsReady={fontsReady}>
                          <RootLayoutNav />
                        </ReadinessGate>
                      </ModuleTransitionProvider>
                    </GameProvider>
                  </SettingsProvider>
                  </DevToolsProvider>
                </KeyboardProvider>
              </ThemedRoot>
            </AuthProvider>
          </LangProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

