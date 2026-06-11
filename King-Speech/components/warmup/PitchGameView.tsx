import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import PitchTrackSkia, {
  buildTrackSegments,
  passDurationSec,
} from "@/components/warmup/PitchTrackSkia";
import { usePitchDetection } from "@/hooks/usePitchDetection";
import type { NormalizedWarmup } from "@/constants/contentLoader";
import { targetHz } from "@/services/warmupPitch";
import {
  classifyPitchHit,
  createPitchSession,
  finalizeWarmupScore,
  tickPitchSession,
  type HitZone,
  type PitchGameSession,
  type WarmupScoreResult,
} from "@/services/warmupScoring";
import { warmupFonts, warmupSpring, warmupTheme } from "@/components/warmup/warmupTheme";

type Phase = "countdown" | "playing";

const COUNTDOWN_SEC = 3;

interface Props {
  data: NormalizedWarmup;
  moduleColor: string;
  topPad: number;
  onComplete: (result: WarmupScoreResult) => void;
  onBack: () => void;
}

export default function PitchGameView({
  data,
  moduleColor,
  topPad,
  onComplete,
  onBack,
}: Props) {
  const pitch = usePitchDetection();
  const segments = useMemo(
    () =>
      buildTrackSegments(
        data.syllables,
        data.notes,
        data.noteOffsetsNormalized,
        data.noteDurationsSec,
      ),
    [data],
  );
  const passSec = useMemo(() => passDurationSec(segments), [segments]);
  const totalMs = data.totalDurationSec * 1000;

  const [phase, setPhase] = useState<Phase>("countdown");
  const [countdown, setCountdown] = useState(COUNTDOWN_SEC);
  const [session, setSession] = useState<PitchGameSession>(createPitchSession);
  const [hitZone, setHitZone] = useState<HitZone>("touch");
  const [activeIndex, setActiveIndex] = useState(0);
  const [currentSyllable, setCurrentSyllable] = useState(data.syllables[0] ?? "");
  const [missFlash, setMissFlash] = useState(false);
  const [progressPct, setProgressPct] = useState(0);

  const progress01 = useSharedValue(0);
  const ballY01 = useSharedValue(0.5);
  const elapsedRef = useRef(0);
  const sessionRef = useRef<PitchGameSession>(createPitchSession());
  const loopRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const finishedRef = useRef(false);

  const clearLoops = () => {
    if (loopRef.current) clearInterval(loopRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    loopRef.current = null;
    countdownRef.current = null;
  };

  const restartTask = useCallback(() => {
    elapsedRef.current = 0;
    finishedRef.current = false;
    const fresh = createPitchSession();
    sessionRef.current = fresh;
    setSession(fresh);
    progress01.value = 0;
    setMissFlash(false);
  }, [progress01]);

  const finishGame = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    clearLoops();
    pitch.stopListening();
    onComplete(finalizeWarmupScore(sessionRef.current));
  }, [onComplete, pitch]);

  const startPlaying = useCallback(async () => {
    restartTask();
    await pitch.startListening();
    setPhase("playing");
    const tickMs = 50;
    loopRef.current = setInterval(() => {
      elapsedRef.current += tickMs;
      const elapsedSec = elapsedRef.current / 1000;
      const p = Math.min(elapsedRef.current / totalMs, 1);
      progress01.value = p;
      setProgressPct(Math.round(p * 100));

      const posInPass = elapsedSec % passSec;
      let segIdx = 0;
      for (let i = segments.length - 1; i >= 0; i--) {
        if (posInPass >= segments[i].startSec) {
          segIdx = i;
          break;
        }
      }
      setActiveIndex(segIdx);
      setCurrentSyllable(segments[segIdx]?.syllable ?? "");

      const target = targetHz(
        segments[segIdx]?.offsetNorm ?? 0.5,
        pitch.range,
      );
      const zone = classifyPitchHit(
        pitch.hz,
        target,
        data.rank,
        pitch.voiceActive,
      );
      setHitZone(zone);

      const { session: next, heartLost } = tickPitchSession(
        sessionRef.current,
        zone,
        tickMs,
        pitch.voiceActive,
      );
      sessionRef.current = next;
      setSession({ ...next });

      if (heartLost) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setMissFlash(true);
        setTimeout(() => setMissFlash(false), 180);
        if (next.hearts <= 0) {
          elapsedRef.current = 0;
          progress01.value = 0;
          setProgressPct(0);
          restartTask();
        }
      }

      ballY01.value = withSpring(pitch.position01, warmupSpring);

      if (p >= 1) finishGame();
    }, tickMs);
  }, [
    ballY01,
    data.rank,
    finishGame,
    passSec,
    pitch,
    progress01,
    restartTask,
    segments,
    totalMs,
  ]);

  useEffect(() => {
    let n = COUNTDOWN_SEC;
    countdownRef.current = setInterval(() => {
      n -= 1;
      setCountdown(n);
      if (n <= 0) {
        clearLoops();
        startPlaying();
      }
    }, 1000);
    return () => {
      clearLoops();
      pitch.stopListening();
    };
  }, [pitch, startPlaying]);

  const hearts = session.hearts;

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>
      <LinearGradient
        colors={[warmupTheme.bg, "#120f18", warmupTheme.bg]}
        style={StyleSheet.absoluteFill}
      />
      {missFlash && <View style={styles.missFlash} pointerEvents="none" />}

      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={12}>
          <Text style={styles.back}>←</Text>
        </Pressable>
        <View style={styles.hearts}>
          {[0, 1, 2].map((i) => (
            <Ionicons
              key={i}
              name={i < hearts ? "heart" : "heart-outline"}
              size={22}
              color={i < hearts ? warmupTheme.gold : "#555"}
            />
          ))}
        </View>
      </View>

      <View style={styles.soundPill}>
        <Text style={styles.soundText}>Звук: {data.sound}</Text>
      </View>

      {phase === "countdown" && (
        <View style={styles.center}>
          <Animated.Text
            key={countdown}
            entering={FadeInDown.duration(200)}
            style={styles.countdown}
          >
            {countdown || "Пой!"}
          </Animated.Text>
        </View>
      )}

      {phase === "playing" && (
        <Animated.View entering={FadeIn.duration(300)} style={styles.game}>
          <Text style={styles.syllable}>{currentSyllable}</Text>
          <PitchTrackSkia
            segments={segments}
            progress01={progress01}
            ballY01={ballY01}
            activeIndex={activeIndex}
            moduleColor={moduleColor}
            hitZone={hitZone}
          />
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: `${progressPct}%` },
              ]}
            />
          </View>
          <Text style={styles.hint}>
            {pitch.pitchMode === "metering"
              ? "Пой в микрофон — на телефоне оценка по активности голоса"
              : "Веди жёлтый шарик по нотам"}
          </Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: warmupTheme.bg },
  missFlash: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 4,
    borderColor: warmupTheme.missRed + "88",
    zIndex: 10,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  back: { color: "#fff", fontSize: 24 },
  hearts: { flexDirection: "row", gap: 6 },
  soundPill: {
    alignSelf: "center",
    backgroundColor: "#ffffff12",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 12,
  },
  soundText: {
    fontFamily: warmupFonts.label,
    color: warmupTheme.gold,
    fontSize: 14,
  },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  countdown: {
    fontFamily: warmupFonts.digit,
    fontSize: 80,
    color: warmupTheme.gold,
  },
  game: { flex: 1, paddingTop: 8 },
  syllable: {
    fontFamily: warmupFonts.title,
    fontSize: 42,
    color: "#fff",
    textAlign: "center",
    marginBottom: 8,
  },
  progressBar: {
    height: 4,
    backgroundColor: "#ffffff18",
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: warmupTheme.gold,
  },
  hint: {
    fontFamily: warmupFonts.body,
    fontSize: 12,
    color: "#888",
    textAlign: "center",
    marginTop: 10,
    paddingHorizontal: 24,
  },
});
