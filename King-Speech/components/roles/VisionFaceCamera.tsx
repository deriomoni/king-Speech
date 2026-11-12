// Selfie camera with on-device face detection (VisionCamera v5 + ML Kit).
//
// Rendered by app/role-stage.tsx ONLY when getVisionFace() returned the native
// modules (own EAS build). It never imports the native packages statically —
// they come in through the `vision` prop — so this file is safe to bundle for
// Expo Go / web as well.
//
// PRIVACY: frames go from the camera straight into ML Kit on this device and
// are disposed immediately; only six numbers per detection reach JS. Nothing
// is uploaded. The recorded video file stays local (same as before).
//
// Exposes the same tiny recording API role-stage already used with
// expo-camera's CameraView: recordAsync() → Promise<{ uri }>, stopRecording().

import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { FACE_DETECT_INTERVAL_MS, type VisionFaceModules } from "@/lib/faceTracking";

export interface FaceCameraHandle {
  recordAsync: () => Promise<{ uri: string } | null>;
  stopRecording: () => void;
}

type SampleFn = (
  present: boolean,
  faces: number,
  sizeRatio: number,
  cx: number,
  cy: number,
  yaw: number,
  pitch: number,
) => void;

interface Props {
  vision: VisionFaceModules;
  /** Session running. False on blur / background → camera + processor stop. */
  isActive: boolean;
  /** Attach the face-detection frame processor. */
  trackFaces: boolean;
  onSample: SampleFn;
  onReady?: () => void;
  /** No front camera / session error before recording → caller falls back to expo-camera. */
  onUnavailable?: (reason: string) => void;
  style?: StyleProp<ViewStyle>;
}

// Module-level constants: the library hooks memoise on object identity.
const DETECTOR_OPTIONS = {
  performanceMode: "fast",
  runLandmarks: false,
  runContours: false,
  runClassifications: false,
  trackingEnabled: false,
  minFaceSize: 0.1,
  cameraFacing: "front",
  autoMode: false,
} as const;
/** Small buffers for detection only (the recording uses its own 1080p output). */
const DETECT_RESOLUTION = { width: 480, height: 640 };
const RECORD_RESOLUTION = { width: 1080, height: 1920 };
const DEVICE_GRACE_MS = 2500;
const noop = () => {};

function toFileUri(path: string): string {
  if (!path) return path;
  return /^[a-z]+:\/\//i.test(path) ? path : `file://${path}`;
}

export const VisionFaceCamera = forwardRef<FaceCameraHandle, Props>(function VisionFaceCamera(
  { vision, isActive, trackFaces, onSample, onReady, onUnavailable, style },
  ref,
) {
  const { vc, fd, scheduleOnRN } = vision;

  const device = vc.useCameraDevice("front");
  const videoOutput = vc.useVideoOutput({ targetResolution: RECORD_RESOLUTION, enableAudio: false });
  const detector = fd.useFaceDetector(DETECTOR_OPTIONS);

  // ---- frame processor: throttled to ~5 fps, everything else is dropped ----
  const onFrame = useCallback(
    (frame: any) => {
      "worklet";
      const g: any = globalThis;
      const now = Date.now();
      if (now - (g.__ksFaceLastTs || 0) < FACE_DETECT_INTERVAL_MS) {
        frame.dispose();
        return;
      }
      g.__ksFaceLastTs = now;
      try {
        const faces = detector.detectFaces(frame);
        const n = faces.length;
        if (n === 0) {
          scheduleOnRN(onSample, false, 0, 0, 0.5, 0.5, 0, 0);
        } else {
          // score the largest face (the performer); others are ignored
          let best = faces[0];
          let bestArea = best.bounds.width * best.bounds.height;
          for (let i = 1; i < n; i++) {
            const a = faces[i].bounds.width * faces[i].bounds.height;
            if (a > bestArea) {
              best = faces[i];
              bestArea = a;
            }
          }
          const b = best.bounds;
          const fw = best.frameWidth || frame.width || 1;
          const fh = best.frameHeight || frame.height || 1;
          scheduleOnRN(
            onSample,
            true,
            n,
            b.height / fh,
            (b.x + b.width / 2) / fw,
            (b.y + b.height / 2) / fh,
            best.yawAngle || 0,
            best.pitchAngle || 0,
          );
        }
      } catch (e) {
        // Detector failure on this frame: skip it. If it keeps failing no
        // samples arrive and the JS watchdog shows the neutral glyph.
      } finally {
        frame.dispose();
      }
    },
    [detector, onSample, scheduleOnRN],
  );

  const frameOutput = vc.useFrameOutput({
    targetResolution: DETECT_RESOLUTION,
    pixelFormat: "yuv", // ML Kit consumes YUV natively — no conversion
    dropFramesWhileBusy: true,
    onFrame,
    onFrameDropped: noop, // drops are expected (we only want ~5 fps)
  });

  const outputs = useMemo(
    () => (trackFaces ? [videoOutput, frameOutput] : [videoOutput]),
    [trackFaces, videoOutput, frameOutput],
  );

  // ---- missing front camera ----
  const unavailableRef = useRef(onUnavailable);
  unavailableRef.current = onUnavailable;
  useEffect(() => {
    if (device) return;
    const t = setTimeout(() => unavailableRef.current?.("no-front-camera"), DEVICE_GRACE_MS);
    return () => clearTimeout(t);
  }, [device]);

  // ---- recording API (mirrors expo-camera's recordAsync / stopRecording) ----
  const recorderRef = useRef<any>(null);
  const stopRequestedRef = useRef(false);
  const recordingRef = useRef(false);

  const stopRecording = useCallback(() => {
    stopRequestedRef.current = true;
    const r = recorderRef.current;
    if (r) r.stopRecording().catch(noop);
  }, []);

  const recordAsync = useCallback(
    () =>
      new Promise<{ uri: string } | null>((resolve, reject) => {
        stopRequestedRef.current = false;
        recordingRef.current = true;
        (async () => {
          try {
            const rec = await videoOutput.createRecorder({});
            recorderRef.current = rec;
            await rec.startRecording(
              (filePath: string) => {
                recordingRef.current = false;
                recorderRef.current = null;
                resolve(filePath ? { uri: toFileUri(filePath) } : null);
              },
              (error: Error) => {
                recordingRef.current = false;
                recorderRef.current = null;
                reject(error);
              },
            );
            // stop was tapped while the recorder was still being created
            if (stopRequestedRef.current) rec.stopRecording().catch(noop);
          } catch (e) {
            recordingRef.current = false;
            recorderRef.current = null;
            reject(e);
          }
        })();
      }),
    [videoOutput],
  );

  useImperativeHandle(ref, () => ({ recordAsync, stopRecording }), [recordAsync, stopRecording]);

  // Release: stop any running recording when the camera unmounts.
  useEffect(
    () => () => {
      const r = recorderRef.current;
      if (r) r.stopRecording().catch(noop);
      recorderRef.current = null;
    },
    [],
  );

  const onError = useCallback((e: Error) => {
    if (__DEV__) console.warn("[VisionFaceCamera] camera error", e);
    // Before a take is running we can still swap to the expo-camera path.
    if (!recordingRef.current) unavailableRef.current?.("camera-error");
  }, []);

  if (!device) return null;

  const Camera = vc.Camera;
  return (
    <Camera
      style={style}
      device={device}
      isActive={isActive}
      outputs={outputs}
      resizeMode="cover"
      onStarted={onReady}
      onError={onError}
    />
  );
});

export default VisionFaceCamera;
