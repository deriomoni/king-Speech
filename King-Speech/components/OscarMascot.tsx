import React from "react";
import { View, ViewStyle } from "react-native";
import RiveAnim from "@/components/RiveAnim";
import { rs } from "@/lib/responsive";

// ---------------------------------------------------------------------------
// OscarMascot — the game's face. A thin wrapper around RiveAnim that plays a
// named emotion timeline from assets/rive/oscar.riv.
//
// The .riv artboard ("OSCAR mascot") has a transparent background (fixed by
// the designer), but still ships with a demo "Click me" button zone in its
// bottom ~25%. We render the full square canvas and clip the bottom strip
// with overflow:hidden, so the button never shows. Oscar sits directly on
// the app background.
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

const OSCAR_RIV = require("@/assets/rive/oscar.riv");

// The mascot is rendered 30% bigger than the requested `size`, inside a FULL
// SQUARE frame (no bottom crop) so NO limb — a raised arm/hand, legs/feet —
// is clipped. The Rive artboard is `contain`-fit and centered, giving the
// character margin on every side.
const SIZE_BOOST = 1.3;

// Measured on the artboard (contain-fit into a 300×300 canvas): across every
// frame of all 9 emotions Oscar never leaves x 43–261, y 16–199 — he only
// fills ~73% × 61% of the canvas, which is why he looked small next to the
// vector poses. `tight` maps this envelope (+4 px margin) onto the box, so he
// is as big as the vector art and still never clipped: the extra canvas is
// transparent and simply overflows the (smaller) layout box.
const ENV = { x0: 39, y0: 12, x1: 265, y1: 203, canvas: 300 };
const ENV_W = ENV.x1 - ENV.x0;
const ENV_H = ENV.y1 - ENV.y0;

// The vector poses carry a drawn ink outline (~0.75% of the figure's width);
// Rive Oscar gets the same contour via RiveAnim's outline filter.
const INK = "#5A231F";
const INK_PER_ENV_W = 0.0075;
const inkFor = (envWidthPx: number) => ({ color: INK, width: Math.max(1, Math.round(envWidthPx * INK_PER_ENV_W * 10) / 10) });

interface Props {
  emotion?: OscarEmotion;
  /** Square canvas size in px. Keep between ~96 and ~240 so Oscar never dominates. */
  size?: number;
  /**
   * Fill the box with Oscar himself (not the padded artboard): the layout box
   * is `size` wide and `size·ENV_H/ENV_W` tall, and every frame of every
   * emotion fits inside it.
   */
  tight?: boolean;
  style?: ViewStyle;
}

export default function OscarMascot({ emotion = "idle", size = rs(150), tight = false, style }: Props) {
  if (tight) {
    const W = Math.round(size);
    const H = Math.round((size * ENV_H) / ENV_W);
    const C = (W * ENV.canvas) / ENV_W;
    return (
      <View style={[{ width: W, height: H, overflow: "visible" }, style]} pointerEvents="none">
        <RiveAnim
          key={`oscar-${emotion}`}
          source={OSCAR_RIV}
          style={{
            position: "absolute",
            left: -(ENV.x0 / ENV.canvas) * C,
            top: -(ENV.y0 / ENV.canvas) * C,
            width: C,
            height: C,
            backgroundColor: "transparent",
          }}
          fit="contain"
          alignment="center"
          autoplay
          animation={EMOTION_ANIMATION[emotion]}
          outline={inkFor(W)}
        />
      </View>
    );
  }
  const S = Math.round(size * SIZE_BOOST);
  return (
    <View
      style={[
        {
          width: S,
          height: S,
          alignItems: "center",
          justifyContent: "center",
        },
        style,
      ]}
      pointerEvents="none"
    >
      <RiveAnim
        // Remount on emotion change so the new timeline plays from frame 0.
        key={`oscar-${emotion}`}
        source={OSCAR_RIV}
        style={{ width: S, height: S, backgroundColor: "transparent" }}
        fit="contain"
        alignment="center"
        autoplay
        animation={EMOTION_ANIMATION[emotion]}
        outline={inkFor((S * ENV_W) / ENV.canvas)}
      />
    </View>
  );
}
