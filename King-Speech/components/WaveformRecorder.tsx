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
import {
  type WaveBar,
  WAVEFORM_BAR_MAX,
  WAVEFORM_MAX_BARS,
} from "@/hooks/useWaveformBars";

const RED = "#FF3B30";
const RED_SOFT = "rgba(255,59,48,0.10)";
const RED_BORDER = "rgba(255,59,48,0.28)";
const DOT_DIM = "rgba(255,59,48,0.22)";

const BAR_WIDTH = 4;
const BAR_GAP = 3;
const PANEL_HEIGHT = 84;

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

function RecDot({ active }: { active: boolean }) {
  const op = useSharedValue(1);
  useEffect(() => {
    if (active) {
      op.value = withRepeat(
        withSequence(
          withTiming(0.15, { duration: 600, easing: Easing.inOut(Easing.quad) }),
          withTiming(1, { duration: 600, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
        false,
      );
    } else {
      cancelAnimation(op);
      op.value = withTiming(0.35, { duration: 200 });
    }
    return () => cancelAnimation(op);
  }, [active, op]);
  const style = useAnimatedStyle(() => ({ opacity: op.value }));
  return <Animated.View style={[styles.recDot, style]} />;
}

function Bar({ bar, isNewest }: { bar: WaveBar; isNewest: boolean }) {
  const scale = useSharedValue(isNewest ? 0.4 : 1);
  useEffect(() => {
    if (isNewest) {
      scale.value = withSpring(1, { damping: 14, stiffness: 220, mass: 0.4 });
    }
    // older bars stay at scale 1; we don't re-animate on opacity changes
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const style = useAnimatedStyle(() => ({
    transform: [{ scaleY: scale.value }],
  }));
  return (
    <Animated.View
      style={[
        styles.bar,
        {
          height: bar.height,
          opacity: bar.opacity,
        },
        style,
      ]}
    />
  );
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
  // Compute how many "not yet recorded" dots to show on the right side.
  const remainingSlots = Math.max(0, WAVEFORM_MAX_BARS - bars.length);

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
        <RecDot active={isRecording && !isPaused} />
        <Text style={styles.timerText}>{formatTime(elapsedSeconds)}</Text>
      </View>

      <View style={styles.panel}>
        <View style={styles.panelInner}>
          {bars.map((b, i) => (
            <Bar key={b.id} bar={b} isNewest={i === bars.length - 1} />
          ))}
          {Array.from({ length: remainingSlots }).map((_, i) => (
            <View key={`d-${i}`} style={styles.placeholderDot} />
          ))}
        </View>
      </View>

      <View style={styles.controls}>
        <Pressable
          onPress={handleRestartPress}
          accessibilityRole="button"
          accessibilityLabel={restartLabel}
          style={({ pressed }) => [
            styles.circleBtn,
            { opacity: pressed ? 0.7 : 1 },
          ]}
          testID="waveform-restart"
        >
          <Ionicons name="refresh" size={22} color={RED} />
        </Pressable>

        <Pressable
          onPress={handleStop}
          accessibilityRole="button"
          accessibilityLabel={stopLabel}
          style={({ pressed }) => [
            styles.stopPill,
            { opacity: pressed ? 0.85 : 1 },
          ]}
          testID="waveform-stop"
        >
          <Ionicons name="stop" size={18} color="#fff" />
          <Text style={styles.stopPillText}>{stopLabel}</Text>
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
          style={({ pressed }) => [
            styles.circleBtn,
            { opacity: pressed ? 0.7 : 1 },
          ]}
          testID="waveform-pause"
        >
          <Ionicons
            name={isPaused ? "mic" : "pause"}
            size={22}
            color={RED}
          />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    alignItems: "center",
    gap: 12,
    paddingVertical: 4,
  },
  timerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  recDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: RED,
  },
  timerText: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: RED,
    letterSpacing: 1.5,
  },
  panel: {
    width: "100%",
    height: PANEL_HEIGHT,
    borderRadius: 16,
    backgroundColor: RED_SOFT,
    borderWidth: 1,
    borderColor: RED_BORDER,
    overflow: "hidden",
    paddingHorizontal: 10,
    justifyContent: "center",
  },
  panelInner: {
    flexDirection: "row",
    alignItems: "center",
    height: WAVEFORM_BAR_MAX,
    gap: BAR_GAP,
  },
  bar: {
    width: BAR_WIDTH,
    borderRadius: 2,
    backgroundColor: RED,
  },
  placeholderDot: {
    width: BAR_WIDTH,
    height: BAR_WIDTH,
    borderRadius: BAR_WIDTH / 2,
    backgroundColor: DOT_DIM,
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 18,
    marginTop: 4,
  },
  circleBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: RED_SOFT,
    borderWidth: 1,
    borderColor: RED_BORDER,
  },
  stopPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 26,
    backgroundColor: RED,
    minWidth: 140,
    justifyContent: "center",
    ...Platform.select({
      ios: {
        shadowColor: RED,
        shadowOpacity: 0.4,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
      },
      android: { elevation: 4 },
      default: {},
    }),
  },
  stopPillText: {
    color: "#fff",
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    letterSpacing: 0.5,
  },
});
