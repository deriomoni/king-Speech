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
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import NextChevron from "@/components/NextChevron";
import * as Haptics from "@/lib/haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  ZoomIn,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
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
        <Animated.Text entering={ZoomIn.springify().damping(14).stiffness(150)} style={[styles.artPreviewTitle, { color: c.text }]}>
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

// ── Action (grounding / shaking / resonators) with optional timer ────────────
function ActionView({ step, lang, c, isDark }: { step: ActionStep; lang: Lang; c: AppColors; isDark: boolean }) {
  const [remaining, setRemaining] = useState<number | null>(step.seconds ?? null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running || remaining === null) return;
    if (remaining <= 0) {
      setRunning(false);
      haptic(Haptics.ImpactFeedbackStyle.Medium);
      return;
    }
    const to = setTimeout(() => setRemaining((r) => (r === null ? null : r - 1)), 1000);
    return () => clearTimeout(to);
  }, [running, remaining]);

  const start = () => {
    setRemaining(step.seconds ?? null);
    setRunning(true);
    haptic();
  };

  return (
    <View style={styles.actionWrap}>
      <View style={[styles.actionEmojiWrap, { backgroundColor: ink(isDark, 0.06), borderColor: ink(isDark, 0.1) }]}>
        <Text style={styles.actionEmoji}>{step.emoji}</Text>
      </View>
      <Text style={[styles.stepTitle, { color: c.text }]}>{tx(step.title, lang)}</Text>
      <Text style={[styles.stepIntro, { color: c.textSecondary }]}>{tx(step.intro, lang)}</Text>

      <View style={[styles.movesCard, { backgroundColor: ink(isDark, 0.05), borderColor: ink(isDark, 0.08) }]}>
        {step.moves.map((m, k) => (
          <View key={k} style={styles.moveRow}>
            <View style={styles.moveNum}>
              <Text style={styles.moveNumTxt}>{k + 1}</Text>
            </View>
            <Text style={[styles.moveTxt, { color: c.textSecondary }]}>{tx(m, lang)}</Text>
          </View>
        ))}
      </View>

      {step.seconds != null && (
        <View style={styles.timerZone}>
          {running && remaining !== null ? (
            <View style={styles.timerCircle}>
              <Text style={[styles.timerNum, { color: c.text }]}>{remaining}</Text>
              <Text style={[styles.timerUnit, { color: c.textMuted }]}>{lang === "en" ? "sec" : "сек"}</Text>
            </View>
          ) : (
            <Pressable onPress={start} style={({ pressed }) => [styles.timerBtn, pressed && { opacity: 0.85 }]}>
              <Ionicons name="play" size={rs(18)} color="#41310A" />
              <Text style={styles.timerBtnTxt}>
                {remaining === 0
                  ? pickLang(lang, { ru: "Ещё раз", en: "Repeat", kk: "Тағы бір рет" })
                  : pickLang(lang, { ru: `Веди меня ${step.seconds}с`, en: `Guide me ${step.seconds}s`, kk: `Мені бағытта ${step.seconds}с` })}
              </Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
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
      <Text style={[styles.tipKicker, { color: c.text }]}>
        {isFix
          ? pickLang(lang, { ru: "БЫСТРЫЙ ФИКС", en: "QUICK FIX", kk: "ЖЕДЕЛ КӨМЕК" })
          : pickLang(lang, { ru: "СОВЕТ", en: "TIP", kk: "КЕҢЕС" })}
      </Text>
      {/* Oscar in a pose that fits the tip (Rive emotion or vector pose) */}
      <Animated.View entering={FadeIn.duration(360).delay(80)} style={styles.tipMascot}>
        <TipMascot mascot={step.mascot} />
      </Animated.View>
      <Text style={[styles.tipTitle, { color: c.text }]}>{tx(step.title, lang)}</Text>
      <Text style={[styles.tipText, { color: c.textSecondary }]}>{tx(step.text, lang)}</Text>
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
      <View style={styles.finalBadge}>
        <Ionicons name="sparkles" size={rs(34)} color={GOLD} />
      </View>
      <Text style={[styles.finalTitle, { color: c.text }]}>{tx(step.title, lang)}</Text>
      <View style={styles.finalLines}>
        {step.lines.map((l, k) => (
          <View key={k} style={styles.finalLineRow}>
            <Ionicons name="checkmark-circle" size={rs(18)} color="#5FD3C4" />
            <Text style={[styles.finalLine, { color: c.textSecondary }]}>{tx(l, lang)}</Text>
          </View>
        ))}
      </View>
      <View style={styles.mantraCard}>
        <Text style={[styles.mantraText, { color: c.text }]}>«{tx(step.mantra, lang)}»</Text>
      </View>
      <Pressable onPress={onDone} style={({ pressed }) => [styles.readyBtn, pressed && { opacity: 0.9 }]}>
        <LinearGradient colors={[GOLD, "#E6B82E"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <Text style={styles.readyTxt}>{pickLang(lang, { ru: "Я готов", en: "I'm ready", kk: "Мен дайынмын" })}</Text>
      </Pressable>
    </View>
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
              <Ionicons name="time-outline" size={rs(13)} color={route.accent} />
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
            contentContainerStyle={styles.scrollBody}
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
          <ScrollView contentContainerStyle={styles.scrollBody} showsVerticalScrollIndicator={false}>
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
            <LinearGradient colors={[GOLD, "#E6B82E"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
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
  actionWrap: { alignItems: "center", gap: 14, paddingTop: 8 },
  actionEmojiWrap: { width: 100, height: 100, borderRadius: 50, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  actionEmoji: { fontSize: 52 },
  movesCard: { width: "100%", borderRadius: 20, borderWidth: 1, padding: 16, gap: 12, marginTop: 4 },
  moveRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  moveNum: { width: 26, height: 26, borderRadius: 13, backgroundColor: "rgba(148,104,251,0.20)", borderWidth: 1, borderColor: "rgba(148,104,251,0.4)", alignItems: "center", justifyContent: "center" },
  moveNumTxt: { color: PURPLE, fontSize: 13, fontFamily: fonts.bodyBold },
  moveTxt: { flex: 1, fontSize: 15, lineHeight: 21, fontFamily: fonts.body },
  timerZone: { marginTop: 8, alignItems: "center" },
  timerCircle: { width: 110, height: 110, borderRadius: 55, borderWidth: 3, borderColor: GOLD, alignItems: "center", justifyContent: "center" },
  timerNum: { fontSize: 44, fontFamily: fonts.display },
  timerUnit: { fontSize: 13, fontFamily: fonts.body, marginTop: -4 },
  timerBtn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: GOLD, paddingHorizontal: 22, paddingVertical: 13, borderRadius: 26 },
  timerBtnTxt: { color: "#41310A", fontSize: 15, fontFamily: fonts.bodyBold },

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
  tipKicker: { fontSize: 15, fontFamily: fonts.bodyBold, letterSpacing: 2.4 },
  tipTitle: { fontSize: 25, fontFamily: fonts.display, textAlign: "center", marginTop: 6 },
  tipText: { fontSize: 17, lineHeight: 26, fontFamily: fonts.body, textAlign: "center" },

  // final
  finalWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 18 },
  finalBadge: { width: 84, height: 84, borderRadius: 42, backgroundColor: "rgba(255,207,52,0.14)", borderWidth: 1, borderColor: "rgba(255,207,52,0.4)", alignItems: "center", justifyContent: "center" },
  finalTitle: { fontSize: 30, fontFamily: fonts.display },
  finalLines: { gap: 12, alignSelf: "stretch", paddingHorizontal: 8 },
  finalLineRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  finalLine: { flex: 1, fontSize: 16, lineHeight: 23, fontFamily: fonts.body },
  mantraCard: { alignSelf: "stretch", backgroundColor: "rgba(148,104,251,0.12)", borderWidth: 1, borderColor: "rgba(148,104,251,0.3)", borderRadius: 20, padding: 18 },
  mantraText: { fontSize: 17, lineHeight: 25, fontFamily: fonts.serif, textAlign: "center", fontStyle: "italic" },
  readyBtn: { overflow: "hidden", height: 58, alignSelf: "stretch", borderRadius: 29, alignItems: "center", justifyContent: "center", marginTop: 6 },
  readyTxt: { color: "#41310A", fontSize: 17, fontFamily: fonts.bodyBold },

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
  nextBtn: { overflow: "hidden", minHeight: 56, paddingHorizontal: 24, borderRadius: 28, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  nextBtnFlex: { flex: 1 },
  nextTxt: { color: "#41310A", fontSize: 17, fontFamily: fonts.bodyBold },
});
