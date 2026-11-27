import React from "react";
import { View, Pressable, StyleSheet, type ViewStyle } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";
import { useTheme } from "@/context/ThemeContext";
import { rs } from "@/lib/responsive";

// iMessage-style voice pill (shared by every record / playback panel):
// a hairline rounded capsule, a bare ▶ / ❚❚ glyph on the left and rounded
// bars. Progress is shown ONLY by bar brightness — played / recorded bars are
// solid ink, the rest are the same ink at low opacity. Quiet bars collapse to
// dots. No playhead, no tracker.

export const WAVE_BAR_W = 3;
export const WAVE_BAR_GAP = 2.6;
const QUIET = 0.1;

export function useWaveColors() {
  const { theme } = useTheme();
  const dark = theme.mode === "dark";
  return {
    ink: theme.text,
    dim: dark ? "rgba(240,238,233,0.3)" : "rgba(38,38,40,0.28)",
    rim: dark ? "rgba(240,238,233,0.16)" : "rgba(38,38,40,0.14)",
    fill: theme.bg,
  };
}

/** Rounded capsule with a hairline rim. */
export function WavePill({ children, style }: { children: React.ReactNode; style?: ViewStyle | ViewStyle[] }) {
  const c = useWaveColors();
  return <View style={[styles.pill, { borderColor: c.rim, backgroundColor: c.fill }, style as any]}>{children}</View>;
}

/** Bare play / pause glyph (no disc). */
export function WavePlayButton({
  playing,
  onPress,
  disabled,
}: {
  playing: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  const c = useWaveColors();
  const s = rs(22);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={12}
      accessibilityRole="button"
      style={({ pressed }) => [styles.play, { opacity: pressed ? 0.6 : 1 }]}
    >
      <Svg width={s} height={s} viewBox="0 0 24 24">
        {playing ? (
          <>
            <Rect x={5} y={4} width={5} height={16} rx={1.4} fill={c.ink} />
            <Rect x={14} y={4} width={5} height={16} rx={1.4} fill={c.ink} />
          </>
        ) : (
          <Path d="M6 3.8C6 2.9 7 2.3 7.8 2.8L20.2 10.9C20.9 11.4 20.9 12.6 20.2 13.1L7.8 21.2C7 21.7 6 21.1 6 20.2Z" fill={c.ink} />
        )}
      </Svg>
    </Pressable>
  );
}

/**
 * Bars from normalized amplitudes (0..1). `lit` = how many bars (from the
 * left) are drawn solid; the rest are dimmed. `slots` pads the row with dim
 * dots up to a fixed count (used while recording).
 */
export function WaveBars({
  values,
  lit,
  slots,
  maxH = 34,
  justify = "space-between",
}: {
  values: number[];
  lit: number;
  slots?: number;
  maxH?: number;
  justify?: "space-between" | "flex-start";
}) {
  const c = useWaveColors();
  const n = Math.max(values.length, slots ?? 0);
  const items = Array.from({ length: n }, (_, i) => (i < values.length ? values[i] : -1));
  return (
    <View style={[styles.bars, { justifyContent: justify, gap: justify === "flex-start" ? rs(WAVE_BAR_GAP) : 0 }]}>
      {items.map((v, i) => {
        const on = v >= 0 && i < lit;
        const quiet = v < QUIET;
        const h = quiet ? rs(WAVE_BAR_W) : rs(6 + v * (maxH - 6));
        return (
          <View
            key={i}
            style={{
              width: rs(WAVE_BAR_W),
              height: h,
              borderRadius: rs(WAVE_BAR_W) / 2,
              backgroundColor: on ? c.ink : c.dim,
            }}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    height: rs(64),
    borderRadius: rs(32),
    borderWidth: 1.5,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: rs(20),
    overflow: "hidden",
  },
  play: { width: rs(30), height: rs(44), alignItems: "center", justifyContent: "center", marginRight: rs(12) },
  bars: { flex: 1, height: rs(44), flexDirection: "row", alignItems: "center" },
});
