// «Подписка · планы» — Figma 132:167 (section 130:2 «07 · Профиль: меню «+» и подписка»).
// No payment integration yet: every purchase action opens a «Скоро» dialog.
import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Defs, RadialGradient, Rect, Stop, SvgXml } from "react-native-svg";
import * as Haptics from "@/lib/haptics";
import { rs } from "@/lib/responsive";
import { useScreenMusic } from "@/lib/music";
import { DARK } from "@/context/ThemeContext";
import AuroraBackground from "@/components/subscription/AuroraBackground";
import { LOGO_CROWN, LOGO_H, LOGO_KING_XML, LOGO_SPEECH_XML } from "@/assets/figma/settings/logoParts";

// «King Speech» on ONE line, built from the stacked logo: «Speech» is moved up
// onto «King»'s baseline and to its right. Logo units: «K» cap 1.095 → 22.855
// (baseline), «Speech» baseline 47.73; «King» ends at x 122.33.
const BRAND_INK = "rgba(240,238,233,0.92)";
const inner = (xml: string) => xml.slice(xml.indexOf(">") + 1, xml.lastIndexOf("</svg>")).split("__FG__").join(BRAND_INK);
const BRAND_DY = 47.73 - 22.855;
const BRAND_DX = 122.33 + 6.5 - 67.6;
// generous box: the «g» tail reaches y≈29.1 — keep a margin so nothing is clipped
const BRAND_VB = { x: 66.6, y: -1, w: 158.98 + BRAND_DX - 66.6 + 1.5, h: 32.5 };
const BRAND_INLINE_XML =
  `<svg viewBox="${BRAND_VB.x} ${BRAND_VB.y} ${BRAND_VB.w} ${BRAND_VB.h}" xmlns="http://www.w3.org/2000/svg">` +
  inner(LOGO_KING_XML) +
  `<g transform="translate(${BRAND_DX} ${-BRAND_DY})">${inner(LOGO_SPEECH_XML)}</g></svg>`;
// subtitle is 15pt: Geologica caps ≈ 0.72em → scale the logo's 21.76-unit caps to that
// +30%: the wordmark reads at the same size as the 15pt text next to it
const BRAND_K = ((15 * 0.72) / 21.76) * 1.3;
const BRAND = {
  w: rs(BRAND_VB.w * BRAND_K),
  h: rs(BRAND_VB.h * BRAND_K),
  // part of the wordmark below its baseline (the g / p tails)
  descent: rs((BRAND_VB.y + BRAND_VB.h - 22.855) * BRAND_K),
  crownH: rs(15 * 0.95 * 1.3),
};
import { APRICOT, FreePlanRow, GlassPlanCard } from "@/components/subscription/GlassPlan";
import { useLang, pickLang } from "@/context/LangContext";
import AppDialog from "@/components/AppDialog";
import CoinIcon from "@/components/CoinIcon";
import {
  CLOSE_SVG,
  CROWN_GLOW_SVG,
  CROWN_SVG,
  SPARKLE0_SVG,
  SPARKLE1_SVG,
  SPARKLE2_SVG,
  SPARKLE3_SVG,
  SPARKLE4_SVG,
  CROWN_WATERMARK_SVG,
  EMPEROR_CROWN_SVG,
  ICON_PLATE_SVG,
  CHEVRON_UP_SVG,
  CHEVRON_DOWN_SVG,
} from "@/assets/figma/new/svgs";
import {
  Badge,
  Checklist,
  PlanWithTray,
  PriceTile,
  INK,
  GOLD,
  CREAM,
} from "@/components/subscription/parts";

type Period = "month" | "year";

type L10n<T = string> = { ru: T; en: T; kk: T };

const FAQ: { q: L10n; a: L10n }[] = [
  {
    q: {
      ru: "Можно ли отменить подписку?",
      en: "Can I cancel my subscription?",
      kk: "Жазылымды тоқтатуға бола ма?",
    },
    a: {
      ru: "Да, в любой момент в настройках App Store или Google Play. Доступ сохранится до конца оплаченного периода.",
      en: "Yes, any time in your App Store or Google Play settings. Access stays until the end of the paid period.",
      kk: "Иә, кез келген уақытта App Store немесе Google Play баптауларынан. Қолжетімділік төленген кезеңнің соңына дейін сақталады.",
    },
  },
  {
    q: {
      ru: "Чем Император отличается от Королевского?",
      en: "How is Emperor different from Royal?",
      kk: "Император Патшадан немен ерекшеленеді?",
    },
    a: {
      ru: "Император — это всё из Королевского плюс личный ИИ-коуч Oscar Prime, безлимитные монеты, свои темы и сценарии и эксклюзивные награды.",
      en: "Emperor is everything in Royal plus Oscar Prime, your personal AI coach, unlimited coins, your own topics and scripts, and exclusive awards.",
      kk: "Император — Патша жоспарындағының бәрі, оған қоса жеке ЖИ-коуч Oscar Prime, шексіз монеталар, өз тақырыптарыңыз бен сценарийлеріңіз және эксклюзив марапаттар.",
    },
  },
  {
    q: {
      ru: "Как сменить план?",
      en: "How do I change my plan?",
      kk: "Жоспарды қалай ауыстыруға болады?",
    },
    a: {
      ru: "Выберите другой план на этом экране — магазин приложений сам пересчитает оплату за оставшийся период.",
      en: "Pick a different plan on this screen — the app store will recalculate the payment for the remaining period.",
      kk: "Осы экраннан басқа жоспарды таңдаңыз — қосымшалар дүкені қалған кезеңнің төлемін өзі қайта есептейді.",
    },
  },
  {
    q: {
      ru: "Сохранится ли прогресс после отмены?",
      en: "Will I keep my progress after cancelling?",
      kk: "Жазылымды тоқтатқаннан кейін прогресс сақтала ма?",
    },
    a: {
      ru: "Да. Пройденные уровни, монеты и записи останутся с вами — закроется только доступ к платным модулям.",
      en: "Yes. Completed levels, coins and recordings stay with you — only access to paid modules closes.",
      kk: "Иә. Өткен деңгейлер, монеталар мен жазбалар сізде қалады — тек ақылы модульдерге қолжетімділік жабылады.",
    },
  },
];

// Paywall copy (RU / EN / KK).
const STR = {
  soonTitle: { ru: "Скоро", en: "Coming soon", kk: "Жақында" },
  soonPay: {
    ru: "Оплата появится в одном из ближайших обновлений.",
    en: "Payments are coming in one of the next updates.",
    kk: "Төлем жақын арадағы жаңартулардың бірінде қосылады.",
  },
  soonPromo: {
    ru: "Промокоды заработают вместе с подпиской.",
    en: "Promo codes will start working together with subscriptions.",
    kk: "Промокодтар жазылыммен бірге іске қосылады.",
  },
  soonSupport: {
    ru: "Чат с поддержкой появится в одном из ближайших обновлений.",
    en: "Support chat is coming in one of the next updates.",
    kk: "Қолдау чаты жақын арадағы жаңартулардың бірінде пайда болады.",
  },
  free: { ru: "Базовый", en: "Basic", kk: "Базалық" },
  perMonth: { ru: "/ мес", en: "/ month", kk: "/ ай" },
  current: { ru: "ТЕКУЩИЙ", en: "CURRENT", kk: "ҚАЗІРГІ" },
  forever: { ru: "навсегда", en: "forever", kk: "мәңгі" },
  freeNote: {
    ru: "5 уровней пути · 3 темы Show Time · базовый разбор",
    en: "5 path levels · 3 Show Time topics · basic analysis",
    kk: "Жолдың 5 деңгейі · Show Time-ның 3 тақырыбы · негізгі талдау",
  },
  royal: { ru: "Королевский", en: "Royal", kk: "Патша" },
  popular: { ru: "ПОПУЛЯРНЫЙ", en: "POPULAR", kk: "ТАНЫМАЛ" },
  royalSub: {
    ru: "Для тех, кто выходит на сцену всерьёз",
    en: "For those who take the stage seriously",
    kk: "Сахнаға шындап шығатындарға арналған",
  },
  month: { ru: "МЕСЯЦ", en: "MONTH", kk: "АЙ" },
  year: { ru: "ГОД", en: "YEAR", kk: "ЖЫЛ" },
  royalPerMonth: {
    ru: "≈ $3.33 в месяц при оплате за год",
    en: "≈ $3.33 a month, billed yearly",
    kk: "Жылдық төлемде айына ≈ $3.33",
  },
  royalItems: {
    ru: [
      { title: "Весь путь — 67 модулей", detail: "От первой уверенной фразы до выступления без бумажки" },
      { title: "ИИ-разбор от Oscar v6.7", detail: "Подробный анализ речи и полезная обратная связь после каждой записи" },
      { title: "Все темы Show Time", detail: "Репетируй выступление перед залом" },
      { title: "Королевские уровни открыты", detail: "И никакой рекламы" },
    ],
    en: [
      { title: "The whole path — 67 modules", detail: "From your first confident line to speaking without notes" },
      { title: "AI review by Oscar v6.7", detail: "In-depth speech analysis and useful feedback after every recording" },
      { title: "Every Show Time topic", detail: "Rehearse your talk in front of an audience" },
      { title: "Royal levels unlocked", detail: "And no ads at all" },
    ],
    kk: [
      { title: "Бүкіл жол — 67 модуль", detail: "Алғашқы сенімді сөйлемнен қағазсыз сөйлеуге дейін" },
      { title: "Oscar v6.7 ЖИ-талдауы", detail: "Әр жазбадан кейін сөйлеуді терең талдау және пайдалы кері байланыс" },
      { title: "Show Time-ның барлық тақырыбы", detail: "Сөзіңізді залдың алдында қайталаңыз" },
      { title: "Корольдік деңгейлер ашық", detail: "Жарнама мүлде жоқ" },
    ],
  },
  emperor: { ru: "Император", en: "Emperor", kk: "Император" },
  maximum: { ru: "МАКСИМУМ", en: "MAXIMUM", kk: "МАКСИМУМ" },
  emperorSub: {
    ru: "Всё без границ + личный ИИ-коуч",
    en: "Everything, no limits + a personal AI coach",
    kk: "Бәрі шексіз + жеке ЖИ-коуч",
  },
  emperorPerMonth: {
    ru: "≈ $6.67 в месяц при оплате за год",
    en: "≈ $6.67 a month, billed yearly",
    kk: "Жылдық төлемде айына ≈ $6.67",
  },
  emperorItems: {
    ru: [
      { title: "Всё, что есть в Королевском", detail: "" },
      { title: "Личный ИИ-коуч Oscar Prime", detail: "Видит твои слабые места и каждый день даёт план тренировки" },
      { title: "Безлимитные монеты", detail: "Подсказки и бонусы — без ограничений" },
      { title: "Свои темы и сценарии", detail: "Загрузи реальное выступление и отрепетируй его перед залом" },
      { title: "Эксклюзивные награды и рамки", detail: "Видно всем, кто смотрит твой профиль" },
    ],
    en: [
      { title: "Everything in Royal", detail: "" },
      { title: "Oscar Prime, your personal AI coach", detail: "Spots your weak points and gives you a training plan every day" },
      { title: "Unlimited coins", detail: "Hints and bonuses — no limits" },
      { title: "Your own topics and scripts", detail: "Upload your real talk and rehearse it in front of the audience" },
      { title: "Exclusive awards and frames", detail: "Seen by everyone who views your profile" },
    ],
    kk: [
      { title: "Патша жоспарындағының бәрі", detail: "" },
      { title: "Жеке ЖИ-коуч Oscar Prime", detail: "Әлсіз тұстарыңызды көріп, күн сайын жаттығу жоспарын береді" },
      { title: "Шексіз монеталар", detail: "Кеңестер мен бонустар — шектеусіз" },
      { title: "Өз тақырыптарыңыз бен сценарийлеріңіз", detail: "Нақты сөзіңізді жүктеп, залдың алдында қайталаңыз" },
      { title: "Эксклюзив марапаттар мен жақтаулар", detail: "Профиліңізді көргендердің бәріне көрінеді" },
    ],
  },
  close: { ru: "Закрыть", en: "Close", kk: "Жабу" },
  restore: { ru: "Восстановить покупки", en: "Restore purchases", kk: "Сатып алуларды қалпына келтіру" },
  title: { ru: "Стань королём\nсцены", en: "Become the king\nof the stage", kk: "Сахнаның\nпатшасы болыңыз" },
  subtitle: {
    ru: "Открой все сцены, темы и разборы",
    en: "Unlock every stage, topic and analysis in",
    kk: "Барлық сахна, тақырып пен талдауды ашыңыз",
  },
  currentPlan: { ru: "Текущий план", en: "Current plan", kk: "Қазіргі жоспар" },
  buy: { ru: "Приобрести", en: "Get it", kk: "Сатып алу" },
  promoTitle: { ru: "Есть промокод?", en: "Have a promo code?", kk: "Промокодыңыз бар ма?" },
  promoPlaceholder: { ru: "Введите промокод", en: "Enter promo code", kk: "Промокодты енгізіңіз" },
  apply: { ru: "Применить", en: "Apply", kk: "Қолдану" },
  faqTitle: { ru: "Частые вопросы", en: "FAQ", kk: "Жиі қойылатын сұрақтар" },
  supportTitle: { ru: "Служба поддержки", en: "Support", kk: "Қолдау қызметі" },
  supportSub: { ru: "Ответим в течение 24 часов", en: "We reply within 24 hours", kk: "24 сағат ішінде жауап береміз" },
  write: { ru: "Написать", en: "Message us", kk: "Жазу" },
  legal: {
    ru: "Подписка продлевается автоматически, отменить можно в любой момент в настройках магазина приложений.",
    en: "The subscription renews automatically; you can cancel any time in your app store settings.",
    kk: "Жазылым автоматты түрде ұзартылады, оны кез келген уақытта қосымшалар дүкенінің баптауларынан тоқтатуға болады.",
  },
  legalLinks: {
    ru: "Условия использования · Политика конфиденциальности",
    en: "Terms of Use · Privacy Policy",
    kk: "Пайдалану шарттары · Құпиялылық саясаты",
  },
  gotIt: { ru: "Понятно", en: "Got it", kk: "Түсінікті" },
};

export default function SubscriptionScreen() {
  useScreenMusic("premium");
  // The paywall always sits on the dark animated aurora, whatever the app theme.
  const theme = DARK;
  const { lang } = useLang();
  const tr = <T,>(v: L10n<T>): T => pickLang(lang, v);
  const isDark = true;
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 54 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  // Text on the page background: cream on dark, ink on light.
  const ink = (a: number) => (isDark ? `rgba(240,238,233,${a})` : `rgba(38,38,40,${a})`);

  const [royalPeriod, setRoyalPeriod] = useState<Period>("year");
  const [emperorPeriod, setEmperorPeriod] = useState<Period>("month");
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [promo, setPromo] = useState("");
  const [soon, setSoon] = useState<null | { title: string; message: string }>(null);

  const showSoon = (title = tr(STR.soonTitle), message = tr(STR.soonPay)) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSoon({ title, message });
  };

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/profile" as any);
  };

  const freeCard = (
    <FreePlanRow title={tr(STR.free)} badge={tr(STR.current)} price="$0" per={tr(STR.perMonth)} />
  );

  // Royal: violet → fuchsia glass
  const royalCard = (
    <GlassPlanCard
      title={tr(STR.royal)}
      badge={tr(STR.popular)}
      sub={tr(STR.royalSub)}
      tint={["rgba(110,52,230,0.62)", "rgba(153,50,204,0.5)", "rgba(226,62,176,0.55)"]}
      accent="#F7B6F0"
      monthLabel={tr(STR.month)}
      yearLabel={tr(STR.year)}
      monthPrice="$4.99"
      yearPrice="$39.99"
      save="−33%"
      period={royalPeriod}
      onPeriod={setRoyalPeriod}
      perMonth={tr(STR.royalPerMonth)}
      items={tr(STR.royalItems)}
      cta={tr(STR.buy)}
      ctaColors={["#FFFFFF", "#FBE9FF"]}
      ctaText="#3B0E5C"
      glow="#F7B6F0"
      onCta={() => showSoon()}
    />
  );

  // Emperor: orange → violet glass
  const emperorCard = (
    <GlassPlanCard
      title={tr(STR.emperor)}
      badge={tr(STR.maximum)}
      sub={tr(STR.emperorSub)}
      tint={["rgba(255,128,64,0.6)", "rgba(220,70,120,0.5)", "rgba(120,40,200,0.6)"]}
      accent={APRICOT}
      monthLabel={tr(STR.month)}
      yearLabel={tr(STR.year)}
      monthPrice="$9.99"
      yearPrice="$79.99"
      save="−33%"
      period={emperorPeriod}
      onPeriod={setEmperorPeriod}
      perMonth={tr(STR.emperorPerMonth)}
      items={tr(STR.emperorItems)}
      cta={tr(STR.buy)}
      ctaColors={["#FFE9D6", APRICOT]}
      ctaText="#3A1206"
      glow="#FFB98A"
      onCta={() => showSoon()}
    />
  );

  return (
    <View style={[styles.container, { backgroundColor: "#08061A" }]}>
      <AuroraBackground />
      <ScrollView
        contentContainerStyle={{ paddingTop: topPad, paddingBottom: bottomPad + rs(24) }}
        showsVerticalScrollIndicator={false}
      >
        {/* Top bar: close ✕ + restore purchases */}
        <View style={styles.topBar}>
          <Pressable onPress={close} hitSlop={8} accessibilityLabel={tr(STR.close)} style={styles.closeBtn}>
            <SvgXml xml={isDark ? CLOSE_SVG : CLOSE_SVG.replace("#F0EEE9", "#262628")} width={rs(40)} height={rs(40)} />
          </Pressable>
          <Pressable
            hitSlop={8}
            onPress={() => {
              // TODO(design): restore purchases once IAP is integrated.
            }}
          >
            <Text style={[styles.restore, { color: ink(0.6) }]}>{tr(STR.restore)}</Text>
          </Pressable>
        </View>

        <Text style={[styles.title, { color: theme.text }]}>{tr(STR.title)}</Text>
        {/* subtitle, then the brand on its own line: one-line «King Speech»
            wordmark + crown. Not inline inside <Text> — iOS clips inline views
            to the line box, which cut the «g» tail. */}
        <Text style={[styles.subtitle, { color: ink(0.7) }]}>{tr(STR.subtitle)}</Text>
        <View style={styles.brandRow} accessibilityLabel="King Speech">
          <SvgXml xml={BRAND_INLINE_XML} width={BRAND.w} height={BRAND.h} />
          <SvgXml
            xml={LOGO_CROWN.xml.split("__FG__").join(BRAND_INK)}
            width={BRAND.crownH * (LOGO_CROWN.w / LOGO_H)}
            height={BRAND.crownH}
            // bottoms align: lift the crown by the wordmark's descent (so it stands
            // on the letters' baseline) minus the empty strip under the crown art
            style={{ marginLeft: rs(5), marginBottom: BRAND.descent - BRAND.crownH * ((53 - 45.9) / 53) }}
          />
        </View>

        <View style={styles.plans}>
          {freeCard}
          {royalCard}
          {emperorCard}
        </View>

        {/* Promo code */}
        <Text style={[styles.sectionTitle, { color: theme.text, marginTop: rs(26) }]}>{tr(STR.promoTitle)}</Text>
        <View style={[styles.promo, { backgroundColor: ink(0.05), borderColor: ink(0.12) }]}>
          <TextInput
            value={promo}
            onChangeText={setPromo}
            placeholder={tr(STR.promoPlaceholder)}
            placeholderTextColor={ink(0.4)}
            autoCapitalize="characters"
            autoCorrect={false}
            style={[styles.promoInput, { color: theme.text }]}
          />
          <Pressable
            onPress={() => showSoon(tr(STR.soonTitle), tr(STR.soonPromo))}
            style={({ pressed }) => [styles.applyBtn, { backgroundColor: "#0A0910", opacity: pressed ? 0.85 : 1 }]}
          >
            <Text style={[styles.applyText, { color: "#F0EEE9" }]}>{tr(STR.apply)}</Text>
          </Pressable>
        </View>

        {/* FAQ accordion */}
        <Text style={[styles.sectionTitle, { color: theme.text, marginTop: rs(32) }]}>{tr(STR.faqTitle)}</Text>
        <View style={[styles.faq, { backgroundColor: ink(0.05), borderColor: ink(0.12) }]}>
          {FAQ.map((f, i) => {
            const open = openFaq === i;
            return (
              <Pressable
                key={f.q.ru}
                onPress={() => setOpenFaq(open ? null : i)}
                style={[
                  styles.faqRow,
                  i < FAQ.length - 1 && { borderBottomWidth: 1, borderBottomColor: ink(0.08) },
                  open && { paddingBottom: rs(21) },
                ]}
              >
                <View style={styles.faqHead}>
                  <Text style={[styles.faqQ, { color: theme.text }]}>{tr(f.q)}</Text>
                  <View style={{ marginTop: rs(5) }}>
                    <SvgXml
                      xml={
                        open
                          ? isDark
                            ? CHEVRON_UP_SVG
                            : CHEVRON_UP_SVG.replace("#FFD857", "#262628")
                          : isDark
                            ? CHEVRON_DOWN_SVG
                            : CHEVRON_DOWN_SVG.replace("#F0EEE9", "#262628")
                      }
                      width={rs(14)}
                      height={rs(8)}
                    />
                  </View>
                </View>
                {open ? <Text style={[styles.faqA, { color: ink(0.65) }]}>{tr(f.a)}</Text> : null}
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.legal, { color: ink(0.4) }]}>
          {tr(STR.legal)}
          {"\n"}{tr(STR.legalLinks)}
        </Text>
      </ScrollView>

      <AppDialog
        visible={!!soon}
        title={soon?.title ?? ""}
        message={soon?.message}
        onRequestClose={() => setSoon(null)}
        buttons={[{ label: tr(STR.gotIt), variant: "primary", onPress: () => setSoon(null) }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  pageGlow: { position: "absolute", top: 0, left: 0, right: 0 },
  topBar: {
    marginTop: 6,
    height: 40,
    paddingLeft: 20,
    paddingRight: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  closeBtn: { width: 40, height: 40 },
  restore: { fontSize: 13, fontFamily: "Geologica_700Bold" },
  hero: { height: 162, alignSelf: "stretch" },
  heroAbs: { position: "absolute", left: "50%" },
  title: {
    marginTop: 48,
    fontSize: 40,
    lineHeight: 44,
    fontFamily: "Geologica_900Black",
    letterSpacing: -0.8,
    textAlign: "center",
    paddingHorizontal: 20,
  },
  subtitle: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 18,
    fontFamily: "Geologica_600SemiBold",
    textAlign: "center",
    alignSelf: "center",
    maxWidth: 322,
  },
  brandRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "center", marginTop: 4 },
  plans: { marginTop: 28, paddingHorizontal: 20, gap: 18 },
  card: { borderRadius: 22, borderWidth: 2 },
  cardShadow: {
    shadowColor: "#000",
    shadowOpacity: 0.55,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: rs(14) },
    elevation: 10,
  },
  cardHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  freeTitle: { fontSize: 24, fontFamily: "Geologica_900Black", letterSpacing: -0.12 },
  planTitle: { fontSize: 26, fontFamily: "Geologica_900Black", letterSpacing: -0.26 },
  planSub: { fontSize: 14, fontFamily: "Geologica_700Bold" },
  priceRow: { flexDirection: "row", alignItems: "flex-end", marginTop: 6 },
  bigPrice: { fontSize: 30, fontFamily: "Geologica_900Black", letterSpacing: -0.3 },
  priceNote: { fontSize: 14, fontFamily: "Geologica_700Bold", marginLeft: 8, marginBottom: 5 },
  priceTiles: { flexDirection: "row", gap: 8, marginTop: 16 },
  perMonth: { fontSize: 12, fontFamily: "Geologica_700Bold", marginTop: 8 },
  watermark: {
    position: "absolute",
    left: 211,
    top: -5,
    transform: [{ rotate: "12.77deg" }, { skewX: "-7.17deg" }],
  },
  innerHighlight: { position: "absolute", top: 0, left: 0, right: 0 },
  sheen: { position: "absolute", top: 0, left: 0, right: 0, height: 90 },
  sectionTitle: { fontSize: 17, fontFamily: "Geologica_800ExtraBold", marginLeft: 24, marginBottom: 15 },
  promo: {
    marginHorizontal: 20,
    height: 60,
    borderRadius: 32,
    borderWidth: 2,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 19,
    paddingRight: 5,
  },
  promoInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Geologica_600SemiBold",
    paddingVertical: 0,
    ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : null),
  },
  applyBtn: {
    minWidth: 116,
    minHeight: 44,
    paddingHorizontal: 20,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  applyText: { color: "#FFFFFF", fontSize: 14, fontFamily: "Geologica_900Black" },
  faq: { marginHorizontal: 20, borderRadius: 22, borderWidth: 2, overflow: "hidden" },
  faqRow: { marginHorizontal: 19, paddingTop: 18, paddingBottom: 14, minHeight: 58 },
  faqHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  faqQ: { width: 290, maxWidth: "88%", fontSize: 14, lineHeight: 16.8, fontFamily: "Geologica_800ExtraBold" },
  faqA: { marginTop: 12, fontSize: 13, lineHeight: 15.6, fontFamily: "Geologica_600SemiBold", maxWidth: 310 },
  support: {
    marginTop: 28,
    marginHorizontal: 20,
    minHeight: 88,
    paddingVertical: 12,
    borderRadius: 22,
    borderWidth: 2,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 17,
  },
  supportTitle: { fontSize: 15, fontFamily: "Geologica_800ExtraBold" },
  supportSub: { fontSize: 13, fontFamily: "Geologica_600SemiBold", marginTop: 4 },
  writeBtn: {
    minHeight: 44,
    paddingHorizontal: 20,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  writeText: { color: "#FFFFFF", fontSize: 13, fontFamily: "Geologica_800ExtraBold" },
  legal: {
    marginTop: 24,
    alignSelf: "center",
    maxWidth: 338,
    marginHorizontal: 32,
    fontSize: 11,
    lineHeight: 13.2,
    fontFamily: "Geologica_600SemiBold",
    textAlign: "center",
  },
});
