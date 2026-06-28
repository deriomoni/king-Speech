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
