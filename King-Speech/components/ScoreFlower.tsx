import React, { useEffect } from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import Svg, { Ellipse, Circle, Defs, RadialGradient, Stop } from "react-native-svg";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  withSpring,
  withRepeat,
  withSequence,
  Easing,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";

// ───────────────────────────────────────────────────────────────────────────
// Canonical speech aspects. Every AI-analysis surface (reading, Show Time,
// generic level results) maps its data onto these six petals so the score
// window looks and reads identically everywhere.
// ───────────────────────────────────────────────────────────────────────────
export type AspectKey =
  | "clarity"
  | "confidence"
  | "volume"
  | "tempo"
  | "expressiveness"
  | "pauses";

export const ASPECT_META: Record<
  AspectKey,
  { ru: string; en: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  clarity:        { ru: "Чёткость",        en: "Clarity",        icon: "chatbubble-ellipses-outline" },
  confidence:     { ru: "Уверенность",     en: "Confidence",     icon: "shield-checkmark-outline" },
  volume:         { ru: "Громкость",       en: "Volume",         icon: "volume-high-outline" },
  tempo:          { ru: "Темп",            en: "Tempo",          icon: "speedometer-outline" },
  expressiveness: { ru: "Выразительность", en: "Expressive",     icon: "sparkles-outline" },
  pauses:         { ru: "Паузы",           en: "Pauses",         icon: "pause-circle-outline" },
};

// Display order around the flower (top, then clockwise).
const ORDER: AspectKey[] = ["clarity", "confidence", "volume", "tempo", "pauses", "expressiveness"];

export interface FlowerAspect {
  key: AspectKey;
  label: string;
  score: number; // 0..10
}

/** Build the six-aspect list from a 0..10 SpeechScore-like object. */
export function aspectsFromScore10(
  s: Partial<Record<AspectKey, number>>,
  lang: "ru" | "en",
): FlowerAspect[] {
  return ORDER.map((key) => ({
    key,
    label: lang === "en" ? ASPECT_META[key].en : ASPECT_META[key].ru,
    score: clamp10(Number(s[key] ?? 0)),
  }));
}

/** Build the six-aspect list from 1..5 server `metrics`. */
export function aspectsFromMetrics5(
  m: Partial<Record<AspectKey, number>>,
  lang: "ru" | "en",
): FlowerAspect[] {
  return ORDER.map((key) => ({
    key,
    label: lang === "en" ? ASPECT_META[key].en : ASPECT_META[key].ru,
    score: clamp10(Number(m[key] ?? 0) * 2),
  }));
}

function clamp10(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(10, v));
}

// Neon tone by score — bright mint for strong, amber/coral for weak. Reads as
// an at-a-glance heat map across the petals.
export function toneFor(score: number): string {
  if (score >= 8) return "#5EEAD4"; // aqua mint
  if (score >= 6) return "#34D399"; // emerald
  if (score >= 4) return "#FBBF24"; // amber
  return "#FB7185"; // coral
}

function glow(color: string, radius: number, opacity = 0.9) {
  return Platform.OS === "web"
    ? ({ boxShadow: `0 0 ${radius}px ${Math.round(radius * 0.5)}px ${color}` } as any)
    : {
        shadowColor: color,
        shadowOpacity: opacity,
        shadowRadius: radius,
        shadowOffset: { width: 0, height: 0 },
        elevation: 0,
      };
}

interface Props {
  overall: number; // 0..10
  aspects: FlowerAspect[];
  size?: number;
}

export default function ScoreFlower({ overall, aspects, size = 320 }: Props) {
  const cx = size / 2;
  const cy = size / 2;
  const n = aspects.length;
  const step = 360 / n;

  // Petal geometry — broad rounded lobes (ellipses) overlapping toward the
  // centre, so the whole thing reads as a flower and each petal is big enough
  // to hold its own label + score INSIDE it.
  const lobeDist = size * 0.255; // centre→petal-centre
  const rx = size * 0.14; // petal half-width
  const ry = size * 0.185; // petal half-length (radial)
  const coreR = size * 0.155;

  const overallTone = toneFor(overall);

  // Whole-flower entrance.
  const bloom = useSharedValue(0.9);
  const fade = useSharedValue(0);
  useEffect(() => {
    fade.value = withTiming(1, { duration: 450 });
    bloom.value = withSpring(1, { damping: 14, stiffness: 90 });
  }, []);
  const flowerStyle = useAnimatedStyle(() => ({
    opacity: fade.value,
    transform: [{ scale: bloom.value }],
  }));

  // Looping "aura" — a soft tone halo that breathes behind the core.
  const aura = useSharedValue(0);
  useEffect(() => {
    aura.value = withDelay(
      300,
      withRepeat(withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.quad) }), -1, true),
    );
  }, []);
  const auraStyle = useAnimatedStyle(() => ({
    opacity: 0.28 + aura.value * 0.34,
    transform: [{ scale: 0.92 + aura.value * 0.16 }],
  }));

  // Looping micro-pulse on the overall number + a delayed entrance.
  const numScale = useSharedValue(0.6);
  const numOpacity = useSharedValue(0);
  useEffect(() => {
    numOpacity.value = withDelay(160, withTiming(1, { duration: 450 }));
    numScale.value = withDelay(
      160,
      withSequence(
        withSpring(1, { damping: 10 }),
        withRepeat(
          withSequence(
            withTiming(1.045, { duration: 1300, easing: Easing.inOut(Easing.quad) }),
            withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.quad) }),
          ),
          -1,
          false,
        ),
      ),
    );
  }, []);
  const numStyle = useAnimatedStyle(() => ({
    opacity: numOpacity.value,
    transform: [{ scale: numScale.value }],
  }));

  const auraSize = size * 0.52;

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      {/* Breathing aura behind the core */}
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: "absolute",
            width: auraSize,
            height: auraSize,
            borderRadius: auraSize / 2,
            backgroundColor: overallTone + "26",
            ...glow(overallTone, size * 0.16, 0.8),
          },
          auraStyle,
        ]}
      />

      <Animated.View style={[StyleSheet.absoluteFill, flowerStyle]}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <Defs>
            {aspects.map((a, i) => {
              const frac = a.score / 10;
              const color = toneFor(a.score);
              return (
                <RadialGradient key={i} id={`pet${i}`} cx="50%" cy="40%" r="62%">
                  <Stop offset="0" stopColor={color} stopOpacity={(0.34 + frac * 0.45).toFixed(3)} />
                  <Stop offset="0.6" stopColor={color} stopOpacity={(0.16 + frac * 0.3).toFixed(3)} />
                  <Stop offset="1" stopColor={color} stopOpacity="0.05" />
                </RadialGradient>
              );
            })}
            <RadialGradient id="coreFill" cx="50%" cy="40%" r="70%">
              <Stop offset="0" stopColor="#15131F" stopOpacity="1" />
              <Stop offset="1" stopColor="#08070D" stopOpacity="1" />
            </RadialGradient>
          </Defs>

          {/* Petals — rounded lobes overlapping toward the centre */}
          {aspects.map((a, i) => {
            const ang = ((-90 + i * step) * Math.PI) / 180;
            const lx = cx + Math.cos(ang) * lobeDist;
            const ly = cy + Math.sin(ang) * lobeDist;
            const color = toneFor(a.score);
            const frac = a.score / 10;
            const rotDeg = -90 + i * step + 90; // long axis points outward
            return (
              <Ellipse
                key={i}
                cx={lx}
                cy={ly}
                rx={rx}
                ry={ry}
                fill={`url(#pet${i})`}
                stroke={color}
                strokeWidth={1.25}
                strokeOpacity={0.25 + frac * 0.45}
                transform={`rotate(${rotDeg} ${lx} ${ly})`}
              />
            );
          })}

          {/* Centre core — dark glass, thin tone ring (no purple) */}
          <Circle cx={cx} cy={cy} r={coreR + 3} fill="none" stroke={overallTone} strokeOpacity={0.18} strokeWidth={1} />
          <Circle cx={cx} cy={cy} r={coreR} fill="url(#coreFill)" stroke={overallTone} strokeWidth={1.5} strokeOpacity={0.85} />
        </Svg>
      </Animated.View>

      {/* Centre overall score — looping micro-pulse */}
      <Animated.View style={[st.center, numStyle]} pointerEvents="none">
        <Text style={[st.scoreNum, { color: overallTone }]}>{overall.toFixed(1)}</Text>
        <View style={[st.scoreUnderline, { backgroundColor: overallTone }]} />
      </Animated.View>

      {/* Per-petal label + score, INSIDE each lobe (upright) */}
      {aspects.map((a, i) => {
        const ang = ((-90 + i * step) * Math.PI) / 180;
        const lx = cx + Math.cos(ang) * (lobeDist * 1.02);
        const ly = cy + Math.sin(ang) * (lobeDist * 1.02);
        const BOX = size * 0.26;
        return (
          <AspectLabel
            key={`lbl${i}`}
            x={lx}
            y={ly}
            box={BOX}
            label={a.label}
            score={a.score}
            tone={toneFor(a.score)}
            icon={ASPECT_META[a.key].icon}
            delay={420 + i * 70}
          />
        );
      })}
    </View>
  );
}

function AspectLabel({
  x,
  y,
  box,
  label,
  score,
  tone,
  icon,
  delay,
}: {
  x: number;
  y: number;
  box: number;
  label: string;
  score: number;
  tone: string;
  icon: keyof typeof Ionicons.glyphMap;
  delay: number;
}) {
  const op = useSharedValue(0);
  const sc = useSharedValue(0.7);
  useEffect(() => {
    op.value = withDelay(delay, withTiming(1, { duration: 360, easing: Easing.out(Easing.quad) }));
    sc.value = withDelay(delay, withSpring(1, { damping: 13 }));
  }, []);
  const style = useAnimatedStyle(() => ({ opacity: op.value, transform: [{ scale: sc.value }] }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[st.labelBox, { width: box, left: x - box / 2, top: y - box * 0.42 }, style]}
    >
      <Ionicons name={icon} size={13} color={tone} style={{ marginBottom: 1 }} />
      <Text numberOfLines={2} style={st.labelText}>
        {label}
      </Text>
      <Text style={[st.labelScore, { color: tone }]}>{score.toFixed(1)}</Text>
    </Animated.View>
  );
}

const st = StyleSheet.create({
  center: { position: "absolute", alignItems: "center", justifyContent: "center" },
  scoreNum: { fontSize: 40, fontFamily: "Fredoka_700Bold", letterSpacing: 0.5, lineHeight: 46 },
  scoreUnderline: { width: 22, height: 3, borderRadius: 2, marginTop: 3, opacity: 0.85 },
  labelBox: { position: "absolute", alignItems: "center", gap: 0 },
  labelText: {
    fontSize: 10.5,
    fontFamily: "Rubik_500Medium",
    color: "rgba(244,244,250,0.82)",
    textAlign: "center",
    lineHeight: 13,
  },
  labelScore: { fontSize: 18, fontFamily: "Fredoka_700Bold", letterSpacing: 0.3, marginTop: 1 },
});
