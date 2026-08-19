import React, { useMemo } from "react";
import { StyleSheet, useWindowDimensions } from "react-native";
import Svg, { G, Path } from "react-native-svg";
import { getPathPattern, type PathPattern } from "@/constants/pathPatterns";
import { patternInk } from "@/constants/pathPalette";

/**
 * The symbol pattern that sits on top of the flat Path background.
 *
 * The artwork is the user's hand-drawn composition for that module, kept
 * exactly as drawn; constants/pathPatterns.ts holds it verbatim together with
 * the scale and the clone pitch (see that file for how those are derived).
 * This component only stamps the composition across the viewport:
 *
 *   • clones sit pitchX / pitchY apart, with every other column dropped half
 *     a row so the field reads as wallpaper rather than as a grid;
 *   • the field is nudged off the corner by phaseX / phaseY, so the first
 *     clone is cropped mid-composition instead of sitting flush;
 *   • clones that cannot touch the viewport are skipped, so a phone screen
 *     costs only the handful of stamps it can actually show;
 *   • the ink is the module's own background pushed one step darker/lighter,
 *     so the pattern is felt more than it is read.
 *
 * Like the flat background it is anchored to a module: it stays put while the
 * ladder scrolls and only changes when the module changes.
 */

/** One stamp of the composition, resolved to viewport coordinates. */
interface Clone {
  key: string;
  /** G transform props */
  x: number;
  y: number;
}

function layout(p: PathPattern, width: number, height: number): Clone[] {
  const compW = p.bw * p.scale;
  const compH = p.bh * p.scale;

  const colFrom = Math.floor((-compW - p.phaseX) / p.pitchX);
  const colTo = Math.ceil((width - p.phaseX) / p.pitchX);
  // The half-drop can push a column up by `drop`, so start one row earlier.
  const rowFrom = Math.floor((-compH - p.drop - p.phaseY) / p.pitchY);
  const rowTo = Math.ceil((height - p.phaseY) / p.pitchY);

  const out: Clone[] = [];
  for (let col = colFrom; col <= colTo; col++) {
    const x0 = p.phaseX + col * p.pitchX;
    if (x0 + compW < 0 || x0 > width) continue;
    // Modulo that stays correct for negative columns.
    const dropped = ((col % 2) + 2) % 2 === 1 ? p.drop : 0;
    for (let row = rowFrom; row <= rowTo; row++) {
      const y0 = p.phaseY + row * p.pitchY + dropped;
      if (y0 + compH < 0 || y0 > height) continue;
      out.push({ key: `${col}.${row}`, x: x0 - p.bx, y: y0 - p.by });
    }
  }
  return out;
}

function PathPatternBackgroundBase({
  moduleNum,
  bg,
}: {
  /** module whose composition to stamp */
  moduleNum: number;
  /** the flat Path background colour underneath, already theme-resolved */
  bg: string;
}) {
  const { width, height } = useWindowDimensions();

  const pattern = getPathPattern(moduleNum);
  const clones = useMemo(
    () => (pattern ? layout(pattern, width, height) : []),
    [pattern, width, height],
  );
  const ink = useMemo(() => patternInk(bg), [bg]);

  // Modules past the drawn set keep the plain background.
  if (!pattern || clones.length === 0) return null;

  return (
    <Svg
      style={StyleSheet.absoluteFill}
      width={width}
      height={height}
      pointerEvents="none"
    >
      {clones.map((c) => (
        <G
          key={c.key}
          x={c.x}
          y={c.y}
          scale={pattern.scale}
          originX={pattern.bx}
          originY={pattern.by}
        >
          {pattern.paths.map((d, i) => (
            <Path key={i} d={d} fill={ink} />
          ))}
        </G>
      ))}
    </Svg>
  );
}

/** Memoized — only re-renders when the module or the background colour change. */
export const PathPatternBackground = React.memo(PathPatternBackgroundBase);
