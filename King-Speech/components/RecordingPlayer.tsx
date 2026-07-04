import React, { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, Platform, LayoutChangeEvent } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  cancelAnimation,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

let Audio: any = null;
if (Platform.OS !== "web") {
  Audio = require("expo-av").Audio;
}

const BAR_COUNT = 28;

function WaveBar({
  index,
  isPlaying,
  progress,
  accent,
  track,
}: {
  index: number;
  isPlaying: boolean;
  progress: number;
  accent: string;
  track: string;
}) {
  const height = useSharedValue(5);
  useEffect(() => {
    if (isPlaying) {
      // Deterministic-ish per-bar bounce so it reads as "playing".
      const peak = 6 + ((index * 37) % 22);
      height.value = withRepeat(withTiming(peak, { duration: 220 + (index % 5) * 40 }), -1, true);
    } else {
      cancelAnimation(height);
      height.value = withTiming(5 + ((index * 13) % 14), { duration: 200 });
    }
    return () => cancelAnimation(height);
  }, [isPlaying]);
  const style = useAnimatedStyle(() => ({ height: height.value }));
  const filled = index / BAR_COUNT <= progress;
  return (
    <Animated.View
      style={[style, { width: 3, borderRadius: 2, minHeight: 5, backgroundColor: filled ? accent : track }]}
    />
  );
}

interface Props {
  uri: string;
  accentColor: string;
  trackColor?: string;
  textColor?: string;
  /** Fires once the recording has played all the way to the end. */
  onComplete?: () => void;
  /** Start playing shortly after mount. */
  autoPlay?: boolean;
}

/**
 * Self-contained audio player with play/pause, tap-to-seek and replay.
 * Works on web (HTMLAudioElement) and native (expo-av). Used both on the
 * reading self-review screen and inside the private library.
 */
export default function RecordingPlayer({
  uri,
  accentColor,
  trackColor = "#2A3348",
  textColor = "#9A97AD",
  onComplete,
  autoPlay,
}: Props) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [durationSec, setDurationSec] = useState(0);
  const [positionSec, setPositionSec] = useState(0);
  const soundRef = useRef<any>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const barWidthRef = useRef(0);
  const readyRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let autoTimer: ReturnType<typeof setTimeout> | null = null;
    if (autoPlay && uri) {
      autoTimer = setTimeout(() => {
        if (!cancelled) play();
      }, 600);
    }
    return () => {
      cancelled = true;
      if (autoTimer) clearTimeout(autoTimer);
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (Platform.OS === "web") {
        audioElRef.current?.pause();
      } else {
        soundRef.current?.unloadAsync?.();
        soundRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uri]);

  const startTicker = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      if (Platform.OS === "web") {
        setPositionSec(audioElRef.current?.currentTime ?? 0);
      }
    }, 250);
  };
  const stopTicker = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const pause = async () => {
    if (Platform.OS === "web") audioElRef.current?.pause();
    else await soundRef.current?.pauseAsync?.();
    setIsPlaying(false);
    stopTicker();
  };

  const play = async () => {
    if (!uri) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (isPlaying) {
      pause();
      return;
    }
    if (Platform.OS === "web") {
      if (!audioElRef.current) {
        const el = new window.Audio(uri);
        audioElRef.current = el;
        el.ondurationchange = () => {
          if (Number.isFinite(el.duration)) setDurationSec(el.duration);
        };
        el.onended = () => {
          setIsPlaying(false);
          setPositionSec(el.duration || 0);
          stopTicker();
          onComplete?.();
        };
      }
      try {
        await audioElRef.current.play();
        setIsPlaying(true);
        startTicker();
      } catch {}
    } else {
      try {
        if (soundRef.current) {
          await soundRef.current.playAsync();
          setIsPlaying(true);
        } else {
          const { sound } = await Audio.Sound.createAsync({ uri }, { shouldPlay: true });
          soundRef.current = sound;
          readyRef.current = true;
          const status = await sound.getStatusAsync();
          if (status.isLoaded && status.durationMillis) {
            setDurationSec(status.durationMillis / 1000);
          }
          sound.setOnPlaybackStatusUpdate((st: any) => {
            if (!st.isLoaded) return;
            setPositionSec(st.positionMillis / 1000);
            if (st.durationMillis) setDurationSec(st.durationMillis / 1000);
            if (st.didJustFinish) {
              setIsPlaying(false);
              onComplete?.();
            } else {
              setIsPlaying(st.isPlaying);
            }
          });
          setIsPlaying(true);
        }
      } catch (e) {
        console.warn("RecordingPlayer playback error:", e);
      }
    }
  };

  const seekToRatio = async (ratio: number) => {
    const r = Math.min(1, Math.max(0, ratio));
    Haptics.selectionAsync().catch(() => {});
    if (Platform.OS === "web") {
      const el = audioElRef.current;
      const dur = el?.duration || durationSec;
      if (el && Number.isFinite(dur) && dur > 0) {
        el.currentTime = r * dur;
        setPositionSec(el.currentTime);
      }
    } else {
      const dur = durationSec;
      if (soundRef.current && dur > 0) {
        await soundRef.current.setPositionAsync(r * dur * 1000);
        setPositionSec(r * dur);
      }
    }
  };

  const replay = async () => {
    await seekToRatio(0);
    if (!isPlaying) play();
  };

  const onBarLayout = (e: LayoutChangeEvent) => {
    barWidthRef.current = e.nativeEvent.layout.width;
  };
  const onBarPress = (e: any) => {
    const w = barWidthRef.current;
    if (!w) return;
    const x = e.nativeEvent.locationX;
    seekToRatio(x / w);
  };

  const fmt = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, "0")}:${Math.floor(s % 60)
      .toString()
      .padStart(2, "0")}`;
  const progress = durationSec > 0 ? Math.min(1, positionSec / durationSec) : 0;

  return (
    <View style={[s.container, { borderColor: trackColor }]}>
      <View style={s.row}>
        <Pressable
          onPress={play}
          disabled={!uri}
          style={({ pressed }) => [
            s.playBtn,
            { backgroundColor: accentColor + "1F", borderColor: accentColor, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <Ionicons name={isPlaying ? "pause" : "play"} size={22} color={accentColor} />
        </Pressable>

        <View style={s.waveWrap}>
          {Array.from({ length: BAR_COUNT }).map((_, i) => (
            <WaveBar key={i} index={i} isPlaying={isPlaying} progress={progress} accent={accentColor} track={trackColor} />
          ))}
        </View>

        <Pressable
          onPress={replay}
          disabled={!uri}
          hitSlop={8}
          style={({ pressed }) => [s.replayBtn, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Ionicons name="refresh" size={18} color={textColor} />
        </Pressable>
      </View>

      {/* Tap-to-seek progress bar */}
      <Pressable onLayout={onBarLayout} onPress={onBarPress} style={s.progressHit}>
        <View style={[s.progressBg, { backgroundColor: trackColor }]}>
          <View style={[s.progressFill, { backgroundColor: accentColor, width: `${progress * 100}%` as any }]} />
          <View style={[s.knob, { left: `${progress * 100}%` as any, borderColor: accentColor }]} />
        </View>
      </Pressable>

      <View style={s.timeRow}>
        <Text style={[s.time, { color: textColor }]}>{fmt(positionSec)}</Text>
        <Text style={[s.time, { color: textColor }]}>{durationSec > 0 ? fmt(durationSec) : "--:--"}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { borderRadius: 16, borderWidth: 1, padding: 14, gap: 10 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  playBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  waveWrap: { flex: 1, flexDirection: "row", alignItems: "center", gap: 2, height: 34 },
  replayBtn: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  progressHit: { paddingVertical: 8 },
  progressBg: { height: 4, borderRadius: 2, overflow: "visible" },
  progressFill: { height: 4, borderRadius: 2 },
  knob: {
    position: "absolute",
    top: -4,
    width: 12,
    height: 12,
    borderRadius: 6,
    marginLeft: -6,
    backgroundColor: "#fff",
    borderWidth: 2,
  },
  timeRow: { flexDirection: "row", justifyContent: "space-between" },
  time: { fontSize: 11, fontFamily: "Inter_500Medium", letterSpacing: 0.5 },
});
