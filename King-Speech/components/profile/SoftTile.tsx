import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, Platform, type ViewStyle } from "react-native";
import { useTheme } from "@/context/ThemeContext";
import Svg, { Path } from "react-native-svg";
import * as Haptics from "@/lib/haptics";
import { rs } from "@/lib/responsive";
import type { TilePalette } from "@/components/profile/GlossTile";

// Profile bento tile: a solid colour card with the illustration, a title block
// and an optional action (↗ arrow or labelled pill).


export function ArrowUpRight({ color, size }: { color: string; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M7 17L17 7" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
      <Path d="M8.5 7H17V15.5" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}


export default function SoftTile({
  height,
  palette,
  title,
  sub,
  subLines = 1,
  titleSize = 16,
  band,
  art,
  cta,
  onPress,
  style,
  radius = 26,
  blob,
  textAt = "bottom",
  align = "left",
  badge,
}: {
  /** small outlined label (e.g. «Получите бесплатные монеты») */
  badge?: { text: string; left?: number; top?: number };
  /** one oversized rounded corner (design px radius) for an organic shape */
  blob?: { corner: "tl" | "tr" | "bl" | "br"; radius: number };
  /** where the title block sits */
  textAt?: "top" | "bottom";
  /** horizontal alignment of the title block */
  align?: "left" | "right";
  height: number;
  palette: TilePalette;
  title: string;
  sub: string;
  subLines?: number;
  titleSize?: number;
  /** height of the text area at the bottom (design px) */
  band: number;
  art?: React.ReactNode;
  /** "arrow" = round ↗ button top-right; { label } = pill in the band */
  cta?: "arrow" | { label: string };
  onPress: () => void;
  style?: ViewStyle;
  radius?: number;
}) {
  const { theme } = useTheme();
  const dark = theme.mode === "dark";
  // Solid colour tiles: ink comes from the palette (dark on light colours).
  const ink = palette.ink ?? (dark ? "#FFFFFF" : "#1F1E1D");
  const [size, setSize] = useState({ w: 0, h: 0 });
  const bandH = rs(band);
  const base = palette.color;
  const pill = typeof cta === "object";
  const gid = title.replace(/[^A-Za-z0-9]/g, "") || "t";

  const radii = {
    borderRadius: radius,
    ...(blob
      ? { [{ tl: "borderTopLeftRadius", tr: "borderTopRightRadius", bl: "borderBottomLeftRadius", br: "borderBottomRightRadius" }[blob.corner]]: rs(blob.radius) }
      : null),
  };

  return (
    <View style={[{ height: rs(height) }, style]}>
      <Pressable
        accessibilityRole="button"
        onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          onPress();
        }}
        style={({ pressed }) => [
          StyleSheet.absoluteFill,
          styles.tile,
          radii,
          { backgroundColor: base },
          pressed && { transform: [{ scale: 0.98 }] },
        ]}
      >
      {art}


      {/* Title block on the band */}
      <View
        pointerEvents="none"
        style={[
          styles.textBox,
          align === "right" && { left: rs(14), alignItems: "flex-end" },
          textAt === "top"
            ? { top: rs(14), right: cta === "arrow" ? rs(54) : rs(14) }
            : { bottom: 0, height: bandH, right: pill ? rs(96) : rs(14) },
        ]}
      >
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={[styles.title, { color: ink, fontSize: rs(titleSize), textAlign: align }]}>
          {title}
        </Text>
        <Text
          numberOfLines={subLines}
          style={[styles.sub, { textAlign: align, color: ink, fontSize: rs(titleSize * 0.72), lineHeight: rs(titleSize * 0.72 * 1.3) }]}
        >
          {sub}
        </Text>
      </View>

      {badge ? (
        <View
          pointerEvents="none"
          style={[styles.badge, { borderColor: ink, left: rs(badge.left ?? 14), top: rs(badge.top ?? 14) }]}
        >
          <Text numberOfLines={1} style={[styles.badgeText, { color: ink }]}>
            {badge.text}
          </Text>
        </View>
      ) : null}

      {!cta ? null : pill ? (
        <View pointerEvents="none" style={[styles.pill, { backgroundColor: ink + "1F", bottom: (bandH - rs(36)) / 2 }]}>
          <Text style={[styles.pillText, { color: ink }]}>{(cta as { label: string }).label}</Text>
          <ArrowUpRight color={ink} size={rs(15)} />
        </View>
      ) : (
        <View pointerEvents="none" style={[styles.round, { backgroundColor: ink + "1F" }]}>
          <ArrowUpRight color={ink} size={rs(16)} />
        </View>
      )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { overflow: "hidden" },
  rim: { borderWidth: 1, borderColor: "rgba(255,255,255,0.28)" },
  textBox: { position: "absolute", left: rs(14), justifyContent: "center" },
  title: { fontFamily: "Geologica_700Bold", letterSpacing: -0.3 },
  sub: { fontFamily: "Geologica_500Medium", opacity: 0.68, marginTop: rs(2) },
  round: {
    position: "absolute",
    top: rs(10),
    right: rs(10),
    width: rs(32),
    height: rs(32),
    borderRadius: rs(16),
    alignItems: "center",
    justifyContent: "center",
  },
  pill: {
    position: "absolute",
    right: rs(14),
    height: rs(36),
    paddingHorizontal: rs(14),
    borderRadius: rs(18),
    flexDirection: "row",
    alignItems: "center",
    gap: rs(6),
  },
  badge: {
    position: "absolute",
    height: rs(22),
    paddingHorizontal: rs(8),
    borderRadius: rs(11),
    borderWidth: 1.5,
    justifyContent: "center",
  },
  badgeText: { fontFamily: "Geologica_600SemiBold", fontSize: rs(10), letterSpacing: 0.1 },
  pillText: { fontFamily: "Geologica_700Bold", fontSize: rs(14) },
});
