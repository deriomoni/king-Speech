import React, { useEffect, useRef, useState, useCallback } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { leaveTo } from "@/lib/nav";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import {
  getSpeechRecognitionModule,
  type ExpoSpeechRecognitionResultEvent,
  type ExpoSpeechRecognitionErrorEvent,
} from "@/lib/speechRecognition";
import type { EventSubscription } from "expo-modules-core";
import DevSkipButton from "@/components/DevSkipButton";
import Animated, {
  Easing,
  Extrapolation,
  FadeIn,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
  cancelAnimation,
  type SharedValue,
} from "react-native-reanimated";

import { useSafeAreaInsets } from "react-native-safe-area-context";
import { VOCAB_WORDS_RU, VocabWord, checkSynonymAdvanced } from "@/constants/vocabularyData";
import { useGame, MODULE_COLORS } from "@/context/GameContext";
import { useModuleTransition } from "@/context/ModuleTransitionContext";
import { useTheme } from "@/context/ThemeContext";
import { useWaveformBars } from "@/hooks/useWaveformBars";
import LevelIcon from "@/components/path/LevelIcon";
import VocabPlayView, {
  EXTRA_TIME_COST,
  HINT_COST,
  REPLACE_COST,
  type VocabAdFor,
  type VocabModal,
} from "@/components/vocabulary/VocabPlayView";
import VocabResultView from "@/components/vocabulary/VocabResultView";
import type { TimerState } from "@/components/vocabulary/Timer";

// Figma «07 · Уровень 6 · Словарный запас» (34:981): Как играть (148:397),
// Выбери слово (148:444), Барабан слов (148:469), Отсчёт (149:415),
// Игра · слушаю / подсказка / найдены синонимы (149:441, 149:510, 196:2013),
// Время вышло (37:6698) and the replace / ad pop-ups (37:4929, 37:4790, 37:4629).

type Phase = "tutorial" | "spin" | "play" | "result";
type FeedItem = { id: string; word: string; status: "correct" | "wrong" };

const TUTORIAL_KEY = "vocab_tutorial_seen";
const SESSION_SHOWN_KEY = "@kingspeech_vocab_session_shown_v1";

let sessionResetDone = false;

function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// Screen paddings: the design puts the top bar 8pt under a 54pt status bar.
function usePads() {
  const insets = useSafeAreaInsets();
  const web = Platform.OS === "web";
  return {
    top: web ? 54 : insets.top,
    bottom: web ? 28 : Math.max(16, insets.bottom - 6),
    insetBottom: web ? 0 : insets.bottom,
  };
}

function useInk() {
  const { theme, themeMode } = useTheme();
  const isDark = themeMode === "dark";
  const ink = (a: number) => (isDark ? `rgba(240,238,233,${a})` : `rgba(38,38,40,${a})`);
  return { theme, isDark, ink };
}

function CloseButton({ onPress }: { onPress: () => void }) {
  const { theme } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel="Закрыть"
      style={({ pressed }) => [styles.close, { opacity: pressed ? 0.6 : 1 }]}
    >
      <Ionicons name="close" size={26} color={theme.text} />
    </Pressable>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT
// ─────────────────────────────────────────────────────────────────────────────

export default function VocabularyLevelScreen() {
  const params = useLocalSearchParams<{
    levelId?: string;
    moduleId?: string;
  }>();
  const levelId = String(params.levelId ?? "vocabulary");
  const { theme } = useTheme();
  const { addXP, markLevelComplete } = useGame();
  const { triggerModuleTransition } = useModuleTransition();
  // Vocabulary is a module's LAST level, so finishing it crosses into the next
  // module. Resolve the current module number (from the param, fallback to id).
  const moduleNum =
    parseInt(String(params.moduleId ?? ""), 10) ||
    parseInt(levelId.replace(/\D/g, ""), 10) ||
    1;

  const [phase, setPhase] = useState<Phase>("tutorial");
  const [tutorialChecked, setTutorialChecked] = useState(false);
  const [selectedWord, setSelectedWord] = useState<VocabWord | null>(null);
  const [foundSynonyms, setFoundSynonyms] = useState<string[]>([]);
  const [score, setScore] = useState(0);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [shownIds, setShownIds] = useState<string[]>([]);

  // Tutorial flag — show once.
  useEffect(() => {
    AsyncStorage.getItem(TUTORIAL_KEY)
      .then((v) => {
        if (v === "1") setPhase("spin");
      })
      .finally(() => setTutorialChecked(true));
  }, []);

  // Session-shown words (resets on cold start).
  useEffect(() => {
    if (!sessionResetDone) {
      sessionResetDone = true;
      AsyncStorage.removeItem(SESSION_SHOWN_KEY).catch(() => {});
      setShownIds([]);
      return;
    }
    AsyncStorage.getItem(SESSION_SHOWN_KEY)
      .then((raw) => {
        if (!raw) return;
        try {
          const arr = JSON.parse(raw);
          if (Array.isArray(arr))
            setShownIds(arr.filter((x) => typeof x === "string"));
        } catch {}
      })
      .catch(() => {});
  }, []);

  const persistShown = useCallback((next: string[]) => {
    AsyncStorage.setItem(SESSION_SHOWN_KEY, JSON.stringify(next)).catch(
      () => {},
    );
  }, []);

  const handleTutorialDone = useCallback(() => {
    AsyncStorage.setItem(TUTORIAL_KEY, "1").catch(() => {});
    setPhase("spin");
  }, []);

  if (!tutorialChecked) {
    return <View style={[styles.root, { backgroundColor: theme.bg }]} />;
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      {phase === "tutorial" && (
        <TutorialPhase
          onDone={handleTutorialDone}
          onClose={() => router.back()}
        />
      )}
      {phase === "spin" && (
        <SpinPhase
          excludeIds={shownIds}
          onPicked={(w) => {
            setSelectedWord(w);
            setFoundSynonyms([]);
            setScore(0);
            setFeed([]);
            const next = [...shownIds, w.id];
            setShownIds(next);
            persistShown(next);
            // SpinPhase already plays its 900ms pop animation before calling
            // onPicked; we transition to play immediately after the snap.
            setTimeout(() => setPhase("play"), 900);
          }}
          onClose={() => router.back()}
        />
      )}
      {phase === "play" && selectedWord && (
        <PlayPhase
          word={selectedWord}
          foundSynonyms={foundSynonyms}
          feed={feed}
          onAddCorrect={(syn) => {
            setFoundSynonyms((p) => (p.includes(syn) ? p : [...p, syn]));
            setScore((p) => p + 3);
            setFeed((p) => [
              ...p,
              { id: makeId(), word: syn, status: "correct" },
            ]);
            if (Platform.OS !== "web") {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(
                () => {},
              );
            }
          }}
          onAddWrong={(text) => {
            const id = makeId();
            setFeed((p) => [...p, { id, word: text, status: "wrong" }]);
            if (Platform.OS !== "web") {
              Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Error,
              ).catch(() => {});
            }
            setTimeout(() => {
              setFeed((p) => p.filter((f) => f.id !== id));
            }, 1800);
          }}
          onFinish={() => setPhase("result")}
          onExit={() => leaveTo("/(tabs)")}
          onReplace={() => {
            // Discard the current word and re-spin. shownIds already excludes it,
            // so the roulette can't land on the same word again this session.
            setSelectedWord(null);
            setFoundSynonyms([]);
            setScore(0);
            setFeed([]);
            setPhase("spin");
          }}
        />
      )}
      {phase === "result" && selectedWord && (
        <ResultPhase
          word={selectedWord}
          foundSynonyms={foundSynonyms}
          score={score}
          onNext={() => {
            const xp = Math.min(50, foundSynonyms.length * 6);
            addXP(xp);
            markLevelComplete(levelId);
            // Module boundary: finishing vocabulary advances to the next module.
            // Play the full-screen corridor (current → next), floor tinted to the
            // next module's color, then return to the map (already auto-scrolled
            // to the new module). Skipped at the final module.
            const nextModule = moduleNum + 1;
            if (nextModule <= 67) {
              const color = MODULE_COLORS[nextModule]?.color ?? "#9468FB";
              triggerModuleTransition(moduleNum, nextModule, color);
            }
            leaveTo("/(tabs)");
          }}
        />
      )}

      <DevSkipButton levelId={levelId} />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 0 — TUTORIAL · «Как играть» (148:397)
// ─────────────────────────────────────────────────────────────────────────────

function TutorialPhase({
  onDone,
  onClose,
}: {
  onDone: () => void;
  onClose: () => void;
}) {
  const { theme, ink } = useInk();
  const pads = usePads();
  const rules = [
    "Нажми «Стоп» - получишь слово",
    "Нажми «Старт» и говори синонимы",
    "За каждый синоним +3 очка",
    "Чем больше слов - тем выше балл",
  ];

  return (
    <View
      style={[
        styles.tutorialRoot,
        { paddingTop: pads.top + 8, paddingBottom: Platform.OS === "web" ? 48 : pads.insetBottom + 14 },
      ]}
    >
      <View style={styles.topBar}>
        <CloseButton onPress={onClose} />
      </View>

      <View style={{ flex: 1 }} />

      <Text style={[styles.tutTitle, { color: theme.text }]}>Словарный запас</Text>
      <Text style={[styles.tutSub, { color: ink(0.6) }]}>Синонимы на скорость</Text>

      <View style={[styles.steps, { backgroundColor: ink(0.06), borderColor: ink(0.1) }]}>
        {rules.map((text, i) => (
          <View key={i}>
            {i > 0 ? <View style={[styles.stepSep, { backgroundColor: ink(0.08) }]} /> : null}
            <View style={styles.stepRow}>
              <View style={[styles.stepNum, { backgroundColor: "rgba(255,216,87,0.16)" }]}>
                <Text style={[styles.stepNumText, { color: theme.accentInk }]}>{i + 1}</Text>
              </View>
              <Text style={[styles.stepText, { color: theme.text }]}>{text}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.tip}>
        <View style={[styles.tipDot, { backgroundColor: theme.accent }]} />
        <Text style={[styles.tipText, { color: ink(0.5) }]}>
          Говори вслух - микрофон засчитает каждое слово
        </Text>
      </View>

      <View style={{ flex: 1 }} />

      <Pressable
        onPress={onDone}
        style={({ pressed }) => [
          styles.primaryBtn,
          { backgroundColor: theme.accent, borderColor: theme.ctaStroke, opacity: pressed ? 0.85 : 1 },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Понятно, начать"
      >
        <Text style={[styles.primaryBtnText, { color: theme.accentText }]}>Понятно, начать</Text>
      </Pressable>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 1 — SPIN · «Выбери слово» (148:444) + «Барабан слов» (148:469)
// ─────────────────────────────────────────────────────────────────────────────

// Vertical word drum. The centred word sits in a gold selection pill; its
// neighbours shrink (36 → 26 → 20pt) and fade (100% → 40% → 15%), and the
// top/bottom edges dissolve into the background.
const ROW_SPACING = 84; // distance between neighbouring words
const ROW_H = 46; // line box of the 36pt centre word
const CENTER_OFFSET = 28; // drum centre sits 28pt below the window centre
const REEL_LEN = 72; // long enough to keep sweeping for the full auto-stop window
const SETTLE_COLS = 3; // slots to glide past after STOP for a natural landing
const SPIN_SPEED = 4.2; // words per second while spinning

function ReelRow({
  word,
  index,
  pos,
  popScale,
  landed,
  color,
}: {
  word: string;
  index: number;
  pos: SharedValue<number>;
  popScale: SharedValue<number>;
  landed: boolean;
  color: string;
}) {
  const style = useAnimatedStyle(() => {
    const rel = index - pos.value;
    const d = Math.abs(rel);
    const opacity = interpolate(d, [0, 1, 2, 3], [1, 0.4, 0.15, 0], Extrapolation.CLAMP);
    const size = interpolate(d, [0, 1, 2], [1, 26 / 36, 20 / 36], Extrapolation.CLAMP);
    const scale = size * (landed ? popScale.value : 1);
    return {
      opacity,
      transform: [{ translateY: rel * ROW_SPACING }, { scale }],
    };
  });

  return (
    <Animated.Text style={[styles.reelRow, { color }, style]} numberOfLines={1}>
      {word.charAt(0).toUpperCase() + word.slice(1)}
    </Animated.Text>
  );
}

// Intro «Выбери слово» (148:444): a big two-line title over a clean
// background for ~1s, then it fades out and the drum is revealed.
function SpinIntro({ onDone }: { onDone: () => void }) {
  const { theme, ink } = useInk();
  const [visible, setVisible] = useState(true);
  const op = useSharedValue(1);
  const doneRef = useRef(onDone);
  useEffect(() => {
    doneRef.current = onDone;
  }, [onDone]);
  useEffect(() => {
    const hold = setTimeout(() => {
      op.value = withTiming(0, { duration: 300, easing: Easing.out(Easing.ease) });
    }, 1000);
    const done = setTimeout(() => {
      doneRef.current();
      setVisible(false);
    }, 1320);
    return () => {
      clearTimeout(hold);
      clearTimeout(done);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const wrapStyle = useAnimatedStyle(() => ({ opacity: op.value }));
  if (!visible) return null;
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, wrapStyle]}>
      <View style={[styles.introWrap, { backgroundColor: theme.bg }]}>
        <Text style={[styles.introTitle, { color: theme.text }]}>{"Выбери\nслово"}</Text>
        <Text style={[styles.introSub, { color: ink(0.5) }]}>Останови барабан - получишь слово</Text>
      </View>
    </Animated.View>
  );
}

// «Словарный запас» chip with the level glyph on a gold tile (148:473).
function LevelChip() {
  const { theme, ink } = useInk();
  return (
    <View style={[styles.levelChip, { backgroundColor: ink(0.06), borderColor: ink(0.1) }]}>
      <View style={[styles.levelTile, { backgroundColor: theme.accent }]}>
        <View style={styles.levelIconBox}>
          <View style={styles.levelIconScale}>
            <LevelIcon levelId="vocabulary" color="#262628" hole={theme.accent} />
          </View>
        </View>
      </View>
      <Text style={[styles.levelChipText, { color: theme.text }]}>Словарный запас</Text>
    </View>
  );
}

function SpinPhase({
  excludeIds,
  onPicked,
  onClose,
}: {
  excludeIds: string[];
  onPicked: (w: VocabWord) => void;
  onClose: () => void;
}) {
  const { theme, isDark, ink } = useInk();
  const pads = usePads();
  const [introDone, setIntroDone] = useState(false);
  // A finite reel of Russian words, frozen ONCE at mount. Because the strip is
  // built here (not derived from a live pool), the parent recording the picked
  // word — which changes excludeIds — can never reshuffle it mid-spin, so the
  // word you land on is exactly the word you play.
  const [reel] = useState<VocabWord[]>(() => {
    const available = VOCAB_WORDS_RU.filter((w) => !excludeIds.includes(w.id));
    const base = available.length > 0 ? available : VOCAB_WORDS_RU;
    const shuffled = [...base].sort(() => Math.random() - 0.5);
    return Array.from(
      { length: REEL_LEN },
      (_, i) => shuffled[i % shuffled.length],
    );
  });

  // Start near the END of the reel and count DOWN toward the start.
  const START_POS = REEL_LEN - 2;
  const pos = useSharedValue(START_POS);
  const popScale = useSharedValue(1);
  const [landIndex, setLandIndex] = useState<number | null>(null);
  const stoppedRef = useRef(false);

  const isSpinning = landIndex == null;

  // Continuous constant-speed sweep — starts immediately at mount (behind the
  // intro overlay) at FULL speed, so by the time the reel is revealed it's
  // already mid-spin.
  useEffect(() => {
    const travel = SPIN_SPEED * 11;
    const farTarget = Math.max(START_POS - travel, SETTLE_COLS + 1);
    pos.value = withTiming(farTarget, {
      duration: ((START_POS - farTarget) / SPIN_SPEED) * 1000,
      easing: Easing.linear,
    });
    return () => cancelAnimation(pos);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finishPick = useCallback(
    (idx: number) => {
      setLandIndex(idx);
      popScale.value = withSequence(
        withTiming(1.12, { duration: 220 }),
        withTiming(1, { duration: 260 }),
      );
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
      }
      onPicked(reel[idx]);
    },
    [popScale, onPicked, reel],
  );

  // Glide to a clean landing on STOP / auto-stop. Guarded so the button and the
  // timeout can't both trigger a landing.
  const stop = useCallback(() => {
    if (stoppedRef.current) return;
    stoppedRef.current = true;
    const land = Math.max(Math.round(pos.value) - SETTLE_COLS, 1);
    cancelAnimation(pos);
    pos.value = withTiming(
      land,
      { duration: 900, easing: Easing.out(Easing.cubic) },
      (finished) => {
        if (finished) runOnJS(finishPick)(land);
      },
    );
  }, [pos, finishPick]);

  const stopRef = useRef(stop);
  useEffect(() => {
    stopRef.current = stop;
  }, [stop]);
  // Auto-pick 7s after the reel is revealed.
  useEffect(() => {
    if (!introDone) return;
    const autoId = setTimeout(() => stopRef.current(), 7000);
    return () => clearTimeout(autoId);
  }, [introDone]);

  const fadeFrom = theme.bg;
  const fadeTo = isDark ? "rgba(38,38,40,0)" : "rgba(250,249,246,0)";

  return (
    <View style={[styles.spinRoot, { backgroundColor: theme.bg, paddingTop: pads.top + 8 }]}>
      <View style={styles.topBar}>
        <CloseButton onPress={onClose} />
        <View pointerEvents="none" style={styles.topCenter}>
          <LevelChip />
        </View>
      </View>

      <View style={styles.reelWindow}>
        {/* Gold selection pill (148:483). */}
        <View
          pointerEvents="none"
          style={[
            styles.selection,
            { borderColor: theme.accent, backgroundColor: isDark ? "rgba(255,216,87,0.08)" : "rgba(255,216,87,0.16)" },
          ]}
        />
        {introDone ? (
          <Animated.View entering={FadeIn.duration(320)} style={StyleSheet.absoluteFill}>
            {reel.map((w, i) => (
              <ReelRow
                key={i}
                word={w.word}
                index={i}
                pos={pos}
                popScale={popScale}
                landed={landIndex === i}
                color={theme.text}
              />
            ))}
          </Animated.View>
        ) : null}
        <LinearGradient
          pointerEvents="none"
          colors={[fadeFrom, fadeFrom, fadeTo]}
          locations={[0, 0.2, 1]}
          style={styles.fadeTop}
        />
        <LinearGradient pointerEvents="none" colors={[fadeTo, fadeFrom]} style={styles.fadeBottom} />
      </View>

      <View style={[styles.stopWrap, { paddingBottom: Platform.OS === "web" ? 58 : pads.insetBottom + 24 }]}>
        <Pressable
          onPress={() => stop()}
          disabled={!isSpinning}
          style={({ pressed }) => [
            styles.stopRound,
            {
              backgroundColor: theme.accent,
              borderColor: theme.ctaStroke,
              opacity: pressed || !isSpinning ? 0.85 : 1,
              transform: [{ scale: pressed ? 0.96 : 1 }],
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Стоп"
        >
          <Text style={[styles.stopRoundText, { color: theme.accentText }]}>СТОП</Text>
        </Pressable>
        <Text style={[styles.stopCaption, { color: ink(0.45) }]}>Нажми, чтобы остановить</Text>
      </View>

      <SpinIntro onDone={() => setIntroDone(true)} />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 2 — PLAY · «Отсчёт» + «Игра» (149:415 / 149:441 / 149:510 / 196:2013)
// ─────────────────────────────────────────────────────────────────────────────

function PlayPhase({
  word,
  foundSynonyms,
  feed,
  onAddCorrect,
  onAddWrong,
  onFinish,
  onExit,
  onReplace,
}: {
  word: VocabWord;
  foundSynonyms: string[];
  feed: FeedItem[];
  onAddCorrect: (syn: string) => void;
  onAddWrong: (text: string) => void;
  onFinish: () => void;
  onExit: () => void;
  onReplace: () => void;
}) {
  const { coins, spendCoins } = useGame();
  const pads = usePads();

  // Open confirm pop-up, if any (replace word / exit).
  const [modal, setModal] = useState<VocabModal>(null);
  // A simulated rewarded-ad flow. `adFor` remembers what the ad unlocks.
  const [adFor, setAdFor] = useState<VocabAdFor>(null);
  // Once revealed, the hint stays on screen for the rest of the round.
  const [hintRevealed, setHintRevealed] = useState(false);
  // Extra time (×2 the word's allotted time) — one grant per round.
  const [extraTimeUsed, setExtraTimeUsed] = useState(false);
  // Green "time added" flash on the timer.
  const [timeAddedFlash, setTimeAddedFlash] = useState(false);
  // Game is paused (timer frozen) while a confirm/ad modal is open.
  const paused = modal !== null || adFor !== null;
  const [stage, setStage] = useState<"countdown" | "active">("countdown");
  const [countdown, setCountdown] = useState(3);
  const [timeLeft, setTimeLeft] = useState(word.timerSeconds);
  const [recognitionError, setRecognitionError] = useState<string | null>(null);
  const [fallbackInput, setFallbackInput] = useState("");

  // Real microphone source for the waveform (web only — native waveform stays
  // flat to avoid a parallel mic capture that would conflict with the speech
  // recognizer's audio session).
  const [webStream, setWebStream] = useState<MediaStream | null>(null);
  const webStreamRef = useRef<MediaStream | null>(null);

  const { bars, reset: resetBars } = useWaveformBars({
    isRecording: stage === "active",
    isPaused: false,
    recording: null,
    webStream,
    maxBars: 40,
  });

  const srSubsRef = useRef<EventSubscription[]>([]);
  const srRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPlayingRef = useRef(false);
  const finishedRef = useRef(false);
  // Dedup wrong cards across repeated FINAL events (some recognizers replay
  // the last final payload on restart). Keyed by the joined final transcript.
  const wrongShownRef = useRef<Set<string>>(new Set());
  const [allFoundBanner, setAllFoundBanner] = useState(false);
  // Synchronous set of normalized matched synonyms — used to dedupe within
  // a single recognition event.
  const matchedNormSetRef = useRef<Set<string>>(new Set());

  const normForDedup = (s: string) => s.toLowerCase().trim().replace(/ё/g, "е");

  // Stable refs for prop callbacks + word synonyms so that startRecognition
  // doesn't change identity on every parent re-render.
  const onAddCorrectRef = useRef(onAddCorrect);
  const onAddWrongRef = useRef(onAddWrong);
  const synonymsRef = useRef(word.synonyms);
  useEffect(() => {
    onAddCorrectRef.current = onAddCorrect;
  }, [onAddCorrect]);
  useEffect(() => {
    onAddWrongRef.current = onAddWrong;
  }, [onAddWrong]);
  useEffect(() => {
    synonymsRef.current = word.synonyms;
  }, [word.synonyms]);

  // Auto-finish when all synonyms found.
  useEffect(() => {
    if (
      stage === "active" &&
      foundSynonyms.length >= word.synonyms.length &&
      !finishedRef.current
    ) {
      finishedRef.current = true;
      stopRecognition();
      setAllFoundBanner(true);
      setTimeout(() => onFinish(), 800);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [foundSynonyms.length, word.synonyms.length, stage]);

  // ── Timer ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (stage !== "active" || paused) return;
    const id = setInterval(() => {
      // Pure updater — finishing is handled by the effect below.
      setTimeLeft((t) => (t <= 1 ? 0 : t - 1));
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, paused]);

  // Time's up → finish.
  useEffect(() => {
    if (stage === "active" && timeLeft <= 0 && !finishedRef.current) {
      finishedRef.current = true;
      stopRecognition();
      onFinish();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, stage]);

  // ── Real microphone capture for the waveform (web) ───────────────────────
  const startMicCapture = useCallback(async () => {
    if (Platform.OS !== "web") return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      webStreamRef.current = stream;
      setWebStream(stream);
    } catch {
      // Mic blocked — waveform will stay flat but recognition/fallback still work.
    }
  }, []);

  const stopMicCapture = useCallback(async () => {
    if (Platform.OS === "web") {
      try {
        webStreamRef.current?.getTracks().forEach((t) => t.stop());
      } catch {}
      webStreamRef.current = null;
      setWebStream(null);
    }
    resetBars();
  }, [resetBars]);

  // Pre-warm the mic as soon as PlayPhase mounts (during countdown).
  useEffect(() => {
    startMicCapture();
    return () => {
      stopMicCapture();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Speech recognition (cross-platform via expo-speech-recognition) ──────
  const removeSrListeners = useCallback(() => {
    for (const sub of srSubsRef.current) {
      try {
        sub.remove();
      } catch {}
    }
    srSubsRef.current = [];
  }, []);

  const handleSrResult = useCallback(
    (event: ExpoSpeechRecognitionResultEvent) => {
      if (!isPlayingRef.current) return;
      let matchedThisEvent = false;
      let alreadyFoundThisEvent = false;
      const tokens: string[] = [];
      const transcripts: string[] = [];
      for (const r of event.results ?? []) {
        const transcript = r?.transcript ?? "";
        if (transcript) transcripts.push(transcript);
        const words = transcript
          .split(/[\s,.!?;:]+/)
          .map((w) => w.trim())
          .filter((w) => w.length > 1);
        for (const wd of words) {
          tokens.push(wd);
          const { matched, alreadyFound } = checkSynonymAdvanced(
            wd,
            synonymsRef.current,
            Array.from(matchedNormSetRef.current),
          );
          if (alreadyFound) alreadyFoundThisEvent = true;
          if (matched) {
            const key = normForDedup(matched);
            if (matchedNormSetRef.current.has(key)) {
              alreadyFoundThisEvent = true;
            } else {
              matchedNormSetRef.current.add(key);
              onAddCorrectRef.current(matched);
              matchedThisEvent = true;
            }
          }
        }
      }
      // One "wrong" card per FINAL result that produced no match.
      if (
        event.isFinal &&
        !matchedThisEvent &&
        !alreadyFoundThisEvent &&
        tokens.length > 0
      ) {
        const finalKey = transcripts.join("|").toLowerCase().trim();
        if (finalKey && !wrongShownRef.current.has(finalKey)) {
          wrongShownRef.current.add(finalKey);
          const lastToken = tokens[tokens.length - 1];
          if (lastToken && lastToken.length >= 3) {
            onAddWrongRef.current(lastToken);
          }
        }
      }
    },
    [],
  );

  const startRecognition = useCallback(async () => {
    const sr = getSpeechRecognitionModule();
    if (!sr || !sr.isRecognitionAvailable()) {
      setRecognitionError(
        "Распознавание речи недоступно в Expo Go. Введи синоним вручную или используй dev-сборку.",
      );
      return;
    }
    try {
      const perm = await sr.requestPermissionsAsync();
      if (!perm.granted) {
        setRecognitionError(
          "Доступ к микрофону или распознаванию запрещён. Введи синоним вручную.",
        );
        return;
      }
    } catch {
      setRecognitionError(
        "Не удалось получить доступ к микрофону. Введи синоним вручную.",
      );
      return;
    }

    // Clear any leftover listeners from a previous (e.g. hot-reloaded) session.
    removeSrListeners();

    srSubsRef.current.push(sr.addListener("result", handleSrResult));
    srSubsRef.current.push(
      sr.addListener("error", (event: ExpoSpeechRecognitionErrorEvent) => {
        // Terminal errors → fall back to text input.
        if (
          event.error === "not-allowed" ||
          event.error === "service-not-allowed" ||
          event.error === "audio-capture" ||
          event.error === "language-not-supported"
        ) {
          isPlayingRef.current = false;
          removeSrListeners();
          try {
            sr.abort();
          } catch {}
          setRecognitionError(
            event.error === "audio-capture"
              ? "Микрофон недоступен. Введи синоним вручную."
              : "Распознавание речи запрещено. Введи синоним вручную.",
          );
        }
        // Transient errors → the "end" listener restarts automatically.
      }),
    );
    srSubsRef.current.push(
      sr.addListener("end", () => {
        if (!isPlayingRef.current) return;
        // Auto-restart so recognition keeps streaming for the whole round.
        try {
          sr.start({
            lang: "ru-RU",
            interimResults: true,
            continuous: true,
            maxAlternatives: 3,
          });
        } catch {}
      }),
    );

    const tryStart = (attempt = 0) => {
      if (!isPlayingRef.current) return;
      try {
        sr.start({
          lang: "ru-RU",
          interimResults: true,
          continuous: true,
          maxAlternatives: 3,
        });
      } catch (err) {
        if (attempt < 3) {
          srRetryTimerRef.current = setTimeout(
            () => tryStart(attempt + 1),
            200,
          );
          return;
        }
        console.warn("[vocab] SR start failed", err);
        setRecognitionError("Не удалось запустить распознавание.");
      }
    };
    isPlayingRef.current = true;
    tryStart();
  }, [handleSrResult, removeSrListeners]);

  const stopRecognition = useCallback(() => {
    isPlayingRef.current = false;
    if (srRetryTimerRef.current) {
      clearTimeout(srRetryTimerRef.current);
      srRetryTimerRef.current = null;
    }
    removeSrListeners();
    try {
      getSpeechRecognitionModule()?.stop();
    } catch {}
  }, [removeSrListeners]);

  useEffect(() => {
    return () => {
      stopRecognition();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Countdown 3 → 2 → 1 → СТАРТ → auto-start recognition + timer.
  useEffect(() => {
    if (stage !== "countdown") return;
    if (countdown < 0) return;
    if (countdown === 0) {
      const id = setTimeout(() => {
        setStage("active");
        isPlayingRef.current = true;
        startRecognition();
        if (Platform.OS !== "web") {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(
            () => {},
          );
        }
      }, 1000);
      return () => clearTimeout(id);
    }
    const id = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(id);
    // startRecognition is stable (refs-based); intentionally omitted from deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, countdown]);

  const submitFallback = () => {
    const text = fallbackInput.trim();
    if (!text) return;
    setFallbackInput("");
    const { matched, alreadyFound } = checkSynonymAdvanced(
      text,
      word.synonyms,
      Array.from(matchedNormSetRef.current),
    );
    if (matched) {
      const key = normForDedup(matched);
      if (!matchedNormSetRef.current.has(key)) {
        matchedNormSetRef.current.add(key);
        onAddCorrect(matched);
      }
    } else if (!alreadyFound) {
      onAddWrong(text);
    }
  };

  const confirmExit = () => {
    setModal(null);
    stopRecognition();
    onExit();
  };

  // ── Replace-word & hint (coins / rewarded ad) ────────────────────────────
  const revealHint = () => {
    setHintRevealed(true);
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  };

  // "Заменить слово" → confirm. Pay with coins if affordable, otherwise fall
  // back to a rewarded ad.
  const confirmReplace = () => {
    setModal(null);
    if (coins >= REPLACE_COST) {
      if (spendCoins(REPLACE_COST)) {
        stopRecognition();
        onReplace();
      }
    } else {
      setAdFor("replace");
    }
  };

  // "Подсказка" → pay with coins if the player can afford it, otherwise the
  // player watches a rewarded ad to unlock the reveal for free.
  const requestHint = () => {
    if (hintRevealed) return;
    if (coins >= HINT_COST) {
      if (spendCoins(HINT_COST)) revealHint();
    } else {
      setAdFor("hint");
    }
  };

  // "×2" → doubles the word's allotted time (adds one more full allotment to
  // the remaining clock). Pay with coins, or watch a rewarded ad when short.
  const grantExtraTime = () => {
    setExtraTimeUsed(true);
    setTimeLeft((t) => t + word.timerSeconds);
    setTimeAddedFlash(true);
    setTimeout(() => setTimeAddedFlash(false), 1600);
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
  };
  const requestExtraTime = () => {
    if (extraTimeUsed || stage !== "active") return;
    if (coins >= EXTRA_TIME_COST) {
      if (spendCoins(EXTRA_TIME_COST)) grantExtraTime();
    } else {
      setAdFor("time");
    }
  };

  // Called when the simulated rewarded ad finishes. Grants whatever it unlocked.
  const onAdComplete = () => {
    const target = adFor;
    setAdFor(null);
    if (target === "replace") {
      stopRecognition();
      onReplace();
    } else if (target === "hint") {
      revealHint();
    } else if (target === "time") {
      grantExtraTime();
    }
  };

  // Timer component state: green flash on bonus, red in the last 10 seconds.
  const timerState: TimerState = timeAddedFlash
    ? "added"
    : stage === "active" && timeLeft > 0 && timeLeft <= 10
      ? "low"
      : "default";
  const timeTotal = word.timerSeconds * (extraTimeUsed ? 2 : 1);

  return (
    <VocabPlayView
      word={word}
      stage={stage}
      countdown={countdown}
      timeLeft={timeLeft}
      timeTotal={timeTotal}
      timerState={timerState}
      foundSynonyms={foundSynonyms}
      wrongItems={feed.filter((f) => f.status === "wrong")}
      bars={bars}
      paused={paused}
      hintRevealed={hintRevealed}
      allFoundBanner={allFoundBanner}
      coins={coins}
      extraTimeUsed={extraTimeUsed}
      recognitionError={recognitionError}
      fallbackInput={fallbackInput}
      onFallbackChange={setFallbackInput}
      onFallbackSubmit={submitFallback}
      modal={modal}
      adFor={adFor}
      topPad={pads.top}
      bottomPad={pads.bottom}
      onClosePress={() => setModal("exit")}
      onReplacePress={() => setModal("replace")}
      onHintPress={requestHint}
      onExtraTimePress={requestExtraTime}
      onConfirmReplace={confirmReplace}
      onConfirmExit={confirmExit}
      onDismissModal={() => setModal(null)}
      onAdCancel={() => setAdFor(null)}
      onAdComplete={onAdComplete}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 3 — RESULT · «Время вышло» (37:6698)
// ─────────────────────────────────────────────────────────────────────────────

function ResultPhase({
  word,
  foundSynonyms,
  score,
  onNext,
}: {
  word: VocabWord;
  foundSynonyms: string[];
  score: number;
  onNext: () => void;
}) {
  const pads = usePads();
  return (
    <VocabResultView
      word={word}
      foundSynonyms={foundSynonyms}
      score={score}
      onNext={onNext}
      topPad={pads.top}
      bottomPad={pads.insetBottom}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },

  topBar: { height: 42, flexDirection: "row", alignItems: "center", paddingHorizontal: 24 },
  topCenter: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  close: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },

  // Tutorial
  tutorialRoot: { flex: 1 },
  tutTitle: { fontFamily: "Geologica_900Black", fontSize: 32, letterSpacing: -0.32, textAlign: "center" },
  tutSub: { marginTop: 2, fontFamily: "Geologica_600SemiBold", fontSize: 16, textAlign: "center" },
  steps: {
    marginTop: 32,
    marginHorizontal: 24,
    borderWidth: 2,
    borderRadius: 22,
    paddingHorizontal: 15,
    paddingVertical: 15,
  },
  stepRow: { flexDirection: "row", alignItems: "center", gap: 14, minHeight: 32 },
  stepSep: { height: 1, marginLeft: 46, marginVertical: 15 },
  stepNum: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  stepNumText: { fontFamily: "Geologica_900Black", fontSize: 15 },
  stepText: { flex: 1, fontFamily: "Geologica_600SemiBold", fontSize: 15, lineHeight: 18 },
  tip: {
    marginTop: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 24,
  },
  tipDot: { width: 6, height: 6, borderRadius: 3 },
  tipText: { fontFamily: "Geologica_600SemiBold", fontSize: 13 },
  primaryBtn: {
    marginHorizontal: 24,
    height: 56,
    borderRadius: 32,
    borderWidth: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: { fontFamily: "Geologica_900Black", fontSize: 17 },

  // Spin
  spinRoot: { flex: 1 },
  levelChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingLeft: 6,
    paddingRight: 14,
    paddingVertical: 4,
    borderWidth: 2,
    borderRadius: 32,
  },
  levelTile: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  levelIconBox: { width: 18, height: 18, overflow: "visible" },
  levelIconScale: { position: "absolute", left: -4, top: -4, transform: [{ scale: 18 / 26 }] },
  levelChipText: { fontFamily: "Geologica_800ExtraBold", fontSize: 13 },
  introWrap: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 72, paddingHorizontal: 24 },
  introTitle: {
    fontFamily: "Geologica_900Black",
    fontSize: 56,
    lineHeight: 56,
    letterSpacing: -1.12,
    textAlign: "center",
  },
  introSub: { marginTop: 16, fontFamily: "Geologica_600SemiBold", fontSize: 15, textAlign: "center" },
  reelWindow: { flex: 1, overflow: "hidden" },
  selection: {
    position: "absolute",
    left: 24,
    right: 24,
    top: "50%",
    marginTop: CENTER_OFFSET - 38,
    height: 76,
    borderRadius: 32,
    borderWidth: 4,
  },
  reelRow: {
    position: "absolute",
    left: 0,
    right: 0,
    top: "50%",
    marginTop: CENTER_OFFSET - ROW_H / 2,
    height: ROW_H,
    lineHeight: ROW_H,
    fontSize: 36,
    letterSpacing: -0.72,
    textAlign: "center",
    paddingHorizontal: 40,
    fontFamily: "Geologica_900Black",
  },
  fadeTop: { position: "absolute", left: 0, right: 0, top: 0, height: 176 },
  fadeBottom: { position: "absolute", left: 0, right: 0, bottom: 0, height: 140 },
  stopWrap: { alignItems: "center" },
  stopRound: {
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  stopRoundText: { fontFamily: "Geologica_900Black", fontSize: 18, letterSpacing: 0.36 },
  stopCaption: { marginTop: 16, fontFamily: "Geologica_600SemiBold", fontSize: 13, textAlign: "center" },
});
