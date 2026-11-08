import React, { useId, useState } from "react";
import { StyleSheet, View, type LayoutChangeEvent } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Defs, Ellipse, LinearGradient as SvgGradient, RadialGradient, Rect, Stop } from "react-native-svg";
import { useTheme } from "@/context/ThemeContext";

/**
 * Glass look for cards. Put it as the FIRST child of a card that has
 * `backgroundColor: theme.cardGlass` (see-through), `overflow: "hidden"` and
 * `zIndex: 0`. It paints UNDER the card's content (zIndex -1; the card's
 * zIndex 0 makes this work on web too, where absolutely-positioned layers
 * would otherwise cover in-flow icons):
 *   • light falling from above — a soft glow near the top edge plus a vertical
 *     sheen that fades out by the middle of the card;
 *   • a glass edge — a bright rim at the top-left fading along the sides, with
 *     a faint reflection at the bottom-right. The card's own border stays.
 */
export default function MatteGlass({ radius = 22 }: { radius?: number }) {
  const { themeMode } = useTheme();
  const dark = themeMode === "dark";
  const [size, setSize] = useState({ w: 0, h: 0 });
  // Unique per card: a shared gradient id makes every SVG on web use the first one.
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width !== size.w || height !== size.h) setSize({ w: width, h: height });
  };
  const edge = 1.5;
  const { w, h } = size;
  return (
    <View
      pointerEvents="none"
      style={[styles.fill, { borderRadius: radius, overflow: "hidden", zIndex: -1 }]}
      onLayout={onLayout}
    >
      <LinearGradient
        colors={dark ? ["rgba(255,255,255,0.13)", "rgba(255,255,255,0.03)", "rgba(255,255,255,0)"] : ["rgba(255,255,255,0.95)", "rgba(255,255,255,0.35)", "rgba(255,255,255,0)"]}
        locations={[0, 0.35, 0.7]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.fill}
      />
      {w > 0 ? (
        <Svg width={w} height={h} style={styles.fill}>
          <Defs>
            <RadialGradient id={"glow" + uid} cx="50%" cy="50%" rx="50%" ry="50%">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity={dark ? 0.22 : 0.9} />
              <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
            </RadialGradient>
            <SvgGradient id={"rim" + uid} gradientUnits="userSpaceOnUse" x1={0} y1={0} x2={w} y2={h}>
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity={dark ? 0.55 : 1} />
              <Stop offset="0.35" stopColor="#FFFFFF" stopOpacity={dark ? 0.12 : 0.5} />
              <Stop offset="0.7" stopColor="#FFFFFF" stopOpacity={0} />
              <Stop offset="1" stopColor="#FFFFFF" stopOpacity={dark ? 0.18 : 0.7} />
            </SvgGradient>
          </Defs>
          {/* the light source: a wide soft glow just above the top-left third */}
          <Ellipse cx={w * 0.3} cy={0} rx={Math.max(120, w * 0.6)} ry={Math.min(90, h * 0.75)} fill={`url(#glow${uid})`} />
          <Rect
            x={edge / 2}
            y={edge / 2}
            width={w - edge}
            height={h - edge}
            rx={Math.max(0, radius - edge / 2)}
            ry={Math.max(0, radius - edge / 2)}
            fill="none"
            stroke={`url(#rim${uid})`}
            strokeWidth={edge}
          />
        </Svg>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
});
