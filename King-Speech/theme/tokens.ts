export const colors = {
  // core
  bg: "#0E0E10",
  surface: "#1A1A1F",
  border: "#2A2A31",
  gold: "#FFCF34", // DOMINANT accent: CTA buttons, rewards, progress, mascot
  purple: "#9468FB", // SUPPORT accent: secondary highlights, links, glows
  purpleDeep: "#6A4FF4",

  // text on dark
  textPrimary: "#F5F5F7",
  textSecondary: "#C9C9D1",
  textTertiary: "#8A8A93",
  onGold: "#41310A", // text color on gold fills — never pure black
  onPurple: "#F0E9FF",

  // semantic
  success: "#4FD9A0",
  warning: "#FF9E4A",
  error: "#FF6B6B",
  info: "#58B6FF",

  // rank colors (progression: Новичок → Профи)
  rank: {
    novice: "#4FD9A0",
    amateur: "#58B6FF",
    confident: "#FF6F61",
    master: "#9468FB",
    pro: "#FFCF34",
  },

  // 12-color level palette (single warm undertone, tuned for dark bg)
  level: {
    coral: "#FF6F61",
    apricot: "#FF9E4A",
    gold: "#FFCF34",
    lime: "#C8E04F",
    mint: "#4FD9A0",
    turquoise: "#3DCFC9",
    sky: "#58B6FF",
    ultramarine: "#7C8CFF",
    violet: "#9468FB",
    orchid: "#BD7DF5",
    pink: "#F472B6",
    terracotta: "#E07A50",
  },
} as const;

// ───────────────────────────────────────────────────────────────────────────
// Brand accent system — the "King Speech" signature. Two royal accents with
// STRICT roles so they never fight: violet = brand/depth/identity (surfaces,
// glows, progress, ambient), gold = action/reward (the one thing you tap and
// the thing you earn). Tuned to sit near the reference palette without copying
// it 1:1. Neutrals carry a faint violet undertone so the whole app "breathes"
// the brand even before a single accent lands.
// ───────────────────────────────────────────────────────────────────────────
export const brand = {
  // violet family — brand & depth
  violet: "#7C4DFF",
  violetDeep: "#5B2CE0",
  violetSoft: "#CDBEFF",
  violetGlow: "rgba(124,77,255,0.45)",
  onViolet: "#F1EBFF",

  // gold family — action & reward
  gold: "#FFD230",
  goldSoft: "#FFE68C",
  onGold: "#3A2C00",
  goldGlow: "rgba(255,210,48,0.40)",

  // violet-tinted dark neutrals (signature "purple-black")
  ink: "#0F0E14",
  surface: "#1A1822",
  elevated: "#232030",
  borderViolet: "rgba(124,120,168,0.16)",

  // semantic roles (use these in UI, not raw hues)
  action: "#FFD230",     // primary CTA / XP / streak / crown
  onAction: "#3A2C00",
  reward: "#FFE68C",
  identity: "#7C4DFF",   // ambient brand: progress fills, selected, glows
  bgTint: "#14121C",     // score/celebration backdrop base
} as const;

export const radii = {
  card: 22,
  button: 16,
  chip: 12,
} as const;

export const spring = {
  appear: { damping: 15, stiffness: 200, mass: 1 },
  press: { damping: 12, stiffness: 250, mass: 1 },
} as const;

export const typography = {
  display: { fontFamily: "Rubik_700Bold", fontSize: 32, lineHeight: 38 },
  h1: { fontFamily: "Rubik_600SemiBold", fontSize: 24, lineHeight: 30 },
  h2: { fontFamily: "Rubik_500Medium", fontSize: 20, lineHeight: 26 },
  body: { fontFamily: "Nunito_400Regular", fontSize: 16, lineHeight: 24 },
  bodyStrong: { fontFamily: "Nunito_700Bold", fontSize: 16, lineHeight: 24 },
  caption: { fontFamily: "Nunito_400Regular", fontSize: 13, lineHeight: 18 },
  button: { fontFamily: "Nunito_800ExtraBold", fontSize: 16, lineHeight: 20 },
  reading: { fontFamily: "Literata_400Regular", fontSize: 18, lineHeight: 30 },
} as const;

// ───────────────────────────────────────────────────────────────────────────
// Reading level — "Обложка → Полотно". One screen, two states (IDLE / READING)
// that mirror their hierarchy: the work title is the hero in IDLE and shrinks
// to a caption in READING, while the body preview grows from a dim thumbnail
// into the crisp reading canvas.
//
// The karaoke palette is drawn straight from the reference swatch strip (a
// gradient of greys): an unread word sits back in shadow, a read word is lit,
// and the active word is the single brightest point of light travelling across
// the text — "накопление света", not a highlight pill. Gold appears exactly
// ONCE on the whole screen: the crown segment of the progress strip at 100%.
// ───────────────────────────────────────────────────────────────────────────
export const reading = {
  type: {
    // IDLE hero (work title). The component picks the size adaptively
    // (lg → md → sm as the title gets longer); lineHeight = size * heroLineRatio.
    heroFont: "Rubik_800ExtraBold",
    heroSizeLg: 52,
    heroSizeMd: 46,
    heroSizeSm: 40,
    heroLineRatio: 1.02,
    heroTracking: -1.2,
    // Kicker — the "АВТОР · ЖАНР" line under the hero.
    kickerFont: "Rubik_700Bold",
    kickerSize: 11,
    kickerTracking: 1.6,
    kickerOpacity: 0.55,
    // Reading body (the "полотно"). Rendered at its FINAL reading size and
    // scaled down in IDLE, so the READING end-state is pixel-crisp.
    bodyFont: "Literata_400Regular",
    bodySize: 23,
    bodyLineRatio: 1.55,
    // Footer meta ("ЧТЕНИЕ · 04" / "РАНГ II").
    metaFont: "Rubik_700Bold",
    metaSize: 10,
    metaTracking: 1.2,
    metaOpacity: 0.35,
  },
  // Body preview transform in IDLE (dim thumbnail that grows to 1 in READING).
  idleBodyScale: 0.72,
  idleBodyOpacity: 0.384, // +20% brighter than the original 0.32 preview
  // Hero title shrinks to this scale when it becomes the READING caption.
  heroToCaptionScale: 0.38,
  captionOpacity: 0.5,
  // Decorative quote glyph size (relative to screen width handled in-component).
  quoteSize: 96,
  // Start CTA — the one warm gold object on the IDLE screen.
  button: {
    from: "#FFD84D",
    to: "#FF9E2C",
    on: "#2A2003", // text/icon on the gold fill — never pure black
  },
  // Paced reading guide — words per minute for slow / normal / fast. The guide
  // highlights one word at a time so the reader can pace along unhurried.
  pace: {
    wpm: [78, 104, 132] as const, // slow · normal · fast
    labels: ["0.75×", "1×", "1.25×"] as const,
    defaultIndex: 1,
    leadInMs: 650, // pause before the first word after the transition settles
    commaPauseMs: 190, // extra dwell after , ; : and line ends
    stopPauseMs: 440, // extra dwell after . ! ? …
  },
  // Karaoke: the body stays one calm readable tone; only the CURRENT word lights
  // up (a single moving spark), so it never reads as a highlighted line.
  dark: {
    word: {
      unread: "#8C8C97", // whole poem — calm, readable
      read: "#8C8C97", // same tone once passed (no bright trail)
      active: "#FBF7EC", // the one bright word — warm white
    },
  },
  light: {
    word: {
      unread: "#7C7C76",
      read: "#7C7C76",
      active: "#141414",
    },
  },
} as const;

/** Ordered level hues for MODULE_PALETTE cycling (12 entries). */
export const LEVEL_PALETTE_ORDER = [
  colors.level.coral,
  colors.level.apricot,
  colors.level.gold,
  colors.level.lime,
  colors.level.mint,
  colors.level.turquoise,
  colors.level.sky,
  colors.level.ultramarine,
  colors.level.violet,
  colors.level.orchid,
  colors.level.pink,
  colors.level.terracotta,
] as const;

/** Darken a hex color for module colorDark (~35% toward black). */
export function darkenHex(hex: string, amount = 0.35): string {
  const n = hex.replace("#", "");
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  const mix = (c: number) =>
    Math.round(c * (1 - amount)).toString(16).padStart(2, "0");
  return `#${mix(r)}${mix(g)}${mix(b)}`;
}
