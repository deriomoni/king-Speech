// A minimal door built as a real 3D model and projected to SVG: a casing on
// the wall, a jamb with depth (its inner reveals catch the light from the
// room behind), and a slab with thickness that swings toward the viewer on
// its hinge. Faces are back-face culled and lit (key light + the warm light
// pouring out of the doorway). Callers drive `open` / `light` (0..1) from
// their own clock — the same door is used on the Path map and in the
// rank-up cut-scene.
import React, { useId } from "react";
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Polygon, RadialGradient, Rect, Stop } from "react-native-svg";

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

export const DOOR_PALETTES = {
  graphite: {
    slab: "#34323B",
    casing: "#26252C",
    jamb: "#2C2B33",
    handle: "#FFCF34",
    stroke: "#131217",
    light: "#FFCF34",
    lightCore: "#FFF8E1",
    room: "#121115",
  },
  white: {
    slab: "#F3F1EC",
    casing: "#D9D5CD",
    jamb: "#C9C4BA",
    handle: "#FFCF34",
    stroke: "#2A2830",
    light: "#FFCF34",
    lightCore: "#FFF8E1",
    room: "#121115",
  },
  violet: {
    slab: "#5B3FC4",
    casing: "#2E2450",
    jamb: "#3A2C66",
    handle: "#FFCF34",
    stroke: "#16112A",
    light: "#FFCF34",
    lightCore: "#FFF8E1",
    room: "#121115",
  },
} satisfies Record<string, DoorPalette>;

export const DEFAULT_DOOR_PALETTE: DoorPalette = DOOR_PALETTES.graphite;

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
};

export default function Door3D({ width, open, light, palette = DEFAULT_DOOR_PALETTE, floorLight = true }: Props) {
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
    return lit(p.slab, 0.6 + 0.4 * k, p.light, warm);
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
  const faceK = 0.6 + 0.4 * Math.max(0, dot(faceN, KEY));
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
    { pts: head, n: [0, 1, 0], kind: "face", fill: jambTone(0.55, 0.35) },
    { pts: jambL, n: [1, 0, 0], kind: "face", fill: jambTone(0.85, 0.65) },
    { pts: jambR, n: [-1, 0, 0], kind: "face", fill: jambTone(0.62, 0.5) },
    { pts: sill, n: [0, -1, 0], kind: "face", fill: jambTone(0.95, 0.85) },
    { pts: cSideT, n: [0, -1, 0], kind: "face", fill: lit(p.casing, 1.25, p.light, 0) },
    { pts: cSideR, n: [1, 0, 0], kind: "face", fill: lit(p.casing, 0.72, p.light, 0) },
    { pts: cSideL, n: [-1, 0, 0], kind: "face", fill: lit(p.casing, 0.72, p.light, 0) },
  ];
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

      {/* floor line */}
      <Rect x={floorL[0]} y={floorL[1] - 0.6} width={floorR[0] - floorL[0]} height={1.6} rx={0.8} fill={p.stroke} opacity={0.6} />

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
      </G>
    </Svg>
  );
}
