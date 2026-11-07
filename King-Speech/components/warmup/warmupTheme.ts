import { spring } from "@/theme/tokens";

export const warmupTheme = {
  bg: "#0E0E10",
  gold: "#FFD857",
  purple: "#9468FB",
  onGold: "#41310A",
  missRed: "#FF6B6B",
  cleanMint: "#5EEAD4",
  touchLavender: "#C4B5FD",
} as const;

export const warmupSpring = {
  ...spring.press,
  damping: 12,
  stiffness: 180,
};

export const warmupFonts = {
  title: "Geologica_700Bold",
  body: "Geologica_400Regular",
  label: "Geologica_700Bold",
  digit: "Geologica_700Bold",
} as const;
