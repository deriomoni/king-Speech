import React, { useEffect, useState } from "react";
import { router } from "expo-router";
import JennyInterview from "@/components/path/JennyInterview";
import { useGame, RANKS_MODULAR } from "@/context/GameContext";

export default function PortalInterviewScreen() {
  const { currentRank, markPortalCompleted, levels, isLoaded, portalCompleted } = useGame();
  const [pendingFinish, setPendingFinish] = useState(false);

  const range = RANKS_MODULAR.find((r) => r.index === currentRank);
  const rankLevels = range
    ? levels.filter((l) => l.module >= range.fromSection && l.module <= range.toSection)
    : [];
  const allRankLevelsDone = rankLevels.length > 0 && rankLevels.every((l) => l.completed);
  const alreadyDone = !!portalCompleted[currentRank];

  // Initial guard: bounce out if user shouldn't be here.
  useEffect(() => {
    if (!isLoaded) return;
    if (pendingFinish) return;
    if (alreadyDone) {
      router.replace("/rank-up");
      return;
    }
    if (!allRankLevelsDone) {
      router.replace("/");
    }
  }, [isLoaded, allRankLevelsDone, alreadyDone, pendingFinish]);

  // Once we ask to finish, wait for portalCompleted to actually flip true
  // before navigating, avoiding a race with the rank-up route guard.
  useEffect(() => {
    if (pendingFinish && portalCompleted[currentRank]) {
      router.replace("/rank-up");
    }
  }, [pendingFinish, portalCompleted, currentRank]);

  const handleFinished = () => {
    setPendingFinish(true);
    markPortalCompleted(currentRank);
  };

  if (!isLoaded || !allRankLevelsDone || (alreadyDone && !pendingFinish)) return null;

  return <JennyInterview rankIndex={currentRank} onFinished={handleFinished} />;
}
