import React from "react";
import { View, ViewStyle } from "react-native";
import RiveAnim from "@/components/RiveAnim";

// ---------------------------------------------------------------------------
// OscarMascot — the game's face. A thin wrapper around RiveAnim that plays a
// named emotion timeline from assets/rive/oscar.riv.
//
// The .riv artboard ("OSCAR mascot") ships with a demo "Click me" button in
// its bottom ~25%. We render the full square canvas and clip the bottom strip
// with overflow:hidden, so the button never shows. The canvas itself is
// transparent, so Oscar sits directly on the app background.
//
// Quality rules:
//  - Fixed pixel size, no transform scaling — the canvas rasterizes once at
//    the correct resolution and stays crisp on web and native.
//  - Clipping is a pure crop (no scale), so nothing blurs.
// ---------------------------------------------------------------------------

export type OscarEmotion =
  | "idle"      // calm blinking
  | "hi"        // waving hello — greetings
  | "thumbup"   // "класс!" — excellent result
  | "happy"     // joy — good result
  | "cool"      // confident — rank up / celebration
  | "notsure"   // doubt — thinking / didn't hear you
  | "sad"       // sadness — low result
  | "upset"     // upset — failure
  | "shiny";    // sparkle — rewards

const EMOTION_ANIMATION: Record<OscarEmotion, string> = {
  idle: "Idle",
  hi: "Hi",
  thumbup: "ThumbUp",
  happy: "Happy",
  cool: "Cool",
  notsure: "NotSure",
  sad: "Sad",
  upset: "Upset",
  shiny: "Shiny",
};

// Portion of the artboard height we keep (crops out the demo button strip).
const CROP = 0.74;

interface Props {
  emotion?: OscarEmotion;
  /** Square canvas size in px. Keep between ~96 and ~240 so Oscar never dominates. */
  size?: number;
  style?: ViewStyle;
}

export default function OscarMascot({ emotion = "idle", size = 150, style }: Props) {
  return (
    <View
      style={[
        {
          width: size,
          height: Math.round(size * CROP),
          overflow: "hidden",
        },
        style,
      ]}
      pointerEvents="none"
    >
      <RiveAnim
        // Remount on emotion change so the new timeline plays from frame 0.
        key={`oscar-${emotion}`}
        source={require("@/assets/rive/oscar.riv")}
        style={{ width: size, height: size, backgroundColor: "transparent" }}
        fit="contain"
        alignment="topCenter"
        autoplay
        animation={EMOTION_ANIMATION[emotion]}
        removeWhiteBg
      />
    </View>
  );
}
