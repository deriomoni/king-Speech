// King Speech brand tokens — see theme/tokens.ts and docs/brand/
import { colors as brandColors } from "@/theme/tokens";

export { colors, radii, spring, typography, LEVEL_PALETTE_ORDER, darkenHex, KAZAKH_GLYPH_TEST } from "@/theme/tokens";

const PRIMARY = brandColors.purple;
const PRIMARY_DEEP = brandColors.purpleDeep;
const ACCENT_YELLOW = brandColors.gold;
const SOFT_CREAM = "#FCF6E6";
const MINT_SOFT = "#BECBEB";

const DARK_BG = brandColors.bg;
const DARK_SURFACE = brandColors.surface;
const DARK_ELEVATED = "#1F1F24";

const LIGHT_BG = "#FAFAFC";
const LIGHT_SURFACE = "#FFFFFF";

const SUCCESS = brandColors.success;
const ALERT = brandColors.purple;

export const fonts = {
  display: "Rubik_700Bold",
  displayItalic: "Rubik_500Medium",
  serif: "Rubik_600SemiBold",
  serifBold: "Rubik_700Bold",
  body: "Nunito_400Regular",
  bodyRegular: "Nunito_400Regular",
  bodySemibold: "Nunito_700Bold",
  bodyBold: "Nunito_800ExtraBold",
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
    backgroundSecondary: "#F4F4F4",
    surface: LIGHT_SURFACE,
    text: brandColors.bg,
    textSecondary: "rgba(14,14,16,0.65)",
    textMuted: "rgba(14,14,16,0.40)",
    tint: PRIMARY,
    tabIconDefault: "rgba(14,14,16,0.45)",
    tabIconSelected: PRIMARY,
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
    border: "rgba(14,14,16,0.08)",
    redesign: { ...redesignPalette, background: LIGHT_BG },
  } satisfies AppColors,
  dark: {
    background: DARK_BG,
    backgroundSecondary: DARK_SURFACE,
    surface: DARK_SURFACE,
    text: brandColors.textPrimary,
    textSecondary: brandColors.textSecondary,
    textMuted: brandColors.textTertiary,
    tint: PRIMARY,
    tabIconDefault: brandColors.textTertiary,
    tabIconSelected: brandColors.textPrimary,
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
    border: "rgba(255,255,255,0.08)",
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
