/* eslint-disable */
// ───────────────────────────────────────────────────────────────────────────
// Generates constants/pathPatterns.ts from the hand-drawn symbol groups.
//
// Input   : the "Group N.svg" artboards. Each artboard is a finished
//           COMPOSITION — the arrangement of symbols on it is the artwork and
//           is kept exactly as drawn.
// Output  : constants/pathPatterns.ts — every composition verbatim, plus the
//           scale and the clone pitch worked out for a phone screen.
//
// What this script decides (and only this):
//   • scale   — how big the composition is drawn, so that the symbols INSIDE
//               it land at a comfortable reading size on a 390pt-wide screen;
//   • pitch   — the distance between clones: the composition's own content
//               box plus a gutter, so neighbours breathe instead of colliding;
//   • drop    — a half-drop on every other column, so the clones read as
//               wallpaper and not as a spreadsheet.
//
// Run:  node scripts/genPathPatterns.js [pathToSvgFolder]
// ───────────────────────────────────────────────────────────────────────────
const fs = require("fs");
const path = require("path");

// The artboards live in two folders, and the names COLLIDE across them —
// "Group 5.svg" exists in both and is different artwork in each. So every spec
// names its folder explicitly; never resolve an artboard by filename alone.
const SRC_ROOT = process.argv[2] || "C:/Users/bekka/OneDrive";
const SRC_DIRS = { one: SRC_ROOT, pa: path.join(SRC_ROOT, "PA") };
const OUT = path.join(__dirname, "..", "constants", "pathPatterns.ts");

// ── bbox — control points included, so it is a touch generous; that is fine
//    (and safer) for layout: we only use it to place and scale the artwork.
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
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}

const round = (v, p = 2) => Number(v.toFixed(p));

function readPaths(dir, file) {
  const svg = fs.readFileSync(path.join(SRC_DIRS[dir], file + ".svg"), "utf8");
  return [...svg.matchAll(/ d="([^"]+)"/g)].map((m) => m[1]);
}

// `symbolMass` = the size we want an average symbol INSIDE the composition to
// read at on screen, in pt, measured as sqrt(w*h). Everything else (how big
// the composition gets drawn, how far apart the clones sit) follows from it.
// Sizing by mass rather than by bounding box is what keeps a 4.7:1 comet and
// a round flower feeling equally heavy.
//
// `gutter` is the breathing room between clones, as a fraction of the
// composition's own size. Compositions that already carry a lot of internal
// air get less; tight ones get more.
const SPECS = [
  // Первая партия — папка OneDrive, артборды Group 1/2/4/5/6/7.
  { module: 1, dir: "one", file: "Group 1", note: "облако • звезда • цветок",
    symbolMass: 66, gutter: 0.06 },
  { module: 2, dir: "one", file: "Group 2", note: "рыба • краб",
    symbolMass: 78, gutter: 0.1 },
  { module: 3, dir: "one", file: "Group 4", note: "косяк рыбок ×4",
    symbolMass: 55, gutter: 0.12 },
  { module: 4, dir: "one", file: "Group 5", note: "цветок из лепестков ×2",
    symbolMass: 62, gutter: 0.06 },
  { module: 5, dir: "one", file: "Group 6", note: "свеча • цветок-звезда",
    symbolMass: 66, gutter: 0.08 },
  { module: 6, dir: "one", file: "Group 7", note: "звезда • клевер • цветок",
    symbolMass: 68, gutter: 0.08 },

  // Вторая партия — папка OneDrive/PA, артборды Group 5…21 по номерам.
  // Имена 5/6/7 совпадают с первой партией, но это ДРУГИЕ рисунки — отсюда
  // поле `dir` у каждой записи.
  { module: 7, dir: "pa", file: "Group 5", note: "лошадь ×2", symbolMass: 68, gutter: 0.08 },
  { module: 8, dir: "pa", file: "Group 6", note: "лис • тюльпан", symbolMass: 68, gutter: 0.08 },
  { module: 9, dir: "pa", file: "Group 7", note: "звезда ×2", symbolMass: 68, gutter: 0.08 },
  { module: 10, dir: "pa", file: "Group 8", note: "жук ×2", symbolMass: 68, gutter: 0.08 },
  { module: 11, dir: "pa", file: "Group 9", note: "облако ×2", symbolMass: 68, gutter: 0.08 },
  { module: 12, dir: "pa", file: "Group 10", note: "цветок ×2", symbolMass: 68, gutter: 0.08 },
  { module: 13, dir: "pa", file: "Group 11", note: "кит ×2", symbolMass: 68, gutter: 0.08 },
  { module: 14, dir: "pa", file: "Group 12", note: "вспышка ×2", symbolMass: 68, gutter: 0.08 },
  { module: 15, dir: "pa", file: "Group 13", note: "звезда ×2", symbolMass: 68, gutter: 0.08 },
  { module: 16, dir: "pa", file: "Group 14", note: "клевер • цветок", symbolMass: 68, gutter: 0.08 },
  { module: 17, dir: "pa", file: "Group 15", note: "цветок ×2", symbolMass: 68, gutter: 0.08 },
  { module: 18, dir: "pa", file: "Group 16", note: "цветок • трилистник", symbolMass: 68, gutter: 0.08 },
  { module: 19, dir: "pa", file: "Group 17", note: "звезда ×2", symbolMass: 68, gutter: 0.08 },
  { module: 20, dir: "pa", file: "Group 18", note: "клевер • цветок", symbolMass: 68, gutter: 0.08 },
  { module: 21, dir: "pa", file: "Group 19", note: "цветок • клякса • ромашка", symbolMass: 68, gutter: 0.08 },
  { module: 22, dir: "pa", file: "Group 20", note: "яблоко ×2", symbolMass: 68, gutter: 0.08 },
  { module: 23, dir: "pa", file: "Group 21", note: "яблоко ×2", symbolMass: 68, gutter: 0.08 },
];

// A composition is never drawn bigger than this on its long side. Past it a
// phone shows fewer than two stamps across and the field goes patchy — big
// empty fills with the artwork stranded at the edges. It bites on groups whose
// symbols are PARTS of a bigger figure (Group 5's petals build one flower):
// there the mean-symbol rule would blow the whole flower up past the screen.
const MAX_COMPOSITION = 240;

const built = SPECS.map((spec) => {
  const paths = readPaths(spec.dir, spec.file);
  const boxes = paths.map(bbox);

  // Content box of the WHOLE composition — the artboard's own viewBox is not
  // used, because artwork routinely bleeds a few units past it.
  const bx = Math.min(...boxes.map((b) => b.minX));
  const by = Math.min(...boxes.map((b) => b.minY));
  const bw = Math.max(...boxes.map((b) => b.maxX)) - bx;
  const bh = Math.max(...boxes.map((b) => b.maxY)) - by;

  // Average optical mass of the symbols the composition is built from.
  const meanMass =
    boxes.reduce((s, b) => s + Math.sqrt(b.w * b.h), 0) / boxes.length;
  const scale = Math.min(
    spec.symbolMass / meanMass,
    MAX_COMPOSITION / Math.max(bw, bh),
  );
  const capped = spec.symbolMass / meanMass > MAX_COMPOSITION / Math.max(bw, bh);

  const pitchX = round(bw * scale * (1 + spec.gutter), 1);
  const pitchY = round(bh * scale * (1 + spec.gutter), 1);

  return {
    spec,
    paths,
    bx: round(bx), by: round(by), bw: round(bw), bh: round(bh),
    scale: round(scale, 5),
    pitchX, pitchY,
    // Half-drop: every other column slides down half a row. Kills the
    // spreadsheet read that a straight grid of identical clones always has.
    drop: round(pitchY / 2, 1),
    capped,
    // Phase: nudge the whole field so the first clone is not flush with the
    // top-left corner — a composition cropped by the status bar looks like a
    // mistake, one cropped mid-field looks like wallpaper.
    phaseX: round(-pitchX * 0.22, 1),
    phaseY: round(-pitchY * 0.3, 1),
    meanMass: round(meanMass),
  };
});

const L = [];
const w = (s) => L.push(s);

w("// ─────────────────────────────────────────────────────────────────────────");
w("// Path background PATTERNS — one composition per module, cloned.");
w("//");
w("// Source art: the hand-drawn symbol groups (Group 1/2/4/5/6/7.svg). Each");
w("// artboard is a finished COMPOSITION and is kept exactly as drawn — same");
w("// symbols, same arrangement, nothing added, nothing removed. The pattern is");
w("// that composition stamped across the screen.");
w("//");
w("// What is computed here is only how the stamps sit next to each other:");
w("//   • scale  — chosen so the average symbol INSIDE the composition reads at");
w("//     a set optical mass, sqrt(w*h), on a 390pt-wide screen. Going by mass");
w("//     rather than by bounding box is what keeps a 4.7:1 comet and a round");
w("//     flower feeling equally heavy from module to module.");
w("//   • pitchX / pitchY — the distance between clones: the composition's own");
w("//     content box plus a gutter, so neighbours breathe instead of colliding.");
w("//   • drop — every other column slides down half a row (a half-drop), which");
w("//     is what stops a grid of identical stamps from reading as a spreadsheet.");
w("//   • phaseX / phaseY — the whole field is nudged off the corner, so the");
w("//     first clone is cropped mid-composition instead of sitting flush.");
w("//");
w("// GENERATED — edit scripts/genPathPatterns.js and re-run, not this file.");
w("// ─────────────────────────────────────────────────────────────────────────");
w("");
w("export interface PathPattern {");
w("  /** module this pattern belongs to (1-based) */");
w("  module: number;");
w("  /** what the composition is, for whoever opens this file next */");
w("  note: string;");
w("  /** artboard it came from */");
w("  source: string;");
w("  /** the composition's paths, verbatim from the artboard */");
w("  paths: string[];");
w("  /** content box of the whole composition, in path units */");
w("  bx: number;");
w("  by: number;");
w("  bw: number;");
w("  bh: number;");
w("  /** path units → pt */");
w("  scale: number;");
w("  /** distance between clones, pt */");
w("  pitchX: number;");
w("  pitchY: number;");
w("  /** vertical offset of every other column, pt */");
w("  drop: number;");
w("  /** offset of the whole field, pt */");
w("  phaseX: number;");
w("  phaseY: number;");
w("}");
w("");
w("export const PATH_PATTERNS: PathPattern[] = [");
for (const b of built) {
  const cw = Math.round(b.bw * b.scale);
  const ch = Math.round(b.bh * b.scale);
  w("  // ── Модуль " + b.spec.module + " — " + b.spec.note);
  w("  //    композиция " + cw + "×" + ch + "pt · шаг " +
    b.pitchX + "×" + b.pitchY + "pt · зазор " +
    Math.round(b.spec.gutter * 100) + "% · полусдвиг " + b.drop + "pt");
  w("  {");
  w("    module: " + b.spec.module + ",");
  w("    note: " + JSON.stringify(b.spec.note) + ",");
  w("    source: " + JSON.stringify((b.spec.dir === "pa" ? "PA/" : "") + b.spec.file + ".svg") + ",");
  w("    bx: " + b.bx + ", by: " + b.by + ", bw: " + b.bw + ", bh: " + b.bh + ",");
  w("    scale: " + b.scale + ",");
  w("    pitchX: " + b.pitchX + ", pitchY: " + b.pitchY + ",");
  w("    drop: " + b.drop + ", phaseX: " + b.phaseX + ", phaseY: " + b.phaseY + ",");
  w("    paths: [");
  b.paths.forEach((d) => w('      "' + d + '",'));
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

// ── report ─────────────────────────────────────────────────────────────────
const SCREEN_W = 390, SCREEN_H = 844;
console.log("wrote " + OUT + "\n");
for (const b of built) {
  const cw = b.bw * b.scale, ch = b.bh * b.scale;
  const across = SCREEN_W / b.pitchX, down = SCREEN_H / b.pitchY;
  console.log(
    "  module " + b.spec.module + " — " + b.spec.note + "  (" + b.spec.file + ".svg)\n" +
      "    " + b.paths.length + " path(s) · composition " +
      Math.round(cw) + "×" + Math.round(ch) + "pt (scale " + b.scale + ")\n" +
      "    pitch " + b.pitchX + "×" + b.pitchY + "pt · gutter " +
      Math.round(b.bw * b.scale * b.spec.gutter) + "×" +
      Math.round(b.bh * b.scale * b.spec.gutter) + "pt · half-drop " + b.drop + "pt\n" +
      "    on a 390×844 screen: " + across.toFixed(1) + " × " + down.toFixed(1) +
      " clones ≈ " + Math.ceil(across + 1) * Math.ceil(down + 1) * b.paths.length +
      " paths drawn" +
      (b.capped ? "\n    ↑ scale held back by MAX_COMPOSITION" : ""),
  );
}
