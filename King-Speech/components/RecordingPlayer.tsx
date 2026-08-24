import React, { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, Platform, LayoutChangeEvent } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAudioWaveform } from "@/hooks/useAudioWaveform";

let Audio: any = null;
if (Platform.OS !== "web") {
  Audio = require("expo-av").Audio;
}

const BAR_COUNT = 44;
const MIN_BAR = 5;
const MAX_BAR = 34;

// Fallback shape when no real amplitude data is available (old native recordings
// that were saved before metering capture). Speech-like envelope, not equal lines.
const FALLBACK_HEIGHTS = Array.from({ length: BAR_COUNT }, (_, i) => {
  const env = Math.sin((i / (BAR_COUNT - 1)) * Math.PI); // 0 → 1 → 0 envelope
  const noise = Math.abs(
    Math.sin(i * 1.7) * 0.5 + Math.sin(i * 0.9 + 1) * 0.3 + Math.sin(i * 2.7) * 0.2,
  );
  return Math.round(Math.max(MIN_BAR, Math.min(MAX_BAR, 6 + (5 + env * 23) * (0.45 + 0.55 * noise))));
});

// Resample a 0..1 amplitude array to BAR_COUNT and convert to bar pixel heights.
function toHeights(samples: number[]): number[] {
  const n = samples.length;
  return Array.from({ length: BAR_COUNT }, (_, i) => {
    const v = n === BAR_COUNT ? samples[i] : samples[Math.min(n - 1, Math.floor((i / BAR_COUNT) * n))];
    const a = Math.max(0, Math.min(1, v || 0));
    return Math.round(MIN_BAR + a * (MAX_BAR - MIN_BAR));
  });
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
  /** Real amplitude envelope (0..1 per bar), e.g. from record-time metering.
   *  When absent, the waveform is decoded from the audio (web) or falls back. */
  waveform?: number[];
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
  waveform,
}: Props) {
  // Real waveform: prefer a passed-in amplitude envelope (record-time metering),
  // otherwise decode from the audio file (works on web), otherwise fall back.
  const decoded = useAudioWaveform(uri, BAR_COUNT);
  const barHeights =
    waveform && waveform.length
      ? toHeights(waveform)
      : decoded.status === "ready"
      ? toHeights(decoded.samples)
      : FALLBACK_HEIGHTS;
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

  const seekToRatio = async (ratio: number, haptic: boolean = true) => {
    const r = Math.min(1, Math.max(0, ratio));
    if (haptic) Haptics.selectionAsync().catch(() => {});
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
  const seekFromEvent = (e: any, haptic: boolean) => {
    const w = barWidthRef.current;
    if (!w) return;
    const x = e.nativeEvent.locationX;
    seekToRatio(x / w, haptic);
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
          <Ionicons
            name={isPlaying ? "pause" : "play"}
            size={22}
            color={accentColor}
            style={{ marginLeft: isPlaying ? 0 : 3 }}
          />
        </Pressable>

        <View style={s.waveWrap}>
          {barHeights.map((h, i) => {
            const filled = (i + 0.5) / BAR_COUNT <= progress;
            return (
              <View
                key={i}
                style={{ width: 3, borderRadius: 2, height: h, backgroundColor: filled ? accentColor : trackColor }}
              />
            );
          })}
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

      {/* Drag / tap to seek */}
      <View
        onLayout={onBarLayout}
        onStartShouldSetResponder={() => !!uri}
        onMoveShouldSetResponder={() => !!uri}
        onResponderGrant={(e) => seekFromEvent(e, true)}
        onResponderMove={(e) => seekFromEvent(e, false)}
        style={s.progressHit}
      >
        <View style={[s.progressBg, { backgroundColor: trackColor }]}>
          <View style={[s.progressFill, { backgroundColor: accentColor, width: `${progress * 100}%` as any }]} />
          <View style={[s.knob, { left: `${progress * 100}%` as any, borderColor: accentColor }]} />
        </View>
      </View>

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
  waveWrap: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 1, height: 40 },
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
  time: { fontSize: 11, fontFamily: "Nunito_500Medium", letterSpacing: 0.5 },
});
