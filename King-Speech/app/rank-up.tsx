import React, { useEffect, useMemo } from "react";
import { useLocalSearchParams } from "expo-router";
import { leaveTo } from "@/lib/nav";
import RankUpScreen from "@/components/path/RankUpScreen";
import { useGame, RANKS_MODULAR } from "@/context/GameContext";

export default function RankUpRoute() {
  const params = useLocalSearchParams<{ memento?: string; rank?: string; preview?: string; earned?: string }>();
  const isMemento = params.memento === "1";
  // Dev preview (Open Testing): replay the cut-scene without passing the rank.
  const isPreview = params.preview === "1";
  // Came straight from finishing the rank's last level.
  const isEarned = params.earned === "1";
  const requestedRank = useMemo(() => {
    if (!params.rank) return null;
    const n = parseInt(String(params.rank), 10);
    return Number.isFinite(n) && n >= 1 && n <= 5 ? n : null;
  }, [params.rank]);

  const { currentRank, portalCompleted, isLoaded, levels } = useGame();
  const range = RANKS_MODULAR.find((r) => r.index === currentRank);
  const rankDone =
    !!range &&
    levels.filter((l) => l.module >= range.fromSection && l.module <= range.toSection).every((l) => l.completed);
  const targetRank = isMemento && requestedRank ? requestedRank : currentRank;
  const portalDone = !!portalCompleted[targetRank] || isPreview || isEarned || (!isMemento && rankDone);

  // Route guard: this is a ceremonial screen that should only appear after
  // the user has actually completed the rank's portal interview. Memento
  // visits also require that the rank's portal was completed at some point.
  useEffect(() => {
    if (!isLoaded) return;
    if (!portalDone) {
      leaveTo("/");
    }
  }, [isLoaded, portalDone]);

  if (!isLoaded || !portalDone) return null;

  return <RankUpScreen fromRank={targetRank} memento={isMemento} preview={isPreview} />;
}
