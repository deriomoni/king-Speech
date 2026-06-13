/**
 * Shared, pure geometry for the warmup pitch-game scene.
 *
 * Both renderers consume this so the web (Reanimated) and native (Skia)
 * tracks stay pixel-consistent. Keep this file free of any rendering imports.
 */
import { warmupTheme } from "@/components/warmup/warmupTheme";
import type { HitZone } from "@/services/warmupScoring";

export interface TrackSegment {
  index: number;
  syllable: string;
  noteLabel: string;
  offsetNorm: number;
  durationSec: number;
  startSec: number;
}

/** Horizontal scroll speed of the note world (px per second of song time). */
export const PX_PER_SEC = 88;
/** Ball is pinned at this fraction of the track width; the world scrolls under it. */
export const BALL_X_RATIO = 0.28;
/** Minimum platform width so very short notes stay visible. */
export const MIN_NOTE_W = 44;
/** Track drawing height. */
export const TRACK_HEIGHT = 220;
/** Ball radius. */
export const BALL_R = 13;

const Y_TOP = 34;
const Y_BOTTOM_INSET = 52;
/** Flat base of every platform (near the bottom of the track). */
export const PLATFORM_BASE_Y = TRACK_HEIGHT - 22;

export function buildTrackSegments(
  syllables: string[],
  notes: string[],
  offsets: number[],
  durations: number[],
): TrackSegment[] {
  let start = 0;
  return offsets.map((offsetNorm, i) => {
    const seg: TrackSegment = {
      index: i,
      syllable: syllables[i] ?? "",
      noteLabel: notes[i] ?? "",
      offsetNorm,
      durationSec: durations[i] ?? 1,
      startSec: start,
    };
    start += seg.durationSec;
    return seg;
  });
}

export function passDurationSec(segments: TrackSegment[]): number {
  if (segments.length === 0) return 1;
  const last = segments[segments.length - 1];
  return last.startSec + last.durationSec;
}

/** Index of the segment under the ball for a given position within one pass. */
export function activeSegmentIndexAt(
  segments: TrackSegment[],
  posInPass: number,
): number {
  let idx = 0;
  for (let i = segments.length - 1; i >= 0; i--) {
    if (posInPass >= segments[i].startSec) {
      idx = i;
      break;
    }
  }
  return idx;
}

export function passWidthPx(passSec: number): number {
  return passSec * PX_PER_SEC;
}

export function segX(seg: TrackSegment): number {
  return seg.startSec * PX_PER_SEC;
}

export function segW(seg: TrackSegment): number {
  return Math.max(MIN_NOTE_W, seg.durationSec * PX_PER_SEC);
}

/**
 * Vertical position for an offset 0..1 — apex for platforms, center for the ball.
 * offset 1 (high note) → top of the track, offset 0 (low note) → bottom.
 * Worklet-safe so it can run inside Reanimated/Skia derived values.
 */
export function yForOffset(offset01: number, trackH: number = TRACK_HEIGHT): number {
  "worklet";
  const bottom = trackH - Y_BOTTOM_INSET;
  const top = Y_TOP;
  const o = offset01 < 0 ? 0 : offset01 > 1 ? 1 : offset01;
  return bottom - o * (bottom - top);
}

export function auraColorForZone(zone: HitZone): string {
  return zone === "clean"
    ? warmupTheme.cleanMint
    : zone === "touch"
      ? warmupTheme.touchLavender
      : warmupTheme.missRed;
}

export type PathCmd =
  | { t: "M"; x: number; y: number }
  | { t: "L"; x: number; y: number }
  | { t: "Q"; cx: number; cy: number; x: number; y: number };

/**
 * A rounded "crown tooth" platform (apex up). Narrow notes form a rounded
 * point; wide "sausage" notes form a flat rounded plateau you can ride along.
 * Returned as command list so web (SVG) and native (Skia) share exact geometry.
 */
export function toothPathCmds(
  x: number,
  w: number,
  apexY: number,
  baseY: number,
): PathCmd[] {
  const cx = x + w / 2;
  const plateau = Math.max(0, w - 52);
  const lx = cx - plateau / 2;
  const rx = cx + plateau / 2;
  const r = 11;
  return [
    { t: "M", x, y: baseY },
    { t: "L", x: lx - r * 0.7, y: apexY + r },
    { t: "Q", cx: lx, cy: apexY, x: lx + Math.min(r, plateau / 2 || r), y: apexY },
    { t: "L", x: rx - Math.min(r, plateau / 2 || r), y: apexY },
    { t: "Q", cx: rx, cy: apexY, x: rx + r * 0.7, y: apexY + r },
    { t: "L", x: x + w, y: baseY },
    { t: "L", x, y: baseY },
  ];
}

export function toothSvgPath(
  x: number,
  w: number,
  apexY: number,
  baseY: number,
): string {
  return toothPathCmds(x, w, apexY, baseY)
    .map((c) => {
      if (c.t === "M") return `M ${c.x} ${c.y}`;
      if (c.t === "L") return `L ${c.x} ${c.y}`;
      return `Q ${c.cx} ${c.cy} ${c.x} ${c.y}`;
    })
    .join(" ") + " Z";
}
