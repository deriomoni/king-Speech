// King Speech brand tokens — see theme/tokens.ts and docs/brand/
import { colors as brandColors } from "@/theme/tokens";

export { colors, brand, radii, spring, typography, LEVEL_PALETTE_ORDER, darkenHex } from "@/theme/tokens";

const PRIMARY = brandColors.purple;
const PRIMARY_DEEP = brandColors.purpleDeep;
const ACCENT_YELLOW = brandColors.gold;
const SOFT_CREAM = "#FCF6E6";
const MINT_SOFT = "#BECBEB";

const DARK_BG = brandColors.bg;
const DARK_SURFACE = brandColors.surface;
const DARK_ELEVATED = "#3A3A3C";

const LIGHT_BG = "#FAF9F6";
const LIGHT_SURFACE = "#EFEEEC";
const LIGHT_INK = "#262628";

const SUCCESS = brandColors.success;
const ALERT = brandColors.purple;

export const fonts = {
  display: "Geologica_700Bold",
  displayItalic: "Geologica_500Medium",
  serif: "Geologica_600SemiBold",
  serifBold: "Geologica_700Bold",
  body: "Geologica_400Regular",
  bodyRegular: "Geologica_400Regular",
  bodySemibold: "Geologica_700Bold",
  bodyBold: "Geologica_800ExtraBold",
};

const redesignPalette = {
  surface: MINT_SOFT,
  main: PRIMARY,
  mainDeep: PRIMARY_DEEP,
  button: ACCENT_YELLOW,
  buttonSoft: SOFT_CREAM,
};

export type AppColors = {
  background: string;
  backgroundSecondary: string;
  surface: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  tint: string;
  tabIconDefault: string;
  tabIconSelected: string;
  navy: string;
  navyLight: string;
  gold: string;
  goldLight: string;
  green: string;
  greenDark: string;
  accent: string;
  accentSoft: string;
  alert: string;
  alertSoft: string;
  stepLocked: string;
  stepLockedSide: string;
  stepAvailable: string;
  stepAvailableSide: string;
  stepCompleted: string;
  stepCompletedSide: string;
  border: string;
  redesign: typeof redesignPalette & { background: string };
};

export default {
  light: {
    background: LIGHT_BG,
    backgroundSecondary: "#F4F3F0",
    surface: LIGHT_SURFACE,
    text: LIGHT_INK,
    textSecondary: "rgba(38,38,40,0.65)",
    textMuted: "rgba(38,38,40,0.42)",
    tint: LIGHT_INK,
    tabIconDefault: "#A5A5A4",
    tabIconSelected: LIGHT_INK,
    navy: brandColors.bg,
    navyLight: DARK_ELEVATED,
    gold: ACCENT_YELLOW,
    goldLight: SOFT_CREAM,
    green: SUCCESS,
    greenDark: "#1DA872",
    accent: PRIMARY,
    accentSoft: "rgba(148,104,251,0.12)",
    alert: ALERT,
    alertSoft: "rgba(148,104,251,0.12)",
    stepLocked: "#D4D4D8",
    stepLockedSide: "#A1A1AA",
    stepAvailable: PRIMARY,
    stepAvailableSide: PRIMARY_DEEP,
    stepCompleted: SUCCESS,
    stepCompletedSide: "#1DA872",
    border: "rgba(38,38,40,0.08)",
    redesign: { ...redesignPalette, background: LIGHT_BG },
  } satisfies AppColors,
  dark: {
    background: DARK_BG,
    backgroundSecondary: DARK_SURFACE,
    surface: DARK_SURFACE,
    text: brandColors.textPrimary,
    textSecondary: brandColors.textSecondary,
    textMuted: brandColors.textTertiary,
    tint: ACCENT_YELLOW,
    tabIconDefault: "#81807F",
    tabIconSelected: ACCENT_YELLOW,
    navy: brandColors.bg,
    navyLight: "rgba(255,255,255,0.08)",
    gold: ACCENT_YELLOW,
    goldLight: SOFT_CREAM,
    green: SUCCESS,
    greenDark: "#1DA872",
    accent: PRIMARY,
    accentSoft: "rgba(148,104,251,0.18)",
    alert: ALERT,
    alertSoft: "rgba(148,104,251,0.18)",
    stepLocked: "#2A2A30",
    stepLockedSide: "#1A1A1E",
    stepAvailable: PRIMARY,
    stepAvailableSide: PRIMARY_DEEP,
    stepCompleted: SUCCESS,
    stepCompletedSide: "#1DA872",
    border: "rgba(240,238,233,0.10)",
    redesign: { ...redesignPalette, background: DARK_BG },
  } satisfies AppColors,
};

export const sonic = {
  bg: DARK_BG,
  bgLight: LIGHT_BG,
  surface: DARK_SURFACE,
  surfaceElevated: DARK_ELEVATED,
  primary: PRIMARY,
  primaryDeep: PRIMARY_DEEP,
  primaryGlow: "rgba(148,104,251,0.40)",
  accentYellow: ACCENT_YELLOW,
  cta: ACCENT_YELLOW,
  onCta: brandColors.onGold,
  softCream: SOFT_CREAM,
  mintSoft: MINT_SOFT,
  white: brandColors.textPrimary,
  textOnDark: brandColors.textPrimary,
  textOnDarkSecondary: brandColors.textSecondary,
  textOnDarkTertiary: brandColors.textTertiary,
  textOnLight: brandColors.bg,
  textOnLightSecondary: "rgba(14,14,16,0.65)",
  border: brandColors.border,
  borderLight: "rgba(14,14,16,0.08)",
  glassFill: "rgba(255,255,255,0.05)",
  glassBorder: "rgba(255,255,255,0.10)",
  success: SUCCESS,
};
