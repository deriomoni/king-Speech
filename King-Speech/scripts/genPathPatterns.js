/* eslint-disable */
// ───────────────────────────────────────────────────────────────────────────
// Generates constants/pathPatterns.ts from the hand-drawn symbol groups.
//
// Input   : the "Group N.svg" artboards (one group = a small vocabulary of
//           symbols, often already stamped 2-4× by hand on the artboard).
// Output  : constants/pathPatterns.ts — the UNIQUE motifs of each group plus
//           a computed, evenly-tossed repeat tile for the Path background.
//
// Run:  node scripts/genPathPatterns.js [pathToSvgFolder]
// ───────────────────────────────────────────────────────────────────────────
const fs = require("fs");
const path = require("path");

const SRC_DIR = process.argv[2] || "C:/Users/bekka/OneDrive";
const OUT = path.join(__dirname, "..", "constants", "pathPatterns.ts");

// Side of the square repeat unit, in pt — about one phone width, so the eye
// never catches a full repetition on a single screen.
const TILE = 380;

// ── bbox — control points included, so it is a touch generous; that is fine
//    (and safer) for layout, we only need it to centre + scale the motif.
function bbox(d) {
  const toks = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi) || [];
  let cmd = "", x = 0, y = 0, i = 0;
  let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
  const push = (px, py) => {
    if (px < minX) minX = px;
    if (px > maxX) maxX = px;
    if (py < minY) minY = py;
    if (py > maxY) maxY = py;
  };
  const num = () => parseFloat(toks[i++]);
  while (i < toks.length) {
    const t = toks[i];
    if (/[a-zA-Z]/.test(t)) { cmd = t; i++; }
    const rel = cmd === cmd.toLowerCase();
    const c = cmd.toUpperCase();
    if (c === "M" || c === "L") {
      const a = num(), b = num();
      x = rel ? x + a : a; y = rel ? y + b : b; push(x, y);
    } else if (c === "H") {
      const a = num(); x = rel ? x + a : a; push(x, y);
    } else if (c === "V") {
      const a = num(); y = rel ? y + a : a; push(x, y);
    } else if (c === "C") {
      const a = num(), b = num(), cc = num(), dd = num(), e = num(), f = num();
      push(rel ? x + a : a, rel ? y + b : b);
      push(rel ? x + cc : cc, rel ? y + dd : dd);
      x = rel ? x + e : e; y = rel ? y + f : f; push(x, y);
    } else if (c === "S" || c === "Q") {
      const a = num(), b = num(), e = num(), f = num();
      push(rel ? x + a : a, rel ? y + b : b);
      x = rel ? x + e : e; y = rel ? y + f : f; push(x, y);
    } else if (c === "T") {
      const e = num(), f = num();
      x = rel ? x + e : e; y = rel ? y + f : f; push(x, y);
    } else if (c === "A") {
      num(); num(); num(); num(); num();
      const e = num(), f = num();
      x = rel ? x + e : e; y = rel ? y + f : f; push(x, y);
    } else if (c === "Z") {
      /* no coords */
    } else {
      i++;
    }
  }
  return { minX, minY, w: maxX - minX, h: maxY - minY };
}

// R2 low-discrepancy sequence on the unit torus. Gives the most even
// "hand-tossed" scatter that still tiles seamlessly.
function r2(n) {
  const a1 = 0.7548776662466927;
  const a2 = 0.5698402909980532;
  const out = [];
  for (let i = 0; i < n; i++) out.push([(0.5 + i * a1) % 1, (0.5 + i * a2) % 1]);
  return out;
}

const round = (v, p = 2) => Number(v.toFixed(p));

function readPaths(file) {
  const svg = fs.readFileSync(path.join(SRC_DIR, file + ".svg"), "utf8");
  return [...svg.matchAll(/ d="([^"]+)"/g)].map((m) => m[1]);
}

// Which raw paths of each artboard are the UNIQUE motifs.
//   Group 4 — the same comet 4×      → keep [0]
//   Group 5 — a 7-pebble cluster 2×  → keep [0..6]
//   Group 6 — a candle + its vertical mirror + a star-flower → keep [0], [2]
// `mass` = target optical size, sqrt(w*h) in pt. Sizing by mass instead of by
// bounding box is what makes a 4.7:1 comet and a round flower feel equal.
const SPECS = [
  { module: 1, file: "Group 1", note: "облако-каракуля • звезда • цветок",
    use: [0, 1, 2], mass: 66, items: 12, rotSpread: 24 },
  { module: 2, file: "Group 2", note: "существо • гребень",
    use: [0, 1], mass: 78, items: 8, rotSpread: 16 },
  // The comet is 4.7:1 — a field of long horizontal strokes gets loud fast,
  // so this one runs fewer + calmer clones than the round motifs.
  { module: 3, file: "Group 4", note: "комета-росчерк",
    use: [0], mass: 55, items: 8, rotSpread: 8, keepLevel: true },
  { module: 4, file: "Group 5", note: "семь галек",
    use: [0, 1, 2, 3, 4, 5, 6], mass: 62, items: 12, rotSpread: 30 },
  { module: 5, file: "Group 6", note: "свеча • звёздный цветок",
    use: [0, 2], mass: 66, items: 10, rotSpread: 18 },
  { module: 6, file: "Group 7", note: "звезда • росток • цветок",
    use: [0, 1, 2], mass: 68, items: 12, rotSpread: 22 },
];

// Fixed jitter table — deterministic, so the pattern is byte-identical on
// every regeneration (no Math.random anywhere in the art pipeline).
const JIT = [
  0.31, -0.72, 0.58, -0.14, 0.87, -0.45, 0.09, 0.66, -0.93, 0.24,
  -0.61, 0.78, 0.42, -0.28, 0.95, -0.83, 0.17, 0.53, -0.37, 0.71,
];

const built = SPECS.map((spec) => {
  const ds = readPaths(spec.file);
  const symbols = spec.use.map((idx) => {
    const d = ds[idx];
    const b = bbox(d);
    const size = round((spec.mass / Math.sqrt(b.w * b.h)) * Math.max(b.w, b.h), 1);
    return { d, ...b, size };
  });
  const items = r2(spec.items).map((p, i) => ({
    s: i % symbols.length,
    x: round(p[0] * TILE, 1),
    y: round(p[1] * TILE, 1),
    rot: round(JIT[i % JIT.length] * spec.rotSpread, 1),
    flipX: i % 3 === 1,
    // A level motif (the comet) is never flipped vertically — it would read
    // as a different, wrong-way-up drawing rather than a variation.
    flipY: !spec.keepLevel && i % 5 === 3,
    scale: round(1 + JIT[(i + 7) % JIT.length] * 0.05, 3),
  }));
  return { spec, symbols, items };
});

const L = [];
const w = (s) => L.push(s);

w("// ─────────────────────────────────────────────────────────────────────────");
w("// Path background PATTERNS — one motif set per module.");
w("//");
w("// Source art: the hand-drawn symbol groups (Group 1/2/4/5/6/7.svg). Each");
w("// artboard is a small vocabulary of shapes, several of them already stamped");
w("// 2-4× by hand. Here the duplicates are stripped back to the UNIQUE motifs,");
w("// and those motifs are re-tossed onto a " + TILE + "pt square repeat tile.");
w("//");
w("// How the spacing is worked out:");
w("//   • Positions come from the R2 low-discrepancy sequence on the unit torus.");
w("//     That is the most even scatter that ALSO wraps seamlessly — no visible");
w("//     rows, no clumps, no dead zones, and the tile seam is invisible.");
w("//   • Every motif is sized by equal optical MASS — sqrt(w*h) — not by its");
w("//     bounding box, so a 4.7:1 comet and a round flower carry the same");
w("//     visual weight instead of one shouting over the other.");
w("//   • Per-clone rotation, mirroring and ±5% scale stop the repeats from");
w("//     reading as stamps.");
w("//");
w("// GENERATED — edit scripts/genPathPatterns.js and re-run, not this file.");
w("// ─────────────────────────────────────────────────────────────────────────");
w("");
w("/** One motif: raw path data plus its bounding box, in path units. */");
w("export interface PatternSymbol {");
w("  d: string;");
w("  /** bbox origin + extent, in the path's own coordinate space */");
w("  x: number;");
w("  y: number;");
w("  w: number;");
w("  h: number;");
w("  /** target longest edge in pt, tuned for equal optical mass */");
w("  size: number;");
w("}");
w("");
w("/** One clone of a motif inside the repeat tile. */");
w("export interface PatternItem {");
w("  /** index into PathPattern.symbols */");
w("  s: number;");
w("  /** centre of the clone, in tile coordinates (0..tile) */");
w("  x: number;");
w("  y: number;");
w("  /** rotation in degrees */");
w("  rot: number;");
w("  flipX: boolean;");
w("  flipY: boolean;");
w("  /** multiplier on the motif's base size */");
w("  scale: number;");
w("}");
w("");
w("export interface PathPattern {");
w("  /** module this pattern belongs to (1-based) */");
w("  module: number;");
w("  /** what the motifs are, for whoever opens this file next */");
w("  note: string;");
w("  /** side of the square repeat unit, pt */");
w("  tile: number;");
w("  symbols: PatternSymbol[];");
w("  items: PatternItem[];");
w("}");
w("");
w("export const PATH_PATTERN_TILE = " + TILE + ";");
w("");
w("export const PATH_PATTERNS: PathPattern[] = [");
for (const { spec, symbols, items } of built) {
  const cell = Math.round(Math.sqrt((TILE * TILE) / items.length));
  w("  // ── Модуль " + spec.module + " — " + spec.note + " (" + spec.file + ".svg)");
  w("  //    " + symbols.length + " мотив(а/ов) · " + items.length +
    " клонов на плитку · шаг ≈ " + cell + "pt");
  w("  {");
  w("    module: " + spec.module + ",");
  w("    note: " + JSON.stringify(spec.note) + ",");
  w("    tile: " + TILE + ",");
  w("    symbols: [");
  symbols.forEach((s, i) => {
    w("      // [" + i + "] " + round(s.w) + "×" + round(s.h) + " → " + s.size + "pt");
    w("      {");
    w("        x: " + round(s.minX) + ", y: " + round(s.minY) +
      ", w: " + round(s.w) + ", h: " + round(s.h) + ", size: " + s.size + ",");
    w('        d: "' + s.d + '",');
    w("      },");
  });
  w("    ],");
  w("    items: [");
  items.forEach((it) => {
    w("      { s: " + it.s + ", x: " + it.x + ", y: " + it.y + ", rot: " + it.rot +
      ", flipX: " + it.flipX + ", flipY: " + it.flipY + ", scale: " + it.scale + " },");
  });
  w("    ],");
  w("  },");
}
w("];");
w("");
w("/**");
w(" * The pattern for a module, or null when that module has no art yet.");
w(" * Only modules 1-6 are drawn so far; everything above falls back to the");
w(" * plain solid Path background.");
w(" */");
w("export function getPathPattern(moduleNum: number): PathPattern | null {");
w("  return PATH_PATTERNS.find((p) => p.module === moduleNum) ?? null;");
w("}");
w("");

fs.writeFileSync(OUT, L.join("\n"));

// ── spacing report ─────────────────────────────────────────────────────────
// Measured on the torus (so tile seams count), against the ROTATED bounding
// box of each clone. Bounding boxes overstate the collision for organic
// shapes, so treat anything under ~25% as "they do not actually touch".
function report({ spec, symbols, items }) {
  const T = TILE;
  const box = (it, ox, oy) => {
    const s = symbols[it.s];
    const k = (s.size * it.scale) / Math.max(s.w, s.h);
    const bw = s.w * k, bh = s.h * k, r = (Math.abs(it.rot) * Math.PI) / 180;
    const W = bw * Math.cos(r) + bh * Math.sin(r);
    const H = bw * Math.sin(r) + bh * Math.cos(r);
    return { x: it.x + ox - W / 2, y: it.y + oy - H / 2, w: W, h: H, a: W * H };
  };
  let minDist = Infinity, pairs = 0, worst = 0;
  for (let i = 0; i < items.length; i++)
    for (let j = 0; j < items.length; j++)
      for (let dx = -1; dx <= 1; dx++)
        for (let dy = -1; dy <= 1; dy++) {
          if (i === j && dx === 0 && dy === 0) continue;
          const d = Math.hypot(
            items[i].x - (items[j].x + dx * T),
            items[i].y - (items[j].y + dy * T),
          );
          if (d < minDist) minDist = d;
          if (i > j && dx === 0 && dy === 0) continue;
          const A = box(items[i], 0, 0), B = box(items[j], dx * T, dy * T);
          const ow = Math.min(A.x + A.w, B.x + B.w) - Math.max(A.x, B.x);
          const oh = Math.min(A.y + A.h, B.y + B.h) - Math.max(A.y, B.y);
          if (ow > 0 && oh > 0) {
            const f = (ow * oh) / Math.min(A.a, B.a);
            if (f > 0.02) { pairs++; worst = Math.max(worst, f); }
          }
        }
  return { minDist, pairs, worst };
}

console.log("wrote " + OUT + "\n");
for (const b of built) {
  const { spec, symbols, items } = b;
  const { minDist, pairs, worst } = report(b);
  console.log(
    "  module " + spec.module + " — " + spec.note + "\n" +
      "    " + symbols.length + " motif(s) · " + items.length +
      " clones/tile · sizes " + symbols.map((s) => s.size).join(", ") + "pt\n" +
      "    even step ≈ " + Math.round(Math.sqrt((TILE * TILE) / items.length)) +
      "pt · closest pair " + minDist.toFixed(0) + "pt · " +
      pairs + " touching pair(s), worst bbox overlap " +
      Math.round(worst * 100) + "%",
  );
}
