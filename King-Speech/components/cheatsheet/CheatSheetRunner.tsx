import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  ScrollView,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import NextChevron from "@/components/NextChevron";
import * as Haptics from "@/lib/haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSpring,
  Easing,
  cancelAnimation,
} from "react-native-reanimated";
import { fonts } from "@/constants/colors";
import { useAppColors } from "@/hooks/useAppColors";
import { pickLang, type Lang } from "@/context/LangContext";
import { rs } from "@/lib/responsive";
import Svg, { Path } from "react-native-svg";
import { MannersQuestion } from "@/components/manners/MannersQuiz";
import { pickMannersRound } from "@/constants/mannersData";
import { useMannersProgress } from "@/lib/mannersProgress";
import { CROWN_PATH } from "@/constants/crownPath";
import {
  tx,
  DIFFICULTY_LABEL,
  TWISTERS,
  type CheatRoute,
  type CheatStep,
  type ActionStep,
  type ArticulationStep,
  type TwisterStep,
  type TipStep,
  type FinalStep,
} from "@/constants/cheatsheetData";
import BreathingCircle from "@/components/cheatsheet/BreathingCircle";
import TipMascot from "@/components/cheatsheet/TipMascot";
import { markTipSeen, resolveTipSlots } from "@/lib/tipRotation";
import IllustratedDrill, { getIllustrated } from "@/components/warmup/IllustratedDrill";
import ChantView from "@/components/cheatsheet/ChantView";

type AppColors = import("@/constants/colors").AppColors;

const GOLD = "#FFD857";
const PURPLE = "#9468FB";

// Translucent surface/border tint that flips with the theme (white ink on
// dark, black ink on light) so cards and tracks read on either background.
const ink = (isDark: boolean, a: number) =>
  isDark ? `rgba(255,255,255,${a})` : `rgba(14,14,16,${a})`;

function haptic(style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) {
  if (Platform.OS !== "web") Haptics.impactAsync(style).catch(() => {});
}

// mm:ss for the elapsed-time clock.
const mmss = (s: number) =>
  `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

// ── Intro line that fades away after a few seconds ────────────────────────────
function FadingIntro({ text, color, afterMs = 5000 }: { text: string; color: string; afterMs?: number }) {
  const op = useSharedValue(1);
  useEffect(() => {
    op.value = withDelay(afterMs, withTiming(0, { duration: 700, easing: Easing.out(Easing.quad) }));
    return () => cancelAnimation(op);
  }, [afterMs, op]);
  const style = useAnimatedStyle(() => ({ opacity: op.value }));
  return <Animated.Text style={[styles.stepIntro, { color }, style]}>{text}</Animated.Text>;
}

// ── Articulation (illustrated warm-up portraits, animated in rhythm) ───────────
// Opens with a 3-second preview of the step name («Разомни рот»), then the
// drill itself: its name takes the header's place, the portrait plays below.
const ART_PREVIEW_MS = 3000;

function ArticulationView({ step, lang, c, isDark }: { step: ArticulationStep; lang: Lang; c: AppColors; isDark: boolean }) {
  const [i, setI] = useState(0);
  const [preview, setPreview] = useState(true);
  const { height: winH } = useWindowDimensions();
  const ex = getIllustrated(step.drills[i] ?? step.drills[0]);
  // The drills loop while the step is on screen.
  const next = useCallback(() => setI((v) => (v + 1) % step.drills.length), [step.drills.length]);

  useEffect(() => {
    const t = setTimeout(() => setPreview(false), ART_PREVIEW_MS);
    return () => clearTimeout(t);
  }, []);

  if (preview) {
    return (
      <Animated.View exiting={FadeOut.duration(220)} style={styles.artPreview}>
        <Animated.Text entering={FadeIn.duration(450)} style={[styles.artPreviewTitle, { color: c.text }]}>
          {tx(step.title, lang)}
        </Animated.Text>
        <Animated.Text entering={FadeInDown.duration(420).delay(320)} style={[styles.stepIntro, { color: c.textSecondary }]}>
          {tx(step.intro, lang)}
        </Animated.Text>
      </Animated.View>
    );
  }

  return (
    <Animated.View entering={FadeIn.duration(320)} style={styles.artWrap}>
      {/* The drill's own name stands where «Разомни рот» was */}
      <Animated.View key={`t-${i}`} entering={FadeInDown.duration(300)} style={styles.exHeader}>
        <Text style={[styles.stepTitle, { color: c.text }]}>{pickLang(lang, ex.title)}</Text>
        <Text style={[styles.stepIntro, { color: c.textSecondary }]}>{pickLang(lang, ex.desc)}</Text>
      </Animated.View>
      <View style={styles.artStage}>
        <IllustratedDrill key={`d-${i}`} exercise={ex} lang={lang} height={Math.min(rs(240), winH * 0.3)} seconds={step.secs} onDone={next} />
      </View>
      <View style={styles.artDots}>
        {step.drills.map((_, k) => (
          <View key={k} style={[styles.artDot, { backgroundColor: ink(isDark, 0.18) }, k === i && styles.artDotActive]} />
        ))}
      </View>
    </Animated.View>
  );
}

// ── Action (yawn-sigh / shaking / humming / trill / siren) ────────────────────
// Three phases so the exercise is actually done, not skipped:
//  1. intro — just the name, one line of what it is, and «Начать»;
//  2. run   — one stage at a time: its instruction big, its own countdown,
//             segmented progress;
//  3. done  — «Готово!» and «Ещё раз».
const stageSecsOf = (step: ActionStep) =>
  step.moveSecs ?? step.moves.map(() => Math.max(5, Math.ceil((step.seconds ?? 21) / step.moves.length)));

function StageSegment({ state, secs, isDark }: { state: "done" | "now" | "next"; secs: number; isDark: boolean }) {
  const w = useSharedValue(state === "done" ? 1 : 0);
  useEffect(() => {
    if (state === "now") {
      w.value = 0;
      w.value = withTiming(1, { duration: secs * 1000, easing: Easing.linear });
    } else w.value = state === "done" ? 1 : 0;
    return () => cancelAnimation(w);
  }, [state, secs, w]);
  const fill = useAnimatedStyle(() => ({ width: `${w.value * 100}%` as any }));
  return (
    <View style={[styles.segTrack, { backgroundColor: ink(isDark, 0.1) }]}>
      <Animated.View style={[styles.segFill, fill]} />
    </View>
  );
}

function ActionView({ step, lang, c, isDark }: { step: ActionStep; lang: Lang; c: AppColors; isDark: boolean }) {
  const secs = stageSecsOf(step);
  const total = secs.reduce((a, b) => a + b, 0);
  const [phase, setPhase] = useState<"intro" | "run" | "done">("intro");
  const [stage, setStage] = useState(0);
  const [left, setLeft] = useState(secs[0]);

  useEffect(() => {
    if (phase !== "run") return;
    if (left <= 0) {
      if (stage >= step.moves.length - 1) {
        setPhase("done");
        haptic(Haptics.ImpactFeedbackStyle.Heavy);
      } else {
        setStage(stage + 1);
        setLeft(secs[stage + 1]);
        haptic(Haptics.ImpactFeedbackStyle.Medium);
      }
      return;
    }
    const to = setTimeout(() => setLeft((v) => v - 1), 1000);
    return () => clearTimeout(to);
  }, [phase, left, stage, step.moves.length, secs]);

  const start = () => {
    setStage(0);
    setLeft(secs[0]);
    setPhase("run");
    haptic();
  };

  const nStages = step.moves.length;
  const stagesLbl = pickLang(lang, {
    ru: `${nStages} ${nStages >= 5 ? "этапов" : "этапа"} · ${total} сек`,
    en: `${nStages} stages · ${total} sec`,
    kk: `${nStages} кезең · ${total} сек`,
  });

  if (phase === "intro") {
    return (
      <Animated.View key="intro" entering={FadeIn.duration(260)} style={styles.actIntro}>
        <View style={styles.actIntroHead}>
          <Animated.Text entering={FadeIn.duration(450)} style={[styles.artPreviewTitle, { color: c.text }]}>
            {tx(step.title, lang)}
          </Animated.Text>
          <Animated.Text entering={FadeInDown.duration(380).delay(200)} style={[styles.stepIntro, { color: c.textSecondary }]}>
            {tx(step.intro, lang).replace(/[:：]\s*$/, ".")}
          </Animated.Text>
          <Animated.View entering={FadeInDown.duration(380).delay(320)} style={[styles.actMetaChip, { backgroundColor: ink(isDark, 0.06) }]}>
            <Text style={[styles.actMetaTxt, { color: c.textMuted }]}>{stagesLbl}</Text>
          </Animated.View>
        </View>
        <Animated.View entering={FadeInDown.duration(380).delay(440)}>
          <Pressable onPress={start} style={({ pressed }) => [styles.actStartBtn, pressed && { transform: [{ scale: 0.97 }] }]}>
            <Ionicons name="play" size={rs(20)} color="#41310A" />
            <Text style={styles.actStartTxt}>{pickLang(lang, { ru: "Начать", en: "Start", kk: "Бастау" })}</Text>
          </Pressable>
        </Animated.View>
      </Animated.View>
    );
  }

  if (phase === "done") {
    return (
      <Animated.View key="done" entering={FadeIn.duration(260)} style={styles.actIntro}>
        <View style={styles.actIntroHead}>
          <Animated.Text entering={FadeIn.duration(400)} style={[styles.artPreviewTitle, { color: c.text }]}>
            {pickLang(lang, { ru: "Готово!", en: "Done!", kk: "Дайын!" })}
          </Animated.Text>
          <Animated.Text entering={FadeInDown.duration(360).delay(260)} style={[styles.stepIntro, { color: c.textSecondary }]}>
            {tx(step.title, lang)}
          </Animated.Text>
        </View>
        <Animated.View entering={FadeInDown.duration(360).delay(360)}>
          <Pressable onPress={start} style={({ pressed }) => [styles.actAgainBtn, { backgroundColor: ink(isDark, 0.07) }, pressed && { opacity: 0.8 }]}>
            <Ionicons name="refresh" size={rs(18)} color={c.text} />
            <Text style={[styles.actAgainTxt, { color: c.text }]}>{pickLang(lang, { ru: "Ещё раз", en: "Again", kk: "Тағы бір рет" })}</Text>
          </Pressable>
        </Animated.View>
      </Animated.View>
    );
  }

  return (
    <Animated.View key="run" entering={FadeIn.duration(260)} style={styles.actRun}>
      <Text style={[styles.actRunTitle, { color: c.textMuted }]}>{tx(step.title, lang)}</Text>
      <View style={styles.segRow}>
        {step.moves.map((_, k) => (
          <StageSegment key={k} state={k < stage ? "done" : k === stage ? "now" : "next"} secs={secs[k]} isDark={isDark} />
        ))}
      </View>
      <Text style={styles.actStageLbl}>
        {pickLang(lang, { ru: `Этап ${stage + 1} из ${nStages}`, en: `Stage ${stage + 1} of ${nStages}`, kk: `${nStages} кезеңнің ${stage + 1}-і` })}
      </Text>

      <View style={styles.actRunCenter}>
        <Text style={[styles.actCount, { color: c.text }]}>{left}</Text>
        <Animated.Text key={`m-${stage}`} entering={FadeInDown.duration(320)} style={[styles.actMoveNow, { color: c.text }]}>
          {tx(step.moves[stage], lang)}
        </Animated.Text>
      </View>
    </Animated.View>
  );
}

// ── Tongue twister — karaoke highlight that accelerates across 3 speed passes ─
// Words light up one-by-one (like the chant). Each full pass is faster than the
// last: slow → in-tempo → fast, looping. A "Замена" button swaps the twister.
const TW_PASS_MS = [520, 340, 210]; // ms per word for slow / tempo / fast
const TW_SPEED_LABEL: { ru: string; en: string; kk: string; color: string }[] = [
  { ru: "Медленно", en: "Slow", kk: "Баяу", color: "#5FD3C4" },
  { ru: "В темпе", en: "In tempo", kk: "Қарқынмен", color: "#FFD857" },
  { ru: "Быстро", en: "Fast", kk: "Жылдам", color: "#FF7A6B" },
];

function TwisterWord({ text, active, muted }: { text: string; active: boolean; muted: string }) {
  const p = useSharedValue(active ? 1 : 0);
  useEffect(() => {
    p.value = withTiming(active ? 1 : 0, { duration: 160 });
  }, [active, p]);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + p.value * 0.12 }],
    opacity: 0.38 + p.value * 0.62,
  }));
  return (
    <Animated.View style={style}>
      <Text style={[styles.twWord, { color: muted }, active && styles.twWordActive]}>{text}</Text>
    </Animated.View>
  );
}

function TwisterView({ step, lang, c, isDark }: { step: TwisterStep; lang: Lang; c: AppColors; isDark: boolean }) {
  // The twister currently shown — starts from the step, cycles via "Замена".
  const [tw, setTw] = useState<TwisterStep>(step);
  useEffect(() => setTw(step), [step]);

  const words = React.useMemo(() => tx(tw.text, lang).split(/\s+/).filter(Boolean), [tw, lang]);
  const [active, setActive] = useState(0);
  const [pass, setPass] = useState(0); // 0 slow → 1 tempo → 2 fast → loop
  const passRef = React.useRef(0);
  passRef.current = pass;

  // Karaoke driver: advance the highlight; at the end of a line, step to the
  // next (faster) speed pass and loop back to slow after the fast one.
  useEffect(() => {
    if (!words.length) return;
    setActive(0);
    const id = setInterval(() => {
      setActive((a) => {
        if (a + 1 >= words.length) {
          setPass((pv) => (pv + 1) % TW_PASS_MS.length);
          return 0;
        }
        return a + 1;
      });
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }
    }, TW_PASS_MS[passRef.current]);
    return () => clearInterval(id);
    // Re-arm the interval whenever the speed pass or the twister changes.
  }, [words, pass]);

  const replace = useCallback(() => {
    haptic();
    const pool = TWISTERS.length ? TWISTERS : [step];
    const curIdx = pool.findIndex((t) => t.id === tw.id);
    const next = pool[(curIdx + 1) % pool.length]; // step to the next twister (wraps)
    setPass(0);
    setActive(0);
    setTw(next);
  }, [tw, step]);

  const diff = DIFFICULTY_LABEL[tw.difficulty];
  const speed = TW_SPEED_LABEL[pass];

  return (
    <View style={styles.twWrap}>
      <View style={styles.twTags}>
        <View style={styles.soundChip}>
          <Ionicons name="volume-high-outline" size={rs(13)} color={PURPLE} />
          <Text style={styles.soundChipTxt}>{tx(tw.sound, lang)}</Text>
        </View>
        <View style={[styles.diffChip, { backgroundColor: ink(isDark, 0.06), borderColor: ink(isDark, 0.1) }]}>
          {[1, 2, 3, 4].map((n) => (
            <View
              key={n}
              style={[styles.diffPip, { backgroundColor: ink(isDark, 0.22) }, n <= tw.difficulty && styles.diffPipOn]}
            />
          ))}
          <Text style={[styles.diffTxt, { color: c.textSecondary }]}>{tx(diff, lang)}</Text>
        </View>
      </View>

      {/* Speed pill — updates each pass: slow → tempo → fast. */}
      <View style={[styles.speedPill, { backgroundColor: speed.color + "1F", borderColor: speed.color + "55" }]}>
        <Text style={[styles.speedTxt, { color: speed.color }]}>{pickLang(lang, speed)}</Text>
      </View>

      {/* Karaoke line */}
      <View style={styles.twKaraoke}>
        {words.map((w, i) => (
          <TwisterWord key={`${w}-${i}`} text={w} active={i === active} muted={c.textMuted} />
        ))}
      </View>

      <Text style={[styles.twHint, { color: c.textMuted }]}>
        {pickLang(lang, {
          ru: "Веди голос за подсветкой — каждый круг быстрее.",
          en: "Follow the highlight — it speeds up each pass.",
          kk: "Белгіленген сөзбен бірге айтыңыз — әр айналым жылдамырақ.",
        })}
      </Text>

      {/* Replace the twister (free) */}
      <Pressable
        onPress={replace}
        style={({ pressed }) => [
          styles.twReplaceBtn,
          { backgroundColor: ink(isDark, 0.06), borderColor: ink(isDark, 0.12), opacity: pressed ? 0.7 : 1 },
        ]}
        accessibilityRole="button"
        accessibilityLabel={pickLang(lang, { ru: "Замена", en: "Replace", kk: "Ауыстыру" })}
      >
        <Ionicons name="shuffle" size={rs(16)} color={c.text} />
        <Text style={[styles.twReplaceTxt, { color: c.text }]}>{pickLang(lang, { ru: "Замена", en: "Replace", kk: "Ауыстыру" })}</Text>
      </Pressable>
    </View>
  );
}

// ── Tip / Fix card ────────────────────────────────────────────────────────────
function TipView({ step, lang, c }: { step: TipStep; lang: Lang; c: AppColors }) {
  const isFix = step.variant === "fix";
  return (
    <View style={styles.tipWrap}>
      {/* Oscar in a pose that fits the tip (Rive emotion or vector pose) */}
      <Animated.View entering={FadeIn.duration(360).delay(80)} style={styles.tipMascot}>
        <TipMascot mascot={step.mascot} />
      </Animated.View>
      {/* kicker sits right on top of the tip it labels */}
      <View style={styles.tipTextBlock}>
        <Text style={[styles.tipKicker, { color: c.textMuted }]}>
          {isFix
            ? pickLang(lang, { ru: "БЫСТРЫЙ ФИКС", en: "QUICK FIX", kk: "ЖЕДЕЛ КӨМЕК" })
            : pickLang(lang, { ru: "СОВЕТ", en: "TIP", kk: "КЕҢЕС" })}
        </Text>
        <Text style={[styles.tipTitle, { color: c.text }]}>{tx(step.title, lang)}</Text>
        <Text style={[styles.tipText, { color: c.textSecondary }]}>{tx(step.text, lang)}</Text>
      </View>
    </View>
  );
}

// ── «Королевские манеры» question ─────────────────────────────────────────────
function MannersView({ lang, c }: { lang: Lang; c: AppColors }) {
  const progress = useMannersProgress();
  // One rule per visit, unseen ones first; fixed for the lifetime of the step.
  const rule = React.useMemo(() => pickMannersRound(1, Object.keys(progress))[0], []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <View style={styles.mannersWrap}>
      <View style={styles.mannersHead}>
        <Svg width={rs(22)} height={rs(18)} viewBox="0 0 48.3 39">
          <Path d={CROWN_PATH} fill={GOLD} />
        </Svg>
        <Text style={[styles.mannersKicker, { color: c.text }]}>
          {pickLang(lang, { ru: "Королевские манеры", en: "Royal manners", kk: "Корольдік әдеп" })}
        </Text>
      </View>
      <MannersQuestion rule={rule} lang={lang} onAnswered={() => {}} />
    </View>
  );
}

// ── Final anchor ──────────────────────────────────────────────────────────────
function FinalView({ step, lang, onDone, c }: { step: FinalStep; lang: Lang; onDone: () => void; c: AppColors }) {
  return (
    <View style={styles.finalWrap}>
      {/* hero: the verdict first, then the line under it, then Oscar (pose №5) */}
      <View style={styles.finalTop}>
        <Animated.View entering={FadeInDown.duration(380)} style={styles.finalHead}>
          <Text style={[styles.finalTitle, { color: c.text }]}>{tx(step.title, lang)}</Text>
          <Text style={[styles.finalQuote, { color: c.textSecondary }]}>{tx(step.mantra, lang)}</Text>
        </Animated.View>
        <Animated.View entering={FadeIn.duration(420).delay(120)}>
          <TipMascot mascot={{ rive: "cool" }} />
        </Animated.View>
      </View>
      {/* checklist + button sit low, near the thumb */}
      <Animated.View entering={FadeInDown.duration(380).delay(220)} style={styles.finalBottom}>
        <View style={styles.finalLines}>
          {step.lines.map((l, k) => (
            <View key={k} style={styles.finalLineRow}>
              <View style={styles.finalDot} />
              <Text style={[styles.finalLine, { color: c.text }]}>{tx(l, lang)}</Text>
            </View>
          ))}
        </View>
        <ReadyButton3D label={pickLang(lang, { ru: "Я готов", en: "I'm ready", kk: "Мен дайынмын" })} onPress={onDone} />
      </Animated.View>
    </View>
  );
}

// ── «Я готов» — a chunky 3D key: a gold face on a deeper amber base. Pressing
// sinks the face into the base (spring), with a haptic tick on the way down
// and a success buzz on release.
const READY_DEPTH = 7;
function ReadyButton3D({ label, onPress }: { label: string; onPress: () => void }) {
  const down = useSharedValue(0);
  const faceStyle = useAnimatedStyle(() => ({ transform: [{ translateY: down.value * READY_DEPTH }] }));
  return (
    <Pressable
      onPress={() => {
        if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        onPress();
      }}
      onPressIn={() => {
        down.value = withTiming(1, { duration: 70 });
        haptic(Haptics.ImpactFeedbackStyle.Medium);
      }}
      onPressOut={() => {
        down.value = withSpring(0, { damping: 11, stiffness: 320, mass: 0.6 });
      }}
      style={styles.ready3d}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={styles.ready3dBase} />
      <Animated.View style={[styles.ready3dFace, faceStyle]}>
        {/* soft top glint — fades out, no hard edge */}
        <LinearGradient
          pointerEvents="none"
          colors={["rgba(255,255,255,0.38)", "rgba(255,255,255,0)"]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.ready3dGlint}
        />
        <Text style={styles.readyTxt}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

// ── Runner ────────────────────────────────────────────────────────────────────
export default function CheatSheetRunner({
  route,
  lang,
  onExit,
}: {
  route: CheatRoute;
  lang: Lang;
  onExit: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { colors: c, isDark } = useAppColors();
  const [idx, setIdx] = useState(0);
  // Tip slots get a fresh, least-recently-seen tip (with its own pose) per run.
  const steps = React.useMemo(() => resolveTipSlots(route.steps), [route]);
  const total = steps.length;
  const step: CheatStep = steps[idx];
  useEffect(() => {
    if (step.kind === "tip") markTipSeen(step.id);
  }, [step]);
  const isFinal = step.kind === "final";

  // Elapsed-time clock for the top bar. Counts up so the player sees how much
  // time has passed — but the warm-up NEVER auto-ends when the target minute
  // is reached; only the player's own navigation exits it.
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const targetSec = route.minutes * 60;

  const prog = useSharedValue((idx + 1) / total);
  useEffect(() => {
    prog.value = withTiming((idx + 1) / total, { duration: 300 });
  }, [idx, total, prog]);
  const progStyle = useAnimatedStyle(() => ({ width: `${prog.value * 100}%` as any }));

  // On «Разомни рот» the drills loop forever — after 15 s, nudge the player
  // that they can move on whenever they're ready.
  const [readyHint, setReadyHint] = useState(false);
  useEffect(() => {
    setReadyHint(false);
    if (step.kind !== "articulation") return;
    const t = setTimeout(() => setReadyHint(true), 15000);
    return () => clearTimeout(t);
  }, [idx, step.kind]);

  const next = useCallback(() => {
    haptic();
    if (idx >= total - 1) {
      onExit();
      return;
    }
    setIdx((i) => i + 1);
  }, [idx, total, onExit]);

  const back = useCallback(() => {
    if (idx <= 0) {
      onExit();
      return;
    }
    haptic();
    setIdx((i) => i - 1);
  }, [idx, onExit]);

  const showExerciseHeader =
    step.kind === "breathing" || step.kind === "chant" || step.kind === "twister";

  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      {/* Top bar — single close (top-right). A back chevron only appears once
          you're past the first step; no second cross. */}
      <View style={[styles.topBar, { paddingTop: insets.top + rs(10) }]}>
        {idx > 0 ? (
          <Pressable onPress={back} hitSlop={10} style={[styles.iconBtn, { backgroundColor: ink(isDark, 0.08) }]}>
            <Ionicons name="chevron-back" size={rs(22)} color={c.text} />
          </Pressable>
        ) : (
          <View style={styles.iconSpacer} />
        )}
        <View style={styles.progressWrap}>
          <View style={[styles.progressTrack, { backgroundColor: ink(isDark, 0.1) }]}>
            <Animated.View style={[styles.progressFill, progStyle, { backgroundColor: route.accent }]} />
          </View>
          <View style={styles.progressMeta}>
            <Text style={[styles.progressTxt, { color: c.textMuted }]}>
              {pickLang(lang, { ru: `Шаг ${idx + 1} из ${total}`, en: `Step ${idx + 1} of ${total}`, kk: `${total} қадамның ${idx + 1}-і` })}
            </Text>
            <View style={styles.timerChip}>
              <Text style={[styles.timerTxt, { color: c.text }]}>
                {mmss(elapsed)} / {mmss(targetSec)}
              </Text>
            </View>
          </View>
        </View>
        <Pressable onPress={onExit} hitSlop={10} style={[styles.iconBtn, { backgroundColor: ink(isDark, 0.08) }]}>
          <Ionicons name="close" size={rs(22)} color={c.text} />
        </Pressable>
      </View>

      {/* Body */}
      <Animated.View key={idx} entering={FadeInDown.duration(320)} style={styles.body}>
        {showExerciseHeader && (
          <View style={styles.exHeader}>
            <Text style={[styles.stepTitle, { color: c.text }]}>{tx((step as any).title, lang)}</Text>
            {"intro" in step && !!step.intro &&
              (step.kind === "breathing" ? (
                // The breathing explainer gets out of the way after 5 s.
                <FadingIntro text={tx(step.intro, lang)} color={c.textSecondary} />
              ) : (
                <Text style={[styles.stepIntro, { color: c.textSecondary }]}>{tx((step as any).intro, lang)}</Text>
              ))}
          </View>
        )}

        {step.kind === "breathing" && <BreathingCircle step={step} lang={lang} />}

        {step.kind === "chant" && (
          <ChantView syllables={step.syllables} tempoMs={step.tempoMs} />
        )}

        {step.kind === "articulation" && (
          <View style={{ flex: 1, width: "100%" }}>
            <ArticulationView step={step} lang={lang} c={c} isDark={isDark} />
          </View>
        )}

        {step.kind === "action" && (
          <ScrollView
            contentContainerStyle={[styles.scrollBody, { flexGrow: 1 }]}
            showsVerticalScrollIndicator={false}
          >
            <ActionView step={step} lang={lang} c={c} isDark={isDark} />
          </ScrollView>
        )}

        {step.kind === "twister" && (
          <ScrollView contentContainerStyle={styles.scrollBody} showsVerticalScrollIndicator={false}>
            <TwisterView step={step} lang={lang} c={c} isDark={isDark} />
          </ScrollView>
        )}

        {step.kind === "tip" && (
          <ScrollView contentContainerStyle={styles.scrollBody} showsVerticalScrollIndicator={false}>
            <TipView step={step} lang={lang} c={c} />
          </ScrollView>
        )}

        {step.kind === "manners" && (
          <ScrollView contentContainerStyle={styles.scrollBody} showsVerticalScrollIndicator={false}>
            <MannersView lang={lang} c={c} />
          </ScrollView>
        )}

        {step.kind === "final" && (
          // fills the screen so the checklist + button sit where the footer
          // buttons usually are (same bottom clearance)
          <ScrollView
            contentContainerStyle={{ flexGrow: 1, paddingBottom: Math.max(insets.bottom, rs(22)) + rs(18) }}
            showsVerticalScrollIndicator={false}
          >
            <FinalView step={step} lang={lang} onDone={onExit} c={c} />
          </ScrollView>
        )}
      </Animated.View>

      {/* Footer — Back (left) + Forward (right). Split from the old single
          "Next" so the player can step back to the previous exercise. */}
      {!isFinal && (
        // Raise the buttons off the very bottom edge: some devices report
        // insets.bottom ~0 in Expo Go, which left them under the home gesture
        // area and hard/impossible to tap. Floor the clearance.
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, rs(22)) + rs(18) }]}>
          {readyHint && (
            <Animated.Text entering={FadeInDown.duration(360)} style={[styles.readyHint, { color: c.textSecondary }]}>
              {pickLang(lang, { ru: "Заверши, когда будешь готов", en: "Finish when you're ready", kk: "Дайын болғанда аяқтаңыз" })}
            </Animated.Text>
          )}
          <View style={styles.footerRow}>
          <Pressable
            onPress={back}
            disabled={idx <= 0}
            hitSlop={10}
            style={({ pressed }) => [
              styles.backBtn,
              { backgroundColor: ink(isDark, 0.07), opacity: idx <= 0 ? 0.4 : pressed ? 0.8 : 1 },
            ]}
            accessibilityRole="button"
            accessibilityLabel={pickLang(lang, { ru: "Назад", en: "Back", kk: "Артқа" })}
          >
            <Ionicons name="arrow-back" size={rs(18)} color={c.text} />
            <Text style={[styles.backTxt, { color: c.text }]}>{pickLang(lang, { ru: "Назад", en: "Back", kk: "Артқа" })}</Text>
          </Pressable>
          <Pressable onPress={next} hitSlop={10} style={({ pressed }) => [styles.nextBtn, styles.nextBtnFlex, pressed && { opacity: 0.9 }]}>
            <Text style={styles.nextTxt}>{pickLang(lang, { ru: "Вперёд", en: "Forward", kk: "Алға" })}</Text>
            <NextChevron size={rs(16)} color="#41310A" />
          </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  topBar: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 16 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  iconSpacer: { width: 40, height: 40 },
  progressWrap: { flex: 1, gap: 8 },
  progressTrack: { height: 8, borderRadius: 4, overflow: "hidden" },
  progressFill: { height: 8, borderRadius: 4 },
  progressMeta: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  progressTxt: { fontSize: 12, fontFamily: fonts.bodySemibold },
  timerChip: { flexDirection: "row", alignItems: "center", gap: 4 },
  timerTxt: { fontSize: 13, fontFamily: fonts.bodyBold, fontVariant: ["tabular-nums"] },

  body: { flex: 1, paddingHorizontal: 22, paddingTop: 28 },
  scrollBody: { paddingBottom: 20 },
  exHeader: { gap: 8, marginBottom: 4, alignItems: "center" },
  stepTitle: { fontSize: 23, fontFamily: fonts.display, textAlign: "center" },
  stepIntro: { fontSize: 15, lineHeight: 22, fontFamily: fonts.body, textAlign: "center", paddingHorizontal: 6 },

  // articulation
  artWrap: { flex: 1, alignItems: "center", gap: 18, width: "100%" },
  artStage: { flex: 1, width: "100%", alignItems: "center", justifyContent: "center" },
  artPreview: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, paddingBottom: 40 },
  artPreviewTitle: { fontSize: 34, lineHeight: 40, fontFamily: fonts.display, textAlign: "center", marginTop: 8 },
  artLabel: { fontSize: 20, fontFamily: fonts.bodyBold, textAlign: "center", paddingHorizontal: 10 },
  artDesc: { fontSize: 14, lineHeight: 20, fontFamily: fonts.body, textAlign: "center", marginTop: 4, paddingHorizontal: 16 },
  artDots: { flexDirection: "row", gap: 8 },
  artDot: { width: 8, height: 8, borderRadius: 4 },
  artDotActive: { backgroundColor: GOLD, width: 22 },

  // action
  actIntro: { flex: 1, alignItems: "center", justifyContent: "center", gap: 40, paddingBottom: 40 },
  actIntroHead: { alignItems: "center", gap: 14 },
  actMetaChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 14, marginTop: 2 },
  actMetaTxt: { fontSize: 13, fontFamily: fonts.bodyBold, letterSpacing: 0.3 },
  actStartBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: GOLD, minWidth: 200, paddingHorizontal: 36, paddingVertical: 17, borderRadius: 32 },
  actStartTxt: { color: "#41310A", fontSize: 18, fontFamily: fonts.bodyBold },
  actAgainBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 24, paddingVertical: 13, borderRadius: 26 },
  actAgainTxt: { fontSize: 15, fontFamily: fonts.bodyBold },
  actRun: { flex: 1, alignItems: "center", paddingTop: 4 },
  actRunTitle: { fontSize: 15, fontFamily: fonts.bodyBold, textAlign: "center" },
  segRow: { flexDirection: "row", gap: 6, alignSelf: "stretch", marginTop: 14 },
  segTrack: { flex: 1, height: 6, borderRadius: 3, overflow: "hidden" },
  segFill: { height: "100%", backgroundColor: GOLD, borderRadius: 3 },
  actStageLbl: { color: PURPLE, fontSize: 13, fontFamily: fonts.bodyBold, letterSpacing: 0.6, textTransform: "uppercase", marginTop: 12 },
  actRunCenter: { flex: 1, alignItems: "center", justifyContent: "center", gap: 18, paddingHorizontal: 6, paddingBottom: 20 },
  actCount: { fontSize: 76, lineHeight: 84, fontFamily: fonts.display },
  actMoveNow: { fontSize: 26, lineHeight: 33, fontFamily: fonts.display, textAlign: "center" },

  // manners
  mannersWrap: { paddingTop: 4 },
  mannersHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
  mannersKicker: { fontSize: 15, fontFamily: fonts.bodyBold },

  // twister
  twWrap: { alignItems: "center", justifyContent: "center", gap: 20, paddingVertical: 12 },
  twTags: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: "center" },
  soundChip: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(148,104,251,0.14)", borderWidth: 1, borderColor: "rgba(148,104,251,0.35)", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16 },
  soundChipTxt: { color: PURPLE, fontSize: 13, fontFamily: fonts.bodyBold, letterSpacing: 0.5 },
  diffChip: { flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16 },
  diffPip: { width: 7, height: 7, borderRadius: 2 },
  diffPipOn: { backgroundColor: GOLD },
  diffTxt: { fontSize: 12, fontFamily: fonts.bodySemibold, marginLeft: 4 },
  twText: { fontSize: 30, lineHeight: 42, fontFamily: fonts.display, textAlign: "center", paddingHorizontal: 6 },
  twHint: { fontSize: 14, fontFamily: fonts.body, textAlign: "center" },
  speedPill: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 18, borderWidth: 1 },
  speedTxt: { fontSize: 13, fontFamily: fonts.bodyBold, letterSpacing: 0.5, textTransform: "uppercase" },
  twKaraoke: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: 10, paddingHorizontal: 6 },
  twWord: { fontSize: 27, lineHeight: 38, fontFamily: fonts.display, textAlign: "center" },
  twWordActive: { color: GOLD },
  twReplaceBtn: { flexDirection: "row", alignItems: "center", gap: 7, paddingVertical: 10, paddingHorizontal: 18, borderRadius: 22, borderWidth: 1, marginTop: 4 },
  twReplaceTxt: { fontSize: 14, fontFamily: fonts.bodyBold },

  // tip / fix
  tipWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, paddingHorizontal: 8 },
  tipMascot: { alignItems: "center", justifyContent: "center", marginVertical: 8 },
  tipTextBlock: { alignItems: "center", gap: 6 },
  tipKicker: { fontSize: 13, fontFamily: fonts.bodyBold, letterSpacing: 2 },
  tipTitle: { fontSize: 25, lineHeight: 31, fontFamily: fonts.display, textAlign: "center" },
  tipText: { fontSize: 17, lineHeight: 26, fontFamily: fonts.body, textAlign: "center" },

  // final
  finalWrap: { flex: 1, alignItems: "center", paddingBottom: 6 },
  finalTop: { flex: 1, alignItems: "center", justifyContent: "center", gap: 20 },
  finalHead: { alignItems: "center", gap: 14 },
  finalBottom: { alignSelf: "stretch", alignItems: "center", gap: 22 },
  finalTitle: { fontSize: 32, fontFamily: fonts.display, textAlign: "center" },
  finalQuote: { fontSize: 17, lineHeight: 24, fontFamily: fonts.body, textAlign: "center", maxWidth: 240 },
  finalLines: { gap: 10, alignSelf: "center" },
  finalLineRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  finalDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: GOLD },
  finalLine: { fontSize: 15, lineHeight: 21, fontFamily: fonts.bodySemibold },
  ready3d: { alignSelf: "stretch", height: 58 + READY_DEPTH, marginTop: 4 },
  ready3dBase: { position: "absolute", left: 0, right: 0, bottom: 0, height: 58, borderRadius: 29, backgroundColor: "#D99A1E" },
  ready3dFace: { height: 58, borderRadius: 29, backgroundColor: GOLD, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  ready3dGlint: { position: "absolute", top: 0, left: 0, right: 0, height: 30 },
  readyTxt: { color: "#41310A", fontSize: 18, fontFamily: fonts.bodyBold, letterSpacing: 0.2 },

  // footer
  footer: { paddingHorizontal: 22, paddingTop: 8 },
  footerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  backBtn: {
    height: 56,
    paddingHorizontal: 20,
    borderRadius: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  readyHint: { fontSize: 14, fontFamily: fonts.bodySemibold, textAlign: "center", marginBottom: 12 },
  backTxt: { fontSize: 16, fontFamily: fonts.bodyBold },
  nextBtn: { overflow: "hidden", backgroundColor: GOLD, minHeight: 56, paddingHorizontal: 24, borderRadius: 28, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  nextBtnFlex: { flex: 1 },
  nextTxt: { color: "#41310A", fontSize: 17, fontFamily: fonts.bodyBold },
});
