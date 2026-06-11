import { spring } from "@/theme/tokens";

export const warmupTheme = {
  bg: "#0E0E10",
  gold: "#FFCF34",
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
  title: "Rubik_700Bold",
  body: "Nunito_400Regular",
  label: "Nunito_700Bold",
  digit: "Rubik_700Bold",
} as const;
