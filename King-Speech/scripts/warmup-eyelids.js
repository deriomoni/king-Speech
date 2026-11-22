// Clean up two drawing defects in the warm-up portraits
// (assets/figma/warmup/warmupIllustrations.ts):
//
// 1. Eyes. Each eye was one filled shape: a round pupil with two lid "wings",
//    and the pupil poked out above the lid line. The original eye is masked
//    out and redrawn from its own measurements — the same pupil (centre,
//    radius) and the same wing ends — as a pupil tucked under one smooth lid
//    arc, so nothing pokes through and no corners are left behind.
// 2. Neck. Where the face side, the jaw and the neck meet, the three traced
//    strokes merged into a thick knot that reads as a small black triangle.
//    The knot is masked out and redrawn as two even strokes: the face side
//    flowing smoothly into the neck, and the jaw branching off it — the neck
//    stays joined to the face.
//
// usage: node scripts/warmup-eyelids.js <original.ts> <out.ts>
// Run it on the untouched Figma export (git history before 54cc796).
const fs = require("fs");
const [, , inFile, outFile] = process.argv;
let src = fs.readFileSync(inFile, "utf8");

// Points ON the outline (cubics sampled), not the Bézier control points —
// those overshoot and would skew the measured pupil.
const pts = (d) => {
  const out = [];
  let cur = [0, 0], start = [0, 0];
  for (const seg of d.match(/[MLHVCZ][^MLHVCZ]*/gi)) {
    const c = seg[0].toUpperCase();
    const n = (seg.slice(1).match(/-?\d+\.?\d*(?:e-?\d+)?/g) || []).map(Number);
    if (c === "M") { cur = [n[0], n[1]]; start = cur; out.push(cur); }
    else if (c === "L") { for (let i = 0; i < n.length; i += 2) { cur = [n[i], n[i + 1]]; out.push(cur); } }
    else if (c === "H") { cur = [n[n.length - 1], cur[1]]; out.push(cur); }
    else if (c === "V") { cur = [cur[0], n[n.length - 1]]; out.push(cur); }
    else if (c === "C") {
      for (let i = 0; i + 5 < n.length; i += 6) {
        const [x1, y1, x2, y2, x3, y3] = n.slice(i, i + 6), [x0, y0] = cur;
        for (let k = 1; k <= 10; k++) {
          const t = k / 10, u = 1 - t;
          out.push([u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3,
                    u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3]);
        }
        cur = [x3, y3];
      }
    } else if (c === "Z") cur = start;
  }
  return out;
};
const f = (v) => +v.toFixed(2);

// Jaw–neck knot, LEFT side, in viewBox (screen) coordinates, measured from
// the traced outlines of each portrait (the right side is the mirror image —
// the faces are symmetric about the viewBox centre):
//   box        — the region masked out [x0, y0, x1, y1]
//   face       — centre of the face-side stroke where it enters the box (top),
//                with its slope dx/dy
//   neckX      — centre of the neck stroke
//   jawA/jawC/jawB — the jaw stroke: start on the face/neck line, control, exit
const KNOT_W = 1.95; // the portraits' line weight
const KNOT = {
  circle: { box: [59.2, 247.6, 67.2, 256.8], face: [60.6, 0.67], neckX: 62.6, jawA: [62.6, 251.4], jawC: [64.8, 251.9], jawB: [67.6, 253.45] },
  cork: { box: [59.0, 248.4, 67.6, 257.0], face: [60.3, 0.75], neckX: 62.6, jawA: [62.6, 252.7], jawC: [65.2, 253.3], jawB: [68.0, 255.2] },
  tube: { box: [58.6, 248.0, 67.6, 257.0], face: [60.4, 0.95], neckX: 63.1, jawA: [63.1, 252.7], jawC: [65.4, 253.4], jawB: [68.0, 254.8] },
};
// Outline sub-paths as polylines (screen coords via `toS`).
const polylines = (xml, toS) => {
  const out = [];
  for (const m of xml.matchAll(/<path d="([^"]*)"/g)) {
    if (m[1].startsWith("M-2000")) continue;
    for (const sub of m[1].split(/(?=M)/)) out.push(pts(sub).map(toS));
  }
  return out;
};
// Centre of the stroke crossing a horizontal (axis "y") or vertical ("x") line
// at `v`, within [lo, hi] along the other axis: mid-point of its two edges.
const crossing = (lines, axis, v, lo, hi) => {
  const a = axis === "y" ? 1 : 0, b = 1 - a, hits = [];
  for (const L of lines) for (let i = 1; i < L.length; i++) {
    const p = L[i - 1], q = L[i];
    if ((p[a] - v) * (q[a] - v) > 0 || p[a] === q[a]) continue;
    const t = (v - p[a]) / (q[a] - p[a]), w = p[b] + t * (q[b] - p[b]);
    if (w >= lo && w <= hi) hits.push(w);
  }
  if (hits.length < 2) return null;
  return (Math.min(...hits) + Math.max(...hits)) / 2;
};
// The clean knot for one side. `dir` = +1 left side (jaw goes right), −1 right.
const knotFor = (lines, k, dir, vbw) => {
  const X = (x) => (dir > 0 ? x : vbw - x);
  const [bx0, by0, bx1, by1] = k.box;
  const xa = Math.min(X(bx0) , X(bx1)) - 3, xb = Math.max(X(bx0), X(bx1)) + 3;
  // face side entering at the top edge (and a bit above, for its direction)
  const fTop = crossing(lines, "y", by0, xa, xb), fUp = crossing(lines, "y", by0 - 1.2, xa, xb);
  // neck leaving at the bottom edge
  const nBot = crossing(lines, "y", by1, X(k.neckX) - 2.2, X(k.neckX) + 2.2);
  // jaw leaving through the inner side edge (and a bit further, for direction)
  const ex = X(bx1), jOut = crossing(lines, "x", ex, by0, by1 + 2), jFar = crossing(lines, "x", ex + dir * 1.2, by0, by1 + 3);
  if ([fTop, fUp, nBot, jOut, jFar].some((v) => v == null)) return null;
  const fs = (fTop - fUp) / 1.2; // face dx per dy
  const js = (jFar - jOut) / 1.2; // jaw dy per |dx|
  const nX = nBot, jy0 = k.jawA[1];
  const side =
    `M${f(fTop - fs * 0.5)} ${f(by0 - 0.5)}` +
    `C${f(fTop + fs * 1.6)} ${f(by0 + 1.6)} ${f(nX)} ${f(by0 + 2.4)} ${f(nX)} ${f(by0 + 4.6)}` +
    `L${f(nX)} ${f(by1 + 0.5)}`;
  const jaw =
    `M${f(nX)} ${f(jy0)}` +
    `Q${f(ex - dir * 2.4)} ${f(jOut - js * 2.4)} ${f(ex)} ${f(jOut)}` +
    `L${f(ex + dir * 0.5)} ${f(jOut + js * 0.5)}`;
  return [side, jaw];
};

const re = /export const (\w+): WarmupArt = \{[^]*?xml: ("(?:[^"\\]|\\.)*")/g;
src = src.replace(re, (whole, name, lit) => {
  let xml = JSON.parse(lit);
  if (!/^(tube|cork|circle)/.test(name)) return whole;
  const up = /scale\(1 -1\)/.test(xml) ? 1 : -1; // y-up arts are flipped
  const [, , vbw, vbh] = xml.match(/viewBox="([^"]*)"/)[1].trim().split(/\s+/).map(Number);

  // ── measure the eyes ──
  const eyes = [];
  for (const m of xml.matchAll(/<path d="([^"]*)"/g)) {
    for (const sub of m[1].split(/(?=M)/)) {
      const P = pts(sub);
      if (P.length < 6) continue;
      const xs = P.map((p) => p[0]), ys = P.map((p) => p[1]);
      const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys);
      if (!(w > 24 && w < 36 && h > 15 && h < 25)) continue;
      const top = up > 0 ? Math.max(...ys) : Math.min(...ys);
      const bottom = up > 0 ? Math.min(...ys) : Math.max(...ys);
      const r = Math.abs(top - bottom) / 2;
      const nearBottom = P.filter((p) => Math.abs(p[1] - bottom) < 0.8);
      const cx = nearBottom.reduce((a, p) => a + p[0], 0) / nearBottom.length;
      const L = P.reduce((a, p) => (p[0] < a[0] ? p : a)), R = P.reduce((a, p) => (p[0] > a[0] ? p : a));
      eyes.push({ cx, cy: bottom + up * r, r, L, R });
    }
  }
  // one eye merged into a bigger shape → mirror the other across the face
  // (only roughly symmetric, so re-measure from the points found around there)
  if (eyes.length === 1) {
    const e = eyes[0], m = (x) => vbw - x - (up > 0 ? 2 * +xml.match(/translate\(([-\d.]+)/)[1] : 0);
    const gx0 = m(e.R[0]) - 4, gx1 = m(e.L[0]) + 4;
    const all = [...xml.matchAll(/<path d="([^"]*)"/g)].flatMap((q) => pts(q[1]));
    const P = all.filter((p) => p[0] > gx0 && p[0] < gx1 && Math.abs(p[1] - e.cy) < e.r + 1.5);
    const ys = P.map((p) => p[1]);
    const top = up > 0 ? Math.max(...ys) : Math.min(...ys), bottom = up > 0 ? Math.min(...ys) : Math.max(...ys);
    const r = Math.abs(top - bottom) / 2;
    const nb = P.filter((p) => Math.abs(p[1] - bottom) < 0.8);
    const L = P.reduce((a, p) => (p[0] < a[0] ? p : a)), R = P.reduce((a, p) => (p[0] > a[0] ? p : a));
    eyes.push({ cx: nb.reduce((a, p) => a + p[0], 0) / nb.length, cy: bottom + up * r, r, L, R });
  }

  // ── build: mask for the old eyes, new eyes ──
  const pad = 2000;
  let mask = `M${-pad} ${-pad}H${vbw + pad}V${vbh + pad}H${-pad}Z`;
  let draw = "", defs = "";
  eyes.forEach((e, i) => {
    const x0 = e.L[0] - 1.2, x1 = e.R[0] + 1.2;
    const lo = e.cy - up * (e.r + 1.2), hi = e.cy + up * (e.r + 1.2);
    // reverse winding vs the outer rect → a hole (nonzero)
    const [ya, yb] = up > 0 ? [lo, hi] : [hi, lo];
    mask += `M${f(x0)} ${f(yb)}L${f(x1)} ${f(yb)}L${f(x1)} ${f(ya)}L${f(x0)} ${f(ya)}Z`;
    // lid: one smooth arc from wing end to wing end, apex just under the old pupil top
    const apexY = e.cy + up * (e.r * 0.62);
    const midX = (e.L[0] + e.R[0]) / 2, endY = (e.L[1] + e.R[1]) / 2;
    const ctrlY = 2 * apexY - endY;
    const lid = `M${f(e.L[0] + 0.6)} ${f(e.L[1])}Q${f(midX)} ${f(ctrlY)} ${f(e.R[0] - 0.6)} ${f(e.R[1])}`;
    const below = `${lid}L${f(e.R[0])} ${f(e.cy - up * (e.r + 3))}L${f(e.L[0])} ${f(e.cy - up * (e.r + 3))}Z`;
    const cid = `pupil-${name}-${i}`;
    defs += `<clipPath id="${cid}" clipPathUnits="userSpaceOnUse"><path d="${below}"/></clipPath>`;
    draw += `<circle cx="${f(e.cx)}" cy="${f(e.cy)}" r="${f(e.r)}" fill="currentColor" clip-path="url(#${cid})"/>`;
    draw += `<path d="${lid}" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" fill="none"/>`;
  });
  const eid = `eyes-${name}`;
  defs += `<clipPath id="${eid}" clipPathUnits="userSpaceOnUse"><path d="${mask}"/></clipPath>`;

  // jaw–neck knots (screen coords → applied at the svg root, outside any flip)
  const k = KNOT[name.replace(/(Left|Right)?\d*Art$/, "")];
  const [bx0, by0, bx1, by1] = k.box;
  let neckMask = `M${-pad} ${-pad}H${vbw + pad}V${vbh + pad}H${-pad}Z`;
  // holes: wound opposite to the outer rect (left box down-first, mirror up-first)
  neckMask += `M${bx0} ${by0}V${by1}H${bx1}V${by0}Z`;
  neckMask += `M${f(vbw - bx0)} ${by0}H${f(vbw - bx1)}V${by1}H${f(vbw - bx0)}Z`;
  const nid = `neck-${name}`;
  const tr = xml.match(/translate\(([-\d.]+) ([-\d.]+)\) scale\(1 -1\)/);
  const toS = tr ? ([x, y]) => [x + +tr[1], +tr[2] - y] : (p) => p;
  const lines = polylines(xml, toS);
  const knots = [knotFor(lines, k, 1, vbw), knotFor(lines, k, -1, vbw)];
  if (knots.some((q) => !q)) throw new Error(`${name}: jaw/neck crossing not found`);
  const knotDraw = knots.flat()
    .map((d) => `<path d="${d}" stroke="currentColor" stroke-width="${KNOT_W}" stroke-linecap="round" fill="none"/>`)
    .join("");

  // <svg><defs/><g clip=neck><g flip?><defs/><g clip=eyes>…art…</g>new eyes</g></g></svg>
  xml = xml.replace(/(<svg[^>]*>)(<g[^>]*>)/, (m0, svg, g) =>
    `${svg}<defs><clipPath id="${nid}" clipPathUnits="userSpaceOnUse"><path d="${neckMask}"/></clipPath></defs><g clip-path="url(#${nid})">${g}<defs>${defs}</defs><g clip-path="url(#${eid})">`);
  // the art's outer </g> (its flip group) is the last one: close the eye mask
  // before it and add the new eyes, then close the neck group before </svg>
  const closeAt = xml.lastIndexOf("</g>");
  xml = xml.slice(0, closeAt) + "</g>" + draw + xml.slice(closeAt);
  // close the knot mask group, then draw the clean knots on top (unmasked)
  xml = xml.replace(/<\/svg>$/, `</g>${knotDraw}</svg>`);
  console.log(name, "eyes", eyes.length, eyes.map((e) => `c(${f(e.cx)},${f(e.cy)}) r${f(e.r)}`).join(" "));
  return whole.replace(lit, JSON.stringify(xml));
});
fs.writeFileSync(outFile, src);
