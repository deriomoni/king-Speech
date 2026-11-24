// Geometry of the «Королевские манеры» mark (crown + bow tie), shared by the
// MannersMark component and exports. Symmetric by construction: only the left
// half is written down, the right half is its mirror about x = CX.
//   · three equal balls, each 18 units above its peak
//   · the crown has straight sides and a softly rounded bottom
//   · the bow tie sits separately under the crown (it does not wrap its edge)

const CX = 512;
const mx = (x: number) => 2 * CX - x;
const r = (n: number) => +n.toFixed(2);

// ── Crown ──────────────────────────────────────────────────────────────────
const SIDE_X = 266; // left side (right = 758)
const SIDE_TOP = 366; // side-peak tip
const PEAK = 293; // centre peak tip
const CORNER = 600; // where the sides meet the bottom curve
const SAG = 160; // control-point drop of the bottom curve

// Bottom edge = quadratic (SIDE_X, CORNER) → ctrl (CX, CORNER + SAG) → (mx(SIDE_X), CORNER)
const bottomAt = (t: number) => ({ x: SIDE_X + 2 * (CX - SIDE_X) * t, y: CORNER + 2 * t * (1 - t) * SAG });
export const crownBottomAtX = (x: number) => bottomAt((x - SIDE_X) / (2 * (CX - SIDE_X))).y;
const T0 = 0.05; // the rounded corners take the first / last 5 % of the curve
const c0 = bottomAt(T0);
const midCtrlY = CORNER + ((1 - T0) ** 2 + T0 ** 2) * SAG; // control of the sub-curve [T0, 1 − T0]
export const CROWN_BOTTOM_Y = CORNER + SAG / 2; // lowest point (centre)

function crownPath(): string {
  return [
    `M ${SIDE_X} ${SIDE_TOP}`,
    `C 296 412 340 416 378 416`,
    `C 430 416 482 372 504 ${PEAK}`,
    `L ${mx(504)} ${PEAK}`,
    `C ${mx(482)} 372 ${mx(430)} 416 ${mx(378)} 416`,
    `C ${mx(340)} 416 ${mx(296)} 412 ${mx(SIDE_X)} ${SIDE_TOP}`,
    `L ${mx(SIDE_X)} ${CORNER - 12}`,
    `Q ${mx(SIDE_X)} ${CORNER} ${r(mx(c0.x))} ${r(c0.y)}`,
    `Q ${CX} ${r(midCtrlY)} ${r(c0.x)} ${r(c0.y)}`,
    `Q ${SIDE_X} ${CORNER} ${SIDE_X} ${CORNER - 12}`,
    "Z",
  ].join(" ");
}

// ── Bow tie ────────────────────────────────────────────────────────────────
export const GAP = 36; // crown ↔ knot
const KNOT_GAP = 22; // wing ↔ knot
const KNOT_S = 104;
export const KNOT = { x: CX - KNOT_S / 2, y: CROWN_BOTTOM_Y + GAP, w: KNOT_S, h: KNOT_S, r: 26 };
export const BOW_MID = KNOT.y + KNOT_S / 2; // horizontal axis of the bow
export const WING_IN_X = KNOT.x - KNOT_GAP; // wing inner end
const IN_H = 48; // half-height of the inner end
const OUT_X = SIDE_X; // outer edge lines up with the crown side
export const WING_TOP_X = 292; // straight top edge meets the rounded outer end here
export const WING_TOP_Y = r(crownBottomAtX(WING_TOP_X) + 38);
const BY = r(2 * BOW_MID - WING_TOP_Y);
const WING_L: [string, ...number[]][] = [
  ["M", WING_IN_X, BOW_MID - IN_H],
  ["L", WING_TOP_X, WING_TOP_Y],
  ["C", OUT_X + 8, WING_TOP_Y - 9, OUT_X, WING_TOP_Y + 6, OUT_X, WING_TOP_Y + 30],
  ["L", OUT_X, BY - 30],
  ["C", OUT_X, BY - 6, OUT_X + 8, BY + 9, WING_TOP_X, BY],
  ["L", WING_IN_X, BOW_MID + IN_H],
];
const wingPath = (mirror: boolean) =>
  WING_L.map(([cmd, ...v]) => `${cmd} ${v.map((n, i) => r(mirror && i % 2 === 0 ? mx(n) : n)).join(" ")}`).join(" ") + " Z";

// ── Balls ──────────────────────────────────────────────────────────────────
export const BALL_R = 52;
export const BALLS: [number, number][] = [
  [CX, PEAK - 18 - BALL_R],
  [282, SIDE_TOP - 18 - BALL_R],
  [mx(282), SIDE_TOP - 18 - BALL_R],
];

export const CROWN = crownPath();
export const WING_LEFT = wingPath(false);
export const WING_RIGHT = wingPath(true);

// View box: 8 units of air around the mark.
const TOP = BALLS[0][1] - BALL_R;
const LEFT = BALLS[1][0] - BALL_R;
const BOTTOM = BY + 3;
export const VB_X = LEFT - 8, VB_Y = TOP - 8;
export const VB_W = mx(LEFT) - LEFT + 16, VB_H = r(BOTTOM - TOP + 16);
export const MANNERS_MARK_RATIO = VB_W / VB_H; // width / height

/** Same mark as a standalone SVG string (for export). */
export function mannersMarkSvg(color = "#262628"): string {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VB_X} ${VB_Y} ${VB_W} ${VB_H}"><g fill="${color}">`,
    ...BALLS.map(([cx, cy]) => `<circle cx="${cx}" cy="${cy}" r="${BALL_R}"/>`),
    `<path d="${CROWN}"/>`,
    `<path d="${WING_LEFT}"/>`,
    `<path d="${WING_RIGHT}"/>`,
    `<rect x="${KNOT.x}" y="${KNOT.y}" width="${KNOT.w}" height="${KNOT.h}" rx="${KNOT.r}"/>`,
    `</g></svg>`,
  ].join("\n");
}
