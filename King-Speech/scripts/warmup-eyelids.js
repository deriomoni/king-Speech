// Trim the pupils of the warm-up portraits so they no longer poke out above the
// eyelid line (the line-art "wings" either side of each eye).
//
// Each eye is one filled sub-path: a round pupil plus two lid wings. The part of
// the pupil above the wings is clipped away with a soft arch, so the lid reads as
// one line over the eye. Nothing else in the drawing is touched — the clip is the
// whole canvas minus a small notch over each pupil top.
//
// usage: node scripts/warmup-eyelids.js assets/figma/warmup/warmupIllustrations.ts
// Idempotent: arts that already have the clip are skipped.
const fs = require("fs");
const file = process.argv[2];
let src = fs.readFileSync(file, "utf8");

const nums = (d) => d.match(/-?\d+\.?\d*(?:e-?\d+)?/g).map(Number);
// Absolute path data only (Figma export): points are (x, y) pairs in order.
const pts = (d) => {
  const n = nums(d), out = [];
  for (let i = 0; i + 1 < n.length; i += 2) out.push([n[i], n[i + 1]]);
  return out;
};

const re = /export const (\w+): WarmupArt = \{[^]*?xml: ("(?:[^"\\]|\\.)*")/g;
src = src.replace(re, (whole, name, lit) => {
  let xml = JSON.parse(lit);
  if (xml.includes("eyelid-")) return whole;
  const flipped = /scale\(1 -1\)/.test(xml); // y points up in these arts
  const up = flipped ? 1 : -1;
  const notches = [];
  for (const m of xml.matchAll(/<path d="([^"]*)"/g)) {
    for (const sub of m[1].split(/(?=M)/)) {
      const P = pts(sub);
      if (P.length < 6) continue;
      const xs = P.map((p) => p[0]), ys = P.map((p) => p[1]);
      const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys);
      if (!(w > 24 && w < 36 && h > 15 && h < 25)) continue;
      // top of the pupil = extreme point in the "up" direction
      const top = up > 0 ? Math.max(...ys) : Math.min(...ys);
      const near = P.filter((p) => (top - p[1]) * up < 2.2);
      const x0 = Math.min(...near.map((p) => p[0])) - 2.6, x1 = Math.max(...near.map((p) => p[0])) + 2.6;
      const lid = top - up * 3.3; // lid height at the eye corners
      const arch = lid + up * 0.7; // gentle arch over the middle
      const far = top + up * 2;
      notches.push({ x0, x1, lid, arch, far });
    }
  }
  if (!notches.length) return whole;
  // In some arts one eye is merged into a larger sub-path (with the cheek or
  // tube lines), so the size test misses it. Find it as the mirror of the eye
  // we did find, across the face's centre, and take its top from the points there.
  if (notches.length === 1) {
    const vbw = +xml.match(/viewBox="[^"]*"/)[0].split(/\s+/)[2];
    const n0 = notches[0], cx0 = (n0.x0 + n0.x1) / 2, cx1 = vbw - cx0;
    const top0 = n0.lid + up * 3.3, half = (n0.x1 - n0.x0) / 2;
    const all = [...xml.matchAll(/<path d="([^"]*)"/g)].flatMap((m) => pts(m[1]));
    const near = all.filter((p) => Math.abs(p[0] - cx1) < half && Math.abs(p[1] - top0) < 5);
    if (near.length) {
      const top = up > 0 ? Math.max(...near.map((p) => p[1])) : Math.min(...near.map((p) => p[1]));
      const lid = top - up * 3.3;
      notches.push({ x0: cx1 - half, x1: cx1 + half, lid, arch: lid + up * 0.7, far: top + up * 2 });
    }
  }
  const vb = xml.match(/viewBox="([^"]*)"/)[1].split(/\s+/).map(Number);
  const pad = 2000;
  // outer rect one way round, each notch the other way → holes under nonzero
  let d = `M${-pad} ${-pad}H${vb[2] + pad}V${vb[3] + pad}H${-pad}Z`;
  for (const n of notches) {
    const f = (v) => +v.toFixed(2);
    const cx = (n.x0 + n.x1) / 2;
    const q = f(n.arch + (n.arch - n.lid)); // control point → peak at `arch`
    // the outer rect runs right, +y, left; each notch must run the other way
    d += n.far > n.lid
      ? `M${f(n.x0)} ${f(n.far)}L${f(n.x1)} ${f(n.far)}L${f(n.x1)} ${f(n.lid)}Q${f(cx)} ${q} ${f(n.x0)} ${f(n.lid)}Z`
      : `M${f(n.x0)} ${f(n.lid)}Q${f(cx)} ${q} ${f(n.x1)} ${f(n.lid)}L${f(n.x1)} ${f(n.far)}L${f(n.x0)} ${f(n.far)}Z`;
  }
  const id = `eyelid-${name}`;
  // the clip lives in the same (possibly flipped) space as the paths
  xml = xml.replace(/(<svg[^>]*>)(<g[^>]*>)?/, (m0, svg, g) =>
    `${svg}${g || ""}<defs><clipPath id="${id}" clipPathUnits="userSpaceOnUse"><path d="${d}"/></clipPath></defs><g clip-path="url(#${id})">`);
  // every art is <svg><g …>…</g></svg>: close our group before that outer </g>
  const closeAt = xml.lastIndexOf("</g>");
  xml = xml.slice(0, closeAt) + "</g>" + xml.slice(closeAt);
  console.log(name, "eyes trimmed:", notches.length);
  return whole.replace(lit, JSON.stringify(xml));
});
fs.writeFileSync(file, src);
