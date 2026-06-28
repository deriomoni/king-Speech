import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Switch,
  Platform,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useGame } from "@/context/GameContext";
import { useLang } from "@/context/LangContext";
import { useAuth } from "@/context/AuthContext";
import { useDevTools } from "@/context/DevToolsContext";
import { useRouter } from "expo-router";
import { useTheme, type Theme, type ThemeMode } from "@/context/ThemeContext";

const SIGN_OUT = "#E5484D";

interface RowProps {
  theme: Theme;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  toggle?: boolean;
  toggleVal?: boolean;
  onToggle?: (v: boolean) => void;
  onPress?: () => void;
  isLast?: boolean;
  destructive?: boolean;
  rightChevron?: boolean;
}

function Row({
  theme,
  icon,
  label,
  value,
  toggle,
  toggleVal,
  onToggle,
  onPress,
  isLast,
  destructive,
  rightChevron,
}: RowProps) {
  const showChevron = rightChevron ?? (!!onPress && toggle === undefined);
  return (
    <Pressable
      onPress={() => {
        if (!onPress) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      disabled={!onPress && toggle === undefined}
      style={({ pressed }) => [
        styles.row,
        !isLast && { borderBottomWidth: 1, borderBottomColor: theme.divider },
        pressed && onPress ? { backgroundColor: theme.rowPressed } : null,
      ]}
    >
      <Ionicons
        name={icon}
        size={22}
        color={destructive ? SIGN_OUT : theme.text}
        style={{ marginRight: 14 }}
      />
      <Text style={[styles.rowLabel, { color: destructive ? SIGN_OUT : theme.text }]}>
        {label}
      </Text>
      <View style={{ flex: 1 }} />
      {value ? (
        <Text style={[styles.rowValue, { color: theme.textSecondary }]}>{value}</Text>
      ) : null}
      {toggle !== undefined && (
        <Switch
          value={toggleVal}
          onValueChange={(v) => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onToggle?.(v);
          }}
          trackColor={{ false: theme.switchTrackOff, true: theme.accent }}
          thumbColor="#FFFFFF"
          ios_backgroundColor={theme.switchTrackOff}
        />
      )}
      {showChevron && (
        <Ionicons
          name="chevron-forward"
          size={16}
          color={theme.textMuted}
          style={{ marginLeft: 8 }}
        />
      )}
    </Pressable>
  );
}

function Section({
  theme,
  title,
  children,
}: {
  theme: Theme;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={{ gap: 12 }}>
      <Text style={[styles.sectionLabel, { color: theme.text }]}>{title}</Text>
      <View
        style={[
          styles.listWrap,
          {
            backgroundColor: theme.card,
            borderColor: theme.cardBorder,
          },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

function ThemeOption({
  theme,
  mode,
  selected,
  label,
  onSelect,
}: {
  theme: Theme;
  mode: ThemeMode;
  selected: boolean;
  label: string;
  onSelect: (m: ThemeMode) => void;
}) {
  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onSelect(mode);
      }}
      style={[
        styles.themeOption,
        {
          borderColor: selected ? theme.accent : theme.cardBorder,
          backgroundColor: selected ? theme.accentDim : "transparent",
        },
      ]}
    >
      <Ionicons
        name={mode === "dark" ? "moon" : "sunny"}
        size={20}
        color={selected ? theme.accent : theme.textMuted}
      />
      <Text
        style={[
          styles.themeOptionLabel,
          { color: selected ? theme.accent : theme.text },
        ]}
      >
        {label}
      </Text>
      {selected && <Ionicons name="checkmark" size={18} color={theme.accent} />}
    </Pressable>
  );
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { theme, themeMode, setTheme } = useTheme();
  const { resetProgress } = useGame();
  const { lang: appLang, setLang: setAppLang, t } = useLang();
  const { user, signOut } = useAuth();
  const { isOpenTestingEnabled, setOpenTestingEnabled, isDevSkipEnabled, setDevSkipEnabled } = useDevTools();
  const router = useRouter();

  const [sound, setSound] = useState(true);
  const [vibration, setVibration] = useState(true);
  const [notifications, setNotifications] = useState(true);
  const [reminder, setReminder] = useState(true);
  const [showLangs, setShowLangs] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const handleLogout = () => {
    const doLogout = async () => {
      await signOut();
      router.replace("/(auth)/welcome");
    };
    if (Platform.OS === "web") {
      if (window.confirm(t("logoutConfirm"))) doLogout();
    } else {
      Alert.alert(t("logout"), t("logoutConfirm"), [
        { text: t("cancel"), style: "cancel" },
        { text: t("confirm"), style: "destructive", onPress: doLogout },
      ]);
    }
  };

  const handleReset = () => {
    if (Platform.OS === "web") {
      if (window.confirm(t("resetConfirm"))) resetProgress();
    } else {
      Alert.alert(t("resetTitle"), t("resetMessage"), [
        { text: t("cancel"), style: "cancel" },
        { text: t("resetBtn"), style: "destructive", onPress: resetProgress },
      ]);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: topPad + 12, paddingBottom: bottomPad + 120 },
        ]}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
      >
        <Animated.View entering={FadeInDown.duration(400)}>
          <Text style={[styles.pageTitle, { color: theme.text }]}>{t("settings")}</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(40).duration(400)}>
          <Section theme={theme} title={t("theme")}>
            <View style={styles.themeRow}>
              <ThemeOption
                theme={theme}
                mode="light"
                selected={themeMode === "light"}
                label={t("light")}
                onSelect={setTheme}
              />
              <ThemeOption
                theme={theme}
                mode="dark"
                selected={themeMode === "dark"}
                label={t("dark")}
                onSelect={setTheme}
              />
            </View>
          </Section>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(80).duration(400)}>
          <Section theme={theme} title={t("language")}>
            <Row
              theme={theme}
              icon="language-outline"
              label={t("language")}
              value={appLang === "ru" ? "Русский" : "English"}
              onPress={() => setShowLangs(!showLangs)}
              isLast={!showLangs}
            />
            {showLangs && (
              <>
                <Pressable
                  onPress={() => {
                    setAppLang("ru");
                    setShowLangs(false);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  style={[
                    styles.row,
                    {
                      borderBottomWidth: 1,
                      borderBottomColor: theme.divider,
                      paddingLeft: 54,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.rowLabel,
                      { color: appLang === "ru" ? theme.accent : theme.text },
                    ]}
                  >
                    Русский
                  </Text>
                  <View style={{ flex: 1 }} />
                  {appLang === "ru" && (
                    <Ionicons name="checkmark" size={18} color={theme.accent} />
                  )}
                </Pressable>
                <Pressable
                  onPress={() => {
                    setAppLang("en");
                    setShowLangs(false);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  style={[styles.row, { paddingLeft: 54 }]}
                >
                  <Text
                    style={[
                      styles.rowLabel,
                      { color: appLang === "en" ? theme.accent : theme.text },
                    ]}
                  >
                    English
                  </Text>
                  <View style={{ flex: 1 }} />
                  {appLang === "en" && (
                    <Ionicons name="checkmark" size={18} color={theme.accent} />
                  )}
                </Pressable>
              </>
            )}
          </Section>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(140).duration(400)}>
          <Section theme={theme} title={t("soundAndVibration")}>
            <Row
              theme={theme}
              icon="volume-high-outline"
              label={t("soundEffects")}
              toggle
              toggleVal={sound}
              onToggle={setSound}
            />
            <Row
              theme={theme}
              icon="phone-portrait-outline"
              label={t("vibration")}
              toggle
              toggleVal={vibration}
              onToggle={setVibration}
              isLast
            />
          </Section>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(400)}>
          <Section theme={theme} title={t("notifications")}>
            <Row
              theme={theme}
              icon="notifications-outline"
              label={t("pushNotifications")}
              toggle
              toggleVal={notifications}
              onToggle={setNotifications}
            />
            <Row
              theme={theme}
              icon="alarm-outline"
              label={t("dailyReminder")}
              toggle
              toggleVal={reminder}
              onToggle={setReminder}
            />
            <Row
              theme={theme}
              icon="time-outline"
              label={t("reminderTime")}
              value="09:00"
              onPress={() => {}}
              isLast
            />
          </Section>
        </Animated.View>

        {user && (
          <Animated.View entering={FadeInDown.delay(260).duration(400)}>
            <Section theme={theme} title={t("account")}>
              <Row
                theme={theme}
                icon="person-circle-outline"
                label={user.name || t("profile")}
                value={
                  user.authMethod === "google"
                    ? "Google"
                    : user.authMethod === "apple"
                    ? "Apple"
                    : "Email"
                }
              />
              <Row
                theme={theme}
                icon="log-out-outline"
                label={t("logout")}
                onPress={handleLogout}
                destructive
                rightChevron={false}
                isLast
              />
            </Section>
          </Animated.View>
        )}

        <Animated.View entering={FadeInDown.delay(290).duration(400)}>
          <Section theme={theme} title={t("devTools")}>
            <Row
              theme={theme}
              icon="construct-outline"
              label={t("openTesting")}
              toggle
              toggleVal={isOpenTestingEnabled}
              onToggle={setOpenTestingEnabled}
              isLast={!__DEV__}
            />
            {/* Dev-only Skip mode. Gated behind __DEV__ so it is stripped from
                production builds and never ships to players. */}
            {__DEV__ && (
              <Row
                theme={theme}
                icon="play-skip-forward-outline"
                label="Skip уровней (dev)"
                toggle
                toggleVal={isDevSkipEnabled}
                onToggle={setDevSkipEnabled}
                isLast
              />
            )}
          </Section>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(320).duration(400)}>
          <Section theme={theme} title={t("data")}>
            <Row
              theme={theme}
              icon="trash-outline"
              label={t("resetProgress")}
              onPress={handleReset}
              destructive
            />
            <Row
              theme={theme}
              icon="information-circle-outline"
              label={t("appVersion")}
              value="1.0.0"
              isLast
            />
          </Section>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(380).duration(400)} style={styles.brand}>
          <View
            style={[
              styles.brandIcon,
              {
                backgroundColor: theme.accentDim,
                borderColor: theme.accent + "55",
              },
            ]}
          >
            <Ionicons name="mic" size={18} color={theme.accent} />
          </View>
          <View>
            <Text style={[styles.brandName, { color: theme.text }]}>King Speech</Text>
            <Text style={[styles.brandTag, { color: theme.textMuted }]}>
              {t("brandTagline")}
            </Text>
          </View>
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
    fontFamily: "Nunito_700Bold",
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  sectionLabel: {
    fontSize: 15,
    fontFamily: "Nunito_400Regular",
    paddingLeft: 4,
    letterSpacing: -0.1,
  },
  listWrap: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 14,
    minHeight: 56,
  },
  rowLabel: {
    fontSize: 15,
    fontFamily: "Nunito_400Regular",
    letterSpacing: -0.1,
  },
  rowValue: {
    fontSize: 14,
    fontFamily: "Nunito_400Regular",
  },
  themeRow: {
    flexDirection: "row",
    gap: 10,
    padding: 12,
  },
  themeOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  themeOptionLabel: {
    fontSize: 15,
    fontFamily: "Nunito_700Bold",
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingTop: 8,
    paddingBottom: 8,
  },
  brandIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  brandName: {
    fontSize: 15,
    fontFamily: "Rubik_600SemiBold",
    letterSpacing: -0.1,
  },
  brandTag: {
    fontSize: 11,
    fontFamily: "Nunito_400Regular",
    marginTop: 1,
  },
});
