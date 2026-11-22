// Oscar mascot vectorizer v6 — pure-JS tracing (potrace), layer by layer.
// (vtracer's native binary is blocked by Windows Smart App Control.)
//
// 1. Snap every pixel to a fixed semantic palette (outline ink, pupils,
//    mouth, tongue, gold tones, leg shade, glass, water, white) → hard edges.
// 2. Background = white connected to the canvas border (+ seed points).
// 3. Trace one mask per colour with potrace (smooth Béziers) and stack them
//    bottom→top. Fill layers are dilated a few px so they tuck under the ink
//    outline (no hairline gaps); the outline is traced exactly and drawn last.
//    The whole silhouette is the base layer, filled with a real SVG gradient.
const fs = require('fs');
const D = process.env.V + '/node_modules/';
const sharp = require(D + 'sharp');
const { Potrace } = require(D + 'potrace');

const LONG = 2400;
const PAL = {
  white: [255, 255, 255], black: [0, 0, 0], ink: [86, 34, 32], mouth: [58, 50, 62], red: [226, 70, 70],
  goldL: [250, 232, 112], goldM: [250, 200, 88], goldD: [250, 172, 56], shade: [250, 146, 18],
  glass: [214, 226, 234], water: [164, 200, 236], beige: [236, 222, 204],
};
const FILL = {
  shade: '#FF9A1A', glass: '#D8E4EC', water: '#9EC6EE', white: '#FFFFFF', mouth: '#3A3340',
  red: '#E04A4A', black: '#0B0B0D', ink: '#5A231F',
};
// stacking order (bottom → top) above the gold silhouette
const ORDER = ['shade', 'glass', 'water', 'white', 'mouth', 'red', 'black', 'ink'];

function dilate(mask, W, H, r) {
  if (r <= 0) return mask;
  const t = new Uint8Array(W * H), o = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) { let last = -1e9; for (let x = 0; x < W; x++) { if (mask[y*W+x]) last = x; if (x - last <= r) t[y*W+x] = 1; } last = 1e9; for (let x = W - 1; x >= 0; x--) { if (mask[y*W+x]) last = x; if (last - x <= r) t[y*W+x] = 1; } }
  for (let x = 0; x < W; x++) { let last = -1e9; for (let y = 0; y < H; y++) { if (t[y*W+x]) last = y; if (y - last <= r) o[y*W+x] = 1; } last = 1e9; for (let y = H - 1; y >= 0; y--) { if (t[y*W+x]) last = y; if (last - y <= r) o[y*W+x] = 1; } }
  return o;
}

function erode(mask, W, H, r) {
  const inv = new Uint8Array(W * H); for (let p = 0; p < W * H; p++) inv[p] = mask[p] ? 0 : 1;
  const d = dilate(inv, W, H, r); const o = new Uint8Array(W * H); for (let p = 0; p < W * H; p++) o[p] = d[p] ? 0 : 1; return o;
}

function dropSmall(mask, W, H, minArea) {
  const lab = new Int32Array(W * H); let id = 0;
  for (let s0 = 0; s0 < W * H; s0++) {
    if (!mask[s0] || lab[s0]) continue;
    id++; const st = [s0], comp = []; lab[s0] = id;
    while (st.length) { const p = st.pop(); comp.push(p); const x = p % W;
      for (const q of [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, p - W, p + W]) if (q >= 0 && q < W * H && mask[q] && !lab[q]) { lab[q] = id; st.push(q); } }
    if (comp.length < minArea) for (const p of comp) mask[p] = 0;
  }
  return mask;
}

async function trace(mask, W, H, o, turd) {
  const buf = Buffer.alloc(W * H);
  for (let p = 0; p < W * H; p++) buf[p] = mask[p] ? 0 : 255;
  const png = await sharp(buf, { raw: { width: W, height: H, channels: 1 } }).png().toBuffer();
  return new Promise((res, rej) => {
    const pt = new Potrace({ turdSize: turd ?? o.turd ?? 40, optTolerance: o.tol ?? 0.35, alphaMax: o.alpha ?? 1.0, threshold: 128, blackOnWhite: true });
    pt.loadImage(png, (err) => {
      if (err) return rej(err);
      const tag = pt.getPathTag('#000');
      const m = tag.match(/ d="([^"]*)"/);
      res(m ? m[1].trim() : '');
    });
  });
}

async function run(inp, out, o = {}) {
  const meta = await sharp(inp).metadata();
  const k = LONG / Math.max(meta.width, meta.height);
  const W = Math.round(meta.width * k), H = Math.round(meta.height * k);
  const { data } = await sharp(inp).flatten({ background: '#ffffff' }).removeAlpha().resize(W, H).median(3).raw().toBuffer({ resolveWithObject: true });
  for (const [x0, y0, x1, y1] of o.erase ?? []) {
    for (let y = Math.round(y0 * k); y < Math.min(H, Math.round(y1 * k)); y++)
      for (let x = Math.round(x0 * k); x < Math.min(W, Math.round(x1 * k)); x++) { const p = y * W + x; data[p*3] = data[p*3+1] = data[p*3+2] = 255; }
  }
  const names = Object.keys(PAL);
  const cls = new Uint8Array(W * H);
  for (let p = 0; p < W * H; p++) {
    const r = data[p*3], g = data[p*3+1], b = data[p*3+2];
    let best = 0, bd = Infinity;
    for (let i = 0; i < names.length; i++) { const c = PAL[names[i]]; const d = (r-c[0])**2*0.9 + (g-c[1])**2*1.2 + (b-c[2])**2*0.9; if (d < bd) { bd = d; best = i; } }
    cls[p] = best;
  }
  // clean speckles: 5×5 majority via a median on the class map rendered as an image
  const classImg = Buffer.alloc(W * H);
  for (let p = 0; p < W * H; p++) classImg[p] = cls[p] * 20;
  const medCls = await sharp(classImg, { raw: { width: W, height: H, channels: 1 } }).median(o.med ?? 5).extractChannel(0).raw().toBuffer();
  for (let p = 0; p < W * H; p++) cls[p] = Math.round(medCls[p] / 20);
  const N = (n) => names.indexOf(n);
  // background
  const bg = new Uint8Array(W * H);
  const isWhite = (p) => cls[p] === N('white') || cls[p] === N('beige');
  const fill = (s) => { const st = [s]; while (st.length) { const p = st.pop(); if (bg[p] || !isWhite(p)) continue; bg[p] = 1; const x = p % W; if (x > 0) st.push(p-1); if (x < W-1) st.push(p+1); if (p >= W) st.push(p-W); if (p < W*(H-1)) st.push(p+W); } };
  for (let x = 0; x < W; x++) { fill(x); fill((H-1)*W + x); }
  for (let y = 0; y < H; y++) { fill(y*W); fill(y*W + W - 1); }
  // poses with no white features (no eye whites): every enclosed white gap
  // (e.g. the OK-sign finger rings of the lotus) is background too
  if (o.whiteIsBg) for (let p = 0; p < W * H; p++) if (isWhite(p)) fill(p);
  for (const [x, y] of o.bg ?? []) {
    const cx = Math.round(x * k), cy = Math.round(y * k);
    for (let dy = -18; dy <= 18; dy += 2) for (let dx = -18; dx <= 18; dx += 2) { const p = (cy + dy) * W + cx + dx; if (isWhite(p)) fill(p); }
  }
  // layers
  const layers = [];
  const sil = new Uint8Array(W * H); for (let p = 0; p < W * H; p++) sil[p] = bg[p] ? 0 : 1;
  layers.push(['url(#oscarGold)', await trace(sil, W, H, o)]);
  // Fill classes that pick up anti-alias fringes along the outline get an
  // opening (erode→dilate). What the opening strips from DARK classes is thin
  // line work (e.g. the glass outline) → it joins the ink outline instead.
  const OPEN = new Set(o.openSet ?? ['red', 'mouth', 'shade', 'black']);
  const DARK = new Set(['mouth', 'black']);
  const masks = {};
  for (const n of ORDER) {
    const m = new Uint8Array(W * H);
    for (let p = 0; p < W * H; p++) if (!bg[p] && cls[p] === N(n)) m[p] = 1;
    masks[n] = m;
  }
  const r0 = o.open ?? 4;
  for (const n of ORDER) {
    if (!OPEN.has(n)) continue;
    const m = masks[n];
    const rr = (o.openR ?? { shade: 14 })[n] ?? r0;
    const opened = dilate(erode(m, W, H, rr), W, H, rr);
    if (DARK.has(n)) for (let p = 0; p < W * H; p++) if (m[p] && !opened[p]) masks.ink[p] = 1;
    masks[n] = opened;
  }
  for (const n of ORDER) {
    const m = masks[n]; let any = 0; for (let p = 0; p < W * H; p++) any += m[p];
    if (any < 400) continue;
    // fills grow a little so they tuck under the ink outline; ink is exact
    const minA = n === 'shade' ? 6000 : n === 'ink' || n === 'black' || n === 'white' ? 0 : 1500;
    const mm = n === 'ink' ? m : dilate(minA ? dropSmall(m, W, H, minA) : m, W, H, o.grow ?? 3);
    for (let p = 0; p < W * H; p++) if (bg[p]) mm[p] = 0;
    const d = await trace(mm, W, H, o, n === 'ink' || n === 'white' || n === 'black' ? 40 : (o.turdFill ?? 900));
    if (d) layers.push([FILL[n], d]);
  }
  const defs = `<defs><linearGradient id="oscarGold" gradientUnits="userSpaceOnUse" x1="${Math.round(W*0.28)}" y1="${Math.round(H*0.22)}" x2="${Math.round(W*0.72)}" y2="${Math.round(H*0.6)}"><stop offset="0" stop-color="#FCEC7C"/><stop offset="0.5" stop-color="#FDC955"/><stop offset="1" stop-color="#FBA937"/></linearGradient></defs>`;
  const body = layers.map(([f, d]) => `<path fill="${f}" fill-rule="evenodd" d="${d}"/>`).join('\n');
  // crop the viewBox to the figure (+ o.include boxes, in source px) with a small pad
  let x0 = W, y0 = H, x1 = 0, y1 = 0;
  for (let p = 0; p < W * H; p++) if (sil[p]) { const x = p % W, y = (p - x) / W; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  for (const [a, b, c, d] of o.include ?? []) { x0 = Math.min(x0, Math.round(a * k)); y0 = Math.min(y0, Math.round(b * k)); x1 = Math.max(x1, Math.round(c * k)); y1 = Math.max(y1, Math.round(d * k)); }
  const pad = 16; x0 -= pad; y0 -= pad; x1 += pad; y1 += pad;
  const box = [x0, y0, x1 - x0, y1 - y0];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box.join(' ')}">${defs}\n${body}\n</svg>`;
  fs.writeFileSync(out, svg);
  return { W, H, k, box, layers: layers.length, kb: Math.round(svg.length / 1024) };
}
module.exports = { run };
