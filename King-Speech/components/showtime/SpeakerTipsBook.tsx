import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  Platform,
  Dimensions,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  interpolate,
  Extrapolation,
  runOnJS,
  cancelAnimation,
  Easing,
  FadeIn,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

const { width: SW, height: SH } = Dimensions.get("window");

const GOLD = "#F5A623";
const GOLD_SOFT = "#E8C87A";
const INK = "#2B2115";
const INK_SOFT = "#6A5B44";

export interface BookTip {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  text: string;
}

interface Props {
  tips: BookTip[];
  title: string;
  accentColor: string;
  lang: "ru" | "en";
}

const haptic = (style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) => {
  if (Platform.OS !== "web") Haptics.impactAsync(style).catch(() => {});
};

export function SpeakerTipsBook({ tips, title, accentColor, lang }: Props) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(0);

  // Closed-cover idle float
  const float = useSharedValue(0);
  useEffect(() => {
    float.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 2200, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );
    return () => cancelAnimation(float);
  }, []);
  const floatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(float.value, [0, 1], [0, -5]) }],
  }));

  // Cover opening (inside modal)
  const coverOpen = useSharedValue(0);
  useEffect(() => {
    if (open) {
      coverOpen.value = 0;
      coverOpen.value = withTiming(1, { duration: 760, easing: Easing.out(Easing.cubic) });
    }
  }, [open]);
  const coverStyle = useAnimatedStyle(() => ({
    opacity: interpolate(coverOpen.value, [0.5, 0.92], [1, 0], Extrapolation.CLAMP),
    transform: [
      { perspective: 1600 },
      { rotateY: `${interpolate(coverOpen.value, [0, 1], [0, -172])}deg` },
    ],
  }));
  const spreadStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(coverOpen.value, [0, 1], [0.92, 1]) }],
    opacity: interpolate(coverOpen.value, [0, 0.35], [0.4, 1], Extrapolation.CLAMP),
  }));

  // Page turn
  const rotY = useSharedValue(0);
  const flipping = useRef(false);
  const clearFlip = () => {
    flipping.current = false;
  };
  const pageStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 1400 },
      { rotateY: `${rotY.value}deg` },
    ],
  }));
  const shadeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(Math.abs(rotY.value), [0, 90], [0, 0.55], Extrapolation.CLAMP),
  }));

  const goTo = (dir: 1 | -1) => {
    if (flipping.current) return;
    const target = page + dir;
    if (target < 0 || target >= tips.length) return;
    flipping.current = true;
    haptic();
    const mid = dir > 0 ? -90 : 90;
    rotY.value = withTiming(
      mid,
      { duration: 200, easing: Easing.in(Easing.quad) },
      (fin) => {
        "worklet";
        if (!fin) {
          runOnJS(clearFlip)();
          return;
        }
        runOnJS(setPage)(target);
        rotY.value = -mid;
        rotY.value = withTiming(
          0,
          { duration: 240, easing: Easing.out(Easing.quad) },
          (f2) => {
            "worklet";
            runOnJS(clearFlip)();
          },
        );
      },
    );
  };

  const openBook = () => {
    haptic(Haptics.ImpactFeedbackStyle.Medium);
    setPage(0);
    rotY.value = 0;
    setOpen(true);
  };
  const closeBook = () => {
    haptic();
    setOpen(false);
  };

  if (tips.length === 0) return null;

  const bookW = Math.min(SW * 0.9, 420);
  const bookH = Math.min(SH * 0.66, 560);
  const tip = tips[Math.max(0, Math.min(tips.length - 1, page))];

  const nTip = lang === "en" ? "tips" : "советов";

  return (
    <>
      {/* ---- Closed book (under the screen) ---- */}
      <Pressable onPress={openBook} accessibilityRole="button">
        {({ pressed }) => (
          <Animated.View style={floatStyle}>
            <View style={[cs.closed, pressed && { transform: [{ scale: 0.98 }] }]}>
              <LinearGradient
                colors={["#1A2748", "#111C36", "#0A1122"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              {/* spine */}
              <View style={cs.spine}>
                <View style={cs.spineLine} />
                <View style={cs.spineLine} />
              </View>
              {/* page edges on the right */}
              <View style={cs.pageEdges}>
                {[0, 1, 2, 3].map((i) => (
                  <View key={i} style={cs.pageEdge} />
                ))}
              </View>
              {/* gold frame + content */}
              <View style={cs.frame}>
                <View style={cs.emblem}>
                  <Ionicons name="bulb" size={18} color={GOLD} />
                </View>
                <Text style={cs.closedTitle} numberOfLines={2}>
                  {title}
                </Text>
                <View style={cs.closedRule} />
                <Text style={cs.closedSub}>
                  {tips.length} {nTip}
                </Text>
              </View>
              {/* bookmark ribbon */}
              <View style={cs.ribbon} />
              {/* tap hint */}
              <View style={cs.tapHint}>
                <Ionicons name="hand-left-outline" size={12} color="rgba(255,255,255,0.75)" />
                <Text style={cs.tapHintText}>
                  {lang === "en" ? "Tap to open" : "Нажми, чтобы открыть"}
                </Text>
              </View>
              {/* folded corner */}
              <View style={cs.corner} />
            </View>
          </Animated.View>
        )}
      </Pressable>

      {/* ---- Open book reader ---- */}
      <Modal visible={open} transparent statusBarTranslucent animationType="fade" onRequestClose={closeBook}>
        <View style={rs.backdrop}>
          <LinearGradient
            colors={["rgba(4,7,14,0.90)", "rgba(2,4,9,0.96)"]}
            style={StyleSheet.absoluteFill}
          />
          <Pressable style={StyleSheet.absoluteFill} onPress={closeBook} />

          <Animated.View style={[rs.book, spreadStyle, { width: bookW, height: bookH }]}>
            {/* left spine / page stack */}
            <View style={rs.leftStack}>
              <LinearGradient
                colors={["#0A1122", "#16223F"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
              {[0, 1, 2].map((i) => (
                <View key={i} style={[rs.stackEdge, { right: 3 + i * 3 }]} />
              ))}
            </View>

            {/* reading page */}
            <View style={rs.pageWrap}>
              <Animated.View style={[StyleSheet.absoluteFill, rs.page, pageStyle, { transformOrigin: "left" }]}>
                <LinearGradient
                  colors={["#FCF8EE", "#F3E8CE"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                {/* spine shading near the binding */}
                <LinearGradient
                  colors={["rgba(0,0,0,0.16)", "transparent"]}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 0.14, y: 0.5 }}
                  style={StyleSheet.absoluteFill}
                  pointerEvents="none"
                />

                <View style={rs.pageInner}>
                  <View style={rs.pageTop}>
                    <Text style={rs.pageNum}>
                      {String(page + 1).padStart(2, "0")}
                      <Text style={rs.pageNumTotal}> / {String(tips.length).padStart(2, "0")}</Text>
                    </Text>
                    <Text style={rs.chapter}>{title.toUpperCase()}</Text>
                  </View>

                  <View style={rs.pageBody}>
                    <View style={[rs.iconWrap, { borderColor: accentColor + "55", backgroundColor: accentColor + "12" }]}>
                      <Ionicons name={tip.icon} size={30} color={accentColor} />
                    </View>
                    <Text style={rs.tipTitle}>{tip.title}</Text>
                    <View style={rs.rule} />
                    <Text style={rs.tipText}>{tip.text}</Text>
                  </View>

                  <View style={rs.dots}>
                    {tips.map((_, i) => (
                      <View
                        key={i}
                        style={[
                          rs.dot,
                          i === page && { backgroundColor: GOLD, width: 18 },
                        ]}
                      />
                    ))}
                  </View>
                </View>

                {/* turn shading */}
                <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, shadeStyle]}>
                  <LinearGradient
                    colors={["rgba(0,0,0,0.35)", "rgba(0,0,0,0.05)"]}
                    start={{ x: 0, y: 0.5 }}
                    end={{ x: 1, y: 0.5 }}
                    style={StyleSheet.absoluteFill}
                  />
                </Animated.View>
              </Animated.View>

              {/* tap zones for turning */}
              <View style={rs.tapZones} pointerEvents="box-none">
                <Pressable style={rs.tapZone} onPress={() => goTo(-1)} />
                <Pressable style={rs.tapZone} onPress={() => goTo(1)} />
              </View>

              {/* front cover overlay (opens on mount) */}
              <Animated.View
                pointerEvents="none"
                style={[StyleSheet.absoluteFill, rs.coverOverlay, coverStyle, { transformOrigin: "left" }]}
              >
                <LinearGradient
                  colors={["#1A2748", "#111C36", "#0A1122"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <View style={rs.coverFrame}>
                  <View style={cs.emblem}>
                    <Ionicons name="bulb" size={20} color={GOLD} />
                  </View>
                  <Text style={rs.coverTitle} numberOfLines={2}>
                    {title}
                  </Text>
                  <View style={cs.closedRule} />
                </View>
              </Animated.View>
            </View>

            {/* nav bar */}
            <View style={rs.navBar} pointerEvents="box-none">
              <Pressable
                onPress={() => goTo(-1)}
                disabled={page === 0}
                style={[rs.navBtn, page === 0 && rs.navBtnOff]}
              >
                <Ionicons name="chevron-back" size={20} color={page === 0 ? "rgba(255,255,255,0.25)" : "#fff"} />
              </Pressable>
              <Pressable
                onPress={() => goTo(1)}
                disabled={page === tips.length - 1}
                style={[rs.navBtn, page === tips.length - 1 && rs.navBtnOff]}
              >
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={page === tips.length - 1 ? "rgba(255,255,255,0.25)" : "#fff"}
                />
              </Pressable>
            </View>
          </Animated.View>

          {/* close */}
          <Pressable style={rs.closeBtn} onPress={closeBook}>
            <Ionicons name="close" size={22} color="#fff" />
          </Pressable>
        </View>
      </Modal>
    </>
  );
}

const cs = StyleSheet.create({
  closed: {
    height: 176,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(245,166,35,0.28)",
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOpacity: 0.5, shadowRadius: 16, shadowOffset: { width: 0, height: 10 } },
      android: { elevation: 10 },
      default: {},
    }),
  },
  spine: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 20,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    gap: 5,
    paddingHorizontal: 6,
  },
  spineLine: { height: 1, backgroundColor: "rgba(245,166,35,0.4)" },
  pageEdges: { position: "absolute", right: 0, top: 8, bottom: 8, width: 8 },
  pageEdge: { flex: 1, borderRightWidth: 1, borderRightColor: "rgba(255,255,255,0.06)" },
  frame: {
    flex: 1,
    marginLeft: 20,
    margin: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(245,166,35,0.35)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    gap: 8,
  },
  emblem: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(245,166,35,0.5)",
    backgroundColor: "rgba(245,166,35,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  closedTitle: {
    color: GOLD_SOFT,
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    textAlign: "center",
    letterSpacing: 0.3,
  },
  closedRule: { width: 42, height: 2, borderRadius: 1, backgroundColor: GOLD },
  closedSub: { color: "rgba(255,255,255,0.5)", fontFamily: "Inter_400Regular", fontSize: 12 },
  ribbon: {
    position: "absolute",
    top: 0,
    right: 34,
    width: 12,
    height: 46,
    backgroundColor: "#C0392B",
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
  },
  tapHint: {
    position: "absolute",
    bottom: 10,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  tapHintText: { color: "rgba(255,255,255,0.75)", fontFamily: "Inter_500Medium", fontSize: 11 },
  corner: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 0,
    height: 0,
    borderStyle: "solid",
    borderRightWidth: 22,
    borderTopWidth: 22,
    borderRightColor: "rgba(245,166,35,0.18)",
    borderTopColor: "transparent",
  },
});

const rs = StyleSheet.create({
  backdrop: { flex: 1, alignItems: "center", justifyContent: "center" },
  book: {
    flexDirection: "row",
    borderRadius: 14,
    overflow: "hidden",
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOpacity: 0.6, shadowRadius: 30, shadowOffset: { width: 0, height: 18 } },
      android: { elevation: 24 },
      default: {},
    }),
  },
  leftStack: { width: 22, overflow: "hidden" },
  stackEdge: { position: "absolute", top: 6, bottom: 6, width: 1, backgroundColor: "rgba(255,255,255,0.08)" },
  pageWrap: { flex: 1, overflow: "hidden" },
  page: { overflow: "hidden" },
  pageInner: { flex: 1, paddingHorizontal: 22, paddingTop: 22, paddingBottom: 18 },
  pageTop: { alignItems: "center", gap: 4 },
  pageNum: { color: GOLD, fontFamily: "Inter_700Bold", fontSize: 22, letterSpacing: 1 },
  pageNumTotal: { color: INK_SOFT, fontFamily: "Inter_400Regular", fontSize: 13 },
  chapter: { color: INK_SOFT, fontFamily: "Inter_500Medium", fontSize: 9.5, letterSpacing: 2, textAlign: "center" },
  pageBody: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14 },
  iconWrap: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  tipTitle: {
    color: INK,
    fontFamily: Platform.select({ ios: "Times New Roman", android: "serif", default: "Georgia, serif" }),
    fontWeight: "700" as const,
    fontSize: 22,
    textAlign: "center",
  },
  rule: { width: 34, height: 2, borderRadius: 1, backgroundColor: GOLD },
  tipText: {
    color: "#4A3D28",
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    lineHeight: 24,
    textAlign: "center",
  },
  dots: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(43,33,21,0.2)" },
  tapZones: { ...StyleSheet.absoluteFillObject, flexDirection: "row" },
  tapZone: { flex: 1 },
  coverOverlay: {
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(245,166,35,0.3)",
    backfaceVisibility: "hidden",
  },
  coverFrame: {
    flex: 1,
    margin: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(245,166,35,0.4)",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 20,
  },
  coverTitle: {
    color: GOLD_SOFT,
    fontFamily: "Inter_700Bold",
    fontSize: 24,
    textAlign: "center",
    letterSpacing: 0.3,
  },
  navBar: {
    position: "absolute",
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 14,
  },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.35)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  navBtnOff: { opacity: 0.4 },
  closeBtn: {
    position: "absolute",
    top: Platform.OS === "web" ? 24 : 54,
    right: 20,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
});
