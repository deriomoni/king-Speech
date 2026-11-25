import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, useWindowDimensions } from "react-native";
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { useTheme } from "@/context/ThemeContext";
import { rs } from "@/lib/responsive";
import { AnimatedBrandLogo, LOGO_INTRO_MS } from "@/components/AnimatedBrandLogo";

/**
 * Launch screen shown over the app while it hydrates: the logo intro
 * (AnimatedBrandLogo — crown lands, wordmark slides out from under it). Once
 * the app is ready AND the intro has played, the whole layer fades away and
 * calls `onFinish`.
 */

const HOLD = 300; // pause on the finished logo before leaving
const EXIT_DUR = 480;

export function BrandSplash({ ready, onFinish }: { ready: boolean; onFinish: () => void }) {
  const { theme } = useTheme();
  const { width: screenW } = useWindowDimensions();
  const logoW = Math.min(screenW * 0.64, rs(290));

  const layerO = useSharedValue(1);
  const exitScale = useSharedValue(1);
  const [introDone, setIntroDone] = useState(false);
  const leaving = useRef(false);

  // Safety net: never keep the user waiting on the animation callback.
  useEffect(() => {
    const t = setTimeout(() => setIntroDone(true), LOGO_INTRO_MS + 400);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!ready || !introDone || leaving.current) return;
    leaving.current = true;
    layerO.value = withDelay(
      HOLD,
      withTiming(0, { duration: EXIT_DUR, easing: Easing.in(Easing.quad) }, (fin) => {
        if (fin) runOnJS(onFinish)();
      }),
    );
  }, [ready, introDone, layerO, exitScale, onFinish]);

  const layerStyle = useAnimatedStyle(() => ({ opacity: layerO.value }));
  const scaleStyle = useAnimatedStyle(() => ({ transform: [{ scale: exitScale.value }] }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: theme.bg }, layerStyle]}
    >
      <Animated.View style={scaleStyle}>
        <AnimatedBrandLogo width={logoW} color={theme.text} onDone={() => setIntroDone(true)} />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center", zIndex: 1000, elevation: 1000 },
});
