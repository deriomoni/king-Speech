// Tablet scaling.
//
// King Speech is laid out for phones (~390pt wide). On an iPad the same layout
// should grow with the screen rather than sit small in a big window, so every
// fixed size in a StyleSheet (fonts, paddings, heights, radii, gaps, offsets)
// is multiplied by UI_SCALE on tablet-size screens. Sizes the screens already
// derive from the window (useWindowDimensions) grow on their own.
//
// UI_SCALE = min(width / 390, height / 844), clamped to [1, 1.5]: on phones it
// is exactly 1 (nothing changes); on an 11" iPad ≈ 1.4.
//
// The StyleSheet patch must run before any module creates its styles, so this
// file is imported first from index.js (the app entry).
import { Dimensions, Platform, StyleSheet } from "react-native";

const DESIGN_W = 390;
const DESIGN_H = 844;

const win = Dimensions.get("window");
const shortSide = Math.min(win.width, win.height);
const longSide = Math.max(win.width, win.height);

export const IS_TABLET = Platform.OS !== "web" ? shortSide >= 600 : win.width >= 700;

export const UI_SCALE = IS_TABLET
  ? Math.max(1, Math.min(1.5, shortSide / DESIGN_W, longSide / DESIGN_H))
  : 1;

/** Responsive size: a phone-design number scaled for the current device. */
export function rs(n: number): number {
  return UI_SCALE === 1 ? n : Math.round(n * UI_SCALE * 2) / 2;
}

// Props that are lengths in the phone design. borderWidth, opacity, flex,
// zIndex, elevation, aspectRatio, percentages and strings are left alone.
const SCALED = new Set([
  "fontSize",
  "lineHeight",
  "letterSpacing",
  "width",
  "height",
  "minWidth",
  "minHeight",
  "maxWidth",
  "maxHeight",
  "top",
  "bottom",
  "left",
  "right",
  "start",
  "end",
  "gap",
  "rowGap",
  "columnGap",
  "padding",
  "paddingTop",
  "paddingBottom",
  "paddingLeft",
  "paddingRight",
  "paddingHorizontal",
  "paddingVertical",
  "paddingStart",
  "paddingEnd",
  "margin",
  "marginTop",
  "marginBottom",
  "marginLeft",
  "marginRight",
  "marginHorizontal",
  "marginVertical",
  "marginStart",
  "marginEnd",
  "borderRadius",
  "borderTopLeftRadius",
  "borderTopRightRadius",
  "borderBottomLeftRadius",
  "borderBottomRightRadius",
  "shadowRadius",
]);

function scaleStyle(style: any): any {
  if (!style || typeof style !== "object" || Array.isArray(style)) return style;
  const out: any = {};
  for (const k of Object.keys(style)) {
    const v = style[k];
    out[k] = typeof v === "number" && SCALED.has(k) ? rs(v) : v;
  }
  return out;
}

const origCreate = StyleSheet.create.bind(StyleSheet);

/**
 * StyleSheet.create WITHOUT the automatic tablet scaling — for components that
 * already derive every size from one scale constant (multiplied by UI_SCALE),
 * so their stylesheet and inline numbers stay consistent.
 */
export const createUnscaledStyles: typeof StyleSheet.create = origCreate as any;

if (UI_SCALE !== 1) {
  (StyleSheet as any).create = (styles: Record<string, any>) => {
    const scaled: Record<string, any> = {};
    for (const key of Object.keys(styles)) scaled[key] = scaleStyle(styles[key]);
    return origCreate(scaled);
  };
}
