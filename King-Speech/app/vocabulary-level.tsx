import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  getSpeechRecognitionModule,
  type ExpoSpeechRecognitionResultEvent,
  type ExpoSpeechRecognitionErrorEvent,
} from "@/lib/speechRecognition";
import type { EventSubscription } from "expo-modules-core";
import Animated, {
  FadeInDown,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  cancelAnimation,
} from "react-native-reanimated";

import {
  POS_LABELS_RU,
  DIFFICULTY_LABEL_RU,
  VOCAB_WORDS_RU,
  VocabWord,
  checkSynonymAdvanced,
} from "@/constants/vocabularyData";
import { useGame } from "@/context/GameContext";
import { WAVEFORM_BAR_MAX, useWaveformBars } from "@/hooks/useWaveformBars";

type Phase = "tutorial" | "spin" | "play" | "result";
type FeedItem = { id: string; word: string; status: "correct" | "wrong" };

const TUTORIAL_KEY = "vocab_tutorial_seen";
const SESSION_SHOWN_KEY = "@kingspeech_vocab_session_shown_v1";

const RED = "#FF3B30";
const BG = "#0A0F28";
const GREEN_BG = "rgba(39,80,10,0.55)";
const GREEN_BORDER = "#639922";
const GREEN_TEXT = "#C0DD97";

let sessionResetDone = false;

function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

const TOP_PAD = Platform.OS === "web" ? 80 : 56;

// ─────────────────────────────────────────────────────────────────────────────
// ROOT
// ─────────────────────────────────────────────────────────────────────────────

export default function VocabularyLevelScreen() {
  const params = useLocalSearchParams<{
    levelId?: string;
    moduleId?: string;
  }>();
  const levelId = String(params.levelId ?? "vocabulary");
  const { addXP, markLevelComplete } = useGame();

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
    return <View style={styles.root} />;
  }

  return (
    <View style={styles.root}>
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
          score={score}
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
          onExit={() => router.replace("/(tabs)")}
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
            if (router.canGoBack()) router.back();
            else router.replace("/(tabs)");
          }}
        />
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 0 — TUTORIAL
// ─────────────────────────────────────────────────────────────────────────────

function TutorialPhase({
  onDone,
  onClose,
}: {
  onDone: () => void;
  onClose: () => void;
}) {
  const rules: { n: number; text: string }[] = [
    { n: 1, text: "Нажми Стоп — получишь слово" },
    { n: 2, text: "Нажми Старт и говори синонимы" },
    { n: 3, text: "За каждый синоним +3 очка" },
    { n: 4, text: "Чем больше слов, тем выше балл" },
  ];

  return (
    <View style={styles.tutorialRoot}>
      <View style={styles.topBar}>
        <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={12}>
          <Ionicons name="close" size={24} color="#fff" />
        </Pressable>
        <Text style={styles.topTitle}>Словарный запас</Text>
        <View style={styles.closeBtn} />
      </View>

      <View style={styles.tutorialHeader}>
        <View style={styles.tutorialIconCircle}>
          <Ionicons name="book-outline" size={48} color={RED} />
        </View>
        <Text style={styles.tutorialH1}>Как играть</Text>
        <Text style={styles.tutorialH2}>Прочитай перед началом</Text>
      </View>

      <View style={styles.rulesCard}>
        {rules.map((r) => (
          <View key={r.n} style={styles.ruleRow}>
            <View style={styles.ruleNum}>
              <Text style={styles.ruleNumText}>{r.n}</Text>
            </View>
            <Text style={styles.ruleText}>{r.text}</Text>
          </View>
        ))}
      </View>

      <View style={{ flex: 1 }} />

      <Pressable
        onPress={onDone}
        style={({ pressed }) => [
          styles.primaryBtn,
          { opacity: pressed ? 0.85 : 1 },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Понятно, начать"
      >
        <Text style={styles.primaryBtnText}>Понятно, начать</Text>
      </Pressable>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 1 — SPIN
// ─────────────────────────────────────────────────────────────────────────────

function SpinPhase({
  excludeIds,
  onPicked,
  onClose,
}: {
  excludeIds: string[];
  onPicked: (w: VocabWord) => void;
  onClose: () => void;
}) {
  const pool = useMemo(() => {
    const available = VOCAB_WORDS_RU.filter((w) => !excludeIds.includes(w.id));
    const base = available.length > 0 ? available : VOCAB_WORDS_RU;
    return [...base].sort(() => Math.random() - 0.5);
  }, [excludeIds]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isSpinning, setIsSpinning] = useState(true);
  const [pickedWord, setPickedWord] = useState<VocabWord | null>(null);

  useEffect(() => {
    if (!isSpinning) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % pool.length);
    }, 120);
    return () => clearInterval(interval);
  }, [isSpinning, pool.length]);

  const prev = pool[(currentIndex - 1 + pool.length) % pool.length];
  const current = pool[currentIndex];
  const next = pool[(currentIndex + 1) % pool.length];

  // Auto-stop the roulette after 6s if the player hasn't pressed STOP.
  // Silent — no on-screen countdown — just picks whatever word is centered.
  const isSpinningRef = useRef(isSpinning);
  useEffect(() => {
    isSpinningRef.current = isSpinning;
  }, [isSpinning]);
  const currentRef = useRef(current);
  useEffect(() => {
    currentRef.current = current;
  }, [current]);
  useEffect(() => {
    const autoId = setTimeout(() => {
      if (isSpinningRef.current) {
        setIsSpinning(false);
        setPickedWord(currentRef.current);
        if (Platform.OS !== "web") {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(
            () => {},
          );
        }
        onPicked(currentRef.current);
      }
    }, 6000);
    return () => clearTimeout(autoId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Active word "snap" animation on every change while spinning.
  const activeScale = useSharedValue(1);
  useEffect(() => {
    if (!isSpinning) return;
    activeScale.value = 0.85;
    activeScale.value = withSpring(1, {
      damping: 18,
      stiffness: 320,
      mass: 0.4,
    });
  }, [currentIndex, isSpinning, activeScale]);

  // Picked word "pop" animation after stop.
  useEffect(() => {
    if (pickedWord) {
      activeScale.value = withSequence(
        withTiming(1.2, { duration: 250 }),
        withTiming(1.0, { duration: 250 }),
      );
    }
    return () => cancelAnimation(activeScale);
  }, [pickedWord, activeScale]);

  const activeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: activeScale.value }],
  }));

  const handleStop = () => {
    if (!isSpinning) return;
    setIsSpinning(false);
    setPickedWord(current);
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    }
    onPicked(current);
  };

  const diffLabel = DIFFICULTY_LABEL_RU[current.difficulty];

  return (
    <View style={styles.spinRoot}>
      <View style={styles.topBar}>
        <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={12}>
          <Ionicons name="close" size={24} color="#fff" />
        </Pressable>
        <Text style={styles.topTitle}>Выбери слово</Text>
        <View style={styles.closeBtn} />
      </View>

      <Text style={styles.spinSubtitle}>
        Слова меняются — нажми, когда будешь готов
      </Text>

      <View style={{ flex: 1, justifyContent: "center" }}>
        <View style={styles.rouletteBox}>
          <Text style={styles.rouletteEdge} numberOfLines={1}>
            {prev.word}
          </Text>
          <Animated.Text
            style={[styles.rouletteActive, activeStyle]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {current.word.toUpperCase()}
          </Animated.Text>
          <Text style={styles.rouletteEdge} numberOfLines={1}>
            {next.word}
          </Text>
        </View>

        <Text style={styles.rouletteMeta}>
          {POS_LABELS_RU[current.partOfSpeech]} · {diffLabel}
        </Text>
      </View>

      <View style={styles.stopBtnWrap}>
        <Pressable
          onPress={handleStop}
          disabled={!isSpinning}
          style={({ pressed }) => [
            styles.stopRound,
            { opacity: pressed || !isSpinning ? 0.85 : 1 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Стоп"
        >
          <Text style={styles.stopRoundText}>СТОП</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 2 — PLAY
// ─────────────────────────────────────────────────────────────────────────────

function PlayPhase({
  word,
  foundSynonyms,
  score,
  feed,
  onAddCorrect,
  onAddWrong,
  onFinish,
  onExit,
}: {
  word: VocabWord;
  foundSynonyms: string[];
  score: number;
  feed: FeedItem[];
  onAddCorrect: (syn: string) => void;
  onAddWrong: (text: string) => void;
  onFinish: () => void;
  onExit: () => void;
}) {
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
  // a single recognition event (state updates from onAddCorrect would
  // otherwise lag behind tight loops).
  const matchedNormSetRef = useRef<Set<string>>(new Set());
  const foundRef = useRef<string[]>(foundSynonyms);
  useEffect(() => {
    foundRef.current = foundSynonyms;
  }, [foundSynonyms]);

  const normForDedup = (s: string) => s.toLowerCase().trim().replace(/ё/g, "е");

  // Stable refs for prop callbacks + word synonyms so that startRecognition
  // doesn't change identity on every parent re-render. Without this, the
  // countdown effect would re-subscribe (and clear its setTimeout) on each
  // render, occasionally postponing the auto-start indefinitely.
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
    if (stage !== "active") return;
    const id = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(id);
          if (!finishedRef.current) {
            finishedRef.current = true;
            stopRecognition();
            onFinish();
          }
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  // ── Real microphone capture for the waveform ──────────────────────────────
  // On web we grab a getUserMedia stream — Web Speech API is happy to share it.
  // On native we DO NOT open a separate expo-av Recording: the speech
  // recognizer (Apple Speech / Android SpeechRecognizer) owns the AVAudioSession,
  // and a parallel expo-av recorder would either fail to start or kick the
  // recognizer off the mic. Native waveform stays flat — acceptable trade-off.
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
  // This makes the browser permission prompt appear with a fresh user
  // gesture (the STOP click or spin auto-pick), so recording is fully
  // ready by the time the countdown reaches "СТАРТ".
  useEffect(() => {
    startMicCapture();
    return () => {
      stopMicCapture();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Speech recognition (cross-platform via expo-speech-recognition) ──────
  // Same API on iOS (SFSpeechRecognizer), Android (SpeechRecognizer) and Web
  // (Web Speech API). We register listeners once per start session, get
  // streaming interim results, and feed each token through the local
  // checkSynonymAdvanced — no server, no network round-trip.
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
      // One "wrong" card per FINAL result that produced no match. Silent on
      // interim results and on already-counted repeats (spec). Dedupe by the
      // joined final transcript so a recognizer that replays the same final
      // payload after a restart doesn't spawn duplicate red cards.
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

    srSubsRef.current.push(
      sr.addListener("result", handleSrResult),
    );
    srSubsRef.current.push(
      sr.addListener(
        "error",
        (event: ExpoSpeechRecognitionErrorEvent) => {
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
          // Transient (no-speech / busy / network / speech-timeout) → the
          // "end" listener will restart automatically while isPlayingRef holds.
        },
      ),
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
      // Bail out if the round was torn down between attempts — prevents
      // a delayed retry from re-arming SR after stopRecognition().
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

  const handleStopActive = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    stopRecognition();
    onFinish();
  };

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

  const handleExitPress = () => {
    Alert.alert("Выйти?", "Прогресс этого задания не сохранится", [
      { text: "Остаться", style: "cancel" },
      {
        text: "Выйти",
        style: "destructive",
        onPress: () => {
          stopRecognition();
          onExit();
        },
      },
    ]);
  };

  // ── Timer animations ─────────────────────────────────────────────────────
  const shakeX = useSharedValue(0);
  const bgOpacity = useSharedValue(0);
  useEffect(() => {
    if (stage !== "active") return;
    if (timeLeft > 0 && timeLeft <= 5) {
      shakeX.value = withRepeat(
        withSequence(
          withTiming(-4, { duration: 40 }),
          withTiming(4, { duration: 40 }),
          withTiming(0, { duration: 40 }),
        ),
        -1,
        false,
      );
      bgOpacity.value = withRepeat(
        withSequence(
          withTiming(0.05, { duration: 400 }),
          withTiming(0, { duration: 400 }),
        ),
        -1,
        false,
      );
    } else if (timeLeft > 0 && timeLeft <= 10) {
      shakeX.value = withRepeat(
        withSequence(
          withTiming(-4, { duration: 60 }),
          withTiming(4, { duration: 60 }),
          withTiming(0, { duration: 60 }),
        ),
        -1,
        false,
      );
      bgOpacity.value = withTiming(0, { duration: 200 });
    } else {
      cancelAnimation(shakeX);
      cancelAnimation(bgOpacity);
      shakeX.value = withTiming(0, { duration: 100 });
      bgOpacity.value = withTiming(0, { duration: 100 });
    }
    return () => {
      cancelAnimation(shakeX);
      cancelAnimation(bgOpacity);
    };
  }, [timeLeft, stage, shakeX, bgOpacity]);

  const timerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }],
  }));
  const bgStyle = useAnimatedStyle(() => ({
    backgroundColor: `rgba(255,59,48,${bgOpacity.value})`,
  }));

  const timerColor = timeLeft <= 10 && timeLeft > 0 ? RED : "#fff";
  const timerText = `${String(Math.floor(timeLeft / 60)).padStart(2, "0")}:${String(
    timeLeft % 60,
  ).padStart(2, "0")}`;

  // Auto-scroll feed to bottom.
  const feedScrollRef = useRef<ScrollView>(null);
  useEffect(() => {
    feedScrollRef.current?.scrollToEnd({ animated: true });
  }, [feed.length]);

  return (
    <View style={styles.playRoot}>
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFillObject, bgStyle]}
      />

      <View style={styles.topBar}>
        <Pressable
          onPress={handleExitPress}
          style={styles.closeBtn}
          hitSlop={12}
        >
          <Ionicons name="close" size={24} color="#fff" />
        </Pressable>
        <Animated.View style={timerStyle}>
          <Text
            style={[
              styles.playTimer,
              {
                color:
                  stage === "active" ? timerColor : "rgba(255,255,255,0.40)",
              },
            ]}
          >
            {stage === "active" ? timerText : `${word.timerSeconds} сек`}
          </Text>
        </Animated.View>
        <View style={styles.closeBtn} />
      </View>

      <View style={styles.playWordBlock}>
        <Text style={styles.playWord} numberOfLines={1} adjustsFontSizeToFit>
          {word.word.toUpperCase()}
        </Text>
        <Text style={styles.playMeta}>
          {POS_LABELS_RU[word.partOfSpeech]}
          {stage === "countdown"
            ? ` · ${DIFFICULTY_LABEL_RU[word.difficulty]}`
            : ""}
        </Text>
      </View>

      {stage === "countdown" ? (
        <View style={styles.countdownBody}>
          <View style={{ flex: 1 }} />
          <Animated.Text
            key={countdown}
            entering={FadeInDown.duration(180)}
            style={styles.countdownNumber}
          >
            {countdown === 0 ? "СТАРТ" : countdown}
          </Animated.Text>
          <Text style={styles.countdownHint}>Готовься называть синонимы</Text>
          <View style={{ flex: 1 }} />
        </View>
      ) : (
        <>
          <View style={styles.waveStrip}>
            {bars.map((b) => (
              <View
                key={b.id}
                style={[
                  styles.waveBar,
                  {
                    height: Math.max(4, (b.height / WAVEFORM_BAR_MAX) * 40),
                    opacity: b.opacity,
                  },
                ]}
              />
            ))}
          </View>

          <ScrollView
            ref={feedScrollRef}
            style={styles.feedScroll}
            contentContainerStyle={styles.feedContent}
            showsVerticalScrollIndicator={false}
          >
            {feed.map((item) =>
              item.status === "correct" ? (
                <Animated.View
                  key={item.id}
                  entering={FadeInDown.duration(200)}
                  style={styles.feedCorrect}
                >
                  <Text style={styles.feedCorrectText}>+ {item.word} +3</Text>
                </Animated.View>
              ) : (
                <Animated.View
                  key={item.id}
                  entering={FadeInDown.duration(200)}
                  exiting={FadeOut.duration(300)}
                  style={styles.feedWrong}
                >
                  <Text style={styles.feedWrongText}>x {item.word}</Text>
                </Animated.View>
              ),
            )}
          </ScrollView>

          <Text style={styles.playCounter}>
            {foundSynonyms.length} из {word.synonyms.length} · {score} очков
          </Text>

          {allFoundBanner ? (
            <View style={styles.allFoundBanner}>
              <Text style={styles.allFoundText}>
                Отлично! Все синонимы найдены!
              </Text>
            </View>
          ) : null}

          <View style={styles.activeRow}>
            <Pressable
              onPress={handleStopActive}
              style={({ pressed }) => [
                styles.activeRowSide,
                { opacity: pressed ? 0.7 : 1 },
              ]}
              accessibilityLabel="Стоп"
            >
              <Ionicons name="stop" size={20} color={RED} />
            </Pressable>

            <View style={styles.activeRowCenter}>
              <Text style={styles.activeRowCenterText}>Слушаю…</Text>
            </View>

            <View style={styles.activeRowSide}>
              <Ionicons name="mic" size={20} color={RED} />
            </View>
          </View>

          {recognitionError ? (
            <View style={styles.fallbackBox}>
              <Text style={styles.fallbackText}>{recognitionError}</Text>
              <View style={styles.fallbackRow}>
                <TextInput
                  value={fallbackInput}
                  onChangeText={setFallbackInput}
                  placeholder="Введите синоним"
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  style={styles.fallbackInput}
                  onSubmitEditing={submitFallback}
                  returnKeyType="send"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Pressable
                  onPress={submitFallback}
                  style={({ pressed }) => [
                    styles.fallbackSend,
                    { opacity: pressed ? 0.8 : 1 },
                  ]}
                >
                  <Ionicons name="send" size={18} color="#fff" />
                </Pressable>
              </View>
            </View>
          ) : null}
        </>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 3 — RESULT
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
  const [animFound, setAnimFound] = useState(0);
  const [animScore, setAnimScore] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const dur = 1200;
    const finalFound = foundSynonyms.length;
    const finalScore = score;
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);
    const id = setInterval(() => {
      const elapsed = Date.now() - start;
      const t = Math.min(1, elapsed / dur);
      const eased = ease(t);
      setAnimFound(Math.round(eased * finalFound));
      setAnimScore(Math.round(eased * finalScore));
      if (t >= 1) clearInterval(id);
    }, 30);
    return () => clearInterval(id);
  }, [foundSynonyms.length, score]);

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={styles.resultContent}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.resultTitle}>Время вышло!</Text>
      <Text style={styles.resultWord}>Слово: {word.word.toUpperCase()}</Text>

      <Text style={styles.resultBigCount}>{animFound}</Text>
      <Text style={styles.resultScore}>{animScore} очков</Text>

      {foundSynonyms.length > 0 ? (
        <>
          <Text style={styles.resultSubtitle}>Ты назвал:</Text>
          <View style={styles.synList}>
            {foundSynonyms.map((syn, idx) => (
              <Animated.View
                key={`${syn}-${idx}`}
                entering={FadeInDown.delay(idx * 80).duration(220)}
                style={styles.foundChip}
              >
                <Text style={styles.foundChipText}>+ {syn}</Text>
              </Animated.View>
            ))}
          </View>
        </>
      ) : (
        <Text style={styles.resultEncourage}>
          В следующий раз получится!
        </Text>
      )}

      <Pressable
        onPress={onNext}
        style={({ pressed }) => [
          styles.primaryBtn,
          { opacity: pressed ? 0.85 : 1, marginTop: 28 },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Далее"
      >
        <Text style={styles.primaryBtnText}>Далее</Text>
      </Pressable>
    </ScrollView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },

  // Top bar shared
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: TOP_PAD,
    paddingBottom: 8,
  },
  topTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  closeBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.06)",
  },

  // Tutorial
  tutorialRoot: {
    flex: 1,
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  tutorialHeader: {
    alignItems: "center",
    marginTop: 24,
    marginBottom: 28,
  },
  tutorialIconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,59,48,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,59,48,0.25)",
    marginBottom: 16,
  },
  tutorialH1: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  tutorialH2: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 14,
    marginTop: 6,
  },
  rulesCard: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 14,
    padding: 18,
    gap: 14,
  },
  ruleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  ruleNum: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,59,48,0.2)",
  },
  ruleNumText: {
    color: RED,
    fontSize: 11,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  ruleText: {
    flex: 1,
    color: "rgba(255,255,255,0.65)",
    fontSize: 13,
    lineHeight: 19,
  },

  // Spin
  spinRoot: { flex: 1 },
  spinSubtitle: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 14,
    textAlign: "center",
    paddingHorizontal: 24,
    marginTop: 4,
  },
  rouletteBox: {
    marginHorizontal: 24,
    backgroundColor: "rgba(255,59,48,0.06)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,59,48,0.2)",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    overflow: "hidden",
  },
  rouletteEdge: {
    fontSize: 16,
    color: "rgba(255,255,255,0.22)",
    marginVertical: 6,
    textAlign: "center",
  },
  rouletteActive: {
    fontSize: 28,
    fontWeight: "700",
    color: RED,
    letterSpacing: 5,
    textAlign: "center",
    marginVertical: 6,
    fontFamily: "Inter_700Bold",
  },
  rouletteMeta: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 12,
    textAlign: "center",
    marginTop: 14,
  },
  stopBtnWrap: {
    alignItems: "center",
    paddingBottom: Platform.OS === "web" ? 32 : 24,
  },
  stopRound: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: RED,
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      ios: {
        shadowColor: RED,
        shadowOpacity: 0.45,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 6 },
      },
      android: { elevation: 6 },
      default: {},
    }),
  },
  stopRoundText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 3,
    fontFamily: "Inter_700Bold",
  },

  // Play
  playRoot: { flex: 1, paddingBottom: 24 },
  playTimer: {
    fontSize: 18,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.5,
  },
  playWordBlock: { alignItems: "center", marginTop: 18, marginBottom: 8 },
  playWord: {
    color: "#fff",
    fontSize: 32,
    fontWeight: "700",
    letterSpacing: 6,
    textAlign: "center",
    paddingHorizontal: 20,
    fontFamily: "Inter_700Bold",
  },
  playMeta: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 13,
    marginTop: 8,
  },

  countdownBody: {
    flex: 1,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  countdownNumber: {
    color: "#fff",
    fontSize: 96,
    fontWeight: "800",
    textAlign: "center",
    fontFamily: "Inter_700Bold",
    letterSpacing: 2,
  },
  countdownHint: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 14,
    marginTop: 18,
    textAlign: "center",
  },

  waveStrip: {
    marginHorizontal: 24,
    marginTop: 12,
    marginBottom: 12,
    height: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 3,
    overflow: "hidden",
  },
  waveBar: {
    width: 3,
    borderRadius: 2,
    backgroundColor: RED,
  },
  activeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 20,
    marginTop: 12,
    gap: 12,
  },
  activeRowSide: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,59,48,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,59,48,0.28)",
  },
  activeRowCenter: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,59,48,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,59,48,0.18)",
  },
  activeRowCenterText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  feedScroll: {
    flexGrow: 0,
    maxHeight: 160,
    marginHorizontal: 20,
    marginTop: 4,
  },
  allFoundBanner: {
    marginHorizontal: 20,
    marginTop: 10,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "rgba(99,153,34,0.18)",
    borderWidth: 1,
    borderColor: GREEN_BORDER,
    alignItems: "center",
  },
  allFoundText: {
    color: GREEN_TEXT,
    fontSize: 14,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  feedContent: { paddingVertical: 4, gap: 6 },
  feedCorrect: {
    backgroundColor: GREEN_BG,
    borderColor: GREEN_BORDER,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  feedCorrectText: { color: GREEN_TEXT, fontSize: 14, fontWeight: "600" },
  feedWrong: {
    backgroundColor: "rgba(160,40,40,0.45)",
    borderColor: "rgba(255,59,48,0.35)",
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  feedWrongText: { color: "rgba(255,255,255,0.35)", fontSize: 14 },
  playCounter: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 14,
    textAlign: "center",
    marginTop: 12,
    marginBottom: 4,
  },

  fallbackBox: {
    marginHorizontal: 20,
    marginTop: 12,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 12,
    padding: 12,
  },
  fallbackText: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 12,
    marginBottom: 8,
    textAlign: "center",
  },
  fallbackRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  fallbackInput: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    paddingHorizontal: 12,
    backgroundColor: "rgba(255,255,255,0.08)",
    color: "#fff",
  },
  fallbackSend: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: RED,
    alignItems: "center",
    justifyContent: "center",
  },

  // Result
  resultContent: {
    paddingTop: TOP_PAD,
    paddingHorizontal: 24,
    paddingBottom: 48,
    alignItems: "center",
  },
  resultTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  resultWord: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 14,
    marginTop: 8,
    letterSpacing: 1,
  },
  resultBigCount: {
    color: "#fff",
    fontSize: 64,
    fontWeight: "800",
    marginTop: 28,
    fontFamily: "Inter_700Bold",
  },
  resultScore: {
    color: RED,
    fontSize: 28,
    fontWeight: "700",
    marginTop: 12,
    fontFamily: "Inter_700Bold",
  },
  resultSubtitle: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 14,
    marginTop: 28,
    marginBottom: 12,
    alignSelf: "flex-start",
    fontFamily: "Inter_500Medium",
  },
  resultEncourage: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 16,
    marginTop: 32,
    textAlign: "center",
    fontStyle: "italic",
  },
  synList: {
    flexDirection: "row",
    flexWrap: "wrap",
    width: "100%",
    gap: 8,
  },
  foundChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: "rgba(39,80,10,0.55)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GREEN_BORDER,
  },
  foundChipText: {
    color: "#C0DD97",
    fontSize: 13,
    fontWeight: "500",
    fontFamily: "Inter_500Medium",
  },

  // Shared primary button
  primaryBtn: {
    width: "100%",
    height: 54,
    borderRadius: 27,
    backgroundColor: RED,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
});
