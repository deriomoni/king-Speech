import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  ScrollView,
  PanResponder,
  BackHandler,
  useWindowDimensions,
} from "react-native";
import { fetch } from "expo/fetch";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  cancelAnimation,
  runOnJS,
  FadeIn,
  FadeOut,
  FadeInDown,
  ZoomIn,
  Easing,
} from "react-native-reanimated";
import { useLang } from "@/context/LangContext";
import { useRoles } from "@/context/RolesContext";
import { getRoleById, tx } from "@/constants/rolesData";
import RoleArt from "@/components/roles/RoleArt";
import { takeRolePerformance, type RolePerformance } from "@/lib/rolePerformance";
import { getApiUrl } from "@/lib/query-client";

let AudioMod: any = null;
if (Platform.OS !== "web") {
  try {
    AudioMod = require("@/lib/av").Audio;
  } catch {}
}

/**
 * The front camera preview is mirrored by the OS while you perform, but the
 * file expo-camera writes is not. Playing the raw file back therefore looks
 * flipped compared to the stage the performer just watched, so the take is
 * rendered mirrored to match it. Flip this to false to show the raw framing.
 */
const MIRROR_TAKE = true;

const BG = "#0E0E10"; // main interface dark (brandColors.bg)
const BG2 = "#1A1A1F"; // elevated surface for the subtle backdrop gradient
const CARD_BG = "#221838";
const TEXT = "#F5F0FF";
const MUTED = "#A79CC4";
// Brand accents (theme/tokens): gold = the action you tap, violet = support.
const GOLD = "#FFEDA8";
const GOLD_SOFT = "#FFF4CC";
const ON_GOLD = "#3A2C00";
const VIOLET = "#7C4DFF";
const ON_VIOLET = "#F1EBFF";

const CARD_RADIUS = 24;
const EXPAND_MS = 300;
const COLLAPSE_MS = 260;

function haptic(style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) {
  if (Platform.OS !== "web") Haptics.impactAsync(style).catch(() => {});
}

function clock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
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
  const { width: screenW, height: screenH } = useWindowDimensions();

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

  // ---------------------------------------------------------------------
  // Playback of the user's own take. Everything here stays on the device;
  // only audioBase64 is ever sent to the server (for scoring).
  //
  // The take is two files: a muted video and the audio recorded next to it.
  // The mic is armed a moment before the camera starts writing, so the audio
  // track has a head start on the picture — `syncOffset` is that head start,
  // measured from the two durations, and the audio is played from there so
  // the voice lands on the lips.
  // ---------------------------------------------------------------------
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const soundRef = useRef<any>(null);
  const webAudioRef = useRef<HTMLAudioElement | null>(null);
  const syncOffsetRef = useRef(0);
  const playingRef = useRef(false);
  const lastDriftRef = useRef(0);
  const canPlayback = !!(perf?.audioUri || perf?.videoUri);

  const videoSource = useMemo(
    () => (Platform.OS !== "web" && perf?.videoUri ? { uri: perf.videoUri } : null),
    [perf?.videoUri],
  );
  const hasVideo = !!videoSource;
  const player = useVideoPlayer(videoSource, (p) => {
    try {
      p.loop = false;
      p.muted = true; // the voice comes from the separate audio track
      p.timeUpdateEventInterval = 0.2;
    } catch {}
  });

  const duration = videoDuration || audioDuration || perf?.durationSeconds || 0;

  useEffect(() => { playingRef.current = playing; }, [playing]);

  // Head start of the audio track over the picture.
  useEffect(() => {
    if (audioDuration > 0 && videoDuration > 0) {
      syncOffsetRef.current = Math.min(3, Math.max(0, audioDuration - videoDuration));
    }
  }, [audioDuration, videoDuration]);

  // Load the audio up front so its duration (and therefore the sync offset) is
  // known before the first tap on play.
  useEffect(() => {
    if (Platform.OS === "web" || !perf?.audioUri || !AudioMod) return;
    let cancelled = false;
    (async () => {
      try {
        try { await AudioMod.setAudioModeAsync?.({ playsInSilentModeIOS: true }); } catch {}
        const { sound } = await AudioMod.Sound.createAsync({ uri: perf.audioUri }, { shouldPlay: false });
        if (cancelled) { try { await sound.unloadAsync(); } catch {} return; }
        soundRef.current = sound;
        sound.setOnPlaybackStatusUpdate?.((st: any) => {
          if (!mountedRef.current) return;
          if (st?.durationMillis) setAudioDuration(st.durationMillis / 1000);
          if (st?.didJustFinish) setPlaying(false);
        });
        for (let i = 0; i < 15 && !cancelled; i++) {
          const st = await sound.getStatusAsync();
          if (st?.durationMillis) { if (!cancelled && mountedRef.current) setAudioDuration(st.durationMillis / 1000); break; }
          await new Promise((r) => setTimeout(r, 120));
        }
      } catch (e) {
        console.warn("role-result: audio load failed", e);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perf?.audioUri]);

  // Video duration + playhead, and the drift correction that keeps the voice
  // glued to the picture while both players run on their own clocks.
  useEffect(() => {
    if (!hasVideo || !player) return;
    const subs: any[] = [];
    try {
      subs.push(player.addListener("timeUpdate", ({ currentTime }: any) => {
        if (!mountedRef.current) return;
        setPosition(currentTime);
        const snd = soundRef.current;
        const now = Date.now();
        if (!snd || !playingRef.current || now - lastDriftRef.current < 1000) return;
        lastDriftRef.current = now;
        const targetMs = (currentTime + syncOffsetRef.current) * 1000;
        snd.getStatusAsync?.()
          .then((st: any) => {
            if (!mountedRef.current || !playingRef.current) return;
            if (typeof st?.positionMillis === "number" && Math.abs(st.positionMillis - targetMs) > 300) {
              snd.setPositionAsync?.(targetMs);
            }
          })
          .catch(() => {});
      }));
      subs.push(player.addListener("playToEnd", () => {
        if (!mountedRef.current) return;
        setPlaying(false);
        try { soundRef.current?.pauseAsync?.(); } catch {}
      }));
    } catch {}

    // `duration` is only known once the file is ready — poll briefly for it.
    let tries = 0;
    const id = setInterval(() => {
      tries += 1;
      let d = 0;
      try { d = Number(player.duration) || 0; } catch {}
      if (d > 0) {
        if (mountedRef.current) setVideoDuration(d);
        clearInterval(id);
      } else if (tries > 25) clearInterval(id);
    }, 200);

    return () => {
      clearInterval(id);
      subs.forEach((s) => { try { s?.remove?.(); } catch {} });
    };
  }, [player, hasVideo]);

  // Audio-only takes have no timeUpdate events — poll the sound instead.
  useEffect(() => {
    if (hasVideo || !playing) return;
    const id = setInterval(async () => {
      if (Platform.OS === "web") {
        const a = webAudioRef.current;
        if (a && mountedRef.current) setPosition(a.currentTime || 0);
        return;
      }
      try {
        const st = await soundRef.current?.getStatusAsync?.();
        if (st && mountedRef.current) setPosition((st.positionMillis || 0) / 1000);
      } catch {}
    }, 250);
    return () => clearInterval(id);
  }, [hasVideo, playing]);

  const startAt = useCallback(async (t: number) => {
    if (Platform.OS === "web") {
      const a = webAudioRef.current;
      if (!a) return;
      try { a.currentTime = t; } catch {}
      a.play().catch(() => {});
      return;
    }
    lastDriftRef.current = Date.now();
    try {
      if (soundRef.current) {
        await soundRef.current.setPositionAsync((t + syncOffsetRef.current) * 1000);
      }
    } catch {}
    try {
      if (hasVideo) {
        player.currentTime = t;
        player.play();
      }
    } catch {}
    try { await soundRef.current?.playAsync?.(); } catch {}
  }, [hasVideo, player]);

  const pauseAll = useCallback(() => {
    if (Platform.OS === "web") {
      try { webAudioRef.current?.pause(); } catch {}
      return;
    }
    try { player?.pause(); } catch {}
    try { soundRef.current?.pauseAsync?.(); } catch {}
  }, [player]);

  const togglePlay = useCallback(async () => {
    if (!perf) return;
    if (Platform.OS === "web") {
      if (!perf.audioUri) return;
      let a = webAudioRef.current;
      if (!a) {
        a = new window.Audio(perf.audioUri);
        a.onended = () => { if (mountedRef.current) { setPlaying(false); setPosition(0); } };
        a.onloadedmetadata = () => { if (mountedRef.current) setAudioDuration(a?.duration || 0); };
        webAudioRef.current = a;
      }
      if (playing) { a.pause(); setPlaying(false); }
      else { await startAt(position >= (duration || 0) - 0.15 ? 0 : position); setPlaying(true); }
      return;
    }
    try {
      if (playing) {
        pauseAll();
        setPlaying(false);
        return;
      }
      // Replay from the top once the take has run out.
      const from = duration > 0 && position >= duration - 0.15 ? 0 : position;
      await startAt(from);
      if (mountedRef.current) { setPosition(from); setPlaying(true); }
    } catch (e) {
      console.warn("role-result: playback failed", e);
    }
  }, [playing, perf, position, duration, startAt, pauseAll]);

  const seekTo = useCallback(async (t: number) => {
    const clamped = Math.max(0, Math.min(duration || 0, t));
    setPosition(clamped);
    lastDriftRef.current = Date.now();
    if (Platform.OS === "web") {
      const a = webAudioRef.current;
      if (a) { try { a.currentTime = clamped; } catch {} }
      return;
    }
    try { if (hasVideo) player.currentTime = clamped; } catch {}
    try { await soundRef.current?.setPositionAsync?.((clamped + syncOffsetRef.current) * 1000); } catch {}
  }, [duration, hasVideo, player]);

  // ---------------------------------------------------------------------
  // Fullscreen: the video box grows from the card's own rectangle to the full
  // screen and shrinks straight back into it, so there is no modal snap and no
  // black frame on the way out.
  // ---------------------------------------------------------------------
  const cardRef = useRef<View>(null);
  const [overlayMounted, setOverlayMounted] = useState(false);
  const [videoInOverlay, setVideoInOverlay] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const expand = useSharedValue(0);
  const rect = useSharedValue({ x: 0, y: 0, w: 0, h: 0 });

  const boxStyle = useAnimatedStyle(() => {
    const r = rect.value;
    const t = expand.value;
    return {
      left: r.x + (0 - r.x) * t,
      top: r.y + (0 - r.y) * t,
      width: r.w + (screenW - r.w) * t,
      height: r.h + (screenH - r.h) * t,
      borderRadius: CARD_RADIUS * (1 - t),
    };
  });
  const backdropStyle = useAnimatedStyle(() => ({ opacity: expand.value }));

  const endCollapse = useCallback(() => {
    // Hand the player back to the card first and only drop the overlay a frame
    // later: at this point the two sit on exactly the same rectangle, so the
    // hand-over is invisible instead of flashing an empty card.
    setVideoInOverlay(false);
    setTimeout(() => { if (mountedRef.current) setOverlayMounted(false); }, 80);
  }, []);

  const openFullscreen = useCallback(() => {
    const node = cardRef.current;
    if (!node || !hasVideo) return;
    haptic();
    node.measureInWindow((x: number, y: number, w: number, h: number) => {
      if (!mountedRef.current || !w || !h) return;
      rect.value = { x, y, w, h };
      expand.value = 0;
      setVideoInOverlay(true);
      setOverlayMounted(true);
      setFullscreen(true);
      expand.value = withTiming(1, { duration: EXPAND_MS, easing: Easing.out(Easing.cubic) });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasVideo]);

  const closeFullscreen = useCallback(() => {
    haptic();
    setFullscreen(false);
    expand.value = withTiming(0, { duration: COLLAPSE_MS, easing: Easing.inOut(Easing.cubic) }, (finished) => {
      if (finished) runOnJS(endCollapse)();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endCollapse]);

  useEffect(() => {
    if (!fullscreen || Platform.OS !== "android") return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => { closeFullscreen(); return true; });
    return () => sub.remove();
  }, [fullscreen, closeFullscreen]);

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
      try { player?.pause(); } catch {}
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
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingTop: topPad, paddingBottom: bottomPad }}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!fullscreen}
      >
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/roles"))} hitSlop={12} style={styles.closeBtn}>
          <Ionicons name="close" size={24} color={TEXT} />
        </Pressable>

        {/* The take: video plus the separately recorded audio. */}
        <View ref={cardRef} collapsable={false} style={styles.previewWrap}>
          {hasVideo ? (
            <VideoView
              player={videoInOverlay ? null : player}
              style={[StyleSheet.absoluteFill, MIRROR_TAKE && styles.mirrored]}
              contentFit="cover"
              surfaceType="textureView"
              nativeControls={false}
            />
          ) : (
            <>
              <LinearGradient colors={[role.accent + "55", "transparent"]} style={StyleSheet.absoluteFill} />
              <RoleArt id={role.id} size={220} radius={22} />
            </>
          )}

          {canPlayback && (
            <>
              <Pressable onPress={togglePlay} style={styles.tapLayer}>
                {!playing && position === 0 && (
                  <View style={styles.bigPlay}>
                    <Ionicons name="play" size={30} color={ON_GOLD} style={{ marginLeft: 3 }} />
                  </View>
                )}
              </Pressable>

              {hasVideo && (
                <Pressable onPress={openFullscreen} hitSlop={10} style={styles.glassBtn}>
                  <Ionicons name="expand" size={17} color="#fff" />
                </Pressable>
              )}

              <PlayerBar
                playing={playing}
                position={position}
                duration={duration}
                onToggle={togglePlay}
                onSeek={seekTo}
              />
            </>
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
                  <Ionicons name={n <= selfStars ? "star" : "star-outline"} size={40} color={n <= selfStars ? GOLD : "#5A4E7A"} />
                </Pressable>
              ))}
            </View>
            <Pressable
              disabled={selfStars === 0}
              onPress={() => { haptic(Haptics.ImpactFeedbackStyle.Medium); runAnalysis(); }}
              style={({ pressed }) => [styles.primaryBtn, { opacity: selfStars === 0 ? 0.4 : 1, transform: [{ scale: pressed && selfStars > 0 ? 0.98 : 1 }] }]}
            >
              <LinearGradient colors={[GOLD_SOFT, GOLD]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
              <Ionicons name="sparkles" size={20} color={ON_GOLD} />
              <Text style={styles.primaryBtnText}>{lang === "en" ? "Get feedback" : "Оценить"}</Text>
            </Pressable>
          </Animated.View>
        )}

        {/* ---- Scanning ---- */}
        {stage === "scanning" && (
          <Animated.View entering={FadeIn} style={[styles.block, { alignItems: "center", paddingVertical: 40 }]}>
            <Animated.View style={[styles.scanner, scanStyle]}>
              <LinearGradient colors={[VIOLET, "transparent"]} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={StyleSheet.absoluteFill} />
            </Animated.View>
            <Ionicons name="scan" size={40} color={VIOLET} style={{ position: "absolute", top: 40 }} />
            <Text style={[styles.blockTitle, { marginTop: 20, textAlign: "center" }]}>
              {lang === "en" ? "Analysing your performance..." : "Анализируем твою игру..."}
            </Text>
          </Animated.View>
        )}

        {/* ---- Reveal ---- */}
        {stage === "reveal" && score && (
          <Animated.View entering={FadeInDown}>
            {isNew && (
              <Animated.View entering={ZoomIn.duration(420)} style={styles.unlockBanner}>
                <LinearGradient colors={["#FFEDA833", "transparent"]} style={StyleSheet.absoluteFill} />
                <Ionicons name="trophy" size={20} color={GOLD} />
                <Text style={styles.unlockText}>{lang === "en" ? "New role added to your collection!" : "Новая роль в твоей коллекции!"}</Text>
              </Animated.View>
            )}

            {/* Overall stars */}
            <View style={styles.overallStars}>
              {[1, 2, 3].map((n) => (
                <Animated.View key={n} entering={ZoomIn.delay(n * 120)}>
                  <Ionicons name={n <= score.stars ? "star" : "star-outline"} size={44} color={n <= score.stars ? GOLD : "#5A4E7A"} />
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
                  <Ionicons name="bulb" size={16} color={GOLD} />
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
            <Pressable
              onPress={() => (router.canGoBack() ? router.back() : router.replace("/roles"))}
              style={({ pressed }) => [styles.secondaryActionBtn, { transform: [{ scale: pressed ? 0.98 : 1 }] }]}
            >
              <Ionicons name="repeat" size={20} color={ON_VIOLET} />
              <Text style={styles.secondaryActionText}>{lang === "en" ? "Play another role" : "Ещё роль"}</Text>
            </Pressable>
            <Pressable onPress={() => router.replace("/(tabs)")} style={styles.secondaryBtn}>
              <Text style={styles.secondaryBtnText}>{lang === "en" ? "Done" : "Готово"}</Text>
            </Pressable>
          </Animated.View>
        )}
      </ScrollView>

      {/* Fullscreen take — the same video box, grown out of the card. */}
      {overlayMounted && (
        <View style={StyleSheet.absoluteFill} pointerEvents={fullscreen ? "auto" : "none"}>
          <Animated.View style={[StyleSheet.absoluteFill, styles.fsBackdrop, backdropStyle]} pointerEvents="none" />
          <Animated.View style={[styles.fsBox, boxStyle]} pointerEvents="none">
            <VideoView
              player={videoInOverlay ? player : null}
              style={[StyleSheet.absoluteFill, MIRROR_TAKE && styles.mirrored]}
              contentFit="cover"
              surfaceType="textureView"
              nativeControls={false}
            />
          </Animated.View>

          {fullscreen && (
            <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(120)} style={StyleSheet.absoluteFill}>
              <Pressable style={StyleSheet.absoluteFill} onPress={togglePlay}>
                {!playing && (
                  <View style={styles.fsCenter}>
                    <View style={styles.bigPlay}>
                      <Ionicons name="play" size={34} color={ON_GOLD} style={{ marginLeft: 3 }} />
                    </View>
                  </View>
                )}
              </Pressable>
              <Pressable
                onPress={closeFullscreen}
                hitSlop={12}
                style={[styles.glassBtn, { top: (Platform.OS === "web" ? 20 : insets.top) + 10, right: 16 }]}
              >
                <Ionicons name="contract" size={17} color="#fff" />
              </Pressable>
              <PlayerBar
                playing={playing}
                position={position}
                duration={duration}
                onToggle={togglePlay}
                onSeek={seekTo}
                bottomInset={(Platform.OS === "web" ? 16 : insets.bottom) + 10}
              />
            </Animated.View>
          )}
        </View>
      )}
    </View>
  );
}

/**
 * Transport for the take: play / pause, elapsed + total time and a scrubbable
 * timeline. Rendered over the video, both in the card and in fullscreen.
 */
function PlayerBar({
  playing,
  position,
  duration,
  onToggle,
  onSeek,
  bottomInset = 0,
}: {
  playing: boolean;
  position: number;
  duration: number;
  onToggle: () => void;
  onSeek: (t: number) => void;
  bottomInset?: number;
}) {
  const [trackW, setTrackW] = useState(0);
  // PanResponder is built once, so the live values it needs live in a ref.
  const live = useRef({ trackW: 0, duration: 0, onSeek });
  live.current = { trackW, duration, onSeek };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => seekFromX(e.nativeEvent.locationX),
      onPanResponderMove: (e) => seekFromX(e.nativeEvent.locationX),
    }),
  ).current;

  function seekFromX(x: number) {
    const { trackW: w, duration: d, onSeek: seek } = live.current;
    if (!w || !d) return;
    seek(Math.max(0, Math.min(1, x / w)) * d);
  }

  const pct = duration > 0 ? Math.max(0, Math.min(1, position / duration)) : 0;

  return (
    <View style={[styles.barWrap, { paddingBottom: 12 + bottomInset }]} pointerEvents="box-none">
      <LinearGradient colors={["transparent", "rgba(0,0,0,0.75)"]} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <View style={styles.barRow}>
        <Pressable onPress={onToggle} hitSlop={10} style={styles.barPlay}>
          <Ionicons name={playing ? "pause" : "play"} size={17} color={ON_GOLD} style={{ marginLeft: playing ? 0 : 2 }} />
        </Pressable>
        <Text style={styles.barTime}>{clock(position)}</Text>
        <View
          style={styles.track}
          onLayout={(e) => setTrackW(e.nativeEvent.layout.width)}
          hitSlop={{ top: 14, bottom: 14 }}
          {...pan.panHandlers}
        >
          <View style={styles.trackBase} />
          <View style={[styles.trackFill, { width: `${pct * 100}%` }]} />
          <View style={[styles.knob, { left: Math.max(0, pct * trackW - 6) }]} />
        </View>
        <Text style={styles.barTime}>{clock(duration)}</Text>
      </View>
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
  const color = value >= 4 ? "#2ECC71" : value >= 3 ? GOLD : "#FF7A7A";
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
  title: { color: TEXT, fontFamily: "Geologica_800ExtraBold", fontSize: 22, marginBottom: 16 },

  previewWrap: { height: 300, borderRadius: CARD_RADIUS, overflow: "hidden", backgroundColor: CARD_BG, alignItems: "center", justifyContent: "center", marginBottom: 18 },
  mirrored: { transform: [{ scaleX: -1 }] },
  tapLayer: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" },
  bigPlay: { width: 68, height: 68, borderRadius: 34, backgroundColor: GOLD, alignItems: "center", justifyContent: "center",
    ...Platform.select({ ios: { shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } }, android: { elevation: 6 }, default: {} }) },
  glassBtn: { position: "absolute", top: 12, right: 12, width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.45)", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)" },

  barWrap: { position: "absolute", left: 0, right: 0, bottom: 0, paddingTop: 26, paddingHorizontal: 12 },
  barRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  barPlay: { width: 34, height: 34, borderRadius: 17, backgroundColor: GOLD, alignItems: "center", justifyContent: "center" },
  barTime: { color: "#fff", fontFamily: "Geologica_700Bold", fontSize: 11, minWidth: 30, textAlign: "center", opacity: 0.9 },
  track: { flex: 1, height: 22, justifyContent: "center" },
  trackBase: { height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.28)" },
  trackFill: { position: "absolute", left: 0, height: 4, borderRadius: 2, backgroundColor: GOLD },
  knob: { position: "absolute", width: 12, height: 12, borderRadius: 6, backgroundColor: GOLD, borderWidth: 2, borderColor: "rgba(0,0,0,0.35)" },

  fsBackdrop: { backgroundColor: "#000" },
  fsBox: { position: "absolute", overflow: "hidden", backgroundColor: "#000" },
  fsCenter: { flex: 1, alignItems: "center", justifyContent: "center" },

  block: { backgroundColor: CARD_BG, borderRadius: 22, padding: 20, marginBottom: 16 },
  blockTitle: { color: TEXT, fontFamily: "Geologica_800ExtraBold", fontSize: 20 },
  blockSub: { color: MUTED, fontFamily: "Geologica_400Regular", fontSize: 14, marginTop: 6 },
  starsRow: { flexDirection: "row", justifyContent: "center", gap: 10, marginVertical: 22 },

  primaryBtn: { height: 56, borderRadius: 18, overflow: "hidden", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 4 },
  primaryBtnText: { color: ON_GOLD, fontFamily: "Geologica_800ExtraBold", fontSize: 16 },
  secondaryActionBtn: { height: 56, borderRadius: 18, backgroundColor: VIOLET, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 4 },
  secondaryActionText: { color: ON_VIOLET, fontFamily: "Geologica_800ExtraBold", fontSize: 16 },
  secondaryBtn: { alignItems: "center", paddingVertical: 16, marginTop: 6 },
  secondaryBtnText: { color: MUTED, fontFamily: "Geologica_600SemiBold", fontSize: 15 },

  scanner: { width: 120, height: 120, borderRadius: 60, opacity: 0.8 },

  unlockBanner: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#F2D98F1A", borderWidth: 1, borderColor: "#F2D98F55", borderRadius: 16, padding: 14, marginBottom: 16, overflow: "hidden" },
  unlockText: { color: GOLD, fontFamily: "Geologica_800ExtraBold", fontSize: 14, flex: 1 },
  overallStars: { flexDirection: "row", justifyContent: "center", gap: 10, marginBottom: 20 },

  metricRow: { marginBottom: 16 },
  metricHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 7 },
  metricLabel: { color: TEXT, fontFamily: "Geologica_600SemiBold", fontSize: 14, flex: 1 },
  metricVal: { fontFamily: "Geologica_700Bold", fontSize: 13 },
  metricTrack: { height: 10, borderRadius: 5, backgroundColor: "#0E0A1F", overflow: "hidden" },
  metricFill: { height: "100%", borderRadius: 5 },

  feedbackCard: { backgroundColor: CARD_BG, borderRadius: 22, padding: 20, marginBottom: 16 },
  feedbackText: { color: TEXT, fontFamily: "Geologica_400Regular", fontSize: 15, lineHeight: 22 },
  tipRow: { flexDirection: "row", gap: 8, marginTop: 14, backgroundColor: "#F2D98F12", borderRadius: 14, padding: 12 },
  tipText: { color: "#FFE9A8", fontFamily: "Geologica_400Regular", fontSize: 13, lineHeight: 19, flex: 1 },
  aiNote: { color: MUTED, fontFamily: "Geologica_400Regular", fontSize: 12, marginTop: 12, fontStyle: "italic" },
});
