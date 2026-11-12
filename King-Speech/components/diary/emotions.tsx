// Emotions for the audio diary — Figma "Кассета · эмоции" (422:1556) for the
// cassette mouths/lids and the "Mood picker" faces on "06c · подпиши" (410:1903).
import React from "react";
import Svg, { Circle, Path } from "react-native-svg";
import type { DiaryEmotion } from "@/lib/diaryStorage";

export type PickableEmotion = Exclude<DiaryEmotion, "neutral">;

export const EMOTIONS: {
  key: PickableEmotion;
  color: string;
  ru: string;
  en: string;
}[] = [
  { key: "joy", color: "#FFE7A3", ru: "Радость", en: "Joy" },
  { key: "calm", color: "#CBEBD5", ru: "Спокойствие", en: "Calm" },
  { key: "surprise", color: "#E2D2F7", ru: "Удивление", en: "Surprise" },
  { key: "sad", color: "#BFD7F2", ru: "Грусть", en: "Sadness" },
  { key: "anxious", color: "#FFD6B8", ru: "Тревога", en: "Anxiety" },
  { key: "angry", color: "#F7C1BC", ru: "Злость", en: "Anger" },
  { key: "tired", color: "#E4E0DA", ru: "Усталость", en: "Tiredness" },
];

const INK = "#2B2A33";

/**
 * Cassette mouth paths in the 163×104 cassette body space (window centre is
 * x 81.5 / y 67). Converted from the 1.3× emotion sheet.
 */
export const CASSETTE_MOUTH: Record<DiaryEmotion, string | null> = {
  neutral: "M74.5 67 L88.5 67",
  joy: "M71.5 64.8 C78.2 70.8 84.8 70.8 91.5 64.8",
  calm: "M74.5 66 C79.2 68.7 83.8 68.7 88.5 66",
  surprise: null, // drawn as an ellipse
  sad: "M72.5 68.7 C78.5 64 84.5 64 90.5 68.7",
  anxious: "M72.5 67 C74.5 65 76.5 65 78.5 67 C80.5 69 82.5 69 84.5 67 C86.5 65 88.5 65 90.5 67",
  angry: "M74.5 67.6 C79.2 66 83.8 66 88.5 67.6",
  tired: "M75.5 67.5 C79.5 66.2 83.5 66.2 87.5 67.5",
};

/** Eyelids over the reels (filled with the window colour). */
export const CASSETTE_LIDS: Partial<Record<DiaryEmotion, [string, string]>> = {
  sad: ["M32 57 L52 57 L52 59.7 L32 66 Z", "M111 57 L131 57 L131 66 L111 59.7 Z"],
  angry: ["M32 57 L52 57 L52 68.2 Z", "M111 57 L131 57 L111 68.2 Z"],
  tired: ["M32 57 H52 V66 H32 Z", "M111 57 H131 V66 H111 Z"],
};

/** Pastel circle face (40×40) used in the mood picker. */
export function MoodFace({ emotion, size = 40 }: { emotion: PickableEmotion; size?: number }) {
  const bg = EMOTIONS.find((e) => e.key === emotion)?.color ?? "#E4E0DA";
  const st = { stroke: INK, strokeLinecap: "round" as const, fill: "none" };
  let face: React.ReactNode = null;
  const dots = (y = 16.63) => (
    <>
      <Circle cx={15.03} cy={y} r={2.83} fill={INK} />
      <Circle cx={25.03} cy={y} r={2.83} fill={INK} />
    </>
  );
  switch (emotion) {
    case "joy":
      face = (
        <>
          {dots()}
          <Path d="M13.3 23.3 C17.7 27.7 22.2 27.7 26.6 23.3" strokeWidth={3.3} {...st} />
        </>
      );
      break;
    case "calm":
      face = (
        <>
          <Path d="M11.7 17.5 C13.9 19.5 16.1 19.5 18.4 17.5 M21.7 17.5 C23.9 19.5 26.1 19.5 28.4 17.5" strokeWidth={3} {...st} />
          <Path d="M15.8 25 C18.6 26.8 21.4 26.8 24.1 25" strokeWidth={3} {...st} />
        </>
      );
      break;
    case "surprise":
      face = (
        <>
          {dots()}
          <Circle cx={20} cy={26} r={3.33} strokeWidth={3} {...st} />
        </>
      );
      break;
    case "sad":
      face = (
        <>
          {dots(17.53)}
          <Path d="M14.3 27.3 C18.1 24 21.9 24 25.6 27.3" strokeWidth={3.3} {...st} />
        </>
      );
      break;
    case "anxious":
      face = (
        <>
          {dots()}
          <Path
            d="M13 25.85 C14.55 24.2 16.1 24.2 17.66 25.85 C19.2 27.5 20.8 27.5 22.33 25.85 C23.9 24.2 25.4 24.2 27 25.85"
            strokeWidth={3}
            {...st}
          />
        </>
      );
      break;
    case "angry":
      face = (
        <>
          <Path d="M11.7 13 L17.36 15.66 M28.36 13 L22.7 15.66" strokeWidth={3} {...st} />
          <Circle cx={15.66} cy={19.36} r={2.66} fill={INK} />
          <Circle cx={24.36} cy={19.36} r={2.66} fill={INK} />
          <Path d="M15.8 26.7 L24.1 26.7" strokeWidth={3.3} {...st} />
        </>
      );
      break;
    case "tired":
      face = (
        <>
          <Path d="M12.5 17.7 L17.5 17.7 M22.5 17.7 L27.5 17.7" strokeWidth={3.2} {...st} />
          <Path d="M16.7 25.7 L23.4 25.7" strokeWidth={3.2} {...st} />
        </>
      );
      break;
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40">
      <Circle cx={20} cy={20} r={20} fill={bg} />
      {face}
    </Svg>
  );
}
