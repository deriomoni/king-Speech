import React, { useCallback, useEffect, useRef, useState } from "react";
import NextChevron from "@/components/NextChevron";
import { View, Text, Pressable, StyleSheet, Platform, Dimensions } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  Easing,
  cancelAnimation,
  FadeIn,
  FadeOut,
  FadeInDown,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Path } from "react-native-svg";
import * as Haptics from "@/lib/haptics";
import { warmupTheme, warmupFonts } from "@/components/warmup/warmupTheme";
import { useAppColors } from "@/hooks/useAppColors";
import { useTheme } from "@/context/ThemeContext";
import { useLang, pickLang } from "@/context/LangContext";
import { BreathingHelpDialog } from "@/components/warmup/WarmupHelpDialog";
import { rs } from "@/lib/responsive";
import { NoseIcon, MouthIcon } from "@/components/warmup/BreathIcons";

/**
 * Breathing warm-up — the first Разогрев task. A guided breathing drill
 * (inhale through the nose → short hold → exhale through the mouth) that
 * prepares the voice and calms nerves. Pure animation + timers; works on every
 * platform (no microphone, no native module). The canvas follows the app theme
 * (light in light mode, dark in dark mode).
 */

const CYCLES = 3;
type PhaseType = "inhale" | "hold" | "exhale";
interface Phase {
  type: PhaseType;
  label: { ru: string; en: string; kk: string };
  sec: number;
  via: { ru: string; en: string; kk: string };
  color: string;
}

// Figma (37:7848 / 37:7881 / 37:7905): every phase is gold — no purple/teal.
const C_INHALE = warmupTheme.gold;
const C_HOLD = warmupTheme.gold;
const C_EXHALE = warmupTheme.gold;

const PATTERN: Phase[] = [
  {
    type: "inhale",
    label: { ru: "Вдох", en: "Inhale", kk: "Дем алу" },
    sec: 3,
    via: { ru: "носом", en: "through the nose", kk: "мұрынмен" },
    color: C_INHALE,
  },
  {
    type: "hold",
    label: { ru: "Задержка", en: "Hold", kk: "Ұстау" },
    sec: 2,
    via: { ru: "держи", en: "hold it", kk: "ұстап тұрыңыз" },
    color: C_HOLD,
  },
  {
    type: "exhale",
    label: { ru: "Выдох", en: "Exhale", kk: "Дем шығару" },
    sec: 4,
    via: { ru: "ртом", en: "through the mouth", kk: "ауызбен" },
    color: C_EXHALE,
  },
];
const PHASES = Array.from({ length: CYCLES }).flatMap(() => PATTERN);

const MIN_SCALE = 0.62;
const MAX_SCALE = 1;

function haptic() {
  if (Platform.OS !== "web") {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }
}

const SCREEN_H = Dimensions.get("window").height;

// ── Custom breathing icons — colorable silhouettes ───────────────────────────
const BUTTERFLY_PATH =
  "M247.959 315.211C247.849 315.521 247.599 316.381 247.319 317.401C237.549 352.811 219.549 385.441 197.709 407.291C179.589 425.411 159.509 435.761 137.759 438.181C134.339 438.561 132.749 438.631 128.109 438.631C122.989 438.631 121.469 438.551 117.609 438.031C107.369 436.651 105.679 436.551 103.499 437.191C99.5988 438.351 96.1688 440.311 89.7088 445.071C82.6788 450.261 78.9288 452.381 75.4088 453.141C74.6888 453.291 72.1388 453.421 71.6088 453.331C71.4688 453.301 71.0288 453.231 70.6188 453.171C68.2988 452.831 65.8488 451.631 64.3088 450.091C61.2888 447.081 60.9388 442.971 63.2088 437.281C64.4288 434.231 66.0888 431.301 69.9388 425.381C74.9188 417.741 76.4088 414.111 76.4088 409.581C76.4088 406.571 75.9588 404.831 73.5388 398.381C71.5788 393.171 71.2688 392.261 70.7088 389.931C64.0188 362.361 71.1188 330.911 90.1688 303.761C106.309 280.751 128.579 264.271 156.109 254.971C158.379 254.201 162.789 252.841 164.489 252.381C164.939 252.261 165.299 252.151 165.279 252.131C165.269 252.111 164.649 251.931 163.909 251.731C132.479 243.291 111.789 234.281 92.0588 220.431C49.3288 190.451 19.0288 142.261 6.7688 84.7806C3.7288 70.5306 1.9888 56.9206 1.5988 44.2306C1.0488 26.6706 2.8288 12.2906 6.0988 7.8106C8.0388 5.1506 16.0488 3.1406 29.4588 1.9406C36.7588 1.2806 42.9988 1.3606 51.1088 2.1906C80.7088 5.2406 110.049 16.2406 137.359 34.5306C172.259 57.9106 202.179 92.2806 222.159 131.931C230.969 149.441 237.859 169.091 242.609 190.281C243.239 193.071 243.779 194.871 244.909 197.881C245.889 200.531 247.629 204.861 247.959 205.501C248.279 204.861 250.019 200.531 251.009 197.881C252.139 194.871 252.679 193.071 253.299 190.281C258.049 169.091 264.939 149.441 273.759 131.931C293.729 92.2806 323.659 57.9106 358.559 34.5306C385.869 16.2406 415.209 5.2406 444.809 2.1906C452.919 1.3606 459.159 1.2806 466.459 1.9406C479.869 3.1406 487.879 5.1506 489.819 7.8106C493.089 12.2906 494.869 26.6706 494.319 44.2306C493.919 56.9206 492.189 70.5306 489.149 84.7806C476.889 142.261 446.589 190.451 403.859 220.431C384.119 234.281 363.439 243.291 332.009 251.731C331.269 251.931 330.649 252.111 330.629 252.131C330.609 252.151 330.969 252.261 331.429 252.381C333.129 252.841 337.539 254.201 339.809 254.971C367.329 264.271 389.599 280.751 405.739 303.761C424.789 330.911 431.899 362.361 425.209 389.931C424.639 392.261 424.339 393.171 422.379 398.381C419.949 404.831 419.509 406.571 419.509 409.581C419.509 414.111 420.999 417.741 425.969 425.381C429.829 431.301 431.489 434.231 432.709 437.281C434.979 442.971 434.619 447.081 431.609 450.091C430.069 451.631 427.609 452.831 425.299 453.171C424.889 453.231 424.449 453.301 424.309 453.331C423.779 453.421 421.219 453.291 420.509 453.141C416.989 452.381 413.239 450.261 406.199 445.071C399.749 440.311 396.319 438.351 392.409 437.191C390.239 436.551 388.549 436.651 378.309 438.031C374.449 438.551 372.919 438.631 367.809 438.631C363.169 438.631 361.579 438.561 358.159 438.181C336.399 435.761 316.319 425.411 298.209 407.291C276.369 385.441 258.359 352.811 248.599 317.401C248.319 316.381 248.059 315.521 247.959 315.211ZM247.959 220.861C247.819 220.761 247.669 220.671 247.529 220.571C243.429 217.781 237.889 204.691 233.659 187.781C216.579 119.561 169.549 59.0806 110.309 29.1406C92.1088 19.9406 70.4688 13.3306 51.7088 11.2406C36.9788 9.6006 24.4888 10.4206 13.5088 13.7606C13.0888 13.8906 12.6688 14.0106 12.2588 14.1406C12.1688 14.7406 12.0788 15.3406 11.9788 15.9406C9.2888 33.6006 9.5888 49.9306 12.9588 70.4606C21.7888 124.151 46.3088 170.361 82.4888 201.461C100.409 216.871 120.219 228.261 143.209 236.381C149.289 238.541 149.719 238.661 160.059 241.281C180.339 246.431 188.239 248.741 190.149 250.061C190.649 250.411 191.179 251.351 191.259 252.051C191.619 254.871 188.469 256.171 174.159 259.091C168.359 260.271 167.249 260.551 163.199 261.791C138.419 269.381 117.429 283.551 101.559 303.381C82.7588 326.891 74.1588 354.681 77.6588 380.631C78.2088 384.711 78.9988 387.691 81.2588 394.281C84.0988 402.561 84.8488 405.991 84.8488 410.781C84.8588 414.471 84.1588 417.211 82.2088 421.231C80.9988 423.721 79.8288 425.651 75.6988 431.981C72.5488 436.821 70.9388 439.961 70.1988 442.661C69.9788 443.461 69.9788 443.491 70.1588 443.691C70.8588 444.461 72.2288 444.761 73.7088 444.441C76.3388 443.881 79.0188 442.331 84.7188 438.071C88.5488 435.211 88.7388 435.081 91.6088 433.481C98.1988 429.811 101.219 428.651 105.209 428.291C107.949 428.041 110.049 428.191 116.109 429.081C125.189 430.401 134.289 430.181 143.099 428.431C164.639 424.131 185.039 410.501 202.499 388.731C218.879 368.321 231.479 342.641 239.559 313.231C240.209 310.871 243.439 297.961 243.809 296.261C244.329 293.881 245.909 292.411 247.959 292.381C250.009 292.411 251.589 293.881 252.109 296.261C252.469 297.961 255.709 310.871 256.359 313.231C264.439 342.641 277.039 368.321 293.409 388.731C310.869 410.501 331.279 424.131 352.819 428.431C361.619 430.181 370.729 430.401 379.809 429.081C385.869 428.191 387.969 428.041 390.709 428.291C394.689 428.651 397.709 429.811 404.309 433.481C407.179 435.081 407.359 435.211 411.199 438.071C416.899 442.331 419.579 443.881 422.209 444.441C423.679 444.761 425.049 444.461 425.759 443.691C425.929 443.491 425.929 443.461 425.719 442.661C424.979 439.961 423.359 436.821 420.209 431.981C416.089 425.651 414.919 423.721 413.709 421.231C411.749 417.211 411.059 414.471 411.069 410.781C411.069 405.991 411.819 402.561 414.659 394.281C416.919 387.691 417.709 384.711 418.259 380.631C421.749 354.681 413.159 326.891 394.359 303.381C378.489 283.551 357.489 269.381 332.719 261.791C328.669 260.551 327.559 260.271 321.759 259.091C307.449 256.171 304.299 254.871 304.649 252.051C304.739 251.351 305.269 250.411 305.769 250.061C307.679 248.741 315.569 246.431 335.859 241.281C346.199 238.661 346.619 238.541 352.709 236.381C375.699 228.261 395.499 216.871 413.429 201.461C449.599 170.361 474.129 124.151 482.949 70.4606C486.329 49.9306 486.619 33.6006 483.929 15.9406C483.839 15.3406 483.749 14.7406 483.659 14.1406C483.239 14.0106 482.819 13.8906 482.409 13.7606C471.429 10.4206 458.939 9.6006 444.209 11.2406C425.439 13.3306 403.809 19.9406 385.609 29.1406C326.359 59.0806 279.329 119.561 262.259 187.781C258.029 204.691 252.489 217.781 248.379 220.571C248.239 220.671 248.099 220.761 247.959 220.861Z";
function Butterfly({ color, size }: { color: string; size: number }) {
  return (
    <Svg width={size} height={Math.round(size * (455 / 496))} viewBox="0 0 496 455">
      <Path
        d={BUTTERFLY_PATH}
        fill={color}
        fillRule="evenodd"
        clipRule="evenodd"
        stroke={color}
        strokeWidth={5}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default function BreathingExerciseView({
  topPad,
  moduleColor,
  onComplete,
  onBack,
}: {
  topPad: number;
  moduleColor?: string;
  bg?: string;
  onComplete: () => void;
  onBack: () => void;
}) {
  const { colors } = useAppColors();
  const { theme } = useTheme();
  const { lang } = useLang();
  const [running, setRunning] = useState(false);
  const [idx, setIdx] = useState(0);
  const [count, setCount] = useState(PATTERN[0].sec);
  const [showHelp, setShowHelp] = useState(false);
  const scale = useSharedValue(MIN_SCALE);

  // Nose/mouth cue icons breathe with an opacity pulse synced to the phase:
  // darken over the first half, lighten over the second (opacity, NOT scale, so
  // the vector never rasterizes). Driven from the phase effect below.
  const iconPulse = useSharedValue(1);
  const [centerBox, setCenterBox] = useState({ y: 0, h: 0 });
  useEffect(() => () => cancelAnimation(iconPulse), [iconPulse]);
  const iconPulseStyle = useAnimatedStyle(() => ({ opacity: iconPulse.value }));

  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (!running) return;
    if (idx >= PHASES.length) {
      setRunning(false);
      haptic();
      onCompleteRef.current();
      return;
    }
    const phase = PHASES[idx];
    setCount(phase.sec);
    haptic();
    if (phase.type === "inhale") {
      scale.value = withTiming(MAX_SCALE, { duration: phase.sec * 1000, easing: Easing.inOut(Easing.ease) });
    } else if (phase.type === "exhale") {
      scale.value = withTiming(MIN_SCALE, { duration: phase.sec * 1000, easing: Easing.inOut(Easing.ease) });
    }
    // Nose/mouth cue pulse is driven by the phase length: darken over the first
    // half of the cycle, lighten back over the second half — one full breath of
    // the icon per phase. (Opacity only, so the vector never rasterizes.)
    if (phase.type === "inhale" || phase.type === "exhale") {
      const half = (phase.sec / 2) * 1000;
      iconPulse.value = 1;
      iconPulse.value = withRepeat(
        withTiming(0.4, { duration: half, easing: Easing.inOut(Easing.ease) }),
        2,
        true,
      );
    }
    const ci = setInterval(() => setCount((c) => Math.max(0, c - 1)), 1000);
    const to = setTimeout(() => setIdx((i) => i + 1), phase.sec * 1000);
    return () => {
      clearInterval(ci);
      clearTimeout(to);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, idx]);

  useEffect(() => () => cancelAnimation(scale), [scale]);

  const start = useCallback(() => {
    setIdx(0);
    setCount(PATTERN[0].sec);
    scale.value = MIN_SCALE;
    setRunning(true);
  }, [scale]);

  const circleStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const phase = running ? PHASES[Math.min(idx, PHASES.length - 1)] : null;
  const cycle = Math.min(CYCLES, Math.floor(idx / PATTERN.length) + 1);
  const phaseColor = phase?.color ?? warmupTheme.gold;

  // Vertically center the cue icon between the cycle text (≈ top of the center
  // area) and the top of the 280px ring. Container is 90px tall and centered.
  const RING = rs(280);
  const breathIconTop =
    centerBox.h > 0
      ? centerBox.y + (centerBox.h - RING) / 4 - rs(45)
      : SCREEN_H * 0.26;

  return (
    <View style={[styles.root, { paddingTop: topPad + rs(8), backgroundColor: colors.background }]}>
      {/* Header: back + title + help */}
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={12} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={rs(24)} color={colors.textSecondary} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{pickLang(lang, { ru: "Дыхательная разминка", en: "Breathing warm-up", kk: "Тыныс жаттығуы" })}</Text>
        <Pressable onPress={() => setShowHelp(true)} hitSlop={12} style={styles.iconBtn}>
          <Ionicons name="help-circle-outline" size={rs(24)} color={colors.textSecondary} />
        </Pressable>
      </View>

      {/* Cycle indicator only while running — nothing under the title at start */}
      {running ? (
        <Text style={[styles.cycle, { color: colors.textMuted }]}>{pickLang(lang, { ru: `Цикл ${cycle} из ${CYCLES}`, en: `Cycle ${cycle} of ${CYCLES}`, kk: `${cycle}/${CYCLES} цикл` })}</Text>
      ) : (
        <View style={styles.cyclePlaceholder} />
      )}

      {/* Nose (inhale) / mouth (exhale) cue above the circle; nothing on hold */}
      {running && (phase?.type === "inhale" || phase?.type === "exhale") && (
        <Animated.View
          key={`breath-icon-${idx}`}
          entering={FadeIn.duration(240)}
          exiting={FadeOut.duration(160)}
          pointerEvents="none"
          style={[styles.breathIcon, { top: breathIconTop }]}
        >
          <Animated.View style={iconPulseStyle}>
            {phase?.type === "inhale" ? (
              <NoseIcon color={colors.text} size={rs(57)} />
            ) : (
              <MouthIcon color={colors.text} size={rs(68)} />
            )}
          </Animated.View>
        </Animated.View>
      )}

      <View
        style={styles.center}
        onLayout={(e) => {
          const { y, height } = e.nativeEvent.layout;
          setCenterBox((prev) => (prev.y === y && prev.h === height ? prev : { y, h: height }));
        }}
      >
        <View style={[styles.ring, { borderColor: phaseColor + "2E" }]} />
        <Animated.View
          style={[
            styles.circle,
            circleStyle,
            { backgroundColor: phaseColor + "22", borderColor: phaseColor },
          ]}
        >
          {running && phase ? (
            <>
              <Text style={[styles.phaseLabel, { color: theme.accentInk }]}>{pickLang(lang, phase.label)}</Text>
              <Text style={[styles.phaseCount, { color: theme.text }]}>{count}</Text>
              <Text style={[styles.phaseVia, { color: theme.accentInk }]}>{pickLang(lang, phase.via)}</Text>
            </>
          ) : (
            <Butterfly color={theme.accentInk} size={rs(113)} />
          )}
        </Animated.View>
      </View>

      <View style={styles.footer}>
        {!running ? (
          <Pressable
            onPress={start}
            style={({ pressed }) => [
              styles.cta,
              { backgroundColor: theme.accent, borderColor: theme.ctaStroke, opacity: pressed ? 0.9 : 1 },
            ]}
          >
            <Text style={[styles.ctaText, { color: theme.accentText }]}>{pickLang(lang, { ru: "Начать", en: "Start", kk: "Бастау" })}</Text>
          </Pressable>
        ) : (
          <Pressable onPress={onComplete} hitSlop={8} style={styles.skip}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: rs(6) }}><Text style={[styles.skipText, { color: colors.textMuted }]}>{pickLang(lang, { ru: "Пропустить", en: "Skip", kk: "Өткізіп жіберу" })}</Text><NextChevron color={colors.textMuted} size={rs(12)} /></View>
          </Pressable>
        )}
      </View>

      {/* Help (Figma 37:5023) */}
      <BreathingHelpDialog visible={showHelp} onClose={() => setShowHelp(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 22 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17, fontFamily: warmupFonts.title },
  cycle: {
    fontSize: 13,
    letterSpacing: 0.65,
    textAlign: "center",
    marginTop: 10,
    textTransform: "uppercase",
    fontFamily: warmupFonts.label,
  },
  cyclePlaceholder: { height: 23, marginTop: 10 },
  breathIcon: { position: "absolute", left: 0, right: 0, height: 90, alignItems: "center", justifyContent: "center", zIndex: 2 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  ring: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 140,
    borderWidth: 2,
  },
  circle: {
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 2.6,
    alignItems: "center",
    justifyContent: "center",
  },
  phaseLabel: { fontSize: 20, fontFamily: warmupFonts.label },
  phaseCount: { fontSize: 54, fontFamily: warmupFonts.digit, marginTop: 2 },
  phaseVia: { fontSize: 15, fontFamily: warmupFonts.body, marginTop: 2, textTransform: "lowercase" },
  footer: { paddingBottom: 28, alignItems: "center" },
  cta: {
    width: "100%",
    height: 54,
    borderRadius: 32,
    borderWidth: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: { fontSize: 16, fontFamily: warmupFonts.title },
  skip: { padding: 10 },
  skipText: { fontSize: 14, fontFamily: warmupFonts.body },
});
