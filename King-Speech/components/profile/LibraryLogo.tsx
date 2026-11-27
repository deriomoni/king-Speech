import React from "react";
import Svg, { Rect, G } from "react-native-svg";

// «Библиотека» tile illustration: a shelf of flat colourful book spines of
// different heights, one leaning on its neighbour. Colours from the profile
// palette (Röntgen, Raman, Alvarez, Curie, Einstein, Ružička).
const BOOKS: { x: number; w: number; h: number; c: string; tilt?: number }[] = [
  { x: 4, w: 15, h: 66, c: "#5C5BEE" },
  // leans right on its bottom-right corner; its top stops ~3pt short of the red book
  { x: 22, w: 15, h: 54, c: "#A0A3FF", tilt: 14 },
  { x: 53, w: 15, h: 72, c: "#EE6869" },
  { x: 70, w: 15, h: 58, c: "#FDBC00" },
  { x: 87, w: 15, h: 68, c: "#D6E82B" },
  { x: 104, w: 15, h: 62, c: "#3339A2" },
];

export default function LibraryLogo({ width, height, style }: { width: number; height: number; style?: any }) {
  const base = 76;
  return (
    <Svg width={width} height={height} viewBox="0 0 123 80" style={style} pointerEvents="none">
      {BOOKS.map((b, i) => {
        const y = base - b.h;
        const book = (
          <G key={i}>
            <Rect x={b.x} y={y} width={b.w} height={b.h} rx={2} fill={b.c} />
          </G>
        );
        // lean the book onto its right neighbour, pivoting on its bottom-right corner
        return b.tilt ? (
          <G key={i} transform={`rotate(${b.tilt} ${b.x + b.w} ${base})`}>
            {book}
          </G>
        ) : (
          book
        );
      })}
    </Svg>
  );
}
