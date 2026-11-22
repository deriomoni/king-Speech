// Clean up two drawing defects in the warm-up portraits
// (assets/figma/warmup/warmupIllustrations.ts):
//
// 1. Eyes. Each eye was one filled shape: a round pupil with two lid "wings",
//    and the pupil poked out above the lid line. The original eye is masked
//    out and redrawn from its own measurements — the same pupil (centre,
//    radius) and the same wing ends — as a pupil tucked under one smooth lid
//    arc, so nothing pokes through and no corners are left behind.
// 2. Neck. The neck lines ran up into the jaw corner and closed a small
//    triangle with the jaw. A short gap is cut at the top of each neck line,
//    so the neck starts just below the jaw.
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

// Neck gaps, in viewBox (screen) coordinates, measured per portrait: the
// region under the LEFT jaw corner (its top edge hugs the underside of the
// corner and the jaw line), listed counter-clockwise. The right side is the
// mirror image — the faces are symmetric about the viewBox centre.
const NECK_BOTTOM = 258.6;
const NECK = {
  circle: [[60, 252.0], [60, NECK_BOTTOM], [64.6, NECK_BOTTOM], [64.6, 253.5], [63.3, 252.8], [62.9, 252.0]],
  cork: [[60, 253.3], [60, NECK_BOTTOM], [64.8, NECK_BOTTOM], [64.8, 254.8], [63.5, 254.2], [63.1, 253.3]],
  tube: [[60.5, 253.4], [60.5, NECK_BOTTOM], [65.4, NECK_BOTTOM], [65.4, 255.1], [64.2, 254.6], [63.7, 253.4]],
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

  // neck gaps (screen coords → applied at the svg root, outside any flip)
  const nk = NECK[name.replace(/(Left|Right)?\d*Art$/, "")];
  let neckMask = `M${-pad} ${-pad}H${vbw + pad}V${vbh + pad}H${-pad}Z`;
  const poly = (P) => "M" + P.map(([x, y]) => `${f(x)} ${f(y)}`).join("L") + "Z";
  neckMask += poly(nk);
  // mirroring flips the winding, so reverse the order to keep it a hole
  neckMask += poly(nk.map(([x, y]) => [vbw - x, y]).reverse());
  const nid = `neck-${name}`;

  // <svg><defs/><g clip=neck><g flip?><defs/><g clip=eyes>…art…</g>new eyes</g></g></svg>
  xml = xml.replace(/(<svg[^>]*>)(<g[^>]*>)/, (m0, svg, g) =>
    `${svg}<defs><clipPath id="${nid}" clipPathUnits="userSpaceOnUse"><path d="${neckMask}"/></clipPath></defs><g clip-path="url(#${nid})">${g}<defs>${defs}</defs><g clip-path="url(#${eid})">`);
  // the art's outer </g> (its flip group) is the last one: close the eye mask
  // before it and add the new eyes, then close the neck group before </svg>
  const closeAt = xml.lastIndexOf("</g>");
  xml = xml.slice(0, closeAt) + "</g>" + draw + xml.slice(closeAt);
  xml = xml.replace(/<\/svg>$/, "</g></svg>");
  console.log(name, "eyes", eyes.length, eyes.map((e) => `c(${f(e.cx)},${f(e.cy)}) r${f(e.r)}`).join(" "));
  return whole.replace(lit, JSON.stringify(xml));
});
fs.writeFileSync(outFile, src);
