import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { ThemedSvg } from "@/components/settings/SettingsParts";
import { useTheme } from "@/context/ThemeContext";
import { rs } from "@/lib/responsive";
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
const CROWN_IN = 650;
const SLIDE_AT = 1050; // the wordmark starts emerging
const SLIDE_DUR = 1250;
const LINE_STAGGER = 170;
const INTRO_DONE = SLIDE_AT + LINE_STAGGER + SLIDE_DUR;
const HOLD = 300; // pause on the finished logo before leaving
const EXIT_DUR = 480;

export function BrandSplash({ ready, onFinish }: { ready: boolean; onFinish: () => void }) {
  const { theme } = useTheme();
  const { width: screenW } = useWindowDimensions();

  // Geometry (logo units × k)
  const logoW = Math.min(screenW * 0.64, rs(290));
  const k = logoW / LOGO_FULL_W;
  const h = LOGO_H * k;
  const crownW = LOGO_CROWN.w * k;
  const gap = (LOGO_TEXT_BOX.x - LOGO_CROWN.w) * k;
  const textW = LOGO_TEXT_BOX.w * k;
  // Start with the crown centred on screen; the group then moves to centre the full logo.
  const startShift = logoW / 2 - crownW / 2;

  const crownOpacity = useSharedValue(0);
  const crownScale = useSharedValue(0.72);
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
    crownScale.value = withSpring(1, { damping: 15, stiffness: 105, mass: 1 });

    groupX.value = slide(SLIDE_AT);
    kingX.value = slide(SLIDE_AT);
    kingO.value = withDelay(SLIDE_AT + 80, withTiming(1, { duration: 580 }));
    speechX.value = withDelay(
      SLIDE_AT + LINE_STAGGER,
      withTiming(0, { duration: SLIDE_DUR, easing: EASE_OUT }, (fin) => {
        if (fin) runOnJS(setIntroDone)(true);
      }),
    );
    speechO.value = withDelay(SLIDE_AT + LINE_STAGGER + 80, withTiming(1, { duration: 580 }));

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
  const kingStyle = useAnimatedStyle(() => ({
    opacity: kingO.value,
    transform: [{ translateX: kingX.value }],
  }));
  const speechStyle = useAnimatedStyle(() => ({
    opacity: speechO.value,
    transform: [{ translateX: speechX.value }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: theme.bg }, layerStyle]}
    >
      <Animated.View style={[{ width: logoW, height: h, flexDirection: "row" }, groupStyle]}>
        {/* Crown */}
        <View style={{ width: crownW, height: h }}>
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
