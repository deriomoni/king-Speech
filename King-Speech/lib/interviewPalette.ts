import type { ThemeMode } from "@/context/ThemeContext";

export type InterviewPalette = {
  bg: string;
  bgBottom: string;
  text: string;
  textSec: string;
  textFaint: string;
  cardBg: string;
  glassBorder: string;
  glassTint: "light" | "dark";
  accent: string;
  accentDeep: string;
  accentSoft: string;
  green: string;
  glowA: string;
  glowB: string;
  rowBg: string;
  rowBorder: string;
  rowBgActive: string;
  handle: string;
  headerChip: string;
  divider: string;
  overlay: string;
};

export function getInterviewPalette(mode: ThemeMode): InterviewPalette {
  if (mode === "light") {
    return {
      bg: "#FAFAFC",
      bgBottom: "#F0F0F5",
      text: "#0E0E10",
      textSec: "rgba(14,14,16,0.65)",
      textFaint: "rgba(14,14,16,0.45)",
      cardBg: "rgba(255,255,255,0.72)",
      glassBorder: "rgba(14,14,16,0.10)",
      glassTint: "light",
      accent: "#9468FB",
      accentDeep: "#6A4FF4",
      accentSoft: "rgba(148,104,251,0.14)",
      green: "#34C785",
      glowA: "rgba(148,104,251,0.12)",
      glowB: "rgba(106,79,244,0.08)",
      rowBg: "rgba(14,14,16,0.03)",
      rowBorder: "rgba(14,14,16,0.08)",
      rowBgActive: "rgba(148,104,251,0.10)",
      handle: "rgba(14,14,16,0.10)",
      headerChip: "rgba(14,14,16,0.05)",
      divider: "rgba(14,14,16,0.08)",
      overlay: "rgba(14,14,16,0.35)",
    };
  }
  return {
    bg: "#0E0E10",
    bgBottom: "#0A0A0F",
    text: "#F5F5F7",
    textSec: "rgba(255,255,255,0.65)",
    textFaint: "rgba(255,255,255,0.55)",
    cardBg: "rgba(255,255,255,0.05)",
    glassBorder: "rgba(255,255,255,0.10)",
    glassTint: "dark",
    accent: "#9468FB",
    accentDeep: "#6A4FF4",
    accentSoft: "rgba(148,104,251,0.16)",
    green: "#34C785",
    glowA: "rgba(148,104,251,0.18)",
    glowB: "rgba(106,79,244,0.14)",
    rowBg: "rgba(255,255,255,0.03)",
    rowBorder: "rgba(255,255,255,0.06)",
    rowBgActive: "rgba(148,104,251,0.10)",
    handle: "rgba(255,255,255,0.10)",
    headerChip: "rgba(255,255,255,0.06)",
    divider: "rgba(255,255,255,0.08)",
    overlay: "rgba(0,0,0,0.45)",
  };
}
