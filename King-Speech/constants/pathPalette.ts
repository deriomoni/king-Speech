// ─────────────────────────────────────────────────────────────────────────
// Path colour palette — one { bg, brick } pair per module.
//   • bg    = the full-screen Path background for that module.
//   • brick = the fill of the level tiles ("bricks") in that module.
//
// Curated in a muted mid-century / editorial vein: rare, niche pairings that
// contrast boldly yet read as sophisticated — never neon, never muddy, tuned
// to look good on iPhone (sRGB) displays. The first 24 pairs are the user's
// own palette (ЦВЕТОВАЯ ПАЛИТРА.svg, row-major); 25-67 extend it in the same
// taste.
//
// Theme mechanism: LIGHT theme uses these colours as-is. DARK theme keeps the
// same hues/mood but drops the BACKGROUND to a deeper, more muted tone; bricks
// are kept, with only near-black bricks lifted so they still read on dark.
// ─────────────────────────────────────────────────────────────────────────

export interface PathPair {
  bg: string;
  brick: string;
}

export const PATH_PALETTE: PathPair[] = [
  // 1-24 — user's palette (square = bg, centre circle = brick)
  { bg: "#0172B4", brick: "#F5DF4E" },
  { bg: "#822049", brick: "#B9CF2E" },
  { bg: "#FD8143", brick: "#343B45" },
  { bg: "#A0DCA8", brick: "#FDAC53" },
  { bg: "#B55B30", brick: "#9BB7D3" },
  { bg: "#337047", brick: "#F5DF4E" },
  { bg: "#3C222D", brick: "#EA8A7C" },
  { bg: "#88612A", brick: "#FF7BAC" },
  { bg: "#FBBA16", brick: "#2D875C" },
  { bg: "#9CA7DF", brick: "#FD4601" },
  { bg: "#00492C", brick: "#D3B6D4" },
  { bg: "#EECE7B", brick: "#2B2B23" },
  { bg: "#C4DCAA", brick: "#E04C26" },
  { bg: "#E22028", brick: "#7569E9" },
  { bg: "#40A0AE", brick: "#202A57" },
  { bg: "#F5AF96", brick: "#275440" },
  { bg: "#9BCCD0", brick: "#DB2231" },
  { bg: "#ABCE98", brick: "#6C1F41" },
  { bg: "#EECE7B", brick: "#849E17" },
  { bg: "#1F295A", brick: "#FAEB86" },
  { bg: "#E22028", brick: "#7AC2D7" },
  { bg: "#E3B2B5", brick: "#AFAB26" },
  { bg: "#1F4381", brick: "#FF7BAC" },
  { bg: "#275440", brick: "#E1903E" },

  // 25-67 — curated in the same taste (rare, muted, high-contrast pairings)
  { bg: "#1E6E7B", brick: "#F0A868" }, // petrol / apricot
  { bg: "#4A2C3A", brick: "#9FC6A0" }, // aubergine / celadon
  { bg: "#C99A3A", brick: "#1E6E6A" }, // muted mustard / teal
  { bg: "#5B6C8F", brick: "#C25A3A" }, // slate blue / rust
  { bg: "#5A6B3B", brick: "#E0A9B0" }, // moss / dusty pink
  { bg: "#C15A3C", brick: "#245D6E" }, // terracotta / petrol
  { bg: "#6FA8A0", brick: "#6E2530" }, // dusty teal / oxblood
  { bg: "#5C2A4D", brick: "#B9CF4E" }, // plum / chartreuse
  { bg: "#CB8A2E", brick: "#37485C" }, // ochre / slate
  { bg: "#A9BE8E", brick: "#6A1F35" }, // sage / burgundy
  { bg: "#3F5E86", brick: "#F2B33A" }, // denim / marigold
  { bg: "#B36A4E", brick: "#86BBD0" }, // clay / sky
  { bg: "#10403F", brick: "#E88B72" }, // deep teal / coral
  { bg: "#C39A5E", brick: "#2A2E5E" }, // camel / indigo
  { bg: "#722F3A", brick: "#A7BE8F" }, // wine / sage
  { bg: "#2E7DA6", brick: "#F3B48C" }, // cerulean / peach
  { bg: "#6E7331", brick: "#C9A8D8" }, // olive / lilac
  { bg: "#C98A8A", brick: "#2C5238" }, // dusty rose / forest
  { bg: "#234A3E", brick: "#D9A83C" }, // spruce / mustard
  { bg: "#8A6A82", brick: "#B7CB4A" }, // mauve / lime
  { bg: "#A54E2E", brick: "#97B3CC" }, // burnt sienna / dusty blue
  { bg: "#2E7D6B", brick: "#C56B4A" }, // teal green / clay
  { bg: "#4C6A82", brick: "#EDA45E" }, // steel blue / apricot
  { bg: "#3A2233", brick: "#9FD8B0" }, // deep aubergine / mint
  { bg: "#E0A22A", brick: "#1C5A5E" }, // marigold / deep teal
  { bg: "#B8CC8E", brick: "#5A2B47" }, // pistachio / plum
  { bg: "#1F5F6B", brick: "#E0A0A4" }, // petrol / rose
  { bg: "#A85536", brick: "#A8CDB0" }, // rust / celadon
  { bg: "#2A4E36", brick: "#D79B3E" }, // forest / ochre
  { bg: "#8E86B0", brick: "#D46A34" }, // dusty lavender / burnt orange
  { bg: "#DCC486", brick: "#26325C" }, // sand / navy
  { bg: "#106A72", brick: "#EC8A72" }, // peacock / coral
  { bg: "#5E2530", brick: "#A9BE8E" }, // oxblood / sage
  { bg: "#3E6B6E", brick: "#EEB13A" }, // slate teal / marigold
  { bg: "#7D7A4A", brick: "#B892A8" }, // khaki / mauve
  { bg: "#26497E", brick: "#F2B58F" }, // cobalt / peach
  { bg: "#9B4A34", brick: "#7FB0A8" }, // terracotta deep / dusty teal
  { bg: "#4E5E34", brick: "#E39A8E" }, // moss / coral pink
  { bg: "#4C243C", brick: "#B7C94C" }, // plum wine / chartreuse
  { bg: "#6FA6AE", brick: "#6C2732" }, // dusty cyan / oxblood
  { bg: "#CE8A2C", brick: "#2C305E" }, // amber / indigo
  { bg: "#5E7050", brick: "#D3A2A6" }, // sage deep / dusty rose
  { bg: "#143F45", brick: "#EFA766" }, // deep teal / apricot
];

// ── colour helpers ─────────────────────────────────────────────────────────
function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v;
}
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = parseInt(
    h.length === 3 ? h.split("").map((c) => c + c).join("") : h,
    16,
  );
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbToHex(r: number, g: number, b: number): string {
  const to = (v: number) =>
    clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
        break;
      case g:
        h = ((b - r) / d + 2) * 60;
        break;
      default:
        h = ((r - g) / d + 4) * 60;
    }
  }
  return [h, s, l];
}
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h = ((h % 360) + 360) % 360;
  s = clamp(s, 0, 1);
  l = clamp(l, 0, 1);
  if (s === 0) {
    const v = l * 255;
    return [v, v, v];
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hk = h / 360;
  const t = [hk + 1 / 3, hk, hk - 1 / 3].map((x) => {
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  });
  return [t[0] * 255, t[1] * 255, t[2] * 255];
}
function hexToHsl(hex: string): [number, number, number] {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHsl(r, g, b);
}
function hslToHex(h: number, s: number, l: number): string {
  const [r, g, b] = hslToRgb(h, s, l);
  return rgbToHex(r, g, b);
}

/** Darken a hex toward black by `pct` (0..1), staying in hex. */
export function darkenHex(hex: string, pct: number): string {
  const [r, g, b] = hexToRgb(hex);
  const f = 1 - clamp(pct, 0, 1);
  return rgbToHex(r * f, g * f, b * f);
}

/** Readable ink for text/icons sitting ON a given fill (dark or white). */
export function readableText(hex: string): string {
  const [r, g, b] = hexToRgb(hex);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.62 ? "#1A1A2E" : "#FFFFFF";
}

// Dark-theme background: keep the hue + a touch of the mood, but go deep and
// muted regardless of how light the source was.
function darkBg(hex: string): string {
  const [h, s, l] = hexToHsl(hex);
  return hslToHex(h, clamp(s * 0.66, 0.06, 0.5), clamp(0.12 + l * 0.08, 0.1, 0.22));
}

// Dark-theme brick: keep it as designed, but lift near-black bricks so they
// still read against the deep background (hue preserved).
function darkBrick(hex: string): string {
  const [h, s, l] = hexToHsl(hex);
  if (l < 0.45) return hslToHex(h, clamp(s, 0, 0.72), 0.55);
  return hex;
}

/** The { bg, brick } colours for a module, resolved for the active theme. */
export function getPathColors(
  moduleNum: number,
  isDark: boolean,
): PathPair {
  const p =
    PATH_PALETTE[(Math.max(1, moduleNum) - 1) % PATH_PALETTE.length] ??
    PATH_PALETTE[0];
  return {
    bg: isDark ? darkBg(p.bg) : p.bg,
    brick: isDark ? darkBrick(p.brick) : p.brick,
  };
}
