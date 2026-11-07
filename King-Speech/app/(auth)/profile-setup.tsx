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
import { KingSpeechLogo, PillButton, useInk } from "@/components/auth/AuthUI";

// Figma "Регистрация · профиль (пусто / заполнено)" — 65:41 / 65:77.
export default function ProfileSetupScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { lang } = useLang();
  const { theme } = useTheme();
  const { ink, stroke } = useInk();
  const { saveProfile, user } = useAuth();
  const en = lang === "en";

  const [name, setName] = useState(user?.name ?? "");
  const [gender, setGender] = useState<Gender>(user?.gender ?? "male");
  const [focused, setFocused] = useState(false);

  const topPad = Platform.OS === "web" ? 54 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const canContinue = name.trim().length >= 1;

  const handleContinue = async () => {
    if (!canContinue) return;
    await saveProfile(name.trim(), gender);
    router.push("/(auth)/onboarding");
  };

  const GENDERS: { key: Gender; big: string; small: string }[] = [
    { key: "male", big: en ? "He" : "Он", small: en ? "Male" : "Мужской" },
    { key: "female", big: en ? "She" : "Она", small: en ? "Female" : "Женский" },
  ];

  return (
    <KeyboardAvoidingView
      style={[s.root, { backgroundColor: theme.bg }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <StatusBar barStyle={theme.mode === "dark" ? "light-content" : "dark-content"} />
      <ScrollView
        contentContainerStyle={[s.scroll, { paddingTop: topPad + 12, paddingBottom: bottomPad + 10 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo — top right */}
        <Animated.View entering={FadeIn} style={s.logoRow}>
          <KingSpeechLogo width={111.3} color={theme.text} />
        </Animated.View>

        {/* Header */}
        <Animated.View entering={FadeInUp.delay(80).duration(500)}>
          <Text style={[s.title, { color: theme.text }]}>
            {en ? "How should we\n" : "Как тебя\n"}
            <Text style={{ color: theme.accentInk }}>{en ? "announce you?" : "объявить?"}</Text>
          </Text>
          <Text style={[s.sub, { color: ink(0.65) }]}>
            {en
              ? "This is how the host will call you before you go on stage"
              : "Так тебя будет называть ведущий перед выходом на сцену"}
          </Text>
        </Animated.View>

        {/* Poster preview */}
        <Animated.View
          entering={FadeInDown.delay(120).duration(500)}
          style={[
            s.poster,
            { borderColor: stroke, backgroundColor: canContinue ? theme.accent : theme.card },
          ]}
        >
          <Text style={[s.kicker, { color: canContinue ? "rgba(38,38,40,0.7)" : ink(0.4) }]}>
            {en ? "TONIGHT ON STAGE" : "СЕГОДНЯ НА СЦЕНЕ"}
          </Text>
          <Text
            style={[s.posterName, { color: canContinue ? theme.accentText : ink(0.25) }]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {canContinue ? name.trim().toLocaleUpperCase() : "? ? ?"}
          </Text>
        </Animated.View>

        {/* Name input */}
        <Animated.View entering={FadeInDown.delay(160).duration(500)}>
          <Text style={[s.label, { color: ink(0.5) }]}>{en ? "NAME ON THE POSTER" : "ИМЯ НА АФИШЕ"}</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={en ? "e.g. Aigerim" : "Например, Айгерим"}
            placeholderTextColor={ink(0.35)}
            selectionColor={theme.accent}
            cursorColor={theme.accent}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            style={[
              s.input,
              {
                backgroundColor: theme.card,
                color: theme.text,
                fontFamily: name.length > 0 ? "Geologica_800ExtraBold" : "Geologica_600SemiBold",
              },
              focused || name.length > 0
                ? { borderWidth: 4, borderColor: theme.accent, paddingHorizontal: 20 }
                : { borderWidth: 2, borderColor: stroke, paddingHorizontal: 22 },
            ]}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleContinue}
            maxLength={32}
          />
        </Animated.View>

        {/* Gender */}
        <Animated.View entering={FadeInDown.delay(240).duration(500)}>
          <Text style={[s.label, { color: ink(0.5) }]}>
            {en ? "HOW SHOULD WE ADDRESS YOU" : "КАК К ТЕБЕ ОБРАЩАТЬСЯ"}
          </Text>
          <View style={s.genderRow}>
            {GENDERS.map((g) => {
              const on = gender === g.key;
              return (
                <Pressable
                  key={g.key}
                  onPress={() => setGender(g.key)}
                  style={({ pressed }) => [
                    s.tile,
                    {
                      backgroundColor: on ? theme.accent : theme.card,
                      borderColor: stroke,
                      opacity: pressed ? 0.9 : 1,
                    },
                  ]}
                >
                  <Text style={[s.tileBig, { color: on ? theme.accentText : ink(0.9) }]}>{g.big}</Text>
                  <Text style={[s.tileSmall, { color: on ? "rgba(38,38,40,0.75)" : ink(0.55) }]}>{g.small}</Text>
                  {on && (
                    <Animated.View entering={ZoomIn} style={[s.check, { backgroundColor: theme.accentText }]}>
                      <Ionicons name="checkmark-sharp" size={19} color={theme.accent} />
                    </Animated.View>
                  )}
                </Pressable>
              );
            })}
          </View>
        </Animated.View>

        {/* Continue button */}
        <Animated.View entering={FadeInDown.delay(320).duration(500)} style={s.btnWrap}>
          <PillButton
            label={en ? "Continue  →" : "Продолжить  →"}
            variant={canContinue ? "primary" : "secondary"}
            onPress={handleContinue}
            disabled={!canContinue}
          />
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
  logoRow: {
    alignSelf: "flex-end",
    marginRight: 5,
    marginBottom: 23,
  },
  title: {
    fontSize: 46,
    lineHeight: 50.6,
    fontFamily: "Geologica_900Black",
    letterSpacing: -0.92,
  },
  sub: {
    marginTop: 5,
    fontSize: 15,
    lineHeight: 18,
    fontFamily: "Geologica_600SemiBold",
  },
  poster: {
    marginTop: 24,
    height: 112,
    borderRadius: 22,
    borderWidth: 2,
    paddingHorizontal: 18,
    paddingTop: 16,
  },
  kicker: {
    fontSize: 12,
    fontFamily: "Geologica_900Black",
    letterSpacing: 0.6,
  },
  posterName: {
    marginTop: 9,
    fontSize: 44,
    lineHeight: 52,
    fontFamily: "Geologica_900Black",
    letterSpacing: -0.88,
  },
  label: {
    marginTop: 24,
    marginLeft: 4,
    marginBottom: 7,
    fontSize: 12,
    fontFamily: "Geologica_900Black",
    letterSpacing: 0.6,
  },
  input: {
    height: 60,
    borderRadius: 32,
    fontSize: 18,
    letterSpacing: -0.09,
  },
  genderRow: {
    flexDirection: "row",
    gap: 12,
  },
  tile: {
    flex: 1,
    height: 120,
    borderRadius: 22,
    borderWidth: 2,
    paddingHorizontal: 18,
    paddingTop: 12,
  },
  tileBig: {
    fontSize: 48,
    lineHeight: 52,
    fontFamily: "Geologica_900Black",
    letterSpacing: -0.96,
  },
  tileSmall: {
    marginTop: 14,
    fontSize: 14,
    fontFamily: "Geologica_700Bold",
  },
  check: {
    position: "absolute",
    top: 14,
    right: 18,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  btnWrap: {
    marginTop: "auto",
    paddingTop: 24,
  },
});
