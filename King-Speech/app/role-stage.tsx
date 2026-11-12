import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  AppState,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "@/lib/haptics";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import Animated, { FadeIn, ZoomIn } from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";
import { CameraView, useCameraPermissions, useMicrophonePermissions } from "expo-camera";
import { useLang } from "@/context/LangContext";
import { getRoleById, tx, type RoleMode } from "@/constants/rolesData";
import { RoleTarotCard, CrownPattern, MONO, ROLES_BG } from "@/components/roles/RoleTarotCard";
import { FaceTrackerIcon, FACE_TRACK_COLORS, type FaceTrackState } from "@/components/roles/FaceTrackerIcon";
import { RolesMaskIcon } from "@/components/showtime/ShowTimeIcons";
import { setRolePerformance } from "@/lib/rolePerformance";
import { getVisionFace, useFaceTracking, FACE_HINT_TEXT } from "@/lib/faceTracking";
import { VisionFaceCamera } from "@/components/roles/VisionFaceCamera";
import { getRoleScenario, lt } from "@/constants/roleScenarios";
import { useRoleScenario, type ScenarioMsg } from "@/hooks/useRoleScenario";
import {
  SceneFeed,
  LiveTopBadge,
  LiveOverlay,
  StageOverlay,
  ScriptPrompter,
  GoalTracker,
} from "@/components/roles/scenes/RoleScene";

/** Minimal recording surface shared by expo-camera's CameraView and VisionFaceCamera. */
type RecordableCamera = {
  recordAsync?: (...args: any[]) => Promise<any> | undefined;
  stopRecording?: () => void;
};

let Audio: any = null;
if (Platform.OS !== "web") {
  Audio = require("@/lib/av").Audio;
}

// Recording screen — Figma "Screen / 09c · Роли · съёмка" (446:2331).
const BG = ROLES_BG;
const TEXT = "#FFFFFF";
const MUTED = "rgba(255,255,255,0.6)";
const REC_RED = "#FF3B30";
const ARC_YELLOW = "#FFD857";
/** The yellow arc around the record button fills over this many seconds (visual only, no auto-stop). */
const ARC_SECONDS = 60;
/** Scenario takes are longer (a full dialogue, ~60–120 s). */
const ARC_SECONDS_SCENARIO = 120;
/** After the scenario's last line, the take stops itself after this many seconds. */
const AUTO_STOP_SECONDS = 6;

function haptic(style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) {
  if (Platform.OS !== "web") Haptics.impactAsync(style).catch(() => {});
}

type Phase = "permission" | "scan" | "ready" | "countdown" | "recording" | "processing";

/** Takes a player gets per scene: the first one plus a single restart. */
const MAX_TAKES = 2;

export default function RoleStageScreen() {
  const insets = useSafeAreaInsets();
  const { lang } = useLang();
  const params = useLocalSearchParams<{ roleId: string; mode: RoleMode; camera?: string }>();
  const role = getRoleById(String(params.roleId));
  const mode: RoleMode = params.mode === "scripted" ? "scripted" : "improv";
  // «С камерой / Только голос» from /role-brief. Voice-only never opens the camera.
  const wantCamera = params.camera !== "0";

  const [camPerm, requestCamPerm] = useCameraPermissions();
  const [micPerm, requestMicPerm] = useMicrophonePermissions();
  const [phase, setPhase] = useState<Phase>("scan");
  const [elapsed, setElapsed] = useState(0);
  const [camReady, setCamReady] = useState(false);
  const [take, setTake] = useState(1);
  const [restarting, setRestarting] = useState(false);

  // --- Scenario (two-sided dialogue, see constants/roleScenarios.ts) ---
  const scenario = getRoleScenario(role?.id);
  const scripted = mode === "scripted";
  const [countdown, setCountdown] = useState(0);
  const [flashKey, setFlashKey] = useState(0);
  const [finishIn, setFinishIn] = useState<number | null>(null);
  const sc = useRoleScenario({
    scenario,
    lang,
    scripted,
    running: phase === "recording" && !restarting,
    onBeat: (m: ScenarioMsg) => {
      haptic(Haptics.ImpactFeedbackStyle.Light);
      if (m.flash) setFlashKey((k) => k + 1);
    },
  });
  // Mic levels → scenario turn-taking. Native: expo-audio metering; web: an AnalyserNode.
  const feedLevelRef = useRef(sc.feedLevel);
  feedLevelRef.current = sc.feedLevel;
  const webMeterRef = useRef<{ ctx: any; timer: ReturnType<typeof setInterval> } | null>(null);
  const stopWebMeter = useCallback(() => {
    const m = webMeterRef.current;
    webMeterRef.current = null;
    if (!m) return;
    clearInterval(m.timer);
    try { m.ctx?.close?.(); } catch {}
  }, []);

  const cameraRef = useRef<RecordableCamera | null>(null);
  const videoUriRef = useRef<string | undefined>(undefined);
  const audioUriRef = useRef<string | undefined>(undefined);
  const recordPromiseRef = useRef<Promise<any> | null>(null);
  const startTimeRef = useRef(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Audio capture refs (native expo-av / web MediaRecorder)
  const nativeRecRef = useRef<any>(null);
  const webChunksRef = useRef<Blob[]>([]);
  const webRecorderRef = useRef<MediaRecorder | null>(null);
  const webStreamRef = useRef<MediaStream | null>(null);

  const hasCam = wantCamera && !!camPerm?.granted;
  const hasMic = micPerm?.granted;

  // Ask permissions on mount.
  useEffect(() => {
    (async () => {
      try {
        if (wantCamera && !camPerm?.granted) await requestCamPerm();
        if (!micPerm?.granted) await requestMicPerm();
      } catch {}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Short "get ready" beat before the record button arms.
  useEffect(() => {
    if (phase !== "scan") return;
    const t = setTimeout(() => setPhase("ready"), 1600);
    return () => clearTimeout(t);
  }, [phase]);

  // --- Face tracking (on-device ML Kit via VisionCamera; see lib/faceTracking.ts) ---
  // Only in our own EAS builds. In Expo Go / web getVisionFace() is null and the
  // screen keeps the expo-camera path with the neutral white glyph.
  const vision = getVisionFace();
  const [visionFailed, setVisionFailed] = useState(false);
  const useVision = hasCam && !!vision && !visionFailed;

  // Pause the camera + frame processor when the screen blurs or the app leaves the foreground.
  const [focused, setFocused] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  const [appActive, setAppActive] = useState(AppState.currentState === "active");
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => setAppActive(s === "active"));
    return () => sub.remove();
  }, []);
  const cameraActive = focused && appActive;

  const tracking = useFaceTracking(useVision && cameraActive && phase !== "processing");
  // adjust → the yellow "turn" glyph; idle (no samples yet / fallback) → white.
  const faceState: FaceTrackState = !tracking.active
    ? "ok"
    : tracking.status === "adjust"
      ? "turn"
      : tracking.status;

  useEffect(() => {
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      try {
        const m = webMeterRef.current;
        if (m) { clearInterval(m.timer); m.ctx?.close?.(); }
      } catch {}
      // cleanup any hot mic / camera on unmount (e.g. navigating away mid-take)
      try { nativeRecRef.current?.stopAndUnloadAsync?.(); } catch {}
      try { webStreamRef.current?.getTracks().forEach((t) => t.stop()); } catch {}
      try {
        if (webRecorderRef.current && webRecorderRef.current.state !== "inactive") webRecorderRef.current.stop();
      } catch {}
      try { cameraRef.current?.stopRecording?.(); } catch {}
      recordPromiseRef.current = null;
    };
  }, []);

  const startAudio = useCallback(async () => {
    if (Platform.OS === "web") {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        webStreamRef.current = stream;
        try {
          const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
          if (Ctx) {
            const ctx = new Ctx();
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 1024;
            ctx.createMediaStreamSource(stream).connect(analyser);
            const buf = new Float32Array(analyser.fftSize);
            const timer = setInterval(() => {
              analyser.getFloatTimeDomainData(buf);
              let sum = 0;
              for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
              feedLevelRef.current(20 * Math.log10(Math.sqrt(sum / buf.length) + 1e-8));
            }, 150);
            webMeterRef.current = { ctx, timer };
          }
        } catch {}
        const mimes = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];
        let chosen: string | undefined;
        for (const m of mimes) {
          if (typeof (MediaRecorder as any).isTypeSupported === "function" && (MediaRecorder as any).isTypeSupported(m)) { chosen = m; break; }
        }
        const mr = chosen ? new MediaRecorder(stream, { mimeType: chosen }) : new MediaRecorder(stream);
        webChunksRef.current = [];
        mr.ondataavailable = (e) => { if (e.data.size > 0) webChunksRef.current.push(e.data); };
        webRecorderRef.current = mr;
        mr.start(250);
      } catch (e) {
        console.warn("role-stage: web mic unavailable", e);
      }
    } else {
      try {
        await Audio.requestPermissionsAsync();
        await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
        const { recording } = await Audio.Recording.createAsync(
          { ...Audio.RecordingOptionsPresets.HIGH_QUALITY, isMeteringEnabled: true },
          (st: any) => {
            if (typeof st?.metering === "number") feedLevelRef.current(st.metering);
          },
          150,
        );
        nativeRecRef.current = recording;
      } catch (e) {
        console.warn("role-stage: native mic unavailable", e);
      }
    }
  }, []);

  const stopAudio = useCallback(async (): Promise<string | undefined> => {
    if (Platform.OS === "web") {
      stopWebMeter();
      const mr = webRecorderRef.current;
      try {
        if (mr && mr.state !== "inactive") {
          // Wait for the recorder to actually flush its final chunk (onstop)
          // rather than guessing with a fixed delay — more reliable on slow browsers.
          await new Promise<void>((resolve) => {
            let settled = false;
            const done = () => { if (!settled) { settled = true; resolve(); } };
            mr.addEventListener("stop", done, { once: true });
            try { (mr as any).requestData?.(); } catch {}
            try { mr.stop(); } catch { done(); }
            setTimeout(done, 1500); // safety net if onstop never fires
          });
        }
      } catch {}
      try { webStreamRef.current?.getTracks().forEach((t) => t.stop()); } catch {}
      const chunks = webChunksRef.current;
      if (!chunks.length) return undefined;
      const type = mr?.mimeType || chunks[0]?.type || "audio/webm";
      const blob = new Blob(chunks, { type });
      if (!blob.size) return undefined;
      try { audioUriRef.current = URL.createObjectURL(blob); } catch {}
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1] ?? "");
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } else {
      try {
        const rec = nativeRecRef.current;
        if (!rec) return undefined;
        await rec.stopAndUnloadAsync();
        const uri = rec.getURI?.();
        nativeRecRef.current = null;
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
        if (!uri) return undefined;
        audioUriRef.current = uri;
        const FileSystem = require("expo-file-system/legacy");
        return await FileSystem.readAsStringAsync(uri, { encoding: "base64" });
      } catch (e) {
        console.warn("role-stage: stop native audio failed", e);
        return undefined;
      }
    }
  }, [stopWebMeter]);

  const startRecording = useCallback(async () => {
    haptic(Haptics.ImpactFeedbackStyle.Heavy);
    setPhase("recording");
    setElapsed(0);
    startTimeRef.current = Date.now();
    tickRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 250);

    // Per-take face stats (no-op until samples arrive; stays empty in the fallback path).
    tracking.startTake();

    // Kick off audio (used for scoring) first.
    await startAudio();

    // Muted local video via camera — stays on the device, preview only.
    if (Platform.OS !== "web" && cameraRef.current && hasCam) {
      try {
        recordPromiseRef.current = cameraRef.current.recordAsync?.() ?? null;
        recordPromiseRef.current
          ?.then((res: any) => { if (res?.uri) videoUriRef.current = res.uri; })
          .catch(() => {});
      } catch (e) {
        console.warn("role-stage: video record failed, continuing audio-only", e);
      }
    }
  }, [startAudio, hasCam, tracking.startTake]);

  const finishRecording = useCallback(async () => {
    haptic(Haptics.ImpactFeedbackStyle.Medium);
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
    const duration = Math.max(1, Math.floor((Date.now() - startTimeRef.current) / 1000));
    const faceStats = tracking.endTake();
    setPhase("processing");

    // Cut both captures as close together as possible. The take is played back
    // as a muted video plus the separately recorded audio track, so any time
    // one of them keeps running alone lands on the result screen as lip-sync
    // drift — hence: stop the camera, stop the mic, and only then wait for the
    // video file to be finalised.
    try {
      if (Platform.OS !== "web") cameraRef.current?.stopRecording?.();
    } catch {}

    const audioBase64 = await stopAudio();

    try {
      if (Platform.OS !== "web" && recordPromiseRef.current) {
        const res = await Promise.race([
          recordPromiseRef.current,
          new Promise((r) => setTimeout(() => r(null), 2500)),
        ]);
        if (res && (res as any).uri) videoUriRef.current = (res as any).uri;
      }
    } catch {}

    setRolePerformance({
      roleId: role?.id ?? String(params.roleId),
      mode,
      durationSeconds: duration,
      audioBase64,
      audioUri: audioUriRef.current,
      videoUri: videoUriRef.current,
      faceStats: faceStats ?? undefined,
      scenario: sc.snapshot(),
    });

    router.replace("/role-result");
  }, [stopAudio, role, params.roleId, mode, tracking.endTake, sc.snapshot]);

  // The scenario's last line has landed → stop the take by itself shortly after.
  const finishRef = useRef(finishRecording);
  finishRef.current = finishRecording;
  useEffect(() => {
    if (phase !== "recording" || !sc.finished || restarting) {
      setFinishIn(null);
      return;
    }
    let n = AUTO_STOP_SECONDS;
    setFinishIn(n);
    const id = setInterval(() => {
      n -= 1;
      if (n <= 0) {
        clearInterval(id);
        setFinishIn(null);
        finishRef.current();
      } else setFinishIn(n);
    }, 1000);
    return () => clearInterval(id);
  }, [phase, sc.finished, restarting]);

  // Throw the current take away without scoring it (the "start over" button).
  const discardTake = useCallback(async () => {
    try {
      if (Platform.OS !== "web" && cameraRef.current) {
        cameraRef.current.stopRecording?.();
        if (recordPromiseRef.current) {
          await Promise.race([
            recordPromiseRef.current,
            new Promise((r) => setTimeout(() => r(null), 2500)),
          ]);
        }
      }
    } catch {}
    recordPromiseRef.current = null;
    videoUriRef.current = undefined;
    tracking.endTake(); // the discarded take's face stats are dropped too

    if (Platform.OS === "web") {
      stopWebMeter();
      const mr = webRecorderRef.current;
      try { if (mr && mr.state !== "inactive") mr.stop(); } catch {}
      try { webStreamRef.current?.getTracks().forEach((t) => t.stop()); } catch {}
      webRecorderRef.current = null;
      webStreamRef.current = null;
      webChunksRef.current = [];
    } else {
      try { await nativeRecRef.current?.stopAndUnloadAsync?.(); } catch {}
      nativeRecRef.current = null;
      try { await Audio.setAudioModeAsync({ allowsRecordingIOS: false }); } catch {}
    }
    audioUriRef.current = undefined;
  }, [tracking.endTake, stopWebMeter]);

  const restartRecording = useCallback(async () => {
    if (restarting || take >= MAX_TAKES) return;
    haptic(Haptics.ImpactFeedbackStyle.Medium);
    setRestarting(true);
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
    setElapsed(0);
    await discardTake();
    // Give the camera session a beat to release before arming it again —
    // recordAsync() right after stopRecording() fails on some devices.
    await new Promise((r) => setTimeout(r, 250));
    setTake((t) => t + 1);
    sc.reset();
    setRestarting(false);
    // Short «3-2-1» so the player can take a breath before take 2 (cancelable).
    setCountdown(3);
    setPhase("countdown");
  }, [restarting, take, discardTake, sc.reset]);

  useEffect(() => {
    if (phase !== "countdown") return;
    haptic(Haptics.ImpactFeedbackStyle.Light);
    const t = setTimeout(() => {
      if (countdown <= 1) startRecording();
      else setCountdown(countdown - 1);
    }, 800);
    return () => clearTimeout(t);
  }, [phase, countdown, startRecording]);

  // --- Missing role guard ---
  if (!role) {
    return (
      <View style={[styles.root, { alignItems: "center", justifyContent: "center" }]}>
        <Text style={styles.errText}>{lang === "en" ? "Role not found" : "Роль не найдена"}</Text>
        <Pressable onPress={() => router.back()} style={styles.errBtn}><Text style={styles.errBtnText}>{lang === "en" ? "Back" : "Назад"}</Text></Pressable>
      </View>
    );
  }

  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");
  const busy = phase === "processing" || phase === "countdown" || restarting;
  const showScene = !!scenario && phase !== "scan" && phase !== "processing";
  const feedMax = Math.round(SH * (scripted ? 0.2 : 0.3));
  const overlayBottom = (Platform.OS === "web" ? 20 : insets.bottom) + 150;
  const faceColor = FACE_TRACK_COLORS[faceState];
  const facePill =
    faceState === "ok"
      ? (lang === "en" ? "Face in frame" : "Лицо в кадре")
      : faceState === "turn"
        ? (tracking.hint
            ? FACE_HINT_TEXT[tracking.hint][lang === "en" ? "en" : "ru"]
            : (lang === "en" ? "Adjust the frame" : "Поправь кадр"))
        : (lang === "en" ? "Face lost" : "Лицо потеряно");

  const onRecordPress = () => {
    if (phase === "ready") startRecording();
    else if (phase === "recording" && !restarting) finishRecording();
  };

  return (
    <View style={styles.root}>
      {/* Full-bleed selfie camera, or the role card for voice-only */}
      {useVision && vision ? (
        <VisionFaceCamera
          ref={cameraRef as any}
          vision={vision}
          style={StyleSheet.absoluteFill}
          isActive={cameraActive}
          trackFaces={phase !== "processing"}
          onSample={tracking.onSample}
          onReady={() => setCamReady(true)}
          onUnavailable={(reason) => {
            console.warn("role-stage: face camera unavailable, using expo-camera", reason);
            setVisionFailed(true);
          }}
        />
      ) : hasCam ? (
        <CameraView
          ref={cameraRef as any}
          style={StyleSheet.absoluteFill}
          facing="front"
          mode="video"
          mute
          videoQuality="1080p"
          active={cameraActive}
          onCameraReady={() => setCamReady(true)}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.voiceBg]}>
          <CrownPattern width={SW} height={SH} />
          <View style={{ transform: [{ rotate: "-2deg" }] }}>
            <RoleTarotCard role={role} width={Math.round(Math.min(SW * 0.5, 220))} lang={lang} />
          </View>
        </View>
      )}

      {/* Top / bottom shades */}
      <LinearGradient pointerEvents="none" colors={["#000000A6", "#00000000"]} style={styles.shadeTop} />
      <LinearGradient pointerEvents="none" colors={["#00000000", "#000000B3"]} style={styles.shadeBottom} />

      {/* Scene overlays: live hearts / stage flashes + side meter */}
      {scenario?.kind === "live" && phase === "recording" && <LiveOverlay hearts={sc.hearts} bottom={overlayBottom} />}
      {scenario?.kind === "stage" && phase === "recording" && (
        <StageOverlay
          variant={scenario.variant}
          flashKey={flashKey}
          mood={sc.mood}
          label={lt(scenario.meterLabel, lang)}
          bottom={overlayBottom}
        />
      )}

      {/* Top bar: close · REC timer */}
      <View style={[styles.topBar, { paddingTop: (Platform.OS === "web" ? 16 : insets.top) + 6 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.closeBtn}>
          <Ionicons name="close" size={24} color="#fff" />
        </Pressable>
        {phase === "recording" && scenario?.kind === "live" ? (
          <LiveTopBadge viewers={sc.viewers} time={`${mm}:${ss}`} />
        ) : phase === "recording" ? (
          <View style={styles.recPill}>
            <View style={styles.recDot} />
            <Text style={styles.recTime}>{mm}:{ss}</Text>
          </View>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      {/* Face tracker (camera mode only) */}
      {hasCam && (
        <Animated.View entering={FadeIn} style={styles.trackerWrap} pointerEvents="none">
          <FaceTrackerIcon size={44} color={faceColor} />
          <View style={styles.facePill}>
            <View style={[styles.faceDot, { backgroundColor: faceState === "ok" ? "#34C759" : faceColor }]} />
            <Text style={styles.facePillText}>{facePill}</Text>
          </View>
        </Animated.View>
      )}

      <View style={{ flex: 1 }} />

      {/* Bottom: (teleprompter) · role chip · controls */}
      <View style={[styles.bottom, { paddingBottom: (Platform.OS === "web" ? 20 : insets.bottom) + 14 }]}>
        {!hasCam && wantCamera && phase !== "scan" && (
          <View style={styles.noCamNote}>
            <Ionicons name="videocam-off" size={14} color={MUTED} />
            <Text style={styles.noCamText}>
              {lang === "en" ? "Camera off — you can still perform with voice." : "Камера выключена — можно играть только голосом."}
            </Text>
          </View>
        )}

        {showScene && scenario && (
          <SceneFeed
            scenario={scenario}
            lang={lang}
            scripted={scripted}
            messages={sc.messages}
            typing={phase === "recording" && sc.typing}
            mood={sc.mood}
            viewers={sc.viewers}
            hearts={sc.hearts}
            speaking={sc.speaking}
            finished={sc.finished}
            awaitingOpening={phase === "recording" && sc.awaitingOpening}
            maxHeight={feedMax}
          />
        )}

        {scripted && scenario && showScene ? (
          <ScriptPrompter
            scenario={scenario}
            lang={lang}
            prompt={sc.prompt}
            awaitingOpening={phase === "recording" ? sc.awaitingOpening : !!scenario.opening}
            typing={phase === "recording" && sc.typing}
            finished={sc.finished}
            maxHeight={Math.round(SH * 0.2)}
          />
        ) : scripted && !scenario ? (
          <View style={styles.prompterCard}>
            <ScrollView style={{ maxHeight: 150 }} showsVerticalScrollIndicator={false}>
              <Text style={styles.prompterText}>{tx(role.scriptedText, lang)}</Text>
            </ScrollView>
          </View>
        ) : null}

        {finishIn != null && (
          <Animated.View entering={FadeIn} style={styles.finishPill}>
            <Ionicons name="flag" size={13} color="#2B2100" />
            <Text style={styles.finishText}>
              {lang === "en" ? `Scene complete · stopping in ${finishIn}` : `Сцена сыграна · стоп через ${finishIn}`}
            </Text>
          </Animated.View>
        )}

        <View style={styles.chipRow}>
          <View style={styles.roleChip}>
            <RolesMaskIcon color="#FFFFFF" width={13} height={18} />
            <Text style={styles.roleChipText} numberOfLines={1}>{tx(role.title, lang).toUpperCase()}</Text>
          </View>
          {scenario && phase === "recording" && <GoalTracker scenario={scenario} goals={sc.goals} lang={lang} />}
        </View>

        {phase === "processing" ? (
          <View style={styles.processing}>
            <ActivityIndicator color={ARC_YELLOW} />
            <Text style={styles.processingText}>{lang === "en" ? "Preparing your take..." : "Готовим твой дубль..."}</Text>
          </View>
        ) : (
          <View style={styles.controls}>
            <View style={styles.sideSlot}>
              {phase === "recording" && (
                <Text style={styles.takeHint}>
                  {take < MAX_TAKES
                    ? (lang === "en" ? `Take ${take}/${MAX_TAKES}` : `Дубль ${take}/${MAX_TAKES}`)
                    : (lang === "en" ? "Last take" : "Последний")}
                </Text>
              )}
            </View>

            <Pressable
              onPress={onRecordPress}
              disabled={busy || phase === "scan"}
              hitSlop={8}
              style={({ pressed }) => [styles.recordBtn, { opacity: phase === "scan" ? 0.5 : 1, transform: [{ scale: pressed ? 0.95 : 1 }] }]}
            >
              <RecordRing progress={phase === "recording" ? Math.min(1, elapsed / (scenario ? ARC_SECONDS_SCENARIO : ARC_SECONDS)) : 0} />
              {phase === "recording" ? <View style={styles.recSquare} /> : <View style={styles.recCircle} />}
            </Pressable>

            {/* Figma shows «Пауза» here; recording can't be paused (expo-camera
                recordAsync has no pause), so this slot keeps the existing
                one-time «Заново» restart. */}
            <View style={styles.sideSlot}>
              {phase === "recording" && take < MAX_TAKES && (
                <Pressable onPress={restartRecording} disabled={restarting} style={{ alignItems: "center", opacity: restarting ? 0.45 : 1 }}>
                  <View style={styles.sideBtn}>
                    <Ionicons name="refresh" size={22} color="#fff" />
                  </View>
                  <Text style={styles.sideLabel}>{lang === "en" ? "Retake" : "Заново"}</Text>
                  <Text style={styles.sideSub}>{lang === "en" ? `take ${take + 1}` : `дубль ${take + 1}`}</Text>
                </Pressable>
              )}
            </View>
          </View>
        )}
      </View>

      {/* «3-2-1» before the retake */}
      {phase === "countdown" && (
        <Animated.View entering={FadeIn.duration(160)} style={styles.countdownWrap}>
          <Text style={styles.countdownKicker}>
            {lang === "en" ? `Take ${take}/${MAX_TAKES}` : `Дубль ${take}/${MAX_TAKES}`}
          </Text>
          <Animated.Text key={countdown} entering={ZoomIn.duration(260)} style={styles.countdownNum}>{countdown}</Animated.Text>
          <Text style={styles.countdownSub}>
            {scenario
              ? (lang === "en" ? "The scene starts from the top" : "Сцена начнётся с начала")
              : (lang === "en" ? "Get ready" : "Приготовься")}
          </Text>
          <Pressable onPress={() => { haptic(); setPhase("ready"); }} hitSlop={10} style={styles.countdownCancel}>
            <Text style={styles.countdownCancelText}>{lang === "en" ? "Not yet" : "Подожду"}</Text>
          </Pressable>
        </Animated.View>
      )}
    </View>
  );
}

const REC = 78;
const RING_R = (REC - 5) / 2;
const RING_C = 2 * Math.PI * RING_R;

function RecordRing({ progress }: { progress: number }) {
  return (
    <Svg width={REC} height={REC} style={{ position: "absolute", top: 0, left: 0 }}>
      <Circle cx={REC / 2} cy={REC / 2} r={RING_R} stroke="#FFFFFF" strokeWidth={4} fill="none" />
      {progress > 0 && (
        <Circle
          cx={REC / 2}
          cy={REC / 2}
          r={RING_R}
          stroke={ARC_YELLOW}
          strokeWidth={4}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${RING_C} ${RING_C}`}
          strokeDashoffset={RING_C * (1 - progress)}
          transform={`rotate(-90 ${REC / 2} ${REC / 2})`}
        />
      )}
    </Svg>
  );
}

const { width: SW, height: SH } = Dimensions.get("window");
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  errText: { color: TEXT, fontFamily: "Geologica_800ExtraBold", fontSize: 20, marginBottom: 16 },
  errBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 16, backgroundColor: "#FFFFFF1A" },
  errBtnText: { color: TEXT, fontFamily: "Geologica_600SemiBold", fontSize: 15 },

  voiceBg: { backgroundColor: BG, alignItems: "center", justifyContent: "center", paddingBottom: 120 },
  shadeTop: { position: "absolute", top: 0, left: 0, right: 0, height: 190 },
  shadeBottom: { position: "absolute", bottom: 0, left: 0, right: 0, height: 320 },

  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 8 },
  closeBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "#00000059" },
  recPill: { flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: "#00000073", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 18 },
  recDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: REC_RED },
  recTime: { color: "#fff", fontFamily: MONO, fontWeight: "700", fontSize: 13 },

  trackerWrap: { alignItems: "center", gap: 10, marginTop: 4 },
  facePill: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#00000073", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  faceDot: { width: 7, height: 7, borderRadius: 4 },
  facePillText: { color: "#fff", fontFamily: "Geologica_600SemiBold", fontSize: 12 },

  bottom: { paddingHorizontal: 18, gap: 14 },
  noCamNote: { flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "center", backgroundColor: "#00000066", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14 },
  noCamText: { color: MUTED, fontFamily: "Geologica_400Regular", fontSize: 12 },

  prompterCard: { backgroundColor: "#000000A6", borderRadius: 18, padding: 16 },
  prompterText: { color: TEXT, fontFamily: "Literata_400Regular", fontSize: 20, lineHeight: 29 },

  roleChip: {
    alignSelf: "flex-start", flexShrink: 1, flexDirection: "row", alignItems: "center", gap: 8, maxWidth: "80%",
    backgroundColor: "#000000B3", paddingHorizontal: 11, paddingVertical: 7, borderRadius: 12,
  },
  roleChipText: { color: "#fff", fontFamily: MONO, fontWeight: "700", fontSize: 12, letterSpacing: 0.5, flexShrink: 1 },

  controls: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 8 },
  sideSlot: { width: 72, alignItems: "center" },
  sideBtn: { width: 50, height: 50, borderRadius: 25, backgroundColor: "rgba(255,255,255,0.22)", alignItems: "center", justifyContent: "center" },
  sideLabel: { color: "#fff", fontFamily: "Geologica_500Medium", fontSize: 11, marginTop: 6 },
  sideSub: { color: MUTED, fontFamily: "Geologica_500Medium", fontSize: 10 },
  chipRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 8 },
  finishPill: {
    alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: ARC_YELLOW,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 14,
  },
  finishText: { color: "#2B2100", fontFamily: "Geologica_700Bold", fontSize: 12 },
  countdownWrap: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.55)", gap: 6,
  },
  countdownKicker: { color: ARC_YELLOW, fontFamily: "Geologica_700Bold", fontSize: 13, letterSpacing: 1.2, textTransform: "uppercase" },
  countdownNum: { color: "#fff", fontFamily: "Geologica_800ExtraBold", fontSize: 120, lineHeight: 132 },
  countdownSub: { color: MUTED, fontFamily: "Geologica_500Medium", fontSize: 14 },
  countdownCancel: { marginTop: 22, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.16)" },
  countdownCancelText: { color: "#fff", fontFamily: "Geologica_600SemiBold", fontSize: 14 },
  takeHint: { color: MUTED, fontFamily: "Geologica_700Bold", fontSize: 11, letterSpacing: 0.6, textTransform: "uppercase" },
  recordBtn: { width: REC, height: REC, alignItems: "center", justifyContent: "center" },
  recCircle: { width: REC - 18, height: REC - 18, borderRadius: (REC - 18) / 2, backgroundColor: REC_RED },
  recSquare: { width: 30, height: 30, borderRadius: 8, backgroundColor: REC_RED },

  processing: { height: REC, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12 },
  processingText: { color: TEXT, fontFamily: "Geologica_600SemiBold", fontSize: 15 },
});
