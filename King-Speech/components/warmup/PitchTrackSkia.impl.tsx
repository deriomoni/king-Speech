import React, { useMemo } from "react";
import { Dimensions, StyleSheet, View } from "react-native";
import {
  Canvas,
  Circle,
  Group,
  Path,
  Rect,
  Skia,
} from "@shopify/react-native-skia";
import { useDerivedValue } from "react-native-reanimated";
import type { SharedValue } from "react-native-reanimated";
import { warmupTheme } from "@/components/warmup/warmupTheme";
import type { HitZone } from "@/services/warmupScoring";
import type { TrackSegment } from "@/components/warmup/PitchTrack";
import { passDurationSec } from "@/components/warmup/PitchTrack";

const TRACK_W = Dimensions.get("window").width - 40;
const TRACK_H = 200;

interface Props {
  segments: TrackSegment[];
  progress01: SharedValue<number>;
  ballY01: SharedValue<number>;
  activeIndex: number;
  moduleColor: string;
  hitZone: HitZone;
}

function trianglePath(x: number, y: number, w: number, h: number) {
  const p = Skia.Path.Make();
  p.moveTo(x, y + h);
  p.lineTo(x + w / 2, y);
  p.lineTo(x + w, y + h);
  p.close();
  return p;
}

export default function PitchTrackSkiaImpl({
  segments,
  progress01,
  ballY01,
  activeIndex,
  moduleColor,
  hitZone,
}: Props) {
  const passSec = useMemo(() => passDurationSec(segments), [segments]);

  const ballCx = useDerivedValue(() => progress01.value * (TRACK_W - 28) + 12);
  const ballCy = useDerivedValue(
    () => (1 - ballY01.value) * (TRACK_H - 50) + 20,
  );

  const aura =
    hitZone === "clean"
      ? warmupTheme.cleanMint
      : hitZone === "touch"
        ? warmupTheme.touchLavender
        : warmupTheme.missRed;

  return (
    <View style={styles.wrap}>
      <Canvas style={{ width: TRACK_W, height: TRACK_H }}>
        <Rect
          x={TRACK_W / 2 - 80}
          y={20}
          width={160}
          height={160}
          color={warmupTheme.purple + "33"}
        />
        <Group>
          {segments.map((seg, i) => {
            const x = (seg.startSec / passSec) * (TRACK_W - 40);
            const w = Math.max(18, (seg.durationSec / passSec) * (TRACK_W - 20));
            const y = (1 - seg.offsetNorm) * (TRACK_H - 40);
            const path = trianglePath(x, y, w, 22);
            return (
              <Path
                key={`sk-${seg.index}-${i}`}
                path={path}
                color={i === activeIndex ? moduleColor : moduleColor + "88"}
              />
            );
          })}
          <Circle cx={ballCx} cy={ballCy} r={18} color={aura} opacity={0.35} />
          <Circle cx={ballCx} cy={ballCy} r={12} color={warmupTheme.gold} />
        </Group>
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: "center" },
});
