// Oscar on a Get Ready tip card — either a Rive emotion (OscarMascot) or one
// of the vectorized poses (constants/oscarPoses). Two poses move:
//   · heart — our own vector heart hovers above his open palm
//   · lotus — he levitates; the floor shadow shrinks as he rises
import React, { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import Svg, { Defs, Ellipse, Path, RadialGradient, Stop, SvgXml } from "react-native-svg";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import OscarMascot from "@/components/OscarMascot";
import { OSCAR_POSES } from "@/constants/oscarPoses";
import type { TipMascot as TipMascotSpec } from "@/constants/cheatsheetData";
import { rs } from "@/lib/responsive";

const INK = "#5A231F";
const HEART_RED = "#E04A4A";
// Where the illustrator's heart sat in the heart pose's viewBox (source px).
const HEART_BOX = { x: 1366, y: 495, w: 311, h: 282 };

const MAX_W = rs(156);
const MAX_H = rs(156);

/** A looping 0→1→0 value (sine-eased). */
function useFloat(periodMs: number) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withRepeat(withTiming(1, { duration: periodMs / 2, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => cancelAnimation(v);
  }, [periodMs, v]);
  return v;
}

function Heart({ size }: { size: number }) {
  // Hand-built heart in the mascot's ink style: red fill, ink outline, glint.
  return (
    <Svg width={size} height={size * 0.92} viewBox="-6 -6 112 104">
      <Path
        d="M50 90 C 24 70 3 54 3 31 C 3 15 15 3 30 3 C 39 3 46 8 50 16 C 54 8 61 3 70 3 C 85 3 97 15 97 31 C 97 54 76 70 50 90 Z"
        fill={HEART_RED}
        stroke={INK}
        strokeWidth={4.6}
        strokeLinejoin="round"
      />
      <Ellipse cx={77} cy={21} rx={6.5} ry={4.2} fill="#FFFFFF" opacity={0.9} transform="rotate(38 77 21)" />
      <Ellipse cx={86} cy={31} rx={2.4} ry={2.4} fill="#FFFFFF" opacity={0.85} />
    </Svg>
  );
}

function Pose({ pose }: { pose: keyof typeof OSCAR_POSES }) {
  const { box, xml } = OSCAR_POSES[pose];
  const [bx, by, bw, bh] = box;
  const scale = Math.min(MAX_W / bw, MAX_H / bh);
  const w = Math.round(bw * scale);
  const h = Math.round(bh * scale);

  const float = useFloat(pose === "lotus" ? 2600 : 1800);
  const lift = pose === "lotus" ? rs(9) : 0;
  const bodyStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -float.value * lift }] }));
  const shadowStyle = useAnimatedStyle(() => ({
    opacity: 0.75 - float.value * 0.3,
    transform: [{ scaleX: 1 - float.value * 0.18 }],
  }));
  const heartW = HEART_BOX.w * scale;
  const heartStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -float.value * heartW * 0.14 }, { rotate: `${(float.value - 0.5) * 6}deg` }],
  }));

  return (
    <View style={{ width: w, height: h + (pose === "lotus" ? rs(18) : 0), alignItems: "center" }}>
      {pose === "lotus" && (
        // soft floor shadow: a radial-gradient ellipse, no hard edge
        <Animated.View style={[styles.shadow, { width: w * 0.62, height: rs(16), bottom: 0 }, shadowStyle]}>
          <Svg width="100%" height="100%" viewBox="0 0 100 20" preserveAspectRatio="none">
            <Defs>
              <RadialGradient id="tipLotusShadow" cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor={INK} stopOpacity={0.55} />
                <Stop offset="0.6" stopColor={INK} stopOpacity={0.22} />
                <Stop offset="1" stopColor={INK} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Ellipse cx={50} cy={10} rx={50} ry={10} fill="url(#tipLotusShadow)" />
          </Svg>
        </Animated.View>
      )}
      <Animated.View style={[{ width: w, height: h }, bodyStyle]}>
        <SvgXml xml={xml} width={w} height={h} />
        {pose === "heart" && (
          <Animated.View
            style={[
              styles.abs,
              { left: (HEART_BOX.x - bx) * scale, top: (HEART_BOX.y - by) * scale, width: heartW },
              heartStyle,
            ]}
          >
            <Heart size={heartW} />
          </Animated.View>
        )}
      </Animated.View>
    </View>
  );
}

export default function TipMascot({ mascot }: { mascot?: TipMascotSpec }) {
  if (!mascot) return null;
  if ("rive" in mascot) return <OscarMascot emotion={mascot.rive} size={rs(150)} />;
  return <Pose pose={mascot.pose} />;
}

const styles = StyleSheet.create({
  abs: { position: "absolute" },
  shadow: { position: "absolute" },
});
