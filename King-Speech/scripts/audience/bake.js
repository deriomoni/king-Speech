// Node port of the Show Time Audience *setup* stage (final.load, final4.setup/refine,
// scene.geometry/build_cast static part, apply_fixes, make_clones, close_mouths).
// Output: one JSON the app ships with; the per-frame code lives in the app.
// usage: node bake.js <code/data dir> <feats json dir> <out.json>
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const DATA = process.argv[2], FJ = process.argv[3], OUT = process.argv[4];
const J = (n) => JSON.parse(fs.readFileSync(path.join(FJ, n + ".json"), "utf8"));
const FE = J("feats5"), AL = J("align"), F2 = J("feats2");

// ---------------- svg path parsing (svgpathtools semantics) ----------------
function tokenize(d) {
  const re = /([MmLlHhVvCcSsQqTtAaZz])|(-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)/g;
  const out = []; let m;
  while ((m = re.exec(d))) out.push(m[1] ? m[1] : Number(m[2]));
  return out;
}
// segments: {t:'L'|'C'|'Q'|'A', p0, ...}
function parsePath(d) {
  const tk = tokenize(d); let i = 0, cmd = null;
  let cx = 0, cy = 0, sx = 0, sy = 0, lc = null, lq = null; const segs = [];
  const num = () => tk[i++];
  // A-flags may be glued ("011"): handled by re splitting digits? flags in Figma output are spaced; keep simple.
  while (i < tk.length) {
    if (typeof tk[i] === "string") cmd = tk[i++];
    const rel = cmd === cmd.toLowerCase(); const C = cmd.toUpperCase();
    const ox = rel ? cx : 0, oy = rel ? cy : 0;
    if (C === "Z") { if (Math.abs(cx - sx) > 1e-6 || Math.abs(cy - sy) > 1e-6) segs.push({ t: "L", p0: [cx, cy], p1: [sx, sy] }); cx = sx; cy = sy; lc = lq = null; continue; }
    if (C === "M") { cx = ox + num(); cy = oy + num(); sx = cx; sy = cy; cmd = rel ? "l" : "L"; lc = lq = null; continue; }
    if (C === "L") { const x = ox + num(), y = oy + num(); segs.push({ t: "L", p0: [cx, cy], p1: [x, y] }); cx = x; cy = y; lc = lq = null; continue; }
    if (C === "H") { const x = (rel ? cx : 0) + num(); segs.push({ t: "L", p0: [cx, cy], p1: [x, cy] }); cx = x; lc = lq = null; continue; }
    if (C === "V") { const y = (rel ? cy : 0) + num(); segs.push({ t: "L", p0: [cx, cy], p1: [cx, y] }); cy = y; lc = lq = null; continue; }
    if (C === "C" || C === "S") {
      let c1;
      if (C === "C") c1 = [ox + num(), oy + num()];
      else c1 = lc ? [2 * cx - lc[0], 2 * cy - lc[1]] : [cx, cy];
      const c2 = [ox + num(), oy + num()], e = [ox + num(), oy + num()];
      segs.push({ t: "C", p0: [cx, cy], c1, c2, p1: e }); lc = c2; lq = null; cx = e[0]; cy = e[1]; continue;
    }
    if (C === "Q" || C === "T") {
      let q;
      if (C === "Q") q = [ox + num(), oy + num()];
      else q = lq ? [2 * cx - lq[0], 2 * cy - lq[1]] : [cx, cy];
      const e = [ox + num(), oy + num()];
      segs.push({ t: "Q", p0: [cx, cy], q, p1: e }); lq = q; lc = null; cx = e[0]; cy = e[1]; continue;
    }
    if (C === "A") {
      const rx = num(), ry = num(), rot = num(), la = num(), sw = num(), x = ox + num(), y = oy + num();
      segs.push({ t: "A", p0: [cx, cy], rx, ry, rot, la, sw, p1: [x, y] }); cx = x; cy = y; lc = lq = null; continue;
    }
    throw new Error("bad cmd " + cmd);
  }
  return segs;
}
function arcPoint(s, t) {
  // SVG endpoint -> centre parameterisation
  let { rx, ry } = s; const phi = (s.rot * Math.PI) / 180, [x1, y1] = s.p0, [x2, y2] = s.p1;
  const cp = Math.cos(phi), sp = Math.sin(phi);
  const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2;
  const x1p = cp * dx + sp * dy, y1p = -sp * dx + cp * dy;
  rx = Math.abs(rx); ry = Math.abs(ry);
  const lam = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lam > 1) { rx *= Math.sqrt(lam); ry *= Math.sqrt(lam); }
  let num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p; if (num < 0) num = 0;
  let co = Math.sqrt(num / (rx * rx * y1p * y1p + ry * ry * x1p * x1p)); if (s.la === s.sw) co = -co;
  const cxp = (co * rx * y1p) / ry, cyp = (-co * ry * x1p) / rx;
  const ccx = cp * cxp - sp * cyp + (x1 + x2) / 2, ccy = sp * cxp + cp * cyp + (y1 + y2) / 2;
  const ang = (ux, uy, vx, vy) => { const a = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy); return a; };
  const th1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dth = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!s.sw && dth > 0) dth -= 2 * Math.PI; if (s.sw && dth < 0) dth += 2 * Math.PI;
  const a = th1 + dth * t;
  return [ccx + rx * Math.cos(a) * cp - ry * Math.sin(a) * sp, ccy + rx * Math.cos(a) * sp + ry * Math.sin(a) * cp];
}
// final.path_cmds: M on discontinuity; C for cubic/quad; L for line; arcs -> 15 lines
function pathCmds(segs) {
  const out = []; let cur = null;
  const near = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) <= 1e-6;
  for (const s of segs) {
    if (!cur || !near(s.p0, cur)) out.push(["M", s.p0]);
    if (s.t === "C") out.push(["C", s.c1, s.c2, s.p1]);
    else if (s.t === "Q") { const [p0, c, e] = [s.p0, s.q, s.p1]; out.push(["C", [p0[0] + (2 / 3) * (c[0] - p0[0]), p0[1] + (2 / 3) * (c[1] - p0[1])], [e[0] + (2 / 3) * (c[0] - e[0]), e[1] + (2 / 3) * (c[1] - e[1])], e]); }
    else if (s.t === "L") out.push(["L", s.p1]);
    else for (let k = 1; k < 16; k++) out.push(["L", arcPoint(s, k / 15)]);
    cur = s.p1;
  }
  return out;
}
// exact-enough bbox: sample curves densely
function cmdsBBox(cmds) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, cur = null;
  const add = (p) => { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); };
  for (const c of cmds) {
    if (c[0] === "M" || c[0] === "L") { add(c[1]); cur = c[1]; }
    else { for (let k = 1; k <= 40; k++) add(bez(cur, c[1], c[2], c[3], k / 40)); cur = c[3]; }
  }
  return [x0, x1, y0, y1];
}
function bez(p0, p1, p2, p3, t) { const u = 1 - t; return [u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0], u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]]; }
// flatten closed polygons (draw(close=True) semantics)
function polys(cmds) {
  const P = []; let cur = null, poly = null;
  for (const c of cmds) {
    if (c[0] === "M") { poly = [c[1]]; P.push(poly); cur = c[1]; }
    else if (c[0] === "L") { poly.push(c[1]); cur = c[1]; }
    else { for (let k = 1; k <= 16; k++) poly.push(bez(cur, c[1], c[2], c[3], k / 16)); cur = c[3]; }
  }
  return P;
}
function inFill(cmds, x, y, evenodd) {
  let wn = 0, cross = 0;
  for (const p of polys(cmds)) for (let i = 0; i < p.length; i++) {
    const a = p[i], b = p[(i + 1) % p.length];
    if (a[1] <= y) { if (b[1] > y && (b[0] - a[0]) * (y - a[1]) - (x - a[0]) * (b[1] - a[1]) > 0) { wn++; cross++; } }
    else if (b[1] <= y && (b[0] - a[0]) * (y - a[1]) - (x - a[0]) * (b[1] - a[1]) < 0) { wn--; cross++; }
  }
  return evenodd ? cross % 2 === 1 : wn !== 0;
}
const svgD = (cmds) => {
  let s = "";
  for (const c of cmds) {
    if (c[0] === "M") s += (s ? "Z" : "") + `M${c[1][0]} ${c[1][1]}`;
    else if (c[0] === "L") s += `L${c[1][0]} ${c[1][1]}`;
    else s += `C${c[1][0]} ${c[1][1]} ${c[2][0]} ${c[2][1]} ${c[3][0]} ${c[3][1]}`;
  }
  return s + "Z";
};
const hexrgb = (h) => [0, 2, 4].map((i) => parseInt(h.replace("#", "").slice(i, i + 2), 16) / 255);
const attr = (a, k) => { const m = a.match(new RegExp("\\b" + k + '="([^"]*)"')); return m ? m[1] : null; };

function load(fn) {
  const s = fs.readFileSync(fn, "utf8");
  const W = Number(attr(s, "width")), H = Number(attr(s, "height"));
  const chars = [];
  for (const gm of s.matchAll(/<g id="([A-C]-\d\d)">([\s\S]*?)<\/g>/g)) {
    const items = [];
    for (const pm of gm[2].matchAll(/<path([^>]*)\/>/g)) {
      const a = pm[1]; const d = attr(a, "d"); if (!d) continue;
      const name = attr(a, "id") || "";
      const fill = attr(a, "fill"), stroke = attr(a, "stroke"), sw = attr(a, "stroke-width");
      const kind = name.startsWith("Skin") ? "skin" : name.startsWith("Hair") ? "hair" : name.startsWith("Shadow") ? "shadow" : "line";
      const cmds = pathCmds(parsePath(d));
      items.push({ cmds, bb: cmdsBBox(cmds), kind,
        fill: fill == null || fill === "none" ? null : hexrgb(fill),
        stroke: stroke == null || stroke === "none" ? null : hexrgb(stroke), sw: sw ? Number(sw) : 0,
        evenodd: attr(a, "fill-rule") === "evenodd", open: fill == null || fill === "none" });
    }
    chars.push({ id: gm[1], items });
  }
  return { W, H, chars };
}

// raster helpers ---------------------------------------------------------------
async function rasterGray(svgBody, w, h, bg) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${bg ? `<rect width="${w}" height="${h}" fill="${bg}"/>` : ""}${svgBody}</svg>`;
  const { data, info } = await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, info };
}
// TM_CCOEFF_NORMED, coarse-to-fine
function ncc(img, iw, ix0, iy0, cw, ch, tpl, tw, th, step) {
  // returns best (u,v) offset in crop coords, sampling every `step` pixel of template
  let tm = 0, n = 0;
  for (let y = 0; y < th; y += step) for (let x = 0; x < tw; x += step) { tm += tpl[y * tw + x]; n++; }
  tm /= n; let tv = 0;
  for (let y = 0; y < th; y += step) for (let x = 0; x < tw; x += step) { const d = tpl[y * tw + x] - tm; tv += d * d; }
  return (u, v) => {
    let si = 0, sii = 0, sti = 0;
    for (let y = 0; y < th; y += step) { const row = (iy0 + v + y) * iw + ix0 + u; for (let x = 0; x < tw; x += step) { const I = img[row + x]; si += I; sii += I * I; sti += (tpl[y * tw + x] - tm) * I; } }
    const iv = sii - (si * si) / n; return iv <= 0 || tv <= 0 ? -1 : sti / Math.sqrt(iv * tv);
  };
}
const IMGS = {};
async function castImage(k) {
  if (IMGS[k]) return IMGS[k];
  const fn = path.join(DATA, { A: "cast_new.png", B: "cast_new2.png", C: "cast_hq.png" }[k]);
  // cv2.imread(...,0): BT.601 luma
  const { data, info } = await sharp(fn).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const g = new Float32Array(info.width * info.height);
  for (let i = 0; i < g.length; i++) g[i] = Math.round(0.299 * data[i * 3] + 0.587 * data[i * 3 + 1] + 0.114 * data[i * 3 + 2]);
  return (IMGS[k] = { g, w: info.width, h: info.height });
}
async function refine(ch, im, s, tx, ty) {
  const it = ch.items;
  const X0 = Math.min(...it.map((i) => i.bb[0])), X1 = Math.max(...it.map((i) => i.bb[1]));
  const Y0 = Math.min(...it.map((i) => i.bb[2])), Y1 = Math.max(...it.map((i) => i.bb[3]));
  const Y1h = Y0 + 0.65 * (Y1 - Y0);
  const ox0 = (X0 - tx) / s, oy0 = (Y0 - ty) / s;
  const w = Math.floor((X1 - X0) / s) + 1, h = Math.floor((Y1h - Y0) / s) + 1;
  const body = it.filter((i) => i.fill).map((i) => { const v = Math.round((i.kind === "skin" ? 0.78 : 0.05) * 255); return `<path d="${svgD(i.cmds)}" fill="rgb(${v},${v},${v})"/>`; }).join("");
  const { data } = await rasterGray(`<g transform="translate(${-ox0} ${-oy0}) scale(${1 / s}) translate(${-tx} ${-ty})">${body}</g>`, w, h, "#fff");
  const tpl = new Float32Array(w * h); for (let i = 0; i < w * h; i++) tpl[i] = data[i * 4 + 2];
  const R = 70, xa = Math.floor(ox0) - R, ya = Math.floor(oy0) - R;
  const cx0 = Math.max(0, xa), cy0 = Math.max(0, ya);
  const cw = Math.min(im.w, xa + w + 2 * R) - cx0, chh = Math.min(im.h, ya + h + 2 * R) - cy0;
  if (chh < h || cw < w) return [0, 0];
  const U = cw - w, V = chh - h;
  const coarse = ncc(im.g, im.w, cx0, cy0, cw, chh, tpl, w, h, 4);
  let best = -2, bu = 0, bv = 0;
  for (let v = 0; v <= V; v += 2) for (let u = 0; u <= U; u += 2) { const r = coarse(u, v); if (r > best) { best = r; bu = u; bv = v; } }
  const fine = ncc(im.g, im.w, cx0, cy0, cw, chh, tpl, w, h, 1); best = -2; let fu = bu, fv = bv;
  for (let v = Math.max(0, bv - 3); v <= Math.min(V, bv + 3); v++) for (let u = Math.max(0, bu - 3); u <= Math.min(U, bu + 3); u++) { const r = fine(u, v); if (r > best) { best = r; fu = u; fv = v; } }
  return [fu + cx0 - ox0, fv + cy0 - oy0];
}

// feats4 helpers ------------------------------------------------------------------
const tf = (cmds, cs, ct, s) => cmds && cmds.map((seg) => seg.map((c) => (c[0] === "Z" ? c : [c[0], ...c.slice(1).map((p) => [ct[0] + s * (p[0] - cs[0]), ct[1] + s * (p[1] - cs[1])])])));
function bbx(cmds) { const xs = [], ys = []; for (const s of cmds) for (const c of s) if (c[0] !== "Z") for (const p of c.slice(1)) { xs.push(p[0]); ys.push(p[1]); } return [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]; }
const ctr = (c) => { const b = bbx(c); return [(b[0] + b[1]) / 2, (b[2] + b[3]) / 2]; };
const IDX = {}; for (const k of "ABC") for (const [n, j] of Object.entries(AL[k].match)) IDX[n] = [k, j];
function mouthFrom(dn, ct, s) {
  const D = F2[IDX[dn][0]][IDX[dn][1]]; const cs = ctr(D.mouth); const k = s / D.ew;
  const m = tf(D.mouth, cs, ct, k), t = D.teeth ? tf(D.teeth, cs, ct, k) : null; const b = bbx(m);
  return { mouth: m, teeth: t, mcx: ct[0], mtop: b[2], mcy: ct[1] };
}

// scene constants ------------------------------------------------------------------
const SMALL_BODY = ["B-02", "A-01", "A-02", "A-03", "A-04", "A-05", "A-06", "B-03", "B-04", "C-05"];
const MOUTH_SCALE = { "A-04": 0.62, "A-07": 0.72, "A-06": 0.72, "B-12": 0.8, "A-01": 0.72, "B-05": 0.72, "C-02": 0.75 };
const MOUTH_UP = { "B-02": 0.22, "A-07": 0.22, "C-01": 0.12 };
const EYE_SCALE = { "B-12": 1.12, "A-04": 1.15 };
const BROW_FROM = { "A-04": "B-01", "B-12": "C-09" };
const EARRINGS = ["A-07"];
const HEAD_SHIFT = { "A-06": 0.24 };
const CLONE = ["C-10", "A-01", "B-11", "B-09", "C-03", "A-11", "A-08", "B-04", "B-10", "C-07", "C-04", "C-02", "C-06"];
const HAIR_TONES = [[0.24, 0.15, 0.10], [0.36, 0.22, 0.13], [0.50, 0.28, 0.14], [0.30, 0.20, 0.16]];
const REMOVED = ["A-07"];

async function setup(k) {
  const { chars } = load(path.join(DATA, "svg", k + ".svg")); const a = AL[k];
  const im = await castImage(k); const S = [];
  for (const ch of chars) {
    const f = JSON.parse(JSON.stringify(FE[k][a.match[ch.id]]));
    const items = ch.items; const base = Math.max(...items.map((i) => i.bb[3]));
    const [dx, dy] = await refine(ch, im, a.s, a.tx, a.ty);
    const g = { f, base, s: a.s, tx: a.tx - a.s * dx, ty: a.ty - a.s * dy };
    const mm = f.neutral; const Y = g.ty + g.s * mm.mcy; const hits = []; let X = 0;
    for (X of [g.tx + g.s * (mm.mcx - 1.0 * f.ew), g.tx + g.s * (mm.mcx + 1.0 * f.ew)]) {
      let inh = false;
      for (const it of items) if (it.fill && !it.open && inFill(it.cmds, X, Y, it.evenodd)) inh = it.kind === "hair";
      hits.push(inh);
    }
    if (hits.every(Boolean)) {
      g.beard = items.filter((i) => i.kind === "skin" && i.fill)[0].fill;
      const hb = items.map((it, kk) => [it, kk]).filter(([it]) => it.kind === "hair" && it.fill && it.bb[0] < X && X < it.bb[1] && it.bb[2] < Y && Y < it.bb[3]).map(([, kk]) => kk);
      if (hb.length) { const hk = hb[hb.length - 1], hbb = items[hk].bb; ch.items = items.filter((it, kk) => !(kk > hk && it.kind === "skin" && hbb[0] <= it.bb[0] && it.bb[1] <= hbb[1] && hbb[2] <= it.bb[2] && it.bb[3] <= hbb[3])); }
      console.error("beard", ch.id);
    }
    console.error(ch.id, "refine", dx.toFixed(1), dy.toFixed(1));
    S.push({ ch, g });
  }
  return S;
}

async function geometry(ch, g) {
  const items = ch.items, f = g.f;
  const skIdx = items.map((it, k) => (it.kind === "skin" && it.fill ? k : -1)).filter((k) => k >= 0);
  const base = g.base;
  const x0 = Math.floor(Math.min(...items.flatMap((i) => i.bb.slice(0, 2)))) - 10, x1 = Math.floor(Math.max(...items.flatMap((i) => i.bb.slice(0, 2)))) + 10;
  const y0 = Math.floor(Math.min(...items.flatMap((i) => i.bb.slice(2)))) - 10, y1 = Math.floor(base) + 2;
  const w = x1 - x0, h = y1 - y0;
  const { data } = await rasterGray(`<g transform="translate(${-x0} ${-y0})">${skIdx.map((k) => `<path d="${svgD(items[k].cmds)}" fill="#000"/>`).join("")}</g>`, w, h, null);
  const on = (x, y) => data[(y * w + x) * 4 + 3] > 127;
  const cx = g.tx + g.s * f.axis, ew = f.ew * g.s, my = g.ty + g.s * f.neutral.mcy;
  const icx = Math.floor(cx - x0);
  const L = new Array(h).fill(NaN), R = new Array(h).fill(NaN);
  for (let y = 0; y < h; y++) {
    if (!on(Math.min(Math.max(icx, 0), w - 1), y)) {
      let a = -1, b = -1; for (let x = 0; x < w; x++) if (on(x, y)) { if (a < 0) a = x; b = x; }
      if (a >= 0) { L[y] = a; R[y] = b; } continue;
    }
    let a = icx; while (a > 0 && on(a - 1, y)) a--;
    let b = icx; while (b < w - 1 && on(b + 1, y)) b++;
    L[y] = a; R[y] = b;
  }
  const wid = L.map((l, y) => R[y] - l);
  const ya = Math.floor(my - y0 + 0.6 * ew), yb = Math.floor(base - y0 - 4);
  let yn = ya, mn = Infinity; for (let y = ya; y < yb; y++) { const v = isNaN(wid[y]) ? 1e9 : wid[y]; if (v < mn) { mn = v; yn = y; } }
  let nw = wid[yn]; if (!(nw <= 2.6 * ew && nw >= 0.8 * ew)) nw = 1.7 * ew;
  let ys = yn; for (let y = yn; y < yb; y++) if (!isNaN(wid[y]) && wid[y] > nw * 1.45) { ys = y; break; }
  const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
  return { cy_eye: g.ty + g.s * mean(f.eyes.map((e) => e.cy)), cx, ew, yneck: yn + y0, nw, ysh: ys + y0, base,
    sk_last: skIdx.length ? Math.max(...skIdx) : -1, x0, y0, L: L.map((v) => (isNaN(v) ? -1 : v)), R: R.map((v) => (isNaN(v) ? -1 : v)) };
}

(async () => {
  const cast = [];
  for (const k of "ABC") {
    for (const { ch, g } of await setup(k)) {
      if (HEAD_SHIFT[ch.id]) {
        const d = HEAD_SHIFT[ch.id] * g.f.ew * g.s;
        for (const it of ch.items) { it.cmds = it.cmds.map((c) => [c[0], ...c.slice(1).map((p) => [p[0] + d, p[1]])]); it.bb = [it.bb[0] + d, it.bb[1] + d, it.bb[2], it.bb[3]]; }
      }
      const G = await geometry(ch, g);
      const fh = ch.items.filter((it, kk) => kk > G.sk_last && it.kind === "hair" && Math.abs((it.bb[0] + it.bb[1]) / 2 - G.cx) < G.ew && it.bb[2] > G.cy_eye);
      if (g.beard && fh.length) G.beard_bot = Math.max(...fh.map((it) => it.bb[3]));
      const cl = ch.items.filter((it) => (it.kind === "line" || it.kind === "shadow") && Math.abs((it.bb[0] + it.bb[1]) / 2 - G.cx) < G.ew && G.cy_eye < it.bb[3] && it.bb[3] < G.ysh && it.bb[3] < G.base - 1.5 * G.ew).map((it) => it.bb[3]);
      if (cl.length) G.chin_bot = Math.max(...cl);
      G.skin = ch.items.filter((it) => it.kind === "skin" && it.fill)[0].fill;
      cast.push({ ch, g, G });
    }
  }
  // apply_fixes
  const by = Object.fromEntries(cast.map((c) => [c.ch.id, c]));
  for (const [cid, { g, G }] of Object.entries(by)) {
    const f = g.f, ew = f.ew;
    if (SMALL_BODY.includes(cid)) G.sf = 0.82;
    for (const key of ["neutral", "happy"]) {
      const m = f[key]; const b = bbx(m.mouth);
      if (MOUTH_SCALE[cid]) { const kk = MOUTH_SCALE[cid]; const c0 = [m.mcx, key === "happy" ? b[2] : (b[2] + b[3]) / 2]; m.mouth = tf(m.mouth, c0, c0, kk); if (m.teeth) m.teeth = tf(m.teeth, c0, c0, kk); }
      if (MOUTH_UP[cid]) { const d = -MOUTH_UP[cid] * ew; m.mouth = tf(m.mouth, [0, 0], [0, d], 1); m.mcy += d; if (m.teeth) m.teeth = tf(m.teeth, [0, 0], [0, d], 1); }
    }
    if (EYE_SCALE[cid]) { const kk = EYE_SCALE[cid]; for (const e of f.eyes) { const c0 = [e.cx, e.cy]; e.white = tf(e.white, c0, c0, kk); e.pupil = tf(e.pupil, c0, c0, kk); e.h *= kk; } }
    if (BROW_FROM[cid]) {
      const dg = by[BROW_FROM[cid]].g; const db = bbx(dg.f.brows), tb = bbx(f.brows); const kk = (tb[1] - tb[0]) / (db[1] - db[0]);
      f.brows = tf(dg.f.brows, [(db[0] + db[1]) / 2, (db[2] + db[3]) / 2], [(tb[0] + tb[1]) / 2, (tb[2] + tb[3]) / 2], kk);
    }
    if (EARRINGS.includes(cid)) G.earrings = true;
  }
  // make_clones -> descriptors (recolours + brows), applied in the app
  const key = (c) => c.join(",");
  const skins = []; for (const { G } of cast) if (!skins.some((s) => key(s) === key(G.skin))) skins.push(G.skin);
  skins.sort((a, b) => a[0] + a[1] + a[2] - (b[0] + b[1] + b[2]));
  const clones = CLONE.map((cid, n) => {
    const { ch, g, G } = by[cid];
    const hair = ch.items.filter((it) => it.kind === "hair" && it.fill);
    const dark = hair.length ? hair.every((it) => it.fill[0] + it.fill[1] + it.fill[2] < 0.4) : true;
    let skin = null, hairC = null;
    if (dark || n % 3 === 0) skin = skins[(skins.findIndex((s) => key(s) === key(G.skin)) + Math.floor(skins.length / 2)) % skins.length];
    if (!dark) hairC = HAIR_TONES[n % HAIR_TONES.length];
    const f = g.f;
    const brows = f.brows.map((sgm) => {
      const b = bbx([sgm]); const c = [(b[0] + b[1]) / 2, (b[2] + b[3]) / 2]; const side = c[0] < f.axis ? -1 : 1;
      const a = side * (n % 2 ? 0.08 : -0.06), ca = Math.cos(a), sa = Math.sin(a);
      const m = (p) => { const x = (p[0] - c[0]) * 1.08, y = (p[1] - c[1]) * 0.85; return [c[0] + x * ca - y * sa, c[1] + x * sa + y * ca]; };
      return sgm.map((cc) => (cc[0] === "Z" ? cc : [cc[0], ...cc.slice(1).map(m)]));
    });
    return { id: cid + "*", src: cid, skin, hair: hairC, brows };
  });
  // close_mouths variants, computed over the full cast order (originals + clones), before REMOVED
  const full = [...cast.map((c) => ({ id: c.ch.id, f: c.g.f })), ...clones.map((c) => ({ id: c.id, f: by[c.src].g.f }))];
  const lines = ["A-04", "B-08"], smiles = ["C-04", "B-02"];
  const closed = full.map(({ id, f }, n) => {
    const ew = f.ew, b = bbx(f.neutral.mouth); const ct = [(b[0] + b[1]) / 2, (b[2] + b[3]) / 2];
    const kk = ew * (MOUTH_SCALE[id.replace(/\*$/, "")] || 1.0);
    return { neutral: mouthFrom(n % 3 ? lines[n % 2] : smiles[n % 2], ct, kk), happy: mouthFrom(smiles[(n + 1) % 2], [ct[0], ct[1] + 0.05 * ew], kk * 1.05) };
  });
  // compact output -------------------------------------------------------------
  const R1 = (v) => Math.round(v * 10) / 10;
  const enc = (cmds) => cmds.map((c) => c[0] + c.slice(1).map((p) => R1(p[0]) + " " + R1(p[1])).join(" ")).join("");
  const encF = (cmds) => (cmds ? cmds.map((seg) => seg.map((c) => (c[0] === "Z" ? "Z" : c[0] + c.slice(1).map((p) => R1(p[0]) + " " + R1(p[1])).join(" "))).join("")).join("|") : null);
  const col = (c) => c && c.map((v) => Math.round(v * 1000) / 1000);
  const mouthOut = (m) => ({ mouth: encF(m.mouth), teeth: encF(m.teeth), mcx: R1(m.mcx), mcy: R1(m.mcy) });
  const chars = cast.map(({ ch, g, G }) => ({
    id: ch.id,
    items: ch.items.map((it) => ({ d: enc(it.cmds), bb: it.bb.map(R1), k: it.kind, f: col(it.fill), s: col(it.stroke), w: it.sw, eo: it.evenodd ? 1 : 0, o: it.open ? 1 : 0 })),
    g: { base: R1(g.base), s: g.s, tx: R1(g.tx), ty: R1(g.ty), beard: col(g.beard) || null,
      f: { ew: g.f.ew, axis: R1(g.f.axis), brows: encF(g.f.brows), stache: encF(g.f.stache), closed: encF(g.f.closed),
        eyes: g.f.eyes.map((e) => ({ white: encF(e.white), pupil: encF(e.pupil), lids: encF(e.lids), static: encF(e.static), hl: encF(e.hl), has_pupil: !!e.has_pupil, cx: R1(e.cx), cy: R1(e.cy), h: R1(e.h) })),
        neutral: mouthOut(g.f.neutral), happy: mouthOut(g.f.happy) } },
    G: { cy_eye: R1(G.cy_eye), cx: R1(G.cx), ew: R1(G.ew), yneck: G.yneck, nw: R1(G.nw), ysh: G.ysh, base: R1(G.base), sk_last: G.sk_last,
      x0: G.x0, y0: G.y0, L: G.L.join(","), R: G.R.join(","), skin: col(G.skin), sf: G.sf || 1, earrings: !!G.earrings,
      chin_bot: G.chin_bot != null ? R1(G.chin_bot) : null, beard_bot: G.beard_bot != null ? R1(G.beard_bot) : null },
  }));
  const out = {
    chars,
    clones: clones.map((c) => ({ id: c.id, src: c.src, skin: col(c.skin), hair: col(c.hair), brows: encF(c.brows) })),
    closed: Object.fromEntries(full.map((x, n) => [x.id, { neutral: mouthOut(closed[n].neutral), happy: mouthOut(closed[n].happy) }])),
    removed: REMOVED,
  };
  fs.writeFileSync(OUT, JSON.stringify(out));
  console.log("wrote", OUT, (fs.statSync(OUT).size / 1024).toFixed(0) + " KB", chars.length, "chars", clones.length, "clones");
})().catch((e) => { console.error(e); process.exit(1); });
