import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Platform } from "react-native";
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
  ToggleTile,
  tapHaptic,
} from "@/components/settings/SettingsParts";
import { kingSpeechLogoXml } from "@/assets/figma/settings/logo";
import { bekWaveLogoXml } from "@/assets/figma/settings/bekwave";
import { crownOutlineXml } from "@/assets/figma/settings/crown";
import { starOutlineXml } from "@/assets/figma/settings/star";

const SIGN_OUT = "#E5484D";

// Figma tokens settings/opt-* (theme segmented control) + button/secondary-gray.
const OPT = {
  dark: {
    selectedBg: "#FFD857",
    selectedBorder: "rgba(255,189,47,0.73)",
    selectedInk: "#262628",
    idleBorder: "rgba(240,238,233,0.2)",
    idleIcon: "#FFD857",
  },
  light: {
    selectedBg: "#E5E4E1",
    selectedBorder: "rgba(255,189,47,0.73)",
    selectedInk: "#262628",
    idleBorder: "rgba(38,38,40,0.15)",
    idleIcon: "rgba(38,38,40,0.42)",
  },
};
const SECONDARY_GRAY = {
  dark: { bg: "#464647", border: "#676666" },
  light: { bg: "#E5E4E1", border: "#BFBEBC" },
};

function ThemeOption({
  theme,
  themeMode,
  mode,
  label,
  onSelect,
}: {
  theme: Theme;
  themeMode: ThemeMode;
  mode: ThemeMode;
  label: string;
  onSelect: (m: ThemeMode) => void;
}) {
  const selected = themeMode === mode;
  const o = OPT[themeMode];
  return (
    <Pressable
      onPress={() => {
        tapHaptic();
        onSelect(mode);
      }}
      style={[
        styles.themeOption,
        {
          backgroundColor: selected ? o.selectedBg : "transparent",
          borderColor: selected ? o.selectedBorder : o.idleBorder,
        },
      ]}
    >
      <Ionicons
        name={mode === "dark" ? "moon" : "sunny-outline"}
        size={20}
        color={selected ? o.selectedInk : o.idleIcon}
      />
      <Text style={[styles.themeOptionLabel, { color: selected ? o.selectedInk : theme.text }]}>
        {label}
      </Text>
      {selected && <Ionicons name="checkmark" size={18} color={o.selectedInk} />}
    </Pressable>
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
  const gray = SECONDARY_GRAY[themeMode];
  const icon = (name: keyof typeof Ionicons.glyphMap) => (
    <Ionicons name={name} size={22} color={theme.text} />
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: topPad + 8, paddingBottom: bottomPad + 120 },
        ]}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
      >
        <Animated.View entering={FadeInDown.duration(400)}>
          <ThemedSvg xml={kingSpeechLogoXml} width={159} height={53} fg={theme.text} />
          <Text style={[styles.pageTitle, { color: theme.text }]}>{t("settings")}</Text>
        </Animated.View>

        {/* Account + plan */}
        <Animated.View entering={FadeInDown.delay(40).duration(400)}>
          <Card theme={theme} themeMode={themeMode} style={styles.accountCard}>
            <Pressable
              onPress={() => {
                tapHaptic();
                // Account screen hosts sign-out / account management.
                router.push("/account" as any);
              }}
              style={styles.accountTop}
            >
              <View style={[styles.avatar, { backgroundColor: theme.accent }]}>
                <Text style={[styles.avatarInitial, { color: theme.accentText }]}>{initial}</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={[styles.accountName, { color: theme.text }]} numberOfLines={1}>
                  {userName}
                </Text>
                <Text
                  style={[
                    styles.accountSub,
                    { color: themeMode === "dark" ? theme.textMuted : theme.textSecondary },
                  ]}
                >
                  {en ? `Signed in with ${authLabel}` : `Вход через ${authLabel}`}
                </Text>
              </View>
              <Chevron theme={theme} />
            </Pressable>
            <View style={[styles.accountDivider, { backgroundColor: theme.text }]} />
            <View style={styles.planRow}>
              <ThemedSvg
                xml={crownOutlineXml}
                width={22}
                height={22}
                fg={theme.text}
                bg={themeMode === "dark" ? "#2E2E30" : "#373738"}
              />
              <Text style={[styles.planLabel, { color: theme.text }]}>
                {en ? "Free plan" : "Бесплатный план"}
              </Text>
              <View style={{ flex: 1 }} />
              <Pressable
                onPress={() => {
                  tapHaptic();
                  router.push("/subscription" as any);
                }}
                style={[
                  styles.upgradeBtn,
                  { backgroundColor: theme.accent, borderColor: theme.ctaStroke },
                ]}
              >
                <Text style={[styles.upgradeLabel, { color: theme.accentText }]}>
                  {en ? "Upgrade" : "Улучшить"}
                </Text>
              </Pressable>
            </View>
          </Card>
        </Animated.View>

        {/* Sound & notifications */}
        <Animated.View entering={FadeInDown.delay(80).duration(400)}>
          <SectionLabel theme={theme}>
            {en ? "Sound & notifications" : "Звук и уведомления"}
          </SectionLabel>
          <View style={styles.grid}>
            <View style={styles.gridRow}>
              <ToggleTile
                theme={theme}
                themeMode={themeMode}
                icon="volume-high-outline"
                label={t("soundEffects")}
                value={sound}
                onValueChange={setSound}
              />
              <ToggleTile
                theme={theme}
                themeMode={themeMode}
                icon="phone-portrait-outline"
                label={t("vibration")}
                value={vibration}
                onValueChange={setVibration}
              />
            </View>
            <View style={styles.gridRow}>
              <ToggleTile
                theme={theme}
                themeMode={themeMode}
                icon="notifications-outline"
                label={t("pushNotifications")}
                value={notifications}
                onValueChange={setNotifications}
              />
              <ToggleTile
                theme={theme}
                themeMode={themeMode}
                icon="alarm-outline"
                label={en ? "Reminder" : "Напоминание"}
                sub={en ? "every day at 09:00" : "каждый день в 09:00"}
                value={reminder}
                onValueChange={setReminder}
              />
            </View>
          </View>
        </Animated.View>

        {/* Appearance + language */}
        <Animated.View entering={FadeInDown.delay(120).duration(400)}>
          <SectionLabel theme={theme}>{en ? "Appearance" : "Оформление"}</SectionLabel>
          <Card theme={theme} themeMode={themeMode} style={styles.themeRow}>
            <ThemeOption
              theme={theme}
              themeMode={themeMode}
              mode="light"
              label={t("light")}
              onSelect={setTheme}
            />
            <ThemeOption
              theme={theme}
              themeMode={themeMode}
              mode="dark"
              label={t("dark")}
              onSelect={setTheme}
            />
          </Card>

          <Pressable
            onPress={() => {
              tapHaptic();
              setShowLangs(!showLangs);
            }}
            style={[styles.langPill, { backgroundColor: gray.bg, borderColor: gray.border }]}
          >
            <Ionicons name="language-outline" size={22} color={theme.text} />
            <Text style={[styles.langLabel, { color: theme.text }]}>{t("language")}</Text>
            <View style={{ flex: 1 }} />
            <Text style={[styles.langValue, { color: theme.text }]}>
              {appLang === "ru" ? "Русский" : "English"}
            </Text>
            <Ionicons
              name={showLangs ? "chevron-down" : "chevron-forward"}
              size={16}
              color={theme.textMuted}
            />
          </Pressable>
          {showLangs && (
            <Card theme={theme} themeMode={themeMode} style={{ marginTop: 8 }}>
              {(["ru", "en"] as const).map((code, i) => (
                <ListRow
                  key={code}
                  theme={theme}
                  icon={null}
                  label={code === "ru" ? "Русский" : "English"}
                  labelColor={appLang === code ? theme.accentInk : theme.text}
                  divider={i === 0}
                  onPress={() => {
                    setAppLang(code);
                    setShowLangs(false);
                  }}
                  right={
                    appLang === code ? (
                      <Ionicons name="checkmark" size={18} color={theme.accentInk} />
                    ) : (
                      <View />
                    )
                  }
                />
              ))}
            </Card>
          )}
        </Animated.View>

        {/* Support + credits */}
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
              icon={<ThemedSvg xml={starOutlineXml} width={20} height={20} fg={theme.text} />}
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
              divider
              onPress={() => {
                // TODO(design): privacy policy URL/screen not defined yet.
              }}
            />
            <View style={styles.credits}>
              <Text style={[styles.creditsLabel, { color: theme.textMuted }]}>
                {en ? "APP CREATED BY" : "ПРИЛОЖЕНИЕ СОЗДАНО"}
              </Text>
              <ThemedSvg xml={bekWaveLogoXml} width={194.962} height={26} fg={theme.text} />
              <Text style={[styles.version, { color: theme.textMuted }]}>
                {en ? "Version 1.0.0" : "Версия 1.0.0"}
              </Text>
            </View>
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
              divider
              right={
                <GoldSwitch
                  value={isOpenTestingEnabled}
                  onValueChange={setOpenTestingEnabled}
                  theme={theme}
                  themeMode={themeMode}
                />
              }
            />
            {/* Dev-only Skip mode. Gated behind __DEV__ so it never ships to players. */}
            {__DEV__ && (
              <ListRow
                theme={theme}
                icon={icon("play-skip-forward-outline")}
                label="Skip уровней (dev)"
                divider
                right={
                  <GoldSwitch
                    value={isDevSkipEnabled}
                    onValueChange={setDevSkipEnabled}
                    theme={theme}
                    themeMode={themeMode}
                  />
                }
              />
            )}
          </Card>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 20, gap: 24 },
  pageTitle: {
    fontSize: 20,
    fontFamily: "Geologica_700Bold",
    letterSpacing: -0.1,
    marginTop: 16,
  },
  accountCard: { paddingHorizontal: 15, paddingTop: 15, paddingBottom: 12 },
  accountTop: { flexDirection: "row", alignItems: "center", height: 56 },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: { fontSize: 24, fontFamily: "Geologica_700Bold" },
  accountName: { fontSize: 18, fontFamily: "Geologica_700Bold" },
  accountSub: { fontSize: 13, fontFamily: "Geologica_400Regular", marginTop: 3 },
  accountDivider: { height: 1, opacity: 0.1, marginTop: 18 },
  planRow: { flexDirection: "row", alignItems: "center", marginTop: 11, height: 34 },
  planLabel: { fontSize: 15, fontFamily: "Geologica_600SemiBold", marginLeft: 10 },
  upgradeBtn: {
    borderWidth: 2,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  upgradeLabel: { fontSize: 13, fontFamily: "Geologica_700Bold" },
  grid: { gap: 12 },
  gridRow: { flexDirection: "row", gap: 12 },
  themeRow: { flexDirection: "row", gap: 10, paddingHorizontal: 10, paddingVertical: 10 },
  themeOption: {
    flex: 1,
    height: 53,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 32,
    borderWidth: 2,
  },
  themeOptionLabel: { fontSize: 15, fontFamily: "Geologica_700Bold" },
  langPill: {
    marginTop: 12,
    height: 58,
    borderRadius: 32,
    borderWidth: 2,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 16,
    paddingRight: 16,
  },
  langLabel: { fontSize: 15, fontFamily: "Geologica_400Regular", marginLeft: 14 },
  langValue: { fontSize: 14, fontFamily: "Geologica_400Regular", marginRight: 9 },
  credits: { alignItems: "center", paddingTop: 21, paddingBottom: 19, gap: 12 },
  creditsLabel: { fontSize: 11, fontFamily: "Geologica_900Black", letterSpacing: 0.55 },
  version: { fontSize: 13, fontFamily: "Geologica_600SemiBold" },
});
