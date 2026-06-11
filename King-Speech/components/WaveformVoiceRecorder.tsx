import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useLang } from "@/context/LangContext";
import WaveformRecorder from "@/components/WaveformRecorder";
import { useWaveformBars } from "@/hooks/useWaveformBars";

let Audio: any = null;
if (Platform.OS !== "web") {
  Audio = require("expo-av").Audio;
}

export type RecordingPhase =
  | "idle"
  | "recording"
  | "paused"
  | "analyzing"
  | "done";

interface RecordingSession {
  id: number;
  mediaRecorder: MediaRecorder | null;
  stream: MediaStream | null;
  chunks: Blob[];
  blob: Blob | null;
  stopPromise: Promise<void> | null;
  resolveStop: (() => void) | null;
}

interface Props {
  /**
   * Called when the user stops recording. `audioBase64` is the recorded
   * audio encoded as base64 (no data: prefix). May be undefined if the mic
   * was unavailable; consumers must handle that gracefully.
   */
  onRecordingComplete: (durationSeconds: number, audioBase64?: string) => void;
  colors: import("@/constants/colors").AppColors;
}

export default function WaveformVoiceRecorder({
  onRecordingComplete,
  colors: _colors,
}: Props) {
  const { lang } = useLang();
  const [phase, setPhase] = useState<RecordingPhase>("idle");

  const [webStream, setWebStream] = useState<MediaStream | null>(null);
  const [nativeRecording, setNativeRecording] = useState<any | null>(null);

  // Each call to startRecording bumps the session id. Promise resolvers and
  // stream handlers are bound to a session so a stale onstop from a previous
  // session can never resolve the active session's stop promise.
  const sessionRef = useRef<RecordingSession | null>(null);
  const sessionCounterRef = useRef(0);

  const recordingRef = useRef<any>(null);
  const audioUriRef = useRef<string | null>(null);

  const isRecording = phase === "recording";
  const isPaused = phase === "paused";

  const { bars, elapsedSeconds, reset } = useWaveformBars({
    isRecording: isRecording || isPaused,
    isPaused,
    recording: nativeRecording,
    webStream,
  });

  useEffect(() => {
    return () => {
      // Final cleanup so the mic isn't left hot when the screen unmounts.
      const s = sessionRef.current;
      try {
        s?.stream?.getTracks().forEach((tr) => tr.stop());
      } catch {}
      try {
        if (s?.mediaRecorder && s.mediaRecorder.state !== "inactive") {
          s.mediaRecorder.stop();
        }
      } catch {}
      sessionRef.current = null;
      if (recordingRef.current) {
        try {
          recordingRef.current.stopAndUnloadAsync?.();
        } catch {}
        recordingRef.current = null;
      }
    };
  }, []);

  // Wait for a specific session's MediaRecorder to flush. Safe to call even
  // if it has already stopped — the resolver will short-circuit.
  const awaitSessionStop = useCallback(
    async (session: RecordingSession | null): Promise<void> => {
      if (!session) return;
      const mr = session.mediaRecorder;
      if (!mr || mr.state === "inactive") return;
      try {
        await Promise.race([
          session.stopPromise ?? Promise.resolve(),
          new Promise<void>((resolve) => setTimeout(resolve, 1500)),
        ]);
      } catch {}
    },
    [],
  );

  const startRecording = useCallback(async () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    reset();
    audioUriRef.current = null;

    if (Platform.OS === "web") {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        // Pick a mimeType the browser actually supports. Without this,
        // `new MediaRecorder(stream)` with no options can fall back to a
        // codec the server's ffmpeg can't parse (or produce no chunks at
        // all in some Chromium-in-iframe situations).
        const candidateMimes = [
          "audio/webm;codecs=opus",
          "audio/webm",
          "audio/ogg;codecs=opus",
          "audio/mp4",
        ];
        let chosenMime: string | undefined;
        for (const m of candidateMimes) {
          if (
            typeof (MediaRecorder as any).isTypeSupported === "function" &&
            (MediaRecorder as any).isTypeSupported(m)
          ) {
            chosenMime = m;
            break;
          }
        }
        const mr = chosenMime
          ? new MediaRecorder(stream, { mimeType: chosenMime })
          : new MediaRecorder(stream);
        console.log(
          "[WaveRec] start mimeType=",
          chosenMime ?? "(default)",
          " actual=",
          mr.mimeType,
        );
        const sessionId = ++sessionCounterRef.current;
        const session: RecordingSession = {
          id: sessionId,
          mediaRecorder: mr,
          stream,
          chunks: [],
          blob: null,
          stopPromise: null,
          resolveStop: null,
        };
        session.stopPromise = new Promise<void>((resolve) => {
          session.resolveStop = resolve;
        });
        mr.ondataavailable = (e) => {
          if (e.data.size > 0) session.chunks.push(e.data);
        };
        mr.onstop = () => {
          // Use the recorder's actual mimeType so we don't relabel an mp4
          // blob as webm and confuse ffmpeg downstream.
          const blobType = mr.mimeType || chosenMime || "audio/webm";
          session.blob = new Blob(session.chunks, { type: blobType });
          console.log(
            "[WaveRec] onstop chunks=",
            session.chunks.length,
            " blobSize=",
            session.blob.size,
            " type=",
            blobType,
          );
          try {
            session.stream?.getTracks().forEach((t) => t.stop());
          } catch {}
          // Resolve only this session's promise — never touch another.
          session.resolveStop?.();
          session.resolveStop = null;
        };
        mr.onerror = (ev: any) => {
          console.warn("[WaveRec] MediaRecorder error", ev?.error ?? ev);
        };
        sessionRef.current = session;
        // Periodic timeslice forces ondataavailable to fire while recording.
        // Some Chromium-in-iframe setups never deliver chunks otherwise.
        mr.start(250);
        setWebStream(stream);
        setPhase("recording");
      } catch (err) {
        console.warn("[WaveRec] Microphone not available on web:", err);
        setPhase("idle");
      }
    } else {
      try {
        await Audio.requestPermissionsAsync();
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });
        const baseOpts = Audio.RecordingOptionsPresets.HIGH_QUALITY;
        const meteringOpts = {
          ...baseOpts,
          isMeteringEnabled: true,
          ios: { ...(baseOpts.ios ?? {}), meteringEnabled: true },
          android: { ...(baseOpts.android ?? {}) },
          web: { ...(baseOpts.web ?? {}) },
        };
        const { recording } = await Audio.Recording.createAsync(meteringOpts);
        recordingRef.current = recording;
        setNativeRecording(recording);
        setPhase("recording");
      } catch (e) {
        console.warn("Recording error:", e);
        setPhase("idle");
      }
    }
  }, [reset]);

  const handlePause = useCallback(async () => {
    if (Platform.OS === "web") {
      try {
        sessionRef.current?.mediaRecorder?.pause();
      } catch {}
    } else {
      try {
        await recordingRef.current?.pauseAsync?.();
      } catch {}
    }
    setPhase("paused");
  }, []);

  const handleResume = useCallback(async () => {
    if (Platform.OS === "web") {
      try {
        sessionRef.current?.mediaRecorder?.resume();
      } catch {}
    } else {
      try {
        await recordingRef.current?.startAsync?.();
      } catch {}
    }
    setPhase("recording");
  }, []);

  const handleRestart = useCallback(async () => {
    // Capture the current session, fully drain it (await onstop), then
    // start a fresh one. This avoids stale callbacks from the old recorder
    // overwriting state owned by the new session.
    const oldSession = sessionRef.current;
    if (Platform.OS === "web") {
      try {
        if (
          oldSession?.mediaRecorder &&
          oldSession.mediaRecorder.state !== "inactive"
        ) {
          oldSession.mediaRecorder.stop();
        }
      } catch {}
      await awaitSessionStop(oldSession);
      try {
        oldSession?.stream?.getTracks().forEach((tr) => tr.stop());
      } catch {}
      sessionRef.current = null;
      setWebStream(null);
    } else {
      try {
        if (recordingRef.current) {
          await recordingRef.current.stopAndUnloadAsync?.();
        }
      } catch {}
      recordingRef.current = null;
      setNativeRecording(null);
    }
    audioUriRef.current = null;
    reset();
    await startRecording();
  }, [awaitSessionStop, reset, startRecording]);

  const handleStop = useCallback(async () => {
    const durationSec = elapsedSeconds;
    setPhase("analyzing");

    let audioBase64: string | undefined;

    if (Platform.OS === "web") {
      const session = sessionRef.current;
      const mr = session?.mediaRecorder ?? null;
      // Ask the recorder to flush a final chunk before we stop it. This is
      // what makes browsers fire one last `ondataavailable` synchronously
      // before the `stop()` transition, so we don't lose the tail.
      try {
        if (mr && mr.state !== "inactive") {
          try {
            (mr as any).requestData?.();
          } catch {}
          mr.stop();
        }
      } catch (e) {
        console.warn("[WaveRec] mr.stop() threw:", e);
      }
      // Give the browser a tick to deliver the final dataavailable event.
      // We do NOT rely on `onstop` firing — some Chromium-in-iframe builds
      // never call it. Wait briefly, then build the blob from chunks
      // ourselves.
      await awaitSessionStop(session);
      await new Promise((r) => setTimeout(r, 80));
      setWebStream(null);

      try {
        // Stop the mic stream ourselves in case onstop never ran.
        try {
          session?.stream?.getTracks().forEach((t) => t.stop());
        } catch {}

        let blob = session?.blob ?? null;
        if (!blob || blob.size === 0) {
          // Fallback: assemble the blob directly from collected chunks.
          // This is the path that fires when `mr.onstop` didn't run.
          const chunks = session?.chunks ?? [];
          if (chunks.length > 0) {
            const blobType =
              mr?.mimeType ||
              (chunks[0] && (chunks[0] as Blob).type) ||
              "audio/webm";
            blob = new Blob(chunks, { type: blobType });
            console.log(
              "[WaveRec] handleStop fallback blob from chunks=",
              chunks.length,
              " size=",
              blob.size,
              " type=",
              blobType,
            );
          }
        }

        if (blob && blob.size > 0) {
          audioBase64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              const result = reader.result as string;
              resolve(result.split(",")[1] ?? "");
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
          console.log(
            "[WaveRec] handleStop blobSize=",
            blob.size,
            " base64Len=",
            audioBase64?.length ?? 0,
          );
        } else {
          console.warn(
            "[WaveRec] handleStop: empty blob (size=",
            blob?.size ?? "null",
            ", chunks=",
            session?.chunks.length ?? 0,
            "). Mic likely produced no audio in this preview.",
          );
        }
      } catch (e) {
        console.warn("[WaveRec] could not read blob", e);
      }
      // Only clear the active session pointer.
      if (sessionRef.current?.id === session?.id) {
        sessionRef.current = null;
      }
    } else {
      try {
        if (recordingRef.current) {
          await recordingRef.current.stopAndUnloadAsync();
          audioUriRef.current = recordingRef.current.getURI?.() ?? null;
          recordingRef.current = null;
        }
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      } catch (e) {
        console.warn("Stop recording error:", e);
      }
      setNativeRecording(null);
      try {
        const uri = audioUriRef.current;
        if (uri) {
          const FileSystem = require("expo-file-system/legacy");
          audioBase64 = await FileSystem.readAsStringAsync(uri, {
            encoding: "base64",
          });
        }
      } catch (e) {
        console.warn("VoiceRecorder: could not read uri", e);
      }
    }

    onRecordingComplete(Math.max(1, durationSec), audioBase64);
    // Reset to idle so a follow-up retry from the parent shows the start pill.
    setPhase("idle");
    reset();
  }, [awaitSessionStop, elapsedSeconds, onRecordingComplete, reset]);

  if (phase === "idle" || phase === "done" || phase === "analyzing") {
    const label = lang === "en" ? "Start recording" : "Начать запись";
    const disabled = phase === "analyzing";
    return (
      <View style={styles.container}>
        <Pressable
          onPress={disabled ? undefined : startRecording}
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityState={{ disabled }}
          testID="voice-recorder-start"
          style={({ pressed }) => [
            styles.startPillWrap,
            { opacity: disabled ? 0.5 : pressed ? 0.9 : 1 },
          ]}
        >
          <LinearGradient
            colors={["#FFD56A", "#F5A623"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[StyleSheet.absoluteFill, { borderRadius: 28 }]}
          />
          <Ionicons name="mic" size={20} color="#1A1A2E" />
          <Text style={styles.startPillText}>{label}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <WaveformRecorder
        isRecording={isRecording}
        isPaused={isPaused}
        elapsedSeconds={elapsedSeconds}
        bars={bars}
        onStop={handleStop}
        onPause={handlePause}
        onResume={handleResume}
        onRestart={handleRestart}
        lang={lang}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    alignItems: "center",
    paddingVertical: 8,
  },
  startPillWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 28,
    overflow: "hidden",
    minWidth: 220,
    justifyContent: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#F5A623",
        shadowOpacity: 0.35,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
      },
      android: { elevation: 5 },
      default: {},
    }),
  },
  startPillText: {
    color: "#1A1A2E",
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    letterSpacing: 0.4,
  },
});
