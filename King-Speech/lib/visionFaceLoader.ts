// Web (and type) entry of the face-tracking loader: no native camera stack on
// web, so face tracking is always off there. iOS / Android use
// ./visionFaceLoader.native.ts instead.

import type { VisionFaceModules } from "./faceTracking";

export function loadVisionFace(): VisionFaceModules | null {
  return null;
}
