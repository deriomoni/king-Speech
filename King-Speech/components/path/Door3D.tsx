// A classic panel door (arched upper panel + lower panel, round knob) set in a
// casing, drawn in true perspective so it can swing open toward the viewer.
// Pure SVG geometry — callers drive `open` / `light` (0..1) from their own
// clock, so the same door is used on the Path map and in the rank-up scene.
import React, { useId } from "react";
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Path,
  Polygon,
  RadialGradient,
  Rect,
  Stop,
} from "react-native-svg";

export const DOOR_VB_W = 240;
export const DOOR_VB_H = 300;

// Doorway (inner opening) in viewBox units.
const IN_L = 70;
const IN_R = 170;
const IN_T = 50;
const FLOOR = 262;
const DW = IN_R - IN_L; // door width 100
const DH = FLOOR - IN_T; // door height 212
const CASE = 12; // casing width
const CAM_D = 420; // camera distance for the perspective projection
const CX = 120;
const CY = 156;
const THICK = 7; // door slab thickness

/** Centre of the lit doorway as a 0..1 fraction of the door's box. */
export const DOORWAY_CENTER = { x: (IN_L + IN_R) / 2 / DOOR_VB_W, y: (IN_T + FLOOR) / 2 / DOOR_VB_H };
/** Centre of the lit gap left of a fully opened door — where the camera dives. */
export const DOORWAY_GAP_CENTER = { x: (IN_L + 150) / 2 / DOOR_VB_W, y: (IN_T + FLOOR) / 2 / DOOR_VB_H };

export type DoorPalette = {
  frame: string;
  frameDark: string;
  door: string;
  doorShade: string;
  stroke: string;
  knob: string;
  light: string;
  lightCore: string;
};

export const DEFAULT_DOOR_PALETTE: DoorPalette = {
  frame: "#4A3A2C",
  frameDark: "#2E241B",
  door: "#F6EEDF",
  doorShade: "#B9AE9B",
  stroke: "#1F1B18",
  knob: "#E0A234",
  light: "#FFD45C",
  lightCore: "#FFFDF4",
};

function mixHex(a: string, b: string, k: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (s: number) => {
    const x = (pa >> s) & 255;
    const y = (pb >> s) & 255;
    return Math.round(x + (y - x) * k);
  };
  return "#" + [16, 8, 0].map((s) => ch(s).toString(16).padStart(2, "0")).join("");
}

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

  const theta = Math.max(0, Math.min(1.35, open)) * (72 * Math.PI) / 180;
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  const L = Math.max(0, Math.min(1, light));

  // Door-local (lx from the free/knob edge, ly from the top) → screen.
  // Hinge on the right; the free edge swings toward the viewer (+z).
  const proj = (lx: number, ly: number, depth = 0): [number, number] => {
    const s = DW - lx; // distance from the hinge
    let x = IN_R - s * cos;
    let z = s * sin;
    // slab thickness runs "into" the door, i.e. along the door's back normal
    x -= depth * sin;
    z -= depth * cos;
    const y = IN_T + ly;
    const k = CAM_D / (CAM_D - z);
    return [CX + (x - CX) * k, CY + (y - CY) * k];
  };
  const pt = (q: [number, number]) => `${q[0].toFixed(2)},${q[1].toFixed(2)}`;
  const poly = (pts: [number, number][]) => pts.map(pt).join(" ");

  // Panel outlines in door-local space.
  const rectPath = (x0: number, y0: number, x1: number, y1: number) =>
    `M${pt(proj(x0, y0))}L${pt(proj(x1, y0))}L${pt(proj(x1, y1))}L${pt(proj(x0, y1))}Z`;
  const archPath = (x0: number, y0: number, x1: number, y1: number, rise: number) => {
    let d = `M${pt(proj(x0, y1))}L${pt(proj(x0, y0 + rise))}`;
    const n = 14;
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const lx = x0 + (x1 - x0) * u;
      const ly = y0 + rise - Math.sin(Math.PI * u) * rise;
      d += `L${pt(proj(lx, ly))}`;
    }
    d += `L${pt(proj(x1, y1))}Z`;
    return d;
  };

  // Front face darkens as it turns away from the viewer.
  const faceTone = mixHex(p.door, p.doorShade, Math.min(1, sin * 0.75 + (1 - cos) * 0.1));
  const panelTone = mixHex(faceTone, p.doorShade, 0.18);
  const strokeW = 2.2;

  const corners = {
    tl: proj(0, 0),
    tr: proj(DW, 0),
    br: proj(DW, DH),
    bl: proj(0, DH),
  };
  // Free-edge slab (visible once the door starts to swing).
  const edge = [proj(0, 0), proj(0, 0, THICK), proj(0, DH, THICK), proj(0, DH)];
  const knob = proj(12, 116);
  const knobScale = CAM_D / (CAM_D - (DW - 12) * sin);

  // Light spill on the floor: from the doorway sill toward the viewer, its
  // width following how far the door has opened.
  const spillOpen = Math.min(1, open * 1.6);
  const spillL = IN_L;
  const spillR = IN_L + DW * Math.max(0.08, spillOpen);
  const spill = [
    [spillL, FLOOR],
    [spillR, FLOOR],
    [spillR + 30 + 40 * spillOpen, DOOR_VB_H],
    [spillL - 40 - 20 * spillOpen, DOOR_VB_H],
  ] as [number, number][];

  return (
    <Svg width={width} height={height} viewBox={`0 0 ${DOOR_VB_W} ${DOOR_VB_H}`}>
      <Defs>
        <RadialGradient id={id("halo")} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={p.light} stopOpacity={0.75} />
          <Stop offset="0.55" stopColor={p.light} stopOpacity={0.22} />
          <Stop offset="1" stopColor={p.light} stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id={id("room")} cx="50%" cy="58%" r="62%">
          <Stop offset="0" stopColor={p.lightCore} stopOpacity={1} />
          <Stop offset="0.45" stopColor={p.light} stopOpacity={1} />
          <Stop offset="1" stopColor={mixHex(p.light, "#E07A12", 0.55)} stopOpacity={1} />
        </RadialGradient>
        <LinearGradient id={id("spill")} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={p.light} stopOpacity={0.85} />
          <Stop offset="1" stopColor={p.light} stopOpacity={0} />
        </LinearGradient>
        <LinearGradient id={id("frame")} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={p.frame} />
          <Stop offset="1" stopColor={p.frameDark} />
        </LinearGradient>
        <LinearGradient id={id("face")} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={faceTone} />
          <Stop offset="1" stopColor={mixHex(faceTone, p.doorShade, 0.22)} />
        </LinearGradient>
      </Defs>

      {/* glow around the doorway */}
      {L > 0.01 && (
        <Ellipse
          cx={CX}
          cy={CY + 10}
          rx={110 + 30 * L}
          ry={150 + 30 * L}
          fill={`url(#${id("halo")})`}
          opacity={L}
        />
      )}

      {/* casing */}
      <Path
        d={`M${IN_L - CASE},${FLOOR} V${IN_T - CASE} H${IN_R + CASE} V${FLOOR} H${IN_R} V${IN_T} H${IN_L} V${FLOOR} Z`}
        fill={`url(#${id("frame")})`}
        stroke={p.stroke}
        strokeWidth={strokeW}
        strokeLinejoin="round"
      />
      {/* head moulding */}
      <Rect
        x={IN_L - CASE - 5}
        y={IN_T - CASE - 7}
        width={DW + 2 * CASE + 10}
        height={8}
        rx={2}
        fill={p.frame}
        stroke={p.stroke}
        strokeWidth={strokeW}
      />

      {/* the room behind: dark until the light comes on */}
      <Rect x={IN_L} y={IN_T} width={DW} height={DH} fill="#121015" />
      <Rect x={IN_L} y={IN_T} width={DW} height={DH} fill={`url(#${id("room")})`} opacity={L} />

      {floorLight && L > 0.01 && open > 0.02 && (
        <Polygon points={poly(spill)} fill={`url(#${id("spill")})`} opacity={L} />
      )}

      {/* light leaking under a shut door */}
      {L > 0.01 && open <= 0.02 && (
        <Rect x={IN_L + 2} y={FLOOR - 2.5} width={DW - 4} height={2.5} fill={p.lightCore} opacity={L} />
      )}

      {/* door slab: free edge, then the face */}
      {sin > 0.02 && (
        <Polygon points={poly(edge)} fill={mixHex(p.doorShade, p.stroke, 0.25)} stroke={p.stroke} strokeWidth={strokeW} strokeLinejoin="round" />
      )}
      <Polygon
        points={poly([corners.tl, corners.tr, corners.br, corners.bl])}
        fill={`url(#${id("face")})`}
        stroke={p.stroke}
        strokeWidth={strokeW}
        strokeLinejoin="round"
      />
      <G>
        {/* upper arched panel + its inner bevel */}
        <Path d={archPath(20, 18, 80, 118, 14)} fill={panelTone} stroke={p.stroke} strokeWidth={strokeW * 0.85} strokeLinejoin="round" />
        <Path d={archPath(27, 26, 73, 111, 11)} fill="none" stroke={p.doorShade} strokeWidth={1.2} strokeLinejoin="round" opacity={0.8} />
        {/* lower panel + bevel */}
        <Path d={rectPath(20, 140, 80, 192)} fill={panelTone} stroke={p.stroke} strokeWidth={strokeW * 0.85} strokeLinejoin="round" />
        <Path d={rectPath(27, 147, 73, 185)} fill="none" stroke={p.doorShade} strokeWidth={1.2} strokeLinejoin="round" opacity={0.8} />
      </G>
      {/* knob: rose + ball with a highlight */}
      <Circle cx={knob[0]} cy={knob[1]} r={6.2 * knobScale} fill={mixHex(p.knob, p.stroke, 0.35)} stroke={p.stroke} strokeWidth={1.4} />
      <Circle cx={knob[0]} cy={knob[1]} r={4.2 * knobScale} fill={p.knob} />
      <Circle cx={knob[0] - 1.3 * knobScale} cy={knob[1] - 1.4 * knobScale} r={1.4 * knobScale} fill="#FFF6D6" />

      {/* floor line */}
      <Rect x={IN_L - CASE - 22} y={FLOOR} width={DW + 2 * CASE + 44} height={2.2} rx={1.1} fill={p.stroke} opacity={0.55} />
    </Svg>
  );
}
