// «Путь · Совет дня (оверлей)» — Figma 193:1910.
// A punched notebook sheet (with a yellow + a dark sheet fanned behind it)
// over a dimmed / blurred screen, gold «Понятно» CTA and a ✕ close.
//
// Usage (e.g. in app/(tabs)/index.tsx):
//   const [tipOpen, setTipOpen] = useState(false);
//   <DailyTipOverlay visible={tipOpen} onClose={() => setTipOpen(false)} tip={getDailyTip()} />
import React from "react";
import { View, Text, StyleSheet, Pressable, Modal, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import Animated, { FadeIn, ZoomIn } from "react-native-reanimated";
import { SvgXml } from "react-native-svg";
import {
  PAPER_PUNCHED_SVG,
  SHEET_YELLOW_SVG,
  SHEET_DARK_SVG,
  TIP_CLOSE_SVG,
} from "@/assets/figma/new/svgs";

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

/** Deterministic tip of the day + a day counter (days since `since`, 1-based). */
export function getDailyTip(date = new Date(), since?: Date | string | number): DailyTip {
  const dayIndex = Math.floor(
    (Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())) / 86400000,
  );
  const base = DAILY_TIPS[((dayIndex % DAILY_TIPS.length) + DAILY_TIPS.length) % DAILY_TIPS.length];
  let day = 1;
  if (since != null) {
    const s = new Date(since);
    const sIdx = Math.floor(Date.UTC(s.getFullYear(), s.getMonth(), s.getDate()) / 86400000);
    day = Math.max(1, dayIndex - sIdx + 1);
  }
  return { ...base, day };
}

function Title({ tip }: { tip: DailyTip }) {
  let rest = tip.title;
  const italic = tip.titleItalicWord && rest.startsWith(tip.titleItalicWord) ? tip.titleItalicWord : "";
  if (italic) rest = rest.slice(italic.length);
  const bold = tip.titleBold && rest.endsWith(tip.titleBold) ? tip.titleBold : "";
  if (bold) rest = rest.slice(0, rest.length - bold.length);
  return (
    <Text style={styles.title}>
      {italic ? <Text style={styles.titleItalic}>{italic}</Text> : null}
      {rest.trimEnd()}
      {bold ? <Text style={styles.titleBold}>{"\n" + bold}</Text> : null}
    </Text>
  );
}

function Body({ tip }: { tip: DailyTip }) {
  const lead = tip.bodyItalicLead && tip.body.startsWith(tip.bodyItalicLead) ? tip.bodyItalicLead : "";
  return (
    <Text style={styles.body}>
      {lead ? <Text style={styles.bodyItalic}>{lead}</Text> : null}
      {tip.body.slice(lead.length)}
    </Text>
  );
}

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
  const topPad = Platform.OS === "web" ? 54 : insets.top;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View entering={FadeIn.duration(180)} style={styles.root}>
        <BlurView intensity={18} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(38,38,40,0.72)" }]} />
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Закрыть" />

        <Pressable
          onPress={onClose}
          hitSlop={14}
          accessibilityLabel="Закрыть"
          style={[styles.close, { top: topPad + 16 }]}
        >
          <SvgXml xml={TIP_CLOSE_SVG} width={15.2} height={15.2} />
        </Pressable>

        <View style={styles.center} pointerEvents="box-none">
          <Animated.View entering={ZoomIn.duration(260)}>
            <View style={styles.stage}>
              {/* fanned sheets behind */}
              <View style={[styles.sheetBehind, { left: -3.4, top: -25.6, transform: [{ rotate: "-7deg" }] }]}>
                <SvgXml xml={SHEET_YELLOW_SVG} width={300} height={340} />
              </View>
              <View style={[styles.sheetBehind, { left: 7.6, top: -5.6, transform: [{ rotate: "5deg" }] }]}>
                <SvgXml xml={SHEET_DARK_SVG} width={300} height={340} />
              </View>
              {/* main punched paper */}
              <View style={styles.paper}>
                <SvgXml xml={PAPER_PUNCHED_SVG} width={300} height={350} />
              </View>
              <View style={styles.content}>
                <Text style={styles.label}>СОВЕТ ДНЯ</Text>
                <Title tip={tip} />
                <View style={{ marginTop: 16 }}>
                  <Body tip={tip} />
                </View>
                {tip.action ? <Text style={styles.action}>{tip.action}</Text> : null}
              </View>
              <View style={styles.dayRow}>
                <Text style={styles.dayWord}>день</Text>
                <Text style={styles.dayNum}>{tip.day}</Text>
              </View>
            </View>
          </Animated.View>

          <Pressable
            onPress={onClose}
            style={({ pressed }) => [styles.cta, { opacity: pressed ? 0.88 : 1 }]}
            accessibilityRole="button"
          >
            <Text style={styles.ctaText}>Понятно</Text>
          </Pressable>
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
    shadowOffset: { width: 0, height: 12 },
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
  dayRow: { position: "absolute", right: 34, bottom: 22, flexDirection: "row", alignItems: "baseline" },
  dayWord: {
    fontSize: 18,
    fontFamily: "Geologica_300Light",
    fontStyle: "italic",
    letterSpacing: -0.09,
    color: INK,
    marginRight: 9,
  },
  dayNum: { fontSize: 30, fontFamily: "Geologica_900Black", letterSpacing: -0.3, color: INK },
  cta: {
    marginTop: 78,
    width: 220,
    height: 52,
    borderRadius: 32,
    backgroundColor: "#FFEDA8",
    borderWidth: 4,
    borderColor: "rgba(230,205,130,0.73)",
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: { fontSize: 16, fontFamily: "Geologica_900Black", color: INK },
});
