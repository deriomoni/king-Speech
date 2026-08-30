import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  cancelAnimation,
  FadeIn,
  Easing,
} from "react-native-reanimated";
import { CameraView, useCameraPermissions, useMicrophonePermissions } from "expo-camera";
import { useLang } from "@/context/LangContext";
import { getRoleById, tx, type RoleMode } from "@/constants/rolesData";
import { setRolePerformance } from "@/lib/rolePerformance";

let Audio: any = null;
if (Platform.OS !== "web") {
  Audio = require("expo-av").Audio;
}

const BG = "#0E0E10"; // main interface dark (brandColors.bg)
const TEXT = "#F5F0FF";
const MUTED = "#A79CC4";

function haptic(style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) {
  if (Platform.OS !== "web") Haptics.impactAsync(style).catch(() => {});
}

type Phase = "permission" | "scan" | "ready" | "recording" | "processing";

export default function RoleStageScreen() {
  const insets = useSafeAreaInsets();
  const { lang } = useLang();
  const params = useLocalSearchParams<{ roleId: string; mode: RoleMode }>();
  const role = getRoleById(String(params.roleId));
  const mode: RoleMode = params.mode === "scripted" ? "scripted" : "improv";

  const [camPerm, requestCamPerm] = useCameraPermissions();
  const [micPerm, requestMicPerm] = useMicrophonePermissions();
  const [phase, setPhase] = useState<Phase>("scan");
  const [elapsed, setElapsed] = useState(0);
  const [camReady, setCamReady] = useState(false);

  const cameraRef = useRef<CameraView | null>(null);
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

  // Scan animation
  const scanY = useSharedValue(0);
  const scanStyle = useAnimatedStyle(() => ({ transform: [{ translateY: scanY.value }] }));
  const pulse = useSharedValue(1);
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }], opacity: 2 - pulse.value }));

  const hasCam = camPerm?.granted;
  const hasMic = micPerm?.granted;

  // Ask permissions on mount.
  useEffect(() => {
    (async () => {
      try {
        if (!camPerm?.granted) await requestCamPerm();
        if (!micPerm?.granted) await requestMicPerm();
      } catch {}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Face-scan intro animation, then arm.
  useEffect(() => {
    if (phase !== "scan") return;
    scanY.value = withRepeat(withTiming(180, { duration: 1400, easing: Easing.inOut(Easing.ease) }), -1, true);
    pulse.value = withRepeat(withTiming(1.5, { duration: 1200 }), -1, false);
    const t = setTimeout(() => setPhase("ready"), 2400);
    return () => { clearTimeout(t); cancelAnimation(scanY); cancelAnimation(pulse); };
  }, [phase]);

  useEffect(() => {
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
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
        const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
        nativeRecRef.current = recording;
      } catch (e) {
        console.warn("role-stage: native mic unavailable", e);
      }
    }
  }, []);

  const stopAudio = useCallback(async (): Promise<string | undefined> => {
    if (Platform.OS === "web") {
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
  }, []);

  const startRecording = useCallback(async () => {
    haptic(Haptics.ImpactFeedbackStyle.Heavy);
    setPhase("recording");
    setElapsed(0);
    startTimeRef.current = Date.now();
    tickRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 250);

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
  }, [startAudio, hasCam]);

  const finishRecording = useCallback(async () => {
    haptic(Haptics.ImpactFeedbackStyle.Medium);
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
    const duration = Math.max(1, Math.floor((Date.now() - startTimeRef.current) / 1000));
    setPhase("processing");

    // Stop the muted video (local preview only).
    try {
      if (Platform.OS !== "web" && cameraRef.current) {
        cameraRef.current.stopRecording?.();
        if (recordPromiseRef.current) {
          const res = await Promise.race([
            recordPromiseRef.current,
            new Promise((r) => setTimeout(() => r(null), 2500)),
          ]);
          if (res && (res as any).uri) videoUriRef.current = (res as any).uri;
        }
      }
    } catch {}

    const audioBase64 = await stopAudio();

    setRolePerformance({
      roleId: role?.id ?? String(params.roleId),
      mode,
      durationSeconds: duration,
      audioBase64,
      audioUri: audioUriRef.current,
      videoUri: videoUriRef.current,
    });

    router.replace("/role-result");
  }, [stopAudio, role, params.roleId, mode]);

  // --- Missing role guard ---
  if (!role) {
    return (
      <View style={[styles.root, { alignItems: "center", justifyContent: "center" }]}>
        <Text style={styles.errText}>{lang === "en" ? "Role not found" : "Роль не найдена"}</Text>
        <Pressable onPress={() => router.back()} style={styles.errBtn}><Text style={styles.errBtnText}>{lang === "en" ? "Back" : "Назад"}</Text></Pressable>
      </View>
    );
  }

  const mm = String(Math.floor(elapsed / 60)).padStart(1, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  return (
    <View style={styles.root}>
      {/* Camera / preview backdrop */}
      <View style={StyleSheet.absoluteFill}>
        {hasCam ? (
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            facing="front"
            mode="video"
            mute
            onCameraReady={() => setCamReady(true)}
          />
        ) : (
          <LinearGradient colors={["#241a3d", BG]} style={StyleSheet.absoluteFill} />
        )}
        {/* darken for legibility */}
        <LinearGradient colors={["#00000066", "#00000000", "#000000CC"]} style={StyleSheet.absoluteFill} />
      </View>

      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: (Platform.OS === "web" ? 16 : insets.top) + 6 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.closeBtn}>
          <Ionicons name="close" size={24} color="#fff" />
        </Pressable>
        <View style={styles.roleTag}>
          <Text style={styles.roleTagEmoji}>{role.emoji}</Text>
          <Text style={styles.roleTagText} numberOfLines={1}>{tx(role.title, lang)}</Text>
        </View>
        {phase === "recording" ? (
          <View style={styles.recPill}>
            <View style={styles.recDot} />
            <Text style={styles.recTime}>{mm}:{ss}</Text>
          </View>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      {/* Face-scan overlay */}
      {phase === "scan" && (
        <Animated.View entering={FadeIn} style={styles.scanWrap} pointerEvents="none">
          <View style={styles.scanFrame}>
            <Animated.View style={[styles.pulseRing, pulseStyle]} />
            <Animated.View style={[styles.scanLine, scanStyle]} />
            <View style={[styles.corner, styles.cTL]} />
            <View style={[styles.corner, styles.cTR]} />
            <View style={[styles.corner, styles.cBL]} />
            <View style={[styles.corner, styles.cBR]} />
          </View>
          <Text style={styles.scanText}>{lang === "en" ? "Getting into character..." : "Вживаемся в образ..."}</Text>
        </Animated.View>
      )}

      {/* Flex spacer keeps the bottom card anchored: without it, when the
          scan overlay (flex:1) unmounts the card snaps up under the top bar. */}
      {phase !== "scan" && <View style={{ flex: 1 }} />}

      {/* Bottom content */}
      <View style={[styles.bottom, { paddingBottom: (Platform.OS === "web" ? 24 : insets.bottom) + 18 }]}>
        {!hasCam && phase !== "scan" && (
          <View style={styles.noCamNote}>
            <Ionicons name="videocam-off" size={16} color={MUTED} />
            <Text style={styles.noCamText}>
              {lang === "en" ? "Camera off — you can still perform with voice." : "Камера выключена — можно играть только голосом."}
            </Text>
          </View>
        )}

        {mode === "scripted" ? (
          <View style={styles.prompterCard}>
            <Text style={styles.prompterLabel}>{lang === "en" ? "YOUR LINE" : "ТВОЯ РЕПЛИКА"}</Text>
            <ScrollView style={{ maxHeight: 190 }} showsVerticalScrollIndicator={false}>
              <Text style={styles.prompterText}>{tx(role.scriptedText, lang)}</Text>
            </ScrollView>
          </View>
        ) : (
          <View style={styles.sceneCard}>
            <Text style={styles.prompterLabel}>{lang === "en" ? "THE SCENE" : "СЦЕНА"}</Text>
            <Text style={styles.sceneText}>{tx(role.scene, lang)}</Text>
          </View>
        )}

        {phase === "ready" && (
          <Pressable onPress={startRecording} style={({ pressed }) => [styles.recordBtn, { opacity: pressed ? 0.9 : 1 }]}>
            <LinearGradient colors={["#FF6B6B", "#E8384F"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
            <Ionicons name="mic" size={22} color="#fff" />
            <Text style={styles.recordBtnText}>{lang === "en" ? "Start performing" : "Начать выступление"}</Text>
          </Pressable>
        )}

        {phase === "recording" && (
          <Pressable onPress={finishRecording} style={({ pressed }) => [styles.stopBtn, { opacity: pressed ? 0.9 : 1 }]}>
            <View style={styles.stopSquare} />
            <Text style={styles.stopBtnText}>{lang === "en" ? "Finish" : "Готово"}</Text>
          </Pressable>
        )}

        {phase === "processing" && (
          <View style={styles.processing}>
            <ActivityIndicator color="#FFC01E" />
            <Text style={styles.processingText}>{lang === "en" ? "Preparing your take..." : "Готовим твой дубль..."}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const FRAME = 220;
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  errText: { color: TEXT, fontFamily: "Nunito_800ExtraBold", fontSize: 20, marginBottom: 16 },
  errBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 16, backgroundColor: "#FFFFFF1A" },
  errBtnText: { color: TEXT, fontFamily: "Nunito_600SemiBold", fontSize: 15 },

  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 10 },
  closeBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "#00000055" },
  roleTag: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#00000055", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 18, maxWidth: 200 },
  roleTagEmoji: { fontSize: 15 },
  roleTagText: { color: "#fff", fontFamily: "Nunito_700Bold", fontSize: 13, flexShrink: 1 },
  recPill: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#E8384FCC", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 18 },
  recDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#fff" },
  recTime: { color: "#fff", fontFamily: "Nunito_700Bold", fontSize: 13 },

  scanWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 20 },
  scanFrame: { width: FRAME, height: FRAME, borderRadius: 28, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  pulseRing: { position: "absolute", width: FRAME * 0.7, height: FRAME * 0.7, borderRadius: FRAME, borderWidth: 2, borderColor: "#8E5BFF" },
  scanLine: { position: "absolute", top: 0, width: FRAME, height: 3, backgroundColor: "#7AF0FF", shadowColor: "#7AF0FF", shadowOpacity: 1, shadowRadius: 8 },
  corner: { position: "absolute", width: 30, height: 30, borderColor: "#7AF0FF" },
  cTL: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 12 },
  cTR: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 12 },
  cBL: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 12 },
  cBR: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 12 },
  scanText: { color: "#fff", fontFamily: "Nunito_800ExtraBold", fontSize: 18 },

  bottom: { paddingHorizontal: 18, gap: 14 },
  noCamNote: { flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "center", backgroundColor: "#00000066", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14 },
  noCamText: { color: MUTED, fontFamily: "Nunito_400Regular", fontSize: 12 },

  prompterCard: { backgroundColor: "#0B0718D9", borderRadius: 20, padding: 18, borderWidth: 1, borderColor: "#6C5CE740" },
  sceneCard: { backgroundColor: "#0B0718D9", borderRadius: 20, padding: 18, borderWidth: 1, borderColor: "#E8439340" },
  prompterLabel: { color: "#FFC01E", fontFamily: "Nunito_700Bold", fontSize: 11, letterSpacing: 1.5, marginBottom: 8 },
  prompterText: { color: TEXT, fontFamily: "Literata_400Regular", fontSize: 22, lineHeight: 32 },
  sceneText: { color: TEXT, fontFamily: "Nunito_700Bold", fontSize: 20, lineHeight: 28 },

  recordBtn: { height: 60, borderRadius: 20, overflow: "hidden", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    ...Platform.select({ ios: { shadowColor: "#E8384F", shadowOpacity: 0.5, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } }, android: { elevation: 8 }, default: {} }) },
  recordBtnText: { color: "#fff", fontFamily: "Nunito_800ExtraBold", fontSize: 17 },
  stopBtn: { height: 60, borderRadius: 20, backgroundColor: "#fff", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12 },
  stopSquare: { width: 18, height: 18, borderRadius: 4, backgroundColor: "#E8384F" },
  stopBtnText: { color: "#1A1230", fontFamily: "Nunito_800ExtraBold", fontSize: 17 },
  processing: { height: 60, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12 },
  processingText: { color: TEXT, fontFamily: "Nunito_600SemiBold", fontSize: 15 },
});
