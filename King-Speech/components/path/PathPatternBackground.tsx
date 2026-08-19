import React, { useMemo } from "react";
import { StyleSheet, useWindowDimensions } from "react-native";
import Svg, { G, Path } from "react-native-svg";
import {
  getPathPattern,
  type PathPattern,
  type PatternSymbol,
} from "@/constants/pathPatterns";
import { patternInk } from "@/constants/pathPalette";

/**
 * The symbol pattern that sits on top of the flat Path background.
 *
 * The motifs are the user's hand-drawn symbol groups; constants/pathPatterns.ts
 * holds one repeat tile per module (see that file for how the spacing is
 * derived). This component only lays that tile out over the viewport:
 *
 *   • the tile repeats in both axes, starting one ring outside the screen so
 *     motifs that overhang a tile edge are still drawn by their neighbour;
 *   • every clone is culled if it cannot touch the viewport, so a phone screen
 *     costs ~25-35 paths instead of the full grid;
 *   • the ink is the module's own background pushed one step darker/lighter,
 *     so the pattern is felt more than it is read.
 *
 * Like the flat background it is anchored to a module: it stays put while the
 * ladder scrolls and only changes when the module changes.
 */

/** A single clone, already resolved to viewport coordinates. */
interface Placed {
  key: string;
  sym: PatternSymbol;
  /** G transform props */
  x: number;
  y: number;
  rotation: number;
  originX: number;
  originY: number;
  scaleX: number;
  scaleY: number;
}

function layout(
  pattern: PathPattern,
  width: number,
  height: number,
): Placed[] {
  const { tile, symbols, items } = pattern;

  // How far a clone can stick out from its centre once rotated: half of its
  // longest edge, times the diagonal factor. Used both to size the ring of
  // off-screen tiles and to cull clones that cannot reach the viewport.
  const reach = (i: (typeof items)[number]) =>
    (symbols[i.s].size * i.scale * Math.SQRT2) / 2;
  const maxReach = items.reduce((m, i) => Math.max(m, reach(i)), 0);

  const colFrom = Math.floor(-maxReach / tile);
  const colTo = Math.ceil((width + maxReach) / tile);
  const rowFrom = Math.floor(-maxReach / tile);
  const rowTo = Math.ceil((height + maxReach) / tile);

  const out: Placed[] = [];
  for (let col = colFrom; col <= colTo; col++) {
    for (let row = rowFrom; row <= rowTo; row++) {
      for (let n = 0; n < items.length; n++) {
        const it = items[n];
        const cx = col * tile + it.x;
        const cy = row * tile + it.y;
        const r = reach(it);
        if (cx + r < 0 || cx - r > width) continue;
        if (cy + r < 0 || cy - r > height) continue;

        const sym = symbols[it.s];
        // Scale so the motif's longest edge lands on its target size.
        const k = (sym.size * it.scale) / Math.max(sym.w, sym.h);
        // Rotate + scale around the motif's own bbox centre, then move that
        // centre onto (cx, cy).
        const bcx = sym.x + sym.w / 2;
        const bcy = sym.y + sym.h / 2;
        out.push({
          key: `${col}.${row}.${n}`,
          sym,
          x: cx - bcx,
          y: cy - bcy,
          rotation: it.rot,
          originX: bcx,
          originY: bcy,
          scaleX: it.flipX ? -k : k,
          scaleY: it.flipY ? -k : k,
        });
      }
    }
  }
  return out;
}

function PathPatternBackgroundBase({
  moduleNum,
  bg,
}: {
  /** module whose motif set + spacing to draw */
  moduleNum: number;
  /** the flat Path background colour underneath, already theme-resolved */
  bg: string;
}) {
  const { width, height } = useWindowDimensions();

  const pattern = getPathPattern(moduleNum);
  const placed = useMemo(
    () => (pattern ? layout(pattern, width, height) : []),
    [pattern, width, height],
  );
  const ink = useMemo(() => patternInk(bg), [bg]);

  // Modules past the drawn set keep the plain background.
  if (!pattern || placed.length === 0) return null;

  return (
    <Svg
      style={StyleSheet.absoluteFill}
      width={width}
      height={height}
      pointerEvents="none"
    >
      {placed.map((p) => (
        <G
          key={p.key}
          x={p.x}
          y={p.y}
          rotation={p.rotation}
          originX={p.originX}
          originY={p.originY}
          scaleX={p.scaleX}
          scaleY={p.scaleY}
        >
          <Path d={p.sym.d} fill={ink} />
        </G>
      ))}
    </Svg>
  );
}

/** Memoized — only re-renders when the module or the background colour change. */
export const PathPatternBackground = React.memo(PathPatternBackgroundBase);
