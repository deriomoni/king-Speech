import React, { useState } from "react";
import { View, StyleSheet } from "react-native";
import Svg, { Defs, LinearGradient, Stop, Ellipse, G, Path } from "react-native-svg";

// Loose gold coins tumbling across the «Купить монеты» tile (reference: coins
// flying at different angles and depths). Each coin is a tilted disc: a dark
// rim showing its thickness, a bright face and an embossed inner ring.
// Positions are fractions of the tile so they stay put on any screen width.

type CoinSpec = { x: number; y: number; r: number; tilt: number; squash: number; op?: number };

// Composition: the stack sits on the right; one big coin in front of it at
// the bottom-left, one above its left shoulder, two cut by the right edge
// (depth), and one small coin in the gap between badge and title.
const COINS: CoinSpec[] = [
  { x: 0.585, y: 0.64, r: 16, tilt: 18, squash: 0.52 },
  { x: 0.625, y: 0.15, r: 10, tilt: -24, squash: 0.72 },
  { x: 0.99, y: 0.2, r: 15, tilt: 34, squash: 0.6 },
  { x: 1.0, y: 0.8, r: 14, tilt: -18, squash: 0.5 },
  { x: 0.52, y: 0.42, r: 5.5, tilt: -10, squash: 0.85, op: 0.9 },
];

/** One colour for every glint on the tile (the stack art uses it too). */
export const SPARK_COLOR = "#FFE7A0";

// a single extra glint; the stack art carries two more in the same colour
const SPARKS = [{ x: 0.56, y: 0.33, s: 4 }];

const sparkPath = (x: number, y: number, s: number) =>
  `M ${x} ${y - s} Q ${x} ${y} ${x + s} ${y} Q ${x} ${y} ${x} ${y + s} Q ${x} ${y} ${x - s} ${y} Q ${x} ${y} ${x} ${y - s} Z`;

function Coin({ c, w, h, id }: { c: CoinSpec; w: number; h: number; id: string }) {
  const cx = c.x * w;
  const cy = c.y * h;
  const ry = c.r * c.squash;
  const thick = Math.max(1.8, c.r * 0.3);
  return (
    <G transform={`rotate(${c.tilt} ${cx} ${cy})`} opacity={c.op ?? 1}>
      {/* rim / thickness */}
      <Ellipse cx={cx} cy={cy + thick} rx={c.r} ry={ry} fill="#B9780F" />
      <Ellipse cx={cx} cy={cy + thick * 0.5} rx={c.r} ry={ry} fill="#D99A22" />
      {/* face */}
      <Ellipse cx={cx} cy={cy} rx={c.r} ry={ry} fill={`url(#${id})`} />
      {/* embossed ring */}
      <Ellipse cx={cx} cy={cy} rx={c.r * 0.72} ry={ry * 0.72} fill="none" stroke="#E3A52C" strokeWidth={Math.max(0.8, c.r * 0.12)} />
      {/* crown ornament, like on the stacked coins */}
      <G transform={`translate(${cx} ${cy}) scale(1 ${c.squash})`}>
        <Path
          d={`M ${-0.42 * c.r} ${0.2 * c.r} L ${-0.42 * c.r} ${-0.14 * c.r} L ${-0.2 * c.r} ${0.04 * c.r} L 0 ${-0.26 * c.r} L ${0.2 * c.r} ${0.04 * c.r} L ${0.42 * c.r} ${-0.14 * c.r} L ${0.42 * c.r} ${0.2 * c.r} Z`}
          fill="#E9A21F"
        />
      </G>
      {/* glint */}
      <Ellipse cx={cx - c.r * 0.35} cy={cy - ry * 0.4} rx={c.r * 0.22} ry={ry * 0.14} fill="#FFFFFF" opacity={0.55} />
    </G>
  );
}

export default function CoinScatter() {
  const [size, setSize] = useState({ w: 0, h: 0 });
  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
      {size.w > 0 && (
        <Svg width={size.w} height={size.h}>
          <Defs>
            <LinearGradient id="coinFace" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#FFF0A8" />
              <Stop offset="0.5" stopColor="#FFD45A" />
              <Stop offset="1" stopColor="#F0A92E" />
            </LinearGradient>
          </Defs>
          {COINS.map((c, i) => (
            <Coin key={i} c={c} w={size.w} h={size.h} id="coinFace" />
          ))}
          {SPARKS.map((p, i) => (
            <Path key={`s${i}`} d={sparkPath(p.x * size.w, p.y * size.h, p.s)} fill={SPARK_COLOR} />
          ))}
        </Svg>
      )}
    </View>
  );
}
