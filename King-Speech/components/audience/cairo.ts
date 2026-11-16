// A tiny cairo-like drawing context, so the Show Time Audience renderer could be
// ported from Python/Cairo line by line. Semantics follow cairo where the port
// relies on them:
//  - path points are transformed by the matrix at the moment they are added;
//  - line width is in user units, taken with the matrix at stroke time;
//  - fill()/stroke()/clip() consume the path, the *_preserve variants keep it.
// Static artwork (character items, eyes, mouths, brows) is "cached": the backend
// keeps a native path in the artwork's own coordinates and draws it under the
// current matrix, which is what keeps this fast enough for a live hall.

export type RGB = [number, number, number];
export type Mat = [number, number, number, number, number, number]; // a b c d e f
export type Seg = number[]; // flat: 0 x y | 1 x y | 2 x1 y1 x2 y2 x y | 3
export type Cmd = { op: "M" | "L" | "C" | "Z"; p: number[] };

export interface Backend<H> {
  /** build a native path in artwork coordinates (closeAtMove = cairo draw(close=True)) */
  makePath(cmds: Cmd[], closeAtMove: boolean): H;
  fillDyn(seg: Seg, evenodd: boolean, c: RGB, a: number, clear: boolean): void;
  strokeDyn(seg: Seg, width: number, c: RGB, a: number): void;
  fillCached(h: H, m: Mat, evenodd: boolean, c: RGB, a: number, clear: boolean): void;
  strokeCached(h: H, m: Mat, width: number, c: RGB, a: number): void;
  clipDyn(seg: Seg, evenodd: boolean): void;
  clipCached(h: H, m: Mat, evenodd: boolean): void;
  save(): void;
  restore(): void;
  paintRect(c: RGB, a: number): void;
  paintRadial(cx: number, cy: number, r0: number, r1: number, c0: [number, number, number, number], c1: [number, number, number, number]): void;
  image(name: string, m: Mat, w: number, h: number, tint: RGB | null): void;
  /** features masked by skin: content(); then mask(); then composite. bounds = device rect [x, y, w, h] */
  beginGroup(bounds: [number, number, number, number]): void;
  beginMask(): void;
  endMasked(): void;
  beginLayer(alpha: number): void;
  endLayer(): void;
}

const I: Mat = [1, 0, 0, 1, 0, 0];
const mul = (m: Mat, n: Mat): Mat => [
  m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
];

type St = { m: Mat; c: RGB; a: number; lw: number; eo: boolean };
type Part = { h: unknown; m: Mat };

export class Cairo<H = unknown> {
  b: Backend<H>;
  st: St = { m: I, c: [0, 0, 0], a: 1, lw: 2, eo: false };
  stack: St[] = [];
  seg: Seg = [];
  parts: Part[] = [];
  cur: [number, number] | null = null; // device
  start: [number, number] | null = null;
  /** silhouette colour: when set every fill/stroke/image is painted in it */
  sil: RGB | null = null;
  /** true while drawing a mask (white = keep, clear = cut) */
  masking = false;

  constructor(b: Backend<H>) { this.b = b; }

  /** fresh frame: identity matrix, empty path, default state */
  reset() { this.st = { m: I, c: [0, 0, 0], a: 1, lw: 2, eo: false }; this.stack = []; this.newPath(); this.sil = null; this.masking = false; }

  // ---- state ----
  save() { this.stack.push({ ...this.st }); this.b.save(); }
  restore() { const s = this.stack.pop(); if (s) this.st = s; this.b.restore(); }
  transform(xx: number, yx: number, xy: number, yy: number, x0: number, y0: number) { this.st.m = mul(this.st.m, [xx, yx, xy, yy, x0, y0]); }
  translate(x: number, y: number) { this.transform(1, 0, 0, 1, x, y); }
  scale(x: number, y: number) { this.transform(x, 0, 0, y, 0, 0); }
  rotate(a: number) { const c = Math.cos(a), s = Math.sin(a); this.transform(c, s, -s, c, 0, 0); }
  setRGB(c: RGB | number[]) { this.st.c = c as RGB; this.st.a = 1; }
  setRGBA(c: RGB | number[], a: number) { this.st.c = c as RGB; this.st.a = a; }
  setLineWidth(w: number) { this.st.lw = w; }
  setFillRule(evenodd: boolean) { this.st.eo = evenodd; }
  get matrix(): Mat { return this.st.m; }
  /** device-space bounding rect of a user-space box */
  deviceRect(x0: number, x1: number, y0: number, y1: number, pad = 2): [number, number, number, number] {
    const pts = [this.tp(x0, y0), this.tp(x1, y0), this.tp(x0, y1), this.tp(x1, y1)];
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const X = Math.floor(Math.min(...xs) - pad), Y = Math.floor(Math.min(...ys) - pad);
    return [X, Y, Math.ceil(Math.max(...xs) + pad) - X, Math.ceil(Math.max(...ys) + pad) - Y];
  }

  // ---- path ----
  private tp(x: number, y: number): [number, number] { const m = this.st.m; return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]; }
  newPath() { this.seg = []; this.parts = []; this.cur = null; this.start = null; }
  newSubPath() { this.cur = null; }
  moveTo(x: number, y: number) { const p = this.tp(x, y); this.seg.push(0, p[0], p[1]); this.cur = p; this.start = p; }
  lineTo(x: number, y: number) { if (!this.cur) return this.moveTo(x, y); const p = this.tp(x, y); this.seg.push(1, p[0], p[1]); this.cur = p; }
  curveTo(x1: number, y1: number, x2: number, y2: number, x: number, y: number) {
    if (!this.cur) this.moveTo(x1, y1);
    const a = this.tp(x1, y1), b = this.tp(x2, y2), p = this.tp(x, y);
    this.seg.push(2, a[0], a[1], b[0], b[1], p[0], p[1]); this.cur = p;
  }
  closePath() { if (this.cur) { this.seg.push(3); this.cur = this.start; } }
  rectangle(x: number, y: number, w: number, h: number) { this.moveTo(x, y); this.lineTo(x + w, y); this.lineTo(x + w, y + h); this.lineTo(x, y + h); this.closePath(); }
  /** cairo arc: line from the current point to the arc start, then the arc (cubic pieces) */
  arc(cx: number, cy: number, r: number, a0: number, a1: number) {
    while (a1 < a0) a1 += Math.PI * 2;
    const sx = cx + r * Math.cos(a0), sy = cy + r * Math.sin(a0);
    if (this.cur) this.lineTo(sx, sy); else this.moveTo(sx, sy);
    const n = Math.max(1, Math.ceil((a1 - a0) / (Math.PI / 2)));
    const d = (a1 - a0) / n, k = (4 / 3) * Math.tan(d / 4);
    for (let i = 0; i < n; i++) {
      const t0 = a0 + i * d, t1 = t0 + d;
      const c0 = Math.cos(t0), s0 = Math.sin(t0), c1 = Math.cos(t1), s1 = Math.sin(t1);
      this.curveTo(cx + r * (c0 - k * s0), cy + r * (s0 + k * c0), cx + r * (c1 + k * s1), cy + r * (s1 - k * c1), cx + r * c1, cy + r * s1);
    }
  }
  /** append a cached artwork path under the current matrix */
  appendCached(h: H) { this.parts.push({ h, m: this.st.m }); }
  copyPath() { return { seg: this.seg.slice(), parts: this.parts.slice() }; }
  appendPath(p: { seg: Seg; parts: Part[] }) { this.seg.push(...p.seg); this.parts.push(...p.parts); }

  // ---- painting ----
  private col(): RGB { return this.sil && !this.masking ? this.sil : this.st.c; }
  private lwDev(m: Mat) { return this.st.lw * Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2])); }
  fillPreserve(clear = false) {
    const c = this.col(), a = this.st.a;
    if (this.seg.length) this.b.fillDyn(this.seg, this.st.eo, c, a, clear);
    for (const p of this.parts) this.b.fillCached(p.h as H, p.m, this.st.eo, c, a, clear);
  }
  fill(clear = false) { this.fillPreserve(clear); this.newPath(); }
  strokePreserve() {
    const c = this.col(), a = this.st.a;
    if (this.seg.length) this.b.strokeDyn(this.seg, this.lwDev(this.st.m), c, a);
    for (const p of this.parts) this.b.strokeCached(p.h as H, p.m, this.st.lw * Math.sqrt(Math.abs(this.st.m[0] * this.st.m[3] - this.st.m[1] * this.st.m[2])) / Math.sqrt(Math.abs(p.m[0] * p.m[3] - p.m[1] * p.m[2])), c, a);
  }
  stroke() { this.strokePreserve(); this.newPath(); }
  clipPreserve() {
    if (this.seg.length) this.b.clipDyn(this.seg, this.st.eo);
    for (const p of this.parts) this.b.clipCached(p.h as H, p.m, this.st.eo);
  }
  clip() { this.clipPreserve(); this.newPath(); }
  paint(alpha = 1) { this.b.paintRect(this.sil && !this.masking ? this.sil : this.st.c, alpha * this.st.a); }
  /** radial gradient over the whole target, centre/radii in user units */
  radial(cx: number, cy: number, r0: number, r1: number, c0: [number, number, number, number], c1: [number, number, number, number]) {
    const p = this.tp(cx, cy), k = Math.sqrt(Math.abs(this.st.m[0] * this.st.m[3] - this.st.m[1] * this.st.m[2]));
    this.b.paintRadial(p[0], p[1], r0 * k, r1 * k, c0, c1);
  }
  image(name: string, w: number, h: number) { this.b.image(name, this.st.m, w, h, this.sil); }
}
