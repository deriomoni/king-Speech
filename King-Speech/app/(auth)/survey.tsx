// Sign-up, step 2 — a short questionnaire on black, one question per screen.
// Only to learn who the player is (motivation, where they speak, how they feel
// about it now, how much time they have); the answers live in the profile.
// Finishing completes the profile and the root gate moves on to onboarding.
import React, { useCallback, useRef, useState } from "react";
import { BackHandler, Platform, Pressable, StatusBar, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInLeft, FadeInRight, FadeOutLeft, FadeOutRight } from "react-native-reanimated";
import { useLang, pickLang } from "@/context/LangContext";
import { useAuth } from "@/context/AuthContext";
import { rs } from "@/lib/responsive";
import { playUi } from "@/lib/uiSound";

type L = { ru: string; en: string; kk: string };
type Q = { id: string; title: L; hint?: L; multi: boolean; options: { id: string; label: L }[] };

const QUESTIONS: Q[] = [
  {
    id: "why",
    title: { ru: "Что вдохновило вас начать?", en: "What made you start?", kk: "Бастауға не шабыттандырды?" },
    hint: { ru: "Можно выбрать несколько", en: "Pick as many as you like", kk: "Бірнешеуін таңдауға болады" },
    multi: true,
    options: [
      { id: "work", label: { ru: "Для работы", en: "For work", kk: "Жұмыс үшін" } },
      { id: "study", label: { ru: "Для учёбы", en: "For studies", kk: "Оқу үшін" } },
      { id: "interviews", label: { ru: "Собеседования", en: "Job interviews", kk: "Сұхбаттар" } },
      { id: "public", label: { ru: "Выступать на публике", en: "Public speaking", kk: "Көпшілік алдында сөйлеу" } },
      { id: "confidence", label: { ru: "Уверенность в себе", en: "Self-confidence", kk: "Өзіне сенім" } },
      { id: "blog", label: { ru: "Блог и видео", en: "Blogging & video", kk: "Блог пен видео" } },
      { id: "self", label: { ru: "Просто для себя", en: "Just for me", kk: "Өзім үшін" } },
    ],
  },
  {
    id: "where",
    title: { ru: "Где вам чаще всего нужно говорить?", en: "Where do you speak most often?", kk: "Көбіне қай жерде сөйлеуге тура келеді?" },
    hint: { ru: "Можно выбрать несколько", en: "Pick as many as you like", kk: "Бірнешеуін таңдауға болады" },
    multi: true,
    options: [
      { id: "meetings", label: { ru: "Встречи и созвоны", en: "Meetings & calls", kk: "Кездесулер мен қоңыраулар" } },
      { id: "presentations", label: { ru: "Презентации", en: "Presentations", kk: "Презентациялар" } },
      { id: "classes", label: { ru: "Пары и уроки", en: "Classes", kk: "Сабақтар" } },
      { id: "events", label: { ru: "Сцена и мероприятия", en: "Stage & events", kk: "Сахна мен іс-шаралар" } },
      { id: "daily", label: { ru: "Обычные разговоры", en: "Everyday talk", kk: "Күнделікті әңгіме" } },
    ],
  },
  {
    id: "feel",
    title: { ru: "Как вы сейчас чувствуете себя, когда говорите?", en: "How do you feel when you speak now?", kk: "Қазір сөйлегенде өзіңізді қалай сезінесіз?" },
    multi: false,
    options: [
      { id: "nervous", label: { ru: "Сильно волнуюсь", en: "Very nervous", kk: "Қатты толқимын" } },
      { id: "unsure", label: { ru: "Бывает неуверенно", en: "Sometimes unsure", kk: "Кейде сенімсіз" } },
      { id: "ok", label: { ru: "В целом нормально", en: "Mostly fine", kk: "Жалпы жақсы" } },
      { id: "confident", label: { ru: "Уверенно — хочу лучше", en: "Confident — want more", kk: "Сенімді — жақсартқым келеді" } },
    ],
  },
  {
    id: "time",
    title: { ru: "Сколько времени в день готовы уделять?", en: "How much time a day can you give?", kk: "Күніне қанша уақыт бөле аласыз?" },
    multi: false,
    options: [
      { id: "5", label: { ru: "5 минут", en: "5 minutes", kk: "5 минут" } },
      { id: "10", label: { ru: "10 минут", en: "10 minutes", kk: "10 минут" } },
      { id: "15", label: { ru: "15 минут", en: "15 minutes", kk: "15 минут" } },
      { id: "20", label: { ru: "20 минут и больше", en: "20+ minutes", kk: "20 минут және одан көп" } },
    ],
  },
];

export default function SurveyScreen() {
  const insets = useSafeAreaInsets();
  const { lang } = useLang();
  const tr = (v: L) => pickLang(lang, v);
  const { saveSurvey } = useAuth();

  const router = useRouter();
  const [i, setI] = useState(0);
  // which way the questions slide: forward → from the right, back → from the left
  const [dir, setDir] = useState<1 | -1>(1);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);

  const q = QUESTIONS[i];
  const picked = answers[q.id] ?? [];
  const isLast = i === QUESTIONS.length - 1;
  const topPad = Platform.OS === "web" ? 54 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const next = async (a = answers) => {
    if (!isLast) {
      setDir(1);
      setI(i + 1);
      return;
    }
    if (saving) return;
    setSaving(true);
    await saveSurvey(a); // completes the profile → the root gate opens onboarding
  };

  const toggle = (id: string) => {
    if (q.multi) {
      // functional update: quick double taps never drop a choice
      setAnswers((prev) => {
        const cur = prev[q.id] ?? [];
        return { ...prev, [q.id]: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] };
      });
    } else {
      const a = { ...answers, [q.id]: [id] };
      setAnswers(a);
      // single choice: move on by itself
      pending.current = setTimeout(() => next(a), 220);
    }
  };

  // a mistap? step back: the previous question keeps its answers to change;
  // from the first one — back to the age
  const back = useCallback(() => {
    if (saving) return true;
    if (pending.current) clearTimeout(pending.current);
    if (i > 0) {
      playUi("back");
      setDir(-1);
      setI(i - 1);
    } else if (router.canGoBack()) {
      router.back();
    }
    return true;
  }, [i, saving, router]);

  // Android hardware back does the same
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener("hardwareBackPress", back);
      return () => sub.remove();
    }, [back]),
  );

  return (
    <View style={[s.root, { paddingTop: topPad + rs(16), paddingBottom: bottomPad + rs(20) }]}>
      <StatusBar barStyle="light-content" />

      <Pressable onPress={back} hitSlop={12} style={s.back} accessibilityLabel={tr({ ru: "Назад", en: "Back", kk: "Артқа" })}>
        <Ionicons name="chevron-back" size={rs(26)} color="#FFFFFF" />
      </Pressable>

      {/* progress */}
      <View style={s.progress}>
        {QUESTIONS.map((_, k) => (
          <View key={k} style={[s.dash, k <= i && s.dashOn]} />
        ))}
      </View>

      <Animated.View key={q.id} entering={(dir === 1 ? FadeInRight : FadeInLeft).duration(380)}
        exiting={(dir === 1 ? FadeOutLeft : FadeOutRight).duration(220)} style={s.block}>
        <Text style={s.title}>{tr(q.title)}</Text>
        {q.hint ? <Text style={s.hint}>{tr(q.hint)}</Text> : null}
        <View style={s.options}>
          {q.options.map((o) => {
            const on = picked.includes(o.id);
            return (
              <Pressable
                key={o.id}
                onPress={() => {
                  playUi("tapSoft");
                  toggle(o.id);
                }}
                style={({ pressed }) => [s.option, on && s.optionOn, { opacity: pressed ? 0.85 : 1 }]}
              >
                <Text style={[s.optionTxt, on && s.optionTxtOn]}>{tr(o.label)}</Text>
              </Pressable>
            );
          })}
        </View>
      </Animated.View>

      {q.multi ? (
        <Pressable
          onPress={() => {
            playUi("tapPrimary");
            next();
          }}
          disabled={picked.length === 0 || saving}
          style={({ pressed }) => [s.btn, { opacity: picked.length === 0 ? 0.35 : pressed ? 0.85 : 1 }]}
        >
          <Text style={s.btnTxt}>
            {isLast ? tr({ ru: "Готово", en: "Done", kk: "Дайын" }) : tr({ ru: "Дальше", en: "Next", kk: "Әрі қарай" })}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000000", paddingHorizontal: 24 },
  back: { alignSelf: "flex-start", marginLeft: -6, marginBottom: 12 },
  progress: { flexDirection: "row", gap: 6 },
  dash: { flex: 1, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.15)" },
  dashOn: { backgroundColor: "#FFFFFF" },
  block: { flex: 1, justifyContent: "center" },
  title: { fontSize: 28, lineHeight: 33, letterSpacing: -0.4, color: "#FFFFFF", fontFamily: "Geologica_900Black" },
  hint: { marginTop: 8, fontSize: 14, color: "rgba(255,255,255,0.5)", fontFamily: "Geologica_500Medium" },
  options: { marginTop: 20, gap: 10 },
  option: {
    minHeight: 54,
    borderRadius: 18,
    paddingHorizontal: 18,
    justifyContent: "center",
    backgroundColor: "#151517",
  },
  optionOn: { backgroundColor: "#FFFFFF" },
  optionTxt: { fontSize: 16, color: "#FFFFFF", fontFamily: "Geologica_700Bold" },
  optionTxtOn: { color: "#000000" },
  btn: { height: 58, borderRadius: 32, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  btnTxt: { fontSize: 17, color: "#000000", fontFamily: "Geologica_800ExtraBold" },
});
