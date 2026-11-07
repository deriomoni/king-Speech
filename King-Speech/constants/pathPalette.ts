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
  { bg: "#D7EFFF", brick: "#FF5C34" },
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
  { bg: "#9ED6DF", brick: "#ED773C" },
  { bg: "#40A0AE", brick: "#202A57" },
  { bg: "#F5AF96", brick: "#275440" },
  { bg: "#9BCCD0", brick: "#DB2231" },
  { bg: "#ABCE98", brick: "#6C1F41" },
  { bg: "#EECE7B", brick: "#849E17" },
  { bg: "#1F295A", brick: "#FAEB86" },
  { bg: "#4A2E27", brick: "#A5BCD6" },
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

// ── Module colours ─────────────────────────────────────────────────────────
// Figma 255:3195 "Ранги · цвета модулей на светлом и тёмном · 5 × 67": one
// row per rank (Новичок, Любитель, Уверенный, Мастер, Профи), 67 module colours
// each (index 0 = module 1). Each swatch frame holds a light preview square,
// a dark preview square and the "module" rectangle — that last fill is the
// module colour; it is the SAME in light and dark theme. It fills completed /
// active level bricks and the connector between completed levels
// (Figma 232:2272 / 245:2176 "Путь · градиент модуля").
export const RANK_MODULE_COLORS: readonly (readonly string[])[] = [
  // Ранг 1 · Новичок
  ["#F9AA7D", "#DE8286", "#0088B0", "#BC8D1F", "#903F75", "#487D49", "#A14D3A", "#2D62A3", "#DF7500", "#56BEAB",
   "#E2A9A1", "#88B04B", "#A9568C", "#F4963A", "#FAAA94", "#3AB0A2", "#B65F9A", "#B0C965", "#F67866", "#ECAA79",
   "#32BECC", "#D979A2", "#C7B63C", "#B793C0", "#FFA368", "#45BE76", "#EE819F", "#78BDD4", "#FAB75A", "#EA9575",
   "#55A860", "#9D446E", "#008491", "#D08344", "#EB9687", "#BED38E", "#DF88B7", "#FC9E21", "#7C83BC", "#E27A53",
   "#009B5C", "#9F5069", "#009DAE", "#FE7E03", "#FFB59B", "#A1CA7B", "#D28FB0", "#53B0AE", "#FFB181", "#FF8576",
   "#699E6D", "#AD4D8C", "#BE752D", "#5F6DB0", "#D56231", "#7CB083", "#EC9ABE", "#D2B04C", "#E8703A", "#008763",
   "#C84C61", "#289DBE", "#D2A172", "#5A5B9F", "#AD5D5D", "#00B89F", "#D99B7C"],
  // Ранг 2 · Любитель
  ["#FFB000", "#E881A6", "#C4BF71", "#D27F63", "#00A28A", "#CA9456", "#AFCB80", "#E78B90", "#52A2B4", "#DDB614",
   "#C68F65", "#8BC28C", "#FF8D94", "#DAC483", "#DAB58F", "#00AF9D", "#BF6464", "#BDB369", "#14A3C7", "#A76C97",
   "#D0893F", "#00A170", "#FE8863", "#D4CC9A", "#E8B5CE", "#ECA825", "#30A299", "#BB4F35", "#843E83", "#BE8A4A",
   "#009276", "#AD3E48", "#B5B644", "#157EA0", "#A64F82", "#D69C2F", "#E95C20", "#008C45", "#0072B5", "#95424E",
   "#AA8805", "#008C96", "#C86B3C", "#8E4483", "#C4962C", "#009499", "#CE785D", "#C0D725", "#5CA6CE", "#D2738F",
   "#F0C05A", "#F19035", "#6DCE87", "#FCA289", "#BCA949", "#85CED1", "#EBA851", "#EA738D", "#B5C38E", "#EC935E",
   "#00A78B", "#C5A253", "#D16277", "#487AB7", "#4B9B69", "#FFA177", "#EDC373"],
  // Ранг 3 · Уверенный
  ["#D9922E", "#926AA6", "#9BB53E", "#D18489", "#58C8B6", "#F7B26A", "#D9CE52", "#F0A1BF", "#60B892", "#F88F58",
   "#AF9841", "#774D8E", "#007844", "#AC4B55", "#00ABC0", "#CF9C63", "#9D7BB0", "#B5CC39", "#F57F8E", "#7ACCB8",
   "#F1BD89", "#BABC72", "#F5B0BD", "#64BFA4", "#E08119", "#F2AB46", "#3CADD4", "#BD7B74", "#009E82", "#CB8E16",
   "#007BAA", "#DF7253", "#339C5E", "#B085B7", "#C9A86A", "#E86800", "#009288", "#A83E6C", "#B5BF50", "#F47327",
   "#279D9F", "#A4596D", "#589F7E", "#DD9C6B", "#C5CC7B", "#DE98AB", "#008C69", "#DC793A", "#4F84C4", "#B59E5F",
   "#CE5E9A", "#378661", "#B37256", "#0061A3", "#B68A3A", "#45B5AA", "#FA9A85", "#C3D363", "#DE9BC4", "#40A48E",
   "#E1927A", "#DAB965", "#B76BA3", "#44883C", "#BE5141", "#00AAA9", "#D1A054"],
  // Ранг 4 · Мастер
  ["#76C1B2", "#E2B051", "#DC7178", "#7ED37F", "#FA7A35", "#7BC4C4", "#CFBB7B", "#CE8498", "#4D91C6", "#8BBA94",
   "#E47127", "#C49BD4", "#00B1D2", "#D2CC81", "#F88180", "#CD7E4D", "#1F7349", "#0084A1", "#B8AF23", "#D75C5D",
   "#DE8E65", "#2BAE66", "#0074A8", "#CE5B78", "#D1B272", "#87D7BE", "#F38554", "#F8A39D", "#DACD65", "#6BCD9C",
   "#DD9760", "#BE454F", "#006CA9", "#008658", "#FF8D00", "#C65D52", "#6D5698", "#008786", "#BA9238", "#B44E5D",
   "#5B7EBD", "#00A776", "#EE9626", "#B45865", "#7391C8", "#00B694", "#DDA758", "#FDB2AB", "#A3C57D", "#5CACCE",
   "#E2A829", "#D37F6F", "#7E6EAC", "#007D69", "#C6973F", "#A73340", "#B34646", "#0F9D76", "#C19552", "#993C7C",
   "#0084BD", "#7BB369", "#E9897E", "#FBAA4C", "#55C6A9", "#DEC05F", "#DD9289"],
  // Ранг 5 · Профи
  ["#CA6C56", "#00846B", "#7D5D99", "#D39C43", "#BC4869", "#699158", "#ED7464", "#FFA500", "#C67FAE", "#009B8C",
   "#B65D48", "#346CB0", "#B35457", "#3AA278", "#E19640", "#6DA9D2", "#EEA0A6", "#A0DAA9", "#DB9B59", "#FBB995",
   "#F7969E", "#539CCC", "#CDA323", "#944E87", "#008E80", "#C68463", "#CF6977", "#79B5DB", "#F7B718", "#F99471",
   "#ED7A9E", "#4CA5C7", "#F9AC2F", "#E29A86", "#DA7E7A", "#008DB9", "#B08E51", "#973C6C", "#A2574B", "#4960A8",
   "#B45422", "#CA628F", "#B9A023", "#007CB7", "#9F4440", "#008778", "#D27D56", "#E4BF45", "#E290B2", "#4ABBD5",
   "#D18E54", "#C96551", "#4DB560", "#F6909D", "#FFB865", "#58C9D4", "#F48037", "#CE6BA4", "#CEC153", "#6EA2D5",
   "#EA6B6A", "#66BC91", "#F5A26F", "#5BACC3", "#F18AAD", "#F3C12C", "#EDAA86"],
];

// The five reference variants shown in Figma 232:2272 ("Путь · градиент
// модуля · 5 вариантов"): Терракота, Охра, Олива, Пыльный синий, Слива.
// Reference only — the live palette is RANK_MODULE_COLORS.
export const PATH_MODULE_SAMPLES = ["#E7725B", "#D6862F", "#8E844B", "#6798BF", "#7F4882"] as const;

// Rank (1..5) a global module number belongs to. Mirrors RANKS_MODULAR in
// context/GameContext (1–14, 15–28, 29–41, 42–54, 55–67); duplicated so this
// constants module stays free of a context import.
function rankForModule(moduleNum: number): number {
  if (moduleNum <= 14) return 1;
  if (moduleNum <= 28) return 2;
  if (moduleNum <= 41) return 3;
  if (moduleNum <= 54) return 4;
  return 5;
}

/**
 * Colour of module `moduleNum` (1..67; wraps beyond 67). `rankIndex` (1..5)
 * picks the rank row — by default the rank that module belongs to.
 */
export function getModuleColor(moduleNum: number, rankIndex?: number): string {
  const n = (((Math.max(1, Math.floor(moduleNum) || 1) - 1) % 67) + 67) % 67 + 1;
  const r = Math.min(5, Math.max(1, rankIndex ?? rankForModule(n)));
  return RANK_MODULE_COLORS[r - 1][n - 1];
}

/**
 * The { bg, brick } colours for a module, resolved for the active theme.
 * `brick` = the Figma module colour (identical in both themes). `bg` = the
 * legacy per-module background (the Path no longer paints it; level screens
 * and the pattern layer still read it).
 */
export function getPathColors(
  moduleNum: number,
  isDark: boolean,
  rankIndex?: number,
): PathPair {
  const p =
    PATH_PALETTE[(Math.max(1, moduleNum) - 1) % PATH_PALETTE.length] ??
    PATH_PALETTE[0];
  return {
    bg: isDark ? darkBg(p.bg) : p.bg,
    brick: getModuleColor(moduleNum, rankIndex),
  };
}

// ── background pattern ink ─────────────────────────────────────────────────
// The symbol pattern drawn over the Path background is TONE-ON-TONE: it is the
// module's own background colour pushed a step darker (on light fills) or a
// step lighter (on dark fills). Never flat black — black over a saturated fill
// reads as dirt; a shade of the fill itself reads as printed paper.
//
// These two numbers are the only knob: raise them to make the pattern louder,
// lower them to make it whisper.
const PATTERN_SHIFT_ON_LIGHT = 0.15; // toward black
const PATTERN_SHIFT_ON_DARK = 0.13; // toward white

/** Ink for the background symbol pattern sitting ON a given Path background. */
export function patternInk(bg: string): string {
  const [r, g, b] = hexToRgb(bg);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  if (lum > 0.5) {
    const f = 1 - PATTERN_SHIFT_ON_LIGHT;
    return rgbToHex(r * f, g * f, b * f);
  }
  const f = PATTERN_SHIFT_ON_DARK;
  return rgbToHex(r + (255 - r) * f, g + (255 - g) * f, b + (255 - b) * f);
}
