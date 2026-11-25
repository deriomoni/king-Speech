import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
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
import {
  LOGO_CROWN,
  LOGO_H,
  LOGO_KING_XML,
  LOGO_SPEECH_XML,
  LOGO_TEXT_BOX,
} from "@/assets/figma/settings/logoParts";

/**
 * The King Speech logo intro (the launch splash's animation): the crown lands
 * where the centre of the logo will be, then the group glides into place while
 * the wordmark slides out from under the crown — «King», then «Speech» a beat
 * later. Used by the splash and by the sign-in screen, so both match 1:1.
 */

export const LOGO_FULL_W = 159; // Figma logo width (viewBox units)
const EASE_OUT = Easing.bezier(0.22, 1, 0.36, 1);

// Timeline (ms, from `delay`)
const CROWN_IN = 650;
const SLIDE_AT = 1050; // the wordmark starts emerging
const SLIDE_DUR = 1250;
const LINE_STAGGER = 170;
export const LOGO_INTRO_MS = SLIDE_AT + LINE_STAGGER + SLIDE_DUR;

export function AnimatedBrandLogo({
  width,
  color,
  delay = 0,
  onDone,
  instant = false,
}: {
  width: number;
  color: string;
  delay?: number;
  onDone?: () => void;
  /** already in place — no intro (e.g. the logo carried over from Welcome) */
  instant?: boolean;
}) {
  const k = width / LOGO_FULL_W;
  const h = LOGO_H * k;
  const crownW = LOGO_CROWN.w * k;
  const gap = (LOGO_TEXT_BOX.x - LOGO_CROWN.w) * k;
  const textW = LOGO_TEXT_BOX.w * k;
  // the crown starts centred; the group then moves to centre the full logo
  const startShift = width / 2 - crownW / 2;
  // the wordmark mask starts right at the crown's edge, so the lines slide out
  // of the crown rather than out of empty space
  const maskW = gap + textW;

  const crownOpacity = useSharedValue(instant ? 1 : 0);
  const crownScale = useSharedValue(instant ? 1 : 0.72);
  const groupX = useSharedValue(instant ? 0 : startShift);
  const kingX = useSharedValue(instant ? 0 : -maskW);
  const kingO = useSharedValue(instant ? 1 : 0);
  const speechX = useSharedValue(instant ? 0 : -maskW);
  const speechO = useSharedValue(instant ? 1 : 0);

  useEffect(() => {
    if (instant) return;
    const slide = (at: number) => withDelay(delay + at, withTiming(0, { duration: SLIDE_DUR, easing: EASE_OUT }));
    crownOpacity.value = withDelay(delay, withTiming(1, { duration: CROWN_IN, easing: EASE_OUT }));
    crownScale.value = withDelay(delay, withSpring(1, { damping: 15, stiffness: 105, mass: 1 }));
    groupX.value = slide(SLIDE_AT);
    kingX.value = slide(SLIDE_AT);
    kingO.value = withDelay(delay + SLIDE_AT + 80, withTiming(1, { duration: 580 }));
    speechX.value = withDelay(
      delay + SLIDE_AT + LINE_STAGGER,
      withTiming(0, { duration: SLIDE_DUR, easing: EASE_OUT }, (fin) => {
        if (fin && onDone) runOnJS(onDone)();
      }),
    );
    speechO.value = withDelay(delay + SLIDE_AT + LINE_STAGGER + 80, withTiming(1, { duration: 580 }));
    // runs once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const groupStyle = useAnimatedStyle(() => ({ transform: [{ translateX: groupX.value }] }));
  const crownStyle = useAnimatedStyle(() => ({ opacity: crownOpacity.value, transform: [{ scale: crownScale.value }] }));
  const kingStyle = useAnimatedStyle(() => ({ opacity: kingO.value, transform: [{ translateX: kingX.value }] }));
  const speechStyle = useAnimatedStyle(() => ({ opacity: speechO.value, transform: [{ translateX: speechX.value }] }));

  return (
    <Animated.View style={[{ width, height: h, flexDirection: "row" }, groupStyle]}>
      <View style={{ width: crownW, height: h }}>
        <Animated.View style={crownStyle}>
          <ThemedSvg xml={LOGO_CROWN.xml} width={crownW} height={h} fg={color} />
        </Animated.View>
      </View>
      <View style={{ width: maskW, height: h, overflow: "hidden" }}>
        <Animated.View style={[styles.line, { left: gap, width: textW, height: h }, kingStyle]}>
          <ThemedSvg xml={LOGO_KING_XML} width={textW} height={h} fg={color} />
        </Animated.View>
        <Animated.View style={[styles.line, { left: gap, width: textW, height: h }, speechStyle]}>
          <ThemedSvg xml={LOGO_SPEECH_XML} width={textW} height={h} fg={color} />
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  line: { position: "absolute", top: 0 },
});
