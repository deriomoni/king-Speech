import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  ZoomIn,
} from "react-native-reanimated";
import { SvgXml } from "react-native-svg";
import * as Haptics from "@/lib/haptics";
import { useTheme } from "@/context/ThemeContext";
import { pickLang, type Lang } from "@/context/LangContext";
import { warmupFonts } from "@/components/warmup/warmupTheme";
import { rs } from "@/lib/responsive";
import {
  type WarmupArt,
  chestArt,
  chestArrowArt,
  tubeLeftArt,
  tubeRightArt,
  arrowLeftArt,
  arrowRightArt,
  corkArt,
  circle1Art,
  circle2Art,
  circle3Art,
  circle4Art,
} from "@/assets/figma/warmup/warmupIllustrations";

/**
 * The illustrated mouth warm-up (Figma «02 · Уровень 1 · Разогрев», the line-art
 * portraits in assets/figma/warmup). The portraits are used exactly as drawn;
 * the animation is the rhythm: frames cross-fade beat by beat, the gold arrow
 * shows the direction, and the beat word under the portrait («влево» /
 * «вправо», «раз-два-три-четыре», «вдох» / «ммм») tells the user when to move,
 * so they can repeat in sync.
 */

export type LText = { ru: string; en?: string; kk?: string };

interface Beat {
  /** Index into `frames`. */
  frame: number;
  /** Word shown in rhythm under the portrait. */
  label?: LText;
  sec: number;
  /** Chest exercise: animate the sound arrow on this beat. */
  sound?: boolean;
}

export interface IllustratedExercise {
  key: string;
  title: LText;
  /** One short how-to line. */
  desc: LText;
  frames: WarmupArt[];
  /** Gold direction arrow under the portrait, per frame (tube to the side). */
  arrows?: (WarmupArt | undefined)[];
  /** Chest-sound arrow drawn over the figure. */
  chestArrow?: boolean;
  /** Phrase to say (cork exercise). */
  phrase?: LText;
  beats: Beat[];
  /** Exercise length in the warm-up level, seconds. */
  totalSec: number;
}

const L = (ru: string, en: string, kk: string): LText => ({ ru, en, kk });

export const ILLUSTRATED_EXERCISES: IllustratedExercise[] = [
  {
    key: "chest",
    title: L("Звук из груди", "Sound from the chest", "Дыбыс кеудеден"),
    desc: L(
      "Ладонь на грудь. Вдох — и тяни «ммм», чувствуя вибрацию.",
      "Hand on your chest. Breathe in, then hum «mmm» and feel it vibrate.",
      "Алақаныңызды кеудеңізге қойыңыз. Дем алып, «ммм» деп созыңыз — дірілді сезініңіз.",
    ),
    frames: [chestArt],
    chestArrow: true,
    beats: [
      { frame: 0, label: L("вдох", "breathe in", "дем алыңыз"), sec: 2 },
      { frame: 0, label: L("ммм", "mmm", "ммм"), sec: 4, sound: true },
    ],
    totalSec: 18,
  },
  {
    key: "tubeSide",
    title: L("Трубочка в сторону", "Lip tube to the side", "Түтікше жанға"),
    desc: L(
      "Вытяни губы трубочкой и уводи их влево и вправо.",
      "Push your lips into a tube and move them left and right.",
      "Ерніңізді түтікше етіп созып, солға және оңға жылжытыңыз.",
    ),
    frames: [tubeLeftArt, tubeRightArt],
    arrows: [arrowLeftArt, arrowRightArt],
    beats: [
      { frame: 0, label: L("влево", "left", "солға"), sec: 1.5 },
      { frame: 1, label: L("вправо", "right", "оңға"), sec: 1.5 },
    ],
    totalSec: 24,
  },
  {
    key: "cork",
    title: L("Речь с пробкой", "Speaking with a cork", "Тығынмен сөйлеу"),
    desc: L(
      "Зажми пробку губами и чётко проговаривай фразу.",
      "Hold a cork between your lips and say the phrase clearly.",
      "Тығынды ерніңізбен қысып, сөйлемді анық айтыңыз.",
    ),
    frames: [corkArt],
    phrase: L(
      "Шла Саша по шоссе и сосала сушку",
      "She sells seashells by the seashore",
      "Шеше, шеше, неше кесе сынды кеше?", // folk twister (assets/content/kk/tonguetwisters_kk.json)
    ),
    beats: [{ frame: 0, sec: 20 }],
    totalSec: 20,
  },
  {
    key: "tongueCircle",
    title: L("Язык по кругу", "Tongue circles", "Тілді айналдыру"),
    desc: L(
      "Губы сомкнуты. Води языком по кругу по часовой стрелке.",
      "Lips closed. Circle your tongue clockwise.",
      "Ерін жабық. Тіліңізді сағат тілі бағытымен айналдырыңыз.",
    ),
    frames: [circle1Art, circle2Art, circle3Art, circle4Art],
    beats: [
      { frame: 0, label: L("раз", "one", "бір"), sec: 1 },
      { frame: 1, label: L("два", "two", "екі"), sec: 1 },
      { frame: 2, label: L("три", "three", "үш"), sec: 1 },
      { frame: 3, label: L("четыре", "four", "төрт"), sec: 1 },
    ],
    totalSec: 20,
  },
];

export const getIllustrated = (key: string) => ILLUSTRATED_EXERCISES.find((e) => e.key === key)!;

// Figma: the chest arrow starts 46.8pt below the top of the figure frame.
const CHEST_ARROW_TOP = 46.8;

/** One portrait frame that cross-fades in/out. */
function Frame({ art, active, w, h, color }: { art: WarmupArt; active: boolean; w: number; h: number; color: string }) {
  const o = useSharedValue(active ? 1 : 0);
  useEffect(() => {
    o.value = withTiming(active ? 1 : 0, { duration: 280, easing: Easing.out(Easing.quad) });
  }, [active, o]);
  const st = useAnimatedStyle(() => ({ opacity: o.value }));
  return (
    <Animated.View style={[StyleSheet.absoluteFill, st]}>
      <SvgXml xml={art.xml} width={w} height={h} color={color} />
    </Animated.View>
  );
}

interface Props {
  exercise: IllustratedExercise;
  lang: Lang;
  /** Portrait height, pt (already scaled). */
  height: number;
  /** Total run time, s (defaults to exercise.totalSec). */
  seconds?: number;
  onDone?: () => void;
}

/**
 * Plays one illustrated exercise: portrait + rhythm word + progress bar.
 * Calls onDone after `seconds`.
 */
export default function IllustratedDrill({ exercise, lang, height, seconds, onDone }: Props) {
  const { theme } = useTheme();
  const [beat, setBeat] = useState(0);
  const [tick, setTick] = useState(0); // changes every beat → re-pops the label
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  const total = seconds ?? exercise.totalSec;
  const prog = useSharedValue(0);

  // Beat clock + overall timer.
  useEffect(() => {
    setBeat(0);
    setTick(0);
    prog.value = 0;
    prog.value = withTiming(1, { duration: total * 1000, easing: Easing.linear });
    let i = 0;
    let to: ReturnType<typeof setTimeout>;
    const next = () => {
      to = setTimeout(() => {
        i = (i + 1) % exercise.beats.length;
        setBeat(i);
        setTick((t) => t + 1);
        if (exercise.beats.length > 1) Haptics.selectionAsync().catch(() => {});
        next();
      }, exercise.beats[i].sec * 1000);
    };
    next();
    const done = setTimeout(() => onDoneRef.current?.(), total * 1000);
    return () => {
      clearTimeout(to);
      clearTimeout(done);
      cancelAnimation(prog);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercise, total]);

  const b = exercise.beats[beat] ?? exercise.beats[0];
  const art0 = exercise.frames[0];
  const scale = height / art0.height;
  const w = art0.width * scale;
  const h = height;

  // Chest: the gold arrow rises and fades while the sound is held.
  const rise = useSharedValue(0);
  useEffect(() => {
    if (!exercise.chestArrow) return;
    if (b.sound) {
      rise.value = 0;
      rise.value = withRepeat(
        withSequence(withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.quad) }), withTiming(0, { duration: 0 })),
        -1,
      );
    } else {
      cancelAnimation(rise);
      rise.value = withTiming(0, { duration: 200 });
    }
  }, [b.sound, exercise.chestArrow, rise]);
  const riseDist = rs(18);
  const arrowStyle = useAnimatedStyle(() => ({
    opacity: b.sound ? 0.35 + 0.65 * (1 - Math.abs(rise.value - 0.5) * 2) : 0.25,
    transform: [{ translateY: -rise.value * riseDist }],
  }));

  // Static portraits (cork) breathe very slightly so the screen isn't frozen.
  const breathe = useSharedValue(0);
  useEffect(() => {
    breathe.value = withRepeat(withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => cancelAnimation(breathe);
  }, [breathe]);
  const stillOnly = exercise.frames.length === 1 && !exercise.chestArrow;
  const breatheStyle = useAnimatedStyle(() => ({
    transform: [{ scale: stillOnly ? 1 + breathe.value * 0.015 : 1 }],
  }));

  const barStyle = useAnimatedStyle(() => ({ width: `${prog.value * 100}%` as any }));
  const hasArrows = !!exercise.arrows;
  const arrowW = useMemo(() => (exercise.arrows?.[0] ? rs(exercise.arrows[0].width) : 0), [exercise]);

  return (
    <View style={styles.wrap}>
      <Animated.View style={[{ width: w, height: h }, breatheStyle]}>
        {exercise.frames.map((art, k) => (
          <Frame key={k} art={art} active={k === b.frame} w={w} h={h} color={theme.text} />
        ))}
        {exercise.chestArrow && (
          <Animated.View
            style={[
              styles.abs,
              { top: CHEST_ARROW_TOP * scale, left: (w - chestArrowArt.width * scale) / 2 },
              arrowStyle,
            ]}
          >
            <SvgXml xml={chestArrowArt.xml} width={chestArrowArt.width * scale} height={chestArrowArt.height * scale} />
          </Animated.View>
        )}
      </Animated.View>

      {hasArrows && (
        <View style={[styles.arrowSlot, { width: arrowW }]}>
          {exercise.arrows!.map((a, k) =>
            a ? (
              <View key={k} style={[styles.abs, { opacity: k === b.frame ? 1 : 0 }]}>
                <SvgXml xml={a.xml} width={rs(a.width)} height={rs(a.height)} />
              </View>
            ) : null,
          )}
        </View>
      )}

      {exercise.phrase ? (
        <Text style={[styles.phrase, { color: theme.text }]}>«{pickLang(lang, exercise.phrase)}»</Text>
      ) : (
        <View style={styles.beatSlot}>
          {!!b.label && (
            <Animated.Text
              key={`beat-${tick}`}
              entering={ZoomIn.duration(260)}
              style={[styles.beat, { color: theme.accentInk }]}
            >
              {pickLang(lang, b.label)}
            </Animated.Text>
          )}
        </View>
      )}

      <View style={[styles.track, { backgroundColor: theme.text + "1F" }]}>
        <Animated.View style={[styles.fill, { backgroundColor: theme.accent }, barStyle]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center" },
  abs: { position: "absolute", top: 0, left: 0 },
  arrowSlot: { height: 22, marginTop: 14 },
  beatSlot: { height: 38, marginTop: 18, justifyContent: "center" },
  beat: { fontFamily: warmupFonts.title, fontSize: 28, letterSpacing: -0.3 },
  phrase: {
    fontFamily: warmupFonts.title,
    fontSize: 20,
    lineHeight: 26,
    textAlign: "center",
    marginTop: 18,
    maxWidth: 300,
  },
  track: { width: 200, height: 5, borderRadius: 3, marginTop: 16, overflow: "hidden" },
  fill: { height: 5, borderRadius: 3 },
});
