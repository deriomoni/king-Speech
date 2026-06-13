import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import PitchTrackSkia, {
  buildTrackSegments,
  passDurationSec,
} from "@/components/warmup/PitchTrackSkia";
import { activeSegmentIndexAt } from "@/components/warmup/pitchTrackGeometry";
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
const CLEAN_HAPTIC_MIN_MS = 320;

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
  const [activeFill01, setActiveFill01] = useState(0);
  const [currentSyllable, setCurrentSyllable] = useState(data.syllables[0] ?? "");
  const [missFlash, setMissFlash] = useState(false);
  const [progressPct, setProgressPct] = useState(0);

  const progress01 = useSharedValue(0);
  const clockSec = useSharedValue(0);
  const ballY01 = useSharedValue(0.5);
  const glow01 = useSharedValue(0);
  const burst01 = useSharedValue(0);
  const syllableScale = useSharedValue(1);
  const comboScale = useSharedValue(1);

  const elapsedRef = useRef(0);
  const sessionRef = useRef<PitchGameSession>(createPitchSession());
  const loopRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const finishedRef = useRef(false);
  const lastZoneRef = useRef<HitZone>("miss");
  const lastCleanHapticRef = useRef(0);
  const lastSyllableRef = useRef("");
  const lastComboRef = useRef(0);
  const aliveRef = useRef(true);

  // Keep the latest pitch readings in a ref so the game loop reads live values
  // without making the loop/countdown effect depend on the (per-render) pitch object.
  const pitchRef = useRef(pitch);
  pitchRef.current = pitch;

  const clearLoops = useCallback(() => {
    if (loopRef.current) clearInterval(loopRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    loopRef.current = null;
    countdownRef.current = null;
  }, []);

  const restartTask = useCallback(() => {
    elapsedRef.current = 0;
    finishedRef.current = false;
    const fresh = createPitchSession();
    sessionRef.current = fresh;
    setSession(fresh);
    progress01.value = 0;
    cancelAnimation(clockSec);
    clockSec.value = 0;
    glow01.value = 0;
    burst01.value = 0;
    lastZoneRef.current = "miss";
    lastComboRef.current = 0;
    lastSyllableRef.current = "";
    setActiveIndex(0);
    setActiveFill01(0);
    setCurrentSyllable(data.syllables[0] ?? "");
    setMissFlash(false);
  }, [progress01, clockSec, glow01, burst01, data.syllables]);

  const finishGame = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    clearLoops();
    pitchRef.current.stopListening();
    onComplete(finalizeWarmupScore(sessionRef.current));
  }, [onComplete, clearLoops]);
  const finishGameRef = useRef(finishGame);
  finishGameRef.current = finishGame;

  const startPlaying = useCallback(async () => {
    restartTask();
    await pitchRef.current.startListening();
    if (!aliveRef.current) return;
    setPhase("playing");
    const tickMs = 50;
    loopRef.current = setInterval(() => {
      elapsedRef.current += tickMs;
      const elapsedSec = elapsedRef.current / 1000;
      const p = Math.min(elapsedRef.current / totalMs, 1);
      progress01.value = p;
      clockSec.value = withTiming(elapsedSec, {
        duration: tickMs,
        easing: Easing.linear,
      });
      setProgressPct(Math.round(p * 100));

      const posInPass = elapsedSec % passSec;
      const segIdx = activeSegmentIndexAt(segments, posInPass);
      const seg = segments[segIdx];
      setActiveIndex(segIdx);

      if (seg && seg.syllable !== lastSyllableRef.current) {
        lastSyllableRef.current = seg.syllable;
        setCurrentSyllable(seg.syllable);
        syllableScale.value = withSequence(
          withSpring(1.18, warmupSpring),
          withSpring(1, warmupSpring),
        );
      }

      const fill = seg
        ? Math.min(1, Math.max(0, (posInPass - seg.startSec) / Math.max(seg.durationSec, 0.001)))
        : 0;
      setActiveFill01(fill);

      const live = pitchRef.current;
      const target = targetHz(seg?.offsetNorm ?? 0.5, live.range);
      const zone = classifyPitchHit(live.hz, target, data.rank, live.voiceActive);
      setHitZone(zone);

      glow01.value = withTiming(zone === "clean" ? 1 : zone === "touch" ? 0.55 : 0, {
        duration: 120,
      });

      // Clean-hit onset: celebratory pulse + throttled light haptic (never every tick).
      if (zone === "clean" && lastZoneRef.current !== "clean") {
        const now = Date.now();
        if (now - lastCleanHapticRef.current > CLEAN_HAPTIC_MIN_MS) {
          lastCleanHapticRef.current = now;
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          burst01.value = withSequence(
            withTiming(1, { duration: 90 }),
            withTiming(0, { duration: 320 }),
          );
        }
      }
      lastZoneRef.current = zone;

      const { session: next, heartLost } = tickPitchSession(
        sessionRef.current,
        zone,
        tickMs,
        live.voiceActive,
      );
      sessionRef.current = next;
      setSession({ ...next });

      if (next.combo > lastComboRef.current && next.combo >= 3) {
        comboScale.value = withSequence(
          withSpring(1.25, warmupSpring),
          withSpring(1, warmupSpring),
        );
      }
      lastComboRef.current = next.combo;

      if (heartLost) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setMissFlash(true);
        setTimeout(() => {
          if (aliveRef.current) setMissFlash(false);
        }, 180);
        if (next.hearts <= 0) {
          elapsedRef.current = 0;
          progress01.value = 0;
          setProgressPct(0);
          restartTask();
        }
      }

      ballY01.value = withSpring(live.position01, warmupSpring);

      if (p >= 1) finishGameRef.current();
    }, tickMs);
  }, [
    ballY01,
    burst01,
    clockSec,
    comboScale,
    data.rank,
    glow01,
    passSec,
    progress01,
    restartTask,
    segments,
    syllableScale,
    totalMs,
  ]);

  useEffect(() => {
    aliveRef.current = true;
    let n = COUNTDOWN_SEC;
    countdownRef.current = setInterval(() => {
      n -= 1;
      setCountdown(n);
      if (n <= 0) {
        if (countdownRef.current) clearInterval(countdownRef.current);
        countdownRef.current = null;
        startPlaying();
      }
    }, 1000);
    return () => {
      aliveRef.current = false;
      clearLoops();
      pitchRef.current.stopListening();
    };
  }, [startPlaying, clearLoops]);

  const hearts = session.hearts;
  const held = hitZone !== "miss";

  const syllableStyle = useAnimatedStyle(() => ({
    transform: [{ scale: syllableScale.value }],
  }));
  const comboStyle = useAnimatedStyle(() => ({
    transform: [{ scale: comboScale.value }],
  }));

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
          <Animated.Text style={[styles.syllable, syllableStyle]}>
            {currentSyllable}
          </Animated.Text>

          {session.comboMax > 0 && session.combo >= 3 && (
            <Animated.View style={[styles.comboPill, comboStyle]}>
              <Ionicons name="flame" size={14} color={warmupTheme.gold} />
              <Text style={styles.comboText}>Комбо ×{session.combo}</Text>
            </Animated.View>
          )}

          <PitchTrackSkia
            segments={segments}
            passSec={passSec}
            clockSec={clockSec}
            ballY01={ballY01}
            glow01={glow01}
            burst01={burst01}
            activeIndex={activeIndex}
            activeFill01={activeFill01}
            held={held}
            moduleColor={moduleColor}
            hitZone={hitZone}
          />

          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
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
    marginBottom: 6,
  },
  comboPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "center",
    backgroundColor: "#ffffff14",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    marginBottom: 10,
  },
  comboText: {
    fontFamily: warmupFonts.label,
    color: warmupTheme.gold,
    fontSize: 13,
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
