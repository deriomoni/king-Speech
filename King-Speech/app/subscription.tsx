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
import * as Haptics from "expo-haptics";
import { useTheme } from "@/context/ThemeContext";
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

const FAQ: { q: string; a: string }[] = [
  {
    q: "Можно ли отменить подписку?",
    a: "Да, в любой момент в настройках App Store или Google Play. Доступ сохранится до конца оплаченного периода.",
  },
  {
    q: "Чем Император отличается от Королевского?",
    a: "Император — это всё из Королевского плюс личный ИИ-коуч, свои темы и сценарии, эксклюзивные награды и x2 монеты за каждый уровень.",
  },
  {
    q: "Как сменить план?",
    a: "Выберите другой план на этом экране — магазин приложений сам пересчитает оплату за оставшийся период.",
  },
  {
    q: "Сохранится ли прогресс после отмены?",
    a: "Да. Пройденные уровни, монеты и записи останутся с вами — закроется только доступ к платным модулям.",
  },
];

export default function SubscriptionScreen() {
  const { theme, themeMode } = useTheme();
  const isDark = themeMode === "dark";
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

  const showSoon = (title = "Скоро", message = "Оплата появится в одном из ближайших обновлений.") => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSoon({ title, message });
  };

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/profile" as any);
  };

  // ── Free card (Figma 132:192) ────────────────────────────────────────────
  const freeCard = (
    <View
      style={[
        styles.card,
        styles.cardShadow,
        !isDark && { shadowOpacity: 0.18 },
        isDark
          ? { backgroundColor: "#343435", borderColor: "rgba(240,238,233,0.12)" }
          : { backgroundColor: theme.cardElevated, borderColor: theme.cardBorder },
        { padding: 19, paddingBottom: 19.5 },
      ]}
    >
      <View style={styles.cardHead}>
        <Text style={[styles.freeTitle, { color: theme.text }]}>Бесплатный</Text>
        <Badge
          label="ТЕКУЩИЙ"
          bg={isDark ? "#4F4F4F" : "rgba(38,38,40,0.10)"}
          color={theme.text}
          style={{ marginTop: 4 }}
        />
      </View>
      <View style={styles.priceRow}>
        <Text style={[styles.bigPrice, { color: theme.text }]}>$0</Text>
        <Text style={[styles.priceNote, { color: ink(0.55) }]}>навсегда</Text>
      </View>
      <View style={{ marginTop: 19 }}>
        <Checklist
          tone="free"
          color={ink(0.9)}
          items={["5 уровней пути", "Разминка и скороговорки", "3 темы Show Time", "Базовый разбор речи"]}
        />
      </View>
    </View>
  );

  // ── Royal card (Figma 132:206) ───────────────────────────────────────────
  const royalCard = (
    <View style={[styles.card, styles.cardShadow,
        !isDark && { shadowOpacity: 0.18 }, { borderColor: "#FFF5D1", overflow: "hidden" }]}>
      <LinearGradient
        colors={["#FFED9E", "#FFEDA8", "#FABD33"]}
        locations={[0, 0.393, 0.714]}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Crown watermark, top-right, rotated 12.77° */}
      <View pointerEvents="none" style={styles.watermark}>
        <SvgXml xml={CROWN_WATERMARK_SVG} width={157.703} height={104.122} />
      </View>
      {/* inset top highlight */}
      <View pointerEvents="none" style={[styles.innerHighlight, { backgroundColor: "rgba(255,255,255,0.7)", height: 2 }]} />
      <View style={{ padding: 19, paddingTop: 21, paddingBottom: 27.5 }}>
        <View style={styles.cardHead}>
          <Text style={[styles.planTitle, { color: INK }]}>Королевский</Text>
          <Badge label="★ ПОПУЛЯРНЫЙ" bg={INK} color={GOLD} style={{ marginTop: 4 }} />
        </View>
        <Text style={[styles.planSub, { color: "rgba(38,38,40,0.65)", marginTop: 6 }]}>
          Для тех, кто выходит на сцену всерьёз
        </Text>
        <View style={styles.priceTiles}>
          <PriceTile
            variant="royal"
            label="МЕСЯЦ"
            price="$4.99"
            selected={royalPeriod === "month"}
            onPress={() => setRoyalPeriod("month")}
          />
          <PriceTile
            variant="royal"
            label="ГОД"
            price="$39.99"
            save="−33%"
            selected={royalPeriod === "year"}
            onPress={() => setRoyalPeriod("year")}
          />
        </View>
        <Text style={[styles.perMonth, { color: "rgba(38,38,40,0.6)" }]}>≈ $3.33 в месяц при оплате за год</Text>
        <View style={{ marginTop: 13 }}>
          <Checklist
            tone="royal"
            color="rgba(38,38,40,0.9)"
            items={["Все 67 модулей пути", "Все темы Show Time и Роли", "Подробный ИИ-разбор речи", "Без рекламы"]}
          />
        </View>
      </View>
    </View>
  );

  // ── Emperor card (Figma 132:231) ─────────────────────────────────────────
  const emperorCard = (
    <View
      style={[
        styles.card,
        styles.cardShadow,
        !isDark && { shadowOpacity: 0.18 },
        { borderWidth: 4, borderColor: "rgba(255,242,191,0.9)", backgroundColor: "#2F2F31", overflow: "hidden" },
      ]}
    >
      {/* radial gold glow, bottom-left */}
      <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 362 360">
        <Defs>
          <RadialGradient id="empGlow" cx="60.3" cy="278.2" rx="201.1" ry="163.6" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#FFEDA8" stopOpacity="0.35" />
            <Stop offset="1" stopColor="#FFEDA8" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="362" height="360" fill="url(#empGlow)" />
      </Svg>
      <LinearGradient
        pointerEvents="none"
        colors={["rgba(240,238,233,0.1)", "rgba(240,238,233,0)"]}
        style={styles.sheen}
      />
      <View pointerEvents="none" style={[styles.innerHighlight, { backgroundColor: "rgba(240,238,233,0.2)", height: 1.5 }]} />
      <View pointerEvents="none" style={{ position: "absolute", left: 4, top: 4 }}>
        <SvgXml xml={EMPEROR_CROWN_SVG} width={54} height={41.9964} />
      </View>
      <View pointerEvents="none" style={{ position: "absolute", left: 286, top: 56 }}>
        <SvgXml xml={SPARKLE4_SVG} width={26} height={26} />
      </View>
      <View pointerEvents="none" style={{ position: "absolute", left: 320, top: 136 }}>
        <SvgXml xml={SPARKLE3_SVG} width={23} height={23} />
      </View>
      <View style={{ paddingHorizontal: 18, paddingTop: 18, paddingBottom: 24.5 }}>
        <View style={styles.cardHead}>
          <Text style={[styles.planTitle, { color: GOLD, marginLeft: 42 }]}>Император</Text>
          <Badge label="МАКСИМУМ" bg={GOLD} color={INK} style={{ marginTop: 6 }} />
        </View>
        <Text style={[styles.planSub, { color: "rgba(240,238,233,0.65)", marginTop: 7 }]}>
          Всё без границ + личный ИИ-коуч
        </Text>
        <View style={styles.priceTiles}>
          <PriceTile
            variant="emperor"
            label="МЕСЯЦ"
            price="$9.99"
            selected={emperorPeriod === "month"}
            onPress={() => setEmperorPeriod("month")}
          />
          <PriceTile
            variant="emperor"
            label="ГОД"
            price="$79.99"
            save="−33%"
            selected={emperorPeriod === "year"}
            onPress={() => setEmperorPeriod("year")}
          />
        </View>
        <Text style={[styles.perMonth, { color: "rgba(240,238,233,0.5)" }]}>≈ $6.67 в месяц при оплате за год</Text>
        <View style={{ marginTop: 13 }}>
          <Checklist
            tone="emperor"
            color="rgba(240,238,233,0.9)"
            items={[
              "Всё из Королевского",
              "Личный ИИ-коуч и план тренировок",
              "Свои темы и сценарии",
              "Эксклюзивные награды и рамки",
              "x2 монеты за каждый уровень",
            ]}
            trailing={<CoinIcon size={17} color={GOLD} style={{ marginLeft: 6 }} />}
          />
        </View>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <ScrollView
        contentContainerStyle={{ paddingTop: topPad, paddingBottom: bottomPad + 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Page glow — radial gold centred behind the hero/plans */}
        <Svg
          pointerEvents="none"
          style={styles.pageGlow}
          width="100%"
          height={1100}
          viewBox="0 0 402 1100"
          preserveAspectRatio="none"
        >
          <Defs>
            <RadialGradient id="pageGlow" cx="201" cy="541.8" rx="182.7" ry="436.9" gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor="#FFEDA8" stopOpacity={isDark ? 0.38 : 0.3} />
              <Stop offset="1" stopColor="#FFEDA8" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width="402" height="1100" fill="url(#pageGlow)" />
        </Svg>

        {/* Top bar: close ✕ + restore purchases */}
        <View style={styles.topBar}>
          <Pressable onPress={close} hitSlop={8} accessibilityLabel="Закрыть" style={styles.closeBtn}>
            <SvgXml xml={isDark ? CLOSE_SVG : CLOSE_SVG.replace("#F0EEE9", "#262628")} width={40} height={40} />
          </Pressable>
          <Pressable
            hitSlop={8}
            onPress={() => {
              // TODO(design): restore purchases once IAP is integrated.
            }}
          >
            <Text style={[styles.restore, { color: ink(0.6) }]}>Восстановить покупки</Text>
          </Pressable>
        </View>

        {/* Hero crown + sparkles (positions relative to the screen centre) */}
        <View style={styles.hero} pointerEvents="none">
          <View style={[styles.heroAbs, { marginLeft: -105, top: -11 }]}>
            <SvgXml xml={CROWN_GLOW_SVG} width={210} height={188.213} />
          </View>
          <View style={[styles.heroAbs, { marginLeft: -92, top: 15 }]}>
            <SvgXml xml={CROWN_SVG} width={184} height={163.666} />
          </View>
          <View style={[styles.heroAbs, { marginLeft: -97, top: 0 }]}>
            <SvgXml xml={SPARKLE0_SVG} width={32} height={32} />
          </View>
          <View style={[styles.heroAbs, { marginLeft: 73, top: -8 }]}>
            <SvgXml xml={SPARKLE1_SVG} width={27} height={27} />
          </View>
          <View style={[styles.heroAbs, { marginLeft: 91, top: 88 }]}>
            <SvgXml xml={SPARKLE2_SVG} width={25} height={25} />
          </View>
          <View style={[styles.heroAbs, { marginLeft: -113, top: 102 }]}>
            <SvgXml xml={SPARKLE3_SVG} width={23} height={23} />
          </View>
        </View>

        <Text style={[styles.title, { color: theme.text }]}>Стань королём{"\n"}сцены</Text>
        <Text style={[styles.subtitle, { color: ink(0.7) }]}>
          Открой все сцены, темы и разборы King Speech
        </Text>

        <View style={styles.plans}>
          <PlanWithTray
            card={freeCard}
            disabled
            trayLabel="Текущий план"
            trayLabelColor="#FFFFFF"
            trayStyle={{
              backgroundColor: isDark ? "rgba(208,187,159,0.62)" : "#8F8272",
              borderWidth: 2,
              borderColor: "#312C24",
              shadowColor: "#000",
              shadowOpacity: 0.25,
              shadowRadius: 4,
              shadowOffset: { width: 0, height: 4 },
            }}
          />
          <PlanWithTray
            card={royalCard}
            trayLabel="Стать Королём →"
            trayLabelColor={GOLD}
            onTrayPress={() => showSoon()}
            trayStyle={{ backgroundColor: "#262628", borderWidth: 2, borderColor: "#666666" }}
          />
          <PlanWithTray
            card={emperorCard}
            trayLabel="Стать Императором →"
            trayLabelColor={INK}
            onTrayPress={() => showSoon()}
            trayStyle={{ backgroundColor: GOLD, borderWidth: 4, borderColor: theme.ctaStroke, paddingBottom: 19 }}
          />
        </View>

        {/* Promo code */}
        <Text style={[styles.sectionTitle, { color: theme.text, marginTop: 26 }]}>Есть промокод?</Text>
        <View style={[styles.promo, { backgroundColor: ink(0.05), borderColor: ink(0.12) }]}>
          <TextInput
            value={promo}
            onChangeText={setPromo}
            placeholder="Введите промокод"
            placeholderTextColor={ink(0.4)}
            autoCapitalize="characters"
            autoCorrect={false}
            style={[styles.promoInput, { color: theme.text }]}
          />
          <Pressable
            onPress={() => showSoon("Скоро", "Промокоды заработают вместе с подпиской.")}
            style={({ pressed }) => [styles.applyBtn, { opacity: pressed ? 0.85 : 1 }]}
          >
            <Text style={styles.applyText}>Применить</Text>
          </Pressable>
        </View>

        {/* FAQ accordion */}
        <Text style={[styles.sectionTitle, { color: theme.text, marginTop: 32 }]}>Частые вопросы</Text>
        <View style={[styles.faq, { backgroundColor: ink(0.05), borderColor: ink(0.12) }]}>
          {FAQ.map((f, i) => {
            const open = openFaq === i;
            return (
              <Pressable
                key={f.q}
                onPress={() => setOpenFaq(open ? null : i)}
                style={[
                  styles.faqRow,
                  i < FAQ.length - 1 && { borderBottomWidth: 1, borderBottomColor: ink(0.08) },
                  open && { paddingBottom: 21 },
                ]}
              >
                <View style={styles.faqHead}>
                  <Text style={[styles.faqQ, { color: theme.text }]}>{f.q}</Text>
                  <View style={{ marginTop: 5 }}>
                    <SvgXml
                      xml={
                        open
                          ? isDark
                            ? CHEVRON_UP_SVG
                            : CHEVRON_UP_SVG.replace("#FFEDA8", "#262628")
                          : isDark
                            ? CHEVRON_DOWN_SVG
                            : CHEVRON_DOWN_SVG.replace("#F0EEE9", "#262628")
                      }
                      width={14}
                      height={8}
                    />
                  </View>
                </View>
                {open ? <Text style={[styles.faqA, { color: ink(0.65) }]}>{f.a}</Text> : null}
              </Pressable>
            );
          })}
        </View>

        {/* Support */}
        <View style={[styles.support, { backgroundColor: ink(0.05), borderColor: ink(0.12) }]}>
          <SvgXml
            xml={isDark ? ICON_PLATE_SVG : ICON_PLATE_SVG.split("#FFEDA8").join("#B88A00")}
            width={48}
            height={48}
          />
          <View style={{ flex: 1, marginLeft: 14, marginRight: 8 }}>
            <Text style={[styles.supportTitle, { color: theme.text }]}>Служба поддержки</Text>
            <Text style={[styles.supportSub, { color: ink(0.6) }]}>Ответим в течение 24 часов</Text>
          </View>
          <Pressable
            onPress={() => {
              // TODO(design): open the support chat / mail once a support channel exists.
              showSoon("Скоро", "Чат с поддержкой появится в одном из ближайших обновлений.");
            }}
            style={({ pressed }) => [styles.writeBtn, { opacity: pressed ? 0.85 : 1 }]}
          >
            <Text style={styles.writeText}>Написать</Text>
          </Pressable>
        </View>

        <Text style={[styles.legal, { color: ink(0.4) }]}>
          Подписка продлевается автоматически, отменить можно в любой момент в настройках магазина приложений.
          {"\n"}Условия использования · Политика конфиденциальности
        </Text>
      </ScrollView>

      <AppDialog
        visible={!!soon}
        title={soon?.title ?? ""}
        message={soon?.message}
        onRequestClose={() => setSoon(null)}
        buttons={[{ label: "Понятно", variant: "primary", onPress: () => setSoon(null) }]}
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
    fontSize: 40,
    lineHeight: 44,
    fontFamily: "Geologica_900Black",
    letterSpacing: -0.8,
    textAlign: "center",
    paddingHorizontal: 20,
  },
  subtitle: {
    marginTop: 2,
    fontSize: 15,
    lineHeight: 18,
    fontFamily: "Geologica_600SemiBold",
    textAlign: "center",
    alignSelf: "center",
    maxWidth: 322,
  },
  plans: { marginTop: 24, paddingHorizontal: 20, gap: 24 },
  card: { borderRadius: 22, borderWidth: 2 },
  cardShadow: {
    shadowColor: "#000",
    shadowOpacity: 0.55,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 14 },
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
    width: 116,
    height: 44,
    borderRadius: 32,
    backgroundColor: "#716250",
    borderWidth: 2,
    borderColor: "#312C24",
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
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 32,
    backgroundColor: "#716250",
    borderWidth: 2,
    borderColor: "#312C24",
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
