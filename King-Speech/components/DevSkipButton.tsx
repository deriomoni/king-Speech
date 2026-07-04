import React from "react";
import { Platform, Pressable, StyleSheet, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useDevTools } from "@/context/DevToolsContext";
import { useGame, MODULE_COLORS } from "@/context/GameContext";
import { useModuleTransition } from "@/context/ModuleTransitionContext";
import { useLang } from "@/context/LangContext";
import { getLevelsData } from "@/constants/gameContent";

/**
 * DEV-ONLY floating "Skip" button for level screens. When the dev "Skip" toggle
 * is on (Settings → Dev tools), it awards the level max score, unlocks/advances
 * to the next level, and navigates there. Renders nothing in production builds
 * (gated behind __DEV__) or when the toggle is off — so it never ships and can't
 * affect a real player's progression.
 */
export default function DevSkipButton({
  levelId,
  onPreviewResults,
}: {
  levelId: string;
  /**
   * When provided, Skip passes all tasks at max score and then opens THIS
   * screen's score window (flower) with example data — instead of navigating
   * to the next level. Used to quickly preview the results design.
   */
  onPreviewResults?: () => void;
}) {
  const { isDevSkipEnabled } = useDevTools();
  const { completeAllTasksForLevel } = useGame();
  const { triggerModuleTransition } = useModuleTransition();
  const { lang } = useLang();
  const insets = useSafeAreaInsets();

  if (!__DEV__ || !isDevSkipEnabled) return null;

  const onSkip = () => {
    if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
    // Max score + unlock next. This is a no-op under Open Testing (which
    // already unlocks everything), so the navigation below still works there.
    try {
      completeAllTasksForLevel(levelId as any, 10);
    } catch (e) {
      console.warn("[DevSkipButton] complete failed:", e);
    }

    // Preview mode: stay on this screen and show the score window (flower)
    // populated with example data, instead of advancing to the next level.
    if (onPreviewResults) {
      onPreviewResults();
      return;
    }
    // Route to the next path level — same logic as a normal level completion.
    const all = getLevelsData(lang);
    const idx = all.findIndex((l) => l.id === levelId);
    const current = idx >= 0 ? all[idx] : null;
    const next = idx >= 0 && idx < all.length - 1 ? all[idx + 1] : null;
    if (!next) {
      router.replace("/(tabs)");
      return;
    }
    // Crossing into a new module → play the full-screen module transition (same
    // corridor as finishing a module's last level). Lets dev preview it too.
    if (current && next.module > current.module) {
      const color = MODULE_COLORS[next.module]?.color ?? "#9468FB";
      triggerModuleTransition(current.module, next.module, color);
    }
    if (next.id.startsWith("showtime")) {
      router.replace({ pathname: "/showtime-stage", params: { levelId: next.id, mode: "game" } });
    } else if (next.id.startsWith("vocabulary")) {
      router.replace({ pathname: "/vocabulary-level", params: { levelId: next.id, moduleId: String(next.module) } });
    } else {
      router.replace({ pathname: "/level/[id]", params: { id: next.id } });
    }
  };

  return (
    <Pressable
      onPress={onSkip}
      style={[styles.btn, { bottom: insets.bottom + 16 }]}
      accessibilityLabel="Dev: skip level"
    >
      <Ionicons name="play-skip-forward" size={16} color="#fff" />
      <Text style={styles.txt}>Skip (dev)</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    position: "absolute",
    left: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(244,67,54,0.92)",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 18,
    zIndex: 9999,
    elevation: 12,
  },
  txt: { color: "#fff", fontSize: 13, fontFamily: "Inter_700Bold" },
});
