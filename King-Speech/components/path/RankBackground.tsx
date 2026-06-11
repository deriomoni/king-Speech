import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, StyleSheet, Platform, useWindowDimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  cancelAnimation,
} from "react-native-reanimated";
import type { RankTheme } from "./rankTheme";
import type { ThemeMode } from "@/context/ThemeContext";
import { MeshGradientBackground } from "./MeshGradientBackground";

// ──────────────────────────────────────────────────────────────────────
// Color helpers (small, local — kept inside this file on purpose)
// ──────────────────────────────────────────────────────────────────────
function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v;
}
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = parseInt(
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
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
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0,
    s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
        break;
      case g:
        h = ((b - r) / d + 2) * 60;
        break;
      default:
        h = ((r - g) / d + 4) * 60;
    }
  }
  return [h, s, l];
}
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h = ((h % 360) + 360) % 360;
  s = clamp(s, 0, 1);
  l = clamp(l, 0, 1);
  if (s === 0) {
    const v = l * 255;
    return [v, v, v];
  }
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
// Hue-aware mix that takes the shorter arc — avoids muddy mid-tones.
function mixHsl(a: string, b: string, t: number): string {
  const [h1, s1, l1] = hexToHsl(a);
  const [h2, s2, l2] = hexToHsl(b);
  let dh = h2 - h1;
  if (dh > 180) dh -= 360;
  if (dh < -180) dh += 360;
  return hslToHex(h1 + dh * t, s1 + (s2 - s1) * t, l1 + (l2 - l1) * t);
}
function alphaHex(a: number): string {
  return clamp(Math.round(a * 255), 0, 255)
    .toString(16)
    .padStart(2, "0");
}
function withAlpha(hex: string, a: number): string {
  return hex + alphaHex(a);
}
function desaturate(hex: string, amount: number): string {
  const [h, s, l] = hexToHsl(hex);
  return hslToHex(h, clamp(s * (1 - amount), 0, 1), l);
}
function tintHexToward(base: string, toward: string, t: number): string {
  return mixHsl(base, toward, t);
}

// ──────────────────────────────────────────────────────────────────────
// Bridge picker — hand-tuned complementary hue for each palette color.
// Avoids "muddy" interpolations through grey by routing the dark-mode
// bloom→theme blend through a saturated complement, and the light-mode
// blend through a pastel complement.
// ──────────────────────────────────────────────────────────────────────
const BRIDGE_DARK: Record<string, string> = {
  "#FFD166": "#7C3AED", // yellow → violet (defensive, yellow is dropped)
  "#F5A623": "#5B6CFF", // amber (yellow replacement) → indigo
  "#8B5CF6": "#F5A623", // violet → amber
  "#10B981": "#EC4899", // emerald → magenta
  "#3B82F6": "#F59E0B", // blue → amber
  "#F59E0B": "#3B82F6", // amber → blue
  "#EC4899": "#10B981", // pink → emerald
  "#06B6D4": "#F97316", // cyan → orange
  "#4F46E5": "#FACC15", // indigo → gold
  "#14B8A6": "#F43F5E", // teal → rose
  "#A855F7": "#FDE047", // violet → yellow-gold
  "#F97316": "#06B6D4", // orange → cyan
  "#22C55E": "#D946EF", // green → fuchsia
};
const BRIDGE_LIGHT: Record<string, string> = {
  "#FFD166": "#B8B0FF",
  "#F5A623": "#BBD0FF",
  "#8B5CF6": "#FFE3B0",
  "#10B981": "#FFC8DD",
  "#3B82F6": "#FFE3B0",
  "#F59E0B": "#BBD0FF",
  "#EC4899": "#BFEAD0",
  "#06B6D4": "#FFD0B0",
  "#4F46E5": "#FFF1B0",
  "#14B8A6": "#FFC9D1",
  "#A855F7": "#FFF1B0",
  "#F97316": "#B0E6F0",
  "#22C55E": "#F2C8FF",
};
function pickBridgeHue(moduleHex: string, isDark: boolean): string {
  const m = moduleHex.toUpperCase();
  const table = isDark ? BRIDGE_DARK : BRIDGE_LIGHT;
  if (table[m]) return table[m];
  // Algorithmic fallback: hue + 180°, kept saturated on dark, pastel on light.
  const [h, , l] = hexToHsl(moduleHex);
  return isDark ? hslToHex(h + 180, 0.7, 0.55) : hslToHex(h + 180, 0.4, 0.85);
}

// ──────────────────────────────────────────────────────────────────────
// useColorTween — interpolates a hex color through HSL space at 60fps,
// no two-layer cross-fade. Returns the *live* mixed color and an
// opacity 0..1 for the whole tint group (used when locking out).
// ──────────────────────────────────────────────────────────────────────
function mixRgb(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  return rgbToHex(
    r1 + (r2 - r1) * t,
    g1 + (g2 - g1) * t,
    b1 + (b2 - b1) * t,
  );
}

function useColorTween(
  target: string | null,
  fallback: string,
  _baseColor: string,
  duration = 500,
): { color: string; opacity: number } {
  void _baseColor;
  const safeTarget = target ?? fallback;
  const [color, setColor] = useState(safeTarget);
  const [opacity, setOpacity] = useState(target ? 1 : 0);
  const colorRef = useRef(color);
  const opacityRef = useRef(opacity);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    colorRef.current = color;
  }, [color]);
  useEffect(() => {
    opacityRef.current = opacity;
  }, [opacity]);

  useEffect(() => {
    const fromColor = colorRef.current;
    const fromOpacity = opacityRef.current;
    const toOpacity = target ? 1 : 0;
    if (fromColor === safeTarget && fromOpacity === toOpacity) return;
    const start = Date.now();
    // Fast linear-RGB blend with cubic easeInOut — colors visually
    // mix (yellow + violet ≈ neutral midpoint for a brief moment),
    // no hue rotation through the rainbow. Throttled to ~20fps
    // (50ms between updates) — the eye can't distinguish 60fps from
    // 20fps on a 500ms color crossfade, and dropping from 30 frames
    // to ~10 frames per transition dramatically reduces CPU/GPU work
    // (every frame triggers a full re-render of gradients + radial
    // bloom + BlurView, which is the main source of device heating).
    const easeInOutCubic = (x: number) =>
      x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
    let lastTickAt = 0;
    const FRAME_MS = 50;
    const tick = () => {
      const now = Date.now();
      const t = Math.min(1, (now - start) / duration);
      if (t >= 1 || now - lastTickAt >= FRAME_MS) {
        lastTickAt = now;
        const eased = easeInOutCubic(t);
        setColor(mixRgb(fromColor, safeTarget, eased));
        setOpacity(fromOpacity + (toOpacity - fromOpacity) * eased);
      }
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [safeTarget, target, duration]);

  return { color, opacity };
}

// ──────────────────────────────────────────────────────────────────────
// Rank 1 background — photographic radial bloom from the bottom, soft
// complementary mid-tone bridge upward, smooth HSL color mixing on
// module changes, theme-aware (deep black on dark, near-white on light).
// ──────────────────────────────────────────────────────────────────────
function RadialBloom({
  tint,
  width,
  height,
  isDark,
}: {
  tint: string;
  width: number;
  height: number;
  isDark: boolean;
}) {
  // Stack of concentric circles centered well below the bottom edge.
  // Alphas decrease outward to approximate a Gaussian falloff. On dark
  // theme the bloom origin is pushed further off-screen so the color
  // appears as a low, soft glow rather than filling the lower half.
  const diag = Math.sqrt(width * width + height * height);
  const baseAlpha = isDark ? 0.95 : 0.55;
  const bottomOffsetMul = isDark ? 0.72 : 0.5;
  const rings = [
    { sizeMul: 0.55, alpha: 1.0 },
    { sizeMul: 0.85, alpha: 0.7 },
    { sizeMul: 1.2, alpha: 0.42 },
    { sizeMul: 1.6, alpha: 0.22 },
    { sizeMul: 2.05, alpha: 0.1 },
  ];
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {rings.map((r, i) => {
        const size = diag * r.sizeMul;
        return (
          <View
            key={i}
            style={{
              position: "absolute",
              left: width / 2 - size / 2,
              bottom: -size * bottomOffsetMul,
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: withAlpha(tint, r.alpha * baseAlpha),
            }}
          />
        );
      })}
    </View>
  );
}

function NoiseOverlay({ isDark }: { isDark: boolean }) {
  // Very faint dotted noise to fight Mach-band banding on cheap LCDs.
  const dotColor = isDark ? "#FFFFFF08" : "#00000008";
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {Array.from({ length: 60 }).map((_, i) => (
        <View
          key={i}
          style={{
            position: "absolute",
            top: (i * 53) % 1200,
            left: (i * 89) % 360,
            width: 2,
            height: 2,
            borderRadius: 1,
            backgroundColor: dotColor,
          }}
        />
      ))}
    </View>
  );
}

function Rank1MinimalBackground({
  themeMode,
  tintColor,
}: {
  themeMode: ThemeMode;
  tintColor?: string | null;
}) {
  const isDark = themeMode === "dark";
  const { width, height } = useWindowDimensions();
  const fallbackTint = isDark ? "#5B6CFF" : "#B0C4FF";
  const baseColor = isDark ? "#07070A" : "#FAFAFC";
  const { color: liveTint, opacity: tintOpacity } = useColorTween(
    tintColor ?? null,
    fallbackTint,
    baseColor,
    500,
  );
  const themeStops = useMemo(
    () =>
      isDark
        ? ["#07070A", "#0A0A0F", "#08080C"]
        : ["#FAFAFC", "#F5F5F8", "#FBFBFD"],
    [isDark],
  );
  const bridge = useMemo(
    () => (isDark ? baseColor : pickBridgeHue(liveTint, isDark)),
    [liveTint, isDark, baseColor],
  );

  // Vertical gradient (top → bottom). Dark theme: a single-color alpha
  // ramp of the dark base — no second color anywhere in the bridge —
  // so there is no perceivable band. The module's color comes purely
  // from the radial bloom underneath, which sits low on the screen.
  // Light theme keeps the airy bridge through a soft complementary
  // mid-tone, which reads cleanly on white.
  const bridgeStops = useMemo(() => {
    const top = baseColor;
    const lower = liveTint;
    if (isDark) {
      // Same color, slowly decreasing alpha — pure veil over the bloom.
      return [
        withAlpha(top, 1),
        withAlpha(top, 0.98),
        withAlpha(top, 0.92),
        withAlpha(top, 0.78),
        withAlpha(top, 0.5),
        withAlpha(top, 0.22),
        withAlpha(top, 0.06),
        withAlpha(top, 0.0),
      ];
    }
    const nearTop = tintHexToward(baseColor, bridge, 0.1);
    const mid = bridge;
    const lowerMid = desaturate(liveTint, 0.4);
    return [
      withAlpha(top, 1),
      withAlpha(top, 0.92),
      withAlpha(nearTop, 0.55),
      withAlpha(mid, 0.2),
      withAlpha(lowerMid, 0.18),
      withAlpha(lower, 0.0),
    ];
  }, [baseColor, bridge, liveTint, isDark]);
  const bridgeLocations = useMemo(
    () =>
      isDark
        ? [0, 0.45, 0.6, 0.72, 0.82, 0.9, 0.96, 1]
        : [0, 0.22, 0.45, 0.62, 0.82, 1],
    [isDark],
  );

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Pure theme base */}
      <LinearGradient
        colors={themeStops as [string, string, string]}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Tint group — fades out entirely on locked modules */}
      <View style={[StyleSheet.absoluteFill, { opacity: tintOpacity }]}>
        {/* Radial bloom from bottom center */}
        {Platform.OS !== "web" ? (
          <View style={StyleSheet.absoluteFill}>
            <RadialBloom
              tint={liveTint}
              width={width}
              height={height}
              isDark={isDark}
            />
            <BlurView
              intensity={80}
              tint={isDark ? "dark" : "light"}
              style={StyleSheet.absoluteFill}
            />
          </View>
        ) : (
          <RadialBloom
            tint={liveTint}
            width={width}
            height={height}
            isDark={isDark}
          />
        )}

        {/* 6-stop vertical bridge through complementary mid-tone */}
        <LinearGradient
          colors={bridgeStops as unknown as [string, string, ...string[]]}
          locations={bridgeLocations as unknown as readonly [number, number, ...number[]]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </View>

      {/* Top inner shadow so the glass header sits on a clean band */}
      <LinearGradient
        colors={[
          isDark ? "#000000CC" : "#FFFFFFCC",
          isDark ? "#00000000" : "#FFFFFF00",
        ]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.12 }}
        style={[StyleSheet.absoluteFill, { height: 120 }]}
      />

      {/* Subtle noise overlay */}
      <NoiseOverlay isDark={isDark} />
    </View>
  );
}

function NoviceSketchPattern({ theme }: { theme: RankTheme }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {Array.from({ length: 9 }).map((_, i) => (
        <View
          key={`r${i}`}
          style={{
            position: "absolute",
            top: 80 + i * 86,
            left: i % 2 === 0 ? 24 : undefined,
            right: i % 2 === 0 ? undefined : 24,
            width: 60 + (i % 3) * 14,
            height: 60 + (i % 3) * 14,
            borderRadius: 999,
            borderWidth: 2,
            borderColor: theme.accent + "33",
            borderStyle: "dashed",
            opacity: 0.6,
          }}
        />
      ))}
      {Array.from({ length: 6 }).map((_, i) => (
        <View
          key={`l${i}`}
          style={{
            position: "absolute",
            top: 140 + i * 120,
            left: 60 + (i % 2) * 100,
            width: 90,
            height: 1.5,
            backgroundColor: theme.accent + "55",
            transform: [{ rotate: `${(i % 2 === 0 ? -8 : 6)}deg` }],
            opacity: 0.5,
          }}
        />
      ))}
    </View>
  );
}

function AmateurPopArtPattern({ theme }: { theme: RankTheme }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {Array.from({ length: 14 }).map((_, i) => {
        const row = Math.floor(i / 2);
        const col = i % 2;
        return (
          <View
            key={`hex${i}`}
            style={{
              position: "absolute",
              top: 80 + row * 110,
              left: col === 0 ? 18 : undefined,
              right: col === 1 ? 18 : undefined,
              width: 70,
              height: 80,
              backgroundColor: row % 2 === 0 ? theme.accent + "22" : "#7C3AED22",
              transform: [{ rotate: "30deg" }],
              borderRadius: 8,
            }}
          />
        );
      })}
      {Array.from({ length: 30 }).map((_, i) => (
        <View
          key={`d${i}`}
          style={{
            position: "absolute",
            top: 60 + (i * 47) % 900,
            left: 30 + (i * 73) % 320,
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: theme.accentDark + "55",
          }}
        />
      ))}
    </View>
  );
}

function ConfidentTechGrid({ theme }: { theme: RankTheme }) {
  const shimmer = useSharedValue(0);
  useEffect(() => {
    shimmer.value = withRepeat(withTiming(1, { duration: 4500 }), -1, true);
    return () => cancelAnimation(shimmer);
  }, []);
  const shimmerStyle = useAnimatedStyle(() => ({ opacity: 0.18 + shimmer.value * 0.18 }));
  const cells = 18;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* horizontal grid lines */}
      {Array.from({ length: cells }).map((_, i) => (
        <View
          key={`h${i}`}
          style={{
            position: "absolute",
            top: i * 64,
            left: 0,
            right: 0,
            height: 1,
            backgroundColor: theme.accent + "12",
          }}
        />
      ))}
      {/* vertical grid lines */}
      {Array.from({ length: 10 }).map((_, i) => (
        <View
          key={`v${i}`}
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: i * 48,
            width: 1,
            backgroundColor: theme.accent + "12",
          }}
        />
      ))}
      <Animated.View style={[StyleSheet.absoluteFill, shimmerStyle]}>
        <LinearGradient
          colors={[theme.accent + "00", theme.accent + "30", theme.accent + "00"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      {/* "matrix" dots */}
      {Array.from({ length: 24 }).map((_, i) => (
        <View
          key={`d${i}`}
          style={{
            position: "absolute",
            top: 100 + (i * 67) % 900,
            left: 20 + (i * 53) % 320,
            width: 3,
            height: 3,
            borderRadius: 2,
            backgroundColor: theme.accent + "88",
          }}
        />
      ))}
    </View>
  );
}

function MasterArtDeco({ theme }: { theme: RankTheme }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* concentric octagonal frames */}
      {Array.from({ length: 5 }).map((_, i) => {
        const size = 280 + i * 60;
        return (
          <View
            key={`o${i}`}
            style={{
              position: "absolute",
              top: 220 + i * 180,
              left: -size / 2 + 180,
              width: size,
              height: size,
              borderWidth: 1,
              borderColor: theme.accent + "20",
              transform: [{ rotate: "22.5deg" }],
              borderRadius: 12,
            }}
          />
        );
      })}
      {/* gold seams */}
      {Array.from({ length: 8 }).map((_, i) => (
        <View
          key={`s${i}`}
          style={{
            position: "absolute",
            top: 100 + i * 130,
            left: i % 2 === 0 ? 20 : undefined,
            right: i % 2 === 0 ? undefined : 20,
            width: 60,
            height: 2,
            backgroundColor: theme.accent + "55",
          }}
        />
      ))}
    </View>
  );
}

function ProCosmos({ theme }: { theme: RankTheme }) {
  const orbit = useSharedValue(0);
  useEffect(() => {
    orbit.value = withRepeat(withTiming(1, { duration: 14000 }), -1, false);
    return () => cancelAnimation(orbit);
  }, []);
  const orbitStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${orbit.value * 360}deg` }],
  }));
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* stars */}
      {Array.from({ length: 60 }).map((_, i) => {
        const size = 1 + (i % 4);
        return (
          <View
            key={`star${i}`}
            style={{
              position: "absolute",
              top: 40 + (i * 53) % 1200,
              left: 10 + (i * 31) % 360,
              width: size,
              height: size,
              borderRadius: size,
              backgroundColor: i % 7 === 0 ? theme.accent : "#FFFFFF",
              opacity: 0.4 + (i % 3) * 0.2,
            }}
          />
        );
      })}
      {/* orbital ring */}
      <Animated.View
        style={[
          orbitStyle,
          {
            position: "absolute",
            top: 240,
            left: -120,
            right: -120,
            height: 380,
            borderWidth: 1,
            borderColor: theme.accent + "22",
            borderRadius: 999,
          },
        ]}
      />
      <Animated.View
        style={[
          orbitStyle,
          {
            position: "absolute",
            top: 540,
            left: -60,
            right: -60,
            height: 280,
            borderWidth: 1,
            borderColor: theme.accent + "33",
            borderRadius: 999,
            transform: [{ rotate: "-30deg" }],
          },
        ]}
      />
    </View>
  );
}

export function RankBackground({
  theme,
  children,
  themeMode,
  tintColor,
}: {
  theme: RankTheme;
  children?: React.ReactNode;
  themeMode?: ThemeMode;
  tintColor?: string | null;
}) {
  // Mesh gradient: rank 1 follows app theme (light/dark); ranks 2–5 use
  // each rank's theatrical `isDark` flag.
  const isDark =
    theme.index === 1
      ? (themeMode ?? "dark") === "dark"
      : theme.isDark;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <MeshGradientBackground
        isDark={isDark}
        tintColor={tintColor ?? theme.accent}
        accent={theme.accent}
        brandPurpleAsDefault={theme.index === 1}
      />
      {children}
    </View>
  );
}
