import type { ImageSourcePropType } from "react-native";

// Catalogue of backgrounds for the profile plate (cover banner). The player
// doesn't upload a photo — they pick one of these. The artwork lives in Figma
// (page «Фоны таблички», file MSlyvSMGBE73ZTdKrhsmBL) and is exported at 3×
// (1068×378) in the exact shape of the plate, avatar notch transparent.
// `bg` is the colour around the notch — it is laid under the picture so the
// plate never shows a gap when the banner is wider than the artwork.

export type CoverPattern = {
  id: string;
  ru: string;
  en: string;
  bg: string;
  image: ImageSourcePropType;
};

export const COVER_PATTERNS: CoverPattern[] = [
  { id: "paper-cosmos", ru: "Бумажный космос", en: "Paper cosmos", bg: "#B97A57", image: require("@/assets/profile-covers/paper-cosmos.png") },
  { id: "constellations", ru: "Созвездия", en: "Constellations", bg: "#24263A", image: require("@/assets/profile-covers/constellations.png") },
  { id: "crowns-rainbow", ru: "Короны", en: "Crowns", bg: "#FF639C", image: require("@/assets/profile-covers/crowns-rainbow.png") },
  { id: "crowns-gold", ru: "Золотые короны", en: "Gold crowns", bg: "#5A34B8", image: require("@/assets/profile-covers/crowns-gold.png") },
  { id: "sparks", ru: "Искры", en: "Sparks", bg: "#8FD6C8", image: require("@/assets/profile-covers/sparks.png") },
  { id: "premiere", ru: "Премьера", en: "Premiere", bg: "#7D4B27", image: require("@/assets/profile-covers/premiere.png") },
  { id: "deep", ru: "Глубина", en: "Deep sea", bg: "#0C0C10", image: require("@/assets/profile-covers/deep.png") },
  { id: "horses", ru: "Лошадки", en: "Horses", bg: "#0F2148", image: require("@/assets/profile-covers/horses.png") },
  { id: "tulips", ru: "Тюльпаны", en: "Tulips", bg: "#F4EADB", image: require("@/assets/profile-covers/tulips.png") },
  { id: "meadow", ru: "Цветочный луг", en: "Meadow", bg: "#4FA04A", image: require("@/assets/profile-covers/meadow.png") },
  { id: "lucky", ru: "На удачу", en: "Lucky", bg: "#55A661", image: require("@/assets/profile-covers/lucky.png") },
  { id: "clouds", ru: "Облака", en: "Clouds", bg: "#8EC5EE", image: require("@/assets/profile-covers/clouds.png") },
  { id: "apples", ru: "Яблоки", en: "Apples", bg: "#4A3513", image: require("@/assets/profile-covers/apples.png") },
  { id: "terrazzo", ru: "Терраццо", en: "Terrazzo", bg: "#F4EEE3", image: require("@/assets/profile-covers/terrazzo.png") },
];

/** Aspect ratio of the exported artwork (= the plate at the design width). */
export const COVER_ART_RATIO = 356 / 126;

export const coverPatternById = (id: string | null | undefined) =>
  COVER_PATTERNS.find((p) => p.id === id) ?? null;
