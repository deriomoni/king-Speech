// Face-tracker glyph — Figma "Face tracker icon" / states sheet 446:2398:
// four rounded corner brackets, two wide-set dot eyes, an L nose and a smile.
import React from "react";
import Svg, { Path, Circle } from "react-native-svg";

export type FaceTrackState = "ok" | "turn" | "lost";

export const FACE_TRACK_COLORS: Record<FaceTrackState, string> = {
  ok: "#FFFFFF", // «В кадре»
  turn: "#FFD857", // «Поверни лицо»
  lost: "#FF5A4E", // «Лицо потеряно»
};

export function FaceTrackerIcon({ size = 56, color = "#FFFFFF" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 56 56" fill="none">
      <Path d="M4 17V11a7 7 0 0 1 7-7h6" stroke={color} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M39 4h6a7 7 0 0 1 7 7v6" stroke={color} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M4 39v6a7 7 0 0 0 7 7h6" stroke={color} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M52 39v6a7 7 0 0 1-7 7h-6" stroke={color} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={18.5} cy={22} r={2.8} fill={color} />
      <Circle cx={37.5} cy={22} r={2.8} fill={color} />
      <Path d="M29 21v9h-3" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M20 37c4.5 4 11.5 4 16 0" stroke={color} strokeWidth={3} strokeLinecap="round" />
    </Svg>
  );
}
