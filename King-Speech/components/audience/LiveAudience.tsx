// Live Show Time hall. Native: Skia renderer (LiveAudience.impl). If Skia is not
// available in this build, `LiveAudience` is null and the stage keeps its still.
import type React from "react";
import type { LiveAudienceProps } from "./useLiveAudience";

let Impl: React.ComponentType<LiveAudienceProps> | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const sk = require("@shopify/react-native-skia");
  if (sk?.Skia?.PictureRecorder) Impl = require("./LiveAudience.impl").default;
} catch {
  Impl = null;
}

export const LiveAudience = Impl;
export { HALL_RATIO } from "./useLiveAudience";
export type { AudiencePhase, LiveAudienceProps } from "./useLiveAudience";
