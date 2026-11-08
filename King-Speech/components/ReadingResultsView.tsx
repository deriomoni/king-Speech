import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  FadeIn,
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withTiming,
  withSequence,
  cancelAnimation,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Path } from "react-native-svg";
import * as Haptics from "expo-haptics";
import { useFonts, Literata_600SemiBold } from "@expo-google-fonts/literata";
import { useTheme } from "@/context/ThemeContext";
import { tokenizeReading } from "@/components/ReadingText";
import { readingLines } from "@/src/speech-engine/core/text/reading";
import {
  READING_BG_DARK,
  readingInk,
  readingTint,
  withAlpha,
} from "@/components/reading/readingTheme";
import type { AppColors } from "@/constants/colors";
import type { SpeechAnalysis } from "@/services/speechAnalysis";

let Audio: any = null;
if (Platform.OS !== "web") {
  Audio = require("@/lib/av").Audio;
}

// ─────────────────────────────────────────────────────────────────────────────
// Reading · after the take. Two stages on one screen:
//   1) LISTEN  (Figma 312:4496 «Чтение · финал · слушаем твою запись»): the
//      poem again, the line that is sounding lit in the module tint, a scrub
//      bar, ⟲ ⏯ ⟳ controls, speed, and the gold «Оценить себя».
//   2) RATE    (37:6383 / 37:6532 «Чтение · Самооценка»): recorder bar,
//      5 stars, «Сохранить в библиотеку?», «Заново» / «Дальше».
// Both stages share ONE audio player so the take keeps its position.
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  title: string;
  author?: string;
  category?: string;
  audioUri: string;
  waveform?: number[];
  durationSec: number;
  analysis: SpeechAnalysis | null;
  analyzing: boolean;
  colors: AppColors;
  isDark: boolean;
  t: (key: any) => string;
  lang: "ru" | "en";
  onRetry: () => void;
  onSave: (selfRating: number, saveToLibrary: boolean) => void;
  saving?: boolean;
  /** The text that was read — enables the karaoke listen-back stage. */
  fullText?: string;
  /** When each karaoke line lit up during the capture (ms from its start). */
  lineTimesMs?: number[];
  /** Module colour (getPathColors(module).brick) for the listen-back tint. */
  moduleColor?: string;
  /** ✕ on the listen-back stage (asks «Выйти из чтения?»). */
  onClose?: () => void;
}

const SPEEDS = [1, 1.25, 1.5, 0.75] as const;
const SPEED_LABELS = ["1×", "1.25×", "1.5×", "0.75×"] as const;
const SKIP_SEC = 5;

// ── One player for the take (web: HTMLAudioElement, native: expo-av) ─────────
function useTakePlayer(uri: string, fallbackDur: number, onEnded: () => void) {
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const [dur, setDur] = useState(fallbackDur);
  const [speedIdx, setSpeedIdx] = useState(0);
  const elRef = useRef<HTMLAudioElement | null>(null);
  const soundRef = useRef<any>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const endedRef = useRef(onEnded);
  endedRef.current = onEnded;
  const rate = SPEEDS[speedIdx];

  const stopTick = () => {
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = null;
  };

  useEffect(() => {
    return () => {
      stopTick();
      elRef.current?.pause();
      elRef.current = null;
      soundRef.current?.unloadAsync?.();
      soundRef.current = null;
    };
  }, [uri]);

  const ensureWeb = (): HTMLAudioElement => {
    if (!elRef.current) {
      const el = new window.Audio(uri);
      el.ondurationchange = () => {
        if (Number.isFinite(el.duration) && el.duration > 0) setDur(el.duration);
      };
      el.onended = () => {
        stopTick();
        setPlaying(false);
        setPos(Number.isFinite(el.duration) ? el.duration : 0);
        endedRef.current();
      };
      elRef.current = el;
    }
    return elRef.current;
  };

  const play = async () => {
    if (!uri) return;
    if (Platform.OS === "web") {
      const el = ensureWeb();
      if (el.ended) el.currentTime = 0;
      el.playbackRate = rate;
      try {
        await el.play();
        setPlaying(true);
        stopTick();
        tickRef.current = setInterval(() => setPos(el.currentTime), 100);
      } catch {}
      return;
    }
    try {
      if (soundRef.current) {
        const st = await soundRef.current.getStatusAsync();
        if (st.isLoaded && st.durationMillis && st.positionMillis >= st.durationMillis - 50) {
          await soundRef.current.setPositionAsync(0);
        }
        await soundRef.current.playAsync();
        setPlaying(true);
        return;
      }
      const { sound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true, rate, shouldCorrectPitch: true, progressUpdateIntervalMillis: 100 },
      );
      soundRef.current = sound;
      sound.setOnPlaybackStatusUpdate((st: any) => {
        if (!st.isLoaded) return;
        setPos(st.positionMillis / 1000);
        if (st.durationMillis) setDur(st.durationMillis / 1000);
        if (st.didJustFinish) {
          setPlaying(false);
          endedRef.current();
        } else setPlaying(st.isPlaying);
      });
      setPlaying(true);
    } catch (e) {
      console.warn("Reading playback error:", e);
    }
  };

  const pause = async () => {
    stopTick();
    if (Platform.OS === "web") elRef.current?.pause();
    else await soundRef.current?.pauseAsync?.();
    setPlaying(false);
  };

  const toggle = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (playing) pause();
    else play();
  };

  const seek = async (sec: number) => {
    const d = dur || fallbackDur;
    const s = Math.max(0, Math.min(d || 0, sec));
    if (Platform.OS === "web") {
      if (!uri) return;
      const el = ensureWeb();
      el.currentTime = s;
      setPos(s);
    } else if (soundRef.current) {
      await soundRef.current.setPositionAsync(s * 1000);
      setPos(s);
    }
  };

  const cycleSpeed = () => {
    Haptics.selectionAsync().catch(() => {});
    const next = (speedIdx + 1) % SPEEDS.length;
    setSpeedIdx(next);
    const r = SPEEDS[next];
    if (Platform.OS === "web") {
      if (elRef.current) elRef.current.playbackRate = r;
    } else {
      soundRef.current?.setRateAsync?.(r, true).catch?.(() => {});
    }
  };

  return {
    playing,
    pos,
    dur: dur || fallbackDur,
    speedLabel: SPEED_LABELS[speedIdx],
    play,
    pause,
    toggle,
    seek,
    cycleSpeed,
  };
}

function fmtClock(sec: number, pad = false): string {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  return `${pad ? String(m).padStart(2, "0") : m}:${String(s % 60).padStart(2, "0")}`;
}

// Figma 312:4527 controls — the two circular skip arrows (24pt, 2.4 stroke).
function SkipIcon({ dir, color }: { dir: "back" | "fwd"; color: string }) {
  return (
    <Svg width={26} height={32} viewBox={dir === "back" ? "39 13 26 33" : "195 13 26 33"}>
      {dir === "back" ? (
        <>
          <Path
            d="M58 22C55.6971 20.6723 53.0184 20.1469 50.3846 20.5062C47.7507 20.8655 45.3107 22.0892 43.4475 23.9852C41.5844 25.8811 40.4034 28.3421 40.0902 30.9818C39.7769 33.6216 40.349 36.2906 41.7166 38.57C43.0843 40.8495 45.1701 42.6102 47.6467 43.576C50.1233 44.5418 52.8505 44.658 55.4002 43.9062C57.9499 43.1544 60.1779 41.5773 61.7343 39.4224C63.2908 37.2675 64.0877 34.6568 64 32"
            stroke={color}
            strokeWidth={2.4}
            strokeLinecap="round"
            fill="none"
          />
          <Path d="M58 15V23H50" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </>
      ) : (
        <>
          <Path
            d="M202 22C204.303 20.6723 206.982 20.1469 209.615 20.5062C212.249 20.8655 214.689 22.0892 216.552 23.9852C218.416 25.8811 219.597 28.3421 219.91 30.9818C220.223 33.6216 219.651 36.2906 218.283 38.57C216.916 40.8495 214.83 42.6102 212.353 43.576C209.877 44.5418 207.15 44.658 204.6 43.9062C202.05 43.1544 199.822 41.5773 198.266 39.4224C196.709 37.2675 195.912 34.6568 196 32"
            stroke={color}
            strokeWidth={2.4}
            strokeLinecap="round"
            fill="none"
          />
          <Path d="M202 15V23H210" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </>
      )}
    </Svg>
  );
}

function SelfStar({
  active,
  locked,
  hint,
  accent,
  trackColor,
  onPress,
}: {
  active: boolean;
  locked: boolean;
  hint: boolean; // unlocked but not yet rated → glow + blink to invite a tap
  accent: string;
  trackColor: string;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);
  const blink = useSharedValue(1);
  useEffect(() => {
    if (active) {
      scale.value = withSequence(withSpring(1.25, { damping: 6 }), withSpring(1));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
  useEffect(() => {
    if (hint && !active) {
      blink.value = withRepeat(withTiming(0.5, { duration: 650 }), -1, true);
    } else {
      cancelAnimation(blink);
      blink.value = withTiming(1, { duration: 200 });
    }
    return () => cancelAnimation(blink);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hint, active]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }], opacity: blink.value }));
  const glow = active || hint;
  const color = locked ? trackColor : active || hint ? accent : trackColor;
  return (
    <Pressable
      disabled={locked}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => ({ opacity: pressed && !locked ? 0.7 : 1 })}
    >
      <Animated.View style={style}>
        {/* Glow on the glyph itself (a View shadow paints a box on web). */}
        <Ionicons
          name={active ? "star" : "star-outline"}
          size={44}
          color={color}
          style={glow ? { textShadowColor: withAlpha(accent, 0.75), textShadowRadius: 10, textShadowOffset: { width: 0, height: 0 } } : undefined}
        />
      </Animated.View>
    </Pressable>
  );
}

// Deterministic placeholder envelope when the take has no captured bars.
const FALLBACK_WAVE = [0.35, 0.55, 0.25, 0.75, 0.45, 0.9, 0.6, 0.3, 0.7, 1, 0.5, 0.4, 0.85, 0.65, 0.25, 0.55, 0.95, 0.75, 0.35, 0.6, 0.45, 0.8, 0.3, 0.7, 0.9, 0.5, 0.65, 0.4, 0.75, 0.55];
const BAR_COUNT = 30;
function resampleWave(src: number[] | undefined, n: number): number[] {
  const w = src && src.length ? src : FALLBACK_WAVE;
  if (w.length === n) return w;
  return Array.from({ length: n }, (_, i) => {
    const a = Math.floor((i * w.length) / n);
    const b = Math.max(a + 1, Math.floor(((i + 1) * w.length) / n));
    let m = 0;
    for (let k = a; k < b && k < w.length; k++) m = Math.max(m, w[k]);
    return m;
  });
}

export default function ReadingResultsView({
  title,
  author,
  audioUri,
  waveform,
  durationSec,
  t,
  lang,
  onRetry,
  onSave,
  saving,
  fullText,
  lineTimesMs,
  moduleColor,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const { theme, themeMode } = useTheme();
  const dark = themeMode === "dark";
  useFonts({ Literata_600SemiBold });

  const accent = theme.accent; // gold fill (both themes)
  const accentInk = theme.accentInk; // gold as text/icon (ink on light)
  const tint = readingTint(moduleColor || "#FFEDA8", dark);

  // When there's no audio to play back (mic blocked), don't trap the player —
  // unlock the rating immediately so they can still self-assess and continue.
  const [listenedFully, setListenedFully] = useState(!audioUri);
  const [selfRating, setSelfRating] = useState(0);
  const [showSavePrompt, setShowSavePrompt] = useState(false);
  const [stage, setStage] = useState<"listen" | "rate">(fullText ? "listen" : "rate");

  const player = useTakePlayer(audioUri, durationSec, () => {
    if (!listenedFully) {
      setListenedFully(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
  });

  // Listen-back starts on its own (as the old self-review did).
  useEffect(() => {
    if (!audioUri) return;
    const timer = setTimeout(() => player.play(), 600);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioUri]);

  // Clean the work title for a single line: drop the parenthetical subtitle and
  // strip quotes/brackets so it fits fully on one line.
  const cleanTitle =
    title
      .replace(/\s*[([{（][^)\]}）]*[)\]}）]\s*/g, " ")
      .replace(/[«»„“”"']/g, "")
      .replace(/\s+/g, " ")
      .trim() || title;

  const pickRating = (n: number) => {
    if (!listenedFully) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setSelfRating(n);
    setShowSavePrompt(true);
  };

  const canSave = selfRating > 0 && !saving;

  if (stage === "listen" && fullText) {
    return (
      <ListenStage
        fullText={fullText}
        lineTimesMs={lineTimesMs}
        player={player}
        dark={dark}
        tint={tint}
        topPad={topPad}
        bottomPad={bottomPad}
        lang={lang}
        hasAudio={!!audioUri}
        onClose={
          onClose
            ? () => {
                player.pause();
                onClose();
              }
            : undefined
        }
        onRate={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
          player.pause();
          setStage("rate");
        }}
      />
    );
  }

  // ── RATE stage (Figma 37:6383 / 37:6532) ──────────────────────────────────
  const fg = theme.text;
  const fgMuted = readingInk(dark, 0.6);
  const cardBg = dark ? "rgba(240,238,233,0.05)" : theme.card;
  const cardBorder = dark ? "rgba(240,238,233,0.06)" : "rgba(38,38,40,0.08)";
  const trackColor = dark ? "rgba(240,238,233,0.3)" : "rgba(38,38,40,0.25)";

  return (
    <View style={[st.container, { backgroundColor: theme.bg }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[st.scroll, { paddingTop: topPad + 23, paddingBottom: bottomPad + 36 }]}
      >
        {/* Hero — work + author */}
        <Animated.View entering={FadeInDown.duration(500)} style={st.hero}>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5} style={[st.workTitle, { color: fg }]}>
            {cleanTitle}
          </Text>
          {author ? <Text style={[st.author, { color: fgMuted }]}>{author}</Text> : null}
          <Text style={[st.sectionLabel, st.listenLabel, { color: accentInk }]}>{t("listenYourself")}</Text>
        </Animated.View>

        {/* Recorder bar · Playback (Figma 153:1883) */}
        <Animated.View entering={FadeInDown.delay(120).duration(500)}>
          <RecorderBar
            wave={resampleWave(waveform, BAR_COUNT)}
            playing={player.playing}
            progress={player.dur > 0 ? Math.min(1, player.pos / player.dur) : 0}
            timeLabel={fmtClock(player.playing || player.pos > 0 ? player.pos : player.dur, true)}
            disabled={!audioUri}
            onPress={player.toggle}
            dark={dark}
            lang={lang}
          />
          {!listenedFully ? (
            <View style={[st.hintRow, { backgroundColor: theme.accentDim }]}>
              <Ionicons name="information-circle-outline" size={15} color={accentInk} />
              <Text style={[st.hintText, { color: fgMuted }]}>{t("listenBackHint")}</Text>
            </View>
          ) : null}
        </Animated.View>

        {/* Self-rating board */}
        <Animated.View
          entering={FadeInDown.delay(220).duration(500)}
          style={[
            st.card,
            st.ratingCard,
            { backgroundColor: cardBg, borderColor: cardBorder, opacity: listenedFully ? 1 : 0.7 },
          ]}
        >
          <Text style={[st.sectionLabel, { color: listenedFully ? accentInk : readingInk(dark, 0.4) }]}>
            {t("rateYourself")}
          </Text>
          <View style={st.starsRow}>
            {[1, 2, 3, 4, 5].map((n) => (
              <SelfStar
                key={n}
                active={n <= selfRating}
                locked={!listenedFully}
                hint={listenedFully && selfRating === 0}
                accent={accent}
                trackColor={trackColor}
                onPress={() => pickRating(n)}
              />
            ))}
          </View>
        </Animated.View>

        {/* Save-to-library prompt — pops up once the player has rated */}
        {showSavePrompt ? (
          <Animated.View
            entering={FadeInDown.duration(300)}
            style={[st.card, st.savePrompt, { backgroundColor: cardBg, borderColor: cardBorder }]}
          >
            <Text style={[st.savePromptText, { color: fg }]}>
              {lang === "ru" ? "Сохранить в библиотеку?" : "Save to library?"}
            </Text>
            <View style={st.savePromptBtns}>
              <Pressable
                onPress={() => canSave && onSave(selfRating, true)}
                disabled={!canSave}
                style={({ pressed }) => [st.secondaryBtn, st.yesNoBtn, { opacity: !canSave ? 0.5 : pressed ? 0.85 : 1 }]}
              >
                <Text style={st.yesNoText}>{lang === "ru" ? "Да" : "Yes"}</Text>
              </Pressable>
              <Pressable
                onPress={() => setShowSavePrompt(false)}
                style={({ pressed }) => [st.secondaryBtn, st.yesNoBtn, { opacity: pressed ? 0.85 : 1 }]}
              >
                <Text style={st.yesNoText}>{lang === "ru" ? "Нет" : "No"}</Text>
              </Pressable>
            </View>
          </Animated.View>
        ) : null}

        {/* Actions */}
        <Animated.View entering={FadeInDown.delay(320).duration(500)} style={st.actions}>
          <Pressable
            onPress={onRetry}
            disabled={saving}
            style={({ pressed }) => [st.secondaryBtn, st.retryBtn, { opacity: pressed ? 0.85 : 1 }]}
          >
            <Ionicons name="refresh" size={16} color="#FFFFFF" />
            <Text style={st.retryText}>{t("replay")}</Text>
          </Pressable>
          <Pressable
            onPress={() => canSave && onSave(selfRating, false)}
            disabled={!canSave}
            style={({ pressed }) => [
              st.saveBtn,
              {
                backgroundColor: accent,
                borderColor: theme.ctaStroke,
                opacity: !canSave ? 0.45 : pressed ? 0.88 : 1,
              },
            ]}
          >
            <Text style={[st.saveText, { color: theme.accentText }]}>{lang === "ru" ? "Дальше" : "Next"}</Text>
            <Ionicons name="arrow-forward" size={17} color={theme.accentText} />
          </Pressable>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

// ── Figma "Recorder bar" · Playback ──────────────────────────────────────────
function RecorderBar({
  wave,
  playing,
  progress,
  timeLabel,
  disabled,
  onPress,
  dark,
  lang,
}: {
  wave: number[];
  playing: boolean;
  progress: number;
  timeLabel: string;
  disabled: boolean;
  onPress: () => void;
  dark: boolean;
  lang: "ru" | "en";
}) {
  const { theme } = useTheme();
  const [w, setW] = useState(0);
  const dim = dark ? "rgba(240,238,233,0.3)" : "rgba(38,38,40,0.25)";
  // At rest the whole take reads solid; once it plays, bars right of the
  // gold playhead dim to 30% (same rule as the task-flow recorder bar).
  const showHead = playing || progress > 0;
  const played = showHead ? progress : 1;
  return (
    <View
      style={[
        st.rbBar,
        {
          backgroundColor: dark ? theme.bg : theme.cardElevated,
          borderColor: dark ? "rgba(240,238,233,0.45)" : "rgba(38,38,40,0.3)",
        },
      ]}
    >
      <Pressable
        onPress={onPress}
        disabled={disabled}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={playing ? (lang === "ru" ? "Пауза" : "Pause") : lang === "ru" ? "Прослушать запись" : "Play recording"}
        style={({ pressed }) => [
          st.rbPlay,
          { backgroundColor: theme.accent, opacity: disabled ? 0.45 : pressed ? 0.8 : 1 },
        ]}
      >
        <Ionicons
          name={playing ? "pause" : "play"}
          size={17}
          color={theme.accentText}
          style={{ marginLeft: playing ? 0 : 2 }}
        />
      </Pressable>
      <View style={st.rbWave} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
        {wave.map((v, i) => (
          <View
            key={i}
            style={[
              st.rbWaveBar,
              {
                height: 9 + v * 27,
                backgroundColor: (i + 0.5) / wave.length <= played ? theme.text : dim,
              },
            ]}
          />
        ))}
        {showHead && w > 0 ? (
          <View
            pointerEvents="none"
            style={[st.rbHead, { left: Math.max(0, Math.min(w - 3, progress * w)) - 2.75 }]}
          >
            <View style={[st.rbHeadDot, { backgroundColor: theme.accent }]} />
            <View style={[st.rbHeadLine, { backgroundColor: theme.accent }]} />
          </View>
        ) : null}
      </View>
      <Text style={[st.rbTime, { color: readingInk(dark, 0.6) }]}>{timeLabel}</Text>
    </View>
  );
}

// ── LISTEN stage (Figma 312:4496) ────────────────────────────────────────────
function ListenStage({
  fullText,
  lineTimesMs,
  player,
  dark,
  tint,
  topPad,
  bottomPad,
  lang,
  hasAudio,
  onClose,
  onRate,
}: {
  fullText: string;
  lineTimesMs?: number[];
  player: ReturnType<typeof useTakePlayer>;
  dark: boolean;
  tint: string;
  topPad: number;
  bottomPad: number;
  lang: "ru" | "en";
  hasAudio: boolean;
  onClose?: () => void;
  onRate: () => void;
}) {
  const { theme } = useTheme();
  const bg = dark ? READING_BG_DARK : theme.bg;
  const ink = theme.text;

  const srcLines = useMemo(() => fullText.split("\n"), [fullText]);
  const seq = useMemo(() => readingLines(tokenizeReading(fullText).tokens), [fullText]);

  // When each karaoke line starts (sec). Real capture times when we have them,
  // otherwise spread the take across the lines by word count.
  const starts = useMemo(() => {
    const real = lineTimesMs && lineTimesMs.length === seq.length && lineTimesMs.some((v) => v >= 0);
    if (real) {
      let last = 0;
      return lineTimesMs!.map((v) => {
        if (v >= 0) last = v / 1000;
        return last;
      });
    }
    const total = seq.reduce((s, l) => s + l.wordCount, 0) || 1;
    let acc = 0;
    return seq.map((l) => {
      const s = (acc / total) * (player.dur || 0);
      acc += l.wordCount;
      return s;
    });
  }, [lineTimesMs, seq, player.dur]);

  const sounding = player.playing || player.pos > 0;
  let activeK = -1;
  if (sounding) {
    for (let k = 0; k < starts.length; k++) if (starts[k] <= player.pos + 0.05) activeK = k;
  }
  const activeSrc = activeK >= 0 ? seq[activeK].line : -1;

  // Autoscroll the sounding line into the upper third.
  const scrollRef = useRef<ScrollView>(null);
  const lineY = useRef<Record<number, number>>({});
  const viewportH = useRef(0);
  useEffect(() => {
    if (activeSrc < 0) return;
    const y = lineY.current[activeSrc];
    if (y == null) return;
    scrollRef.current?.scrollTo({ y: Math.max(0, y - viewportH.current * 0.35), animated: true });
  }, [activeSrc]);

  // Scrub bar (tap / drag to seek).
  const [trackW, setTrackW] = useState(0);
  const progress = player.dur > 0 ? Math.min(1, player.pos / player.dur) : 0;
  const seekFrom = (x: number) => {
    if (!trackW || !player.dur) return;
    player.seek((Math.max(0, Math.min(trackW, x)) / trackW) * player.dur);
  };

  return (
    <Animated.View entering={FadeIn.duration(260)} style={[st.container, { backgroundColor: bg }]}>
      <View style={[st.lsHeader, { paddingTop: topPad + 14 }]}>
        <Text style={[st.lsKicker, { color: tint }]}>
          {(lang === "ru" ? "Твоя запись" : "Your recording").toUpperCase()}
        </Text>
        {onClose ? (
          <Pressable
            onPress={onClose}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={lang === "ru" ? "Выйти из чтения" : "Leave the reading"}
            style={({ pressed }) => [st.lsClose, { opacity: pressed ? 0.6 : 1 }]}
          >
            <Ionicons name="close" size={24} color={ink} />
          </Pressable>
        ) : null}
      </View>

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={st.lsText}
        showsVerticalScrollIndicator={false}
        onLayout={(e) => {
          viewportH.current = e.nativeEvent.layout.height;
        }}
      >
        {srcLines.map((ln, i) => {
          if (!ln.trim()) return <View key={i} style={{ height: 22 }} />;
          const isActive = i === activeSrc;
          const color = isActive
            ? tint
            : activeSrc < 0 || i < activeSrc
              ? readingInk(dark, 0.75)
              : readingInk(dark, 0.4);
          return (
            <View
              key={i}
              onLayout={(e) => {
                lineY.current[i] = e.nativeEvent.layout.y;
              }}
              style={[st.lsLine, isActive ? [st.lsLineActive, { backgroundColor: withAlpha(tint, 0.18) }] : null]}
            >
              <Text
                style={[
                  st.lsLineText,
                  { color, fontFamily: isActive ? "Literata_600SemiBold" : "Literata_400Regular" },
                ]}
              >
                {ln}
              </Text>
            </View>
          );
        })}
      </ScrollView>

      <View style={[st.lsBottom, { paddingBottom: bottomPad }]}>
        <View
          onLayout={(e) => setTrackW(e.nativeEvent.layout.width)}
          onStartShouldSetResponder={() => hasAudio}
          onMoveShouldSetResponder={() => hasAudio}
          onResponderGrant={(e) => seekFrom(e.nativeEvent.locationX)}
          onResponderMove={(e) => seekFrom(e.nativeEvent.locationX)}
          style={st.lsScrubHit}
        >
          <View style={[st.lsTrack, { backgroundColor: readingInk(dark, 0.12) }]}>
            <View style={[st.lsFill, { width: `${progress * 100}%`, backgroundColor: tint }]} />
          </View>
          <View
            pointerEvents="none"
            style={[st.lsKnob, { left: Math.max(0, Math.min(trackW - 12, progress * trackW - 6)), backgroundColor: ink }]}
          />
        </View>
        <View style={st.lsTimes}>
          <Text style={[st.lsTime, { color: readingInk(dark, 0.5) }]}>{fmtClock(player.pos)}</Text>
          <Text style={[st.lsTime, { color: readingInk(dark, 0.5) }]}>{fmtClock(player.dur)}</Text>
        </View>

        <View style={st.lsControls}>
          <Pressable
            onPress={() => player.seek(player.pos - SKIP_SEC)}
            disabled={!hasAudio}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={lang === "ru" ? "Назад на 5 секунд" : "Back 5 seconds"}
            style={({ pressed }) => ({ opacity: !hasAudio ? 0.4 : pressed ? 0.6 : 1 })}
          >
            <SkipIcon dir="back" color={ink} />
          </Pressable>
          <Pressable
            onPress={player.toggle}
            disabled={!hasAudio}
            accessibilityRole="button"
            accessibilityLabel={player.playing ? (lang === "ru" ? "Пауза" : "Pause") : lang === "ru" ? "Слушать" : "Play"}
            style={({ pressed }) => [
              st.lsPlay,
              { backgroundColor: ink, opacity: !hasAudio ? 0.4 : pressed ? 0.85 : 1 },
            ]}
          >
            {player.playing ? (
              <View style={st.lsPauseRow}>
                <View style={[st.lsPauseBar, { backgroundColor: bg }]} />
                <View style={[st.lsPauseBar, { backgroundColor: bg }]} />
              </View>
            ) : (
              <Ionicons name="play" size={26} color={bg} style={{ marginLeft: 4 }} />
            )}
          </Pressable>
          <Pressable
            onPress={() => player.seek(player.pos + SKIP_SEC)}
            disabled={!hasAudio}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={lang === "ru" ? "Вперёд на 5 секунд" : "Forward 5 seconds"}
            style={({ pressed }) => ({ opacity: !hasAudio ? 0.4 : pressed ? 0.6 : 1 })}
          >
            <SkipIcon dir="fwd" color={ink} />
          </Pressable>
          <Pressable onPress={player.cycleSpeed} hitSlop={10} style={st.lsSpeed}>
            <Text style={[st.lsSpeedText, { color: readingInk(dark, 0.6) }]}>{player.speedLabel}</Text>
          </Pressable>
        </View>

        <Pressable
          onPress={onRate}
          style={({ pressed }) => [
            st.lsRateBtn,
            { backgroundColor: theme.accent, borderColor: theme.ctaStroke, opacity: pressed ? 0.88 : 1 },
          ]}
        >
          <Text style={[st.lsRateText, { color: theme.accentText }]}>
            {lang === "ru" ? "Оценить себя" : "Rate yourself"}
          </Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const SECONDARY_BG = "#716250"; // Figma button/secondary
const SECONDARY_STROKE = "#312C24"; // Figma button/stroke

const st = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 22 },
  hero: { alignItems: "center" },
  workTitle: { fontFamily: "Geologica_700Bold", fontSize: 22, letterSpacing: -0.11, textAlign: "center", lineHeight: 28 },
  author: {
    fontFamily: "Geologica_400Regular",
    fontStyle: "italic",
    fontSize: 15,
    textAlign: "center",
    marginTop: 6,
  },
  sectionLabel: {
    fontFamily: "Geologica_600SemiBold",
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    textAlign: "center",
  },
  listenLabel: { marginTop: 22, marginBottom: 41 },
  hintRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  hintText: { flex: 1, fontFamily: "Geologica_400Regular", fontSize: 12.5, lineHeight: 17 },
  card: { borderRadius: 22, borderWidth: 2 },
  ratingCard: { marginTop: 48, paddingTop: 16, paddingBottom: 22, gap: 20 },
  starsRow: { flexDirection: "row", justifyContent: "center", gap: 18 },
  savePrompt: { marginTop: 18, paddingTop: 16, paddingBottom: 16, gap: 14, alignItems: "center" },
  savePromptText: { fontFamily: "Geologica_600SemiBold", fontSize: 15.5, textAlign: "center" },
  savePromptBtns: { flexDirection: "row", gap: 12, justifyContent: "center" },
  secondaryBtn: { backgroundColor: SECONDARY_BG, borderColor: SECONDARY_STROKE, borderWidth: 2 },
  yesNoBtn: { width: 100, height: 42, borderRadius: 32, alignItems: "center", justifyContent: "center" },
  yesNoText: { fontFamily: "Geologica_600SemiBold", fontSize: 15, color: "#FFFFFF" },
  actions: { flexDirection: "row", gap: 12, marginTop: 20 },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 52,
    paddingHorizontal: 20,
    borderRadius: 32,
  },
  retryText: { fontFamily: "Geologica_600SemiBold", fontSize: 15, color: "#FFFFFF" },
  saveBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 52,
    borderRadius: 32,
    borderWidth: 4,
  },
  saveText: { fontFamily: "Geologica_700Bold", fontSize: 15 },
  // Recorder bar (Figma 153:1883): 72pt pill, 4pt rim, gold 40pt play disc.
  rbBar: {
    height: 72,
    borderRadius: 32,
    borderWidth: 4,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 10,
    paddingRight: 18,
    marginHorizontal: 2,
  },
  rbPlay: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  rbWave: {
    flex: 1,
    height: 52,
    marginLeft: 14,
    marginRight: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rbWaveBar: { width: 3, borderRadius: 1.5 },
  rbHead: { position: "absolute", top: 0, width: 8, alignItems: "center" },
  rbHeadDot: { width: 8, height: 8, borderRadius: 4 },
  rbHeadLine: { width: 2.5, height: 46, borderRadius: 1.25, marginTop: -4 },
  rbTime: { fontFamily: "Geologica_700Bold", fontSize: 13 },
  // Listen stage
  lsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingLeft: 30,
    paddingRight: 24,
    minHeight: 24,
  },
  lsKicker: { fontFamily: "Geologica_600SemiBold", fontSize: 11, letterSpacing: 0.55 },
  lsClose: { width: 26, height: 26, alignItems: "center", justifyContent: "center", marginTop: -8 },
  lsText: { paddingHorizontal: 30, paddingTop: 30, paddingBottom: 24 },
  lsLine: { alignSelf: "flex-start", marginBottom: 7 },
  lsLineActive: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginHorizontal: -10,
    marginVertical: -4,
    marginBottom: 3,
  },
  lsLineText: { fontSize: 21, lineHeight: 31 },
  lsBottom: { paddingHorizontal: 30, paddingTop: 12 },
  lsScrubHit: { height: 16, justifyContent: "center" },
  lsTrack: { height: 4, borderRadius: 2, overflow: "hidden" },
  lsFill: { height: 4, borderRadius: 2 },
  lsKnob: { position: "absolute", top: 2, width: 12, height: 12, borderRadius: 6 },
  lsTimes: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  lsTime: { fontFamily: "Geologica_500Medium", fontSize: 12 },
  lsControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 34,
    height: 64,
    marginTop: 21,
  },
  lsPlay: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center" },
  lsPauseRow: { flexDirection: "row", gap: 6 },
  lsPauseBar: { width: 7, height: 24, borderRadius: 2 },
  lsSpeed: { position: "absolute", right: 0, top: 22 },
  lsSpeedText: { fontFamily: "Geologica_700Bold", fontSize: 15 },
  lsRateBtn: {
    marginTop: 30,
    height: 56,
    borderRadius: 28,
    borderWidth: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  lsRateText: { fontFamily: "Geologica_800ExtraBold", fontSize: 17 },
});
