// Audio-diary record flow — two steps on one full-screen route:
//   1. "Screen / 06b · запись" (410:1750): blank cassette whose eyes are
//      spinning loaders, a reflective question card (↻ for another), a live
//      waveform from the mic level + timer, yellow stop button. The screen opens
//      READY (idle cassette, question card, big yellow play button); recording
//      starts only when the player taps play (mic permission is asked then).
//   2. "Screen / 06c · подпиши" (410:1903): close X (discard with confirm), big
//      cassette with an editable handwritten label and the chosen emotion as its
//      mouth, mood picker (7 pastel faces), «Сохранить» → back to the list.
//
// PRIVATE: the take is stored via lib/diaryStorage only (private document dir +
// AsyncStorage). Nothing here uploads or sends audio/metadata anywhere.
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  ScrollView,
  TextInput,
  Linking,
  BackHandler,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import Animated, {
  Easing,
  FadeIn,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "@/lib/haptics";
import { useLang, pickLang } from "@/context/LangContext";
import { useTheme } from "@/context/ThemeContext";
import AppDialog from "@/components/AppDialog";
import Cassette, { labelTextStyle, useDiaryFonts } from "@/components/diary/Cassette";
import { EMOTIONS, MoodFace, type PickableEmotion } from "@/components/diary/emotions";
import { addDiaryEntry, discardDiaryAudio, fmtClock, persistDiaryAudio } from "@/lib/diaryStorage";
import RecButton from "@/components/RecButton";

let Audio: any = null;
if (Platform.OS !== "web") {
  Audio = require("@/lib/av").Audio;
}

const MAX_SEC = 10 * 60; // auto-stop after 10 minutes
const BIG_CASSETTE = 236;
const TITLE_MAX = 18;
const TOP_ROW = 44; // room for the corner back / close button

const QUESTIONS: { ru: string; en: string; kk: string }[] = [
  { ru: "Что сегодня заставило тебя улыбнуться?", en: "What made you smile today?", kk: "Бүгін сізді не күлдірді?" },
  { ru: "Какой момент дня ты хочешь запомнить?", en: "Which moment of today do you want to remember?", kk: "Күннің қай сәтін есте сақтағыңыз келеді?" },
  { ru: "Что сегодня получилось лучше, чем ты ждал?", en: "What went better than you expected today?", kk: "Бүгін не күткеніңізден де жақсы шықты?" },
  { ru: "Что тебя сегодня удивило?", en: "What surprised you today?", kk: "Бүгін сізді не таң қалдырды?" },
  { ru: "О чём ты думаешь прямо сейчас?", en: "What are you thinking about right now?", kk: "Дәл қазір не туралы ойлап отырсыз?" },
  { ru: "Что было самым трудным сегодня?", en: "What was the hardest part of today?", kk: "Бүгін ең қиыны не болды?" },
  { ru: "За что ты можешь себя похвалить?", en: "What can you praise yourself for?", kk: "Өзіңізді не үшін мақтай аласыз?" },
  { ru: "Кому ты сегодня благодарен и почему?", en: "Who are you grateful to today, and why?", kk: "Бүгін кімге ризасыз және неге?" },
  { ru: "Что ты узнал сегодня нового?", en: "What did you learn today?", kk: "Бүгін қандай жаңа нәрсе білдіңіз?" },
  { ru: "Какое чувство было главным за день?", en: "Which feeling was the main one today?", kk: "Күні бойы қай сезім басым болды?" },
  { ru: "Что бы ты сделал иначе, если бы мог?", en: "What would you do differently if you could?", kk: "Мүмкіндігіңіз болса, нені басқаша істер едіңіз?" },
  { ru: "Чего ты ждёшь от завтрашнего дня?", en: "What are you looking forward to tomorrow?", kk: "Ертеңгі күннен не күтесіз?" },
  { ru: "Расскажи о разговоре, который тебе запомнился.", en: "Tell about a conversation you remember from today.", kk: "Есіңізде қалған бір әңгіме туралы айтып беріңіз." },
  { ru: "Что помогло тебе сегодня успокоиться?", en: "What helped you calm down today?", kk: "Бүгін сізге сабаңызға түсуге не көмектесті?" },
  { ru: "Когда сегодня ты почувствовал себя смелым?", en: "When did you feel brave today?", kk: "Бүгін қай кезде өзіңізді батыл сезіндіңіз?" },
  { ru: "Что тебя сейчас волнует больше всего?", en: "What's on your mind the most right now?", kk: "Қазір сізді ең көп не толғандырады?" },
  { ru: "Опиши свой день тремя словами — и объясни их.", en: "Describe your day in three words — and explain them.", kk: "Күніңізді үш сөзбен сипаттаңыз — және оларды түсіндіріңіз." },
  { ru: "Что маленькое, но приятное случилось сегодня?", en: "What small but nice thing happened today?", kk: "Бүгін қандай кішкентай, бірақ жағымды нәрсе болды?" },
  { ru: "О чём ты мечтаешь в последнее время?", en: "What have you been dreaming about lately?", kk: "Соңғы кезде не туралы армандайсыз?" },
  { ru: "Что ты хочешь сказать себе через год?", en: "What would you like to tell yourself a year from now?", kk: "Бір жылдан кейінгі өзіңізге не айтқыңыз келеді?" },
];

function pickQuestion(prev: number) {
  let i = Math.floor(Math.random() * QUESTIONS.length);
  if (i === prev) i = (i + 1) % QUESTIONS.length;
  return i;
}

type Phase = "ready" | "starting" | "recording" | "denied" | "sign";

type WebSession = { mr: MediaRecorder; stream: MediaStream; chunks: Blob[]; done: Promise<string | null> };

export default function DiaryRecordScreen() {
  const insets = useSafeAreaInsets();
  const { lang } = useLang();
  const tr = (ru: string, en: string, kk: string) => pickLang(lang, { ru, en, kk });
  const { theme: c } = useTheme();
  useDiaryFonts();
  const dark = c.mode === "dark";
  const cardBg = dark ? "#323234" : c.card;

  const [phase, setPhase] = useState<Phase>("ready");
  const [qIdx, setQIdx] = useState(() => pickQuestion(-1));
  const [elapsed, setElapsed] = useState(0);
  const [title, setTitle] = useState("");
  const [emotion, setEmotion] = useState<PickableEmotion | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [saving, setSaving] = useState(false);
  // Sign step: the cassette comes alive (blinks + sways) once a mood is picked.
  const [blinkKey, setBlinkKey] = useState(0);

  const recRef = useRef<any>(null);
  const webRef = useRef<WebSession | null>(null);
  const uriRef = useRef<string | null>(null);
  const savedRef = useRef(false);
  const startedAt = useRef(0);
  const durationRef = useRef(0);
  const stoppingRef = useRef(false);
  const aliveRef = useRef(true);

  // Mic level 0..1 drives the live waveform; hasMeter=0 → gentle placeholder.
  const level = useSharedValue(0);
  const hasMeter = useSharedValue(0);

  const topPad = Platform.OS === "web" ? 54 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  // ── start recording when the player taps play ──────────────────────────────
  const startRecording = useCallback(() => {
    if (phase !== "ready") return;
    setPhase("starting");
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    (async () => {
      const cancelledNow = () => !aliveRef.current;
      try {
        if (Platform.OS === "web") {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          if (cancelledNow()) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }
          const mimes = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
          const mime = mimes.find(
            (m) => typeof (MediaRecorder as any).isTypeSupported === "function" && MediaRecorder.isTypeSupported(m),
          );
          const mr = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
          const chunks: Blob[] = [];
          const done = new Promise<string | null>((resolve) => {
            mr.onstop = () => {
              try {
                stream.getTracks().forEach((t) => t.stop());
              } catch {}
              const blob = new Blob(chunks, { type: mr.mimeType || mime || "audio/webm" });
              resolve(blob.size > 0 ? URL.createObjectURL(blob) : null);
            };
          });
          mr.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
          mr.start(250);
          webRef.current = { mr, stream, chunks, done };
        } else {
          const perm = await Audio.requestPermissionsAsync();
          if (cancelledNow()) return;
          if (!perm?.granted) {
            setPhase("denied");
            return;
          }
          await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
          const base = Audio.RecordingOptionsPresets.HIGH_QUALITY;
          const { recording } = await Audio.Recording.createAsync({
            ...base,
            isMeteringEnabled: true,
            ios: { ...(base.ios ?? {}), meteringEnabled: true },
          });
          if (cancelledNow()) {
            try {
              await recording.stopAndUnloadAsync();
              await discardDiaryAudio(recording.getURI());
            } catch {}
            return;
          }
          recRef.current = recording;
          recording.setProgressUpdateInterval(80);
          recording.setOnRecordingStatusUpdate((st: any) => {
            const db = st?.metering;
            if (typeof db === "number" && Number.isFinite(db)) {
              hasMeter.value = 1;
              const v = Math.max(0, Math.min(1, (db + 55) / 50));
              level.value = withTiming(v, { duration: 90 });
            }
          });
        }
        startedAt.current = Date.now();
        setPhase("recording");
        if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      } catch (e) {
        console.warn("[diary] could not start recording:", e);
        if (!cancelledNow()) setPhase("denied");
      }
    })();
  }, [phase, hasMeter, level]);

  // Timer + auto-stop.
  useEffect(() => {
    if (phase !== "recording") return;
    const id = setInterval(() => {
      const sec = (Date.now() - startedAt.current) / 1000;
      setElapsed(sec);
      if (sec >= MAX_SEC) void stopRecording();
    }, 250);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Leaving the screen without saving never leaves a stray take behind.
  useEffect(
    () => () => {
      aliveRef.current = false;
      const rec = recRef.current;
      recRef.current = null;
      if (rec) {
        rec.setOnRecordingStatusUpdate(null);
        rec
          .stopAndUnloadAsync()
          .then(() => discardDiaryAudio(rec.getURI()))
          .catch(() => {});
        Audio.setAudioModeAsync({ allowsRecordingIOS: false }).catch(() => {});
      }
      const web = webRef.current;
      webRef.current = null;
      if (web && web.mr.state !== "inactive") {
        web.mr.stop();
        web.done.then((u) => discardDiaryAudio(u));
      }
      if (!savedRef.current) void discardDiaryAudio(uriRef.current);
    },
    [],
  );

  const stopRecording = useCallback(async () => {
    if (stoppingRef.current) return;
    stoppingRef.current = true;
    durationRef.current = Math.max(1, Math.round((Date.now() - startedAt.current) / 1000));
    let uri: string | null = null;
    try {
      if (Platform.OS === "web") {
        const web = webRef.current;
        webRef.current = null;
        if (web) {
          web.mr.stop();
          uri = await web.done;
        }
      } else {
        const rec = recRef.current;
        recRef.current = null;
        if (rec) {
          rec.setOnRecordingStatusUpdate(null);
          await rec.stopAndUnloadAsync();
          uri = rec.getURI();
        }
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      }
    } catch (e) {
      console.warn("[diary] stop failed:", e);
    }
    uriRef.current = uri;
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setPhase("sign");
  }, []);

  const leave = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace("/diary");
  }, []);

  // Back / close: nothing to lose before the mic is live; otherwise confirm.
  const requestExit = useCallback(() => {
    if (phase === "recording" || phase === "sign") setConfirmDiscard(true);
    else leave();
  }, [phase, leave]);

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      requestExit();
      return true;
    });
    return () => sub.remove();
  }, [requestExit]);

  const discardAndLeave = () => {
    setConfirmDiscard(false);
    // Unmount cleanup stops the recorder and deletes the file.
    leave();
  };

  const save = async () => {
    if (saving) return;
    const uri = uriRef.current;
    if (!uri) {
      leave();
      return;
    }
    setSaving(true);
    try {
      const stored = await persistDiaryAudio(uri);
      uriRef.current = stored;
      await addDiaryEntry({
        uri: stored,
        title: title.trim() || tr("мой день", "my day", "менің күнім"),
        emotion: emotion ?? "neutral",
        durationSec: durationRef.current,
      });
      savedRef.current = true;
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      leave();
    } catch (e) {
      console.warn("[diary] save failed:", e);
      setSaving(false);
    }
  };

  const q = QUESTIONS[qIdx];

  return (
    <View style={[s.container, { backgroundColor: c.bg }]}>
      {phase === "sign" ? (
        <ScrollView
          contentContainerStyle={[s.signScroll, { paddingTop: topPad + 10 + TOP_ROW, paddingBottom: bottomPad + 40 }]}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          showsVerticalScrollIndicator={false}
          alwaysBounceHorizontal={false}
        >
          <Animated.View entering={FadeIn.duration(260)} style={s.signCassette}>
            <Cassette
              width={BIG_CASSETTE}
              emotion={emotion ?? "neutral"}
              lively={blinkKey > 0}
              blinkKey={blinkKey}
              labelSlot={
                <TextInput
                  value={title}
                  onChangeText={(t) => setTitle(t.slice(0, TITLE_MAX))}
                  maxLength={TITLE_MAX}
                  autoFocus
                  placeholder={tr("подпиши меня", "name your tape", "маған ат қой")}
                  placeholderTextColor="rgba(43,42,51,0.35)"
                  selectionColor="#FFC414"
                  cursorColor="#FFC414"
                  returnKeyType="done"
                  submitBehavior="blurAndSubmit"
                  autoCorrect={false}
                  style={[labelTextStyle(BIG_CASSETTE), s.labelInput]}
                  accessibilityLabel={tr("Название кассеты", "Cassette title", "Кассета атауы")}
                />
              }
            />
          </Animated.View>

          <Text style={[s.signTitle, { color: c.text }]}>{tr("Подпиши кассету", "Sign your cassette", "Кассетаға ат қойыңыз")}</Text>

          <View style={[s.moodCard, { backgroundColor: cardBg }]}>
            <Text style={[s.moodTitle, { color: c.text }]}>{tr("Выбери своё ощущение", "How do you feel?", "Көңіл күйіңізді таңдаңыз")}</Text>
            <View style={s.moods}>
              {EMOTIONS.map((m) => {
                const on = emotion === m.key;
                return (
                  <Pressable
                    key={m.key}
                    onPress={() => {
                      setEmotion(on ? null : m.key);
                      setBlinkKey((n) => n + 1);
                      if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
                    }}
                    hitSlop={4}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={pickLang(lang, m)}
                    style={s.mood}
                  >
                    {on && <View style={[s.moodRing, { borderColor: c.text }]} />}
                    <MoodFace emotion={m.key} />
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={{ flex: 1, minHeight: 40 }} />
          <Pressable
            onPress={save}
            disabled={saving}
            style={({ pressed }) => [s.saveBtn, { opacity: saving ? 0.6 : pressed ? 0.85 : 1 }]}
            accessibilityRole="button"
          >
            <Text style={s.btnText}>{tr("Сохранить", "Save", "Сақтау")}</Text>
          </Pressable>
        </ScrollView>
      ) : (
        <View style={[s.recWrap, { paddingTop: topPad + 10 + TOP_ROW, paddingBottom: bottomPad + 60 }]}>

          <View style={s.recCassette}>
            <Cassette width={BIG_CASSETTE} state={phase === "recording" ? "recording" : "idle"} />
          </View>

          {phase === "denied" ? (
            <View style={[s.question, { backgroundColor: cardBg, flexDirection: "column", gap: 12 }]}>
              <Text style={[s.questionText, { color: c.text, textAlign: "center" }]}>
                {tr(
                  "Чтобы записать дневник, King Speech нужен микрофон. Разреши доступ в настройках.",
                  "King Speech needs the microphone to record your diary. Allow access in Settings.",
                  "Күнделік жазу үшін King Speech-ке микрофон керек. Баптаулардан рұқсат беріңіз.",
                )}
              </Text>
              {Platform.OS !== "web" && (
                <Pressable onPress={() => Linking.openSettings().catch(() => {})} style={s.settingsBtn}>
                  <Text style={s.btnText}>{tr("Открыть настройки", "Open Settings", "Баптауларды ашу")}</Text>
                </Pressable>
              )}
            </View>
          ) : (
            <View style={[s.question, { backgroundColor: cardBg }]}>
              <Text style={[s.questionText, { color: c.text }]}>{pickLang(lang, q)}</Text>
              <Pressable
                onPress={() => setQIdx((i) => pickQuestion(i))}
                hitSlop={10}
                style={s.refresh}
                accessibilityRole="button"
                accessibilityLabel={tr("Другой вопрос", "Another question", "Басқа сұрақ")}
              >
                <Ionicons name="shuffle" size={18} color={c.text} />
              </Pressable>
            </View>
          )}

          <View style={s.live}>
            {phase === "recording" && (
              <>
                <LiveWave level={level} hasMeter={hasMeter} color={c.text} />
                <Text style={[s.timer, { color: c.text }]}>{fmtClock(elapsed)}</Text>
              </>
            )}
          </View>

          {phase === "recording" ? (
            <RecButton
              kind="stop"
              onPress={stopRecording}
              accessibilityLabel={tr("Остановить запись", "Stop recording", "Жазуды тоқтату")}
            />
          ) : phase !== "denied" ? (
            <RecButton
              kind="record"
              onPress={startRecording}
              disabled={phase !== "ready"}
              accessibilityLabel={tr("Начать запись", "Start recording", "Жазуды бастау")}
            />
          ) : null}
        </View>
      )}

      {/* Corner buttons sit at the safe-area top, outside the centred column:
          back (top-left) while recording, discard X (top-right) on the sign step. */}
      {phase === "sign" ? (
        <Pressable
          onPress={requestExit}
          hitSlop={12}
          style={[s.iconBtn, s.cornerRight, { top: topPad + 10 }]}
          accessibilityRole="button"
          accessibilityLabel={tr("Удалить запись", "Discard", "Жазбаны жою")}
        >
          <Ionicons name="close" size={26} color={c.text} />
        </Pressable>
      ) : (
        <Pressable
          onPress={requestExit}
          hitSlop={12}
          style={[s.iconBtn, s.cornerLeft, { top: topPad + 10 }]}
          accessibilityRole="button"
          accessibilityLabel={tr("Назад", "Back", "Артқа")}
        >
          <Ionicons name="chevron-back" size={26} color={c.text} />
        </Pressable>
      )}

      <AppDialog
        visible={confirmDiscard}
        title={tr("Удалить эту запись?", "Discard this recording?", "Бұл жазбаны жою керек пе?")}
        message={tr("Кассета не сохранится.", "The cassette won't be saved.", "Кассета сақталмайды.")}
        buttons={[
          { label: tr("Удалить", "Discard", "Жою"), onPress: discardAndLeave, variant: "primary" },
          { label: tr("Остаться", "Keep", "Қалу"), onPress: () => setConfirmDiscard(false), variant: "secondary" },
        ]}
        onRequestClose={() => setConfirmDiscard(false)}
      />
    </View>
  );
}

// ── live waveform (Figma "Live waveform": 8 rounded bars, 12 wide) ───────────
const LIVE = [14, 30, 48, 64, 52, 38, 22, 12];

function LiveWave({
  level,
  hasMeter,
  color,
}: {
  level: SharedValue<number>;
  hasMeter: SharedValue<number>;
  color: string;
}) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(t);
  }, [t]);
  return (
    <View style={s.wave}>
      {LIVE.map((h, i) => (
        <LiveBar key={i} i={i} h={h} t={t} level={level} hasMeter={hasMeter} color={color} />
      ))}
    </View>
  );
}

function LiveBar({
  i,
  h,
  t,
  level,
  hasMeter,
  color,
}: {
  i: number;
  h: number;
  t: SharedValue<number>;
  level: SharedValue<number>;
  hasMeter: SharedValue<number>;
  color: string;
}) {
  const st = useAnimatedStyle(() => {
    const wobble = Math.abs(Math.sin(2 * Math.PI * (t.value + i * 0.13)));
    // Real mic level when metering is available, otherwise a calm "breathing".
    const amp = hasMeter.value ? level.value * (0.7 + 0.3 * wobble) : 0.25 + 0.35 * wobble;
    return { height: 12 + (h - 12) * Math.max(0.08, Math.min(1, amp)) };
  });
  return <Animated.View style={[s.bar, { backgroundColor: color }, st]} />;
}

const s = StyleSheet.create({
  container: { flex: 1 },
  iconBtn: { width: 44, height: 44, justifyContent: "center", alignItems: "center" },
  cornerLeft: { position: "absolute", left: 16, zIndex: 5 },
  cornerRight: { position: "absolute", right: 16, zIndex: 5 },

  recWrap: { flex: 1, alignItems: "center" },
  recCassette: { marginTop: 6 },
  question: {
    marginTop: 36,
    alignSelf: "stretch",
    marginHorizontal: 33,
    minHeight: 72,
    borderRadius: 20,
    paddingVertical: 16,
    paddingLeft: 18,
    paddingRight: 48,
    flexDirection: "row",
    alignItems: "center",
  },
  questionText: { flex: 1, fontSize: 16, lineHeight: 20, fontFamily: "Geologica_500Medium", textAlign: "center" },
  refresh: { position: "absolute", right: 18, top: 0, bottom: 0, justifyContent: "center", opacity: 0.7 },
  settingsBtn: {
    alignSelf: "center",
    height: 40,
    borderRadius: 20,
    paddingHorizontal: 20,
    backgroundColor: "#FFD857",
    justifyContent: "center",
  },
  live: { flex: 1, alignItems: "center", justifyContent: "center" },
  wave: { height: 70, flexDirection: "row", alignItems: "center", gap: 4.5, opacity: 0.6 },
  bar: { width: 12, borderRadius: 6 },
  timer: { marginTop: 14, fontSize: 15, fontFamily: "Geologica_600SemiBold", opacity: 0.6 },

  signScroll: { flexGrow: 1, alignItems: "center" },
  signCassette: { marginTop: 108 },
  labelInput: { padding: 0, margin: 0, includeFontPadding: false },
  signTitle: { marginTop: 25, fontSize: 22, letterSpacing: -0.3, fontFamily: "Geologica_800ExtraBold" },
  moodCard: {
    marginTop: 26,
    alignSelf: "stretch",
    marginHorizontal: 21,
    borderRadius: 24,
    paddingTop: 18,
    paddingBottom: 20,
    alignItems: "center",
  },
  moodTitle: { fontSize: 15, fontFamily: "Geologica_600SemiBold", opacity: 0.8 },
  moods: { flexDirection: "row", gap: 8, marginTop: 16 },
  mood: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  moodRing: { position: "absolute", top: -3, left: -3, right: -3, bottom: -3, borderRadius: 23, borderWidth: 2 },
  saveBtn: {
    height: 45,
    borderRadius: 24,
    paddingHorizontal: 30,
    minWidth: 136,
    backgroundColor: "#FFD857",
    alignItems: "center",
    justifyContent: "center",
  },
  btnText: { fontSize: 15, fontFamily: "Geologica_700Bold", color: "#262628" },
});
