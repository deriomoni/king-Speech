// Diary cassette — Figma "Cassette · …" (409:1437 etc.), "Cassette · recording"
// (06b) and "Cassette · new" (06c). Geometry is authored in the 163×104 body
// space of the mini cassette (play key sticks out to x 171) and scaled.
//   body: vertical gradient cassette/body-hi → body-lo, 1.5 outline label-stroke
//   label: cream #F6F3EA with a handwritten (Caveat) title
//   window: dark pill with two white "eye" reels + black pupils (60%)
//   mouth: the saved emotion; while playing → small white animated waveform
//   recording: no pupils/mouth, each eye shows a rotating 3/4 loading arc
//   foot: trapezoid in cassette/detail; play key on the right (pressed + yellow
//   while playing)
import React, { useEffect, useId } from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Defs, LinearGradient, Stop, Rect, Circle, Ellipse, Path } from "react-native-svg";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { useFonts, Caveat_400Regular } from "@expo-google-fonts/caveat";
import { useTheme } from "@/context/ThemeContext";
import type { DiaryEmotion } from "@/lib/diaryStorage";
import { CASSETTE_LIDS, CASSETTE_MOUTH } from "./emotions";

export const HANDWRITING = "Caveat_400Regular";

/** Load the handwritten label font (Caveat) — call once per diary screen. */
export function useDiaryFonts() {
  const [loaded, error] = useFonts({ Caveat_400Regular });
  return loaded || !!error;
}

const BODY_W = 163;
const BODY_H = 104;
const MOUTH = "#8E8E95";
const LABEL_INK = "#2B2A33";
const EYES = [42, 121]; // eye centres (x); y = 67
const EYE_Y = 67;

type Props = {
  width: number;
  title?: string;
  emotion?: DiaryEmotion;
  state?: "idle" | "playing" | "recording";
  /** Mini cassettes in the list have a side play key; the big ones don't. */
  showKey?: boolean;
  /** Replaces the label text (e.g. a TextInput on the sign step). */
  labelSlot?: React.ReactNode;
};

export default function Cassette({
  width,
  title,
  emotion = "neutral",
  state = "idle",
  showKey = false,
  labelSlot,
}: Props) {
  const { theme: c } = useTheme();
  const rawId = useId();
  const id = rawId.replace(/[^a-zA-Z0-9_-]/g, "");
  const vbW = showKey ? 174 : BODY_W + 2;
  const vbH = BODY_H + 2;
  const k = width / vbW;
  const height = vbH * k;
  // viewBox starts at -1,-1 so the 1.5 outline isn't clipped.
  const px = (v: number) => (v + 1) * k;

  const playing = state === "playing";
  const recording = state === "recording";
  const mouth = CASSETTE_MOUTH[emotion];
  const lids = recording ? undefined : CASSETTE_LIDS[emotion];

  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height} viewBox={`-1 -1 ${vbW} ${vbH}`}>
        <Defs>
          <LinearGradient id={`body${id}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={c.cassetteBodyHi} />
            <Stop offset="1" stopColor={c.cassetteBodyLo} />
          </LinearGradient>
          <LinearGradient id={`shine${id}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.35} />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
          </LinearGradient>
          <LinearGradient id={`shade${id}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#000000" stopOpacity={0} />
            <Stop offset="1" stopColor="#000000" stopOpacity={0.18} />
          </LinearGradient>
          <LinearGradient id={`key${id}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFE45C" />
            <Stop offset="1" stopColor="#FFC414" />
          </LinearGradient>
          <LinearGradient id={`label${id}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#000000" stopOpacity={0} />
            <Stop offset="1" stopColor="#000000" stopOpacity={0.06} />
          </LinearGradient>
          <LinearGradient id={`win${id}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#000000" stopOpacity={0.25} />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0.06} />
          </LinearGradient>
        </Defs>

        {/* Play key sits behind the body; pressed = pushed in + yellow. */}
        {showKey && (
          <>
            <Rect
              x={playing ? 152 : 157}
              y={33}
              width={14}
              height={30}
              rx={5}
              fill={playing ? `url(#key${id})` : c.cassetteDetail}
              stroke={c.cassetteLabelStroke}
              strokeWidth={1.5}
            />
            <Rect x={playing ? 152 : 157} y={33} width={14} height={30} rx={5} fill={`url(#shine${id})`} />
            <Rect x={playing ? 152 : 157} y={33} width={14} height={30} rx={5} fill={`url(#shade${id})`} />
          </>
        )}

        <Rect
          x={0}
          y={0}
          width={BODY_W}
          height={BODY_H}
          rx={14}
          fill={`url(#body${id})`}
          stroke={c.cassetteLabelStroke}
          strokeWidth={1.5}
        />
        <Rect x={10} y={9} width={143} height={34} rx={7} fill="#F6F3EA" stroke="#4D4D4D" strokeWidth={1.5} />
        <Rect x={10} y={9} width={143} height={34} rx={7} fill={`url(#label${id})`} />
        <Rect
          x={20}
          y={52}
          width={123}
          height={30}
          rx={15}
          fill={c.cassetteWindow}
          stroke={c.cassetteLabelStroke}
          strokeWidth={1.5}
        />
        <Rect x={20} y={52} width={123} height={30} rx={15} fill={`url(#win${id})`} />

        {EYES.map((x) => (
          <React.Fragment key={x}>
            <Circle cx={x} cy={EYE_Y} r={9} fill="#FFFFFF" />
            {!recording && <Circle cx={x} cy={EYE_Y} r={5.4} fill="#111113" />}
          </React.Fragment>
        ))}
        {lids?.map((d) => <Path key={d} d={d} fill={c.cassetteWindow} />)}

        {!recording && !playing && mouth && (
          <Path d={mouth} stroke={MOUTH} strokeWidth={2.6} strokeLinecap="round" fill="none" />
        )}
        {!recording && !playing && emotion === "surprise" && (
          <Ellipse cx={81.5} cy={67} rx={4.5} ry={5} stroke={MOUTH} strokeWidth={2.4} fill="none" />
        )}

        <Path
          d="M34 104 L40 92 L123 92 L129 104 Z"
          fill={c.cassetteDetail}
          stroke={c.cassetteLabelStroke}
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
      </Svg>

      {/* Handwritten label */}
      <View
        style={[
          s.label,
          { left: px(18), top: px(12), width: 127 * k, height: 26 * k, transform: [{ rotate: "-1.5deg" }] },
        ]}
        pointerEvents={labelSlot ? "auto" : "none"}
      >
        {labelSlot ?? (
          <Text
            numberOfLines={1}
            style={{ fontFamily: HANDWRITING, fontSize: 19 * k, lineHeight: 26 * k, color: LABEL_INK }}
          >
            {title ?? ""}
          </Text>
        )}
      </View>

      {playing && <PlayingWave left={px(64.5)} top={px(59)} k={k} />}
      {recording && EYES.map((x) => <EyeSpinner key={x} cx={px(x)} cy={px(EYE_Y)} k={k} />)}
    </View>
  );
}

/** Font size / line height for a TextInput placed in `labelSlot`. */
export function labelTextStyle(width: number, showKey = false) {
  const k = width / (showKey ? 174 : BODY_W + 2);
  return { fontFamily: HANDWRITING, fontSize: 19 * k, lineHeight: 26 * k, color: LABEL_INK, height: 26 * k };
}

// ── playing: small white waveform in place of the mouth ───────────────────────
const WAVE = [5, 9, 14, 10, 16, 8, 12, 6];

function useLoop(duration: number, to = 1) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = 0;
    t.value = withRepeat(withTiming(to, { duration, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(t);
  }, [t, duration, to]);
  return t;
}

function PlayingWave({ left, top, k }: { left: number; top: number; k: number }) {
  const t = useLoop(1100);
  return (
    <View style={[s.wave, { left, top, width: 34 * k, height: 16 * k }]} pointerEvents="none">
      {WAVE.map((h, i) => (
        <WaveBar key={i} t={t} i={i} h={h} k={k} />
      ))}
    </View>
  );
}

function WaveBar({ t, i, h, k }: { t: SharedValue<number>; i: number; h: number; k: number }) {
  const st = useAnimatedStyle(() => {
    const ph = Math.abs(Math.sin(2 * Math.PI * (t.value + i * 0.17)));
    return { transform: [{ scaleY: (h / 16) * (0.45 + 0.55 * ph) }] };
  });
  return (
    <Animated.View
      style={[{ width: 2.6 * k, height: 16 * k, borderRadius: 1.3 * k, backgroundColor: "#FFFFFF" }, st]}
    />
  );
}

// ── recording: black 3/4 loading arc spinning inside each white eye ───────────
function EyeSpinner({ cx, cy, k }: { cx: number; cy: number; k: number }) {
  const t = useLoop(900, 360);
  const st = useAnimatedStyle(() => ({ transform: [{ rotate: `${t.value}deg` }] }));
  const size = 11.2 * k;
  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: "absolute", left: cx - size / 2, top: cy - size / 2, width: size, height: size }, st]}
    >
      <Svg width={size} height={size} viewBox="0 0 11.2 11.2">
        <Path d="M5.6 1.07 A4.53 4.53 0 1 1 1.07 5.6" stroke="#111113" strokeWidth={2.13} fill="none" />
      </Svg>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  label: { position: "absolute", justifyContent: "center" },
  wave: { position: "absolute", flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
});
