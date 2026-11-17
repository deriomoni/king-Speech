import React, { useEffect } from "react";
import { View, Text, StyleSheet, Pressable, useWindowDimensions } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  withDelay,
  cancelAnimation,
  interpolate,
  Easing,
  Keyframe,
  ZoomIn,
  FadeIn,
  FadeInDown,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { SvgXml } from "react-native-svg";
import * as Haptics from "@/lib/haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import RiveAnim from "@/components/RiveAnim";
import {
  RAYS_SVG,
  TROPHY_GLOW_SVG,
  SWOOSH_SVG,
  PODIUM_SVG,
  TROPHY_SVG,
  STAR_ON_SVG,
  STAR_OFF_SVG,
  STAR_GLOW_SVG,
} from "@/assets/figma/victory/victorySvgs";

// ─────────────────────────────────────────────────────────────────────────────
// Level complete — Figma 510:3020 «Victory / Уровень пройден · v2».
// A violet arena: slowly turning sunburst, a gold trophy on a podium, three
// floating stars, falling confetti, a tilted white result card with a stamped
// «ПРОЙДЕНО!» sticker and a chunky gold 3D «Далее» button.
// Everything is laid out in artboard units (402×874) multiplied by `k` — real
// layout sizes, never a scale transform, so text and vectors render sharp.
// In-tree full-screen overlay (not a RN <Modal>) — see app/level/[id].tsx.
// ─────────────────────────────────────────────────────────────────────────────

const CONFETTI_RIVE = require("@/assets/rive/confetti.riv");

const ART_W = 402;
const ART_H = 874;
const INK = "#2A0A5E";
const GOLD = "#FFD857";
const GOLD_EDGE = "#C98A00";

// Confetti from the artboard: bits (12×6 slips), dots, streamers, sparkles.
const BITS: [number, number, number, string][] = [
  [40, 62, -30, "#FFD857"], [150, 96, 20, "#3DE0FF"], [330, 70, -40, "#7CFFB2"], [24, 196, -60, "#3DE0FF"],
  [352, 232, 35, "#FF4FA3"], [60, 300, -15, "#7CFFB2"], [350, 330, -70, "#FFD857"], [250, 58, -10, "#FF7A3D"],
  [190, 30, 50, "#7CFFB2"],
];
const DOTS: [number, number, string][] = [
  [100.5, 44.5, "#FF4FA3"], [376.5, 144.5, "#FF7A3D"], [304.5, 44.5, "#FFD857"], [26.5, 424.5, "#FFFFFF"], [384.5, 434.5, "#3DE0FF"],
];
// streamer: box (x, y, w, h) and its path in local coordinates
const STREAMERS: [number, number, number, number, string, string][] = [
  [66, 56, 30, 108, "M4 4C24 24 -6 44 14 64C29 79 14 94 26 104", "#FFD857"],
  [296, 136, 26, 94, "M22 4C4 22 34 36 16 54C4 66 20 80 10 90", "#3DE0FF"],
  [226, 48, 40, 48, "M4 4C24 16 14 36 36 44", "#FF4FA3"],
  [16, 286, 36, 50, "M4 4C20 16 14 36 32 46", "#7CFFB2"],
];
// sparkle: centre and size
const SPARKLES: [number, number, number][] = [[313, 263, 26], [85, 245, 18], [337, 387, 14], [66, 406, 12]];
const sparkleSvg = `<svg viewBox="0 0 26 26" xmlns="http://www.w3.org/2000/svg"><path d="M13 0C14.3 9.1 16.9 11.7 26 13C16.9 14.3 14.3 16.9 13 26C11.7 16.9 9.1 14.3 0 13C9.1 11.7 11.7 9.1 13 0Z" fill="#FFE98A"/></svg>`;
const streamerSvg = (w: number, h: number, d: string, c: string) =>
  `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg"><path d="${d}" stroke="${c}" stroke-width="4" stroke-linecap="round" fill="none"/></svg>`;

/** loop 0→1 forever, starting part-way through so pieces don't move in step */
function useLoop(duration: number, phase: number, ease = Easing.linear) {
  const p = useSharedValue(phase);
  useEffect(() => {
    p.value = withSequence(
      withTiming(1, { duration: duration * (1 - phase), easing: ease }),
      withRepeat(withSequence(withTiming(0, { duration: 0 }), withTiming(1, { duration, easing: ease })), -1, false),
    );
    return () => cancelAnimation(p);
  }, []);
  return p;
}

/** a confetti slip or dot drifting down from above its spot, tumbling, fading at both ends */
function FallingBit({ x, y, w, h, r, color, rot, i, u }: { x: number; y: number; w: number; h: number; r: number; color: string; rot: number; i: number; u: (n: number) => number }) {
  const k = u(1);
  const dur = 3600 + ((i * 937) % 2600);
  const p = useLoop(dur, ((i * 0.37) % 1));
  const spinDir = i % 2 ? 1 : -1;
  const st = useAnimatedStyle(() => {
    const v = p.value;
    return {
      opacity: interpolate(v, [0, 0.15, 0.8, 1], [0, 1, 1, 0]),
      transform: [
        { translateY: (-70 + v * 150) * k },
        { translateX: Math.sin(v * Math.PI * 2 + i) * 10 * k },
        { rotate: `${rot + spinDir * v * 540}deg` },
        { scaleY: Math.cos(v * Math.PI * 4 + i) }, // the slip flips over as it falls
      ],
    };
  });
  return (
    <Animated.View
      style={[{ position: "absolute", left: u(x), top: u(y), width: u(w), height: u(h), borderRadius: u(r), backgroundColor: color }, st]}
    />
  );
}

/** a streamer drifting down, swinging and turning as it falls */
function Streamer({ s, i, u }: { s: (typeof STREAMERS)[number]; i: number; u: (n: number) => number }) {
  const [x, y, w, h, d, c] = s;
  const k = u(1);
  const p = useLoop(5200 + i * 800, (i * 0.29 + 0.1) % 1);
  const st = useAnimatedStyle(() => {
    const v = p.value;
    return {
      opacity: interpolate(v, [0, 0.15, 0.8, 1], [0, 1, 1, 0]),
      transform: [
        { translateY: (-90 + v * 180) * k },
        { translateX: Math.sin(v * Math.PI * 2 + i) * 12 * k },
        { rotate: `${Math.sin(v * Math.PI * 3 + i) * 24}deg` },
      ],
    };
  });
  return (
    <Animated.View style={[{ position: "absolute", left: u(x), top: u(y), width: u(w), height: u(h) }, st]}>
      <SvgXml xml={streamerSvg(w, h, d, c)} width={u(w)} height={u(h)} />
    </Animated.View>
  );
}

/** a sparkle that twinkles and turns */
function Sparkle({ s, i, u }: { s: (typeof SPARKLES)[number]; i: number; u: (n: number) => number }) {
  const [cx, cy, size] = s;
  const p = useLoop(1800 + i * 350, (i * 0.31) % 1);
  const st = useAnimatedStyle(() => ({
    opacity: 0.35 + 0.65 * Math.abs(Math.sin(p.value * Math.PI)),
    transform: [{ rotate: `${p.value * 90}deg` }],
  }));
  return (
    <Animated.View style={[{ position: "absolute", left: u(cx - size / 2), top: u(cy - size / 2), width: u(size), height: u(size) }, st]}>
      <SvgXml xml={sparkleSvg} width={u(size)} height={u(size)} />
    </Animated.View>
  );
}

/** one of the three stars: pops in, then floats and rocks; lit ones glow and breathe */
function Star({ on, big, rot, delay, i, u }: { on: boolean; big?: boolean; rot: number; delay: number; i: number; u: (n: number) => number }) {
  const w = big ? 72 : 54;
  const h = big ? 70 : 52;
  const k = u(1);
  const p = useLoop(2400 + i * 300, (i * 0.33) % 1, Easing.inOut(Easing.sin));
  const float = useAnimatedStyle(() => ({
    transform: [
      { translateY: Math.sin(p.value * Math.PI * 2) * 4 * k },
      { rotate: `${rot + Math.sin(p.value * Math.PI * 2 + 0.8) * (on ? 7 : 4)}deg` },
    ],
  }));
  const glow = useAnimatedStyle(() => ({ opacity: 0.55 + 0.45 * Math.abs(Math.sin(p.value * Math.PI * 2)) }));
  return (
    <Animated.View entering={ZoomIn.delay(delay).springify().damping(8)}>
      <Animated.View style={[{ width: u(w), height: u(h) }, float]}>
        {on ? (
          <Animated.View style={[{ position: "absolute", left: u(w / 2 - 53), top: u(h / 2 - 53) }, glow]} pointerEvents="none">
            <SvgXml xml={STAR_GLOW_SVG} width={u(106)} height={u(106)} />
          </Animated.View>
        ) : null}
        <SvgXml xml={on ? STAR_ON_SVG : STAR_OFF_SVG} width={u(w)} height={u(h)} />
      </Animated.View>
    </Animated.View>
  );
}

/** the sticker slams down like a stamp: big and skewed → overshoot → settles */
const STAMP_IN = new Keyframe({
  0: { opacity: 0, transform: [{ scale: 2.3 }, { rotate: "-16deg" }] },
  55: { opacity: 1, transform: [{ scale: 0.88 }, { rotate: "2deg" }], easing: Easing.in(Easing.quad) },
  78: { opacity: 1, transform: [{ scale: 1.06 }, { rotate: "-1deg" }] },
  100: { opacity: 1, transform: [{ scale: 1 }, { rotate: "0deg" }], easing: Easing.out(Easing.quad) },
})
  .duration(620)
  .delay(1000);

export interface LevelCompleteModalProps {
  visible: boolean;
  levelTitle: string;
  xpEarned: number;
  avgScore: number;
  bestScore: number;
  durationSec: number;
  hasNext: boolean;
  onNext: () => void;
  onMap: () => void;
  onClose: () => void;
  colors?: unknown;
  isDark?: boolean;
  t: (key: any) => string;
  lang: "ru" | "en";
  roleBonus?: { emoji: string; title: string; onPlay: () => void } | null;
}

export default function LevelCompleteModal(props: LevelCompleteModalProps) {
  if (!props.visible) return null;
  return <VictoryScreen {...props} />;
}

function VictoryScreen({ bestScore, durationSec, onNext, onMap, t, lang }: LevelCompleteModalProps) {
  const insets = useSafeAreaInsets();
  const { width: W, height: H } = useWindowDimensions();
  const en = lang === "en";

  // artboard → screen: uniform fit, centred; u() turns artboard units into points
  const k = Math.min(W / ART_W, H / ART_H);
  const u = (n: number) => n * k;
  const offX = (W - ART_W * k) / 2;
  const offY = (H - ART_H * k) / 2;

  // the sunburst turns very slowly; the sticker gives a little wiggle now and then
  const spin = useSharedValue(0);
  const wiggle = useSharedValue(0);
  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    spin.value = withRepeat(withTiming(360, { duration: 90000, easing: Easing.linear }), -1, false);
    wiggle.value = withDelay(
      2200,
      withRepeat(
        withSequence(
          withTiming(5, { duration: 110 }),
          withTiming(-5, { duration: 140 }),
          withTiming(3, { duration: 120 }),
          withTiming(0, { duration: 120 }),
          withTiming(0, { duration: 2800 }),
        ),
        -1,
        false,
      ),
    );
    return () => { cancelAnimation(spin); cancelAnimation(wiggle); };
  }, []);
  const raysSpin = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value}deg` }] }));
  const badgeWiggle = useAnimatedStyle(() => ({ transform: [{ rotate: `${-3 + wiggle.value}deg` }] }));

  const score = Math.max(0, Math.min(10, bestScore || 0));
  const scoreStr = Number.isInteger(score) ? String(score) : score.toFixed(1);
  const timeStr = `${Math.floor(durationSec / 60)}:${String(Math.floor(durationSec % 60)).padStart(2, "0")}`;
  const stars = score >= 9 ? 3 : score >= 7 ? 2 : 1;
  const verdict =
    score >= 9.5
      ? en ? "PERFECT!" : "ИДЕАЛЬНО!"
      : score >= 8
        ? en ? "GREAT!" : "ОТЛИЧНО!"
        : score >= 6
          ? en ? "GOOD!" : "ХОРОШО!"
          : en ? "PASSED!" : "ПРОЙДЕНО!";

  // the swoosh stretches sideways to the screen edges (no gaps on wide phones)
  const SWOOSH_WIDE = SWOOSH_SVG.replace("<svg ", '<svg preserveAspectRatio="none" ');
  const at = (x: number, y: number) => ({ position: "absolute" as const, left: u(x), top: u(y) });
  // the result card and its sticker sit a little smaller than in the artboard
  const uc = (n: number) => u(n * 0.86);
  const atc = (x: number, y: number) => ({ position: "absolute" as const, left: uc(x), top: uc(y) });
  const ub = (n: number) => u(n * 0.85);
  const title = t("levelComplete");
  const TP = 30; // room for the glow around the letters
  const titleText = {
    width: u(340 + TP * 2),
    padding: u(TP),
    fontFamily: "Geologica_900Black",
    fontSize: u(54),
    lineHeight: u(52),
    letterSpacing: u(-0.81),
    textAlign: "center" as const,
  };

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: "#3A0FA8" }]}>
      <LinearGradient colors={["#B44BFF", "#7B2CF0", "#3A0FA8"]} locations={[0, 0.45, 1]} style={StyleSheet.absoluteFill} />
      {/* below the artboard the dark swoosh runs on to the screen edge */}
      <View style={{ position: "absolute", left: 0, right: 0, top: offY + u(ART_H) - 2, bottom: 0, backgroundColor: "#1C0552" }} />

      <View style={{ position: "absolute", left: offX, top: offY, width: u(ART_W), height: u(ART_H) }}>
        {/* Background · sunburst, glow, swoosh */}
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Animated.View style={[{ ...at(-899, -770), width: u(2200), height: u(2200) }, raysSpin]}>
            <SvgXml xml={RAYS_SVG} width={u(2200)} height={u(2200)} />
          </Animated.View>
          <View style={at(31, 160)}>
            <SvgXml xml={TROPHY_GLOW_SVG} width={u(340)} height={u(340)} />
          </View>
          <View style={{ position: "absolute", top: 0, left: -offX, width: W, height: u(ART_H) }}>
            <SvgXml xml={SWOOSH_WIDE} width={W} height={u(ART_H)} />
          </View>
        </View>

        {/* Confetti · falling, tumbling, swinging, twinkling */}
        <Animated.View entering={FadeIn.duration(600)} style={StyleSheet.absoluteFill} pointerEvents="none">
          {BITS.map(([x, y, rot, c], i) => (
            <FallingBit key={`b${i}`} x={x} y={y} w={12} h={6} r={1.5} color={c} rot={rot} i={i} u={u} />
          ))}
          {DOTS.map(([cx, cy, c], i) => (
            <FallingBit key={`d${i}`} x={cx - 4.5} y={cy - 4.5} w={9} h={9} r={4.5} color={c} rot={0} i={i + 20} u={u} />
          ))}
          {STREAMERS.map((s, i) => <Streamer key={`s${i}`} s={s} i={i} u={u} />)}
          {SPARKLES.map((s, i) => <Sparkle key={`k${i}`} s={s} i={i} u={u} />)}
        </Animated.View>
      </View>

      {/* Confetti burst (Rive) — under the title */}
      <View
        style={{ position: "absolute", top: 0, left: 0, right: 0, height: Math.max(210, insets.top + 180), overflow: "hidden" }}
        pointerEvents="none"
      >
        <RiveAnim
          source={CONFETTI_RIVE}
          autoplay
          fit="cover"
          style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 360, backgroundColor: "transparent", transform: [{ scale: 1.19 }] }}
        />
      </View>

      <View style={{ position: "absolute", left: offX, top: offY, width: u(ART_W), height: u(ART_H) }}>
        {/* Title · «Уровень пройден!», tilted, glow + solid purple drop */}
        <Animated.View
          entering={ZoomIn.springify().damping(11)}
          style={{ ...at(201 - 173.9, 74.37), width: u(347.8), height: u(133.2), alignItems: "center", justifyContent: "center" }}
        >
          <View style={{ transform: [{ rotate: "-5deg" }] }}>
            <Text style={[titleText, { position: "absolute", left: 0, top: u(5), color: "#4A12B8" }]}>{title}</Text>
            <Text
              style={[
                titleText,
                { color: "#FFFFFF", textShadowColor: "rgba(255,217,255,0.7)", textShadowOffset: { width: 0, height: 0 }, textShadowRadius: u(22) },
              ]}
            >
              {title}
            </Text>
          </View>
        </Animated.View>

        {/* Trophy on its podium */}
        <Animated.View entering={FadeInDown.delay(150).duration(500)} style={at(101, 414)}>
          <SvgXml xml={PODIUM_SVG} width={u(200)} height={u(92)} />
        </Animated.View>
        <Animated.View entering={ZoomIn.delay(250).springify().damping(10)} style={at(106, 216)}>
          <SvgXml xml={TROPHY_SVG} width={u(190)} height={u(210)} />
        </Animated.View>

        {/* Stars */}
        <View style={at(96, 535)}>
          <Star on={stars >= 1} rot={-10} delay={500} i={0} u={u} />
        </View>
        <View style={at(165, 508)}>
          <Star on={stars >= 2} big rot={0} delay={640} i={1} u={u} />
        </View>
        <View style={at(252, 535)}>
          <Star on={stars >= 3} rot={10} delay={780} i={2} u={u} />
        </View>

        {/* Result card · tilted white ticket with a solid purple underside */}
        <Animated.View
          entering={FadeInDown.delay(750).duration(450)}
          style={{ ...at(29.3, 602.31), width: u(343.4), height: u(129.5), alignItems: "center", justifyContent: "center" }}
        >
          <View style={{ width: uc(338), height: uc(120), transform: [{ rotate: "-3deg" }] }}>
            <View
              style={{
                position: "absolute", left: 0, right: 0, top: uc(8), height: uc(112), borderRadius: uc(30), backgroundColor: "#1A0548",
                shadowColor: "#1A004D", shadowOffset: { width: 0, height: uc(14) }, shadowOpacity: 0.35, shadowRadius: uc(15), elevation: 10,
              }}
            />
            <View style={{ position: "absolute", left: 0, top: 0, width: uc(338), height: uc(112), borderRadius: uc(30), backgroundColor: "#FFFFFF", elevation: 11 }}>
              <Text style={[s.label, { ...atc(28, 28), fontSize: uc(11), letterSpacing: uc(1.1) }]}>{en ? "SCORE" : "ОЦЕНКА"}</Text>
              <View style={{ ...atc(26, 42), flexDirection: "row", alignItems: "baseline" }}>
                <Text style={[s.value, { fontSize: uc(46), letterSpacing: uc(-0.92) }]}>{scoreStr}</Text>
                <Text style={[s.outOf, { fontSize: uc(18), marginLeft: uc(4) }]}>/10</Text>
              </View>
              <View style={{ ...atc(168, 26), width: uc(2), height: uc(62), borderRadius: 1, backgroundColor: "rgba(42,10,94,0.1)" }} />
              <Text style={[s.label, { ...atc(194, 28), fontSize: uc(11), letterSpacing: uc(1.1) }]}>{en ? "TIME" : "ВРЕМЯ"}</Text>
              <Text style={[s.value, { ...atc(192, 42), fontSize: uc(46), letterSpacing: uc(-0.92) }]}>{timeStr}</Text>
            </View>
          </View>
        </Animated.View>

        {/* «ПРОЙДЕНО!» sticker — stamped onto the card's top edge, wiggles now and then */}
        <View
          style={{ ...at(101, 597), width: u(200), height: u(42.75), alignItems: "center", justifyContent: "center" }}
          pointerEvents="none"
        >
          <Animated.View entering={STAMP_IN}>
            <Animated.View style={badgeWiggle}>
              <View style={{ position: "absolute", left: 0, right: 0, top: ub(3), bottom: ub(-3), borderRadius: ub(16), backgroundColor: GOLD_EDGE }} />
              <View
                style={{
                  backgroundColor: GOLD, borderWidth: ub(3), borderColor: "#FFFFFF", borderRadius: ub(16),
                  paddingHorizontal: ub(16), paddingVertical: ub(7),
                }}
              >
                <Text style={[s.badgeText, { fontSize: ub(13), letterSpacing: ub(0.78) }]}>{verdict}</Text>
              </View>
            </Animated.View>
          </Animated.View>
        </View>

        {/* CTA · gold 3D button: the face presses down onto its edge */}
        <Animated.View entering={FadeInDown.delay(1150).duration(450)} style={{ ...at(56, 758), width: u(290), height: u(58) }}>
          <Pressable onPress={onNext} style={{ flex: 1 }}>
            {({ pressed }) => (
              <>
                <View
                  style={{
                    position: "absolute", left: 0, right: 0, top: u(5), height: u(52), borderRadius: u(26), backgroundColor: GOLD_EDGE,
                    shadowColor: "#140040", shadowOffset: { width: 0, height: u(14) }, shadowOpacity: 0.5, shadowRadius: u(12), elevation: 10,
                  }}
                />
                <View
                  style={{
                    height: u(52), borderRadius: u(26), overflow: "hidden", alignItems: "center", justifyContent: "center", elevation: 11,
                    transform: [{ translateY: pressed ? u(4) : 0 }],
                  }}
                >
                  <LinearGradient colors={["#FFE27A", "#FFC92E"]} style={StyleSheet.absoluteFill} />
                  <View style={{ position: "absolute", left: u(14), right: u(14), top: 0, height: u(2), borderRadius: 1, backgroundColor: "rgba(255,255,255,0.6)" }} />
                  <Text style={[s.ctaText, { fontSize: u(17) }]}>{en ? "Next →" : "Далее →"}</Text>
                </View>
              </>
            )}
          </Pressable>
        </Animated.View>

        <Animated.View entering={FadeIn.delay(1400)} style={{ position: "absolute", left: 0, right: 0, top: u(830), alignItems: "center" }}>
          <Pressable onPress={onMap} hitSlop={12} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
            <Text style={[s.exit, { fontSize: u(15) }]}>{en ? "Exit" : "Выход"}</Text>
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  label: { fontFamily: "Geologica_700Bold", color: "rgba(42,10,94,0.5)" },
  value: { fontFamily: "Geologica_900Black", color: INK },
  outOf: { fontFamily: "Geologica_700Bold", color: "rgba(42,10,94,0.4)" },
  badgeText: { fontFamily: "Geologica_900Black", color: INK },
  ctaText: { fontFamily: "Geologica_800ExtraBold", color: INK },
  exit: { fontFamily: "Geologica_700Bold", color: "rgba(255,255,255,0.6)" },
});
