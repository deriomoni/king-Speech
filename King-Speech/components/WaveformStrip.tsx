import React from "react";
import { View, StyleSheet } from "react-native";
import {
  useWaveformBars,
  WAVEFORM_BAR_MAX,
  WAVEFORM_MAX_BARS,
} from "@/hooks/useWaveformBars";

const RED = "#FF3B30";
const RED_SOFT = "rgba(255,59,48,0.10)";
const RED_BORDER = "rgba(255,59,48,0.28)";
const DOT_DIM = "rgba(255,59,48,0.22)";

const BAR_WIDTH = 4;
const BAR_GAP = 3;

interface Props {
  isRecording: boolean;
  isPaused?: boolean;
  recording?: any | null;
  webStream?: MediaStream | null;
  /** Override the bar/dot fill color (defaults to red). */
  color?: string;
  /** Override the panel height — bars are clamped to this (max 56). */
  height?: number;
  maxBars?: number;
  showPanel?: boolean;
}

/**
 * Bars-only live waveform — renders a slim panel of red bars driven by live
 * mic amplitude. No timer, no controls — for screens that already own the
 * recording lifecycle (ReadingLevelView, showtime-stage).
 */
export default function WaveformStrip({
  isRecording,
  isPaused = false,
  recording,
  webStream,
  color = RED,
  height = 56,
  maxBars = WAVEFORM_MAX_BARS,
  showPanel = true,
}: Props) {
  const { bars } = useWaveformBars({
    isRecording,
    isPaused,
    recording,
    webStream,
    maxBars,
  });

  const remainingSlots = Math.max(0, maxBars - bars.length);
  const innerHeight = Math.min(height, WAVEFORM_BAR_MAX);

  const content = (
    <View style={[styles.inner, { height: innerHeight }]}>
      {bars.map((b) => (
        <View
          key={b.id}
          style={{
            width: BAR_WIDTH,
            height: Math.min(b.height, innerHeight),
            opacity: b.opacity,
            borderRadius: 2,
            backgroundColor: color,
            marginRight: BAR_GAP,
          }}
        />
      ))}
      {Array.from({ length: remainingSlots }).map((_, i) => (
        <View
          key={`d-${i}`}
          style={{
            width: BAR_WIDTH,
            height: BAR_WIDTH,
            borderRadius: BAR_WIDTH / 2,
            backgroundColor: DOT_DIM,
            marginRight: BAR_GAP,
          }}
        />
      ))}
    </View>
  );

  if (!showPanel) return content;

  return (
    <View
      style={[
        styles.panel,
        { height: height + 16, borderColor: RED_BORDER, backgroundColor: RED_SOFT },
      ]}
    >
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    width: "100%",
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 10,
    justifyContent: "center",
    overflow: "hidden",
  },
  inner: {
    flexDirection: "row",
    alignItems: "center",
  },
});
