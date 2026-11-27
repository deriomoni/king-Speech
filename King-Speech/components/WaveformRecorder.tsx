import React, { useEffect } from "react";
import { appAlert } from "@/lib/appAlert";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  cancelAnimation,
  Easing,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "@/lib/haptics";
import { useTheme } from "@/context/ThemeContext";
import {
  type WaveBar,
  WAVEFORM_BAR_MIN,
  WAVEFORM_BAR_MAX,
} from "@/hooks/useWaveformBars";
import RecButton, { RecGlyph } from "@/components/RecButton";
import { pickLang, type Lang } from "@/context/LangContext";
import { rs } from "@/lib/responsive";
import { WavePill, WaveBars } from "@/components/VoiceWave";

// Recorder: timer, an iMessage-style voice pill (bars light up as they are
// recorded, empty slots are dim dots — no playhead), then «Заново» / «Стоп» /
// pause controls.

const VISIBLE_BARS = 34; // slots in the pill; the oldest bars scroll off once full

const norm = (b: WaveBar) =>
  Math.max(0, Math.min(1, (b.height - WAVEFORM_BAR_MIN) / (WAVEFORM_BAR_MAX - WAVEFORM_BAR_MIN)));

interface Props {
  isRecording: boolean;
  isPaused: boolean;
  elapsedSeconds: number;
  bars: WaveBar[];
  onStop: () => void;
  onPause: () => void;
  onResume: () => void;
  onRestart: () => void;
  lang: Lang;
  /** Only the «Стоп» pill — no «Заново», no pause (interview answers). */
  stopOnly?: boolean;
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
  stopOnly = false,
}: Props) {
  const { theme, themeMode } = useTheme();
  const isDark = themeMode === "dark";
  const visible = bars.slice(-VISIBLE_BARS);

  const stopLabel = pickLang(lang, { ru: "Стоп", en: "Stop", kk: "Тоқтату" });
  const restartTitle = pickLang(lang, { ru: "Начать заново?", en: "Restart recording?", kk: "Қайта бастайсыз ба?" });
  const restartMsg =
    pickLang(lang, { ru: "Текущая запись будет удалена.", en: "Your current take will be discarded.", kk: "Ағымдағы жазба өшіріледі." });
  const cancelLabel = pickLang(lang, { ru: "Отмена", en: "Cancel", kk: "Болдырмау" });
  const restartLabel = pickLang(lang, { ru: "Начать заново", en: "Restart", kk: "Қайта бастау" });

  const handleRestartPress = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    appAlert(restartTitle, restartMsg, [
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

      {/* iMessage-style pill: recorded bars solid, empty slots as dim dots —
          progress is read from brightness only, no playhead. */}
      <WavePill style={{ width: "100%", marginTop: rs(19) }}>
        <WaveBars values={visible.map(norm)} lit={visible.length} slots={VISIBLE_BARS} />
      </WavePill>

      <View style={[styles.controls, stopOnly && { justifyContent: "center" }]}>
        {!stopOnly && <Pressable
          onPress={handleRestartPress}
          accessibilityRole="button"
          accessibilityLabel={restartLabel}
          hitSlop={10}
          style={({ pressed }) => [styles.iconBtn, { opacity: pressed ? 0.6 : 1 }]}
          testID="waveform-restart"
        >
          <Text numberOfLines={1} style={[styles.restartText, { color: theme.accentInk }]}>
            {pickLang(lang, { ru: "Заново", en: "Again", kk: "Қайталау" })}
          </Text>
        </Pressable>}

        <Pressable
          onPress={handleStop}
          accessibilityRole="button"
          accessibilityLabel={stopLabel}
          style={({ pressed }) => [
            styles.stopPill,
            { backgroundColor: theme.accent, opacity: pressed ? 0.85 : 1 },
          ]}
          testID="waveform-stop"
        >
          <RecGlyph kind="stop" size={rs(40)} />
          <Text style={[styles.stopPillText, { color: theme.accentText }]}>{stopLabel}</Text>
        </Pressable>

        {!stopOnly && <RecButton
          kind={isPaused ? "record" : "pause"}
          size={rs(50)}
          onPress={handlePauseToggle}
          accessibilityLabel={
            isPaused
              ? pickLang(lang, { ru: "Продолжить", en: "Resume", kk: "Жалғастыру" })
              : pickLang(lang, { ru: "Пауза", en: "Pause", kk: "Кідірту" })
          }
          testID="waveform-pause"
        />}
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
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 25,
    marginTop: 23,
  },
  iconBtn: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  restartText: {
    fontFamily: "Geologica_700Bold",
    fontSize: 13,
  },
  stopPill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    minWidth: 140,
    height: 50,
    paddingHorizontal: 20,
    borderRadius: 32,
  },
  stopPillText: {
    fontFamily: "Geologica_700Bold",
    fontSize: 16,
  },
});
