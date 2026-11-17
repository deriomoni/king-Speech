// Stage spotlights and bulbs, rebuilt from simple shapes after the «Софиты»
// set (Figma): rounded rects, circles and bands, flat fills, one ink outline —
// the same language as the audience. Each piece is drawn in its own frame:
//   spotlights: height 100, x centred, y = 0 at the top of the clamp;
//   bulbs:      height 100, x centred, y = 0 at the bottom of the base.
import type { Cairo, RGB } from "./cairo";

const TAU = Math.PI * 2;
const INK: RGB = [0.05, 0.04, 0.04];
const BODY: RGB = [0.24, 0.24, 0.25];      // housings, yokes
const BODY_D: RGB = [0.17, 0.17, 0.18];    // inner rings, doors' shadow side
const METAL: RGB = [0.4, 0.4, 0.41];       // bulb sockets
const LENS: RGB = [0.98, 0.84, 0.47];
const LENS_HI: RGB = [0.99, 0.93, 0.69];
const GLASS_OFF: RGB = [0.97, 0.92, 0.84];

type Cr = Cairo<any>;

function rrect(cr: Cr, x0: number, y0: number, x1: number, y1: number, r: number) {
  r = Math.min(r, (x1 - x0) / 2, (y1 - y0) / 2);
  cr.newSubPath();
  cr.arc(x1 - r, y0 + r, r, -Math.PI / 2, 0); cr.arc(x1 - r, y1 - r, r, 0, Math.PI / 2);
  cr.arc(x0 + r, y1 - r, r, Math.PI / 2, Math.PI); cr.arc(x0 + r, y0 + r, r, Math.PI, 1.5 * Math.PI);
  cr.closePath();
}
function circle(cr: Cr, x: number, y: number, r: number) { cr.newSubPath(); cr.arc(x, y, r, 0, TAU); cr.closePath(); }
function paint(cr: Cr, c: RGB, lw: number) { cr.setRGB(c); cr.fillPreserve(); cr.setRGB(INK); cr.setLineWidth(lw); cr.stroke(); }
function fill(cr: Cr, c: RGB) { cr.setRGB(c); cr.fill(); }
/** a flat band with an ink edge on both sides (yokes, stems) */
function band(cr: Cr, pts: number[][], w: number, c: RGB, lw: number) {
  for (const [width, col] of [[w + 2 * lw, INK], [w, c]] as [number, RGB][]) {
    cr.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)) cr.lineTo(p[0], p[1]);
    cr.setRGB(col); cr.setLineWidth(width); cr.stroke();
  }
}
/** U-shaped yoke from arm tips at y=yb up to the crossbar at y=yt */
function yoke(cr: Cr, half: number, yt: number, yb: number, w: number, lw: number) {
  const r = 7;
  const pts: number[][] = [[-half, yb], [-half, yt + r]];
  for (let k = 1; k <= 4; k++) { const a = Math.PI + (k / 4) * (Math.PI / 2); pts.push([-half + r + r * Math.cos(a), yt + r + r * Math.sin(a)]); }
  for (let k = 0; k <= 4; k++) { const a = 1.5 * Math.PI + (k / 4) * (Math.PI / 2); pts.push([half - r + r * Math.cos(a), yt + r + r * Math.sin(a)]); }
  pts.push([half, yb]);
  band(cr, pts, w, BODY, lw);
}
/** the lens: dark ring, warm glass, a paler centre */
function lens(cr: Cr, x: number, y: number, ring: number, glass: number, hi: number, lw: number) {
  circle(cr, x, y, ring); paint(cr, BODY_D, lw);
  circle(cr, x, y, glass); paint(cr, LENS, lw);
  circle(cr, x - glass * 0.08, y - glass * 0.08, hi); fill(cr, LENS_HI);
}

export type SpotKind = 0 | 1 | 2 | 3;
/** width/height of each spotlight, where its lens centre sits (0..1 of height), lens glass radius (frame units) */
export const SPOT = [
  { aspect: 0.75, lens: 0.61, glass: 24 },
  { aspect: 0.79, lens: 0.49, glass: 19 },
  { aspect: 0.78, lens: 0.63, glass: 27 },
  { aspect: 0.89, lens: 0.7, glass: 19.5 },
];

/** draw spotlight `k` with its clamp at (x, y), `h` tall, rotated by `rot` */
export function drawSpot(cr: Cr, k: number, x: number, y: number, h: number, rot: number, lwHall: number) {
  const s = h / 100, lw = lwHall / s;
  cr.save(); cr.translate(x, y); cr.rotate(rot); cr.scale(s, s);
  if (k === 0) {            // 1 · круглый: tall yoke, hood, deep round housing, foot
    yoke(cr, 34, 4, 56, 5, lw);
    rrect(cr, -6, 0, 6, 9, 2); paint(cr, BODY, lw);
    rrect(cr, -21, 17, 21, 29, 5); paint(cr, BODY, lw);
    rrect(cr, -18, 91, 18, 99, 2.5); paint(cr, BODY, lw);
    circle(cr, 0, 61, 36); paint(cr, BODY, lw);
    for (const sg of [-1, 1]) { rrect(cr, sg * 37 - 4, 44, sg * 37 + 4, 62, 2); paint(cr, BODY, lw); }
    lens(cr, 0, 61, 30, 24, 16, lw);
  } else if (k === 1) {     // 2 · со шторками: barn doors around a square body
    yoke(cr, 33, 3, 32, 4.5, lw);
    rrect(cr, -5, 0, 5, 8, 2); paint(cr, BODY, lw);
    const door = (pts: number[][]) => { cr.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)) cr.lineTo(p[0], p[1]); cr.closePath(); paint(cr, BODY, lw); };
    door([[-29, 13], [29, 13], [19, 28], [-19, 28]]);
    door([[-19, 70], [19, 70], [31, 97], [-31, 97]]);
    for (const sg of [-1, 1]) door([[sg * 49, 25], [sg * 21, 35], [sg * 21, 66], [sg * 49, 79]]);
    rrect(cr, -23, 26, 23, 72, 5); paint(cr, BODY, lw);
    lens(cr, 0, 49, 22, 19, 13, lw);
  } else if (k === 2) {     // 3 · компактный: short yoke, small hood, big round housing
    yoke(cr, 36, 4, 46, 5, lw);
    rrect(cr, -8, 0, 8, 9, 2); paint(cr, BODY, lw);
    rrect(cr, -14, 22, 14, 31, 3); paint(cr, BODY, lw);
    circle(cr, 0, 63, 36); paint(cr, BODY, lw);
    for (const sg of [-1, 1]) { rrect(cr, sg * 37 - 4, 43, sg * 37 + 4, 56, 2); paint(cr, BODY, lw); }
    lens(cr, 0, 63, 31, 27, 18, lw);
  } else {                  // 4 · подвесной: rail on top, stem, compact head
    rrect(cr, -44, 0, 44, 9, 3); paint(cr, BODY, lw);
    rrect(cr, -4, 8, 4, 20, 1.5); paint(cr, BODY, lw);
    yoke(cr, 27, 24, 60, 4.5, lw);
    rrect(cr, -7, 17, 7, 28, 2); paint(cr, BODY, lw);
    rrect(cr, -17, 36, 17, 45, 4); paint(cr, BODY, lw);
    circle(cr, 0, 70, 28); paint(cr, BODY, lw);
    for (const sg of [-1, 1]) { rrect(cr, sg * 28 - 3.5, 55, sg * 28 + 3.5, 67, 2); paint(cr, BODY, lw); }
    lens(cr, 0, 70, 23.5, 19.5, 13, lw);
  }
  cr.restore();
}

export type BulbKind = 0 | 1 | 2 | 3;
/** width/height of each bulb design, and the glow centre height (0..1 from the bottom) */
export const BULB = [
  { aspect: 0.675, glow: 0.72 },  // 1 · горящая (classic bulb)
  { aspect: 0.83, glow: 0.62 },   // 2 · шар
  { aspect: 0.66, glow: 0.7 },    // 3 · маленькая
  { aspect: 4.09, glow: 0.7, strip: true }, // 4 · планка (five on a bar)
];

/** draw bulb `k` with the bottom of its base at (x, y), `h` tall */
export function drawBulb(cr: Cr, k: number, x: number, y: number, h: number, lit: boolean, lwHall: number) {
  const s = h / 100, lw = lwHall / s;
  cr.save(); cr.translate(x, y); cr.scale(s, s);
  if (k === 0) {
    // glass
    cr.moveTo(-14, -36);
    cr.curveTo(-16, -48, -31, -56, -31, -71); cr.curveTo(-31, -88, -17, -100, 0, -100);
    cr.curveTo(17, -100, 31, -88, 31, -71); cr.curveTo(31, -56, 16, -48, 14, -36); cr.closePath();
    paint(cr, lit ? LENS : GLASS_OFF, lw);
    if (lit) { circle(cr, 0, -74, 20); fill(cr, LENS_HI); }
    // filament
    cr.setRGB(INK); cr.setLineWidth(lw * 0.75);
    for (const sg of [-1, 1]) {
      cr.moveTo(sg * 6, -40); cr.lineTo(sg * 6, -66);
      cr.curveTo(sg * 6, -76, sg * 15, -80, sg * 14, -72); cr.curveTo(sg * 13, -66, sg * 6, -66, sg * 6, -66);
      cr.stroke();
    }
    cr.moveTo(-6, -56); cr.lineTo(6, -56); cr.stroke();
    // screw base: three rings and a cap
    rrect(cr, -17, -37, 17, -30, 3); paint(cr, METAL, lw);
    rrect(cr, -16, -30, 16, -23, 3); paint(cr, METAL, lw);
    rrect(cr, -15, -23, 15, -16, 3); paint(cr, METAL, lw);
    cr.moveTo(-11, -16); cr.lineTo(11, -16); cr.curveTo(11, -6, 6, 0, 0, 0); cr.curveTo(-6, 0, -11, -6, -11, -16); cr.closePath(); paint(cr, METAL, lw);
  } else if (k === 1) {
    rrect(cr, -24, -28, 24, -2, 3); paint(cr, METAL, lw);
    circle(cr, 0, -64, 38); paint(cr, lit ? LENS : GLASS_OFF, lw);
    if (lit) { circle(cr, 0, -66, 27); fill(cr, LENS_HI); }
  } else if (k === 2) {
    rrect(cr, -31, -31, 31, -2, 4); paint(cr, BODY, lw);
    rrect(cr, -16, -44, 16, -29, 4); paint(cr, BODY, lw);
    circle(cr, 0, -71, 29); paint(cr, lit ? LENS : GLASS_OFF, lw);
    if (lit) { circle(cr, 0, -72, 19); fill(cr, LENS_HI); }
  } else {
    for (let i = 0; i < 5; i++) {
      const bx = -164 + i * 82;
      cr.moveTo(bx - 17, -24); cr.lineTo(bx - 17, -38); cr.curveTo(bx - 17, -46, bx + 17, -46, bx + 17, -38); cr.lineTo(bx + 17, -24); cr.closePath(); paint(cr, METAL, lw);
      circle(cr, bx, -68, 23); paint(cr, lit ? LENS : GLASS_OFF, lw);
      if (lit) { circle(cr, bx, -69, 14); fill(cr, LENS_HI); }
    }
    rrect(cr, -204, -26, 204, -2, 12); paint(cr, BODY, lw);
  }
  cr.restore();
}
