import React, { useMemo } from "react";
import { Dimensions, StyleSheet, View } from "react-native";
import {
  BlurMask,
  Canvas,
  Circle,
  Group,
  LinearGradient,
  Path,
  Rect,
  Skia,
  vec,
} from "@shopify/react-native-skia";
import { useDerivedValue } from "react-native-reanimated";
import type { SharedValue } from "react-native-reanimated";
import { warmupTheme } from "@/components/warmup/warmupTheme";
import type { HitZone } from "@/services/warmupScoring";
import {
  BALL_R,
  BALL_X_RATIO,
  PLATFORM_BASE_Y,
  PX_PER_SEC,
  TRACK_HEIGHT,
  auraColorForZone,
  passWidthPx,
  segW,
  segX,
  toothPathCmds,
  yForOffset,
  type TrackSegment,
} from "@/components/warmup/pitchTrackGeometry";

const TRACK_W = Dimensions.get("window").width - 40;
const BALL_X = TRACK_W * BALL_X_RATIO;
const AURA_R = 26;
const TRAIL_W = 48;
const SPOT_R = 105;
const SPARK_ANGLES = [0, 60, 120, 180, 240, 300];
const SPARK_RADIUS = 30;

interface Props {
  segments: TrackSegment[];
  passSec: number;
  clockSec: SharedValue<number>;
  ballY01: SharedValue<number>;
  glow01: SharedValue<number>;
  burst01: SharedValue<number>;
  activeIndex: number;
  activeFill01: number;
  held: boolean;
  moduleColor: string;
  hitZone: HitZone;
}

function buildPath(segs: TrackSegment[]) {
  const p = Skia.Path.Make();
  segs.forEach((seg) => {
    const cmds = toothPathCmds(
      segX(seg),
      segW(seg),
      yForOffset(seg.offsetNorm),
      PLATFORM_BASE_Y,
    );
    cmds.forEach((c) => {
      if (c.t === "M") p.moveTo(c.x, c.y);
      else if (c.t === "L") p.lineTo(c.x, c.y);
      else p.quadTo(c.cx, c.cy, c.x, c.y);
    });
    p.close();
  });
  return p;
}

export default function PitchTrackSkiaImpl({
  segments,
  passSec,
  clockSec,
  ballY01,
  glow01,
  burst01,
  activeIndex,
  activeFill01,
  held,
  moduleColor,
  hitZone,
}: Props) {
  const passW = useMemo(() => passWidthPx(passSec), [passSec]);
  const passPath = useMemo(() => buildPath(segments), [segments]);
  const active = segments[activeIndex];
  const activePath = useMemo(
    () => (active ? buildPath([active]) : null),
    [active],
  );
  const aura = auraColorForZone(hitZone);

  const worldTransform = useDerivedValue(() => [
    { translateX: BALL_X - (clockSec.value % passSec) * PX_PER_SEC },
  ]);
  const ballTransform = useDerivedValue(() => [
    { translateX: BALL_X },
    { translateY: yForOffset(ballY01.value) },
  ]);
  const auraR = useDerivedValue(
    () => AURA_R * (1 + glow01.value * 0.4 + burst01.value * 0.5),
  );
  const auraOpacity = useDerivedValue(
    () => 0.3 + glow01.value * 0.45 + burst01.value * 0.25,
  );
  const spotOpacity = useDerivedValue(() => 0.14 + glow01.value * 0.28);

  return (
    <View style={styles.wrap}>
      <Canvas style={{ width: TRACK_W, height: TRACK_HEIGHT }}>
        {/* Spotlight behind the ball — brightens when on pitch. */}
        <Circle
          cx={BALL_X}
          cy={TRACK_HEIGHT / 2}
          r={SPOT_R}
          color={warmupTheme.gold}
          opacity={spotOpacity}
        >
          <BlurMask blur={45} style="normal" />
        </Circle>

        {/* Faint staff lines. */}
        {[0.28, 0.5, 0.72].map((f) => (
          <Rect
            key={f}
            x={0}
            y={20 + f * (TRACK_HEIGHT - 60)}
            width={TRACK_W}
            height={1}
            color="#ffffff14"
          />
        ))}

        {/* Scrolling note world: 3 seamless copies of one pass. */}
        <Group transform={worldTransform}>
          {[-1, 0, 1].map((k) => (
            <Group key={k} transform={[{ translateX: k * passW }]}>
              <Path path={passPath} color={moduleColor + "59"} />
              <Path
                path={passPath}
                color={moduleColor + "99"}
                style="stroke"
                strokeWidth={1}
              />
            </Group>
          ))}

          {activePath && (
            <>
              <Path path={activePath} color={moduleColor} />
              <Path
                path={activePath}
                color="#FFFFFF"
                style="stroke"
                strokeWidth={1.5}
              />
            </>
          )}

          {held && active && (
            <Rect
              x={segX(active)}
              y={PLATFORM_BASE_Y - 5}
              width={Math.max(0, segW(active) * activeFill01)}
              height={5}
              color={warmupTheme.cleanMint}
            />
          )}
        </Group>

        {/* Ball rig: fixed x, follows pitch vertically. */}
        <Group transform={ballTransform}>
          <Rect
            x={-TRAIL_W}
            y={-(BALL_R - 2)}
            width={TRAIL_W}
            height={(BALL_R - 2) * 2}
          >
            <LinearGradient
              start={vec(-TRAIL_W, 0)}
              end={vec(0, 0)}
              colors={["#FFD85700", warmupTheme.gold]}
            />
          </Rect>

          <Circle cx={0} cy={0} r={auraR} color={aura} opacity={auraOpacity}>
            <BlurMask blur={10} style="normal" />
          </Circle>

          <Group opacity={burst01}>
            {SPARK_ANGLES.map((deg, i) => {
              const rad = (deg * Math.PI) / 180;
              return (
                <Circle
                  key={i}
                  cx={Math.cos(rad) * SPARK_RADIUS}
                  cy={Math.sin(rad) * SPARK_RADIUS}
                  r={2.5}
                  color={warmupTheme.gold}
                />
              );
            })}
          </Group>

          <Circle cx={0} cy={0} r={BALL_R + 3} color={warmupTheme.gold} opacity={0.5}>
            <BlurMask blur={8} style="normal" />
          </Circle>
          <Circle cx={0} cy={0} r={BALL_R} color={warmupTheme.gold} />
        </Group>
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: "center" },
});
