// Show Time Audience — TypeScript port of audience/scene.py (+ final4 / final
// drawing helpers). The static setup (SVG loading, feature alignment, body
// geometry, fixes, clones) was baked once by scripts/audience-bake.js into
// assets/showtime/audience/live/cast.json; everything below runs live.
//
// Differences from the Python clip renderer, all on purpose:
//  - time is open-ended: the plan grows as the performance goes on, and the
//    applause / ovation / chatter / phones are triggered by stage events;
//  - every run gets its own seed: seating, outfits and the cast mix change;
//  - the hall is laid out for the portrait stage (rows / counts below);
//  - a silhouette pass for the «Затемнить зал» slider.

import { Cairo, Cmd, RGB } from "./cairo";

const TAU = Math.PI * 2;
const INK: RGB = [0.05, 0.04, 0.04];
const EYE_INK: RGB = [0.07, 0.05, 0.05];
const TONGUE: RGB = [0.8, 0.36, 0.38];

export const ss = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export const win = (t: number, a: number, b: number, r = 0.2) => ss(a - r, a, t) * (1 - ss(b, b + r, t));

// ---------------- seeded random (python random.Random stand-in) ----------------
export class Rng {
  s: number;
  constructor(seed: number) { this.s = (seed >>> 0) || 1; }
  random() { // mulberry32
    let t = (this.s += 0x6d2b79f5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  uniform(a: number, b: number) { return a + (b - a) * this.random(); }
  randrange(n: number) { return Math.floor(this.random() * n); }
  randint(a: number, b: number) { return a + this.randrange(b - a + 1); }
  choice<T>(a: T[]): T { return a[this.randrange(a.length)]; }
  shuffle<T>(a: T[]) { for (let i = a.length - 1; i > 0; i--) { const j = this.randrange(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  sample(n: number, k: number) { return this.shuffle([...Array(n).keys()]).slice(0, k); }
}

// ---------------- baked data ----------------
type Mouth = { mouth: Cmd[][] | null; teeth: Cmd[][] | null; mcx: number; mcy: number; h?: unknown; ht?: unknown };
type Eye = { white: Cmd[][] | null; pupil: Cmd[][] | null; lids: Cmd[][] | null; static: Cmd[][] | null; hl: Cmd[][] | null; has_pupil: boolean; cx: number; cy: number; h: number };
type Item = { cmds: Cmd[]; bb: number[]; kind: string; fill: RGB | null; stroke: RGB | null; sw: number; evenodd: boolean; open: boolean; key: string };
type Feats = { ew: number; axis: number; brows: Cmd[][] | null; stache: Cmd[][] | null; closed: Cmd[][] | null; eyes: Eye[]; neutral: Mouth; happy: Mouth };
type GG = { base: number; s: number; tx: number; ty: number; beard: RGB | null; f: Feats };
type Geo = {
  cy_eye: number; cx: number; ew: number; yneck: number; nw: number; ysh: number; base: number; sk_last: number;
  x0: number; y0: number; L: number[]; R: number[]; skin: RGB; sf: number; earrings: boolean; chin_bot: number | null; beard_bot: number | null;
  // per-frame scratch (python mutates G while drawing)
  col?: [number, number]; col_y?: number; cloth?: RGB; S?: number; knee_top?: number; shl?: number; shr?: number;
};
export type Person = { id: string; items: Item[]; g: GG; G: Geo; closed: { neutral: Mouth; happy: Mouth }; cl?: Cloth };
type Cloth = { style: string; c: RGB; c2: RGB; btn: RGB; pants?: RGB };

function parseCmds(d: string): Cmd[] {
  const out: Cmd[] = []; const re = /([MLCZ])([^MLCZ]*)/g; let m: RegExpExecArray | null;
  while ((m = re.exec(d))) out.push({ op: m[1] as Cmd["op"], p: m[2].trim() ? m[2].trim().split(/\s+/).map(Number) : [] });
  return out;
}
const parseF = (s: string | null) => (s ? s.split("|").map(parseCmds) : null);
const mouthIn = (m: any): Mouth => ({ mouth: parseF(m.mouth), teeth: parseF(m.teeth), mcx: m.mcx, mcy: m.mcy });

export function loadCast(raw: any): Person[] {
  const by: Record<string, Person> = {};
  const all: Person[] = [];
  for (const c of raw.chars) {
    const items: Item[] = c.items.map((it: any, k: number) => ({ cmds: parseCmds(it.d), bb: it.bb, kind: it.k, fill: it.f, stroke: it.s, sw: it.w, evenodd: !!it.eo, open: !!it.o, key: c.id + ":" + k }));
    const f = c.g.f;
    const feats: Feats = {
      ew: f.ew, axis: f.axis, brows: parseF(f.brows), stache: parseF(f.stache), closed: parseF(f.closed),
      eyes: f.eyes.map((e: any) => ({ ...e, white: parseF(e.white), pupil: parseF(e.pupil), lids: parseF(e.lids), static: parseF(e.static), hl: parseF(e.hl) })),
      neutral: mouthIn(f.neutral), happy: mouthIn(f.happy),
    };
    const G = c.G;
    const p: Person = {
      id: c.id, items, g: { base: c.g.base, s: c.g.s, tx: c.g.tx, ty: c.g.ty, beard: c.g.beard, f: feats },
      G: { ...G, L: G.L.split(",").map(Number), R: G.R.split(",").map(Number) },
      closed: { neutral: mouthIn(raw.closed[c.id].neutral), happy: mouthIn(raw.closed[c.id].happy) },
    };
    by[c.id] = p; all.push(p);
  }
  for (const k of raw.clones) {
    const o = by[k.src];
    const hairItems = o.items.filter((it) => it.kind === "hair" && it.fill);
    const items = o.items.map((it) => {
      const n = { ...it };
      if (k.skin && it.kind === "skin" && it.fill) n.fill = k.skin;
      if (k.hair && hairItems.includes(it)) { if (it.stroke && it.fill && it.stroke.join() === it.fill.join()) n.stroke = k.hair; n.fill = k.hair; }
      return n;
    });
    const f = { ...o.g.f, brows: parseF(k.brows) };
    all.push({
      id: k.id, items, g: { ...o.g, f, beard: o.g.beard ? (k.skin || o.g.beard) : null },
      G: { ...o.G, skin: k.skin || o.G.skin }, closed: { neutral: mouthIn(raw.closed[k.id].neutral), happy: mouthIn(raw.closed[k.id].happy) },
    });
  }
  return all.filter((p) => !raw.removed.includes(p.id));
}

// ---------------- cached artwork paths ----------------
const cacheKeyOf = new WeakMap<object, string>();
let keySeq = 0;
function fkey(o: object) { let k = cacheKeyOf.get(o); if (!k) { k = "f" + keySeq++; cacheKeyOf.set(o, k); } return k; }

export class Painter {
  cr: Cairo<any>;
  cache = new Map<string, unknown>();
  closedMouths = false;
  constructor(cr: Cairo<any>) { this.cr = cr; }
  /** final.draw(cr, cmds, close) */
  item(it: Item) {
    let h = this.cache.get(it.key);
    if (!h) { h = this.cr.b.makePath(it.cmds, !it.open); this.cache.set(it.key, h); }
    this.cr.appendCached(h);
  }
  /** render4.path(cr, cmds) — features (segments with explicit Z) */
  kpath(cmds: Cmd[][]) {
    const k = fkey(cmds);
    let h = this.cache.get(k);
    if (!h) { h = this.cr.b.makePath(cmds.flat(), false); this.cache.set(k, h); }
    this.cr.appendCached(h);
  }
  fillp(cmds: Cmd[][] | null, rgb: RGB) {
    if (!cmds) return; const cr = this.cr;
    this.kpath(cmds); cr.setFillRule(true); cr.setRGB(rgb); cr.fill(); cr.setFillRule(false);
  }
  paintItems(items: Item[]) {
    const cr = this.cr;
    for (const it of items) {
      this.item(it);
      if (it.fill) { cr.setFillRule(it.evenodd); cr.setRGB(it.fill); cr.fillPreserve(); }
      if (it.stroke && it.sw > 0) { cr.setLineWidth(it.sw); cr.setRGB(it.stroke); cr.strokePreserve(); }
      cr.newPath();
    }
  }
}

// ---------------- geometry helpers ----------------
function cont(G: Geo, y: number): [number, number] {
  const h = G.L.length; const yy0 = Math.floor(Math.min(Math.max(y - G.y0, 0), h - 1));
  for (let d = 0; d < 40; d++) for (const yy of [yy0 - d, yy0 + d]) if (yy >= 0 && yy < h && G.L[yy] >= 0) return [G.L[yy] + G.x0, G.R[yy] + G.x0];
  return [G.cx - G.nw / 2, G.cx + G.nw / 2];
}
const bbx = (cmds: Cmd[][]) => {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const s of cmds) for (const c of s) for (let i = 0; i < c.p.length; i += 2) { x0 = Math.min(x0, c.p[i]); x1 = Math.max(x1, c.p[i]); y0 = Math.min(y0, c.p[i + 1]); y1 = Math.max(y1, c.p[i + 1]); }
  return [x0, x1, y0, y1];
};

// ---------------- clothing ----------------
function strokeInk(cr: Cairo, w: number) { cr.setRGB(INK); cr.setLineWidth(w); cr.stroke(); }

function garmentPath(cr: Cairo, G: Geo, ytop: number, neck: (cr: Cairo, l: number[], r: number[]) => void) {
  const ew = G.ew, cx = G.cx; const [cl_, cr_] = G.col!; const n = (cr_ - cl_) / 2;
  const [l0, r0] = cont(G, G.base);
  const S = Math.max(Math.max(cx - l0, r0 - cx) * 1.05, 3.9 * ew) * (G.sf || 1);
  const y0 = ytop, ext = 7.5 * ew;
  const side = (sg: number) => {
    const pts: number[][] = [[sg > 0 ? cr_ : cl_, y0]];
    const bez = (p0: number[], p1: number[], p2: number[], p3: number[], k = 8) => {
      for (let i = 1; i <= k; i++) { const t = i / k, u = 1 - t; pts.push([u ** 3 * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t ** 3 * p3[0], u ** 3 * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t ** 3 * p3[1]]); }
    };
    const tip = [cx + sg * S * 0.93, y0 + 0.75 * ew];
    bez(pts[0], [pts[0][0] + sg * (S - n) * 0.45, y0 + 0.08 * ew], [cx + sg * S * 0.8, y0 + 0.35 * ew], tip);
    bez(tip, [cx + sg * S * 1.03, y0 + 1.0 * ew], [cx + sg * S * 1.05, y0 + 1.6 * ew], [cx + sg * S * 1.05, y0 + 2.6 * ew]);
    pts.push([cx + sg * S * 1.06, y0 + ext - 0.6 * ew]); pts.push([cx + sg * S * 1.0, y0 + ext]);
    const dy = (sg > 0 ? G.shr || 0 : G.shl || 0) * ew;
    const out = [pts[0]];
    for (const [x, y] of pts.slice(1)) { const w = Math.min(1, Math.max(0, (Math.abs(x - cx) - n) / Math.max(1, (S - n) * 0.7))); out.push([x, y + dy * w]); }
    return out;
  };
  const Lp = side(-1), Rp = side(1);
  cr.moveTo(Lp[0][0], Lp[0][1]);
  for (const q of Lp.slice(1)) cr.lineTo(q[0], q[1]);
  for (const q of [...Rp].reverse()) cr.lineTo(q[0], q[1]);
  neck(cr, Lp[0], Rp[0]); cr.closePath();
  G.S = S;
  return [Lp, Rp];
}
const U = (depth: number) => (cr: Cairo, lp: number[], rp: number[]) => {
  const cx = (lp[0] + rp[0]) / 2, y = Math.max(lp[1], rp[1]) + depth;
  cr.curveTo(rp[0] - (rp[0] - cx) * 0.3, y, lp[0] + (cx - lp[0]) * 0.3, y, lp[0], lp[1]);
};
const V = (depth: number) => (cr: Cairo, lp: number[], rp: number[]) => { cr.lineTo((lp[0] + rp[0]) / 2, Math.max(lp[1], rp[1]) + depth); cr.lineTo(lp[0], lp[1]); };

function neckEdges(G: Geo): [number, number, number] {
  const ew = G.ew; let [l, r] = cont(G, G.yneck); const w0 = r - l;
  let yt = G.yneck;
  while (yt < G.base - 0.6 * ew) { [l, r] = cont(G, yt); if (r - l > w0 * 1.22) break; yt += 1; }
  yt = Math.max(yt, (G.chin_bot ?? 0) + 0.5 * ew, (G.beard_bot ?? 0) + 0.5 * ew);
  yt = Math.min(yt, G.base - 0.6 * ew);
  [l, r] = cont(G, yt);
  return [yt, l, r];
}

function drawClothes(cr: Cairo, G: Geo, cl: Cloth) {
  const ew = G.ew, cx = G.cx;
  const [yt, l, r] = neckEdges(G); G.col = [l, r]; G.col_y = yt; const n = (r - l) / 2;
  const st = cl.style;
  G.cloth = st === "cardigan" ? cl.c2 : cl.c;
  const depth = ({ crew: 0.5, v: 1.4, stripe: 0.5, henley: 0.45, turtle: 0.2, cardigan: 0.5 } as Record<string, number>)[st] * n;
  const neck = st === "v" ? V(depth) : U(depth);
  cr.moveTo(l, yt - 2); cr.lineTo(r, yt - 2); cr.lineTo(r, yt + depth + ew); cr.lineTo(l, yt + depth + ew); cr.closePath();
  cr.setRGB(G.skin); cr.fill();
  const [Lp, Rp] = garmentPath(cr, G, yt, neck);
  const body = cr.copyPath();
  cr.setRGB(cl.c); cr.fill();
  cr.save(); cr.appendPath(body); cr.clip();
  const ytop = Math.max(Lp[0][1], Rp[0][1]);
  if (st === "stripe") {
    let y = ytop + depth + 0.25 * ew;
    while (y < yt + 30 * ew) { cr.rectangle(cx - 30 * ew, y, 60 * ew, 0.32 * ew); y += 0.78 * ew; }
    cr.setRGB(cl.c2); cr.fill();
  }
  if (st === "henley") {
    const y0 = ytop + depth;
    cr.moveTo(cx, y0); cr.lineTo(cx, y0 + 2.4 * ew); strokeInk(cr, 9);
    for (let k = 0; k < 3; k++) { cr.arc(cx + 0.28 * ew, y0 + (0.5 + 0.75 * k) * ew, 0.2 * ew, 0, TAU); cr.setRGB(cl.c2); cr.fillPreserve(); strokeInk(cr, 9); }
  }
  if (st === "cardigan") {
    const yv = ytop + 2.6 * ew;
    for (const sg of [-1, 1]) {
      const p0 = sg < 0 ? Lp[0] : Rp[0];
      cr.moveTo(p0[0] - sg * 0.1 * ew, p0[1] - 1); cr.lineTo(cx + sg * 0.35 * ew, yv); cr.lineTo(cx + sg * 0.35 * ew, yt + 30 * ew);
      cr.lineTo(cx + sg * 30 * ew, yt + 30 * ew); cr.lineTo(cx + sg * 30 * ew, p0[1] - 3 * ew); cr.closePath();
      cr.setRGB(cl.c2); cr.fill();
      cr.moveTo(p0[0] - sg * 0.1 * ew, p0[1]); cr.lineTo(cx + sg * 0.35 * ew, yv); cr.lineTo(cx + sg * 0.35 * ew, yt + 30 * ew); strokeInk(cr, 9);
    }
    for (let k = 0; k < 3; k++) { cr.arc(cx - 0.75 * ew, yv + (0.5 + 1.0 * k) * ew, 0.2 * ew, 0, TAU); cr.setRGB(cl.btn); cr.fillPreserve(); strokeInk(cr, 9); }
  }
  let S = G.S!;
  for (const sg of [-1, 1]) {
    const dy = (sg > 0 ? G.shr || 0 : G.shl || 0) * ew;
    const xa = cx + sg * S * 0.63, ya = ytop + 1.6 * ew + dy;
    cr.moveTo(xa, ya);
    cr.curveTo(xa - sg * 0.12 * ew, ya + 1.8 * ew, xa - sg * 0.05 * ew, ya + 4.0 * ew, xa + sg * 0.15 * ew, ya + 5.6 * ew);
    strokeInk(cr, 9);
  }
  cr.restore();
  cr.appendPath(body); strokeInk(cr, 9);
  const hem = Lp[Lp.length - 1][1]; S = G.S!; G.knee_top = hem + 0.2 * ew - 1.5 * ew; const LEG = cl.pants || ([0.1, 0.11, 0.15] as RGB);
  for (const sg of [-1, 1]) { const kx = cx + sg * S * 0.5; cr.rectangle(kx - S * 0.36, hem + 0.6 * ew, S * 0.72, 7 * ew); cr.setRGB(LEG); cr.fillPreserve(); strokeInk(cr, 9); }
  for (const sg of [-1, 1]) {
    const kx = cx + sg * S * 0.5;
    cr.save(); cr.translate(kx, hem + 0.2 * ew); cr.scale(S * 0.5, 1.5 * ew); cr.arc(0, 0, 1, 0, TAU); cr.restore();
    cr.setRGB(LEG); cr.fillPreserve(); strokeInk(cr, 9);
  }
  if (st === "turtle") {
    const room = yt - (G.chin_bot ?? yt - 1.6 * ew);
    const hgt = Math.max(0.35 * ew, Math.min(0.9 * ew, room * 0.5)); const w = 0.12 * ew;
    cr.moveTo(l - w, yt + 0.25 * ew); cr.lineTo(l - 0.04 * ew, yt - hgt);
    cr.curveTo(l + n * 0.5, yt - hgt + 0.18 * ew, r - n * 0.5, yt - hgt + 0.18 * ew, r + 0.04 * ew, yt - hgt);
    cr.lineTo(r + w, yt + 0.25 * ew);
    cr.curveTo(r - n * 0.5, yt + 0.5 * ew, l + n * 0.5, yt + 0.5 * ew, l - w, yt + 0.25 * ew); cr.closePath();
    cr.setRGB(cl.c); cr.fillPreserve(); strokeInk(cr, 9);
  }
}

// ---------------- face ----------------
type State = {
  lean: number; breath: number; blink: number; mouth: number; look: [number, number]; happy: number; brow: number;
  shl: number; shr: number; p?: Plan; t?: number; ftop?: number;
};

function drawMouth(P: Painter, per: Person, st: State, ring: RGB | null = null) {
  const cr = P.cr; const f = per.g.f; const h = st.happy || 0;
  const src = P.closedMouths ? per.closed : f;
  const m = h < 0.5 ? src.neutral : src.happy;
  const o = (st.mouth ?? 1) * Math.max(0.12, Math.abs(1 - 2 * h));
  if (!m.mouth) return;
  cr.save(); cr.translate(m.mcx, m.mcy); cr.scale(1, o); cr.translate(-m.mcx, -m.mcy);
  if (ring) { P.kpath(m.mouth); cr.setRGB(ring); cr.setLineWidth(f.ew * 0.3); cr.stroke(); }
  P.fillp(m.mouth, EYE_INK);
  const b = bbx(m.mouth); const mw = b[1] - b[0], mh = b[3] - b[2];
  if (!P.closedMouths && mh * o > 0.28 * f.ew && mh > 0.35 * f.ew) {
    cr.save(); P.kpath(m.mouth); cr.clip();
    const th = Math.max(0.16 * f.ew, 0.2 * mh);
    cr.rectangle(b[0] - 5, b[2] - 5, mw + 10, th + 5); cr.setRGB([1, 1, 1]); cr.fill();
    cr.save(); cr.translate((b[0] + b[1]) / 2, b[3]); cr.scale(mw * 0.36, mh * 0.42); cr.arc(0, 0, 1, 0, TAU); cr.restore();
    cr.setRGB(TONGUE); cr.fill();
    cr.restore();
  }
  cr.restore();
  if (f.stache) P.fillp(f.stache, EYE_INK);
}

function drawFeatures(P: Painter, per: Person, st: State) {
  const cr = P.cr; const g = per.g, f = g.f;
  cr.save(); cr.translate(g.tx, g.ty); cr.scale(g.s, g.s);
  if (f.brows) { cr.save(); cr.translate(0, -(st.brow || 0) * 12); P.fillp(f.brows, EYE_INK); cr.restore(); }
  if (f.closed && !f.eyes.length) P.fillp(f.closed, EYE_INK);
  for (const e of f.eyes) {
    const b = st.blink || 0; const sy = Math.max(0.08, 1 - b);
    cr.save(); cr.translate(e.cx, e.cy); cr.scale(1, sy); cr.translate(-e.cx, -e.cy);
    if (!e.has_pupil) {
      if (b < 0.85) { P.fillp(e.white, [1, 1, 1]); if (e.static) P.fillp(e.static, EYE_INK); }
      cr.restore(); continue;
    }
    if (b < 0.85) {
      P.fillp(e.white, [1, 1, 1]);
      if (e.pupil) {
        cr.save(); P.kpath(e.white!); cr.clip();
        const [lx, ly] = st.look || [0, 0];
        cr.translate(lx * e.h * 0.18, ly * e.h * 0.08);
        P.kpath(e.pupil); cr.setRGB(EYE_INK); cr.fill();
        if (e.hl) P.fillp(e.hl, [1, 1, 1]);
        cr.restore();
      }
      if (e.lids) P.fillp(e.lids, EYE_INK);
    } else {
      const [x0, x1] = bbx(e.white!);
      cr.setLineWidth(Math.max(3.0, e.h * 0.09)); cr.setRGB(EYE_INK);
      cr.moveTo(x0, e.cy); cr.curveTo(x0 + (x1 - x0) * 0.3, e.cy + e.h * 0.12, x1 - (x1 - x0) * 0.3, e.cy + e.h * 0.12, x1, e.cy); cr.stroke();
    }
    cr.restore();
  }
  if (!g.beard) drawMouth(P, per, st);
  cr.restore();
}

function drawEarrings(cr: Cairo, G: Geo) {
  const ew = G.ew, ey = G.cy_eye; let best: number[] | null = null;
  for (let y = ey - 0.5 * ew; y < ey + 2.0 * ew; y += 2) { const [l, r] = cont(G, y); if (!best || r - l > best[0]) best = [r - l, y, l, r]; }
  const [bw, ym, l, r] = best!; let ylobe = ym;
  for (let y = ym; y < ym + 2.5 * ew; y += 2) { const [l2, r2] = cont(G, y); if (r2 - l2 < bw - 0.35 * ew) { ylobe = y; break; } }
  for (const x of [l + 0.3 * ew, r - 0.3 * ew]) {
    cr.moveTo(x, ylobe - 0.1 * ew); cr.lineTo(x, ylobe + 0.25 * ew); strokeInk(cr, 5);
    cr.arc(x, ylobe + 0.85 * ew, 0.6 * ew, 0, TAU); cr.setRGB([0.97, 0.96, 0.93]); cr.fillPreserve(); strokeInk(cr, 7);
  }
}

function drawPerson(P: Painter, per: Person, st: State) {
  const cr = P.cr; const g = per.g, G = per.G; const by = g.base; const { lean, breath } = st;
  cr.save(); cr.transform(1, 0, -lean, 1 + breath, lean * by, -breath * by);
  const items = per.items;
  P.paintItems(items);
  G.shl = st.shl || 0; G.shr = st.shr || 0;
  drawClothes(cr, G, per.cl!);
  const front = items.filter((it, k) => k > G.sk_last && it.kind === "hair" && it.bb[3] > G.ysh - G.ew);
  P.paintItems(front);
  if (G.earrings) drawEarrings(cr, G);
  if (!cr.sil) {
    // features only where the skin is visible (python: push_group mask / feat)
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const it of items) if (it.kind === "skin") { x0 = Math.min(x0, it.bb[0]); x1 = Math.max(x1, it.bb[1]); y0 = Math.min(y0, it.bb[2]); y1 = Math.max(y1, it.bb[3]); }
    cr.b.beginGroup(cr.deviceRect(x0, x1, y0, Math.min(y1, G.ysh), 4));
    drawFeatures(P, per, st);
    cr.b.beginMask(); cr.masking = true;
    for (const it of items) {
      if ((!it.fill && !it.stroke) || it.open) continue;
      P.item(it); cr.setFillRule(it.evenodd);
      if (it.kind === "skin") { cr.setRGB([1, 1, 1]); cr.fill(); } else cr.fill(true);
    }
    cr.masking = false; cr.b.endMasked();
    if (g.beard) { cr.save(); cr.translate(g.tx, g.ty); cr.scale(g.s, g.s); drawMouth(P, per, st, g.beard); cr.restore(); }
  }
  if (st.p) drawProps(P, per, st);
  cr.restore();
}

// ---------------- props (sprites) ----------------
export type SpriteMeta = { file: string; cat: string; w: number; h: number; tone: number[] };
let META: SpriteMeta[] = [];
export function setSpriteMeta(m: SpriteMeta[]) { META = m; }
function pick(cat: string, skin: RGB, parity: number | null = null) {
  const c = META.filter((m) => m.cat === cat && (parity === null || Number(m.file.split("_").pop()![0]) % 2 === parity));
  let best = c[0], bd = Infinity;
  for (const m of c) { const d = m.tone.reduce((s, v, i) => s + (v - skin[i]) ** 2, 0); if (d < bd) { bd = d; best = m; } }
  return best;
}
function blit(cr: Cairo, m: SpriteMeta, x: number, y: number, hgt: number, anchor: [number, number] = [0.5, 1], flip = false, rot = 0) {
  const k = hgt / m.h;
  cr.save(); cr.translate(x, y); cr.rotate(rot); cr.scale(flip ? -k : k, k); cr.translate(-anchor[0] * m.w, -anchor[1] * m.h);
  cr.image(m.file, m.w, m.h); cr.restore();
}

function drawPhone(cr: Cairo, G: Geo, st: State, p: Plan) {
  // a phone held low in front of the chest, screen lighting the face from below
  const ew = G.ew, cx = G.cx + p.phoneSide * 0.5 * ew, ft = st.ftop!;
  const w = 2.0 * ew, h = 3.3 * ew, y = Math.min(ft + 0.4 * ew, (G.col_y ?? ft) + 4.2 * ew);
  const rr = 0.35 * ew, x0 = cx - w / 2, y0 = y - h;
  const rrect = (x: number, yy: number, ww: number, hh: number, r: number) => {
    cr.newSubPath(); cr.arc(x + ww - r, yy + r, r, -Math.PI / 2, 0); cr.arc(x + ww - r, yy + hh - r, r, 0, Math.PI / 2);
    cr.arc(x + r, yy + hh - r, r, Math.PI / 2, Math.PI); cr.arc(x + r, yy + r, r, Math.PI, 1.5 * Math.PI); cr.closePath();
  };
  cr.save(); cr.translate(cx, y); cr.rotate(-p.phoneSide * 0.08); cr.translate(-cx, -y);
  rrect(x0, y0, w, h, rr); cr.setRGB([0.13, 0.13, 0.15]); cr.fillPreserve(); strokeInk(cr, 9);
  rrect(x0 + 0.22 * ew, y0 + 0.3 * ew, w - 0.44 * ew, h - 0.6 * ew, rr * 0.5); cr.setRGB([0.72, 0.84, 0.98]); cr.fill();
  // two thumbs on the lower corners
  for (const sg of [-1, 1]) {
    cr.save(); cr.translate(cx + sg * w * 0.42, y - 0.55 * ew); cr.scale(0.55 * ew, 0.85 * ew); cr.arc(0, 0, 1, 0, TAU); cr.restore();
    cr.setRGB(G.skin); cr.fillPreserve(); strokeInk(cr, 9);
  }
  cr.restore();
}

function drawProps(P: Painter, per: Person, st: State) {
  const cr = P.cr; const G = per.G; const p = st.p!; const t = st.t!; const ew = G.ew, cx = G.cx, ft = st.ftop!;
  const skin = G.skin;
  if (p.pop) {
    const sd = p.pop; const bob = 0.12 * ew * Math.sin(TAU * 0.6 * t + p.b);
    const bx = cx + sd * 1.6 * ew, by = ft + 1.3 * ew + bob;
    for (const [t0, du, vx, vy, kf] of activeToss(p, t)) {
      const u = (t - t0) / du;
      if (u >= 0 && u <= 1) {
        const tt = u * du; const kx = bx + sd * vx * ew * tt, ky = by - 4.4 * ew - vy * ew * tt + 9.0 * ew * tt * tt;
        const km = META.find((m) => m.file === kf); if (km) blit(cr, km, kx, ky, 0.85 * ew, [0.5, 0.5], false, 6 * tt * sd);
      }
    }
    blit(cr, pick("popcorn_hand", skin), cx - sd * 0.15 * ew, by, 4.8 * ew, [1, 1], sd > 0);
    return;
  }
  let c = 0, best: Clap | null = null;
  for (const w_ of nearClaps(p, t)) { const v = win(t, w_[0], w_[1], 0.3); if (v > c) { c = v; best = w_; } }
  if (c > 0 && best) {
    const [, , f, ph] = best;
    const fn = pick("clap", skin, 1);
    const amp = (p.amp || 1) * 0.85 * ew;
    const gap = amp * Math.pow(0.5 + 0.5 * Math.cos(TAU * f * t + ph), 0.7);
    let yb = ft + 0.8 * ew; const limit = G.col_y! - 0.8 * ew;
    if (yb - 3.8 * ew < limit) yb = limit + 3.8 * ew;
    const up = Math.min(p.raise * p.handsUp * ew, Math.max(0, yb - 3.8 * ew - limit));
    const lift = (1 - c) * (4.5 * ew + up);
    const y = yb - up + lift;
    const elbowY = (G.knee_top ?? ft + 3 * ew) - 0.3 * ew;
    const flen = Math.max(1.5 * ew, elbowY - (ft + 0.6 * ew));
    const sl = G.cloth || ([0.12, 0.12, 0.13] as RGB);
    for (const sd of [-1, 1]) {
      const hx = cx + sd * (0.42 * ew + gap), wy = y - 0.2 * ew;
      const ex = hx + sd * 0.9 * ew, ey = wy + flen;
      for (const [wdt, col] of [[1.25 * ew + 18, INK], [1.25 * ew, sl]] as [number, RGB][]) {
        cr.moveTo(hx, wy); cr.lineTo(ex, ey); cr.setLineWidth(wdt); cr.setRGB(col); cr.stroke();
      }
    }
    for (const sd of [-1, 1]) blit(cr, fn, cx + sd * (0.42 * ew + gap), y, 3.8 * ew, [0.5, 1], sd > 0, -sd * 0.12 * (gap / Math.max(amp, 1e-6)));
    return;
  }
  if (p.phoneFrom >= 0 && t >= p.phoneFrom) drawPhone(cr, G, st, p);
}

// ---------------- hall layout (as in scene.py: 16:9, six rows, 48 seats) ----------------
export const HALL = { W: 1920, H: 1080 };
const NR = 6;
const ROWS: { y: number; p: number; pb: number }[] = [];
{
  let y = 45, pitch = 140;
  for (let r = 0; r < NR; r++) { ROWS.push({ y, p: pitch * 1.12, pb: pitch }); y += pitch * 0.95; pitch *= 1.105; }
}
const COUNTS = [11, 10, 8, 8, 7, 4];
const SEAT: RGB = [0.76, 0.14, 0.12];
// «Затемнить зал»: a hazy backlit room, the rows and people as flat dark shapes
const SIL_BG: RGB = [0.34, 0.29, 0.32], SIL_SEAT: RGB = [0.19, 0.16, 0.18], SIL_PEOPLE: RGB = [0.045, 0.04, 0.05];
const FOG: RGB = [0.06, 0.0, 0.01];
const seatX = (r: number, c: number) => HALL.W / 2 + (c + (r % 2 ? 0.5 : 0)) * ROWS[r].p;

const BEST = ["C-07", "B-11", "C-01", "C-03", "B-01", "C-04", "C-10", "B-12", "C-09", "A-05", "B-05",
  "C-02", "C-06", "C-08", "A-01", "B-06", "A-13", "B-10", "A-04"];

type Place = { i: number; r: number; c: number };

// ---------------- behaviour plan (open-ended) ----------------
type Iv = [number, number];
type Clap = [number, number, number, number];
type Toss = [number, number, number, number, string];
export type Plan = {
  bl: number[]; c: [number, number, number][]; lk: [number, number][]; b: number; mf: [number, number];
  brow: Iv[]; hp: Iv[]; talk: Iv[]; partner: [number, number, number, number][];
  gl: [number, number, number][]; shrug: Iv[]; pop: number; toss: Toss[]; clap: Clap[];
  raise: number; amp: number; handsUp: number; hpLocked?: boolean; phoneFrom: number; phoneSide: number; horizon: number; r: Rng;
};

/** last index i with list[i][0] <= t (lists are sorted by start) */
function lastStart(list: ArrayLike<any>[], t: number) {
  let lo = 0, hi = list.length - 1, ans = -1;
  while (lo <= hi) { const m = (lo + hi) >> 1; if ((list[m][0] as number) <= t) { ans = m; lo = m + 1; } else hi = m - 1; }
  return ans;
}
function winMax(list: Iv[], t: number, r: number) {
  let v = 0; const i = lastStart(list, t + r);
  for (let k = i; k >= 0 && k > i - 4; k--) v = Math.max(v, win(t, list[k][0], list[k][1], r));
  return v;
}
function nearClaps(p: Plan, t: number) { const i = lastStart(p.clap, t + 0.3); return i < 0 ? [] : p.clap.slice(Math.max(0, i - 3), i + 1); }
function activeToss(p: Plan, t: number) { const i = lastStart(p.toss, t); return i < 0 ? [] : p.toss.slice(Math.max(0, i - 1), i + 1); }
const insertSorted = <T extends number[]>(list: T[], item: T) => { const i = lastStart(list, item[0]); list.splice(i + 1, 0, item); };

export type Mode = "idle" | "live" | "done";
/** how long the closing applause lasts (the stage waits for it before fading out) */
export const OVATION_SEC = 4.6;

export class Audience {
  cast: Person[]; places: Place[] = []; P: Plan[] = []; painter: Painter; rng: Rng;
  LWK = 1 / 60; mode: Mode = "idle"; finishedAt = -1; t = 0; nextChat = 4; liveSince = 0; phones = 0;
  chatRate = 1; // 1 = normal, >1 = more chatter (long pauses), <1 = attentive
  onTalk?: (j: number, t: number, dur: number) => void;

  constructor(cast: Person[], cr: Cairo<any>, seed: number) {
    this.cast = cast; this.painter = new Painter(cr); this.rng = new Rng(seed);
    this.dress(); this.place(); this.makePlan();
    this.LWK = this.cast.reduce((s, c) => s + 1 / c.G.ew, 0) / this.cast.length;
  }

  // build_cast: outfits (the order and colours change every run)
  dress() {
    const BLACK: RGB = [0.12, 0.12, 0.13], OFFW: RGB = [0.74, 0.71, 0.65];
    const MUTED: RGB[] = [[0.36, 0.3, 0.26], [0.29, 0.32, 0.36], [0.4, 0.25, 0.26], [0.28, 0.34, 0.29], [0.45, 0.39, 0.32], [0.25, 0.28, 0.36], [0.33, 0.27, 0.34]];
    const STYLE_FORCE: Record<string, [string, RGB | null]> = { "A-10": ["crew", null], "B-02": ["crew", [0.12, 0.12, 0.13]] };
    const SEQ = ["crew", "turtle", "stripe", "v", "cardigan", "henley"];
    const r = this.rng; const order = r.shuffle([...this.cast.keys()]); const off = r.randrange(SEQ.length), moff = r.randrange(MUTED.length);
    order.forEach((i, n) => {
      const st = SEQ[(n + off) % SEQ.length]; const mc = MUTED[(n + moff) % MUTED.length];
      const blk = (n % 5) < 3; const c = blk ? BLACK : mc;
      const cl: Cloth = { style: st, c, c2: [0.3, 0.3, 0.31], btn: [0.55, 0.52, 0.48] };
      if (st === "stripe") Object.assign(cl, { c: blk ? OFFW : mc, c2: BLACK });
      if (st === "cardigan") Object.assign(cl, { c: BLACK, c2: blk ? mc : n % 2 ? BLACK : [0.36, 0.3, 0.26] });
      if (st === "henley") cl.c2 = c === BLACK ? [0.55, 0.52, 0.48] : [0.85, 0.82, 0.76];
      const f = STYLE_FORCE[this.cast[i].id.replace(/\*$/, "")];
      if (f) { cl.style = f[0]; if (f[1]) cl.c = f[1]; }
      this.cast[i].cl = cl;
      this.cast[i].G = { ...this.cast[i].G };
    });
  }

  place() {
    const rng = this.rng; const W = HALL.W;
    const ids = this.cast.map((c) => c.id);
    // scene.place: the best-reading faces up front, clones furthest back; the
    // seats each of them gets (and the rest of the order) change every run
    const best = BEST.filter((b) => ids.includes(b));
    const rest = rng.shuffle([...ids.keys()].filter((i) => !best.includes(ids[i])));
    const clones = rest.filter((i) => ids[i].endsWith("*")), plain = rest.filter((i) => !ids[i].endsWith("*"));
    const queue = [...best.map((b) => ids.indexOf(b)), ...plain, ...clones];
    const out: Place[] = []; let k = 0;
    for (let r = NR - 1; r >= 0; r--) {
      const R = ROWS[r]; const n = Math.floor(W / 2 / R.p);
      const cand: number[] = []; for (let c = -n - 1; c < n + 2; c++) if (0.03 * W < seatX(r, c) && seatX(r, c) < 0.97 * W) cand.push(c);
      const want = Math.min(COUNTS[r], cand.length); const chosen = new Set<number>(); let guard = 0;
      while (chosen.size < want && guard++ < 500) {
        const c = rng.choice(cand); if (chosen.has(c)) continue;
        if (rng.random() < 0.5 && cand.includes(c + 1) && !chosen.has(c + 1) && chosen.size + 2 <= want) { chosen.add(c); chosen.add(c + 1); }
        else if (!(chosen.has(c - 1) || chosen.has(c + 1)) || rng.random() < 0.25) chosen.add(c);
      }
      const row = rng.shuffle(queue.slice(k, k + want)); k += want;
      [...chosen].sort((a, b) => a - b).forEach((c, j) => out.push({ i: row[j], r, c }));
    }
    out.sort((a, b) => a.r - b.r || a.c - b.c);
    this.places = out;
  }

  // final4.plan + scene.make_plan, generated ahead in chunks
  makePlan() {
    const n = this.places.length; const rp = this.rng;
    const pop = new Set(rp.sample(n, Math.min(n, Math.round(n * 9 / 48))));
    this.P = this.places.map((_, j) => {
      const r = new Rng(rp.randint(1, 1e9));
      const p: Plan = {
        bl: [], c: [0, 1, 2].map(() => [r.uniform(0.12, 0.4), r.uniform(0, TAU), r.uniform(0.5, 1)] as [number, number, number]),
        lk: [0, 1].map(() => [r.uniform(0.1, 0.35), r.uniform(0, TAU)] as [number, number]), b: r.uniform(0, TAU),
        mf: [r.uniform(3.5, 5), r.uniform(6, 8)], brow: [], hp: [], talk: [], partner: [], gl: [], shrug: [],
        pop: pop.has(j) ? r.choice([-1, 1]) : 0, toss: [], clap: [], raise: r.choice([0, 0, r.uniform(0.6, 1.4), r.uniform(1.6, 3.0)]),
        amp: r.uniform(0.6, 1.15), handsUp: 1, phoneFrom: -1, phoneSide: r.choice([-1, 1]), horizon: 0, r,
      };
      return p;
    });
    for (const p of this.P) this.extend(p, 0, 120);
  }
  private extend(p: Plan, from: number, to: number) {
    const r = p.r;
    const last = (a: number[][] | number[], d: number) => (a.length ? (Array.isArray(a[a.length - 1]) ? (a[a.length - 1] as number[])[1] : (a[a.length - 1] as number)) : from + d);
    let t0 = p.bl.length ? p.bl[p.bl.length - 1] + r.uniform(2.2, 4.2) : from + r.uniform(0.3, 2.0);
    while (t0 < to) { p.bl.push(t0); if (r.random() < 0.2) p.bl.push(t0 + 0.28); t0 += r.uniform(2.2, 4.2); }
    t0 = p.brow.length ? last(p.brow, 0) + r.uniform(2, 4) : from + r.uniform(0.5, 3);
    while (t0 < to) { const d = r.uniform(0.5, 1.0); p.brow.push([t0, t0 + d]); t0 += d + r.uniform(2, 4); }
    if (!p.hpLocked) {
      t0 = p.hp.length ? last(p.hp, 0) + r.uniform(1.5, 3.5) : from + r.uniform(0.3, 2.5);
      while (t0 < to) { const d = r.uniform(1.4, 2.8); p.hp.push([t0, t0 + d]); t0 += d + r.uniform(1.5, 3.5); }
    }
    t0 = p.gl.length ? p.gl[p.gl.length - 1][1] + r.uniform(4, 8) : from + r.uniform(0.5, 4);
    while (t0 < to) { const dd = r.uniform(0.5, 0.9); insertSorted(p.gl, [t0, t0 + dd, r.choice([-1, 1])]); t0 += dd + r.uniform(4, 8); }
    t0 = p.shrug.length ? last(p.shrug, 0) + r.uniform(4, 9) : from + r.uniform(0.5, 6);
    while (t0 < to) { p.shrug.push([t0, t0 + r.uniform(0.35, 0.6)]); t0 += r.uniform(4, 9); }
    if (p.pop) {
      t0 = p.toss.length ? p.toss[p.toss.length - 1][0] + r.uniform(2.5, 6) : from + r.uniform(0.5, 3);
      while (t0 < to) { p.toss.push([t0, r.uniform(0.9, 1.3), r.uniform(1.0, 3.0), r.uniform(6, 9), "kernel_" + r.randint(3, 5) + ".png"]); t0 += r.uniform(2.5, 6); }
    }
    p.horizon = to;
  }

  // ---- stage events ----
  /** the speaker walks out: applause wave */
  start(t: number) {
    this.mode = "live"; this.liveSince = t; this.nextChat = t + 6;
    for (const p of this.P) {
      if (p.pop) continue;
      if (p.r.random() < 0.92) { const a = t + p.r.uniform(0, 0.8); insertSorted(p.clap, [a, a + p.r.uniform(2.3, 3.2), p.r.uniform(2.0, 5.2), p.r.uniform(0, TAU)]); }
      insertSorted(p.hp, [t + p.r.uniform(0, 0.5), t + p.r.uniform(2.5, 3.5)]);
    }
  }
  /** the speaker finishes: ovation, everybody claps, hands higher, wide smiles */
  finish(t: number) {
    this.finishedAt = t;
    this.mode = "done";
    for (const p of this.P) {
      p.pop = 0; p.phoneFrom = -1; p.handsUp = 1.5; p.talk = p.talk.filter((iv) => iv[1] < t);
      // a proper round of applause that dies down by OVATION_SEC
      const a = t + p.r.uniform(0, 0.6); insertSorted(p.clap, [a, t + OVATION_SEC - p.r.uniform(0.4, 1.4), p.r.uniform(2.0, 5.2), p.r.uniform(0, TAU)]);
      p.hpLocked = true; insertSorted(p.hp, [t, t + OVATION_SEC + 1]);
    }
  }

  private chatter(t: number) {
    if (this.mode !== "live" || t < this.nextChat) return;
    const busy = (j: number) => this.P[j].talk.some((iv) => iv[1] > t - 1) || this.P[j].pop !== 0;
    const pairs: [number, number][] = [];
    for (let a = 0; a < this.places.length - 1; a++) {
      const A = this.places[a], B = this.places[a + 1];
      if (A.r === B.r && B.c - A.c === 1 && !busy(a) && !busy(a + 1)) pairs.push([a, a + 1]);
    }
    if (pairs.length) {
      const [a, b] = this.rng.choice(pairs); const r = this.rng;
      const s = t + 0.3, e = s + r.uniform(4, 7);
      this.P[a].partner.push([b, s, e, 1]); this.P[b].partner.push([a, s, e, -1]);
      let tt = s; let sp = r.choice([a, b]);
      while (tt < e - 0.5) {
        const d = r.uniform(0.9, 1.7); this.P[sp].talk.push([tt, Math.min(e, tt + d)]);
        this.onTalk?.(sp, tt, Math.min(e, tt + d) - tt);
        tt += d + 0.2; sp = sp === a ? b : a;
      }
      for (const [j, d] of [[a, 1], [b, -1]] as [number, number][]) {
        const p = this.P[j]; let g = s + r.uniform(0, 1.0);
        while (g < e - 0.6) { const dd = r.uniform(0.6, 1.1); insertSorted(p.gl, [g, g + dd, d]); g += dd + r.uniform(1.3, 2.6); }
      }
    }
    this.nextChat = t + this.rng.uniform(5, 11) / Math.max(0.3, this.chatRate);
  }

  private phonesTick(t: number) {
    if (this.mode !== "live") return;
    const el = t - this.liveSince; // after ~2.5 min some phones come out, one more every ~25 s
    const want = el < 150 ? 0 : Math.min(5, 1 + Math.floor((el - 150) / 25));
    while (this.phones < want) {
      const free = this.P.map((p, j) => j).filter((j) => !this.P[j].pop && this.P[j].phoneFrom < 0);
      if (!free.length) break;
      this.P[this.rng.choice(free)].phoneFrom = t; this.phones++;
    }
  }

  // final4.state + scene.state
  state(j: number, t: number): State {
    const p = this.P[j];
    let s = 0, sa = 0; for (const [f, ph, a] of p.c) { s += a * Math.sin(TAU * f * t + ph); sa += a; } s /= sa;
    const st: State = { lean: s * 0.03, breath: 0.004 * Math.sin(TAU * 0.25 * t + p.b), blink: 0, mouth: 1, look: [0, 0], happy: 0, brow: 0, shl: 0, shr: 0 };
    let lo = 0, hi = p.bl.length - 1, bi = -1;
    while (lo <= hi) { const m = (lo + hi) >> 1; if (p.bl[m] <= t) { bi = m; lo = m + 1; } else hi = m - 1; }
    for (let k = Math.max(0, bi - 1); k <= bi; k++) { const d = t - p.bl[k]; if (d >= 0 && d < 0.18) st.blink = Math.max(st.blink, 1 - Math.abs(d - 0.09) / 0.09); }
    let partnerW = 0;
    for (const [, a, b, d] of p.partner) { const w = win(t, a, b, 0.4); if (w > partnerW) { partnerW = w; st.lean = st.lean * (1 - w) + d * 0.035 * w; } }
    const tk = winMax(p.talk, t, 0.1);
    st.happy = Math.max(winMax(p.hp, t, 0.12), tk);
    if (tk) {
      const [f1, f2] = p.mf; const v = Math.max(0, 0.55 * Math.sin(TAU * f1 * t) + 0.45 * Math.sin(TAU * f2 * t + 1));
      st.mouth = 1 - tk * 0.35 + tk * 0.45 * v;
      st.brow = 0.4 * tk * (0.5 + 0.5 * Math.sin(TAU * 0.8 * t));
    }
    st.brow += winMax(p.brow, t, 0.15);
    // scene.state
    let lx = 0; const gi = lastStart(p.gl, t + 0.12);
    for (let k = gi; k >= 0 && k > gi - 4; k--) { const [a, b, d] = p.gl[k]; lx += d * 0.95 * win(t, a, b, 0.12); }
    st.look = [Math.max(-1, Math.min(1, lx)), 0];
    if (partnerW > 0) st.lean *= 0.6;
    if (p.phoneFrom >= 0 && t >= p.phoneFrom && !p.pop) { const w = ss(p.phoneFrom, p.phoneFrom + 0.6, t); st.look = [st.look[0] * (1 - w), w]; st.lean *= 1 - 0.5 * w; }
    const br = 0.06 * Math.sin(TAU * 0.25 * t + p.b); let sh = -br;
    sh -= 0.42 * winMax(p.shrug, t, 0.18);
    if (tk) sh -= tk * 0.12 * Math.max(0, Math.sin(TAU * 2.2 * t + p.b));
    const hp = st.happy * (1 - tk); const bounce = -hp * 0.1 * Math.max(0, Math.sin(TAU * 3.2 * t));
    const roll = 0.08 * Math.sin(TAU * 0.17 * t + p.b * 2);
    if (this.painter.closedMouths) st.mouth = 1;
    st.shl = sh + bounce + roll; st.shr = sh + bounce - roll;
    return st;
  }

  personTf(pl: Place): number[] {
    const per = this.cast[pl.i]; const R = ROWS[pl.r]; const G = per.G, g = per.g;
    const s = (R.pb * 0.105) / G.ew; const x = seatX(pl.r, pl.c);
    const eyeY = g.ty + g.s * (g.f.eyes.reduce((a, e) => a + e.cy, 0) / g.f.eyes.length);
    const ty = R.y + R.pb * 0.36;
    return [s, 0, 0, s, x - s * G.cx, ty - s * eyeY];
  }
  frontTop(pl: Place) {
    const r = pl.r; const Y = r + 1 < NR ? ROWS[r + 1].y + ROWS[r + 1].pb * 0.16 : HALL.H + 0.05 * ROWS[r].pb;
    const m = this.personTf(pl); return (Y - m[5]) / m[3];
  }
  /** mouth position of viewer j in hall units (for chat bubbles) */
  mouthAt(j: number): [number, number] {
    const pl = this.places[j]; const per = this.cast[pl.i]; const m = this.personTf(pl); const g = per.g;
    const mx = g.tx + g.s * g.f.neutral.mcx, my = g.ty + g.s * g.f.neutral.mcy;
    return [m[0] * mx + m[4], m[3] * my + m[5]];
  }
  headSize(j: number) { return ROWS[this.places[j].r].pb; }

  seat(r: number, x: number, col: RGB) {
    const cr = this.painter.cr; const R = ROWS[r]; const w = R.p * 0.88, h = R.pb * 2.6, rr = R.pb * 0.2;
    const x0 = x - w / 2, y0 = R.y + R.pb * 0.16;
    cr.newSubPath(); cr.arc(x0 + w - rr, y0 + rr, rr, -Math.PI / 2, 0); cr.lineTo(x0 + w, y0 + h); cr.lineTo(x0, y0 + h); cr.arc(x0 + rr, y0 + rr, rr, Math.PI, 1.5 * Math.PI); cr.closePath();
    cr.setRGB(col); cr.fillPreserve();
    cr.setRGB(INK); cr.setLineWidth(9 * R.pb * 0.105 * this.LWK); cr.stroke();
  }

  /** advance behaviour to time t (seconds) */
  tick(t: number) {
    this.t = t;
    for (const p of this.P) if (t + 30 > p.horizon) this.extend(p, p.horizon, p.horizon + 120);
    this.chatter(t); this.phonesTick(t);
  }

  /** scene.frame: draw the hall at time t; `sil` 0..1 blends into silhouettes */
  frame(t: number, sil = 0) {
    const cr = this.painter.cr;
    if (sil < 0.999) this.pass(t, null);
    if (sil > 0.001) {
      if (sil < 0.999) cr.b.beginLayer(sil);
      this.pass(t, SIL_PEOPLE);
      if (sil < 0.999) cr.b.endLayer();
    }
  }
  private pass(t: number, sil: RGB | null) {
    const cr = this.painter.cr; const W = HALL.W, H = HALL.H;
    cr.sil = null;
    // the house: a dark red room; with the lights down a dim haze the rows stand against
    cr.setRGB(sil ? SIL_BG : [0.16, 0.02, 0.02]); cr.paint();
    for (let r = 0; r < NR; r++) {
      const R = ROWS[r]; const n = Math.floor(W / 2 / R.p) + 2;
      cr.sil = sil ? SIL_SEAT : null;
      for (let c = -n - 1; c < n + 2; c++) this.seat(r, seatX(r, c), SEAT);
      cr.sil = sil;
      this.places.forEach((pl, j) => {
        if (pl.r !== r) return;
        const per = this.cast[pl.i];
        cr.save(); const m = this.personTf(pl); cr.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
        const st = this.state(j, t); st.p = this.P[j]; st.t = t; st.ftop = this.frontTop(pl);
        drawPerson(this.painter, per, st); cr.restore();
      });
      cr.sil = null;
      if (r < NR - 1) { cr.setRGBA(sil ? SIL_BG : FOG, sil ? 0.1 : 0.13); cr.paint(); }
    }
    if (!sil) {
      const fl = 0.5 + 0.3 * Math.sin((TAU * t) / 3.1) + 0.2 * Math.sin((TAU * t) / 0.77);
      cr.radial(W / 2, H * 0.55, 100, W * 0.75, [1, 0.88, 0.75, 0.05 + 0.03 * fl], [1, 0.88, 0.75, 0]);
      cr.radial(W / 2, H / 2, H * 0.45, W * 0.75, [0, 0, 0, 0], [0.04, 0, 0, 0.45]);
    }
  }
}

