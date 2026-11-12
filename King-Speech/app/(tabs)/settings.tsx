import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Platform } from "react-native";
import OverscrollFill from "@/components/OverscrollFill";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useLang } from "@/context/LangContext";
import { useAuth } from "@/context/AuthContext";
import { useDevTools } from "@/context/DevToolsContext";
import { useRouter } from "expo-router";
import { useTheme, type Theme, type ThemeMode } from "@/context/ThemeContext";
import {
  Card,
  Chevron,
  GoldSwitch,
  ListRow,
  SectionLabel,
  ThemedSvg,
  tapHaptic,
} from "@/components/settings/SettingsParts";
import { kingSpeechLogoXml } from "@/assets/figma/settings/logo";
import { bekWaveLogoXml } from "@/assets/figma/settings/bekwave";

// Figma "icon/crown-outline" (405:1310); __FG__ is swapped for theme.text.
const CROWN_OUTLINE_XML = `<svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M3.5 16.5L2.6 7.6L7.4 11L11 4.6L14.6 11L19.4 7.6L18.5 16.5H3.5Z" stroke="__FG__" stroke-width="1.6" stroke-linejoin="round"/>
<path d="M4.5 19H17.5" stroke="__FG__" stroke-width="1.6" stroke-linecap="round"/>
<path d="M11 13.9C11.718 13.9 12.3 13.318 12.3 12.6C12.3 11.882 11.718 11.3 11 11.3C10.282 11.3 9.7 11.882 9.7 12.6C9.7 13.318 10.282 13.9 11 13.9Z" fill="__FG__"/>
</svg>`;

// Muted segmented control: neutral track, the selected segment is just a
// slightly lighter chip — no accent colour, no outline.
const SEG = {
  dark: { track: "rgba(240,238,233,0.06)", chip: "rgba(240,238,233,0.14)" },
  light: { track: "rgba(38,38,40,0.06)", chip: "#FFFFFF" },
};

function ThemeSegment({
  theme,
  themeMode,
  labels,
  onSelect,
}: {
  theme: Theme;
  themeMode: ThemeMode;
  labels: { light: string; dark: string };
  onSelect: (m: ThemeMode) => void;
}) {
  const s = SEG[themeMode];
  return (
    <View style={[styles.segTrack, { backgroundColor: s.track }]}>
      {(["light", "dark"] as const).map((mode) => {
        const selected = themeMode === mode;
        return (
          <Pressable
            key={mode}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => {
              if (selected) return;
              tapHaptic();
              onSelect(mode);
            }}
            style={[styles.seg, selected && { backgroundColor: s.chip }]}
          >
            <Ionicons
              name={mode === "dark" ? "moon-outline" : "sunny-outline"}
              size={15}
              color={selected ? theme.text : theme.textMuted}
            />
            <Text style={[styles.segLabel, { color: selected ? theme.text : theme.textMuted }]}>
              {labels[mode]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { theme, themeMode, setTheme } = useTheme();
  const { lang: appLang, setLang: setAppLang, t } = useLang();
  const { user } = useAuth();
  const { isOpenTestingEnabled, setOpenTestingEnabled, isDevSkipEnabled, setDevSkipEnabled } =
    useDevTools();
  const router = useRouter();
  const en = appLang === "en";

  const [sound, setSound] = useState(true);
  const [vibration, setVibration] = useState(true);
  // TODO(design): no notification settings store exists yet — local state only.
  const [notifications, setNotifications] = useState(true);
  const [reminder, setReminder] = useState(true);
  const [showLangs, setShowLangs] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const userName = user?.name || t("profile");
  const initial = (userName.trim()[0] || "K").toUpperCase();
  const authLabel =
    user?.authMethod === "google" ? "Google" : user?.authMethod === "apple" ? "Apple" : "Email";
  const icon = (name: keyof typeof Ionicons.glyphMap) => (
    <Ionicons name={name} size={20} color={theme.text} />
  );
  const sw = (value: boolean, onChange: (v: boolean) => void) => (
    <GoldSwitch value={value} onValueChange={onChange} theme={theme} themeMode={themeMode} />
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.bezel }]}>
      <ScrollView
        contentContainerStyle={styles.scrollOuter}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
      >
        <OverscrollFill top={theme.bg} bottom={theme.bg} />
        {/* Figma 05b: logo on its own top plate (rounded bottom), bezel band, then the sheet */}
        <View
          style={[
            styles.headerPanel,
            { backgroundColor: theme.bg, borderColor: theme.panelStroke, paddingTop: topPad + 20 },
          ]}
        >
          <Animated.View entering={FadeInDown.duration(400)}>
            <ThemedSvg xml={kingSpeechLogoXml} width={159} height={53} fg={theme.text} />
          </Animated.View>
        </View>
        <View
          style={[
            styles.sheet,
            styles.scroll,
            {
              backgroundColor: theme.bg,
              borderColor: theme.panelStroke,
              paddingBottom: bottomPad + 120,
            },
          ]}
        >
          <Animated.View entering={FadeInDown.duration(400)}>
            <Text style={[styles.pageTitle, { color: theme.text }]}>{t("settings")}</Text>
          </Animated.View>

          {/* Account */}
          <Animated.View entering={FadeInDown.delay(40).duration(400)}>
            <SectionLabel theme={theme}>{en ? "Account" : "Аккаунт"}</SectionLabel>
            <Card theme={theme} themeMode={themeMode}>
              <Pressable
                onPress={() => {
                  tapHaptic();
                  // Account screen hosts sign-out / account management.
                  router.push("/account" as any);
                }}
                style={({ pressed }) => [
                  styles.accountRow,
                  pressed && { backgroundColor: theme.rowPressed },
                ]}
              >
                <View style={[styles.avatar, { backgroundColor: theme.accent }]}>
                  <Text style={[styles.avatarInitial, { color: theme.accentText }]}>{initial}</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.accountName, { color: theme.text }]} numberOfLines={1}>
                    {userName}
                  </Text>
                  <Text style={[styles.accountSub, { color: theme.textMuted }]} numberOfLines={1}>
                    {en ? `Signed in with ${authLabel}` : `Вход через ${authLabel}`}
                  </Text>
                </View>
                <Chevron theme={theme} />
                <View
                  pointerEvents="none"
                  style={[styles.inset, { left: 16, backgroundColor: theme.divider }]}
                />
              </Pressable>
              <ListRow
                theme={theme}
                icon={<ThemedSvg xml={CROWN_OUTLINE_XML} width={22} height={22} fg={theme.text} />}
                label={en ? "Free plan" : "Бесплатный план"}
                onPress={() => router.push("/subscription" as any)}
                right={
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      tapHaptic();
                      router.push("/subscription" as any);
                    }}
                    style={({ pressed }) => [
                      styles.upgradePill,
                      { backgroundColor: theme.cta, opacity: pressed ? 0.85 : 1 },
                    ]}
                  >
                    <Text style={[styles.upgradeLabel, { color: theme.ctaText }]}>
                      {en ? "Upgrade" : "Улучшить"}
                    </Text>
                  </Pressable>
                }
              />
            </Card>
          </Animated.View>

          {/* Sound & notifications — one grouped card */}
          <Animated.View entering={FadeInDown.delay(80).duration(400)}>
            <SectionLabel theme={theme}>
              {en ? "Sound & notifications" : "Звук и уведомления"}
            </SectionLabel>
            <Card theme={theme} themeMode={themeMode}>
              <ListRow
                theme={theme}
                icon={icon("volume-high-outline")}
                label={t("soundEffects")}
                divider
                right={sw(sound, setSound)}
              />
              <ListRow
                theme={theme}
                icon={icon("phone-portrait-outline")}
                label={t("vibration")}
                divider
                right={sw(vibration, setVibration)}
              />
              <ListRow
                theme={theme}
                icon={icon("notifications-outline")}
                label={t("pushNotifications")}
                divider
                right={sw(notifications, setNotifications)}
              />
              <ListRow
                theme={theme}
                icon={icon("alarm-outline")}
                label={en ? "Daily reminder · 09:00" : "Напоминание · 09:00"}
                right={sw(reminder, setReminder)}
              />
            </Card>
          </Animated.View>

          {/* Appearance: theme + language in one card */}
          <Animated.View entering={FadeInDown.delay(120).duration(400)}>
            <SectionLabel theme={theme}>{en ? "Appearance" : "Оформление"}</SectionLabel>
            <Card theme={theme} themeMode={themeMode}>
              <ListRow
                theme={theme}
                icon={icon("contrast-outline")}
                label={en ? "Theme" : "Тема"}
                divider
                right={
                  <ThemeSegment
                    theme={theme}
                    themeMode={themeMode}
                    labels={{ light: t("light"), dark: t("dark") }}
                    onSelect={setTheme}
                  />
                }
              />
              <ListRow
                theme={theme}
                icon={icon("globe-outline")}
                label={t("language")}
                value={appLang === "ru" ? "Русский" : "English"}
                divider={showLangs}
                onPress={() => setShowLangs(!showLangs)}
                right={
                  <Ionicons
                    name={showLangs ? "chevron-down" : "chevron-forward"}
                    size={16}
                    color={theme.textMuted}
                  />
                }
              />
              {showLangs &&
                (["ru", "en"] as const).map((code, i) => (
                  <ListRow
                    key={code}
                    theme={theme}
                    icon={null}
                    label={code === "ru" ? "Русский" : "English"}
                    divider={i === 0}
                    onPress={() => {
                      setAppLang(code);
                      setShowLangs(false);
                    }}
                    right={
                      appLang === code ? (
                        <Ionicons name="checkmark" size={18} color={theme.text} />
                      ) : (
                        <View />
                      )
                    }
                  />
                ))}
            </Card>
          </Animated.View>

          {/* Support */}
          <Animated.View entering={FadeInDown.delay(160).duration(400)}>
            <SectionLabel theme={theme}>{en ? "Support" : "Поддержка"}</SectionLabel>
            <Card theme={theme} themeMode={themeMode}>
              <ListRow
                theme={theme}
                icon={icon("chatbubble-ellipses-outline")}
                label={en ? "Feedback" : "Обратная связь"}
                divider
                onPress={() => {
                  // TODO(design): feedback destination not defined yet.
                }}
              />
              <ListRow
                theme={theme}
                icon={icon("logo-instagram")}
                label="Instagram"
                divider
                onPress={() => {
                  // TODO(design): Instagram profile URL not defined yet.
                }}
              />
              <ListRow
                theme={theme}
                icon={icon("star-outline")}
                label={en ? "Rate the app" : "Оценить приложение"}
                divider
                onPress={() => {
                  // TODO(design): store review prompt not wired yet.
                }}
              />
              <ListRow
                theme={theme}
                icon={icon("lock-closed-outline")}
                label={en ? "Privacy policy" : "Политика конфиденциальности"}
                onPress={() => {
                  // TODO(design): privacy policy URL/screen not defined yet.
                }}
              />
            </Card>
          </Animated.View>

          {/* Developer */}
          <Animated.View entering={FadeInDown.delay(200).duration(400)}>
            <SectionLabel theme={theme}>{t("devTools")}</SectionLabel>
            <Card theme={theme} themeMode={themeMode}>
              <ListRow
                theme={theme}
                icon={icon("construct-outline")}
                label={t("openTesting")}
                divider={__DEV__}
                right={sw(isOpenTestingEnabled, setOpenTestingEnabled)}
              />
              {/* Dev-only Skip mode. Gated behind __DEV__ so it never ships to players. */}
              {__DEV__ && (
                <ListRow
                  theme={theme}
                  icon={icon("play-skip-forward-outline")}
                  label="Skip уровней (dev)"
                  right={sw(isDevSkipEnabled, setDevSkipEnabled)}
                />
              )}
            </Card>
          </Animated.View>

          {/* Credits — quiet footer, outside the cards */}
          <View style={styles.credits}>
            <Text style={[styles.creditsLabel, { color: theme.textMuted }]}>
              {en ? "APP CREATED BY" : "ПРИЛОЖЕНИЕ СОЗДАНО"}
            </Text>
            <View style={{ opacity: 0.7 }}>
              <ThemedSvg xml={bekWaveLogoXml} width={150} height={20} fg={theme.text} />
            </View>
            <Text style={[styles.version, { color: theme.textMuted }]}>
              {en ? "Version 1.0.0" : "Версия 1.0.0"}
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollOuter: { flexGrow: 1 },
  scroll: { paddingHorizontal: 20, gap: 24 },
  headerPanel: {
    paddingHorizontal: 20,
    paddingBottom: 25,
    borderWidth: 1.5,
    borderTopWidth: 0,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    marginHorizontal: -1.5,
  },
  sheet: {
    flexGrow: 1,
    marginTop: 12,
    marginHorizontal: -1.5,
    paddingTop: 24,
    borderWidth: 1.5,
    borderBottomWidth: 0,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
  },
  pageTitle: {
    fontSize: 20,
    fontFamily: "Geologica_700Bold",
    letterSpacing: -0.1,
  },
  accountRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  inset: { position: "absolute", right: 0, bottom: 0, height: StyleSheet.hairlineWidth },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: { fontSize: 19, fontFamily: "Geologica_700Bold" },
  accountName: { fontSize: 16, fontFamily: "Geologica_600SemiBold" },
  accountSub: { fontSize: 13, fontFamily: "Geologica_400Regular", marginTop: 2 },
  upgradePill: {
    height: 34,
    paddingHorizontal: 16,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  upgradeLabel: { fontSize: 13, fontFamily: "Geologica_700Bold" },
  segTrack: { flexDirection: "row", borderRadius: 10, padding: 2 },
  seg: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    height: 30,
    borderRadius: 8,
  },
  segLabel: { fontSize: 13, fontFamily: "Geologica_500Medium" },
  credits: { alignItems: "center", paddingTop: 8, gap: 8 },
  creditsLabel: { fontSize: 10, fontFamily: "Geologica_600SemiBold", letterSpacing: 0.8 },
  version: { fontSize: 12, fontFamily: "Geologica_400Regular" },
});
