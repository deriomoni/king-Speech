// «Путь · Совет дня (оверлей)» — Figma 193:1910.
// A punched notebook sheet (with a yellow + a dark sheet fanned behind it)
// over a dimmed / blurred screen, gold «Понятно» CTA and a ✕ close.
//
// Usage (e.g. in app/(tabs)/index.tsx):
//   const [tipOpen, setTipOpen] = useState(false);
//   <DailyTipOverlay visible={tipOpen} onClose={() => setTipOpen(false)} tip={getDailyTip()} />
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, Modal, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { rs } from "@/lib/responsive";
import Animated, { FadeIn, ZoomIn } from "react-native-reanimated";
import { SvgXml } from "react-native-svg";
import {
  PAPER_PUNCHED_SVG,
  SHEET_YELLOW_SVG,
  SHEET_DARK_SVG,
  TIP_CLOSE_SVG,
} from "@/assets/figma/new/svgs";
import { useLang, pickLang, type Lang } from "@/context/LangContext";

export interface DailyTip {
  /** Full headline, e.g. "Пауза звучит громче слов". */
  title: string;
  /** Leading word(s) of `title` set in light italic, e.g. "Пауза". */
  titleItalicWord?: string;
  /** Trailing part of `title` set in bold on its own line, e.g. "громче слов". */
  titleBold?: string;
  /** Main paragraph. */
  body: string;
  /** Leading words of `body` set in medium italic, e.g. "Две секунды". */
  bodyItalicLead?: string;
  /** Optional second, lighter paragraph (the «try today» action). */
  action?: string;
  /** Day counter shown bottom-right («день 27»). */
  day: number;
  /** Days since epoch — picks the back sheet's colour of the day. */
  dayIndex?: number;
  /** Index into DAILY_TIPS_BY_LANG — lets the overlay re-localize the tip. */
  tipIndex?: number;
}

const INK = "#262628";

export const DAILY_TIPS: Omit<DailyTip, "day">[] = [
  {
    title: "Пауза звучит громче слов",
    titleItalicWord: "Пауза",
    titleBold: "громче слов",
    bodyItalicLead: "Две секунды",
    body: "Две секунды тишины перед главной мыслью, и зал невольно подаётся вперёд.",
    action: "Сегодня попробуйте одну паузу в обычном разговоре.",
  },
  {
    title: "Медленно значит уверенно",
    titleItalicWord: "Медленно",
    titleBold: "уверенно",
    bodyItalicLead: "Спокойный темп",
    body: "Спокойный темп звучит как знание дела. Торопливая речь — как оправдание.",
    action: "Сегодня скажите одну фразу вдвое медленнее, чем хочется.",
  },
  {
    title: "Громче, чем кажется нужным",
    titleItalicWord: "Громче,",
    titleBold: "нужным",
    bodyItalicLead: "Последний ряд",
    body: "Последний ряд должен слышать вас без усилий. Если кажется, что кричите — скорее всего, в самый раз.",
    action: "Сегодня прочитайте абзац вслух на полтона громче.",
  },
  {
    title: "Начни с истории",
    titleItalicWord: "Начни",
    titleBold: "истории",
    bodyItalicLead: "Одна история",
    body: "Одна история в начале держит внимание лучше любых цифр и тезисов.",
    action: "Сегодня начните рассказ о своём дне с одной живой детали.",
  },
  {
    title: "Смотрите в глаза",
    titleItalicWord: "Смотрите",
    titleBold: "в глаза",
    bodyItalicLead: "Одна мысль",
    body: "Одна мысль — один слушатель. Закончите фразу, глядя на человека, и только потом переводите взгляд.",
    action: "Сегодня договорите хотя бы три фразы, не отводя взгляд.",
  },
];

// Same tips, same order — index i is the same tip in every language.
export const DAILY_TIPS_EN: Omit<DailyTip, "day">[] = [
  {
    title: "A pause speaks louder than words",
    titleItalicWord: "A pause",
    titleBold: "than words",
    bodyItalicLead: "Two seconds",
    body: "Two seconds of silence before your key idea, and the room leans in.",
    action: "Today, try one pause in an everyday conversation.",
  },
  {
    title: "Slow means confident",
    titleItalicWord: "Slow",
    titleBold: "confident",
    bodyItalicLead: "A calm pace",
    body: "A calm pace sounds like expertise. Rushed speech sounds like an excuse.",
    action: "Today, say one sentence twice as slowly as you want to.",
  },
  {
    title: "Louder than feels necessary",
    titleItalicWord: "Louder",
    titleBold: "necessary",
    bodyItalicLead: "The back row",
    body: "The back row should hear you effortlessly. If it feels like shouting, it's probably just right.",
    action: "Today, read a paragraph aloud a notch louder.",
  },
  {
    title: "Start with a story",
    titleItalicWord: "Start",
    titleBold: "a story",
    bodyItalicLead: "One story",
    body: "One story at the start holds attention better than any numbers or bullet points.",
    action: "Today, open the story of your day with one vivid detail.",
  },
  {
    title: "Look them in the eye",
    titleItalicWord: "Look",
    titleBold: "in the eye",
    bodyItalicLead: "One thought",
    body: "One thought — one listener. Finish the sentence looking at a person, and only then move your gaze.",
    action: "Today, finish at least three sentences without looking away.",
  },
];

export const DAILY_TIPS_KK: Omit<DailyTip, "day">[] = [
  {
    title: "Үзіліс сөзден күшті",
    titleItalicWord: "Үзіліс",
    titleBold: "сөзден күшті",
    bodyItalicLead: "Екі секунд",
    body: "Екі секунд үнсіздік басты ойдың алдында — және зал еріксіз сізге қарай еңкейеді.",
    action: "Бүгін қарапайым әңгімеде бір рет үзіліс жасап көріңіз.",
  },
  {
    title: "Баяу деген — сенімді",
    titleItalicWord: "Баяу",
    titleBold: "сенімді",
    bodyItalicLead: "Сабырлы қарқын",
    body: "Сабырлы қарқын өз ісін білетін адамның сөзіндей естіледі. Асығыс сөз — ақталу сияқты.",
    action: "Бүгін бір сөйлемді әдеттегіден екі есе баяу айтып көріңіз.",
  },
  {
    title: "Ойлағаныңыздан қаттырақ",
    titleItalicWord: "Ойлағаныңыздан",
    titleBold: "қаттырақ",
    bodyItalicLead: "Соңғы қатар",
    body: "Соңғы қатар сізді еш қиындықсыз естуі керек. Айқайлап тұрғандай көрінсе — бәлкім, дәл осы жеткілікті.",
    action: "Бүгін бір абзацты дауыстап, сәл қаттырақ оқып көріңіз.",
  },
  {
    title: "Әңгімеден бастаңыз",
    titleItalicWord: "Әңгімеден",
    titleBold: "бастаңыз",
    bodyItalicLead: "Бір әңгіме",
    body: "Бір әңгіме басында кез келген сан мен тезистен гөрі назарды жақсы ұстайды.",
    action: "Бүгін өз күніңіз туралы әңгімені бір жанды детальдан бастаңыз.",
  },
  {
    title: "Көзге қарап сөйлеңіз",
    titleItalicWord: "Көзге",
    titleBold: "қарап сөйлеңіз",
    bodyItalicLead: "Бір ой",
    body: "Бір ой — бір тыңдаушы. Сөйлемді адамға қарап аяқтаңыз, содан кейін ғана көзіңізді басқаға бұрыңыз.",
    action: "Бүгін кемінде үш сөйлемді көзіңізді тайдырмай аяқтап көріңіз.",
  },
];

export const DAILY_TIPS_BY_LANG: Record<Lang, Omit<DailyTip, "day">[]> = {
  ru: DAILY_TIPS,
  en: DAILY_TIPS_EN,
  kk: DAILY_TIPS_KK,
};

/** Deterministic tip of the day + a day counter (days since `since`, 1-based). */
export function getDailyTip(
  date = new Date(),
  since?: Date | string | number,
  lang: Lang = "ru",
): DailyTip {
  const dayIndex = Math.floor(
    (Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())) / 86400000,
  );
  const tipIndex = ((dayIndex % DAILY_TIPS.length) + DAILY_TIPS.length) % DAILY_TIPS.length;
  const base = (DAILY_TIPS_BY_LANG[lang] ?? DAILY_TIPS)[tipIndex];
  let day = 1;
  if (since != null) {
    const s = new Date(since);
    const sIdx = Math.floor(Date.UTC(s.getFullYear(), s.getMonth(), s.getDate()) / 86400000);
    day = Math.max(1, dayIndex - sIdx + 1);
  }
  return { ...base, day, tipIndex, dayIndex };
}

function Title({ tip }: { tip: DailyTip }) {
  let rest = tip.title;
  const italic = tip.titleItalicWord && rest.startsWith(tip.titleItalicWord) ? tip.titleItalicWord : "";
  if (italic) rest = rest.slice(italic.length);
  const bold = tip.titleBold && rest.endsWith(tip.titleBold) ? tip.titleBold : "";
  if (bold) rest = rest.slice(0, rest.length - bold.length);
  // The paper is a fixed 300×350 sheet: the first title line must fit its 250pt
  // width, so long first lines step the size down (~15 chars fit at 30pt).
  const firstLine = (italic + rest).trim().length;
  const size = firstLine <= 14 ? 30 : Math.max(22, Math.floor((30 * 14) / firstLine));
  return (
    <Text style={[styles.title, { fontSize: rs(size), lineHeight: rs(Math.round(size * 1.1)) }]}>
      {italic ? <Text style={styles.titleItalic}>{italic}</Text> : null}
      {rest.trimEnd()}
      {bold ? <Text style={styles.titleBold}>{"\n" + bold}</Text> : null}
    </Text>
  );
}

function Body({ tip, long }: { tip: DailyTip; long?: boolean }) {
  const lead = tip.bodyItalicLead && tip.body.startsWith(tip.bodyItalicLead) ? tip.bodyItalicLead : "";
  return (
    <Text style={[styles.body, long && styles.textLong]}>
      {lead ? <Text style={styles.bodyItalic}>{lead}</Text> : null}
      {tip.body.slice(lead.length)}
    </Text>
  );
}

const CTA_DELAY_MS = 5000;
/** The fanned back sheet — a different colour each day. */
const SHEET_COLORS = ["#FFD857", "#B99BFF", "#7AD593", "#7AB8FF", "#FF9C8C", "#FFB86B", "#F59AC8"];

export default function DailyTipOverlay({
  visible,
  onClose,
  tip,
}: {
  visible: boolean;
  onClose: () => void;
  tip: DailyTip;
}) {
  const insets = useSafeAreaInsets();
  const { lang } = useLang();
  // Re-localize a tip produced by getDailyTip() to the current UI language.
  const localized =
    tip.tipIndex != null ? (DAILY_TIPS_BY_LANG[lang] ?? DAILY_TIPS)[tip.tipIndex] : undefined;
  if (localized) tip = { ...localized, day: tip.day, tipIndex: tip.tipIndex, dayIndex: tip.dayIndex };
  // the back sheet takes a new colour every day
  const di = tip.dayIndex ?? Math.floor(Date.now() / 86400000);
  const sheetColor = SHEET_COLORS[((di % SHEET_COLORS.length) + SHEET_COLORS.length) % SHEET_COLORS.length];
  const sheetXml = SHEET_YELLOW_SVG.replace('fill="#FFD857"', `fill="${sheetColor}"`);
  // «Понятно» appears only after the tip has had a few seconds to be read
  const [ctaShown, setCtaShown] = useState(false);
  useEffect(() => {
    if (!visible) {
      setCtaShown(false);
      return;
    }
    const t = setTimeout(() => setCtaShown(true), CTA_DELAY_MS);
    return () => clearTimeout(t);
  }, [visible]);
  const closeLabel = pickLang(lang, { ru: "Закрыть", en: "Close", kk: "Жабу" });
  const topPad = Platform.OS === "web" ? 54 : insets.top;
  // Long tips get slightly smaller body type so everything fits the fixed sheet.
  const long = tip.body.length + (tip.action?.length ?? 0) > 130;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View entering={FadeIn.duration(180)} style={styles.root}>
        <BlurView intensity={18} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(38,38,40,0.72)" }]} />
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={closeLabel} />

        <Pressable
          onPress={onClose}
          hitSlop={14}
          accessibilityLabel={closeLabel}
          style={[styles.close, { top: topPad + rs(16) }]}
        >
          <SvgXml xml={TIP_CLOSE_SVG} width={rs(15.2)} height={rs(15.2)} />
        </Pressable>

        <View style={styles.center} pointerEvents="box-none">
          <Animated.View entering={ZoomIn.duration(260)}>
            <View style={styles.stage}>
              {/* fanned sheets behind */}
              <View style={[styles.sheetBehind, { left: rs(-3.4), top: rs(-25.6), transform: [{ rotate: "-7deg" }] }]}>
                <SvgXml xml={sheetXml} width={rs(300)} height={rs(340)} />
              </View>
              <View style={[styles.sheetBehind, { left: rs(7.6), top: rs(-5.6), transform: [{ rotate: "5deg" }] }]}>
                <SvgXml xml={SHEET_DARK_SVG} width={rs(300)} height={rs(340)} />
              </View>
              {/* main punched paper */}
              <View style={styles.paper}>
                <SvgXml xml={PAPER_PUNCHED_SVG} width={rs(300)} height={rs(350)} />
              </View>
              <View style={styles.content}>
                <Text style={styles.label}>{pickLang(lang, { ru: "СОВЕТ ДНЯ", en: "TIP OF THE DAY", kk: "КҮН КЕҢЕСІ" })}</Text>
                <Title tip={tip} />
                <View style={{ marginTop: rs(16) }}>
                  <Body tip={tip} long={long} />
                </View>
                {tip.action ? <Text style={[styles.action, long && styles.textLong]}>{tip.action}</Text> : null}
              </View>
            </View>
          </Animated.View>

          {ctaShown ? (
            <Animated.View entering={FadeIn.duration(400)}>
              <Pressable
                onPress={onClose}
                style={({ pressed }) => [styles.cta, { opacity: pressed ? 0.88 : 1 }]}
                accessibilityRole="button"
              >
                <Text style={styles.ctaText}>{pickLang(lang, { ru: "Понятно", en: "Got it", kk: "Түсінікті" })}</Text>
              </Pressable>
            </Animated.View>
          ) : (
            // keeps the sheet where it will stay once the button shows up
            <View style={[styles.cta, { backgroundColor: "transparent" }]} />
          )}
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  close: { position: "absolute", right: 26, zIndex: 2 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 40 },
  stage: {
    width: 300,
    height: 350,
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: rs(12) },
  },
  sheetBehind: { position: "absolute", width: 300, height: 340 },
  paper: { position: "absolute", top: 0, left: 0 },
  content: { position: "absolute", left: 28, top: 58, width: 250 },
  label: { fontSize: 11, fontFamily: "Geologica_900Black", letterSpacing: 0.55, color: "rgba(38,38,40,0.45)" },
  title: {
    marginTop: 8,
    fontSize: 30,
    lineHeight: 33,
    letterSpacing: -0.3,
    color: INK,
    fontFamily: "Geologica_300Light",
  },
  titleItalic: { fontFamily: "Geologica_300Light", fontStyle: "italic" },
  titleBold: { fontFamily: "Geologica_700Bold" },
  body: {
    width: 236,
    fontSize: 15,
    lineHeight: 21,
    color: "rgba(38,38,40,0.8)",
    fontFamily: "Geologica_400Regular",
  },
  bodyItalic: { fontFamily: "Geologica_500Medium", fontStyle: "italic" },
  action: {
    marginTop: 11,
    width: 236,
    fontSize: 15,
    lineHeight: 21,
    color: "rgba(38,38,40,0.8)",
    fontFamily: "Geologica_300Light",
  },
  textLong: { fontSize: 13.5, lineHeight: 19 },
  cta: {
    marginTop: 78,
    width: 220,
    height: 52,
    borderRadius: 32,
    backgroundColor: "#FFD857",
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: { fontSize: 16, fontFamily: "Geologica_900Black", color: INK },
});
