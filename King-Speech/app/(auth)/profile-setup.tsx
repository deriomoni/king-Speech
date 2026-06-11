import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  Platform,
  StatusBar,
  KeyboardAvoidingView,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn, FadeInDown, FadeInUp, ZoomIn } from "react-native-reanimated";
import { useLang } from "@/context/LangContext";
import { useTheme } from "@/context/ThemeContext";
import { useAuth, Gender } from "@/context/AuthContext";

export default function ProfileSetupScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useLang();
  const { theme } = useTheme();
  const { saveProfile, user } = useAuth();

  const [name, setName] = useState(user?.name ?? "");
  const [gender, setGender] = useState<Gender>(user?.gender ?? "male");

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const canContinue = name.trim().length >= 1;

  const handleContinue = async () => {
    if (!canContinue) return;
    await saveProfile(name.trim(), gender);
    router.push("/(auth)/onboarding");
  };

  return (
    <KeyboardAvoidingView
      style={[s.root, { backgroundColor: theme.bg }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <StatusBar barStyle={theme.mode === "dark" ? "light-content" : "dark-content"} />
      <ScrollView
        contentContainerStyle={[
          s.scroll,
          { paddingTop: topPad + 12, paddingBottom: bottomPad + 32 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Back */}
        <Animated.View entering={FadeIn}>
          <Pressable onPress={() => router.back()} style={s.backBtn} hitSlop={12}>
            <Ionicons name="chevron-back" size={28} color={theme.text} />
          </Pressable>
        </Animated.View>

        {/* Header */}
        <Animated.View entering={FadeInUp.delay(80).springify()} style={s.header}>
          <Text style={[s.title, { color: theme.text }]}>{t("profileTitle")}</Text>
          <Text style={[s.sub, { color: theme.textSecondary }]}>{t("profileSub")}</Text>
        </Animated.View>

        {/* Name input */}
        <Animated.View entering={FadeInDown.delay(160).springify()} style={s.section}>
          <Text style={[s.label, { color: theme.textSecondary }]}>{t("yourName")}</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={t("namePlaceholder")}
            placeholderTextColor={theme.textSecondary}
            style={[
              s.input,
              {
                backgroundColor: theme.inputBg,
                borderColor: name.length > 0 ? theme.accent : theme.inputBorder,
                color: theme.text,
              },
            ]}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleContinue}
            maxLength={32}
          />
        </Animated.View>

        {/* Gender */}
        <Animated.View entering={FadeInDown.delay(240).springify()} style={s.section}>
          <Text style={[s.label, { color: theme.textSecondary }]}>{t("gender")}</Text>
          <View style={s.genderRow}>
            {/* Male */}
            <Pressable
              onPress={() => setGender("male")}
              style={[
                s.genderCard,
                { backgroundColor: theme.card, borderColor: theme.cardBorder },
                gender === "male" && {
                  borderColor: theme.accent,
                  backgroundColor: theme.accentDim,
                },
              ]}
            >
              {gender === "male" && (
                <Animated.View entering={ZoomIn} style={[s.checkMark, { backgroundColor: theme.accent }]}>
                  <Ionicons name="checkmark" size={12} color={theme.accentText} />
                </Animated.View>
              )}
              {/* Male silhouette */}
              <View style={[s.avatarCircle, { backgroundColor: gender === "male" ? theme.accent : theme.bgSecondary }]}>
                <Ionicons
                  name="person"
                  size={36}
                  color={gender === "male" ? theme.accentText : theme.textSecondary}
                />
              </View>
              <Text style={[s.genderTxt, { color: gender === "male" ? theme.accent : theme.text }]}>
                {t("male")}
              </Text>
              {/* Decorative bar */}
              <View style={[s.genderBar, { backgroundColor: theme.navy }]}>
                <View style={[s.genderBarInner, { width: "60%" }]} />
              </View>
            </Pressable>

            {/* Female */}
            <Pressable
              onPress={() => setGender("female")}
              style={[
                s.genderCard,
                { backgroundColor: theme.card, borderColor: theme.cardBorder },
                gender === "female" && {
                  borderColor: theme.accent,
                  backgroundColor: theme.accentDim,
                },
              ]}
            >
              {gender === "female" && (
                <Animated.View entering={ZoomIn} style={[s.checkMark, { backgroundColor: theme.accent }]}>
                  <Ionicons name="checkmark" size={12} color={theme.accentText} />
                </Animated.View>
              )}
              <View style={[s.avatarCircle, { backgroundColor: gender === "female" ? theme.accent : theme.bgSecondary }]}>
                <Ionicons
                  name="person"
                  size={36}
                  color={gender === "female" ? theme.accentText : theme.textSecondary}
                />
              </View>
              <Text style={[s.genderTxt, { color: gender === "female" ? theme.accent : theme.text }]}>
                {t("female")}
              </Text>
              <View style={[s.genderBar, { backgroundColor: theme.navy }]}>
                <View style={[s.genderBarInner, { width: "80%" }]} />
              </View>
            </Pressable>
          </View>
        </Animated.View>

        {/* Continue button */}
        <Animated.View entering={FadeInDown.delay(320).springify()} style={s.btnWrap}>
          <Pressable
            onPress={handleContinue}
            disabled={!canContinue}
            style={({ pressed }) => [
              s.continueBtn,
              {
                backgroundColor: canContinue ? theme.cta : theme.card,
                opacity: pressed ? 0.88 : 1,
              },
            ]}
          >
            <Text
              style={[
                s.continueBtnTxt,
                { color: canContinue ? theme.ctaText : theme.textSecondary },
              ]}
            >
              {t("continueBtn")}
            </Text>
            <Ionicons
              name="arrow-forward"
              size={20}
              color={canContinue ? theme.ctaText : theme.textSecondary}
            />
          </Pressable>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  scroll: {
    paddingHorizontal: 24,
    flexGrow: 1,
  },
  backBtn: {
    padding: 4,
    marginLeft: -4,
    marginBottom: 16,
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 30,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.4,
    marginBottom: 8,
  },
  sub: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    lineHeight: 22,
  },
  section: {
    marginBottom: 28,
  },
  label: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  input: {
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 16,
    fontSize: 17,
    fontFamily: "Inter_500Medium",
  },
  genderRow: {
    flexDirection: "row",
    gap: 14,
  },
  genderCard: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 2,
    alignItems: "center",
    paddingVertical: 24,
    paddingHorizontal: 12,
    overflow: "hidden",
    position: "relative",
  },
  checkMark: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  genderTxt: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 10,
  },
  genderBar: {
    width: "100%",
    height: 3,
    borderRadius: 2,
    opacity: 0.2,
    overflow: "hidden",
  },
  genderBarInner: {
    height: "100%",
    backgroundColor: "#FFD166",
    borderRadius: 2,
  },
  btnWrap: {
    marginTop: "auto",
    paddingTop: 16,
  },
  continueBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderRadius: 16,
    paddingVertical: 18,
    shadowColor: "#FFD166",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 5,
  },
  continueBtnTxt: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.2,
  },
});
