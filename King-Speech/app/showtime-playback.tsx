import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  Dimensions,
  ScrollView,
  ActivityIndicator,
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, router, useNavigation } from "expo-router";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  withSpring,
  withDelay,
  cancelAnimation,
  FadeIn,
  FadeInUp,
  FadeInDown,
  ZoomIn,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useGame, getRankForSection } from "@/context/GameContext";
import { useLang } from "@/context/LangContext";
import { getApiUrl } from "@/lib/query-client";
import { playSfx } from "@/lib/sfx";
import { getLevelsData } from "@/constants/gameContent";
import SpeechAnalyzingLoader from "@/components/SpeechAnalyzingLoader";
import ScoreFlower, { aspectsFromMetrics5 } from "@/components/ScoreFlower";

let Audio: any = null;
if (Platform.OS !== "web") {
  Audio = require("expo-av").Audio;
}

const { width: SW } = Dimensions.get("window");

// ── SPEAKER AVATAR ────────────────────────────────────────────────────────────
function SpeakerAvatar() {
  const breathe = useSharedValue(1);
  const sway = useSharedValue(0);
  const armLeft = useSharedValue(0);

  useEffect(() => {
    breathe.value = withRepeat(withTiming(1.015, { duration: 2200 }), -1, true);
    sway.value = withRepeat(withSequence(
      withTiming(1.5, { duration: 3000 }),
      withTiming(-1.5, { duration: 3000 })
    ), -1, true);
    const gestureLoop = () => {
      setTimeout(() => {
        armLeft.value = withSequence(withTiming(-18, { duration: 600 }), withTiming(0, { duration: 600 }));
        gestureLoop();
      }, Math.random() * 4000 + 3000);
    };
    gestureLoop();
    return () => { cancelAnimation(breathe); cancelAnimation(sway); cancelAnimation(armLeft); };
  }, []);

  const bodyStyle = useAnimatedStyle(() => ({ transform: [{ scale: breathe.value }, { rotate: `${sway.value}deg` }] }));
  const armLStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${armLeft.value}deg` }] }));
  const DARK = "#1A1A2E";

  return (
    <Animated.View style={[bodyStyle, { alignItems: "center" }]}>
      <View style={{ position: "relative", alignItems: "center" }}>
        <View style={{ position: "absolute", width: 52, height: 52, borderRadius: 26, backgroundColor: "rgba(255,240,100,0.2)", top: -6 }} />
        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: DARK, borderWidth: 2, borderColor: "rgba(255,220,80,0.3)" }} />
      </View>
      <View style={{ width: 10, height: 8, backgroundColor: DARK }} />
      <View style={{ width: 52, height: 56, backgroundColor: DARK, borderRadius: 10, borderTopLeftRadius: 14, borderTopRightRadius: 14 }}>
        <View style={{ position: "absolute", top: 4, left: 10, width: 12, height: 24, borderRadius: 6, backgroundColor: "rgba(255,220,80,0.08)" }} />
        <View style={{ position: "absolute", top: 4, right: 10, width: 12, height: 24, borderRadius: 6, backgroundColor: "rgba(255,220,80,0.08)" }} />
      </View>
      <Animated.View style={[armLStyle, { position: "absolute", top: 46, left: -22, width: 14, height: 42, backgroundColor: DARK, borderRadius: 7, transformOrigin: "top" }]} />
      <View style={{ position: "absolute", top: 46, right: -22, width: 14, height: 42, backgroundColor: DARK, borderRadius: 7 }} />
      <View style={{ flexDirection: "row", gap: 6, marginTop: 2 }}>
        <View style={{ width: 20, height: 32, backgroundColor: DARK, borderRadius: 6 }} />
        <View style={{ width: 20, height: 32, backgroundColor: DARK, borderRadius: 6 }} />
      </View>
      <View style={{ flexDirection: "row", gap: 8, marginTop: 1 }}>
        <View style={{ width: 22, height: 8, backgroundColor: DARK, borderRadius: 4 }} />
        <View style={{ width: 22, height: 8, backgroundColor: DARK, borderRadius: 4 }} />
      </View>
    </Animated.View>
  );
}

// ── STAGE SCENE ───────────────────────────────────────────────────────────────
function StageScene() {
  const spotlight1 = useSharedValue(1);
  const spotlight2 = useSharedValue(0.7);
  const flashVal = useSharedValue(0.25);

  useEffect(() => {
    spotlight1.value = withRepeat(withSequence(
      withTiming(0.88, { duration: 100 }), withTiming(1, { duration: 150 }), withTiming(0.95, { duration: 80 }), withTiming(1, { duration: 250 })
    ), -1, false);
    spotlight2.value = withRepeat(withTiming(0.5, { duration: 1800 }), -1, true);
    const flashLoop = () => {
      setTimeout(() => {
        flashVal.value = withSequence(withTiming(0.8, { duration: 60 }), withTiming(0.25, { duration: 350 }));
        flashLoop();
      }, Math.random() * 5000 + 3000);
    };
    flashLoop();
    return () => { cancelAnimation(spotlight1); cancelAnimation(spotlight2); cancelAnimation(flashVal); };
  }, []);

  const sp1Style = useAnimatedStyle(() => ({ opacity: spotlight1.value }));
  const sp2Style = useAnimatedStyle(() => ({ opacity: spotlight2.value }));
  const flashStyle = useAnimatedStyle(() => ({ opacity: flashVal.value }));

  return (
    <View style={ss.container}>
      <LinearGradient colors={["#0D1520", "#08101A"]} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
      <LinearGradient colors={["#2A0E3A", "#1A0828"]} style={[ss.curtain, { left: 0, borderBottomRightRadius: 12 }]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} />
      <LinearGradient colors={["#1A0828", "#2A0E3A"]} style={[ss.curtain, { right: 0, borderBottomLeftRadius: 12 }]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} />
      <Animated.View style={[ss.spotlightCone, { left: SW * 0.32, right: SW * 0.32, pointerEvents: "none" }, sp1Style]}>
        <LinearGradient colors={["rgba(255,240,100,0.6)", "rgba(255,220,60,0.2)", "rgba(255,200,30,0.04)", "transparent"]} style={StyleSheet.absoluteFill} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} />
      </Animated.View>
      <Animated.View style={[ss.spotlightCone, { left: SW * 0.1, width: SW * 0.25, pointerEvents: "none" }, sp2Style]}>
        <LinearGradient colors={["rgba(100,140,255,0.3)", "rgba(80,100,220,0.08)", "transparent"]} style={StyleSheet.absoluteFill} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} />
      </Animated.View>
      <Animated.View style={[ss.flashOverlay, { pointerEvents: "none" }, flashStyle]}>
        <LinearGradient colors={["rgba(255,255,200,0.9)", "transparent"]} style={StyleSheet.absoluteFill} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} />
      </Animated.View>
      <LinearGradient colors={["transparent", "rgba(255,220,60,0.12)", "rgba(255,200,30,0.05)"]} style={ss.floorGlow} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} />
      <View style={ss.avatarPosition}>
        <SpeakerAvatar />
        <View style={ss.avatarShadow} />
      </View>
      <View style={ss.stageEdge} />
    </View>
  );
}

const ss = StyleSheet.create({
  container: { width: "100%", height: 260, overflow: "hidden", position: "relative" },
  curtain: { position: "absolute", top: 0, bottom: 0, width: 36 },
  spotlightCone: { position: "absolute", top: 0, height: "100%" },
  flashOverlay: { position: "absolute", top: 0, left: SW * 0.2, right: SW * 0.2, height: 60, borderRadius: 30 },
  floorGlow: { position: "absolute", bottom: 0, left: 36, right: 36, height: 100 },
  avatarPosition: { position: "absolute", bottom: 30, left: 0, right: 0, alignItems: "center" },
  avatarShadow: { width: 50, height: 8, borderRadius: 25, backgroundColor: "rgba(0,0,0,0.5)", marginTop: 2 },
  stageEdge: { position: "absolute", bottom: 20, left: 36, right: 36, height: 3, backgroundColor: "rgba(255,209,102,0.15)", borderRadius: 2 },
});

// ── SEAT HEAD ─────────────────────────────────────────────────────────────────
interface SeatDef { x: number; y: number; headR: number; color: string; delayMs: number; }

function SeatHead({ x, y, headR, color, delayMs }: SeatDef) {
  const sway = useSharedValue(0);
  useEffect(() => {
    sway.value = withDelay(delayMs, withRepeat(withTiming(Math.random() > 0.5 ? 2 : -2, { duration: 2500 + Math.random() * 2000 }), -1, true));
    return () => cancelAnimation(sway);
  }, []);
  const swayStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${sway.value}deg` }] }));
  return (
    <Animated.View style={[swayStyle, { position: "absolute", left: x, top: y, alignItems: "center" }]}>
      <View style={{ width: headR * 2, height: headR * 2, borderRadius: headR, backgroundColor: color }} />
      <View style={{ width: headR * 2.8, height: headR * 1.4, backgroundColor: color, borderTopLeftRadius: headR * 0.8, borderTopRightRadius: headR * 0.8, marginTop: 2 }} />
    </Animated.View>
  );
}

function AudienceSeats() {
  const ROW_DEFS = [
    { y: 0, count: 8, headR: 14, gap: 38, color: "#141E30" },
    { y: 36, count: 6, headR: 12, gap: 44, color: "#0F1828" },
    { y: 66, count: 5, headR: 10, gap: 50, color: "#0A1220" },
  ];
  const seats: SeatDef[] = [];
  let pi = 0;
  for (const row of ROW_DEFS) {
    const totalW = row.count * row.gap;
    const startX = (SW - totalW) / 2 + row.headR;
    for (let i = 0; i < row.count; i++) {
      seats.push({ x: startX + i * row.gap - row.headR, y: row.y, headR: row.headR, color: row.color, delayMs: pi++ * 180 });
    }
  }
  return (
    <View style={{ width: SW, height: 110, position: "relative" }}>
      {seats.map((s, i) => <SeatHead key={i} {...s} />)}
    </View>
  );
}

// ── WAVE BAR ─────────────────────────────────────────────────────────────────
function WaveBar({ index, isPlaying, progress }: { index: number; isPlaying: boolean; progress: number }) {
  const height = useSharedValue(4);
  const GOLD = "#FFD166";
  const BORDER = "#2A3348";
  useEffect(() => {
    if (isPlaying) {
      height.value = withRepeat(withTiming(Math.random() * 22 + 4, { duration: 200 + index * 30 }), -1, true);
    } else {
      cancelAnimation(height);
      height.value = withTiming(4);
    }
  }, [isPlaying]);
  const style = useAnimatedStyle(() => ({ height: height.value }));
  return <Animated.View style={[style, { width: 3, borderRadius: 2, minHeight: 4, backgroundColor: index / 20 <= progress ? GOLD : BORDER }]} />;
}

// ── AUDIO PLAYER ──────────────────────────────────────────────────────────────
function AudioPlayer({ uri, onPlaybackComplete }: { uri: string; onPlaybackComplete?: () => void }) {
  const { t } = useLang();
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const soundRef = useRef<any>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const t = setTimeout(() => handlePlay(), 1800);
    return () => {
      clearTimeout(t);
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (Platform.OS === "web") audioElRef.current?.pause();
      else soundRef.current?.unloadAsync();
    };
  }, []);

  const handlePlay = async () => {
    if (!uri) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isPlaying) {
      if (Platform.OS === "web") audioElRef.current?.pause();
      else await soundRef.current?.pauseAsync();
      setIsPlaying(false);
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    if (Platform.OS === "web") {
      if (!audioElRef.current) {
        const audio = new window.Audio(uri);
        audioElRef.current = audio;
        audio.ondurationchange = () => setDuration(Math.round(audio.duration));
        audio.onended = () => { setIsPlaying(false); setPosition(0); if (intervalRef.current) clearInterval(intervalRef.current); onPlaybackComplete?.(); };
      }
      audioElRef.current.play();
      setIsPlaying(true);
      intervalRef.current = setInterval(() => setPosition(Math.round(audioElRef.current?.currentTime ?? 0)), 500);
    } else {
      try {
        if (soundRef.current) {
          await soundRef.current.playAsync();
          setIsPlaying(true);
        } else {
          const { sound } = await Audio.Sound.createAsync({ uri }, { shouldPlay: true });
          soundRef.current = sound;
          const status = await sound.getStatusAsync();
          if (status.isLoaded) setDuration(Math.round((status.durationMillis ?? 0) / 1000));
          sound.setOnPlaybackStatusUpdate((st: any) => {
            if (st.isLoaded) {
              setPosition(Math.round(st.positionMillis / 1000));
              if (st.didJustFinish) { setIsPlaying(false); setPosition(0); onPlaybackComplete?.(); }
            }
          });
          setIsPlaying(true);
        }
      } catch (e) { console.warn("Playback error:", e); }
    }
  };

  const fmt = (s: number) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
  const progress = duration > 0 ? position / duration : 0;

  return (
    <View style={[ap.container, { borderColor: "#2A3348" }]}>
      <View style={ap.row}>
        <Pressable onPress={handlePlay} disabled={!uri} style={({ pressed }) => [ap.playBtn, { backgroundColor: !uri ? "#2A3348" : "#0B1426", opacity: pressed ? 0.85 : 1 }]}>
          <Ionicons name={isPlaying ? "pause" : "play"} size={22} color="#FFD166" />
        </Pressable>
        <View style={ap.waveform}>
          {Array.from({ length: 20 }).map((_, i) => (
            <WaveBar key={i} index={i} isPlaying={isPlaying} progress={progress} />
          ))}
        </View>
        <Text style={[ap.time, { color: "#6B6880", fontFamily: "Inter_400Regular" }]}>
          {fmt(position)}{duration > 0 ? ` / ${fmt(duration)}` : ""}
        </Text>
      </View>
      <View style={[ap.progressBg, { backgroundColor: "#2A3348" }]}>
        <View style={[ap.progressFill, { backgroundColor: "#FFD166", width: `${progress * 100}%` as any }]} />
      </View>
      {!uri && (
        <Text style={{ fontSize: 12, color: "#6B6880", textAlign: "center", fontFamily: "Inter_400Regular" }}>
          {t("recordingNotSaved")}
        </Text>
      )}
    </View>
  );
}

const ap = StyleSheet.create({
  container: { borderRadius: 16, borderWidth: 1, overflow: "hidden", padding: 14, gap: 10 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  playBtn: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  waveform: { flex: 1, flexDirection: "row", alignItems: "center", gap: 2, height: 32 },
  time: { fontSize: 12, minWidth: 50, textAlign: "right" },
  progressBg: { height: 3, borderRadius: 2, overflow: "hidden" },
  progressFill: { height: 3, borderRadius: 2 },
});

// ── STAR COMPONENT ────────────────────────────────────────────────────────────
function AnimatedStar({ filled, delay }: { filled: boolean; delay: number }) {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);
  useEffect(() => {
    scale.value = withDelay(delay, withSpring(1, { damping: 10, stiffness: 200 }));
    opacity.value = withDelay(delay, withTiming(1, { duration: 200 }));
  }, []);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }], opacity: opacity.value }));
  return (
    <Animated.View style={[style, { alignItems: "center", justifyContent: "center" }]}>
      <Ionicons name={filled ? "star" : "star-outline"} size={40} color={filled ? "#FFD166" : "#2A3348"} />
    </Animated.View>
  );
}

// (Per-aspect bars replaced by the ScoreFlower petals.)

// ── AI ANALYSIS CARD ──────────────────────────────────────────────────────────
interface AnalysisResult {
  stars: number;
  score: number;
  silent: boolean;
  feedback: string;
  categories?: {
    diction: { score: number; label: string };
    expressiveness: { score: number; label: string };
    voice: { score: number; label: string };
    confidence: { score: number; label: string };
  };
  // Per-metric weakness scores (1-5) keyed by canonical names used for tips.
  // Includes tempo + pauses on top of the four headline categories.
  metrics?: {
    clarity: number;
    expressiveness: number;
    volume: number;
    confidence: number;
    tempo: number;
    pauses: number;
  };
  errors?: string[];
  /** Personal coaching tip from the server, derived from the weakest criterion. */
  tip?: string;
}

function AnalysisCard({ result, t, lang }: { result: AnalysisResult | null; t: (key: any) => string; lang: "ru" | "en" }) {
  if (!result) return null;
  const { stars, score, silent, feedback, categories, metrics, errors, tip } = result;

  if (silent || stars === 0) {
    return (
      <Animated.View entering={FadeInUp.delay(100).duration(500)} style={[ac.card, { borderColor: "#0EA5E944" }]}>
        <LinearGradient colors={["#0EA5E908", "transparent"]} style={StyleSheet.absoluteFill} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} />
        <Text style={[ac.label, { color: "#0EA5E9", fontFamily: "Inter_600SemiBold" }]}>{t("notCounted")}</Text>
        <View style={ac.starsRow}>
          {[1, 2, 3].map((n) => <AnimatedStar key={n} filled={false} delay={n * 150} />)}
        </View>
        <Animated.Text entering={FadeIn.delay(500).duration(400)} style={[ac.feedback, { color: "rgba(240,80,80,0.9)", fontFamily: "Inter_500Medium", textAlign: "center" }]}>
          {feedback}
        </Animated.Text>
      </Animated.View>
    );
  }

  const SCORE_COLOR = stars === 3 ? "#2DCB8E" : stars === 2 ? "#FFD166" : "#F5A623";
  const SCORE_LABEL = stars === 3 ? t("excellent") : stars === 2 ? t("good") : t("keepGoing");

  // Overall 0..10 from the six 1..5 metrics so the flower centre reads smoothly
  // (the star→score map is too coarse for the headline number).
  const metricVals = metrics
    ? [metrics.clarity, metrics.expressiveness, metrics.volume, metrics.confidence, metrics.tempo, metrics.pauses]
    : [];
  const overall10 = metricVals.length
    ? Math.round((metricVals.reduce((a, b) => a + b, 0) / metricVals.length) * 2 * 10) / 10
    : score;

  return (
    <Animated.View entering={FadeInUp.delay(100).duration(500)} style={[ac.card, { borderColor: SCORE_COLOR + "44" }]}>
      <LinearGradient colors={[SCORE_COLOR + "0D", "transparent"]} style={StyleSheet.absoluteFill} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} />

      <Text style={[ac.label, { color: SCORE_COLOR, fontFamily: "Inter_600SemiBold" }]}>{t("aiAnalysis")}</Text>

      {/* Flower (per-aspect petals) when we have full metrics; else stars. */}
      {metrics ? (
        <View style={ac.flowerWrap}>
          <ScoreFlower overall={overall10} aspects={aspectsFromMetrics5(metrics, lang)} size={300} />
        </View>
      ) : (
        <View style={ac.starsRow}>
          {[1, 2, 3].map((n) => <AnimatedStar key={n} filled={n <= stars} delay={n * 200} />)}
        </View>
      )}

      {/* Score badge */}
      <Animated.View entering={ZoomIn.delay(800).duration(400)} style={[ac.scoreBadge, { backgroundColor: SCORE_COLOR + "20", borderColor: SCORE_COLOR + "60" }]}>
        <Text style={[ac.scoreText, { color: SCORE_COLOR, fontFamily: "Inter_700Bold" }]}>{SCORE_LABEL}</Text>
        <Text style={[ac.xpText, { color: SCORE_COLOR, fontFamily: "Inter_500Medium" }]}>+{score} XP</Text>
      </Animated.View>

      {/* Summary */}
      <Animated.Text entering={FadeIn.delay(900).duration(400)} style={[ac.feedback, { color: "rgba(240,237,232,0.85)", fontFamily: "Inter_400Regular" }]}>
        {feedback}
      </Animated.Text>

      {/* Coaching tip — surfaced from /api/analyze-speech.tip so the
          performer gets one concrete thing to fix next take. */}
      {tip ? (
        <Animated.View entering={FadeIn.delay(1500).duration(400)} style={ac.errorsSection}>
          <View style={[ac.divider, { backgroundColor: "#2A3348" }]} />
          <Text style={[ac.errorsTitle, { color: SCORE_COLOR, fontFamily: "Inter_600SemiBold" }]}>
            {lang === "ru" ? "Совет на следующий раз" : "Tip for next take"}
          </Text>
          <Text style={[ac.feedback, { color: "rgba(240,237,232,0.85)", fontFamily: "Inter_500Medium" }]}>
            {tip}
          </Text>
        </Animated.View>
      ) : null}

      {/* Errors list */}
      {errors && errors.length > 0 && (
        <Animated.View entering={FadeIn.delay(1600).duration(400)} style={ac.errorsSection}>
          <View style={[ac.divider, { backgroundColor: "#2A3348" }]} />
          <Text style={[ac.errorsTitle, { color: "#F5A623", fontFamily: "Inter_600SemiBold" }]}>
            {t("payAttention")}
          </Text>
          {errors.map((err, i) => (
            <View key={i} style={ac.errorRow}>
              <View style={[ac.errorDot, { backgroundColor: "#F5A623" }]} />
              <Text style={[ac.errorText, { color: "rgba(240,237,232,0.7)", fontFamily: "Inter_400Regular" }]}>{err}</Text>
            </View>
          ))}
        </Animated.View>
      )}
    </Animated.View>
  );
}

const ac = StyleSheet.create({
  card: { borderRadius: 20, borderWidth: 1, padding: 20, gap: 14, overflow: "hidden" },
  label: { fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase" },
  starsRow: { flexDirection: "row", gap: 12, justifyContent: "center", paddingVertical: 4 },
  flowerWrap: { alignItems: "center", justifyContent: "center", paddingVertical: 4 },
  scoreBadge: { alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  scoreText: { fontSize: 16 },
  xpText: { fontSize: 14 },
  feedback: { fontSize: 14, lineHeight: 21, textAlign: "center" },
  catsSection: { gap: 10 },
  divider: { height: 1, marginVertical: 2 },
  errorsSection: { gap: 8 },
  errorsTitle: { fontSize: 12, letterSpacing: 0.8 },
  errorRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  errorDot: { width: 5, height: 5, borderRadius: 3, marginTop: 7 },
  errorText: { flex: 1, fontSize: 13, lineHeight: 19 },
});

// ── MAIN PLAYBACK SCREEN ──────────────────────────────────────────────────────
export default function ShowtimePlaybackScreen() {
  const { recordingUri, title, taskNumber: taskNumberParam, levelId: levelIdParam, mode: modeParam } = useLocalSearchParams<{
    recordingUri: string;
    title: string;
    taskNumber?: string;
    levelId?: string;
    mode?: string;
  }>();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const { completeTask, getLevelById, addShowTimeRecording, recordMetricScores } = useGame();
  const { t, lang } = useLang();
  const taskNumber = parseInt(taskNumberParam ?? "1", 10) || 1;
  const levelId = levelIdParam ?? "showtime";
  const isTrainer = modeParam === "trainer";

  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [completing, setCompleting] = useState(false);
  const [hasListenedFully, setHasListenedFully] = useState(false);
  const [showListenPrompt, setShowListenPrompt] = useState(false);

  const handlePlaybackComplete = () => {
    setHasListenedFully(true);
  };

  const navigation = useNavigation();

  useEffect(() => {
    if (hasListenedFully || !recordingUri) return;
    const unsubscribe = navigation.addListener("beforeRemove" as any, (e: any) => {
      e.preventDefault();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    });
    return unsubscribe;
  }, [hasListenedFully, recordingUri, navigation]);

  const headerOpacity = useSharedValue(0);
  const contentY = useSharedValue(40);
  const contentOpacity = useSharedValue(0);

  useEffect(() => {
    headerOpacity.value = withTiming(1, { duration: 600 });
    contentY.value = withDelay(300, withSpring(0, { damping: 16 }));
    contentOpacity.value = withDelay(300, withTiming(1, { duration: 500 }));

    // Always trigger analysis — handles both recorded and missing audio
    const timer = setTimeout(() => runAnalysis(), 2200);
    return () => clearTimeout(timer);
  }, []);

  const runAnalysis = async () => {
    if (analyzing || analysisResult) return;
    setAnalyzing(true);

    // If no recording available, give a default score so the user can still proceed
    if (!recordingUri) {
      setTimeout(() => {
        setAnalysisResult({ stars: 2, score: 7, silent: false, feedback: t("recordingNotSavedFallback"), errors: [] });
        setAnalyzing(false);
      }, 800);
      return;
    }

    try {
      let audioBase64 = "";
      if (Platform.OS === "web") {
        const response = await fetch(recordingUri);
        const blob = await response.blob();
        const reader = new FileReader();
        audioBase64 = await new Promise<string>((resolve, reject) => {
          reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(",")[1] ?? "");
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } else {
        // Use string literal "base64" — EncodingType enum not reliably accessible via require()
        const FileSystem = require("expo-file-system/legacy");
        audioBase64 = await FileSystem.readAsStringAsync(recordingUri, { encoding: "base64" });
      }

      if (!audioBase64) {
        setAnalysisResult({ stars: 2, score: 7, silent: false, feedback: t("couldNotReadRecording"), errors: [] });
        return;
      }

      const apiUrl = new URL("/api/analyze-speech", getApiUrl()).toString();
      // Module number drives the analyzer's leniency: early modules are scored
      // gently and encouragingly, later ones more honestly (see /api/analyze-speech).
      const moduleNumber = getLevelById(levelId)?.module;
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioBase64, title, moduleNumber }),
      });
      const data = await res.json();
      if (typeof data.stars === "number") {
        setAnalysisResult({
          stars: data.stars,
          score: data.score,
          silent: data.silent ?? false,
          feedback: data.feedback ?? "",
          categories: data.categories,
          metrics: data.metrics,
          errors: data.errors ?? [],
          tip: typeof data.tip === "string" ? data.tip : undefined,
        });
        if (data.stars === 0) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } else {
          Haptics.notificationAsync(
            data.stars === 3
              ? Haptics.NotificationFeedbackType.Success
              : Haptics.NotificationFeedbackType.Warning
          );
        }
      } else {
        setAnalysisResult({ stars: 2, score: 7, silent: false, feedback: t("goodPerformanceFallback"), errors: [] });
      }
    } catch (e) {
      console.warn("Analysis error:", e);
      setAnalysisResult({ stars: 2, score: 7, silent: false, feedback: t("analysisUnavailable"), errors: [] });
    } finally {
      setAnalyzing(false);
    }
  };

  // After Show Time, advance to the next path level instead of dumping the
  // player back on the map. Trainer mode (free play) still returns to map.
  const goAfterShowTime = () => {
    if (isTrainer) {
      router.push("/");
      return;
    }
    const all = getLevelsData(lang);
    const idx = all.findIndex((l) => l.id === levelId);
    const next = idx >= 0 && idx < all.length - 1 ? all[idx + 1] : null;
    if (!next) {
      router.push("/");
      return;
    }
    if (next.id.startsWith("showtime")) {
      router.replace({ pathname: "/showtime-stage", params: { levelId: next.id, mode: "game" } });
    } else if (next.id.startsWith("vocabulary")) {
      router.replace({ pathname: "/vocabulary-level", params: { levelId: next.id, moduleId: String(next.module) } });
    } else {
      router.replace({ pathname: "/level/[id]", params: { id: next.id } });
    }
  };

  // Actual completion: record progress and move on. Called either after the
  // player listened fully, or when they explicitly skip the self-listen prompt.
  const proceed = () => {
    if (completing) return;
    setCompleting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    playSfx("success").catch(() => {});

    if (!isTrainer) {
      const score = analysisResult?.score ?? 7;
      completeTask(levelId as any, 1, score);
      completeTask(levelId as any, 2, score);
      completeTask(levelId as any, 3, score);

      // Only attribute archives & weak metrics to a rank when the levelId
      // resolves to a real Path level — otherwise this is trainer/free-play
      // and would pollute rank-1 data.
      const pathLevel = getLevelById(levelId);
      if (pathLevel) {
        const rank = getRankForSection(pathLevel.module).index;

        if (recordingUri) {
          addShowTimeRecording(rank, recordingUri);
        }

        // Persist every metric score (not just weak ones) so RankUpScreen
        // can rank metrics by their average across the whole rank window.
        // Prefer the richer `metrics` payload (clarity/volume/tempo/pauses
        // already mapped to RankUp tip names); fall back to the legacy
        // `categories` shape if an older server response is in flight.
        const metrics = analysisResult?.metrics;
        if (metrics) {
          recordMetricScores(rank, {
            clarity: metrics.clarity,
            expressiveness: metrics.expressiveness,
            volume: metrics.volume,
            confidence: metrics.confidence,
            tempo: metrics.tempo,
            pauses: metrics.pauses,
          });
        } else {
          const cats = analysisResult?.categories;
          if (cats) {
            recordMetricScores(rank, {
              clarity: cats.diction.score,
              expressiveness: cats.expressiveness.score,
              volume: cats.voice.score,
              confidence: cats.confidence.score,
            });
          }
        }
      }
    }

    goAfterShowTime();
  };

  const handleDone = () => {
    if (completing) return;
    // Block progression if the player said nothing
    if (analysisResult?.silent || analysisResult?.stars === 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    // Encourage full self-listening before moving on — but allow skipping.
    if (!hasListenedFully && recordingUri) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setShowListenPrompt(true);
      return;
    }
    proceed();
  };

  const skipListening = () => {
    // TODO (task 1.15 — monetization): gate this skip behind a rewarded ad,
    // i.e. only allow proceeding here once the player has watched an ad.
    // Ads are intentionally NOT wired up yet — for now the prompt is a soft
    // nudge and skipping is always allowed.
    setShowListenPrompt(false);
    setHasListenedFully(true);
    proceed();
  };

  const isSilent = analysisResult?.silent || analysisResult?.stars === 0;

  const headerStyle = useAnimatedStyle(() => ({ opacity: headerOpacity.value }));
  const contentStyle = useAnimatedStyle(() => ({ opacity: contentOpacity.value, transform: [{ translateY: contentY.value }] }));

  return (
    <View style={[pb.container, { backgroundColor: "#070D1A" }]}>
      <LinearGradient colors={["#050A14", "#07101E", "#050A14"]} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 0.5, y: 1 }} />

      <Animated.View style={[pb.header, { paddingTop: topPad + 10 }, headerStyle]}>
        <Pressable
          onPress={() => {
            if (!hasListenedFully && recordingUri) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              return;
            }
            router.back();
          }}
          style={({ pressed }) => [pb.backBtn, { opacity: (!hasListenedFully && recordingUri) ? 0.3 : pressed ? 0.7 : 1 }]}
        >
          <Ionicons name="chevron-down" size={22} color="rgba(255,255,255,0.7)" />
        </Pressable>
        <View style={pb.headerCenter}>
          <Text style={[pb.headerTitle, { fontFamily: "Inter_700Bold" }]}>{t("yourPerformance")}</Text>
          {title ? <Text style={[pb.headerSub, { fontFamily: "Inter_400Regular" }]}>«{title}»</Text> : null}
        </View>
        <Pressable
          onPress={() => router.replace("/(tabs)")}
          hitSlop={12}
          style={({ pressed }) => ({
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(255,255,255,0.06)",
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Ionicons name="close" size={22} color="rgba(255,255,255,0.9)" />
        </Pressable>
      </Animated.View>

      <ScrollView
        contentContainerStyle={[pb.scroll, { paddingBottom: bottomPad + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeIn.delay(200).duration(600)}>
          <StageScene />
        </Animated.View>

        <Animated.View entering={FadeIn.delay(400).duration(600)} style={pb.audienceSection}>
          <LinearGradient colors={["#070D1A", "#070D1A"]} style={StyleSheet.absoluteFill} />
          <AudienceSeats />
          <View style={pb.youAreHere}>
            <View style={[pb.youDot, { backgroundColor: "#FFD166" }]} />
            <Text style={[pb.youText, { color: "#FFD166", fontFamily: "Inter_600SemiBold" }]}>{t("youAreHere")}</Text>
          </View>
        </Animated.View>

        <Animated.View style={[contentStyle, pb.content]}>
          <View style={pb.sectionLabel}>
            <Ionicons name="headset-outline" size={16} color="#FFD166" />
            <Text style={[pb.sectionLabelText, { color: "#FFD166", fontFamily: "Inter_600SemiBold" }]}>
              {t("performanceRecording")}
            </Text>
          </View>

          <AudioPlayer uri={recordingUri ?? ""} onPlaybackComplete={handlePlaybackComplete} />

          {!hasListenedFully && recordingUri && (
            <View style={pb.listenHint}>
              <Ionicons name="headset" size={14} color="rgba(255,209,102,0.7)" />
              <Text style={[pb.listenHintText, { fontFamily: "Inter_400Regular" }]}>
                {t("listenToEnd")}
              </Text>
            </View>
          )}

          {/* AI Analysis */}
          {analyzing && (
            <Animated.View entering={FadeIn.duration(300)} style={pb.analyzingCard}>
              <ActivityIndicator color="#FFD166" size="small" />
              <Text style={[pb.analyzingText, { color: "rgba(240,237,232,0.7)", fontFamily: "Inter_400Regular" }]}>
                {t("aiAnalyzing")}
              </Text>
            </Animated.View>
          )}

          {analysisResult && !analyzing && (
            <AnalysisCard result={analysisResult} t={t} lang={lang} />
          )}

          {/* Tips card */}
          {!analysisResult && !analyzing && (
            <View style={[pb.tipsCard, { borderColor: "#2A3348" }]}>
              <Text style={[pb.tipsTitle, { color: "#F0EDE8", fontFamily: "Inter_600SemiBold" }]}>
                {t("whatToEvaluate")}
              </Text>
              {[
                t("evalQ1"),
                t("evalQ2"),
                t("evalQ3"),
                t("evalQ4"),
                t("evalQ5"),
              ].map((tip, i) => (
                <Animated.View key={i} entering={FadeInDown.delay(600 + i * 80).duration(350)} style={pb.tipRow}>
                  <View style={[pb.tipNum, { backgroundColor: "#0B1426" }]}>
                    <Text style={[pb.tipNumText, { color: "#FFD166", fontFamily: "Inter_700Bold" }]}>{i + 1}</Text>
                  </View>
                  <Text style={[pb.tipText, { color: "rgba(240,237,232,0.75)", fontFamily: "Inter_400Regular" }]}>{tip}</Text>
                </Animated.View>
              ))}
            </View>
          )}

          {/* Actions */}
          <View style={pb.actions}>
            <Pressable
              onPress={() => {
                if (!hasListenedFully && recordingUri) {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                  return;
                }
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.push({ pathname: "/showtime-stage", params: { levelId, mode: isTrainer ? "trainer" : "game" } });
              }}
              style={({ pressed }) => [pb.retryBtn, { backgroundColor: "rgba(255,209,102,0.12)", borderColor: "#FFD166", opacity: pressed ? 0.8 : 1 }]}
            >
              <Ionicons name="refresh" size={18} color="#FFD166" />
              <Text style={[pb.retryBtnText, { color: "#FFD166", fontFamily: "Inter_600SemiBold" }]}>{t("again")}</Text>
            </Pressable>
            <Pressable
              onPress={handleDone}
              disabled={completing || isSilent || !analysisResult}
              style={({ pressed }) => [
                pb.doneBtn,
                {
                  backgroundColor: isSilent ? "#1A1A2A" : "#0B1426",
                  opacity: pressed || completing || !analysisResult ? 0.5 : 1,
                  borderWidth: isSilent ? 1 : 0,
                  borderColor: isSilent ? "#0EA5E940" : "transparent",
                },
              ]}
            >
              {completing ? (
                <ActivityIndicator size="small" color="#FFD166" />
              ) : isSilent ? (
                <>
                  <Ionicons name="mic-off-outline" size={18} color="#666" />
                  <Text style={[pb.doneBtnText, { color: "#555", fontFamily: "Inter_700Bold" }]}>{t("noSound")}</Text>
                </>
              ) : (
                <>
                  <Ionicons name="arrow-forward" size={18} color="#FFD166" />
                  <Text style={[pb.doneBtnText, { color: "#FFD166", fontFamily: "Inter_700Bold" }]}>{t("forward")}</Text>
                </>
              )}
            </Pressable>
          </View>
        </Animated.View>
      </ScrollView>

      <SpeechAnalyzingLoader visible={analyzing && !analysisResult} lang={lang} />

      <Modal
        visible={showListenPrompt}
        transparent
        animationType="fade"
        onRequestClose={() => setShowListenPrompt(false)}
      >
        <View style={listenPrompt.overlay}>
          <View style={listenPrompt.card}>
            <Ionicons name="headset-outline" size={38} color="#FFD166" />
            <Text style={listenPrompt.title}>
              {lang === "en" ? "Listen to yourself" : "Послушай себя"}
            </Text>
            <Text style={listenPrompt.body}>
              {lang === "en"
                ? "Listen to your speech to the end — honest self-reflection is a real step toward getting better."
                : "Прослушай свою речь до конца — честный самоанализ это шаг к тому, чтобы стать лучше."}
            </Text>
            <Pressable
              onPress={() => setShowListenPrompt(false)}
              style={({ pressed }) => [listenPrompt.btn, { opacity: pressed ? 0.85 : 1 }]}
            >
              <Text style={listenPrompt.btnText}>
                {lang === "en" ? "Listen" : "Дослушать"}
              </Text>
            </Pressable>
            <Pressable
              onPress={skipListening}
              style={({ pressed }) => [listenPrompt.skipBtn, { opacity: pressed ? 0.7 : 1 }]}
            >
              <Text style={listenPrompt.skipBtnText}>
                {lang === "en" ? "Skip" : "Пропустить"}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const listenPrompt = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(3,7,14,0.78)",
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#0E1626",
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,209,102,0.25)",
    padding: 26,
    alignItems: "center",
    gap: 12,
  },
  title: {
    color: "#fff",
    fontSize: 19,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  body: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 14.5,
    lineHeight: 21,
    textAlign: "center",
    fontFamily: "Inter_400Regular",
  },
  btn: {
    marginTop: 8,
    backgroundColor: "#FFD166",
    paddingHorizontal: 28,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  btnText: {
    color: "#2A1E00",
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  skipBtn: {
    marginTop: 2,
    paddingHorizontal: 20,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  skipBtnText: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
});

const pb = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, gap: 8 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center" },
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle: { fontSize: 18, color: "#fff" },
  headerSub: { fontSize: 13, color: "rgba(255,255,255,0.5)" },
  scroll: { gap: 0 },
  audienceSection: { width: "100%", alignItems: "center", paddingTop: 16, paddingBottom: 24, overflow: "hidden" },
  youAreHere: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 },
  youDot: { width: 8, height: 8, borderRadius: 4 },
  youText: { fontSize: 12 },
  content: { padding: 20, gap: 16 },
  sectionLabel: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionLabelText: { fontSize: 12, letterSpacing: 1.2, textTransform: "uppercase" },
  tipsCard: { borderRadius: 18, borderWidth: 1, padding: 18, gap: 10 },
  tipsTitle: { fontSize: 15, marginBottom: 4 },
  tipRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  tipNum: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  tipNumText: { fontSize: 12 },
  tipText: { flex: 1, fontSize: 14, lineHeight: 20, paddingTop: 2 },
  analyzingCard: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12, padding: 20, borderRadius: 16, backgroundColor: "rgba(255,209,102,0.06)", borderWidth: 1, borderColor: "rgba(255,209,102,0.2)" },
  analyzingText: { fontSize: 14 },
  actions: { flexDirection: "row", gap: 12 },
  retryBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 16, borderWidth: 1 },
  retryBtnText: { fontSize: 15 },
  doneBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 16 },
  doneBtnText: { fontSize: 15 },
  listenHint: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, backgroundColor: "rgba(255,209,102,0.08)", borderWidth: 1, borderColor: "rgba(255,209,102,0.15)" },
  listenHintText: { fontSize: 12, color: "rgba(255,209,102,0.7)" },
});
