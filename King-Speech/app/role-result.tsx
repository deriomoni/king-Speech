import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  ScrollView,
} from "react-native";
import { fetch } from "expo/fetch";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  cancelAnimation,
  FadeIn,
  FadeInDown,
  ZoomIn,
  Easing,
} from "react-native-reanimated";
import { useLang } from "@/context/LangContext";
import { useRoles } from "@/context/RolesContext";
import { getRoleById, tx } from "@/constants/rolesData";
import { takeRolePerformance, type RolePerformance } from "@/lib/rolePerformance";
import { getApiUrl } from "@/lib/query-client";

let Video: any = null;
let ResizeMode: any = null;
let AudioMod: any = null;
if (Platform.OS !== "web") {
  try {
    const av = require("expo-av");
    Video = av.Video;
    ResizeMode = av.ResizeMode;
    AudioMod = av.Audio;
  } catch {}
}

const BG = "#0E0A1F";
const BG2 = "#1A1230";
const CARD_BG = "#221838";
const TEXT = "#F5F0FF";
const MUTED = "#A79CC4";

function haptic(style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) {
  if (Platform.OS !== "web") Haptics.impactAsync(style).catch(() => {});
}

interface RoleScore {
  stars: number;
  feedback: string;
  tip?: string;
  metrics: { roleFit: number; emotion: number; clarity: number; confidence: number; grammar: number };
  categories: Record<string, { score: number; label: string }>;
  aiUnavailable?: boolean;
  silent?: boolean;
}

type Stage = "self" | "scanning" | "reveal";

const METRIC_ORDER: (keyof RoleScore["metrics"])[] = ["roleFit", "emotion", "clarity", "confidence", "grammar"];
const METRIC_LABELS: Record<string, { ru: string; en: string; icon: keyof typeof Ionicons.glyphMap }> = {
  roleFit:    { ru: "Соответствие роли", en: "Role fit", icon: "person" },
  emotion:    { ru: "Эмоции", en: "Emotion", icon: "heart" },
  clarity:    { ru: "Чёткость произношения", en: "Diction", icon: "chatbubble-ellipses" },
  confidence: { ru: "Уверенность", en: "Confidence", icon: "shield-checkmark" },
  grammar:    { ru: "Грамматика", en: "Grammar", icon: "book" },
};

export default function RoleResultScreen() {
  const insets = useSafeAreaInsets();
  const { lang } = useLang();
  const { recordRolePlay } = useRoles();

  const perfRef = useRef<RolePerformance | null>(null);
  if (perfRef.current === null) perfRef.current = takeRolePerformance();
  const perf = perfRef.current;
  const role = perf ? getRoleById(perf.roleId) : undefined;

  const [stage, setStage] = useState<Stage>("self");
  const [selfStars, setSelfStars] = useState(0);
  const [score, setScore] = useState<RoleScore | null>(null);
  const [isNew, setIsNew] = useState(false);
  const recordedRef = useRef(false);

  const mountedRef = useRef(true);
  const scanRot = useSharedValue(0);
  const scanStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${scanRot.value}deg` }] }));

  // Local-only playback of the user's own take (watch + listen). Sources stay
  // on-device; only audioBase64 is ever sent to the server (for scoring).
  const [playing, setPlaying] = useState(false);
  const videoRef = useRef<any>(null);
  const soundRef = useRef<any>(null);
  const webAudioRef = useRef<HTMLAudioElement | null>(null);
  const canPlayback = !!(perf?.audioUri || perf?.videoUri);

  const togglePlay = useCallback(async () => {
    if (!perf) return;
    if (Platform.OS === "web") {
      if (!perf.audioUri) return;
      let a = webAudioRef.current;
      if (!a) {
        a = new window.Audio(perf.audioUri);
        a.onended = () => { if (mountedRef.current) setPlaying(false); };
        webAudioRef.current = a;
      }
      if (playing) { a.pause(); setPlaying(false); }
      else { try { a.currentTime = 0; } catch {} a.play().catch(() => {}); setPlaying(true); }
      return;
    }
    try {
      if (playing) {
        try { await soundRef.current?.pauseAsync?.(); } catch {}
        try { await videoRef.current?.pauseAsync?.(); } catch {}
        setPlaying(false);
        return;
      }
      if (!soundRef.current && perf.audioUri && AudioMod) {
        try { await AudioMod.setAudioModeAsync?.({ playsInSilentModeIOS: true }); } catch {}
        const { sound } = await AudioMod.Sound.createAsync({ uri: perf.audioUri }, { shouldPlay: false });
        soundRef.current = sound;
        sound.setOnPlaybackStatusUpdate?.((st: any) => {
          if (st?.didJustFinish && mountedRef.current) setPlaying(false);
        });
      }
      if (videoRef.current) {
        try {
          await videoRef.current.setPositionAsync(0);
          await videoRef.current.playAsync();
          videoRef.current.setOnPlaybackStatusUpdate?.((st: any) => {
            if (st?.didJustFinish && !soundRef.current && mountedRef.current) setPlaying(false);
          });
        } catch {}
      }
      if (soundRef.current) {
        try { await soundRef.current.setPositionAsync(0); await soundRef.current.playAsync(); } catch {}
      }
      if (mountedRef.current) setPlaying(true);
    } catch (e) {
      console.warn("role-result: playback failed", e);
    }
  }, [playing, perf]);

  // Fetch scoring from the server. Falls back internally; the endpoint always
  // returns a usable score even without AI keys.
  const runAnalysis = useCallback(async () => {
    if (!perf || !role) return;
    setStage("scanning");
    scanRot.value = withRepeat(withTiming(360, { duration: 1100, easing: Easing.linear }), -1, false);

    const started = Date.now();
    let result: RoleScore | null = null;
    try {
      const url = new URL("/api/analyze-role", getApiUrl()).toString();
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audioBase64: perf.audioBase64,
          roleTitle: tx(role.title, lang),
          roleScene: tx(role.scene, lang),
          scriptedText: perf.mode === "scripted" ? tx(role.scriptedText, lang) : undefined,
          mode: perf.mode,
          durationSeconds: perf.durationSeconds,
          lang,
        }),
      });
      result = (await res.json()) as RoleScore;
    } catch (e) {
      console.warn("role-result: analysis request failed", e);
    }

    // Keep the scan on screen for a satisfying minimum beat.
    const elapsed = Date.now() - started;
    if (elapsed < 1800) await new Promise((r) => setTimeout(r, 1800 - elapsed));
    cancelAnimation(scanRot);

    if (!mountedRef.current) return; // user navigated away mid-analysis

    if (!result || !result.metrics) {
      result = {
        stars: 2,
        feedback: lang === "en" ? "Great effort in the role!" : "Отличная работа в роли!",
        metrics: { roleFit: 3, emotion: 3, clarity: 3, confidence: 3, grammar: 3 },
        categories: {},
        aiUnavailable: true,
      };
    }

    if (!recordedRef.current) {
      recordedRef.current = true;
      const overall = Math.round((result.stars / 3) * 10);
      const unlocked = recordRolePlay(role.id, overall);
      setIsNew(unlocked);
    }
    setScore(result);
    setStage("reveal");
    haptic(Haptics.ImpactFeedbackStyle.Heavy);
  }, [perf, role, lang, recordRolePlay]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      cancelAnimation(scanRot);
      try { soundRef.current?.unloadAsync?.(); } catch {}
      try { videoRef.current?.pauseAsync?.(); } catch {}
      try { webAudioRef.current?.pause?.(); } catch {}
      try {
        if (Platform.OS === "web" && perf?.audioUri) URL.revokeObjectURL(perf.audioUri);
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!perf || !role) {
    return (
      <View style={[styles.root, { alignItems: "center", justifyContent: "center" }]}>
        <Text style={styles.title}>{lang === "en" ? "Nothing to show" : "Нечего показать"}</Text>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/roles"))} style={styles.secondaryBtn}>
          <Text style={styles.secondaryBtnText}>{lang === "en" ? "Back to roles" : "К ролям"}</Text>
        </Pressable>
      </View>
    );
  }

  const topPad = (Platform.OS === "web" ? 20 : insets.top) + 8;
  const bottomPad = (Platform.OS === "web" ? 20 : insets.bottom) + 20;

  return (
    <View style={styles.root}>
      <LinearGradient colors={[BG2, BG]} style={StyleSheet.absoluteFill} />
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: topPad, paddingBottom: bottomPad }} showsVerticalScrollIndicator={false}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/roles"))} hitSlop={12} style={styles.closeBtn}>
          <Ionicons name="close" size={24} color={TEXT} />
        </Pressable>

        {/* Local video / role preview — watch & listen to your own take. */}
        <View style={styles.previewWrap}>
          {Platform.OS !== "web" && Video && perf.videoUri ? (
            <Video
              ref={videoRef}
              source={{ uri: perf.videoUri }}
              style={StyleSheet.absoluteFill}
              resizeMode={ResizeMode?.COVER ?? "cover"}
              isMuted
              useNativeControls={false}
            />
          ) : (
            <LinearGradient colors={[role.accent + "55", "transparent"]} style={StyleSheet.absoluteFill} />
          )}
          {!(Platform.OS !== "web" && Video && perf.videoUri) && (
            <Text style={styles.previewEmoji}>{role.emoji}</Text>
          )}

          {/* Play / pause the recorded take (video + separate audio). */}
          {canPlayback && (
            <Pressable onPress={togglePlay} style={styles.playOverlay} hitSlop={8}>
              <View style={styles.playCircle}>
                <Ionicons name={playing ? "pause" : "play"} size={30} color="#fff" style={{ marginLeft: playing ? 0 : 3 }} />
              </View>
              <Text style={styles.playHint}>
                {playing
                  ? (lang === "en" ? "Playing your take" : "Играет твой дубль")
                  : (perf.videoUri
                      ? (lang === "en" ? "Watch & listen" : "Смотреть и слушать")
                      : (lang === "en" ? "Listen to your take" : "Послушать себя"))}
              </Text>
            </Pressable>
          )}

          <View style={styles.previewTag}>
            <Text style={styles.previewTagEmoji}>{role.emoji}</Text>
            <Text style={styles.previewTagText}>{tx(role.title, lang)}</Text>
          </View>
          {canPlayback && (
            <View style={styles.localBadge}>
              <Ionicons name="lock-closed" size={11} color="#fff" />
              <Text style={styles.localBadgeText}>{lang === "en" ? "Stays on device" : "Только на устройстве"}</Text>
            </View>
          )}
        </View>

        {/* ---- Self rating ---- */}
        {stage === "self" && (
          <Animated.View entering={FadeInDown} style={styles.block}>
            <Text style={styles.blockTitle}>{lang === "en" ? "How did you do?" : "Как ты сам себя оценишь?"}</Text>
            <Text style={styles.blockSub}>{lang === "en" ? "Rate your own performance first." : "Сначала оцени своё выступление сам."}</Text>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Pressable key={n} onPress={() => { haptic(); setSelfStars(n); }} hitSlop={6}>
                  <Ionicons name={n <= selfStars ? "star" : "star-outline"} size={40} color={n <= selfStars ? "#FFC01E" : "#5A4E7A"} />
                </Pressable>
              ))}
            </View>
            <Pressable
              disabled={selfStars === 0}
              onPress={() => { haptic(Haptics.ImpactFeedbackStyle.Medium); runAnalysis(); }}
              style={({ pressed }) => [styles.primaryBtn, { opacity: selfStars === 0 ? 0.4 : pressed ? 0.9 : 1 }]}
            >
              <LinearGradient colors={["#7AF0FF", "#4DA3FF"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
              <Ionicons name="sparkles" size={20} color="#08243A" />
              <Text style={styles.primaryBtnText}>{lang === "en" ? "Get feedback" : "Оценить"}</Text>
            </Pressable>
          </Animated.View>
        )}

        {/* ---- Scanning ---- */}
        {stage === "scanning" && (
          <Animated.View entering={FadeIn} style={[styles.block, { alignItems: "center", paddingVertical: 40 }]}>
            <Animated.View style={[styles.scanner, scanStyle]}>
              <LinearGradient colors={["#7AF0FF", "transparent"]} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={StyleSheet.absoluteFill} />
            </Animated.View>
            <Ionicons name="scan" size={40} color="#7AF0FF" style={{ position: "absolute", top: 40 }} />
            <Text style={[styles.blockTitle, { marginTop: 20, textAlign: "center" }]}>
              {lang === "en" ? "Analysing your performance..." : "Анализируем твою игру..."}
            </Text>
          </Animated.View>
        )}

        {/* ---- Reveal ---- */}
        {stage === "reveal" && score && (
          <Animated.View entering={FadeInDown}>
            {isNew && (
              <Animated.View entering={ZoomIn.springify().damping(12)} style={styles.unlockBanner}>
                <LinearGradient colors={["#FFDE5C33", "transparent"]} style={StyleSheet.absoluteFill} />
                <Ionicons name="trophy" size={20} color="#FFC01E" />
                <Text style={styles.unlockText}>{lang === "en" ? "New role added to your collection!" : "Новая роль в твоей коллекции!"}</Text>
              </Animated.View>
            )}

            {/* Overall stars */}
            <View style={styles.overallStars}>
              {[1, 2, 3].map((n) => (
                <Animated.View key={n} entering={ZoomIn.delay(n * 120)}>
                  <Ionicons name={n <= score.stars ? "star" : "star-outline"} size={44} color={n <= score.stars ? "#FFC01E" : "#5A4E7A"} />
                </Animated.View>
              ))}
            </View>

            {/* Self-rating recap — reflect the user's own assessment back so the
                input they gave before analysis isn't silently discarded. */}
            {selfStars > 0 && (
              <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, textAlign: "center", marginTop: 4 }}>
                {lang === "en" ? `Your self-rating: ${selfStars}/5` : `Твоя самооценка: ${selfStars}/5`}
              </Text>
            )}

            {/* Metrics */}
            <View style={styles.block}>
              {METRIC_ORDER.map((key, i) => {
                const val = score.metrics[key] ?? 3;
                const meta = METRIC_LABELS[key];
                return <MetricBar key={key} label={lang === "en" ? meta.en : meta.ru} icon={meta.icon} value={val} delay={i * 90} />;
              })}
            </View>

            {/* Feedback */}
            <View style={styles.feedbackCard}>
              <Text style={styles.feedbackText}>{score.feedback}</Text>
              {score.tip && (
                <View style={styles.tipRow}>
                  <Ionicons name="bulb" size={16} color="#FFC01E" />
                  <Text style={styles.tipText}>{score.tip}</Text>
                </View>
              )}
              {score.aiUnavailable && (
                <Text style={styles.aiNote}>
                  {lang === "en" ? "Scoring is offline right now — this is a quick estimate." : "Оценка сейчас недоступна — это быстрая прикидка."}
                </Text>
              )}
            </View>

            {/* Actions */}
            <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/roles"))} style={({ pressed }) => [styles.primaryBtn, { opacity: pressed ? 0.9 : 1 }]}>
              <LinearGradient colors={["#FF7AC4", "#8E5BFF"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
              <Ionicons name="repeat" size={20} color="#fff" />
              <Text style={[styles.primaryBtnText, { color: "#fff" }]}>{lang === "en" ? "Play another role" : "Ещё роль"}</Text>
            </Pressable>
            <Pressable onPress={() => router.replace("/(tabs)")} style={styles.secondaryBtn}>
              <Text style={styles.secondaryBtnText}>{lang === "en" ? "Done" : "Готово"}</Text>
            </Pressable>
          </Animated.View>
        )}
      </ScrollView>
    </View>
  );
}

function MetricBar({ label, icon, value, delay }: { label: string; icon: keyof typeof Ionicons.glyphMap; value: number; delay: number }) {
  const w = useSharedValue(0);
  useEffect(() => {
    w.value = withDelay(delay, withTiming((value / 5) * 100, { duration: 700, easing: Easing.out(Easing.cubic) }));
    return () => cancelAnimation(w);
  }, [value]);
  const barStyle = useAnimatedStyle(() => ({ width: `${w.value}%` }));
  const color = value >= 4 ? "#2ECC71" : value >= 3 ? "#FFC01E" : "#FF7A7A";
  return (
    <View style={styles.metricRow}>
      <View style={styles.metricHead}>
        <Ionicons name={icon} size={15} color={MUTED} />
        <Text style={styles.metricLabel}>{label}</Text>
        <Text style={[styles.metricVal, { color }]}>{value}/5</Text>
      </View>
      <View style={styles.metricTrack}>
        <Animated.View style={[styles.metricFill, barStyle, { backgroundColor: color }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  closeBtn: { alignSelf: "flex-end", width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF12", marginBottom: 8 },
  title: { color: TEXT, fontFamily: "Nunito_800ExtraBold", fontSize: 22, marginBottom: 16 },

  previewWrap: { height: 260, borderRadius: 24, overflow: "hidden", backgroundColor: CARD_BG, alignItems: "center", justifyContent: "center", marginBottom: 18 },
  previewEmoji: { fontSize: 96 },
  playOverlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", gap: 10 },
  playCircle: { width: 68, height: 68, borderRadius: 34, backgroundColor: "rgba(0,0,0,0.45)", borderWidth: 2, borderColor: "rgba(255,255,255,0.85)", alignItems: "center", justifyContent: "center" },
  playHint: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 13, backgroundColor: "rgba(0,0,0,0.4)", paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12, overflow: "hidden" },
  previewTag: { position: "absolute", bottom: 12, left: 12, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#00000066", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16 },
  previewTagEmoji: { fontSize: 16 },
  previewTagText: { color: "#fff", fontFamily: "Nunito_700Bold", fontSize: 14 },
  localBadge: { position: "absolute", top: 12, right: 12, flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#00000077", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14 },
  localBadgeText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 10 },

  block: { backgroundColor: CARD_BG, borderRadius: 22, padding: 20, marginBottom: 16 },
  blockTitle: { color: TEXT, fontFamily: "Nunito_800ExtraBold", fontSize: 20 },
  blockSub: { color: MUTED, fontFamily: "Inter_400Regular", fontSize: 14, marginTop: 6 },
  starsRow: { flexDirection: "row", justifyContent: "center", gap: 10, marginVertical: 22 },

  primaryBtn: { height: 56, borderRadius: 18, overflow: "hidden", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 4 },
  primaryBtnText: { color: "#08243A", fontFamily: "Nunito_800ExtraBold", fontSize: 16 },
  secondaryBtn: { alignItems: "center", paddingVertical: 16, marginTop: 6 },
  secondaryBtnText: { color: MUTED, fontFamily: "Inter_600SemiBold", fontSize: 15 },

  scanner: { width: 120, height: 120, borderRadius: 60, opacity: 0.8 },

  unlockBanner: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#FFC01E1A", borderWidth: 1, borderColor: "#FFC01E55", borderRadius: 16, padding: 14, marginBottom: 16, overflow: "hidden" },
  unlockText: { color: "#FFC01E", fontFamily: "Nunito_800ExtraBold", fontSize: 14, flex: 1 },
  overallStars: { flexDirection: "row", justifyContent: "center", gap: 10, marginBottom: 20 },

  metricRow: { marginBottom: 16 },
  metricHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 7 },
  metricLabel: { color: TEXT, fontFamily: "Inter_600SemiBold", fontSize: 14, flex: 1 },
  metricVal: { fontFamily: "Inter_700Bold", fontSize: 13 },
  metricTrack: { height: 10, borderRadius: 5, backgroundColor: "#0E0A1F", overflow: "hidden" },
  metricFill: { height: "100%", borderRadius: 5 },

  feedbackCard: { backgroundColor: CARD_BG, borderRadius: 22, padding: 20, marginBottom: 16 },
  feedbackText: { color: TEXT, fontFamily: "Inter_400Regular", fontSize: 15, lineHeight: 22 },
  tipRow: { flexDirection: "row", gap: 8, marginTop: 14, backgroundColor: "#FFC01E12", borderRadius: 14, padding: 12 },
  tipText: { color: "#FFE9A8", fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 19, flex: 1 },
  aiNote: { color: MUTED, fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 12, fontStyle: "italic" },
});
