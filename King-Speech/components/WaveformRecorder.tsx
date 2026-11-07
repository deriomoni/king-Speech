import React, { useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Alert,
  Platform,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
  cancelAnimation,
  Easing,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/context/ThemeContext";
import {
  type WaveBar,
  WAVEFORM_BAR_MIN,
  WAVEFORM_BAR_MAX,
} from "@/hooks/useWaveformBars";

// Figma "Recorder bar" (151:1584, state Active): a 354x72 pill with a 4pt
// translucent-ink outline, 3pt bars growing left to right, a gold playhead
// (with a dot on top) at the live edge and a faint "rest line" to the right.
// Below it: gold restart icon, gold "Стоп" pill, and a gold pause icon (kept
// for the existing pause/resume feature).

const BAR_WIDTH = 3;
const BAR_GAP = 3.5;
const BAR_MAX_H = 40; // tallest bar inside the 72pt pill
const VISIBLE_BARS = 30; // the live edge scrolls once the pill is full

interface Props {
  isRecording: boolean;
  isPaused: boolean;
  elapsedSeconds: number;
  bars: WaveBar[];
  onStop: () => void;
  onPause: () => void;
  onResume: () => void;
  onRestart: () => void;
  lang: "ru" | "en";
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function RecDot({ active, color }: { active: boolean; color: string }) {
  const op = useSharedValue(1);
  useEffect(() => {
    if (active) {
      op.value = withRepeat(
        withSequence(
          withTiming(0.16, { duration: 600, easing: Easing.inOut(Easing.quad) }),
          withTiming(1, { duration: 600, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
        false,
      );
    } else {
      cancelAnimation(op);
      op.value = withTiming(0.16, { duration: 200 });
    }
    return () => cancelAnimation(op);
  }, [active, op]);
  const style = useAnimatedStyle(() => ({ opacity: op.value }));
  return <Animated.View style={[styles.recDot, { backgroundColor: color }, style]} />;
}

function Bar({ bar, isNewest, color }: { bar: WaveBar; isNewest: boolean; color: string }) {
  const scale = useSharedValue(isNewest ? 0.4 : 1);
  useEffect(() => {
    if (isNewest) {
      scale.value = withSpring(1, { damping: 14, stiffness: 220, mass: 0.4 });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const style = useAnimatedStyle(() => ({
    transform: [{ scaleY: scale.value }],
  }));
  // Hook heights live in [MIN..MAX]; map them onto the pill's 6..40pt range.
  const t = Math.max(
    0,
    Math.min(1, (bar.height - WAVEFORM_BAR_MIN) / (WAVEFORM_BAR_MAX - WAVEFORM_BAR_MIN)),
  );
  const h = 6 + t * (BAR_MAX_H - 6);
  return <Animated.View style={[styles.bar, { height: h, backgroundColor: color }, style]} />;
}

export default function WaveformRecorder({
  isRecording,
  isPaused,
  elapsedSeconds,
  bars,
  onStop,
  onPause,
  onResume,
  onRestart,
  lang,
}: Props) {
  const { theme, themeMode } = useTheme();
  const isDark = themeMode === "dark";
  const pillStroke = isDark ? "rgba(240,238,233,0.45)" : "rgba(38,38,40,0.3)";
  const restLine = isDark ? "rgba(240,238,233,0.25)" : "rgba(38,38,40,0.2)";
  const visible = bars.slice(-VISIBLE_BARS);

  const stopLabel = lang === "en" ? "Stop" : "Стоп";
  const restartTitle = lang === "en" ? "Restart recording?" : "Начать заново?";
  const restartMsg =
    lang === "en"
      ? "Your current take will be discarded."
      : "Текущая запись будет удалена.";
  const cancelLabel = lang === "en" ? "Cancel" : "Отмена";
  const restartLabel = lang === "en" ? "Restart" : "Начать заново";

  const handleRestartPress = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    Alert.alert(restartTitle, restartMsg, [
      { text: cancelLabel, style: "cancel" },
      {
        text: restartLabel,
        style: "destructive",
        onPress: () => onRestart(),
      },
    ]);
  };

  const handlePauseToggle = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    if (isPaused) onResume();
    else onPause();
  };

  const handleStop = () => {
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {},
      );
    }
    onStop();
  };

  return (
    <View style={styles.container}>
      <View style={styles.timerRow}>
        <RecDot active={isRecording && !isPaused} color={theme.accent} />
        <Text style={[styles.timerText, { color: theme.accentInk }]}>{formatTime(elapsedSeconds)}</Text>
      </View>

      <View style={[styles.panel, { backgroundColor: theme.bg, borderColor: pillStroke }]}>
        <View style={styles.panelInner}>
          {visible.map((b, i) => (
            <Bar key={b.id} bar={b} isNewest={i === visible.length - 1} color={theme.text} />
          ))}
          <View style={styles.playheadWrap}>
            <View style={[styles.playheadDot, { backgroundColor: theme.accent }]} />
            <View style={[styles.playhead, { backgroundColor: theme.accent }]} />
          </View>
          <View style={[styles.restLine, { backgroundColor: restLine }]} />
        </View>
      </View>

      <View style={styles.controls}>
        <Pressable
          onPress={handleRestartPress}
          accessibilityRole="button"
          accessibilityLabel={restartLabel}
          hitSlop={10}
          style={({ pressed }) => [styles.iconBtn, { opacity: pressed ? 0.6 : 1 }]}
          testID="waveform-restart"
        >
          <Ionicons name="refresh" size={21} color={theme.accentInk} />
        </Pressable>

        <Pressable
          onPress={handleStop}
          accessibilityRole="button"
          accessibilityLabel={stopLabel}
          style={({ pressed }) => [
            styles.stopPill,
            { backgroundColor: theme.accent, borderColor: theme.ctaStroke, opacity: pressed ? 0.85 : 1 },
          ]}
          testID="waveform-stop"
        >
          <View style={[styles.stopIcon, { backgroundColor: theme.accentText }]} />
          <Text style={[styles.stopPillText, { color: theme.accentText }]}>{stopLabel}</Text>
        </Pressable>

        <Pressable
          onPress={handlePauseToggle}
          accessibilityRole="button"
          accessibilityLabel={
            isPaused
              ? lang === "en"
                ? "Resume"
                : "Продолжить"
              : lang === "en"
                ? "Pause"
                : "Пауза"
          }
          hitSlop={10}
          style={({ pressed }) => [styles.iconBtn, { opacity: pressed ? 0.6 : 1 }]}
          testID="waveform-pause"
        >
          <Ionicons name={isPaused ? "mic" : "pause"} size={21} color={theme.accentInk} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    alignItems: "center",
  },
  timerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 23,
  },
  recDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  timerText: {
    fontFamily: "Geologica_700Bold",
    fontSize: 18,
    letterSpacing: -0.09,
  },
  panel: {
    width: "100%",
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    overflow: "hidden",
    paddingHorizontal: 24,
    justifyContent: "center",
    marginTop: 19,
  },
  panelInner: {
    flexDirection: "row",
    alignItems: "center",
    height: 56,
    gap: BAR_GAP,
  },
  bar: {
    width: BAR_WIDTH,
    borderRadius: 1.5,
  },
  playheadWrap: {
    width: 8,
    height: 50,
    alignItems: "center",
    marginHorizontal: -2.75,
  },
  playheadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  playhead: {
    width: 2.5,
    height: 46,
    borderRadius: 1.25,
    marginTop: -4,
  },
  restLine: {
    flex: 1,
    height: 2,
    borderRadius: 1,
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 25,
    marginTop: 23,
  },
  iconBtn: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  stopPill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    width: 140,
    height: 50,
    borderRadius: 32,
    borderWidth: 4,
  },
  stopIcon: {
    width: 12.4,
    height: 12.4,
    borderRadius: 2,
  },
  stopPillText: {
    fontFamily: "Geologica_700Bold",
    fontSize: 16,
  },
});
