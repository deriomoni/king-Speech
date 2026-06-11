import React, { useEffect, useMemo } from "react";
import { router, useLocalSearchParams } from "expo-router";
import RankUpScreen from "@/components/path/RankUpScreen";
import { useGame } from "@/context/GameContext";

export default function RankUpRoute() {
  const params = useLocalSearchParams<{ memento?: string; rank?: string }>();
  const isMemento = params.memento === "1";
  const requestedRank = useMemo(() => {
    if (!params.rank) return null;
    const n = parseInt(String(params.rank), 10);
    return Number.isFinite(n) && n >= 1 && n <= 5 ? n : null;
  }, [params.rank]);

  const { currentRank, portalCompleted, isLoaded } = useGame();
  const targetRank = isMemento && requestedRank ? requestedRank : currentRank;
  const portalDone = !!portalCompleted[targetRank];

  // Route guard: this is a ceremonial screen that should only appear after
  // the user has actually completed the rank's portal interview. Memento
  // visits also require that the rank's portal was completed at some point.
  useEffect(() => {
    if (!isLoaded) return;
    if (!portalDone) {
      router.replace("/");
    }
  }, [isLoaded, portalDone]);

  if (!isLoaded || !portalDone) return null;

  return <RankUpScreen fromRank={targetRank} memento={isMemento} />;
}
