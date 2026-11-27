import React from "react";
import { WavePill, WaveBars } from "@/components/VoiceWave";
import { type WaveBar, WAVEFORM_BAR_MIN, WAVEFORM_BAR_MAX } from "@/hooks/useWaveformBars";

/**
 * Vocabulary recorder bar: the shared iMessage-style voice pill. Recorded bars
 * are solid, empty slots are dim dots — no playhead.
 */
const VISIBLE = 34;

export default function RecorderBar({ bars, dim = false }: { bars: WaveBar[]; dim?: boolean }) {
  const visible = bars.slice(-VISIBLE);
  const values = visible.map((b) =>
    Math.max(0, Math.min(1, (b.height - WAVEFORM_BAR_MIN) / (WAVEFORM_BAR_MAX - WAVEFORM_BAR_MIN))),
  );
  return (
    <WavePill style={dim ? { opacity: 0.45 } : undefined}>
      <WaveBars values={values} lit={values.length} slots={VISIBLE} />
    </WavePill>
  );
}
