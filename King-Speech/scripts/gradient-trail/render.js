// Offline re-creation of «Gradient_Trail_Project_File_01.aep», recoloured:
//   Gradient_PreComp: a repeating grey stripe gradient scrolling upward,
//   11 copies side by side, each started a fixed step later (phase offset),
//   → APC Colorama (grey → palette, cyclic) → ADBE Mirror (centre)
//   → ADBE Warp «Squeeze» (beam narrow at top, wide at bottom)
//   → CC Radial Fast Blur, centre (0.5, 0.963), amount 85.
// usage: node render.js <outDir> [frames=180] [W=450] [H=976] [onlyFrame]
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const outDir = process.argv[2];
const FRAMES = +(process.argv[3] || 180);
const W = +(process.argv[4] || 450);
const H = +(process.argv[5] || 976);
const ONLY = process.argv[6] != null ? +process.argv[6] : -1;
fs.mkdirSync(outDir, { recursive: true });

// ── Gradient_PreComp stops (position → grey), straight from the .aep ──────────
const GREY = [
  [0, 0],
  [0.21716797, 0.81348038],
  [0.33192384, 0.24805453],
  [0.45651367, 0.59266239],
  [0.59677732, 0.83391541],
  [0.76245117, 0.24558823],
  [0.87714845, 0.51092219],
  [1, 0],
];
function grey(p) {
  p -= Math.floor(p);
  for (let i = 1; i < GREY.length; i++) {
    if (p <= GREY[i][0]) {
      const [a, va] = GREY[i - 1], [b, vb] = GREY[i];
      return va + ((p - a) / (b - a)) * (vb - va);
    }
  }
  return 0;
}

// ── Colorama palette (cyclic, grey 0 → 1): warm, after the reference photo ────
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const PAL = [
  [0.0, hex("#3A1208")],
  [0.18, hex("#C9381A")],
  [0.36, hex("#F47A1F")],
  [0.55, hex("#FFB21E")],
  [0.72, hex("#FFD84A")],
  [0.88, hex("#FFF2C8")],
  [1.0, hex("#3A1208")],
];
function palette(g, out, o) {
  g -= Math.floor(g);
  for (let i = 1; i < PAL.length; i++) {
    if (g <= PAL[i][0]) {
      const [a, ca] = PAL[i - 1], [b, cb] = PAL[i];
      const k = (g - a) / (b - a);
      out[o] = ca[0] + (cb[0] - ca[0]) * k;
      out[o + 1] = ca[1] + (cb[1] - ca[1]) * k;
      out[o + 2] = ca[2] + (cb[2] - ca[2]) * k;
      return;
    }
  }
}
const BG = hex("#0E0604");
const TMP = new Float32Array(6);

const COLS = 11;
const COL_STEP = 0.16; // each copy starts 80/496 of the loop later
const BANDS = 0.62; // gradient periods over the source height (scale y 196%)
// colorama: grey → palette, plus a slow phase cycle so colours also travel
const CYCLE = 1.0;

function renderFrame(t) {
  // 1) source in «comp» space (u,v in 0..1), coloured + mirrored, then warped
  //    straight into screen space; 2) radial blur on the warped image.
  const img = new Float32Array(W * H * 3);
  for (let y = 0; y < H; y++) {
    const v = y / (H - 1);
    // Warp «Squeeze»: horizontal half-width of the beam at this height
    // (pinched to a point above the top, wide past the edges at the bottom)
    // a trumpet bell: a narrow column up top that flares out concavely
    const K = 3.2;
    const half = 0.085 + 1.0 * ((Math.exp(K * v) - 1) / (Math.exp(K) - 1));
    const sv = v;
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      const dx = (x / (W - 1) - 0.5) / half; // -1..1 inside the beam
      const ax = Math.abs(dx);
      if (ax > 1) {
        img[o] = BG[0]; img[o + 1] = BG[1]; img[o + 2] = BG[2];
        continue;
      }
      // Mirror: the left half of the source, reflected about the centre
      const su = 0.5 - ax * 0.5; // 0 (outer edge) .. 0.5 (centre)
      // stripes follow the bell (column index = position across the beam);
      // neighbouring columns blend softly instead of hard steps
      // the centre column sits on the mirror axis as a whole (no crease)
      const c = su * 2 * ((COLS + 1) / 2);
      const c0 = Math.max(0, Math.floor(c));
      const fr = c - Math.floor(c);
      const wgt = fr < 0.3 ? 0 : fr > 0.7 ? 1 : (fr - 0.3) / 0.4;
      palette(grey(sv * BANDS - t + c0 * COL_STEP), TMP, 0);
      palette(grey(sv * BANDS - t + (c0 + 1) * COL_STEP), TMP, 3);
      const sm = wgt * wgt * (3 - 2 * wgt);
      img[o] = TMP[0] + (TMP[3] - TMP[0]) * sm;
      img[o + 1] = TMP[1] + (TMP[4] - TMP[1]) * sm;
      img[o + 2] = TMP[2] + (TMP[5] - TMP[2]) * sm;
      // soft beam edge into the dark
      const edge = Math.min(1, (1 - ax) / 0.1);
      img[o] = BG[0] + (img[o] - BG[0]) * edge;
      img[o + 1] = BG[1] + (img[o + 1] - BG[1]) * edge;
      img[o + 2] = BG[2] + (img[o + 2] - BG[2]) * edge;
    }
  }
  // 3) CC Radial Fast Blur: average along the ray towards the centre
  const cx = 0.5 * (W - 1), cy = 0.963 * (H - 1);
  const N = 20, AMOUNT = 0.22; // shorter than AE's 85 so stripes stay legible
  const out = Buffer.alloc(W * H * 3);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let r = 0, gg = 0, b = 0;
      for (let k = 0; k < N; k++) {
        const s = 1 - (AMOUNT * k) / N;
        const sx = cx + (x - cx) * s, sy = cy + (y - cy) * s;
        const ix = sx | 0, iy = sy | 0;
        const o = (iy * W + ix) * 3;
        r += img[o]; gg += img[o + 1]; b += img[o + 2];
      }
      const o = (y * W + x) * 3;
      out[o] = r / N; out[o + 1] = gg / N; out[o + 2] = b / N;
    }
  }
  return out;
}

(async () => {
  const list = ONLY >= 0 ? [ONLY] : [...Array(FRAMES).keys()];
  for (const f of list) {
    const buf = renderFrame(f / FRAMES);
    await sharp(buf, { raw: { width: W, height: H, channels: 3 } })
      .blur(0.9)
      .png()
      .toFile(path.join(outDir, `f${String(f).padStart(4, "0")}.png`));
    if (f % 20 === 0) console.log("frame", f);
  }
  console.log("done");
})();
