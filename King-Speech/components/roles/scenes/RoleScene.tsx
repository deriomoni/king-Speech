// Picks the scene overlay for a scenario kind: chat (sales / service),
// live (bloggers) or stage (public professions).
import React from "react";
import { ChatDialogue } from "./ChatDialogue";
import { LiveFeed } from "./LiveStream";
import { StageFeed } from "./StageCues";
import type { SceneProps } from "./common";

export { LiveTopBadge, LiveOverlay } from "./LiveStream";
export { StageOverlay } from "./StageCues";
export { ScriptPrompter } from "./ScriptPrompter";
export { GoalTracker } from "./GoalTracker";
export type { SceneProps } from "./common";

export function SceneFeed(p: SceneProps) {
  switch (p.scenario.kind) {
    case "live":
      return <LiveFeed {...p} />;
    case "stage":
      return <StageFeed {...p} />;
    default:
      return <ChatDialogue {...p} />;
  }
}
