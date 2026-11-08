import React, { useState, useEffect, useRef } from "react";
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
import { useLocalSearchParams, router, useNavigation } from "expo-router";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
  FadeIn,
  FadeInUp,
  FadeInDown,
  ZoomIn,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { SvgXml } from "react-native-svg";
import { useGame, getRankForSection } from "@/context/GameContext";
import { useLang } from "@/context/LangContext";
import { useTheme } from "@/context/ThemeContext";
import { getApiUrl } from "@/lib/query-client";
import { playSfx } from "@/lib/sfx";
import { useAudioWaveform } from "@/hooks/useAudioWaveform";
import { getLevelsData } from "@/constants/gameContent";
import SpeechAnalyzingLoader from "@/components/SpeechAnalyzingLoader";
import StageGlassDialog from "@/components/showtime/StageGlassDialog";
import { aspectsFromMetrics5 } from "@/components/ScoreFlower";
import { starOnXml, starOffXml, headphonesXml } from "@/assets/figma/showtime-stage/svgs";

let Audio: any = null;
if (Platform.OS !== "web") {
  Audio = require("@/lib/av").Audio;
}

// Show Time · Разбор выступления (Figma 209:2262 metrics / 209:2485 stars):
// big overall score + verdict, a coaching tip, then the performance card with
// the replay "Recorder bar" and the collapsible per-aspect bars.

// ── WAVEFORM (real amplitude of the recording) ───────────────────────────────
const AP_BARS = 30;
// Deterministic placeholder shape when the audio can't be decoded.
const AP_FALLBACK = [0.35, 0.55, 0.25, 0.75, 0.45, 0.9, 0.6, 0.3, 0.7, 1, 0.5, 0.4, 0.85, 0.65, 0.25, 0.55, 0.95, 0.75, 0.35, 0.6, 0.45, 0.8, 0.3, 0.7, 0.9, 0.5, 0.65, 0.4, 0.75, 0.55];
function resample(src: number[] | undefined, n: number): number[] {
  const w = src && src.length ? src : AP_FALLBACK;
  if (w.length === n) return w.map((v) => Math.max(0, Math.min(1, v || 0)));
  return Array.from({ length: n }, (_, i) => {
    const a = Math.floor((i * w.length) / n);
    const b = Math.max(a + 1, Math.floor(((i + 1) * w.length) / n));
    let m = 0;
    for (let k = a; k < b && k < w.length; k++) m = Math.max(m, w[k] || 0);
    return Math.max(0, Math.min(1, m));
  });
}

const fmt = (s: number) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

// ── AUDIO PLAYER · Figma "Recorder bar" (Playback) ───────────────────────────
function AudioPlayer({ uri, waveform, onPlaybackComplete }: { uri: string; waveform?: number[]; onPlaybackComplete?: () => void }) {
  const { theme, themeMode } = useTheme();
  const isDark = themeMode === "dark";
  const wf = useAudioWaveform(uri, AP_BARS);
  const bars = resample(
    waveform && waveform.length ? waveform : wf.status === "ready" ? wf.samples : undefined,
    AP_BARS,
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [waveW, setWaveW] = useState(0);
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
        // The stage screen leaves the audio session in recording mode, where
        // iOS routes playback to the earpiece and mutes it entirely while the
        // ringer switch is on silent — which is why the take seemed not to
        // start at all. Hand the session back to playback before every play.
        try {
          await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
        } catch {}

        if (!soundRef.current) {
          const { sound } = await Audio.Sound.createAsync({ uri }, { shouldPlay: false });
          soundRef.current = sound;
          const status = await sound.getStatusAsync();
          if (status?.isLoaded && status.durationMillis) setDuration(Math.round(status.durationMillis / 1000));
          sound.setOnPlaybackStatusUpdate((st: any) => {
            if (!st?.isLoaded) return;
            if (st.durationMillis) setDuration(Math.round(st.durationMillis / 1000));
            setPosition(Math.round((st.positionMillis ?? 0) / 1000));
            if (st.didJustFinish) { setIsPlaying(false); setPosition(0); onPlaybackComplete?.(); }
          });
        }
        // A take that already played sits at its end — rewind, or play() is a
        // no-op and nothing is heard.
        const st = await soundRef.current.getStatusAsync();
        const atEnd =
          st?.durationMillis > 0 && st?.positionMillis >= st.durationMillis - 120;
        if (atEnd || position === 0) {
          try { await soundRef.current.setPositionAsync(0); } catch {}
        }
        await soundRef.current.playAsync();
        setIsPlaying(true);
      } catch (e) { console.warn("Playback error:", e); }
    }
  };

  const progress = duration > 0 && Number.isFinite(duration) ? Math.min(1, position / duration) : 0;
  // At rest the whole take reads solid; while playing, bars right of the
  // playhead dim to 30% and the gold playhead rides on top.
  const showHead = isPlaying || progress > 0;
  const played = showHead ? progress : 1;
  const dim = isDark ? "rgba(240,238,233,0.3)" : "rgba(38,38,40,0.25)";
  const shown = isPlaying || position > 0 ? position : duration;

  return (
    <View
      style={[
        ap.bar,
        {
          backgroundColor: isDark ? "#3C3C3D" : theme.cardElevated,
          borderColor: isDark ? "rgba(240,238,233,0.45)" : "rgba(38,38,40,0.3)",
        },
      ]}
    >
      <Pressable
        onPress={handlePlay}
        disabled={!uri}
        hitSlop={8}
        style={({ pressed }) => [ap.play, { backgroundColor: theme.accent, opacity: !uri ? 1 : pressed ? 0.8 : 1 }]}
      >
        {isPlaying ? (
          <View style={[ap.pause, { backgroundColor: theme.accentText }]} />
        ) : (
          <Ionicons name="play" size={16} color={theme.accentText} style={{ marginLeft: 2 }} />
        )}
      </Pressable>
      <View style={ap.wave} onLayout={(e) => setWaveW(e.nativeEvent.layout.width)}>
        {bars.map((v, i) => (
          <View
            key={i}
            style={[ap.waveBar, { height: 6 + v * 28, backgroundColor: (i + 0.5) / bars.length <= played ? theme.text : dim }]}
          />
        ))}
        {showHead && waveW > 0 ? (
          <View pointerEvents="none" style={[ap.head, { left: Math.max(0, Math.min(waveW - 2, progress * waveW)) - 2.5 }]}>
            <View style={[ap.headDot, { backgroundColor: theme.accent }]} />
            <View style={[ap.headLine, { backgroundColor: theme.accent }]} />
          </View>
        ) : null}
      </View>
      <Text style={[ap.time, { color: isDark ? "rgba(240,238,233,0.6)" : theme.textSecondary }]}>{fmt(Math.max(0, shown || 0))}</Text>
    </View>
  );
}

const ap = StyleSheet.create({
  bar: { height: 66, borderRadius: 33, borderWidth: 3.5, flexDirection: "row", alignItems: "center", paddingLeft: 9, paddingRight: 18, overflow: "hidden" },
  play: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  pause: { width: 11, height: 11, borderRadius: 2 },
  wave: { flex: 1, height: 50, marginLeft: 12, marginRight: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  waveBar: { width: 2.7, borderRadius: 1.4 },
  head: { position: "absolute", top: 2, width: 7, alignItems: "center" },
  headDot: { width: 7, height: 7, borderRadius: 3.5 },
  headLine: { width: 2.3, height: 42, borderRadius: 1.2, marginTop: -3.5 },
  time: { fontFamily: "Geologica_700Bold", fontSize: 12 },
});

// ── AI ANALYSIS ───────────────────────────────────────────────────────────────
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
  // Hidden Show Time signals (never shown to the player).
  textMatch?: number | null; // 0..1 — fraction of the script's words that were said
  wordCount?: number;
  durationSec?: number | null;
  readOk?: boolean; // false = didn't actually read the text (skip / noise)
}

// Show Time is a PREPARED text read aloud — so the honest base score comes only
// from delivery + volume (diction, expressiveness, volume, confidence); tempo &
// pauses are dropped. Then the "Толерантность" layer supports a player who truly
// read: the more of the script they actually spoke (hidden text-match), the more
// the score is lifted toward 10. Skipping / noise doesn't lift it (text-match is
// near zero). Padding the timer with silence can't help either — no words said.
function summarize(result: AnalysisResult) {
  const { metrics, score } = result;
  const deliveryVals = metrics
    ? [metrics.clarity, metrics.expressiveness, metrics.volume, metrics.confidence]
    : [];
  const base10 = deliveryVals.length
    ? (deliveryVals.reduce((a, b) => a + b, 0) / deliveryVals.length) * 2
    : score;
  const tm = result.textMatch;
  // Genuine-reading effort from the hidden text-match: 0 at ≤25% of the script
  // said, full (→ score 10) at ≥85%.
  const effort = tm != null ? Math.max(0, Math.min(1, (tm - 0.25) / (0.85 - 0.25))) : 0;
  const overall10 = Math.round(Math.min(10, base10 + (10 - base10) * effort) * 10) / 10;
  // Tier / XP all follow the SHOWN overall so nothing contradicts it.
  const finalStars = overall10 >= 8.5 ? 3 : overall10 >= 6 ? 2 : 1;
  const xp = finalStars === 3 ? 10 : finalStars === 2 ? 7 : 4;
  return { overall10, finalStars, xp };
}

// DEV preview data for the Skip button — showcases the score window without a
// recording.
const DEMO_RESULT: AnalysisResult = {
  stars: 3,
  score: 8,
  silent: false,
  feedback: "Пример оценки: уверенное, живое выступление — поработай над паузами и громкостью.",
  categories: {
    diction: { score: 5, label: "Дикция" },
    expressiveness: { score: 5, label: "Выразительность" },
    voice: { score: 3, label: "Голос" },
    confidence: { score: 4, label: "Уверенность" },
  },
  metrics: { clarity: 5, expressiveness: 5, volume: 3, confidence: 4, tempo: 4, pauses: 2 },
  errors: ["Пример: паузы проскакивают — дай ключевым словам прозвучать"],
  tip: "Делай чуть больше осмысленных пауз после ключевых строк.",
};

// Figma order of the "Характеристики" rows.
const METRIC_ORDER = ["clarity", "confidence", "volume", "expressiveness"] as const;

function MetricRow({ label, value }: { label: string; value: number }) {
  const { theme, themeMode } = useTheme();
  const isDark = themeMode === "dark";
  const v = Math.max(0, Math.min(10, value));
  return (
    <View style={pb.metricRow}>
      <Text numberOfLines={1} style={[pb.metricLabel, { color: isDark ? "rgba(240,238,233,0.85)" : theme.text }]}>{label}</Text>
      <View style={[pb.metricTrack, { backgroundColor: isDark ? "rgba(240,238,233,0.08)" : "rgba(38,38,40,0.08)" }]}>
        {v > 0 ? <View style={[pb.metricFill, { width: `${v * 10}%`, backgroundColor: theme.accent }]} /> : null}
      </View>
      <Text style={[pb.metricValue, { color: theme.text }]}>{Number.isInteger(v) ? String(v) : v.toFixed(1)}</Text>
    </View>
  );
}

// ── MAIN PLAYBACK SCREEN ──────────────────────────────────────────────────────
export default function ShowtimePlaybackScreen() {
  const { recordingUri, title, taskNumber: taskNumberParam, levelId: levelIdParam, mode: modeParam, demo: demoParam, scriptText: scriptTextParam, waveform: waveformParam } = useLocalSearchParams<{
    recordingUri: string;
    title: string;
    taskNumber?: string;
    levelId?: string;
    mode?: string;
    demo?: string;
    scriptText?: string;
    waveform?: string;
  }>();
  // Real amplitude envelope of THIS recording, captured during recording.
  const recordedWaveform = React.useMemo<number[] | undefined>(() => {
    if (!waveformParam) return undefined;
    try {
      const arr = JSON.parse(waveformParam);
      return Array.isArray(arr) && arr.length ? arr.map((v: any) => Number(v) || 0) : undefined;
    } catch {
      return undefined;
    }
  }, [waveformParam]);
  // DEV preview: opened from the Skip button to show the score window with
  // example data, no recording required. demo=2 previews the "no metrics"
  // (stars) variant.
  const isDemo = demoParam === "1" || demoParam === "2";
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const { completeTask, getLevelById, addShowTimeRecording, recordMetricScores } = useGame();
  const { t, lang } = useLang();
  const { theme, themeMode } = useTheme();
  const isDark = themeMode === "dark";
  const taskNumber = parseInt(taskNumberParam ?? "1", 10) || 1;
  void taskNumber;
  const levelId = levelIdParam ?? "showtime";
  const isTrainer = modeParam === "trainer";

  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [completing, setCompleting] = useState(false);
  const [hasListenedFully, setHasListenedFully] = useState(false);
  const [showListenPrompt, setShowListenPrompt] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(true);

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

    // DEV preview: show example results immediately, skip real analysis.
    if (isDemo) {
      setHasListenedFully(true);
      setAnalysisResult(
        demoParam === "2"
          ? { stars: 2, score: 7, silent: false, feedback: "", errors: [] }
          : DEMO_RESULT,
      );
      return;
    }

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
        body: JSON.stringify({ audioBase64, title, moduleNumber, scriptText: scriptTextParam ?? "" }),
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
          textMatch: typeof data.textMatch === "number" ? data.textMatch : null,
          wordCount: typeof data.wordCount === "number" ? data.wordCount : 0,
          durationSec: typeof data.durationSec === "number" ? data.durationSec : null,
          readOk: data.readOk !== false,
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
    // Show Time is a TWO-screen modal stack: showtime-stage → showtime-playback.
    // Replacing only the top (playback) leaves showtime-stage mounted underneath,
    // so the next level (e.g. Reading) renders as a window ON TOP of the lingering
    // Show Time screen. Collapse the whole Show Time flow back to the map first,
    // then open the next level fresh — exactly like tapping its tile on the map.
    router.dismissAll();

    if (isTrainer) return; // dismissAll already returned to the map
    const all = getLevelsData(lang);
    const idx = all.findIndex((l) => l.id === levelId);
    const next = idx >= 0 && idx < all.length - 1 ? all[idx + 1] : null;
    if (!next) return;
    if (next.id.startsWith("showtime")) {
      router.push({ pathname: "/showtime-stage", params: { levelId: next.id, mode: "game" } });
    } else if (next.id.startsWith("vocabulary")) {
      router.push({ pathname: "/vocabulary-level", params: { levelId: next.id, moduleId: String(next.module) } });
    } else {
      router.push({ pathname: "/level/[id]", params: { id: next.id } });
    }
  };

  // Actual completion: record progress and move on. Called either after the
  // player listened fully, or when they explicitly skip the self-listen prompt.
  const proceed = () => {
    if (completing) return;
    setCompleting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    playSfx("success").catch(() => {});

    if (!isTrainer && !isDemo) {
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
    if (analysisResult && (analysisResult.silent || analysisResult.stars === 0)) {
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

  // Didn't speak → blocks progression (must read the text and try again).
  // NOTE: we block only on true silence, not on the low-text-match signal, since
  // STT on a long Show Time script isn't reliable enough to fail a genuine read.
  const isSilent = !!analysisResult && (analysisResult.silent || analysisResult.stars === 0);

  const headerStyle = useAnimatedStyle(() => ({ opacity: headerOpacity.value }));
  const contentStyle = useAnimatedStyle(() => ({ opacity: contentOpacity.value, transform: [{ translateY: contentY.value }] }));

  const ru = lang !== "en";
  const sum = analysisResult && !isSilent ? summarize(analysisResult) : null;
  const verdict = sum ? (sum.finalStars === 3 ? t("excellent") : sum.finalStars === 2 ? t("good") : t("keepGoing")) : "";
  const metrics = analysisResult?.metrics;
  const metricRows = metrics
    ? METRIC_ORDER.map((k) => aspectsFromMetrics5(metrics, lang).find((a) => a.key === k)).filter(Boolean) as { key: string; label: string; score: number }[]
    : [];
  const tip = (analysisResult?.tip ?? "").trim();

  const labelColor = isDark ? "rgba(240,238,233,0.5)" : theme.textSecondary;
  const dimColor = isDark ? "rgba(240,238,233,0.35)" : theme.textMuted;
  const cardStyle = {
    backgroundColor: isDark ? "rgba(240,238,233,0.05)" : theme.card,
    borderColor: isDark ? "rgba(240,238,233,0.08)" : theme.cardBorder,
  };
  const dividerColor = isDark ? "rgba(240,238,233,0.08)" : theme.cardBorder;

  return (
    <View style={[pb.container, { backgroundColor: theme.bg }]}>
      <ScrollView
        contentContainerStyle={[pb.scroll, { paddingTop: topPad + 55, paddingBottom: bottomPad + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.Text style={[pb.title, { color: theme.text }, headerStyle]}>
          {ru ? "Разбор выступления" : "Performance review"}
        </Animated.Text>

        <Animated.View style={[contentStyle, { flexGrow: 1 }]}>
          {/* Overall score + verdict */}
          {sum ? (
            <Animated.View entering={FadeInUp.delay(100).duration(500)} style={pb.scoreBlock}>
              <Text style={[pb.label, { color: labelColor }]}>{ru ? "ОЦЕНКА" : "SCORE"}</Text>
              <Animated.View entering={ZoomIn.delay(250).duration(400)} style={pb.scoreRow}>
                <Text style={[pb.scoreNum, { color: theme.accentInk }]}>{sum.overall10.toFixed(1)}</Text>
                <Text style={[pb.scoreMax, { color: dimColor }]}>/10</Text>
              </Animated.View>
              {/* Without the per-aspect breakdown the stars carry the tier
                  (Figma 209:2485). */}
              {!metrics ? (
                <View style={pb.starsRow}>
                  {[1, 2, 3].map((n) => (
                    <Animated.View key={n} entering={ZoomIn.delay(300 + n * 150).duration(300)}>
                      <SvgXml
                        xml={n <= sum.finalStars ? starOnXml : starOffXml.replace(/__INK__/g, isDark ? "#F0EEE9" : "#262628")}
                        width={30}
                        height={30}
                      />
                    </Animated.View>
                  ))}
                </View>
              ) : null}
              <View style={pb.verdictRow}>
                <Text style={[pb.verdict, { color: theme.text }]}>{verdict}</Text>
                <View style={[pb.xpPill, { backgroundColor: isDark ? "rgba(255,237,168,0.14)" : "rgba(255,237,168,0.35)" }]}>
                  <Text style={[pb.xpText, { color: theme.accentInk }]}>+{sum.xp} XP</Text>
                </View>
              </View>
            </Animated.View>
          ) : null}

          {/* Didn't read the text → not counted */}
          {isSilent ? (
            <Animated.View entering={FadeInUp.delay(100).duration(500)} style={[pb.card, cardStyle, { marginTop: 28, gap: 12 }]}>
              <Text style={[pb.label, { color: theme.accentInk }]}>{t("notCounted").toUpperCase()}</Text>
              <Text style={[pb.tip, { color: theme.text }]}>
                {ru
                  ? "Кажется, ты не читал текст вслух. Прочитай его и пройди уровень снова."
                  : "Looks like the text wasn't read aloud. Read it and pass the level again."}
              </Text>
            </Animated.View>
          ) : null}

          {/* Coaching tip — surfaced from /api/analyze-speech.tip */}
          {sum && tip ? (
            <Animated.View entering={FadeIn.delay(600).duration(400)} style={[pb.card, cardStyle, { marginTop: 28, gap: 16 }]}>
              <Text style={[pb.label, { color: theme.accentInk }]}>{ru ? "СОВЕТ" : "TIP"}</Text>
              <Text style={[pb.tip, { color: theme.text }]}>{tip}</Text>
            </Animated.View>
          ) : null}

          {/* Before the result: what to listen for while it's being analysed. */}
          {!analysisResult && !analyzing ? (
            <View style={[pb.card, cardStyle, { marginTop: 28, gap: 10 }]}>
              <Text style={[pb.label, { color: theme.accentInk }]}>{t("whatToEvaluate").toUpperCase()}</Text>
              {[t("evalQ1"), t("evalQ2"), t("evalQ3"), t("evalQ4"), t("evalQ5")].map((q, i) => (
                <Animated.View key={i} entering={FadeInDown.delay(600 + i * 80).duration(350)} style={pb.evalRow}>
                  <Text style={[pb.evalNum, { color: theme.accentInk }]}>{i + 1}</Text>
                  <Text style={[pb.evalText, { color: isDark ? "rgba(240,238,233,0.75)" : theme.textSecondary }]}>{q}</Text>
                </Animated.View>
              ))}
            </View>
          ) : null}

          {analyzing ? (
            <View style={[pb.card, cardStyle, { marginTop: 28, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12 }]}>
              <ActivityIndicator color={theme.accent} size="small" />
              <Text style={[pb.evalText, { color: theme.textSecondary }]}>{t("aiAnalyzing")}</Text>
            </View>
          ) : null}

          <Text style={[pb.label, { color: labelColor, marginTop: 36, marginBottom: 12 }]}>
            {ru ? "ВЫСТУПЛЕНИЕ" : "PERFORMANCE"}
          </Text>

          {/* Performance card: theme, replay, characteristics */}
          <View style={[pb.card, cardStyle, { gap: 14 }]}>
            <View style={pb.cardHead}>
              <Text style={[pb.label, { color: labelColor }]}>{ru ? "ТЕМА" : "TOPIC"}</Text>
              {sum ? (
                <View style={pb.ansScore}>
                  <Text style={[pb.ansScoreNum, { color: theme.accentInk }]}>{sum.overall10.toFixed(1)}</Text>
                  <Text style={[pb.ansScoreMax, { color: dimColor }]}>/10</Text>
                </View>
              ) : null}
            </View>
            {title ? <Text style={[pb.topic, { color: theme.text }]}>«{title}»</Text> : null}

            <AudioPlayer uri={recordingUri ?? ""} waveform={recordedWaveform} onPlaybackComplete={handlePlaybackComplete} />

            {!recordingUri ? (
              <Text style={[pb.note, { color: isDark ? "rgba(240,238,233,0.4)" : theme.textMuted }]}>{t("recordingNotSaved")}</Text>
            ) : !hasListenedFully ? (
              <Text style={[pb.note, { color: isDark ? "rgba(240,238,233,0.4)" : theme.textMuted }]}>{t("listenToEnd")}</Text>
            ) : null}

            {metricRows.length && !isSilent ? (
              <>
                <View style={[pb.divider, { backgroundColor: dividerColor }]} />
                <Pressable
                  onPress={() => setDetailsOpen((v) => !v)}
                  style={pb.toggle}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: detailsOpen }}
                >
                  <Text style={[pb.toggleText, { color: isDark ? "rgba(240,238,233,0.7)" : theme.textSecondary }]}>
                    {ru ? "Характеристики" : "Breakdown"}
                  </Text>
                  <View style={[pb.chevron, { backgroundColor: isDark ? "rgba(240,238,233,0.08)" : "rgba(38,38,40,0.06)" }]}>
                    <Ionicons name={detailsOpen ? "chevron-up" : "chevron-down"} size={16} color={theme.text} />
                  </View>
                </Pressable>
                {detailsOpen ? (
                  <View style={{ gap: 12 }}>
                    {metricRows.map((a) => (
                      <MetricRow key={a.key} label={a.label} value={a.score} />
                    ))}
                  </View>
                ) : null}
              </>
            ) : null}
          </View>

          <View style={{ flexGrow: 1, minHeight: 44 }} />

          {/* Actions */}
          <View style={pb.actions}>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                // replace (not push) so playback doesn't stack on top of stage.
                router.replace({ pathname: "/showtime-stage", params: { levelId, mode: isTrainer ? "trainer" : "game" } });
              }}
              style={({ pressed }) => [
                pb.btn,
                {
                  backgroundColor: isDark ? "#2E2E2F" : theme.card,
                  borderColor: isDark ? "rgba(240,238,233,0.06)" : theme.cardBorder,
                  borderWidth: 2,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Ionicons name="refresh" size={16} color={theme.text} />
              <Text style={[pb.btnTextSecondary, { color: theme.text }]}>{t("again")}</Text>
            </Pressable>
            <Pressable
              onPress={handleDone}
              disabled={completing || isSilent || !analysisResult}
              style={({ pressed }) => [
                pb.btn,
                isSilent
                  ? { backgroundColor: isDark ? "rgba(240,238,233,0.06)" : theme.card, borderColor: "transparent", borderWidth: 2 }
                  : { backgroundColor: theme.accent, borderColor: theme.ctaStroke, borderWidth: 4 },
                { opacity: pressed || completing || !analysisResult ? 0.5 : 1 },
              ]}
            >
              {completing ? (
                <ActivityIndicator size="small" color={theme.accentText} />
              ) : isSilent ? (
                <>
                  <Ionicons name="book-outline" size={16} color={theme.textMuted} />
                  <Text style={[pb.btnTextPrimary, { color: theme.textMuted }]}>
                    {ru ? "Прочитай текст" : "Read the text"}
                  </Text>
                </>
              ) : (
                <>
                  <Ionicons name="arrow-forward" size={16} color={theme.accentText} />
                  <Text style={[pb.btnTextPrimary, { color: theme.accentText }]}>{t("forward")}</Text>
                </>
              )}
            </Pressable>
          </View>
        </Animated.View>
      </ScrollView>

      <SpeechAnalyzingLoader visible={analyzing && !analysisResult} lang={lang} />

      {/* Figma 36:1228 "Show Time · Послушай себя (modal)" */}
      <StageGlassDialog
        visible={showListenPrompt}
        icon={<SvgXml xml={headphonesXml} width={38} height={38} />}
        title={lang === "en" ? "Listen to yourself" : "Послушай себя"}
        message={
          lang === "en"
            ? "Listen to your speech to the end — honest self-reflection is a real step toward getting better."
            : "Прослушай свою речь до конца - честный самоанализ это шаг к тому, чтобы стать лучше."
        }
        stacked
        onRequestClose={() => setShowListenPrompt(false)}
        buttons={[
          { label: lang === "en" ? "Listen" : "Дослушать", variant: "primary", onPress: () => setShowListenPrompt(false) },
          { label: lang === "en" ? "Skip" : "Пропустить", variant: "link", onPress: skipListening },
        ]}
      />
    </View>
  );
}

const pb = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 20 },
  title: { fontFamily: "Geologica_900Black", fontSize: 28, lineHeight: 34, letterSpacing: -0.28 },
  label: { fontFamily: "Geologica_600SemiBold", fontSize: 12, letterSpacing: 0.6 },
  scoreBlock: { marginTop: 28, gap: 4 },
  scoreRow: { flexDirection: "row", alignItems: "baseline", gap: 6 },
  scoreNum: { fontFamily: "Geologica_900Black", fontSize: 96, lineHeight: 104, letterSpacing: -2.88 },
  scoreMax: { fontFamily: "Geologica_700Bold", fontSize: 30, letterSpacing: -0.3 },
  starsRow: { flexDirection: "row", gap: 8 },
  verdictRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingTop: 10 },
  verdict: { fontFamily: "Geologica_800ExtraBold", fontSize: 17 },
  xpPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 32 },
  xpText: { fontFamily: "Geologica_700Bold", fontSize: 13, letterSpacing: 0.65 },
  card: { borderRadius: 22, borderWidth: 2, padding: 20 },
  tip: { fontFamily: "Geologica_700Bold", fontSize: 16, lineHeight: 19.2 },
  evalRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  evalNum: { fontFamily: "Geologica_800ExtraBold", fontSize: 14, width: 14, lineHeight: 20 },
  evalText: { flex: 1, fontFamily: "Geologica_400Regular", fontSize: 14, lineHeight: 20 },
  cardHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  ansScore: { flexDirection: "row", alignItems: "baseline", gap: 2 },
  ansScoreNum: { fontFamily: "Geologica_900Black", fontSize: 22, letterSpacing: -0.11 },
  ansScoreMax: { fontFamily: "Geologica_700Bold", fontSize: 13 },
  topic: { fontFamily: "Geologica_800ExtraBold", fontSize: 17, lineHeight: 23 },
  note: { fontFamily: "Geologica_400Regular", fontSize: 12.5 },
  divider: { height: 1 },
  toggle: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  toggleText: { fontFamily: "Geologica_700Bold", fontSize: 14 },
  chevron: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  metricRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  metricLabel: { width: 134, fontFamily: "Geologica_700Bold", fontSize: 14 },
  metricTrack: { flex: 1, height: 6, borderRadius: 3, overflow: "hidden" },
  metricFill: { height: 6, borderRadius: 3 },
  metricValue: { width: 24, textAlign: "right", fontFamily: "Geologica_700Bold", fontSize: 15 },
  actions: { flexDirection: "row", gap: 12 },
  btn: { flex: 1, height: 50, borderRadius: 32, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  btnTextSecondary: { fontFamily: "Geologica_600SemiBold", fontSize: 15 },
  btnTextPrimary: { fontFamily: "Geologica_700Bold", fontSize: 15 },
});
