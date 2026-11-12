// Shared bits for the role-stage scene overlays (chat / live / stage).
import React, { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  cancelAnimation,
} from "react-native-reanimated";
import type { Lang } from "@/context/LangContext";
import type { RoleScenario } from "@/constants/roleScenarios";
import { lt } from "@/constants/roleScenarios";
import type { ScenarioMsg } from "@/hooks/useRoleScenario";

export const SCENE = {
  glass: "rgba(0,0,0,0.62)",
  glassSoft: "rgba(0,0,0,0.45)",
  line: "rgba(255,255,255,0.14)",
  text: "#FFFFFF",
  muted: "rgba(255,255,255,0.62)",
  yellow: "#FFD857",
  onYellow: "#2B2100",
  red: "#FF3B30",
  troll: "rgba(120,20,30,0.72)",
  cue: "rgba(40,40,52,0.82)",
  green: "#34C759",
};

export interface SceneProps {
  scenario: RoleScenario;
  lang: Lang;
  scripted: boolean;
  messages: ScenarioMsg[];
  typing: boolean;
  mood: number;
  viewers: number;
  hearts: number;
  speaking: boolean;
  finished: boolean;
  awaitingOpening: boolean;
  /** Max height of the in-flow feed (keeps it out of the face area). */
  maxHeight: number;
}

/** «…» typing indicator — loops only while mounted (i.e. while the opponent is typing). */
export function TypingDots({ color = "#FFFFFF" }: { color?: string }) {
  return (
    <View style={{ flexDirection: "row", gap: 4, paddingVertical: 4 }}>
      {[0, 1, 2].map((i) => (
        <Dot key={i} delay={i * 140} color={color} />
      ))}
    </View>
  );
}

function Dot({ delay, color }: { delay: number; color: string }) {
  const o = useSharedValue(0.3);
  useEffect(() => {
    o.value = withDelay(delay, withRepeat(withSequence(withTiming(1, { duration: 320 }), withTiming(0.3, { duration: 320 })), -1));
    return () => cancelAnimation(o);
  }, [delay, o]);
  const st = useAnimatedStyle(() => ({ opacity: o.value, transform: [{ translateY: (1 - o.value) * 2 }] }));
  return <Animated.View style={[{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }, st]} />;
}

export function Avatar({ emoji, size = 30, ring }: { emoji: string; size?: number; ring?: string }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: "rgba(255,255,255,0.16)",
        alignItems: "center",
        justifyContent: "center",
        borderWidth: ring ? 2 : 0,
        borderColor: ring,
      }}
    >
      <Text style={{ fontSize: size * 0.56 }}>{emoji}</Text>
    </View>
  );
}

/** Horizontal meter 0..100 with a red→yellow→green fill and a face. */
export function MoodMeter({ value, label, width = 120 }: { value: number; label?: string; width?: number }) {
  const v = Math.max(0, Math.min(100, value));
  const color = v < 34 ? "#FF6B5E" : v < 62 ? SCENE.yellow : SCENE.green;
  const face = v < 20 ? "😠" : v < 40 ? "😕" : v < 60 ? "😐" : v < 80 ? "🙂" : "🤩";
  const w = useSharedValue(v);
  useEffect(() => {
    w.value = withTiming(v, { duration: 450 });
  }, [v, w]);
  const fill = useAnimatedStyle(() => ({ width: `${w.value}%` }));
  return (
    <View style={{ gap: 3 }}>
      {label ? <Text style={styles.meterLabel} numberOfLines={1}>{label}</Text> : null}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <View style={[styles.meterTrack, { width }]}>
          <Animated.View style={[styles.meterFill, { backgroundColor: color }, fill]} />
        </View>
        <Text style={{ fontSize: 14 }}>{face}</Text>
      </View>
    </View>
  );
}

/** Tiny yellow tag on a line that puts a goal in play. */
export function GoalTag({ scenario, beatIndex, lang }: { scenario: RoleScenario; beatIndex?: number; lang: Lang }) {
  if (beatIndex == null) return null;
  const gid = scenario.beats[beatIndex]?.goal;
  const g = gid ? scenario.goals.find((x) => x.id === gid) : undefined;
  if (!g) return null;
  return (
    <View style={styles.goalTag}>
      <Text style={styles.goalTagText} numberOfLines={1}>🎯 {lt(g.text, lang)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  meterLabel: { color: SCENE.muted, fontFamily: "Geologica_600SemiBold", fontSize: 10, letterSpacing: 0.4, textTransform: "uppercase" },
  meterTrack: { height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.18)", overflow: "hidden" },
  meterFill: { height: 6, borderRadius: 3 },
  goalTag: {
    alignSelf: "flex-start", marginTop: 6, backgroundColor: "rgba(255,216,87,0.18)", borderRadius: 8,
    paddingHorizontal: 7, paddingVertical: 3, maxWidth: "100%",
  },
  goalTagText: { color: SCENE.yellow, fontFamily: "Geologica_600SemiBold", fontSize: 11 },
});
