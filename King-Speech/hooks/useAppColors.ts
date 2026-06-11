import Colors from "@/constants/colors";
import { useTheme, type ThemeMode } from "@/context/ThemeContext";

/** App color scheme from Settings — not the OS appearance. */
export function useAppColors() {
  const { themeMode, theme } = useTheme();
  const colors = Colors[themeMode];
  return {
    theme,
    themeMode,
    colors,
    colorScheme: themeMode as ThemeMode,
    isDark: themeMode === "dark",
  };
}
