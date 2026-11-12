// On-device face tracking for the Roles recording screen.
//
// PRIVACY: detection runs entirely on the phone (Google ML Kit, bundled model).
// Camera frames are handed to ML Kit in the VisionCamera frame processor and
// disposed right after; only a few numbers (box size, centre, head angles)
// reach JS. No frames, images or face data ever leave the device.
//
// The native stack (react-native-vision-camera v5 + -worklets + ML Kit face
// detector, all Nitro modules) exists only in our own EAS dev / production
// builds. In Expo Go and on web it is missing, so everything native is loaded
// lazily behind try/catch and `getVisionFace()` returns null there — callers
// then keep the old expo-camera path with the always-white glyph.

import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import {
  FaceTracker,
  FT,
  type FaceHint,
  type FaceSample,
  type FaceTakeStats,
  type FaceTrackStatus,
} from "./faceTrackingCore";
import { loadVisionFace } from "./visionFaceLoader";

export * from "./faceTrackingCore";

/** The lazily-required native modules. Typed loosely on purpose: the static
 *  type import would also pull the native packages into Expo Go bundles. */
export interface VisionFaceModules {
  vc: any; // react-native-vision-camera
  fd: any; // react-native-vision-camera-face-detector
  scheduleOnRN: (fn: (...args: any[]) => void, ...args: any[]) => void;
}

let _cached: VisionFaceModules | null | undefined;

/** Returns the native modules, or null when they are unavailable (Expo Go, web,
 *  a build without the modules, or any load error). Never throws. */
export function getVisionFace(): VisionFaceModules | null {
  if (_cached !== undefined) return _cached;
  if (Platform.OS === "web") return (_cached = null);
  try {
    _cached = loadVisionFace(); // ./visionFaceLoader.native.ts on iOS / Android
  } catch {
    _cached = null;
  }
  return _cached;
}

export interface FaceTrackingState {
  /** False until the first detection result arrives (or when disabled / stalled). */
  active: boolean;
  status: FaceTrackStatus;
  hint: FaceHint | null;
  /** 0..100, quantised to 5. */
  visibility: number;
}

export interface UseFaceTracking extends FaceTrackingState {
  /** Feed one detection result (called from the frame processor via scheduleOnRN). */
  onSample: (
    present: boolean,
    faces: number,
    sizeRatio: number,
    cx: number,
    cy: number,
    yaw: number,
    pitch: number,
  ) => void;
  /** Start accumulating per-take stats (call when recording starts). */
  startTake: () => void;
  /** Stop and return per-take stats (null when nothing was tracked). */
  endTake: () => FaceTakeStats | null;
  /** Stats of the last finished take. */
  lastTake: FaceTakeStats | null;
}

const STALL_MS = 2000;
const IDLE: FaceTrackingState = { active: false, status: "ok", hint: null, visibility: 100 };

/**
 * Smooths raw detections into a UI state. All math is a few multiplications
 * per sample (~5/s); React state is only set when the visible result changes.
 * If samples stop arriving (processor paused, detector failing) the hook goes
 * back to `active: false`, which the screen renders as the neutral white glyph.
 */
export function useFaceTracking(enabled: boolean): UseFaceTracking {
  const trackerRef = useRef<FaceTracker | null>(null);
  if (trackerRef.current == null) trackerRef.current = new FaceTracker();
  const [state, setState] = useState<FaceTrackingState>(IDLE);
  const stateRef = useRef<FaceTrackingState>(IDLE);
  const lastSampleRef = useRef(0);
  const [lastTake, setLastTake] = useState<FaceTakeStats | null>(null);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const commit = useCallback((next: FaceTrackingState) => {
    const p = stateRef.current;
    if (p.active === next.active && p.status === next.status && p.hint === next.hint && p.visibility === next.visibility) return;
    stateRef.current = next;
    setState(next);
  }, []);

  const onSample = useCallback(
    (present: boolean, faces: number, sizeRatio: number, cx: number, cy: number, yaw: number, pitch: number) => {
      if (!enabledRef.current) return;
      const now = Date.now();
      lastSampleRef.current = now;
      const sample: FaceSample = { present, faces, sizeRatio, cx, cy, yaw, pitch };
      const snap = trackerRef.current!.update(sample, now);
      commit({ active: true, status: snap.status, hint: snap.hint, visibility: snap.visibility });
    },
    [commit],
  );

  // Disabled → reset to neutral. Enabled → watchdog for a stalled processor.
  useEffect(() => {
    if (!enabled) {
      trackerRef.current?.reset();
      commit(IDLE);
      return;
    }
    const id = setInterval(() => {
      if (stateRef.current.active && Date.now() - lastSampleRef.current > STALL_MS) {
        trackerRef.current?.reset();
        commit(IDLE);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [enabled, commit]);

  const startTake = useCallback(() => {
    trackerRef.current?.startTake();
  }, []);

  const endTake = useCallback(() => {
    const s = trackerRef.current?.endTake() ?? null;
    setLastTake(s);
    return s;
  }, []);

  return { ...state, onSample, startTake, endTake, lastTake };
}

/** Exposed for the frame processor (it throttles itself to this interval). */
export const FACE_DETECT_INTERVAL_MS = FT.intervalMs;
