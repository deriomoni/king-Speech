import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  ScrollView,
  Dimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  FadeIn,
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  cancelAnimation,
} from "react-native-reanimated";
import { fonts } from "@/constants/colors";
import {
  tx,
  DIFFICULTY_LABEL,
  type CheatRoute,
  type CheatStep,
  type ActionStep,
  type ArticulationStep,
  type TwisterStep,
  type TipStep,
  type FinalStep,
} from "@/constants/cheatsheetData";
import BreathingCircle from "@/components/cheatsheet/BreathingCircle";
import ChantView from "@/components/cheatsheet/ChantView";

const { width: SW } = Dimensions.get("window");
const BG = "#0E0E10";
const BG2 = "#171320";
const GOLD = "#FFCF34";
const PURPLE = "#9468FB";

function haptic(style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) {
  if (Platform.OS !== "web") Haptics.impactAsync(style).catch(() => {});
}

// ── Articulation (auto-cycling mouth warm-up) ────────────────────────────────
function ArticulationView({ step, lang }: { step: ArticulationStep; lang: string }) {
  const [i, setI] = useState(0);
  const prog = useSharedValue(0);
  const move = step.moves[i];

  useEffect(() => {
    if (!step.moves.length) return;
    const secs = step.moves[i]?.secs ?? 5;
    prog.value = 0;
    prog.value = withTiming(1, { duration: secs * 1000, easing: Easing.linear });
    haptic();
    const to = setTimeout(() => setI((v) => (v + 1) % step.moves.length), secs * 1000);
    return () => clearTimeout(to);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, step]);

  useEffect(() => () => cancelAnimation(prog), [prog]);

  const barStyle = useAnimatedStyle(() => ({ width: `${prog.value * 100}%` as any }));

  return (
    <View style={styles.artWrap}>
      <Animated.Text key={`emoji-${i}`} entering={FadeIn.duration(240)} style={styles.artEmoji}>
        {move?.emoji}
      </Animated.Text>
      <Animated.Text key={`label-${i}`} entering={FadeIn.duration(240)} style={styles.artLabel}>
        {tx(move?.label, lang)}
      </Animated.Text>
      <View style={styles.artTrack}>
        <Animated.View style={[styles.artFill, barStyle]} />
      </View>
      <View style={styles.artDots}>
        {step.moves.map((_, k) => (
          <View key={k} style={[styles.artDot, k === i && styles.artDotActive]} />
        ))}
      </View>
    </View>
  );
}

// ── Action (grounding / shaking / resonators) with optional timer ────────────
function ActionView({ step, lang }: { step: ActionStep; lang: string }) {
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
      <View style={styles.actionEmojiWrap}>
        <Text style={styles.actionEmoji}>{step.emoji}</Text>
      </View>
      <Text style={styles.stepTitle}>{tx(step.title, lang)}</Text>
      <Text style={styles.stepIntro}>{tx(step.intro, lang)}</Text>

      <View style={styles.movesCard}>
        {step.moves.map((m, k) => (
          <View key={k} style={styles.moveRow}>
            <View style={styles.moveNum}>
              <Text style={styles.moveNumTxt}>{k + 1}</Text>
            </View>
            <Text style={styles.moveTxt}>{tx(m, lang)}</Text>
          </View>
        ))}
      </View>

      {step.seconds != null && (
        <View style={styles.timerZone}>
          {running && remaining !== null ? (
            <View style={styles.timerCircle}>
              <Text style={styles.timerNum}>{remaining}</Text>
              <Text style={styles.timerUnit}>{lang === "en" ? "sec" : "сек"}</Text>
            </View>
          ) : (
            <Pressable onPress={start} style={({ pressed }) => [styles.timerBtn, pressed && { opacity: 0.85 }]}>
              <Ionicons name="play" size={18} color="#41310A" />
              <Text style={styles.timerBtnTxt}>
                {remaining === 0
                  ? lang === "en" ? "Repeat" : "Ещё раз"
                  : lang === "en" ? `Guide me ${step.seconds}s` : `Веди меня ${step.seconds}с`}
              </Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

// ── Tongue twister ───────────────────────────────────────────────────────────
function TwisterView({ step, lang }: { step: TwisterStep; lang: string }) {
  const diff = DIFFICULTY_LABEL[step.difficulty];
  return (
    <View style={styles.twWrap}>
      <View style={styles.twTags}>
        <View style={styles.soundChip}>
          <Ionicons name="volume-high-outline" size={13} color={PURPLE} />
          <Text style={styles.soundChipTxt}>{tx(step.sound, lang)}</Text>
        </View>
        <View style={styles.diffChip}>
          {[1, 2, 3, 4].map((n) => (
            <View
              key={n}
              style={[styles.diffPip, n <= step.difficulty && styles.diffPipOn]}
            />
          ))}
          <Text style={styles.diffTxt}>{tx(diff, lang)}</Text>
        </View>
      </View>
      <Text style={styles.twText}>{tx(step.text, lang)}</Text>
      <Text style={styles.twHint}>
        {lang === "en"
          ? "Say it 3× — slow, then a touch faster each time."
          : "Повтори 3 раза — медленно, потом чуть быстрее."}
      </Text>
    </View>
  );
}

// ── Tip / Fix card ────────────────────────────────────────────────────────────
function TipView({ step, lang }: { step: TipStep; lang: string }) {
  const isFix = step.variant === "fix";
  const accent = isFix ? GOLD : PURPLE;
  return (
    <View style={styles.tipWrap}>
      <View style={[styles.tipIconWrap, { backgroundColor: accent + "1F", borderColor: accent + "44" }]}>
        <Ionicons name={step.icon} size={30} color={accent} />
      </View>
      <Text style={[styles.tipKicker, { color: accent }]}>
        {isFix
          ? lang === "en" ? "QUICK FIX" : "БЫСТРЫЙ ФИКС"
          : lang === "en" ? "TIP" : "СОВЕТ"}
      </Text>
      <Text style={styles.tipTitle}>{tx(step.title, lang)}</Text>
      <Text style={styles.tipText}>{tx(step.text, lang)}</Text>
    </View>
  );
}

// ── Final anchor ──────────────────────────────────────────────────────────────
function FinalView({ step, lang, onDone }: { step: FinalStep; lang: string; onDone: () => void }) {
  return (
    <View style={styles.finalWrap}>
      <View style={styles.finalBadge}>
        <Ionicons name="sparkles" size={34} color={GOLD} />
      </View>
      <Text style={styles.finalTitle}>{tx(step.title, lang)}</Text>
      <View style={styles.finalLines}>
        {step.lines.map((l, k) => (
          <View key={k} style={styles.finalLineRow}>
            <Ionicons name="checkmark-circle" size={18} color="#5FD3C4" />
            <Text style={styles.finalLine}>{tx(l, lang)}</Text>
          </View>
        ))}
      </View>
      <View style={styles.mantraCard}>
        <Text style={styles.mantraText}>«{tx(step.mantra, lang)}»</Text>
      </View>
      <Pressable onPress={onDone} style={({ pressed }) => [styles.readyBtn, pressed && { opacity: 0.9 }]}>
        <LinearGradient colors={[GOLD, "#E6B82E"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <Text style={styles.readyTxt}>{lang === "en" ? "I'm ready" : "Я готов"}</Text>
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
  lang: string;
  onExit: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [idx, setIdx] = useState(0);
  const total = route.steps.length;
  const step: CheatStep = route.steps[idx];
  const isFinal = step.kind === "final";

  const prog = useSharedValue((idx + 1) / total);
  useEffect(() => {
    prog.value = withTiming((idx + 1) / total, { duration: 300 });
  }, [idx, total, prog]);
  const progStyle = useAnimatedStyle(() => ({ width: `${prog.value * 100}%` as any }));

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
    <View style={styles.root}>
      <LinearGradient colors={[BG2, BG]} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={StyleSheet.absoluteFill} />
      <View
        pointerEvents="none"
        style={[styles.glow, { backgroundColor: route.accent + "26", top: -SW * 0.3, left: -SW * 0.25 }]}
      />

      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
        <Pressable onPress={back} hitSlop={10} style={styles.iconBtn}>
          <Ionicons name={idx === 0 ? "close" : "chevron-back"} size={22} color="#fff" />
        </Pressable>
        <View style={styles.progressWrap}>
          <View style={styles.progressTrack}>
            <Animated.View style={[styles.progressFill, progStyle, { backgroundColor: route.accent }]} />
          </View>
          <Text style={styles.progressTxt}>
            {lang === "en" ? `Step ${idx + 1} of ${total}` : `Шаг ${idx + 1} из ${total}`}
          </Text>
        </View>
        <Pressable onPress={onExit} hitSlop={10} style={styles.iconBtn}>
          <Ionicons name="close" size={22} color="rgba(255,255,255,0.6)" />
        </Pressable>
      </View>

      {/* Body */}
      <Animated.View key={idx} entering={FadeInDown.duration(320)} style={styles.body}>
        {showExerciseHeader && (
          <View style={styles.exHeader}>
            <Text style={styles.stepTitle}>{tx((step as any).title, lang)}</Text>
            {"intro" in step && !!step.intro && (
              <Text style={styles.stepIntro}>{tx((step as any).intro, lang)}</Text>
            )}
          </View>
        )}

        {step.kind === "breathing" && <BreathingCircle step={step} lang={lang} />}

        {step.kind === "chant" && (
          <ChantView syllables={step.syllables} tempoMs={step.tempoMs} />
        )}

        {step.kind === "articulation" && (
          <View style={{ flex: 1, width: "100%" }}>
            <View style={styles.exHeader}>
              <Text style={styles.stepTitle}>{tx(step.title, lang)}</Text>
              <Text style={styles.stepIntro}>{tx(step.intro, lang)}</Text>
            </View>
            <ArticulationView step={step} lang={lang} />
          </View>
        )}

        {step.kind === "action" && (
          <ScrollView
            contentContainerStyle={styles.scrollBody}
            showsVerticalScrollIndicator={false}
          >
            <ActionView step={step} lang={lang} />
          </ScrollView>
        )}

        {step.kind === "twister" && <TwisterView step={step} lang={lang} />}

        {step.kind === "tip" && <TipView step={step} lang={lang} />}

        {step.kind === "final" && <FinalView step={step} lang={lang} onDone={onExit} />}
      </Animated.View>

      {/* Footer */}
      {!isFinal && (
        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          <Pressable onPress={next} style={({ pressed }) => [styles.nextBtn, pressed && { opacity: 0.9 }]}>
            <LinearGradient colors={[GOLD, "#E6B82E"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
            <Text style={styles.nextTxt}>{lang === "en" ? "Next" : "Дальше"}</Text>
            <Ionicons name="arrow-forward" size={18} color="#41310A" />
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  glow: { position: "absolute", width: SW, height: SW, borderRadius: SW / 2, ...(Platform.OS === "web" ? ({ filter: "blur(120px)" } as any) : { opacity: 0.5 }) },

  topBar: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 10 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.08)" },
  progressWrap: { flex: 1, gap: 6 },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.10)", overflow: "hidden" },
  progressFill: { height: 6, borderRadius: 3 },
  progressTxt: { color: "rgba(255,255,255,0.55)", fontSize: 12, fontFamily: fonts.bodySemibold, textAlign: "center" },

  body: { flex: 1, paddingHorizontal: 22, paddingTop: 8 },
  scrollBody: { paddingBottom: 20 },
  exHeader: { gap: 8, marginBottom: 4, alignItems: "center" },
  stepTitle: { color: "#fff", fontSize: 23, fontFamily: fonts.display, textAlign: "center" },
  stepIntro: { color: "rgba(255,255,255,0.66)", fontSize: 15, lineHeight: 22, fontFamily: fonts.body, textAlign: "center", paddingHorizontal: 6 },

  // articulation
  artWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 22, width: "100%" },
  artEmoji: { fontSize: 96 },
  artLabel: { color: "#fff", fontSize: 22, fontFamily: fonts.bodyBold, textAlign: "center", paddingHorizontal: 10 },
  artTrack: { width: "70%", height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.12)", overflow: "hidden" },
  artFill: { height: 6, borderRadius: 3, backgroundColor: GOLD },
  artDots: { flexDirection: "row", gap: 8 },
  artDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.18)" },
  artDotActive: { backgroundColor: GOLD, width: 22 },

  // action
  actionWrap: { alignItems: "center", gap: 14, paddingTop: 8 },
  actionEmojiWrap: { width: 100, height: 100, borderRadius: 50, backgroundColor: "rgba(255,255,255,0.06)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.10)" },
  actionEmoji: { fontSize: 52 },
  movesCard: { width: "100%", backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 20, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", padding: 16, gap: 12, marginTop: 4 },
  moveRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  moveNum: { width: 26, height: 26, borderRadius: 13, backgroundColor: "rgba(148,104,251,0.20)", borderWidth: 1, borderColor: "rgba(148,104,251,0.4)", alignItems: "center", justifyContent: "center" },
  moveNumTxt: { color: "#C6B0FF", fontSize: 13, fontFamily: fonts.bodyBold },
  moveTxt: { flex: 1, color: "rgba(255,255,255,0.9)", fontSize: 15, lineHeight: 21, fontFamily: fonts.body },
  timerZone: { marginTop: 8, alignItems: "center" },
  timerCircle: { width: 110, height: 110, borderRadius: 55, borderWidth: 3, borderColor: GOLD, alignItems: "center", justifyContent: "center" },
  timerNum: { color: "#fff", fontSize: 44, fontFamily: fonts.display },
  timerUnit: { color: "rgba(255,255,255,0.5)", fontSize: 13, fontFamily: fonts.body, marginTop: -4 },
  timerBtn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: GOLD, paddingHorizontal: 22, paddingVertical: 13, borderRadius: 26 },
  timerBtnTxt: { color: "#41310A", fontSize: 15, fontFamily: fonts.bodyBold },

  // twister
  twWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 22 },
  twTags: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: "center" },
  soundChip: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(148,104,251,0.14)", borderWidth: 1, borderColor: "rgba(148,104,251,0.35)", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16 },
  soundChipTxt: { color: "#C6B0FF", fontSize: 13, fontFamily: fonts.bodyBold, letterSpacing: 0.5 },
  diffChip: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(255,255,255,0.10)", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16 },
  diffPip: { width: 7, height: 7, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.22)" },
  diffPipOn: { backgroundColor: GOLD },
  diffTxt: { color: "rgba(255,255,255,0.8)", fontSize: 12, fontFamily: fonts.bodySemibold, marginLeft: 4 },
  twText: { color: "#fff", fontSize: 30, lineHeight: 42, fontFamily: fonts.display, textAlign: "center", paddingHorizontal: 6 },
  twHint: { color: "rgba(255,255,255,0.55)", fontSize: 14, fontFamily: fonts.body, textAlign: "center" },

  // tip / fix
  tipWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, paddingHorizontal: 8 },
  tipIconWrap: { width: 74, height: 74, borderRadius: 37, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  tipKicker: { fontSize: 12, fontFamily: fonts.bodyBold, letterSpacing: 2 },
  tipTitle: { color: "#fff", fontSize: 25, fontFamily: fonts.display, textAlign: "center" },
  tipText: { color: "rgba(255,255,255,0.78)", fontSize: 17, lineHeight: 26, fontFamily: fonts.body, textAlign: "center" },

  // final
  finalWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 18 },
  finalBadge: { width: 84, height: 84, borderRadius: 42, backgroundColor: "rgba(255,207,52,0.14)", borderWidth: 1, borderColor: "rgba(255,207,52,0.4)", alignItems: "center", justifyContent: "center" },
  finalTitle: { color: "#fff", fontSize: 30, fontFamily: fonts.display },
  finalLines: { gap: 12, alignSelf: "stretch", paddingHorizontal: 8 },
  finalLineRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  finalLine: { flex: 1, color: "rgba(255,255,255,0.85)", fontSize: 16, lineHeight: 23, fontFamily: fonts.body },
  mantraCard: { alignSelf: "stretch", backgroundColor: "rgba(148,104,251,0.12)", borderWidth: 1, borderColor: "rgba(148,104,251,0.3)", borderRadius: 20, padding: 18 },
  mantraText: { color: "#EADFFF", fontSize: 17, lineHeight: 25, fontFamily: fonts.serif, textAlign: "center", fontStyle: "italic" },
  readyBtn: { overflow: "hidden", height: 58, alignSelf: "stretch", borderRadius: 29, alignItems: "center", justifyContent: "center", marginTop: 6 },
  readyTxt: { color: "#41310A", fontSize: 17, fontFamily: fonts.bodyBold },

  // footer
  footer: { paddingHorizontal: 22, paddingTop: 8 },
  nextBtn: { overflow: "hidden", height: 56, borderRadius: 28, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  nextTxt: { color: "#41310A", fontSize: 17, fontFamily: fonts.bodyBold },
});
