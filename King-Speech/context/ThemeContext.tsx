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
  cardElevated: "#1F1F24",
  cardBorder: brandColors.border,
  glassFill: "rgba(255,255,255,0.05)",
  glassBorder: "rgba(255,255,255,0.10)",
  text: brandColors.textPrimary,
  textSecondary: brandColors.textSecondary,
  textMuted: brandColors.textTertiary,
  accent: brandColors.purple,
  accentDeep: brandColors.purpleDeep,
  accentText: brandColors.onPurple,
  accentDim: "rgba(148,104,251,0.18)",
  accentGlow: "rgba(148,104,251,0.40)",
  cta: brandColors.gold,
  ctaText: brandColors.onGold,
  yellow: brandColors.gold,
  cream: "#FCF6E6",
  mint: "#BECBEB",
  navy: brandColors.textPrimary,
  green: brandColors.success,
  inputBg: "transparent",
  inputBorder: "rgba(255,255,255,0.15)",
  tabBar: "rgba(20,20,24,0.85)",
  tabBarBorder: "rgba(255,255,255,0.06)",
  shadow: "rgba(0,0,0,0.4)",
  divider: "rgba(255,255,255,0.08)",
  rowPressed: "rgba(255,255,255,0.06)",
  switchTrackOff: "rgba(255,255,255,0.18)",
};

export const LIGHT = {
  mode: "light" as ThemeMode,
  bg: "#FAFAFC",
  bgSecondary: "#F4F4F6",
  card: "#FFFFFF",
  cardElevated: "#FFFFFF",
  cardBorder: "rgba(14,14,16,0.08)",
  glassFill: "rgba(255,255,255,0.72)",
  glassBorder: "rgba(14,14,16,0.08)",
  text: brandColors.bg,
  textSecondary: "rgba(14,14,16,0.65)",
  textMuted: "rgba(14,14,16,0.42)",
  accent: brandColors.purple,
  accentDeep: brandColors.purpleDeep,
  accentText: "#FFFFFF",
  accentDim: "rgba(148,104,251,0.12)",
  accentGlow: "rgba(148,104,251,0.30)",
  cta: brandColors.gold,
  ctaText: brandColors.onGold,
  yellow: brandColors.gold,
  cream: "#FCF6E6",
  mint: "#BECBEB",
  navy: brandColors.bg,
  green: brandColors.success,
  inputBg: "transparent",
  inputBorder: "rgba(14,14,16,0.12)",
  tabBar: "rgba(255,255,255,0.92)",
  tabBarBorder: "rgba(14,14,16,0.06)",
  shadow: "rgba(0,0,0,0.08)",
  divider: "rgba(14,14,16,0.06)",
  rowPressed: "rgba(0,0,0,0.04)",
  switchTrackOff: "rgba(14,14,16,0.18)",
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
