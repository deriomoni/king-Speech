import React, { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Path, Circle, Defs, LinearGradient as SvgLinearGradient, RadialGradient, Stop, G, Line } from "react-native-svg";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  withSpring,
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
  expressiveness: { ru: "Выразительность", en: "Expressiveness", icon: "sparkles-outline" },
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
  if (score >= 6) return "#2DD4BF"; // teal
  if (score >= 4) return "#FBBF24"; // amber
  return "#FB7185"; // coral
}

interface Props {
  overall: number; // 0..10
  aspects: FlowerAspect[];
  size?: number;
  /** Center label under the score, e.g. "AI" or "/10". */
  centerLabel?: string;
}

export default function ScoreFlower({ overall, aspects, size = 300, centerLabel = "/10" }: Props) {
  const cx = size / 2;
  const cy = size / 2;
  const innerR = size * 0.135;
  const outerR = size * 0.345;
  const halfW = size * 0.1;
  const labelR = size * 0.43;
  const coreR = size * 0.135;

  const n = aspects.length;
  const step = 360 / n;
  const tipY = cy - outerR;
  const baseY = cy - innerR;
  const midY = (tipY + baseY) / 2;
  const petalPath = `M ${cx} ${baseY} Q ${cx + halfW} ${midY} ${cx} ${tipY} Q ${cx - halfW} ${midY} ${cx} ${baseY} Z`;

  const overallTone = toneFor(overall);

  // Whole-flower entrance (RN view animation — reliable across SVG).
  const bloom = useSharedValue(0.92);
  const fade = useSharedValue(0);
  const coreScale = useSharedValue(0.5);
  const coreOpacity = useSharedValue(0);
  useEffect(() => {
    fade.value = withTiming(1, { duration: 450 });
    bloom.value = withSpring(1, { damping: 14, stiffness: 90 });
    coreScale.value = withDelay(140, withSpring(1, { damping: 11 }));
    coreOpacity.value = withDelay(140, withTiming(1, { duration: 450 }));
  }, []);
  const flowerStyle = useAnimatedStyle(() => ({
    opacity: fade.value,
    transform: [{ scale: bloom.value }],
  }));
  const coreStyle = useAnimatedStyle(() => ({
    transform: [{ scale: coreScale.value }],
    opacity: coreOpacity.value,
  }));

  return (
    <View style={{ width: size, height: size }}>
      <Animated.View style={[StyleSheet.absoluteFill, flowerStyle]}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <Defs>
            {aspects.map((a, i) => {
              const frac = a.score / 10;
              const color = toneFor(a.score);
              return (
                <SvgLinearGradient key={i} id={`pet${i}`} x1="0.5" y1="1" x2="0.5" y2="0">
                  <Stop offset="0" stopColor={color} stopOpacity={(0.22 + frac * 0.6).toFixed(3)} />
                  <Stop offset="0.55" stopColor={color} stopOpacity={(0.12 + frac * 0.35).toFixed(3)} />
                  <Stop offset="1" stopColor={color} stopOpacity="0.04" />
                </SvgLinearGradient>
              );
            })}
            <RadialGradient id="coreGlow" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={overallTone} stopOpacity="0.30" />
              <Stop offset="1" stopColor={overallTone} stopOpacity="0" />
            </RadialGradient>
            <RadialGradient id="coreFill" cx="50%" cy="42%" r="65%">
              <Stop offset="0" stopColor="#1A1530" stopOpacity="1" />
              <Stop offset="1" stopColor="#0B0913" stopOpacity="1" />
            </RadialGradient>
          </Defs>

          {/* Soft centre halo */}
          <Circle cx={cx} cy={cy} r={outerR * 0.95} fill="url(#coreGlow)" />

          {/* Faint radial guide lines (neo grid) */}
          {aspects.map((_, i) => {
            const a = ((-90 + i * step) * Math.PI) / 180;
            return (
              <Line
                key={`l${i}`}
                x1={cx}
                y1={cy}
                x2={cx + Math.cos(a) * outerR}
                y2={cy + Math.sin(a) * outerR}
                stroke="#5EEAD4"
                strokeOpacity={0.06}
                strokeWidth={1}
              />
            );
          })}

          {/* Petals */}
          {aspects.map((a, i) => {
            const color = toneFor(a.score);
            const frac = a.score / 10;
            return (
              <G key={i} transform={`rotate(${i * step} ${cx} ${cy})`}>
                <Path
                  d={petalPath}
                  fill={`url(#pet${i})`}
                  stroke={color}
                  strokeWidth={1.5}
                  strokeOpacity={0.3 + frac * 0.5}
                />
              </G>
            );
          })}

          {/* Centre core ring */}
          <Circle cx={cx} cy={cy} r={coreR + 4} fill="none" stroke={overallTone} strokeOpacity={0.25} strokeWidth={1} />
          <Circle cx={cx} cy={cy} r={coreR} fill="url(#coreFill)" stroke="#7C3AED" strokeWidth={2.5} />
          <Circle cx={cx} cy={cy} r={coreR - 5} fill="none" stroke="#7C3AED" strokeOpacity={0.4} strokeWidth={1} />
        </Svg>
      </Animated.View>

      {/* Center score (RN text overlay for crisp typography) */}
      <Animated.View style={[StyleSheet.absoluteFill, st.center, coreStyle]} pointerEvents="none">
        <Text style={[st.scoreNum, { color: overallTone }]}>{overall.toFixed(1)}</Text>
        <Text style={st.scoreDenom}>{centerLabel}</Text>
      </Animated.View>

      {/* Petal labels + per-aspect scores (positioned by polar geometry) */}
      {aspects.map((a, i) => {
        const ang = ((-90 + i * step) * Math.PI) / 180;
        const lx = cx + Math.cos(ang) * labelR;
        const ly = cy + Math.sin(ang) * labelR;
        const tone = toneFor(a.score);
        const BOX = size * 0.3;
        return (
          <AspectLabel
            key={`lbl${i}`}
            x={lx}
            y={ly}
            box={BOX}
            label={a.label}
            score={a.score}
            tone={tone}
            icon={ASPECT_META[a.key].icon}
            delay={300 + i * 70}
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
  const ty = useSharedValue(6);
  useEffect(() => {
    op.value = withDelay(delay, withTiming(1, { duration: 350, easing: Easing.out(Easing.quad) }));
    ty.value = withDelay(delay, withSpring(0, { damping: 13 }));
  }, []);
  const style = useAnimatedStyle(() => ({ opacity: op.value, transform: [{ translateY: ty.value }] }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[st.labelBox, { width: box, left: x - box / 2, top: y - box * 0.16 }, style]}
    >
      <View style={st.labelRow}>
        <Ionicons name={icon} size={12} color={tone} />
        <Text numberOfLines={1} style={[st.labelText, { color: "rgba(244,244,250,0.78)" }]}>
          {label}
        </Text>
      </View>
      <Text style={[st.labelScore, { color: tone }]}>{score.toFixed(1)}</Text>
    </Animated.View>
  );
}

const st = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
  scoreNum: { fontSize: 34, fontFamily: "Inter_700Bold", letterSpacing: -1, lineHeight: 38 },
  scoreDenom: { fontSize: 12, fontFamily: "Inter_500Medium", color: "rgba(244,244,250,0.45)", marginTop: -2 },
  labelBox: { position: "absolute", alignItems: "center", gap: 1 },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  labelText: { fontSize: 11, fontFamily: "Inter_500Medium", letterSpacing: 0.1 },
  labelScore: { fontSize: 15, fontFamily: "Inter_700Bold", letterSpacing: -0.3 },
});
