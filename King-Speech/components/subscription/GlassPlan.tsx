// Premium paywall plans on the aurora: frosted-glass cards (blur + tinted
// gradient + grain + top sheen + hairline rim) and a compact matte «free» row.
import React from "react";
import { Image, Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { rs } from "@/lib/responsive";

const CREAM = "#FFF7F0";
export const APRICOT = "#FFDAB9";
const NOISE = require("@/assets/images/noise.png");

/** Frosted glass base: blur of the aurora + tint + grain + sheen + rim. */
function Glass({
  tint,
  radius,
  blur = 36,
  rim = "rgba(255,255,255,0.22)",
  style,
  children,
}: {
  tint: readonly [string, string, ...string[]];
  radius: number;
  blur?: number;
  rim?: string;
  style?: ViewStyle;
  children: React.ReactNode;
}) {
  return (
    <View style={[{ borderRadius: radius, overflow: "hidden" }, style]}>
      <BlurView
        intensity={blur}
        tint="dark"
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient colors={tint} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <Image source={NOISE} resizeMode="repeat" style={[StyleSheet.absoluteFill, { opacity: 0.07 }]} />
      {/* glass sheen: light from the top edge */}
      <LinearGradient
        pointerEvents="none"
        colors={["rgba(255,255,255,0.16)", "rgba(255,255,255,0)"]}
        locations={[0, 0.45]}
        style={StyleSheet.absoluteFill}
      />
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { borderRadius: radius, borderWidth: 1, borderColor: rim }]}
      />
      {children}
    </View>
  );
}

/** The free plan, small: matte dark glass, one line of what's included. */
export function FreePlanRow({ title, badge, price, note }: { title: string; badge: string; price: string; note: string }) {
  return (
    <Glass
      tint={["rgba(10,8,22,0.62)", "rgba(10,8,22,0.5)"]}
      radius={rs(20)}
      blur={28}
      rim="rgba(255,255,255,0.10)"
    >
      <View style={st.freeRow}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: rs(8) }}>
            <Text style={st.freeTitle}>{title}</Text>
            <View style={st.freeBadge}>
              <Text style={st.freeBadgeText}>{badge}</Text>
            </View>
          </View>
          <Text style={st.freeNote} numberOfLines={2}>
            {note}
          </Text>
        </View>
        <Text style={st.freePrice}>{price}</Text>
      </View>
    </Glass>
  );
}

type Period = "month" | "year";

export function GlassPlanCard({
  title,
  badge,
  sub,
  tint,
  accent,
  monthLabel,
  yearLabel,
  monthPrice,
  yearPrice,
  save,
  period,
  onPeriod,
  perMonth,
  items,
  cta,
  ctaColors,
  ctaText,
  onCta,
}: {
  title: string;
  badge: string;
  sub: string;
  tint: readonly [string, string, ...string[]];
  /** check marks / badge colour */
  accent: string;
  monthLabel: string;
  yearLabel: string;
  monthPrice: string;
  yearPrice: string;
  save: string;
  period: Period;
  onPeriod: (p: Period) => void;
  perMonth: string;
  items: { title: string; detail: string }[];
  cta: string;
  ctaColors: readonly [string, string, ...string[]];
  ctaText: string;
  onCta: () => void;
}) {
  const price = period === "year" ? yearPrice : monthPrice;
  return (
    <Glass tint={tint} radius={rs(28)} style={st.cardShadow}>
      <View style={st.card}>
        <View style={st.head}>
          <Text style={st.title}>{title}</Text>
          <View style={[st.badge, { borderColor: accent }]}>
            <Text style={[st.badgeText, { color: accent }]}>{badge}</Text>
          </View>
        </View>
        <Text style={st.sub}>{sub}</Text>

        <View style={st.tiles}>
          {(["month", "year"] as const).map((p) => {
            const on = period === p;
            return (
              <Pressable
                key={p}
                onPress={() => onPeriod(p)}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                style={({ pressed }) => [st.tile, on ? st.tileOn : st.tileOff, { opacity: pressed ? 0.85 : 1 }]}
              >
                <Text style={[st.tileLabel, { color: on ? "rgba(20,10,30,0.55)" : "rgba(255,247,240,0.6)" }]}>
                  {p === "month" ? monthLabel : yearLabel}
                </Text>
                <Text style={[st.tilePrice, { color: on ? "#140A1E" : CREAM }]}>
                  {p === "month" ? monthPrice : yearPrice}
                </Text>
                {p === "year" ? (
                  <View style={st.save}>
                    <Text style={st.saveText}>{save}</Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
        <Text style={st.perMonth}>{perMonth}</Text>

        <View style={st.items}>
          {items.map((it) => (
            <View key={it.title} style={st.item}>
              <View style={[st.dot, { backgroundColor: accent }]}>
                <Text style={st.dotTick}>✓</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={st.itemTitle}>{it.title}</Text>
                {it.detail ? <Text style={st.itemDetail}>{it.detail}</Text> : null}
              </View>
            </View>
          ))}
        </View>

        <Pressable onPress={onCta} accessibilityRole="button" style={({ pressed }) => [{ opacity: pressed ? 0.88 : 1, transform: [{ scale: pressed ? 0.985 : 1 }] }]}>
          <LinearGradient colors={ctaColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={st.cta}>
            <Text style={[st.ctaText, { color: ctaText }]}>
              {cta} · {price}
            </Text>
          </LinearGradient>
        </Pressable>
      </View>
    </Glass>
  );
}

const st = StyleSheet.create({
  cardShadow: {
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
  },
  card: { padding: 20, paddingTop: 22 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  title: { fontSize: 28, letterSpacing: -0.4, color: CREAM, fontFamily: "Geologica_900Black", flexShrink: 1 },
  badge: { borderWidth: 1, borderRadius: 32, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 10.5, letterSpacing: 0.8, fontFamily: "Geologica_800ExtraBold" },
  sub: { marginTop: 6, fontSize: 14, lineHeight: 19, color: "rgba(255,247,240,0.72)", fontFamily: "Geologica_500Medium" },
  tiles: { flexDirection: "row", gap: 10, marginTop: 18 },
  tile: { flex: 1, height: 70, borderRadius: 20, paddingHorizontal: 14, justifyContent: "center" },
  tileOn: { backgroundColor: "#FFF7F0" },
  tileOff: { backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" },
  tileLabel: { fontSize: 11, letterSpacing: 0.6, fontFamily: "Geologica_800ExtraBold" },
  tilePrice: { marginTop: 3, fontSize: 21, letterSpacing: -0.2, fontFamily: "Geologica_900Black" },
  save: {
    position: "absolute",
    right: 10,
    top: 10,
    backgroundColor: APRICOT,
    borderRadius: 20,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  saveText: { fontSize: 11, color: "#140A1E", fontFamily: "Geologica_900Black" },
  perMonth: { marginTop: 9, fontSize: 12, color: "rgba(255,247,240,0.55)", fontFamily: "Geologica_600SemiBold" },
  items: { marginTop: 18, gap: 13 },
  item: { flexDirection: "row", alignItems: "flex-start", gap: 11 },
  dot: { width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center", marginTop: 1 },
  dotTick: { fontSize: 11, color: "#140A1E", fontFamily: "Geologica_900Black", marginTop: -1 },
  itemTitle: { fontSize: 15, lineHeight: 20, color: CREAM, fontFamily: "Geologica_700Bold" },
  itemDetail: { marginTop: 2, fontSize: 12.5, lineHeight: 17, color: "rgba(255,247,240,0.62)", fontFamily: "Geologica_500Medium" },
  cta: { marginTop: 22, height: 58, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  ctaText: { fontSize: 17, letterSpacing: -0.1, fontFamily: "Geologica_900Black" },

  freeRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 18, paddingVertical: 14, gap: 12 },
  freeTitle: { fontSize: 16, color: CREAM, fontFamily: "Geologica_800ExtraBold" },
  freeBadge: { backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  freeBadgeText: { fontSize: 9.5, letterSpacing: 0.7, color: "rgba(255,247,240,0.75)", fontFamily: "Geologica_800ExtraBold" },
  freeNote: { marginTop: 4, fontSize: 12, lineHeight: 16, color: "rgba(255,247,240,0.55)", fontFamily: "Geologica_500Medium" },
  freePrice: { fontSize: 22, color: CREAM, fontFamily: "Geologica_900Black" },
});
