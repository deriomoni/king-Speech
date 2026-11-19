// A minimal door built as a real 3D model and projected to SVG: a casing on
// the wall, a jamb with depth (its inner reveals catch the light from the
// room behind), and a slab with thickness that swings toward the viewer on
// its hinge. Faces are back-face culled and lit (key light + the warm light
// pouring out of the doorway). Callers drive `open` / `light` (0..1) from
// their own clock — the same door is used on the Path map and in the
// rank-up cut-scene.
import React, { useId } from "react";
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Pattern, Polygon, RadialGradient, Rect, Stop } from "react-native-svg";

export const DOOR_VB_W = 240;
export const DOOR_VB_H = 300;

// ── model (world units; y grows downward, z toward the viewer) ──────────────
const OW = 100; // opening width
const OH = 210; // opening height
const XL = -OW / 2;
const XR = OW / 2;
const YT = -OH;
const DEPTH = 26; // jamb depth
const CASE = 9; // casing width
const CASE_Z = 2.5; // casing proud of the wall
const SLAB_T = 6; // door thickness
const SLAB_GAP = 2; // light gap under the door

// ── camera ──────────────────────────────────────────────────────────────────
// three-quarter view from the front-right, a little above the head — the
// jamb depth, the casing returns and the slab thickness all read as 3D.
const CAM = { x: 80, y: -240, z: 560 };
const F = 560;
const OX = 213;
const OY = -4;

type V3 = [number, number, number];
const proj = (p: V3): [number, number] => {
  const k = F / (CAM.z - p[2]);
  return [OX + (p[0] - CAM.x) * k, OY + (p[1] - CAM.y) * k];
};

// The model is built hinged-left / camera-right and the whole drawing is
// mirrored, so on screen the door hangs on the RIGHT jamb and swings open to
// the right, seen from the front-left.
/** Doorway centre / the lit gap beside a fully opened door / floor line — as 0..1 of the box. */
const pc = proj([0, YT / 2, 0]);
export const DOORWAY_CENTER = { x: 1 - pc[0] / DOOR_VB_W, y: pc[1] / DOOR_VB_H };
const pg = proj([14, YT / 2, -DEPTH / 2]);
export const DOORWAY_GAP_CENTER = { x: 1 - pg[0] / DOOR_VB_W, y: pg[1] / DOOR_VB_H };
export const DOOR_FLOOR_Y = proj([0, 0, 0])[1] / DOOR_VB_H;

export type DoorPalette = {
  slab: string;
  casing: string;
  jamb: string;
  handle: string;
  stroke: string;
  light: string;
  lightCore: string;
  room: string;
};

// Each rank has its own noble pastel door — never dark. Outlines are a deep
// tint of the same hue, not black.
const mk = (slab: string, casing: string, jamb: string, stroke: string): DoorPalette => ({
  slab,
  casing,
  jamb,
  stroke,
  handle: "#E8B43A",
  light: "#FFCF34",
  lightCore: "#FFF8E1",
  room: "#F2C75C",
});
export const DOOR_PALETTES = {
  butter: mk("#F3D98B", "#FBEDC6", "#EACB7E", "#8C6B2C"), // 1 · Новичок
  lavender: mk("#CDBAF0", "#E8DEF8", "#BDA8E4", "#5F4C8A"), // 2 · Любитель
  sage: mk("#B7D0AA", "#DCE9D4", "#A7C29A", "#4E6A45"), // 3 · Уверенный
  powder: mk("#B2CEEA", "#DAE8F6", "#A0BCDC", "#46627F"), // 4 · Мастер
  rose: mk("#F2C0B4", "#FADFD8", "#E6AEA1", "#89564C"), // 5 · Профи
};
const RANK_DOORS = [DOOR_PALETTES.butter, DOOR_PALETTES.lavender, DOOR_PALETTES.sage, DOOR_PALETTES.powder, DOOR_PALETTES.rose];
/** The door of rank `index` (1..5). */
export const doorPaletteForRank = (index: number): DoorPalette => RANK_DOORS[Math.max(0, Math.min(4, index - 1))];

export const DEFAULT_DOOR_PALETTE: DoorPalette = DOOR_PALETTES.butter;

// ── colour helpers ──────────────────────────────────────────────────────────
const rgb = (h: string) => {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const hex = (c: number[]) =>
  "#" + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
/** base × shade, then blended toward `warm` by `k`. */
const lit = (base: string, shade: number, warm: string, k: number) => {
  const b = rgb(base).map((v) => v * shade);
  const w = rgb(warm);
  const kk = Math.max(0, Math.min(1, k));
  return hex(b.map((v, i) => v + (w[i] - v) * kk));
};

// key light from the upper-left front
const KEY: V3 = (() => {
  const v: V3 = [-0.35, -0.6, 0.72];
  const l = Math.hypot(...v);
  return [v[0] / l, v[1] / l, v[2] / l];
})();
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// Deterministic stipple for the grain tile.
const GRAIN_TILE = 12;
const GRAIN = Array.from({ length: 30 }, (_, i) => {
  const r = (n: number) => {
    const x = Math.sin((i + 1) * 91.17 + n * 47.53) * 24634.6345;
    return x - Math.floor(x);
  };
  return { x: r(1) * GRAIN_TILE, y: r(2) * GRAIN_TILE, r: 0.22 + r(3) * 0.3, dark: i % 4 !== 0 };
});

type Face = { pts: V3[]; n: V3; kind: "face" | "edge" };

type Props = {
  width: number;
  /** 0 = shut, 1 = swung ~72° open toward the viewer (up to 1.35 ≈ 97°). */
  open: number;
  /** 0..1 brightness of the light behind the door. */
  light: number;
  palette?: DoorPalette;
  /** Draw the pool of light spilling over the floor. */
  floorLight?: boolean;
  /** Colour of the cast shadow on the floor. */
  shadowColor?: string;
};

export default function Door3D({ width, open, light, palette = DEFAULT_DOOR_PALETTE, floorLight = true, shadowColor = "#3A3446" }: Props) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const id = (s: string) => `d3${uid}${s}`;
  const p = palette;
  const height = (width * DOOR_VB_H) / DOOR_VB_W;
  const L = Math.max(0, Math.min(1, light));

  const theta = Math.max(0, Math.min(1.35, open)) * ((72 * Math.PI) / 180);
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  // slab frame: hinged on the left jamb; u runs from the hinge to the free
  // edge, t through the thickness. It swings toward the viewer, to the left.
  const dU: V3 = [c, 0, s];
  const dT: V3 = [s, 0, -c];
  const P = (u: number, y: number, t: number): V3 => [XL + u * dU[0] + t * dT[0], y, u * dU[2] + t * dT[2]];

  const box = (u0: number, u1: number, y0: number, y1: number, t0: number, t1: number, kind: Face["kind"]): Face[] => {
    const side = kind === "face" ? "edge" : kind;
    return [
      { pts: [P(u0, y0, t0), P(u1, y0, t0), P(u1, y1, t0), P(u0, y1, t0)], n: [-dT[0], 0, -dT[2]], kind }, // front
      { pts: [P(u1, y0, t1), P(u0, y0, t1), P(u0, y1, t1), P(u1, y1, t1)], n: dT, kind }, // back
      { pts: [P(u1, y0, t0), P(u1, y0, t1), P(u1, y1, t1), P(u1, y1, t0)], n: dU, kind: side }, // free edge
      { pts: [P(u0, y0, t1), P(u0, y0, t0), P(u0, y1, t0), P(u0, y1, t1)], n: [-dU[0], 0, -dU[2]], kind: side },
      { pts: [P(u0, y0, t1), P(u1, y0, t1), P(u1, y0, t0), P(u0, y0, t0)], n: [0, -1, 0], kind: side }, // top
      { pts: [P(u0, y1, t0), P(u1, y1, t0), P(u1, y1, t1), P(u0, y1, t1)], n: [0, 1, 0], kind: side }, // bottom
    ];
  };
  const visible = (f: Face) => {
    const n = f.pts.length;
    const cx = f.pts.reduce((a, q) => a + q[0], 0) / n;
    const cy = f.pts.reduce((a, q) => a + q[1], 0) / n;
    const cz = f.pts.reduce((a, q) => a + q[2], 0) / n;
    return dot(f.n, [CAM.x - cx, CAM.y - cy, CAM.z - cz]) > 0;
  };

  const slab = box(0, OW - 1, YT + 1, -SLAB_GAP, 0, SLAB_T, "face");
  const frontVisible = visible(slab[0]);

  const shadeFace = (f: Face) => {
    const k = Math.max(0, dot(f.n, KEY));
    // the doorway light hits faces turned toward the room, and rims the edges
    const warm = L * (Math.max(0, -f.n[2]) * 0.55 + (f.kind === "edge" && theta > 0.02 ? 0.45 : 0));
    return lit(p.slab, 0.8 + 0.22 * k, p.light, warm);
  };

  const pts = (q: V3[]) => q.map((v) => proj(v).map((n) => n.toFixed(2)).join(",")).join(" ");
  const ringPath = (q: V3[]) => q.map((v, i) => `${i ? "L" : "M"}${proj(v).map((n) => n.toFixed(2)).join(",")}`).join("") + "Z";

  // static geometry
  const back: V3[] = [[XL, YT, -DEPTH], [XR, YT, -DEPTH], [XR, 0, -DEPTH], [XL, 0, -DEPTH]];
  const jambL: V3[] = [[XL, YT, 0], [XL, YT, -DEPTH], [XL, 0, -DEPTH], [XL, 0, 0]];
  const jambR: V3[] = [[XR, YT, -DEPTH], [XR, YT, 0], [XR, 0, 0], [XR, 0, -DEPTH]];
  const head: V3[] = [[XL, YT, 0], [XR, YT, 0], [XR, YT, -DEPTH], [XL, YT, -DEPTH]];
  const sill: V3[] = [[XL, 0, -DEPTH], [XR, 0, -DEPTH], [XR, 0, 0], [XL, 0, 0]];
  const cOut: V3[] = [[XL - CASE, YT - CASE, CASE_Z], [XR + CASE, YT - CASE, CASE_Z], [XR + CASE, 0, CASE_Z], [XL - CASE, 0, CASE_Z]];
  const cIn: V3[] = [[XL, YT, CASE_Z], [XR, YT, CASE_Z], [XR, 0, CASE_Z], [XL, 0, CASE_Z]];
  // casing returns (its thin outer sides)
  const cSideR: V3[] = [[XR + CASE, YT - CASE, CASE_Z], [XR + CASE, YT - CASE, 0], [XR + CASE, 0, 0], [XR + CASE, 0, CASE_Z]];
  const cSideL: V3[] = [[XL - CASE, YT - CASE, 0], [XL - CASE, YT - CASE, CASE_Z], [XL - CASE, 0, CASE_Z], [XL - CASE, 0, 0]];
  const cSideT: V3[] = [[XL - CASE, YT - CASE, 0], [XR + CASE, YT - CASE, 0], [XR + CASE, YT - CASE, CASE_Z], [XL - CASE, YT - CASE, CASE_Z]];

  // light pool on the floor in front of the gap
  const freeX = XL + OW * c;
  const gapL = Math.max(XL, Math.min(XR - 8, freeX));
  const pool: V3[] = [
    [gapL, 0, 0],
    [XR, 0, 0],
    [XR + 45, 0, 140],
    [gapL - 30 - 30 * Math.min(1, open), 0, 140],
  ];

  // ── the classic door design on whichever slab face the camera sees:
  // an arched upper panel and a lower panel, recessed with a bevel, and a
  // round knob near the free edge.
  const faceT = frontVisible ? -0.25 : SLAB_T + 0.25;
  const faceN = frontVisible ? slab[0].n : slab[1].n;
  const faceK = 0.8 + 0.22 * Math.max(0, dot(faceN, KEY));
  const faceWarm = L * Math.max(0, -faceN[2]) * 0.55;
  const tone = (k: number) => lit(p.slab, faceK * k, p.light, faceWarm);
  const fp = (u: number, y: number) => proj(P(u, y, faceT)).map((n) => n.toFixed(2)).join(",");
  const rectD = (u0: number, y0: number, u1: number, y1: number) =>
    `M${fp(u0, y0)}L${fp(u1, y0)}L${fp(u1, y1)}L${fp(u0, y1)}Z`;
  const archD = (u0: number, y0: number, u1: number, y1: number, rise: number) => {
    let d = `M${fp(u0, y1)}L${fp(u0, y0 + rise)}`;
    for (let i = 1; i <= 14; i++) {
      const q = i / 14;
      d += `L${fp(u0 + (u1 - u0) * q, y0 + rise - Math.sin(Math.PI * q) * rise)}`;
    }
    return d + `L${fp(u1, y1)}Z`;
  };
  const sy = YT + 1; // slab top
  const KU = OW - 13; // knob, near the free edge
  const KY = sy + 116;
  const knobRose = Array.from({ length: 16 }, (_, i) => {
    const a = (i / 16) * Math.PI * 2;
    return fp(KU + Math.cos(a) * 6.5, KY + Math.sin(a) * 6.5);
  }).join(" ");
  const ballZ = frontVisible ? -5 : SLAB_T + 5;
  const ball = proj(P(KU, KY, ballZ));
  const ballR = (4.6 * F) / (CAM.z - P(KU, KY, ballZ)[2]);

  const sw = 1.3;
  const jambTone = (base: number, warmK: number) => lit(p.jamb, base, p.light, warmK * L);
  const staticFaces: (Face & { fill: string })[] = [
    { pts: head, n: [0, 1, 0], kind: "face", fill: jambTone(0.8, 0.35) },
    { pts: jambL, n: [1, 0, 0], kind: "face", fill: jambTone(0.95, 0.6) },
    { pts: jambR, n: [-1, 0, 0], kind: "face", fill: jambTone(0.86, 0.5) },
    { pts: sill, n: [0, -1, 0], kind: "face", fill: jambTone(1, 0.8) },
    { pts: cSideT, n: [0, -1, 0], kind: "face", fill: lit(p.casing, 1.05, p.light, 0) },
    { pts: cSideR, n: [1, 0, 0], kind: "face", fill: lit(p.casing, 0.88, p.light, 0) },
    { pts: cSideL, n: [-1, 0, 0], kind: "face", fill: lit(p.casing, 0.88, p.light, 0) },
  ];
  // Cast shadows (model-left = screen-right after the mirror): a long soft
  // sliver off the casing foot, like a low sun, and the open slab's own.
  const shA = proj([XL - CASE, 0, 1]);
  const shB = proj([XL - CASE - 170, 0, 34]);
  const castShadow: V3[] = [
    [XR + CASE * 0.3, 0, 1],
    [XL - CASE, 0, 1],
    [XL - CASE - 170, 0, 26],
    [XL - CASE - 170, 0, 44],
    [XR - 10, 0, 22],
  ];
  const slabShadow: V3[] = [P(0, 0, 0), P(OW - 1, 0, 0), [P(OW - 1, 0, 0)[0] - 26, 0, P(OW - 1, 0, 0)[2] + 12], [XL - 18, 0, 10]];
  const floorL = proj([XL - CASE - 26, 0, CASE_Z]);
  const floorR = proj([XR + CASE + 26, 0, CASE_Z]);

  return (
    <Svg width={width} height={height} viewBox={`0 0 ${DOOR_VB_W} ${DOOR_VB_H}`}>
      <G transform={`translate(${DOOR_VB_W},0) scale(-1,1)`}>
      <Defs>
        <RadialGradient id={id("halo")} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={p.light} stopOpacity={0.7} />
          <Stop offset="0.55" stopColor={p.light} stopOpacity={0.18} />
          <Stop offset="1" stopColor={p.light} stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id={id("room")} cx="45%" cy="62%" r="65%">
          <Stop offset="0" stopColor={p.lightCore} />
          <Stop offset="0.5" stopColor={p.light} />
          <Stop offset="1" stopColor={lit(p.light, 0.82, "#E07A12", 0.35)} />
        </RadialGradient>
        <LinearGradient id={id("shadow")} x1={shA[0]} y1={shA[1]} x2={shB[0]} y2={shB[1]} gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={shadowColor} stopOpacity={0.38} />
          <Stop offset="0.45" stopColor={shadowColor} stopOpacity={0.16} />
          <Stop offset="1" stopColor={shadowColor} stopOpacity={0} />
        </LinearGradient>
        {/* hand-printed grain: a stipple tile laid over every surface */}
        <Pattern id={id("grain")} patternUnits="userSpaceOnUse" width={GRAIN_TILE} height={GRAIN_TILE}>
          {GRAIN.map((g, i) => (
            <Circle key={i} cx={g.x} cy={g.y} r={g.r} fill={g.dark ? p.stroke : "#FFFFFF"} opacity={g.dark ? 0.13 : 0.22} />
          ))}
        </Pattern>
        <LinearGradient id={id("pool")} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={p.light} stopOpacity={0.75} />
          <Stop offset="1" stopColor={p.light} stopOpacity={0} />
        </LinearGradient>
      </Defs>

      {L > 0.01 && (
        <Ellipse cx={pc[0]} cy={pc[1] + 8} rx={112 + 26 * L} ry={150 + 26 * L} fill={`url(#${id("halo")})`} opacity={L} />
      )}

      {/* the room behind */}
      <Polygon points={pts(back)} fill={p.room} />
      <Polygon points={pts(back)} fill={`url(#${id("room")})`} opacity={L} />

      {/* jamb reveals + casing — static faces, back-face culled */}
      {staticFaces.filter((f) => visible(f)).map((f, i) => (
        <Polygon key={`j${i}`} points={pts(f.pts)} fill={f.fill} stroke={p.stroke} strokeWidth={sw} strokeLinejoin="round" />
      ))}
      <Path
        d={ringPath(cOut) + ringPath(cIn)}
        fillRule="evenodd"
        fill={lit(p.casing, 1, p.light, 0.12 * L)}
        stroke={p.stroke}
        strokeWidth={sw}
        strokeLinejoin="round"
      />

      {floorLight && L > 0.01 && open > 0.02 && <Polygon points={pts(pool)} fill={`url(#${id("pool")})`} opacity={L} />}

      {/* cast shadows */}
      <Polygon points={pts(castShadow)} fill={`url(#${id("shadow")})`} />
      {open > 0.05 && <Polygon points={pts(slabShadow)} fill={shadowColor} opacity={0.14 * Math.min(1, open * 2)} />}

      {/* floor line */}
      <Rect x={floorL[0]} y={floorL[1] - 0.5} width={floorR[0] - floorL[0]} height={1.2} rx={0.6} fill={p.stroke} opacity={0.25} />

      {/* light leaking under a shut door */}
      {L > 0.01 && open <= 0.02 && (
        <Polygon
          points={pts([[XL + 1, -SLAB_GAP, 0.5], [XR - 1, -SLAB_GAP, 0.5], [XR - 1, 0, 0.5], [XL + 1, 0, 0.5]])}
          fill={p.lightCore}
          opacity={L}
        />
      )}

      {/* the slab (a convex box: culling alone orders it), then its handle */}
      {slab.filter(visible).map((f, i) => (
        <Polygon key={`s${i}`} points={pts(f.pts)} fill={shadeFace(f)} stroke={p.stroke} strokeWidth={sw} strokeLinejoin="round" />
      ))}
      {/* panels: outer recess (bevel, darker) + inner field */}
      <Path d={archD(19, sy + 18, 79, sy + 118, 14)} fill={tone(0.84)} stroke={p.stroke} strokeWidth={1.1} strokeLinejoin="round" />
      <Path d={archD(25, sy + 25, 73, sy + 111, 11)} fill={tone(0.97)} stroke={tone(1.18)} strokeWidth={0.9} strokeLinejoin="round" />
      <Path d={rectD(19, sy + 140, 79, sy + 192)} fill={tone(0.84)} stroke={p.stroke} strokeWidth={1.1} strokeLinejoin="round" />
      <Path d={rectD(25, sy + 147, 73, sy + 185)} fill={tone(0.97)} stroke={tone(1.18)} strokeWidth={0.9} strokeLinejoin="round" />
      {/* knob: rose on the face + a ball standing off it */}
      <Polygon points={knobRose} fill={lit(p.handle, 0.62, p.stroke, 0.1)} stroke={p.stroke} strokeWidth={0.9} strokeLinejoin="round" />
      <Circle cx={ball[0]} cy={ball[1]} r={ballR} fill={lit(p.handle, 0.95, p.lightCore, 0.1 * L)} stroke={p.stroke} strokeWidth={0.9} />
      <Circle cx={ball[0] + ballR * 0.35} cy={ball[1] - ballR * 0.38} r={ballR * 0.32} fill="#FFF6D6" />
      {/* grain over the door and its frame */}
      <Path d={ringPath(cOut) + ringPath(cIn)} fillRule="evenodd" fill={`url(#${id("grain")})`} />
      {staticFaces.filter((f) => visible(f)).map((f, i) => (
        <Polygon key={`gj${i}`} points={pts(f.pts)} fill={`url(#${id("grain")})`} />
      ))}
      {slab.filter(visible).map((f, i) => (
        <Polygon key={`gs${i}`} points={pts(f.pts)} fill={`url(#${id("grain")})`} />
      ))}
      </G>
    </Svg>
  );
}
