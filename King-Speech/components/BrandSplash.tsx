import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";
import { ThemedSvg } from "@/components/settings/SettingsParts";
import { useTheme } from "@/context/ThemeContext";
import {
  LOGO_CROWN,
  LOGO_H,
  LOGO_KING_XML,
  LOGO_SPEECH_XML,
  LOGO_TEXT_BOX,
} from "@/assets/figma/settings/logoParts";

/**
 * Launch screen shown over the app while it hydrates.
 *
 * The Settings logo is split into crown + "King" + "Speech". The crown lands in
 * the centre of the screen; then the group glides to its final place while the
 * wordmark slides out from under the crown (each line masked at the crown's
 * edge, "Speech" a beat after "King"). Once the app is ready AND the intro has
 * played, the whole layer fades away and calls `onFinish`.
 */

const LOGO_FULL_W = 159; // Figma logo width (viewBox units)
const EASE_OUT = Easing.bezier(0.22, 1, 0.36, 1);

// Timeline (ms)
const CROWN_IN = 480;
const SLIDE_AT = 760; // the wordmark starts emerging
const SLIDE_DUR = 900;
const LINE_STAGGER = 120;
const INTRO_DONE = SLIDE_AT + LINE_STAGGER + SLIDE_DUR;
const HOLD = 220; // pause on the finished logo before leaving
const EXIT_DUR = 380;

export function BrandSplash({ ready, onFinish }: { ready: boolean; onFinish: () => void }) {
  const { theme } = useTheme();
  const { width: screenW } = useWindowDimensions();

  // Geometry (logo units × k)
  const logoW = Math.min(screenW * 0.64, 290);
  const k = logoW / LOGO_FULL_W;
  const h = LOGO_H * k;
  const crownW = LOGO_CROWN.w * k;
  const gap = (LOGO_TEXT_BOX.x - LOGO_CROWN.w) * k;
  const textW = LOGO_TEXT_BOX.w * k;
  // Start with the crown centred on screen; the group then moves to centre the full logo.
  const startShift = logoW / 2 - crownW / 2;

  const crownOpacity = useSharedValue(0);
  const crownScale = useSharedValue(0.72);
  const glow = useSharedValue(0);
  const groupX = useSharedValue(startShift);
  // The wordmark mask starts right at the crown's edge (gap + text), so the
  // lines slide out of the crown rather than out of empty space.
  const maskW = gap + textW;
  const kingX = useSharedValue(-maskW);
  const kingO = useSharedValue(0);
  const speechX = useSharedValue(-maskW);
  const speechO = useSharedValue(0);
  const layerO = useSharedValue(1);
  const exitScale = useSharedValue(1);

  const [introDone, setIntroDone] = useState(false);
  const leaving = useRef(false);

  useEffect(() => {
    const slide = (delay: number) =>
      withDelay(delay, withTiming(0, { duration: SLIDE_DUR, easing: EASE_OUT }));

    crownOpacity.value = withTiming(1, { duration: CROWN_IN, easing: EASE_OUT });
    crownScale.value = withSpring(1, { damping: 13, stiffness: 150, mass: 0.9 });
    glow.value = withSequence(
      withTiming(1, { duration: 650, easing: EASE_OUT }),
      withTiming(0, { duration: 1100, easing: Easing.inOut(Easing.quad) }),
    );

    groupX.value = slide(SLIDE_AT);
    kingX.value = slide(SLIDE_AT);
    kingO.value = withDelay(SLIDE_AT + 60, withTiming(1, { duration: 420 }));
    speechX.value = withDelay(
      SLIDE_AT + LINE_STAGGER,
      withTiming(0, { duration: SLIDE_DUR, easing: EASE_OUT }, (fin) => {
        if (fin) runOnJS(setIntroDone)(true);
      }),
    );
    speechO.value = withDelay(SLIDE_AT + LINE_STAGGER + 60, withTiming(1, { duration: 420 }));

    // Safety net: never keep the user waiting on the animation callback.
    const t = setTimeout(() => setIntroDone(true), INTRO_DONE + 400);
    return () => clearTimeout(t);
    // Runs once on mount; geometry is fixed for the splash's short life.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ready || !introDone || leaving.current) return;
    leaving.current = true;
    exitScale.value = withDelay(HOLD, withTiming(1.05, { duration: EXIT_DUR, easing: Easing.in(Easing.quad) }));
    layerO.value = withDelay(
      HOLD,
      withTiming(0, { duration: EXIT_DUR, easing: Easing.in(Easing.quad) }, (fin) => {
        if (fin) runOnJS(onFinish)();
      }),
    );
  }, [ready, introDone, layerO, exitScale, onFinish]);

  const layerStyle = useAnimatedStyle(() => ({ opacity: layerO.value }));
  const groupStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: groupX.value }, { scale: exitScale.value }],
  }));
  const crownStyle = useAnimatedStyle(() => ({
    opacity: crownOpacity.value,
    transform: [{ scale: crownScale.value }],
  }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: glow.value,
    transform: [{ scale: 0.7 + glow.value * 0.3 }],
  }));
  const kingStyle = useAnimatedStyle(() => ({
    opacity: kingO.value,
    transform: [{ translateX: kingX.value }],
  }));
  const speechStyle = useAnimatedStyle(() => ({
    opacity: speechO.value,
    transform: [{ translateX: speechX.value }],
  }));

  const glowSize = crownW * 3.2;

  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: theme.bg }, layerStyle]}
    >
      <Animated.View style={[{ width: logoW, height: h, flexDirection: "row" }, groupStyle]}>
        {/* Crown with a soft warm light behind it */}
        <View style={{ width: crownW, height: h }}>
          <Animated.View
            style={[
              {
                position: "absolute",
                width: glowSize,
                height: glowSize,
                left: crownW / 2 - glowSize / 2,
                top: h / 2 - glowSize / 2,
              },
              glowStyle,
            ]}
          >
            <Svg width={glowSize} height={glowSize}>
              <Defs>
                <RadialGradient id="ksGlow" cx="50%" cy="50%" r="50%">
                  <Stop offset="0" stopColor={theme.accent} stopOpacity={0.22} />
                  <Stop offset="0.3" stopColor={theme.accent} stopOpacity={0.1} />
                  <Stop offset="0.6" stopColor={theme.accent} stopOpacity={0.03} />
                  <Stop offset="1" stopColor={theme.accent} stopOpacity={0} />
                </RadialGradient>
              </Defs>
              <Circle cx={glowSize / 2} cy={glowSize / 2} r={glowSize / 2} fill="url(#ksGlow)" />
            </Svg>
          </Animated.View>
          <Animated.View style={crownStyle}>
            <ThemedSvg xml={LOGO_CROWN.xml} width={crownW} height={h} fg={theme.text} />
          </Animated.View>
        </View>

        {/* Wordmark: masked at the crown's edge so it slides out from under it */}
        <View style={{ width: maskW, height: h, overflow: "hidden" }}>
          <Animated.View style={[styles.line, { left: gap, width: textW, height: h }, kingStyle]}>
            <ThemedSvg xml={LOGO_KING_XML} width={textW} height={h} fg={theme.text} />
          </Animated.View>
          <Animated.View style={[styles.line, { left: gap, width: textW, height: h }, speechStyle]}>
            <ThemedSvg xml={LOGO_SPEECH_XML} width={textW} height={h} fg={theme.text} />
          </Animated.View>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center", zIndex: 1000, elevation: 1000 },
  line: { position: "absolute", top: 0 },
});
