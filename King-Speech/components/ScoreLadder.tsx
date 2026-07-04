import React, { useEffect } from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  withRepeat,
  Easing,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { ASPECT_META, type FlowerAspect } from "@/components/ScoreFlower";

// ───────────────────────────────────────────────────────────────────────────
// ScoreLadder — the readable replacement for the flower. Overall + every
// criterion live in ONE connected chain, sorted best→worst so it reads like a
// staircase: strengths glow at the top, "work on this" sinks to the bottom.
//
// Tiers (evaluation surface only — its own semantic heat map, not brand hues):
//   good      → neon lime green
//   can-do-better → lemon yellow
//   weak      → orange-red
// Depth comes from gradient fills + soft breathing halos + a glow on numbers.
// Motion is timing-based (ease-out cubic), staggered node-by-node — smooth and
// premium, no springy bounce or jitter.
// ───────────────────────────────────────────────────────────────────────────

type Tier = {
  grad: readonly [string, string];
  solid: string;
  glow: string;
  label: (ru: boolean) => string;
};

function tierFor(score: number): Tier {
  if (score >= 7.5)
    return {
      grad: ["#C2FF6B", "#63DA1C"],
      solid: "#9BF23A",
      glow: "rgba(150,242,58,0.55)",
      label: (ru) => (ru ? "Отлично" : "Great"),
    };
  if (score >= 5)
    return {
      grad: ["#FFEB7A", "#F5C518"],
      solid: "#FFDA3A",
      glow: "rgba(255,216,58,0.5)",
      label: (ru) => (ru ? "Можно лучше" : "Can improve"),
    };
  return {
    grad: ["#FFA24D", "#FF3D54"],
    solid: "#FF6A4D",
    glow: "rgba(255,86,66,0.5)",
    label: (ru) => (ru ? "Поработать" : "Work on it"),
  };
}

function glowStyle(color: string, radius: number) {
  return Platform.OS === "web"
    ? ({ boxShadow: `0 0 ${radius}px ${Math.round(radius * 0.45)}px ${color}` } as any)
    : {
        shadowColor: color,
        shadowOpacity: 0.9,
        shadowRadius: radius,
        shadowOffset: { width: 0, height: 0 },
        elevation: 0,
      };
}

interface Props {
  overall: number;
  aspects: FlowerAspect[];
  width?: number;
  lang?: "ru" | "en";
}

export default function ScoreLadder({ overall, aspects, width = 380, lang = "ru" }: Props) {
  const ru = lang === "ru";
  // Strengths on top, weaknesses at the bottom → the bars form a staircase.
  const sorted = [...aspects].sort((a, b) => b.score - a.score);
  return (
    <View style={{ width }}>
      <LadderNode
        overall
        label={ru ? "Общая оценка" : "Overall"}
        score={overall}
        icon="ribbon-outline"
        index={0}
        ru={ru}
      />
      {sorted.map((a, i) => (
        <LadderNode
          key={a.key}
          label={a.label}
          score={a.score}
          icon={ASPECT_META[a.key].icon}
          index={i + 1}
          ru={ru}
          last={i === sorted.length - 1}
        />
      ))}
    </View>
  );
}

function LadderNode({
  overall = false,
  label,
  score,
  icon,
  index,
  ru,
  last = false,
}: {
  overall?: boolean;
  label: string;
  score: number;
  icon: keyof typeof import("@expo/vector-icons").Ionicons.glyphMap;
  index: number;
  ru: boolean;
  last?: boolean;
}) {
  const tier = tierFor(score);
  const delay = 120 + index * 130;

  const op = useSharedValue(0);
  const ty = useSharedValue(16);
  const sc = useSharedValue(0.97);
  const fill = useSharedValue(0);
  const pulse = useSharedValue(0);

  useEffect(() => {
    op.value = withDelay(delay, withTiming(1, { duration: 440, easing: Easing.out(Easing.cubic) }));
    ty.value = withDelay(delay, withTiming(0, { duration: 520, easing: Easing.out(Easing.cubic) }));
    sc.value = withDelay(delay, withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) }));
    // Bar fills a beat after the card lands — the "premium" reveal.
    fill.value = withDelay(delay + 140, withTiming(clampFrac(score), { duration: 760, easing: Easing.out(Easing.cubic) }));
    // Very slow, low-amplitude breathing glow. Smooth, never jittery.
    pulse.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration: 2800, easing: Easing.inOut(Easing.quad) }), -1, true),
    );
  }, []);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: op.value,
    transform: [{ translateY: ty.value }, { scale: sc.value }],
  }));
  const fillStyle = useAnimatedStyle(() => ({ width: `${Math.max(4, fill.value * 100)}%` }));
  const haloStyle = useAnimatedStyle(() => ({ opacity: 0.22 + pulse.value * 0.24 }));

  return (
    <View style={[st.nodeWrap, { marginBottom: last ? 0 : 12 }]}>
      {/* Soft scattered halo behind the card (depth + glow) */}
      <Animated.View
        pointerEvents="none"
        style={[
          st.halo,
          { backgroundColor: tier.glow },
          glowStyle(tier.glow, overall ? 44 : 28),
          haloStyle,
        ]}
      />

      <Animated.View style={[st.card, overall && st.cardOverall, { borderColor: tier.solid + "40" }, cardStyle]}>
        {/* Left accent rail — the "rung" of the ladder */}
        <View style={[st.accent, glowStyle(tier.glow, overall ? 14 : 10)]}>
          <LinearGradient colors={tier.grad as any} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
        </View>

        <View style={{ flex: 1, gap: overall ? 10 : 7, paddingLeft: 16 }}>
          <View style={st.rowTop}>
            <Ionicons name={icon} size={overall ? 18 : 15} color={tier.solid} />
            <Text
              numberOfLines={1}
              style={[st.label, overall && st.labelOverall, { color: overall ? "#F5F1FF" : "rgba(242,238,251,0.9)" }]}
            >
              {label}
            </Text>
            <View style={{ flex: 1 }} />
            <Text
              style={[
                st.score,
                overall && st.scoreOverall,
                {
                  color: tier.solid,
                  textShadowColor: tier.glow,
                  textShadowRadius: overall ? 18 : 12,
                  textShadowOffset: { width: 0, height: 0 },
                },
              ]}
            >
              {score.toFixed(1)}
            </Text>
          </View>

          <View style={[st.track, { height: overall ? 14 : 10 }]}>
            <Animated.View style={[st.fill, fillStyle, glowStyle(tier.glow, overall ? 18 : 12)]}>
              <LinearGradient colors={tier.grad as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
            </Animated.View>
          </View>

          {overall ? (
            <Text style={[st.tierWord, { color: tier.solid }]}>{tier.label(ru)}</Text>
          ) : null}
        </View>
      </Animated.View>

      {/* Chain connector to the next node */}
      {!last ? <View style={st.connector} /> : null}
    </View>
  );
}

function clampFrac(score: number): number {
  const f = score / 10;
  if (!Number.isFinite(f)) return 0;
  return Math.max(0, Math.min(1, f));
}

const st = StyleSheet.create({
  nodeWrap: { position: "relative" },
  halo: {
    position: "absolute",
    left: 10,
    right: 10,
    top: 6,
    bottom: 6,
    borderRadius: 22,
  },
  card: {
    flexDirection: "row",
    alignItems: "stretch",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 14,
    overflow: "hidden",
  },
  cardOverall: {
    backgroundColor: "rgba(255,255,255,0.07)",
    paddingVertical: 16,
    borderRadius: 24,
  },
  accent: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 6,
    borderTopLeftRadius: 20,
    borderBottomLeftRadius: 20,
    overflow: "hidden",
  },
  rowTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  label: { fontSize: 14.5, fontFamily: "Rubik_500Medium" },
  labelOverall: { fontSize: 16.5, fontFamily: "Rubik_600SemiBold" },
  score: { fontSize: 22, fontFamily: "Fredoka_700Bold", letterSpacing: 0.3 },
  scoreOverall: { fontSize: 38, lineHeight: 42 },
  track: {
    backgroundColor: "rgba(255,255,255,0.09)",
    borderRadius: 8,
    overflow: "hidden",
  },
  fill: { height: "100%", borderRadius: 8, overflow: "hidden" },
  tierWord: { fontSize: 12.5, fontFamily: "Rubik_600SemiBold", letterSpacing: 0.6, textTransform: "uppercase", opacity: 0.9 },
  connector: {
    position: "absolute",
    left: 18,
    bottom: -1,
    width: 3,
    height: 12,
    borderRadius: 2,
    backgroundColor: "rgba(150,150,180,0.28)",
  },
});
