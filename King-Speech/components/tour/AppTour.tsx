// First-run tour, shown over the main app right after sign-up (instead of the
// old onboarding screens). Short and finite — 8 frosted-glass cards:
//   1. Oscar says hi
//   2. the five sections at a glance (the whole tab bar lit up)
//   3–7. each section in turn: the app switches to it, its tab is spotlighted
//   8. «Всё готово» → back to the Path; the tour never shows again.
import React, { useEffect, useMemo, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Svg, { Defs, LinearGradient as SvgGradient, Path, Stop } from "react-native-svg";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useLang, pickLang } from "@/context/LangContext";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { rs } from "@/lib/responsive";
import { playUi } from "@/lib/uiSound";
import { useOscarVoice } from "@/lib/oscarVoice";
import OscarMascot from "@/components/OscarMascot";
import { IconHome, IconCheatSheet, IconClapperboard, IconAvatar, IconGear } from "@/components/tabs/TabBarIcons";

const AnimatedPath = Animated.createAnimatedComponent(Path);

type L = { ru: string; en: string; kk: string };
type IconC = React.ComponentType<{ size?: number; color?: string }>;

// Must match the tab bar in app/(tabs)/_layout.tsx
const BAR_H = 64;
const BAR_MAX_W = 480;
const BAR_SIDE = 16;
const BAR_BORDER = 5;
const BAR_PAD = 8;


type Section = { route: string; tab: number; Icon: IconC; name: L; short: L; title: L; body: L };

const SECTIONS: Section[] = [
  {
    route: "/(tabs)",
    tab: 0,
    Icon: IconHome,
    name: { ru: "Путь", en: "Path", kk: "Жол" },
    short: { ru: "уровни шаг за шагом", en: "levels, step by step", kk: "деңгейлер біртіндеп" },
    title: { ru: "Путь — твоя дорога", en: "The Path is your road", kk: "Жол — сенің бағытың" },
    body: {
      ru: "Уровни открываются по очереди: речь, словарный запас, мини-выступления. За каждый — звёзды и монеты.",
      en: "Levels open one by one: speaking, vocabulary, mini-speeches. Each one earns stars and coins.",
      kk: "Деңгейлер кезекпен ашылады: сөйлеу, сөздік қор, шағын сөз сөйлеу. Әрқайсысы үшін — жұлдыз бен тиын.",
    },
  },
  {
    route: "/(tabs)/interview",
    tab: 1,
    Icon: IconCheatSheet,
    name: { ru: "Разогрев", en: "Get Ready", kk: "Дайын бол" },
    short: { ru: "разминка перед выступлением", en: "a warm-up before you speak", kk: "сөз алдындағы жаттығу" },
    title: { ru: "Разогрев перед выходом", en: "Get Ready — a warm-up", kk: "Дайын бол — жаттығу" },
    body: {
      ru: "Волнуешься перед важным разговором? Пара минут: дыхание, голос, дикция — и ты готов.",
      en: "Nervous before something important? A couple of minutes — breath, voice, diction — and you're ready.",
      kk: "Маңызды сөз алдында толқисың ба? Екі минут: тыныс, дауыс, дикция — және дайынсың.",
    },
  },
  {
    route: "/(tabs)/showtime",
    tab: 2,
    Icon: IconClapperboard,
    name: { ru: "Show Time", en: "Show Time", kk: "Сахна уақыты" },
    short: { ru: "выступления перед залом", en: "speeches before a crowd", kk: "зал алдында сөйлеу" },
    title: { ru: "Show Time — твоя сцена", en: "Show Time — your stage", kk: "Сахна уақыты — сенің сахнаң" },
    body: {
      ru: "Выбери тему и выступи перед живым залом. Запись можно пересмотреть и увидеть реакцию публики.",
      en: "Pick a topic and speak before a live crowd. Watch your take back and see how the audience reacted.",
      kk: "Тақырып таңда да, тірі зал алдында сөйле. Жазбаны қайта көріп, көрермен реакциясын байқа.",
    },
  },
  {
    route: "/(tabs)/profile",
    tab: 3,
    Icon: IconAvatar,
    name: { ru: "Профиль", en: "Profile", kk: "Профиль" },
    short: { ru: "твой прогресс", en: "your progress", kk: "сенің прогресің" },
    title: { ru: "Профиль — твой прогресс", en: "Profile — your progress", kk: "Профиль — сенің прогресің" },
    body: {
      ru: "Ранг, статистика, аудиодневник и монеты — всё, чего ты уже добился.",
      en: "Your rank, stats, audio diary and coins — everything you've achieved so far.",
      kk: "Ранг, статистика, аудиокүнделік және тиындар — жеткен жетістіктерің.",
    },
  },
  {
    route: "/(tabs)/settings",
    tab: 4,
    Icon: IconGear,
    name: { ru: "Настройки", en: "Settings", kk: "Баптаулар" },
    short: { ru: "язык, тема, звук", en: "language, theme, sound", kk: "тіл, тақырып, дыбыс" },
    title: { ru: "Настройки", en: "Settings", kk: "Баптаулар" },
    body: {
      ru: "Язык, светлая или тёмная тема, звуки и подписка — всё меняется здесь.",
      en: "Language, light or dark theme, sounds and subscription — change them all here.",
      kk: "Тіл, ашық не қараңғы тақырып, дыбыстар және жазылым — бәрі осында.",
    },
  },
];

type Step = { kind: "hello" } | { kind: "overview" } | { kind: "section"; s: Section } | { kind: "done" };
const STEPS: Step[] = [
  { kind: "hello" },
  { kind: "overview" },
  ...SECTIONS.map((s) => ({ kind: "section" as const, s })),
  { kind: "done" },
];

function rrect(x: number, y: number, w: number, h: number, r: number) {
  "worklet";
  const rr = Math.min(r, w / 2, h / 2);
  return (
    `M${x + rr},${y}H${x + w - rr}A${rr},${rr} 0 0 1 ${x + w},${y + rr}V${y + h - rr}` +
    `A${rr},${rr} 0 0 1 ${x + w - rr},${y + h}H${x + rr}A${rr},${rr} 0 0 1 ${x},${y + h - rr}` +
    `V${y + rr}A${rr},${rr} 0 0 1 ${x + rr},${y}Z`
  );
}

export default function AppTour() {
  const { width: W, height: H } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { lang } = useLang();
  const tr = (v: L) => pickLang(lang, v);
  const { themeMode } = useTheme();
  const { user, completeOnboarding } = useAuth();
  const [i, setI] = useState(0);
  const [closing, setClosing] = useState(false);
  const step = STEPS[i];

  // the tab bar's geometry (same maths as the bar itself)
  const bottomInset = Platform.OS === "web" ? rs(18) : Math.max(insets.bottom, rs(12));
  const barW = Math.min(W - BAR_SIDE * 2, BAR_MAX_W);
  const barX = (W - barW) / 2;
  const barY = H - bottomInset - BAR_H;
  const slotW = (barW - BAR_BORDER * 2 - BAR_PAD * 2) / 5;

  // the spotlight: a rounded hole in the dimmed layer
  const target = useMemo(() => {
    if (step.kind === "overview") return { x: barX - 6, y: barY - 6, w: barW + 12, h: BAR_H + 12, r: BAR_H / 2 + 6 };
    if (step.kind === "section") {
      const cx = barX + BAR_BORDER + BAR_PAD + slotW * (step.s.tab + 0.5);
      const d = rs(58);
      return { x: cx - d / 2, y: barY + BAR_H / 2 - d / 2, w: d, h: d, r: d / 2 };
    }
    // no hole: a dot in the middle of the bar, ready to open
    return { x: W / 2, y: barY + BAR_H / 2, w: 0, h: 0, r: 0 };
  }, [step, barX, barY, barW, slotW, W]);

  const hx = useSharedValue(target.x);
  const hy = useSharedValue(target.y);
  const hw = useSharedValue(target.w);
  const hh = useSharedValue(target.h);
  const hr = useSharedValue(target.r);
  useEffect(() => {
    const cfg = { duration: 520, easing: Easing.inOut(Easing.cubic) };
    hx.value = withTiming(target.x, cfg);
    hy.value = withTiming(target.y, cfg);
    hw.value = withTiming(target.w, cfg);
    hh.value = withTiming(target.h, cfg);
    hr.value = withTiming(target.r, cfg);
  }, [target, hx, hy, hw, hh, hr]);

  const dimProps = useAnimatedProps(() => ({
    d: `M0,0H${W}V${H}H0Z` + (hw.value > 0.5 ? rrect(hx.value, hy.value, hw.value, hh.value, hr.value) : ""),
  }));
  const ringProps = useAnimatedProps(() => ({
    d: hw.value > 0.5 ? rrect(hx.value, hy.value, hw.value, hh.value, hr.value) : "M0,0",
    strokeOpacity: hw.value > 4 ? 1 : 0,
  }));
  // a ripple keeps leaving the ring outwards, softly fading
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 1700, easing: Easing.out(Easing.quad) }), -1, false);
  }, [pulse]);
  const rippleProps = useAnimatedProps(() => {
    const o = pulse.value * 14;
    return {
      d: hw.value > 0.5 ? rrect(hx.value - o, hy.value - o, hw.value + o * 2, hh.value + o * 2, hr.value + o) : "M0,0",
      strokeOpacity: hw.value > 4 ? (1 - pulse.value) * 0.85 : 0,
    };
  });

  // Oscar talks the overview through, and sees you off at the end
  useOscarVoice("overview", step.kind === "overview" && !closing, 300);
  useOscarVoice("sendoff", step.kind === "done" && !closing, 300);

  // show the section behind its card
  useEffect(() => {
    if (step.kind === "section") router.navigate(step.s.route as never);
  }, [step, router]);

  const finish = async () => {
    if (closing) return;
    setClosing(true);
    router.navigate("/(tabs)" as never);
    await completeOnboarding();
  };
  const next = () => {
    if (i === STEPS.length - 1) {
      playUi("tapPrimary");
      finish();
      return;
    }
    playUi("tapPrimary");
    setI(i + 1);
  };
  const back = () => {
    if (i === 0) return;
    playUi("back");
    setI(i - 1);
  };

  const dark = themeMode === "dark";
  const card = dark ? "rgba(62,62,68,0.6)" : "rgba(255,255,255,0.8)";
  const edge = dark ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.95)";
  const ink = dark ? "#F0EEE9" : "#262628";
  const soft = dark ? "rgba(240,238,233,0.62)" : "rgba(38,38,40,0.62)";
  const line = dark ? "rgba(240,238,233,0.08)" : "rgba(38,38,40,0.07)";

  const centered = step.kind === "hello" || step.kind === "done";
  const cardPos = centered
    ? { top: 0, bottom: 0, justifyContent: "center" as const }
    : { bottom: H - barY + rs(22) };

  const firstName = (user?.name ?? "").trim().split(/\s+/)[0];
  let title = "";
  let body = "";
  if (step.kind === "hello") {
    title = firstName
      ? tr({ ru: `Привет, ${firstName}!`, en: `Hi, ${firstName}!`, kk: `Сәлем, ${firstName}!` })
      : tr({ ru: "Привет!", en: "Hi!", kk: "Сәлем!" });
    body = tr({
      ru: "Я Оскар. Покажу, как здесь всё устроено — это займёт минуту.",
      en: "I'm Oscar. Let me show you around — it takes a minute.",
      kk: "Мен Оскармын. Мұнда бәрі қалай жұмыс істейтінін көрсетейін — бір минут қана.",
    });
  } else if (step.kind === "overview") {
    title = tr({ ru: "Здесь пять разделов", en: "Five sections live here", kk: "Мұнда бес бөлім бар" });
  } else if (step.kind === "section") {
    title = tr(step.s.title);
    body = tr(step.s.body);
  } else {
    title = tr({ ru: "Всё готово!", en: "You're all set!", kk: "Бәрі дайын!" });
    body = tr({
      ru: "По глазам вижу — тебе уже не терпится приступить! Не буду тебя томить. Вперёд и с песней!",
      en: "I can see it in your eyes — you can't wait to get started! So I won't keep you waiting. Off you go, and good luck!",
      kk: "Көзіңнен көріп тұрмын — бастауға асығып тұрсың! Сені күттірмейін. Алға, сәттілік!",
    });
  }

  const nextLabel =
    step.kind === "hello"
      ? tr({ ru: "Поехали", en: "Let's go", kk: "Кеттік" })
      : step.kind === "done"
        ? tr({ ru: "Начать путь", en: "Start the Path", kk: "Жолды бастау" })
        : tr({ ru: "Дальше", en: "Next", kk: "Әрі қарай" });

  return (
    <Animated.View
      entering={FadeIn.duration(500)}
      exiting={FadeOut.duration(400)}
      style={StyleSheet.absoluteFill}
      pointerEvents={closing ? "none" : "auto"}
    >
      {/* dimmed layer with the spotlight; it also swallows taps on the app */}
      <Pressable style={StyleSheet.absoluteFill} onPress={() => {}}>
        <Svg width={W} height={H} style={StyleSheet.absoluteFill}>
          <AnimatedPath animatedProps={dimProps} fill="rgba(0,0,0,0.72)" fillRule="evenodd" />
          <Defs>
            <SvgGradient id="tourRing" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#FFFFFF" />
              <Stop offset="0.35" stopColor="#FFF1C2" />
              <Stop offset="0.6" stopColor="#FFD857" />
              <Stop offset="0.85" stopColor="#F2B632" />
              <Stop offset="1" stopColor="#FFF6DA" />
            </SvgGradient>
          </Defs>
          {/* soft glow under the line */}
          <AnimatedPath animatedProps={ringProps} fill="none" stroke="url(#tourRing)" strokeWidth={14} opacity={0.16} />
          <AnimatedPath animatedProps={ringProps} fill="none" stroke="url(#tourRing)" strokeWidth={7} opacity={0.3} />
          <AnimatedPath animatedProps={rippleProps} fill="none" stroke="url(#tourRing)" strokeWidth={2} />
          <AnimatedPath animatedProps={ringProps} fill="none" stroke="url(#tourRing)" strokeWidth={3} />
        </Svg>
      </Pressable>

      <View pointerEvents="box-none" style={[s.cardWrap, cardPos]}>
        <Animated.View key={i} entering={FadeInDown.duration(420)} style={[s.card, { backgroundColor: card, borderColor: edge }]}>
          <BlurView intensity={60} tint={dark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
          {/* a bright sheen across the top of the glass */}
          <LinearGradient
            pointerEvents="none"
            colors={[dark ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.7)", "rgba(255,255,255,0)"]}
            style={[StyleSheet.absoluteFill, { bottom: "55%" }]}
          />
          {/* the lit tab below throws a warm reflex onto the card's lower edge */}
          {!centered ? (
            <LinearGradient
              pointerEvents="none"
              colors={["rgba(255,216,87,0)", dark ? "rgba(255,216,87,0.16)" : "rgba(255,206,70,0.22)"]}
              style={[StyleSheet.absoluteFill, { top: "45%" }]}
            />
          ) : null}
          <View style={s.head}>
            <Text style={[s.count, { color: soft }]}>
              {i + 1} / {STEPS.length}
            </Text>
          </View>

          {centered ? (
            <View style={s.oscar}>
              <OscarMascot emotion={step.kind === "done" ? "happy" : "hi"} size={step.kind === "done" ? rs(190) : rs(130)} />
            </View>
          ) : null}

          <Text style={[s.title, { color: ink }, centered && s.center]}>{title}</Text>
          {body ? <Text style={[s.body, { color: soft }, centered && s.center]}>{body}</Text> : null}
          {step.kind === "done" ? (
            <Text style={[s.cheer, { color: ink }]}>
              {tr({
                ru: "Каждый великий оратор когда-то волновался так же, как ты. Первый шаг ты уже сделал — дальше будет только увереннее!",
                en: "Every great speaker was once as nervous as you. You've already taken the first step — it only gets more confident from here!",
                kk: "Әр ұлы шешен бір кезде дәл сен сияқты толқыған. Алғашқы қадамды жасадың — әрі қарай тек сенімдірек болады!",
              })}
            </Text>
          ) : null}

          {step.kind === "overview" ? (
            <View style={s.list}>
              {SECTIONS.map((sec, k) => (
                <View key={sec.route} style={[s.row, k > 0 && { borderTopWidth: 1, borderTopColor: line }]}>
                  <sec.Icon size={rs(22)} color={ink} />
                  <Text style={[s.rowName, { color: ink }]}>{tr(sec.name)}</Text>
                  <Text style={[s.rowShort, { color: soft }]}>
                    {tr(sec.short)}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          {centered ? (
            // hello / done: one black button
            <Pressable
              onPress={next}
              style={({ pressed }) => [s.nextBtn, dark && s.nextBtnDark, { opacity: pressed ? 0.85 : 1 }]}
            >
              <Text style={s.nextTxt}>{nextLabel}</Text>
            </Pressable>
          ) : (
            // in between: just two triangles pointing the way
            <View style={s.arrows}>
              <Pressable
                onPress={back}
                hitSlop={10}
                accessibilityLabel={tr({ ru: "Назад", en: "Back", kk: "Артқа" })}
                style={({ pressed }) => [s.arrow, { opacity: pressed ? 0.5 : 1 }]}
              >
                <Ionicons name="caret-back" size={rs(30)} color={ink} />
              </Pressable>
              <Pressable
                onPress={next}
                hitSlop={10}
                accessibilityLabel={tr({ ru: "Дальше", en: "Next", kk: "Әрі қарай" })}
                style={({ pressed }) => [s.arrow, { opacity: pressed ? 0.5 : 1 }]}
              >
                <Ionicons name="caret-forward" size={rs(30)} color={ink} />
              </Pressable>
            </View>
          )}
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  cardWrap: { position: "absolute", left: 16, right: 16, alignItems: "center" },
  card: {
    width: "100%",
    maxWidth: 440,
    borderRadius: 28,
    padding: 22,
    overflow: "hidden",
    borderWidth: 1,
  },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  count: { fontSize: 13, fontFamily: "Geologica_700Bold", letterSpacing: 0.3 },
  oscar: { alignItems: "center", marginBottom: 8 },
  title: { fontSize: 24, lineHeight: 29, letterSpacing: -0.4, fontFamily: "Geologica_900Black" },
  body: { marginTop: 8, fontSize: 16, lineHeight: 22, fontFamily: "Geologica_500Medium" },
  center: { textAlign: "center" },
  cheer: { marginTop: 14, fontSize: 15, lineHeight: 21, textAlign: "center", fontFamily: "Geologica_600SemiBold", fontStyle: "italic" },
  list: { marginTop: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 9 },
  rowName: { width: rs(124), fontSize: 16, fontFamily: "Geologica_800ExtraBold" },
  rowShort: { flex: 1, fontSize: 14, fontFamily: "Geologica_500Medium" },
  nextBtn: { marginTop: 20, height: 54, borderRadius: 27, backgroundColor: "#0A0A0C", alignItems: "center", justifyContent: "center" },
  // on the dark card the black button keeps a faint edge
  nextBtnDark: { borderWidth: 1, borderColor: "rgba(255,255,255,0.14)" },
  nextTxt: { fontSize: 17, color: "#FFFFFF", fontFamily: "Geologica_800ExtraBold" },
  arrows: { marginTop: 16, flexDirection: "row", justifyContent: "space-between", marginHorizontal: -8 },
  arrow: { width: 48, height: 44, alignItems: "center", justifyContent: "center" },
});
