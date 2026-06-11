import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  Platform,
  useWindowDimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  cancelAnimation,
  Easing,
} from "react-native-reanimated";
import { useIsFocused } from "@react-navigation/native";

// ──────────────────────────────────────────────────────────────────────
// Local color helpers — duplicated from RankBackground intentionally so
// this component stays self-contained and can move to other screens.
// ──────────────────────────────────────────────────────────────────────
function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v;
}
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = parseInt(
    h.length === 3
      ? h.split("").map((c) => c + c).join("")
      : h,
    16,
  );
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbToHex(r: number, g: number, b: number): string {
  const to = (v: number) =>
    clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) * 60; break;
      case g: h = ((b - r) / d + 2) * 60; break;
      default: h = ((r - g) / d + 4) * 60;
    }
  }
  return [h, s, l];
}
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h = ((h % 360) + 360) % 360;
  s = clamp(s, 0, 1); l = clamp(l, 0, 1);
  if (s === 0) { const v = l * 255; return [v, v, v]; }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hk = h / 360;
  const t = [hk + 1 / 3, hk, hk - 1 / 3].map((x) => {
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  });
  return [t[0] * 255, t[1] * 255, t[2] * 255];
}
function hexToHsl(hex: string): [number, number, number] {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHsl(r, g, b);
}
function hslToHex(h: number, s: number, l: number): string {
  const [r, g, b] = hslToRgb(h, s, l);
  return rgbToHex(r, g, b);
}
function mixRgb(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  return rgbToHex(
    r1 + (r2 - r1) * t,
    g1 + (g2 - g1) * t,
    b1 + (b2 - b1) * t,
  );
}
function alphaHex(a: number): string {
  return clamp(Math.round(a * 255), 0, 255)
    .toString(16)
    .padStart(2, "0");
}
function withAlpha(hex: string, a: number): string {
  return hex + alphaHex(a);
}

// Algorithmic complementary hue — kept saturated on dark, pastel on light.
function complement(hex: string, isDark: boolean): string {
  const [h] = hexToHsl(hex);
  return isDark ? hslToHex(h + 180, 0.7, 0.55) : hslToHex(h + 180, 0.5, 0.78);
}

// Smooth, ~10fps color tween between rank tints — keeps the GPU work
// low compared to per-frame mixing. The blobs themselves animate on
// the UI thread via Reanimated, so re-renders happen only on tint
// changes (rare — when scrolling between modules).
function useColorTween(target: string, duration = 600): string {
  const [color, setColor] = useState(target);
  const colorRef = useRef(target);
  const rafRef = useRef<number | null>(null);
  useEffect(() => { colorRef.current = color; }, [color]);
  useEffect(() => {
    const from = colorRef.current;
    if (from === target) return;
    const start = Date.now();
    let lastTickAt = 0;
    const FRAME_MS = 80;
    const tick = () => {
      const now = Date.now();
      const t = Math.min(1, (now - start) / duration);
      if (t >= 1 || now - lastTickAt >= FRAME_MS) {
        lastTickAt = now;
        const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        setColor(mixRgb(from, target, eased));
      }
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
      else rafRef.current = null;
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [target, duration]);
  return color;
}

// ──────────────────────────────────────────────────────────────────────
// One animated blob — pure transform/opacity animations on the UI
// thread (Reanimated 4), so the JS thread never participates in the
// motion. No top/left mutation anywhere.
// ──────────────────────────────────────────────────────────────────────
function Blob({
  color,
  size,
  baseLeft,
  baseTop,
  rangeX,
  rangeY,
  periodX,
  periodY,
  periodScale,
  scaleAmp,
  baseOpacity,
  paused,
  delay = 0,
}: {
  color: string;
  size: number;
  baseLeft: number;
  baseTop: number;
  rangeX: number;
  rangeY: number;
  periodX: number;
  periodY: number;
  periodScale: number;
  scaleAmp: number;
  baseOpacity: number;
  paused: boolean;
  delay?: number;
}) {
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const s = useSharedValue(1);

  useEffect(() => {
    if (paused) {
      cancelAnimation(tx);
      cancelAnimation(ty);
      cancelAnimation(s);
      return;
    }
    // Each blob loops along two independent sinusoidal-feeling paths
    // (different periods on X vs Y means the trajectory is a Lissajous
    // curve, never a straight line and never repeating in a robotic way).
    tx.value = withDelay(
      delay,
      withRepeat(
        withTiming(rangeX, {
          duration: periodX,
          easing: Easing.inOut(Easing.sin),
        }),
        -1,
        true,
      ),
    );
    ty.value = withDelay(
      delay + 400,
      withRepeat(
        withTiming(rangeY, {
          duration: periodY,
          easing: Easing.inOut(Easing.sin),
        }),
        -1,
        true,
      ),
    );
    s.value = withDelay(
      delay + 800,
      withRepeat(
        withTiming(1 + scaleAmp, {
          duration: periodScale,
          easing: Easing.inOut(Easing.sin),
        }),
        -1,
        true,
      ),
    );
    return () => {
      cancelAnimation(tx);
      cancelAnimation(ty);
      cancelAnimation(s);
    };
  }, [paused, rangeX, rangeY, periodX, periodY, periodScale, scaleAmp, delay]);

  const aStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { scale: s.value },
    ],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: "absolute",
          left: baseLeft,
          top: baseTop,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: withAlpha(color, baseOpacity),
        },
        aStyle,
      ]}
    />
  );
}

// ──────────────────────────────────────────────────────────────────────
// Public component — 3 organic, drifting blurred blobs over a deep
// theme base. Works on iOS, Android, and web. The blur is rendered
// ONCE over the blob layer (not per blob) — on native via BlurView,
// on web via CSS `filter: blur()` on the blob container.
// ──────────────────────────────────────────────────────────────────────
export function MeshGradientBackground({
  isDark,
  tintColor,
  accent,
  brandPurpleAsDefault = false,
}: {
  isDark: boolean;
  /** Active module / rank tint — drives blob #1. */
  tintColor?: string | null;
  /** Rank accent — drives blob #2. */
  accent: string;
  /** When true (Rank 1 / fallback), Blob C is forced to brand purple
   *  #9468FB instead of an algorithmic complement — guarantees the
   *  brand color is present on the entry rank and any default state. */
  brandPurpleAsDefault?: boolean;
}) {
  const { width, height } = useWindowDimensions();
  const isFocused = useIsFocused();

  // Brand purple — King Speech signature hue, used as the explicit
  // default for Rank 1 / fallback (one of the three blobs).
  const BRAND = "#9468FB";
  const fallbackTint = isDark ? "#5B6CFF" : "#B0C4FF";

  // Three blob hues. Tween them so module changes crossfade smoothly.
  const tint = useColorTween(tintColor ?? accent ?? fallbackTint, 600);
  const accentLive = useColorTween(accent ?? BRAND, 600);
  // Blob C: brand purple on Rank 1 / fallback; complementary hue otherwise.
  const comp = useMemo(
    () => (brandPurpleAsDefault ? BRAND : complement(tint, isDark)),
    [brandPurpleAsDefault, tint, isDark],
  );
  const blob3 = useColorTween(comp, 600);

  // Blob sizing scales with the smaller screen dimension so the mesh
  // looks the same on phone and on a wide web preview.
  const D = Math.min(width, height);
  const sizeA = D * 1.05;
  const sizeB = D * 0.95;
  const sizeC = D * 1.15;

  // Base color of the canvas behind the blobs. Deep on dark, near-white
  // on light. Pure single color — the blobs add all the variation.
  const baseColor = isDark ? "#0A0A0F" : "#F6F6FA";

  const baseOpacity = isDark ? 0.55 : 0.45;
  const blurIntensity = isDark ? 80 : 70;

  // The blob container — on web it gets a CSS blur filter; on native
  // it's a normal View with a BlurView stacked above.
  const blobLayerStyle: any =
    Platform.OS === "web"
      ? {
          ...StyleSheet.absoluteFillObject,
          // RN-Web passes these through to the underlying div. willChange
          // tells the browser to promote the layer to its own compositor
          // texture so the blur isn't re-rasterized every frame.
          filter: "blur(90px) saturate(115%)",
          WebkitFilter: "blur(90px) saturate(115%)",
          willChange: "transform, filter",
        }
      : StyleSheet.absoluteFillObject;

  // Paused when the screen is not focused (Путь tab inactive, or world
  // detail screen pushed away). Saves battery and stops the GPU work.
  const paused = !isFocused;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Pure theme base */}
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: baseColor },
        ]}
      />

      {/* Blob layer */}
      <View style={blobLayerStyle} pointerEvents="none">
        {/* Blob A — module tint, bottom-left, slow horizontal drift */}
        <Blob
          color={tint}
          size={sizeA}
          baseLeft={-sizeA * 0.35}
          baseTop={height - sizeA * 0.55}
          rangeX={D * 0.25}
          rangeY={-D * 0.18}
          periodX={17000}
          periodY={21000}
          periodScale={14000}
          scaleAmp={0.12}
          baseOpacity={baseOpacity + 0.1}
          paused={paused}
        />
        {/* Blob B — rank accent, top-right, faster wobble */}
        <Blob
          color={accentLive}
          size={sizeB}
          baseLeft={width - sizeB * 0.65}
          baseTop={-sizeB * 0.3}
          rangeX={-D * 0.22}
          rangeY={D * 0.2}
          periodX={19000}
          periodY={15000}
          periodScale={16000}
          scaleAmp={0.14}
          baseOpacity={baseOpacity}
          paused={paused}
          delay={1500}
        />
        {/* Blob C — complementary / brand purple, middle-right, gentle */}
        <Blob
          color={blob3}
          size={sizeC}
          baseLeft={width * 0.15}
          baseTop={height * 0.35 - sizeC * 0.5}
          rangeX={D * 0.18}
          rangeY={D * 0.22}
          periodX={23000}
          periodY={25000}
          periodScale={20000}
          scaleAmp={0.1}
          baseOpacity={baseOpacity - 0.1}
          paused={paused}
          delay={3000}
        />
      </View>

      {/* Native blur pass — one BlurView for the whole mesh, not per
          blob. Web already blurs through CSS filter above. */}
      {Platform.OS !== "web" && (
        <BlurView
          intensity={blurIntensity}
          tint={isDark ? "dark" : "light"}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      )}

      {/* Top inner shadow so the glass header still sits on a clean
          band — keeps the existing header readability contract. */}
      <LinearGradient
        colors={[
          isDark ? "#000000CC" : "#FFFFFFCC",
          isDark ? "#00000000" : "#FFFFFF00",
        ]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={[StyleSheet.absoluteFill, { height: 120 }]}
        pointerEvents="none"
      />

      {/* Soft bottom vignette — adds depth without darkening too much. */}
      <LinearGradient
        colors={[
          isDark ? "#00000000" : "#FFFFFF00",
          isDark ? "#00000099" : "#FFFFFF99",
        ]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={[
          StyleSheet.absoluteFill,
          { top: undefined, height: 220, bottom: 0 },
        ]}
        pointerEvents="none"
      />
    </View>
  );
}
