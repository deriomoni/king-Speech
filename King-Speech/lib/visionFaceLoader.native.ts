// iOS / Android loader for the face-tracking native stack. Kept in a
// `.native.ts` file so the web bundle never references these packages
// (web resolves ./visionFaceLoader.ts, which always returns null).
//
// Every require is guarded: in Expo Go or a build without the modules the
// Nitro hybrid objects don't exist and requiring throws — we return null and
// the Roles screen falls back to expo-camera with the white glyph.

import type { VisionFaceModules } from "./faceTracking";

export function loadVisionFace(): VisionFaceModules | null {
  try {
    // Expo Go ("storeClient") can't contain custom native code — skip quietly
    // instead of letting Nitro log a red error on require.
    const Constants = require("expo-constants").default;
    if (Constants?.executionEnvironment === "storeClient") return null;
  } catch {}
  try {
    const nitro = require("react-native-nitro-modules");
    if (!nitro?.NitroModules) return null;
    const vc = require("react-native-vision-camera");
    // Frame processors are implemented by this package (VisionCamera requires it lazily).
    require("react-native-vision-camera-worklets");
    const fd = require("react-native-vision-camera-face-detector");
    const worklets = require("react-native-worklets");
    const scheduleOnRN = worklets.scheduleOnRN ?? worklets.runOnJS;
    if (!vc?.Camera || !vc?.useCameraDevice || !vc?.useFrameOutput || !vc?.useVideoOutput || !fd?.useFaceDetector || !scheduleOnRN) {
      return null;
    }
    return { vc, fd, scheduleOnRN };
  } catch (e) {
    if (__DEV__) console.log("[faceTracking] native face tracking unavailable:", String(e));
    return null;
  }
}
