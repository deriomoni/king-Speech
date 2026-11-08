import React from "react";
import { StyleSheet, View } from "react-native";
import { useTheme } from "@/context/ThemeContext";
import { type WaveBar, WAVEFORM_BAR_MIN, WAVEFORM_BAR_MAX } from "@/hooks/useWaveformBars";

/**
 * Figma "Recorder bar" (instance 151:1659 in «Словарный запас · Игра»): a 72pt
 * pill with a 4pt translucent-ink rim, live 3pt bars growing left → right, a
 * gold playhead (dot on top) at the live edge and a faint rest line after it.
 */
const BAR_W = 3;
const BAR_GAP = 3.5;
const BAR_MAX_H = 40;
const VISIBLE = 30;

export default function RecorderBar({ bars, dim = false }: { bars: WaveBar[]; dim?: boolean }) {
  const { theme, themeMode } = useTheme();
  const isDark = themeMode === "dark";
  const rim = isDark ? "rgba(240,238,233,0.45)" : "rgba(38,38,40,0.3)";
  const rest = isDark ? "rgba(240,238,233,0.25)" : "rgba(38,38,40,0.2)";
  const visible = bars.slice(-VISIBLE);
  return (
    <View style={[styles.pill, { borderColor: rim, backgroundColor: theme.bg }]}>
      <View style={[styles.inner, dim && { opacity: 0.45 }]}>
        {visible.map((b) => {
          const t = Math.max(0, Math.min(1, (b.height - WAVEFORM_BAR_MIN) / (WAVEFORM_BAR_MAX - WAVEFORM_BAR_MIN)));
          return (
            <View
              key={b.id}
              style={[styles.bar, { height: 6 + t * (BAR_MAX_H - 6), backgroundColor: theme.text }]}
            />
          );
        })}
        <View style={styles.playheadWrap}>
          <View style={[styles.playheadDot, { backgroundColor: theme.accent }]} />
          <View style={[styles.playhead, { backgroundColor: theme.accent }]} />
        </View>
        <View style={[styles.rest, { backgroundColor: rest }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    overflow: "hidden",
    paddingHorizontal: 24,
    justifyContent: "center",
  },
  inner: { flexDirection: "row", alignItems: "center", height: 56, gap: BAR_GAP },
  bar: { width: BAR_W, borderRadius: 1.5 },
  playheadWrap: { width: 8, height: 50, alignItems: "center", marginHorizontal: -2.75 },
  playheadDot: { width: 8, height: 8, borderRadius: 4 },
  playhead: { width: 2.5, height: 46, borderRadius: 1.25, marginTop: -4 },
  rest: { flex: 1, height: 2, borderRadius: 1 },
});
