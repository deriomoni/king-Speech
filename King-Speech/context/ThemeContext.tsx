import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { colors as brandColors } from "@/theme/tokens";

export const THEME_KEY = "@kingspeech_theme_v2";

export type ThemeMode = "light" | "dark";

// Brand palette — see docs/brand/king-speech-brandbook.md
export const DARK = {
  mode: "dark" as ThemeMode,
  bg: brandColors.bg,
  bgSecondary: brandColors.surface,
  card: brandColors.surface,
  cardElevated: "#3A3A3C",
  cardBorder: brandColors.border,
  glassFill: "rgba(240,238,233,0.05)",
  glassBorder: "rgba(240,238,233,0.10)",
  text: brandColors.textPrimary,
  textSecondary: brandColors.textSecondary,
  textMuted: brandColors.textTertiary,
  // Accent = the Figma gold. `accentInk` is the accent used AS TEXT/ICON (gold on
  // dark, ink on light); `accent` stays the gold fill in both themes.
  accent: brandColors.gold,
  accentInk: brandColors.gold,
  accentDeep: "#FFBD2F",
  accentText: brandColors.onGold,
  accentDim: "rgba(255,216,87,0.18)",
  accentGlow: "rgba(255,216,87,0.40)",
  // The thick amber rim around gold buttons was removed (user: too harsh). Kept as a
  // transparent border so button sizes don't shift.
  ctaStroke: "transparent",
  cta: brandColors.gold,
  ctaText: brandColors.onGold,
  yellow: brandColors.gold,
  cream: "#FCF6E6",
  mint: "#BECBEB",
  navy: brandColors.textPrimary,
  green: brandColors.success,
  inputBg: "transparent",
  inputBorder: "rgba(240,238,233,0.15)",
  tabBar: "#18181A",
  tabBarBorder: "rgba(240,238,233,0.06)",
  shadow: "rgba(0,0,0,0.4)",
  divider: "rgba(240,238,233,0.08)",
  rowPressed: "rgba(240,238,233,0.06)",
  switchTrackOff: "rgba(240,238,233,0.18)",
  // Figma "Screens" panel/backing tokens (variable collection 11:107).
  switchOn: "#F0EEE9", // accent/ink
  switchThumbOn: "#18181A", // ink/on-accent
  bezel: "#000000", // bg/bezel
  panelStroke: "rgba(255,255,255,0.13)", // stroke/panel
  backingTop: "#000000",
  backingMid: "#000000",
  backingBottom: "#000000",
  tileTop: "#2A2A2D",
  tileBottom: "#0E0E10",
  tileStroke: "rgba(255,255,255,0.08)",
  // Audio-diary cassette (Figma variables cassette/* in collection 11:107).
  cassetteBody: "#A1A1A8",
  cassetteBodyHi: "#BDBDC4",
  cassetteBodyLo: "#8B8B92",
  cassetteDetail: "#6B6B72",
  cassetteLabelStroke: "#4A4A50",
  cassetteWindow: "#18181A",
};

export const LIGHT = {
  mode: "light" as ThemeMode,
  bg: "#FAF9F6", // Figma bg/app · Light
  bgSecondary: "#F4F3F0",
  card: "#EFEEEC", // Figma surface/card · Light
  cardElevated: "#FFFFFF",
  cardBorder: "rgba(38,38,40,0.08)",
  glassFill: "rgba(250,249,246,0.72)",
  glassBorder: "rgba(38,38,40,0.08)",
  text: "#262628",
  textSecondary: "rgba(38,38,40,0.65)",
  textMuted: "rgba(38,38,40,0.42)",
  accent: brandColors.gold,
  accentInk: "#262628",
  accentDeep: "#FFBD2F",
  accentText: "#262628",
  accentDim: "rgba(255,216,87,0.30)",
  accentGlow: "rgba(255,216,87,0.30)",
  ctaStroke: "transparent",
  cta: brandColors.gold,
  ctaText: brandColors.onGold,
  yellow: brandColors.gold,
  cream: "#FCF6E6",
  mint: "#BECBEB",
  navy: "#262628",
  green: brandColors.success,
  inputBg: "transparent",
  inputBorder: "rgba(38,38,40,0.12)",
  tabBar: "#FAF9F6",
  tabBarBorder: "rgba(38,38,40,0.08)",
  shadow: "rgba(0,0,0,0.08)",
  divider: "rgba(38,38,40,0.06)",
  rowPressed: "rgba(38,38,40,0.04)",
  switchTrackOff: "rgba(38,38,40,0.18)",
  switchOn: "#262628",
  switchThumbOn: "#FFFFFF",
  bezel: "#DEDDD9",
  panelStroke: "rgba(38,38,40,0.20)",
  backingTop: "#CFCECA",
  backingMid: "#F3F2EF",
  backingBottom: "#FFFFFF",
  tileTop: "#FFFFFF",
  tileBottom: "#F3F2EF",
  tileStroke: "rgba(38,38,40,0.07)",
  cassetteBody: "#262628",
  cassetteBodyHi: "#3C3C41",
  cassetteBodyLo: "#18181A",
  cassetteDetail: "#B9B9BF",
  cassetteLabelStroke: "#4A4A50",
  cassetteWindow: "#2C2C2E",
};

export type Theme = typeof DARK | typeof LIGHT;

interface ThemeContextValue {
  theme: Theme;
  themeMode: ThemeMode;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
  isLoaded: boolean;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: DARK,
  themeMode: "dark",
  toggleTheme: () => {},
  setTheme: () => {},
  isLoaded: false,
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeMode, setThemeMode] = useState<ThemeMode>("dark");
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY)
      .then((stored) => {
        if (stored === "light" || stored === "dark") {
          setThemeMode(stored);
        }
      })
      .finally(() => setIsLoaded(true));
  }, []);

  const setTheme = useCallback((mode: ThemeMode) => {
    setThemeMode(mode);
    AsyncStorage.setItem(THEME_KEY, mode).catch(() => {});
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(themeMode === "dark" ? "light" : "dark");
  }, [themeMode, setTheme]);

  const theme = themeMode === "dark" ? DARK : LIGHT;

  return (
    <ThemeContext.Provider
      value={{ theme, themeMode, toggleTheme, setTheme, isLoaded }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
