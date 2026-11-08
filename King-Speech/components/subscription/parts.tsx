// Building blocks of the «Подписка · планы» screen (Figma 132:167).
import React from "react";
import { View, Text, StyleSheet, Pressable, type ViewStyle } from "react-native";
import { SvgXml } from "react-native-svg";
import {
  CHECK_FREE_SVG,
  CHECK_ROYAL_SVG,
  CHECK_EMPEROR_SVG,
} from "@/assets/figma/new/svgs";

export const INK = "#262628";
export const GOLD = "#FFD857";
export const CREAM = "#F0EEE9";

export type CheckTone = "free" | "royal" | "emperor";

const CHECK_XML: Record<CheckTone, string> = {
  free: CHECK_FREE_SVG,
  royal: CHECK_ROYAL_SVG,
  emperor: CHECK_EMPEROR_SVG,
};

/** Feature checklist — 28pt row pitch, 11×7.8 check, label at +22. */
export function Checklist({
  items,
  tone,
  color,
  trailing,
}: {
  items: string[];
  tone: CheckTone;
  color: string;
  /** Optional element rendered after the label of the last item (e.g. coin). */
  trailing?: React.ReactNode;
}) {
  return (
    <View style={{ gap: 10.5 }}>
      {items.map((it, i) => (
        <View key={it} style={s.checkRow}>
          {/* Figma check is 11×7.8 with 1.1pt stroke padding → 13.2×10 */}
          <View style={s.checkBox}>
            <SvgXml xml={CHECK_XML[tone]} width={13.2} height={10} />
          </View>
          <Text style={[s.checkText, { color }]}>{it}</Text>
          {trailing && i === items.length - 1 ? trailing : null}
        </View>
      ))}
    </View>
  );
}

export function Badge({
  label,
  bg,
  color,
  style,
}: {
  label: string;
  bg: string;
  color: string;
  style?: ViewStyle;
}) {
  return (
    <View style={[s.badge, { backgroundColor: bg }, style]}>
      <Text style={[s.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

/** Month / year price tile (157×70). */
export function PriceTile({
  label,
  price,
  selected,
  variant,
  save,
  onPress,
}: {
  label: string;
  price: string;
  selected: boolean;
  /** royal = gold card (selected → ink tile); emperor = dark card (selected → gold tile). */
  variant: "royal" | "emperor";
  save?: string;
  onPress: () => void;
}) {
  let box: ViewStyle;
  let labelColor: string;
  let priceColor: string;
  if (variant === "royal") {
    box = selected
      ? { backgroundColor: INK, borderColor: INK, borderWidth: 2 }
      : { backgroundColor: "rgba(38,38,40,0.08)", borderColor: "rgba(38,38,40,0.15)", borderWidth: 2 };
    labelColor = selected ? "rgba(255,216,87,0.85)" : "rgba(38,38,40,0.6)";
    priceColor = selected ? GOLD : INK;
  } else {
    box = selected
      ? { backgroundColor: GOLD, borderColor: "transparent", borderWidth: 4 }
      : { backgroundColor: "rgba(240,238,233,0.08)", borderColor: "rgba(240,238,233,0.15)", borderWidth: 2 };
    labelColor = selected ? "rgba(38,38,40,0.85)" : "rgba(240,238,233,0.6)";
    priceColor = selected ? INK : CREAM;
  }
  const thick = (box.borderWidth as number) === 4;
  const top = thick ? 10 : 11;
  const left = thick ? 12 : 13;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={({ pressed }) => [s.priceTile, box, { opacity: pressed ? 0.85 : 1 }]}
    >
      <Text style={[s.priceLabel, { color: labelColor, top, left }]}>
        {label}
      </Text>
      <Text style={[s.priceValue, { color: priceColor, top: top + 18, left }]}>
        {price}
      </Text>
      {save ? (
        <Badge
          label={save}
          bg={GOLD}
          color={INK}
          style={{ position: "absolute", left: 102, top: 10, paddingHorizontal: 7, paddingVertical: 2 }}
        />
      ) : null}
    </Pressable>
  );
}

/**
 * A plan card with its CTA "tray" peeking out from underneath — in Figma the
 * button is 88pt tall and starts 30pt above the card's bottom edge, so 58pt of
 * it is visible below the card.
 */
export function PlanWithTray({
  card,
  trayStyle,
  trayLabel,
  trayLabelColor,
  onTrayPress,
  disabled,
}: {
  card: React.ReactNode;
  trayStyle: ViewStyle;
  trayLabel: string;
  trayLabelColor: string;
  onTrayPress?: () => void;
  disabled?: boolean;
}) {
  return (
    <View style={{ paddingBottom: 58 }}>
      <Pressable
        onPress={onTrayPress}
        disabled={disabled}
        accessibilityRole="button"
        style={({ pressed }) => [s.tray, trayStyle, { opacity: pressed ? 0.85 : 1 }]}
      >
        <Text style={[s.trayText, { color: trayLabelColor }]}>{trayLabel}</Text>
      </Pressable>
      <View style={{ zIndex: 1 }}>{card}</View>
    </View>
  );
}

export const s = StyleSheet.create({
  checkRow: { flexDirection: "row", alignItems: "center", minHeight: 17.5 },
  checkBox: { width: 11, height: 7.8, alignItems: "center", justifyContent: "center", marginRight: 11 },
  checkText: { fontSize: 14, fontFamily: "Geologica_600SemiBold" },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 32,
    alignSelf: "flex-start",
  },
  badgeText: { fontSize: 11, fontFamily: "Geologica_900Black", letterSpacing: 0.55 },
  priceTile: { flex: 1, height: 70, borderRadius: 22, overflow: "hidden" },
  priceLabel: { position: "absolute", fontSize: 11, fontFamily: "Geologica_900Black", letterSpacing: 0.55 },
  priceValue: { position: "absolute", fontSize: 20, fontFamily: "Geologica_900Black", letterSpacing: -0.1 },
  tray: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 88,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: 20,
  },
  trayText: { fontSize: 17, fontFamily: "Geologica_900Black" },
});
