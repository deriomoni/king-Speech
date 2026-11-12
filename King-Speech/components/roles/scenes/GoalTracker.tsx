// Compact goal tracker for the recording screen: «🎯 ●●○». Tap to see the
// goals. A goal ticks live when the player gave a full answer to the line
// that puts it in play; the AI judge gives the final verdict on /role-result.
import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import Animated, { FadeInDown, FadeOut, ZoomIn } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "@/lib/haptics";
import type { Lang } from "@/context/LangContext";
import { lt, type RoleScenario } from "@/constants/roleScenarios";
import type { GoalState } from "@/hooks/useRoleScenario";
import { SCENE } from "./common";

export function GoalTracker({ scenario, goals, lang }: { scenario: RoleScenario; goals: Record<string, GoalState>; lang: Lang }) {
  const [open, setOpen] = useState(false);
  const done = scenario.goals.filter((g) => goals[g.id] === "done").length;
  const prevDone = useRef(done);
  const [flashId, setFlashId] = useState<string | null>(null);

  // Toast the goal that just ticked.
  useEffect(() => {
    if (done > prevDone.current) {
      const g = scenario.goals.filter((x) => goals[x.id] === "done").pop();
      if (g) {
        setFlashId(g.id);
        if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        const t = setTimeout(() => setFlashId(null), 2200);
        prevDone.current = done;
        return () => clearTimeout(t);
      }
    }
    prevDone.current = done;
  }, [done, goals, scenario.goals]);

  const flashGoal = flashId ? scenario.goals.find((g) => g.id === flashId) : undefined;

  return (
    <View style={{ alignItems: "flex-end" }}>
      {open && (
        <Animated.View entering={FadeInDown.duration(200)} exiting={FadeOut.duration(150)} style={styles.panel}>
          {scenario.goals.map((g) => {
            const ok = goals[g.id] === "done";
            return (
              <View key={g.id} style={styles.row}>
                <Ionicons name={ok ? "checkmark-circle" : "ellipse-outline"} size={16} color={ok ? SCENE.green : SCENE.muted} />
                <Text style={[styles.rowText, ok && { color: SCENE.text }]}>{lt(g.text, lang)}</Text>
              </View>
            );
          })}
        </Animated.View>
      )}
      {flashGoal && !open && (
        <Animated.View entering={ZoomIn.duration(220)} exiting={FadeOut.duration(200)} style={styles.toast}>
          <Ionicons name="checkmark-circle" size={14} color="#06210F" />
          <Text style={styles.toastText} numberOfLines={1}>{lt(flashGoal.text, lang)}</Text>
        </Animated.View>
      )}
      <Pressable onPress={() => setOpen((o) => !o)} hitSlop={8} style={styles.pill}>
        <Text style={{ fontSize: 12 }}>🎯</Text>
        {scenario.goals.map((g) => (
          <View key={g.id} style={[styles.dot, goals[g.id] === "done" && styles.dotOn]} />
        ))}
        <Text style={styles.count}>{done}/{scenario.goals.length}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#000000B3", paddingHorizontal: 10, paddingVertical: 7, borderRadius: 12 },
  dot: { width: 8, height: 8, borderRadius: 4, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.6)" },
  dotOn: { backgroundColor: SCENE.green, borderColor: SCENE.green },
  count: { color: "#fff", fontFamily: "Geologica_700Bold", fontSize: 11, marginLeft: 2 },
  panel: { backgroundColor: "#000000CC", borderRadius: 14, padding: 10, gap: 7, marginBottom: 6, maxWidth: 260 },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 7 },
  rowText: { flex: 1, color: SCENE.muted, fontFamily: "Geologica_500Medium", fontSize: 12, lineHeight: 16 },
  toast: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: SCENE.green, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 6, maxWidth: 240 },
  toastText: { color: "#06210F", fontFamily: "Geologica_700Bold", fontSize: 12, flexShrink: 1 },
});
