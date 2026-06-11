/**
 * Skia-backed pitch track for production/dev-client builds.
 * Falls back to Reanimated PitchTrack when @shopify/react-native-skia is unavailable (Expo Go / web).
 */
import React from "react";
import { Platform } from "react-native";
import type { SharedValue } from "react-native-reanimated";
import type { HitZone } from "@/services/warmupScoring";
import PitchTrack, {
  type TrackSegment,
  buildTrackSegments,
  passDurationSec,
} from "@/components/warmup/PitchTrack";

export { buildTrackSegments, passDurationSec };
export type { TrackSegment };

interface Props {
  segments: TrackSegment[];
  progress01: SharedValue<number>;
  ballY01: SharedValue<number>;
  activeIndex: number;
  moduleColor: string;
  hitZone: HitZone;
}

let SkiaTrack: React.ComponentType<Props> | null = null;
if (Platform.OS === "ios" || Platform.OS === "android") {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    SkiaTrack = require("@/components/warmup/PitchTrackSkia.impl").default;
  } catch {
    SkiaTrack = null;
  }
}

export default function PitchTrackSkia(props: Props) {
  if (SkiaTrack) return <SkiaTrack {...props} />;
  return <PitchTrack {...props} />;
}
