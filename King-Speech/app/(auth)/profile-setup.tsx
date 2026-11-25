// Sign-up, step 1 — on black, nothing but the question:
//   «Как вас зовут?» → name → «Готово»
//   then «Сколько вам лет?» slides in (+ «подходит для любого возраста»)
//   → picking an age saves the draft and opens the short questionnaire.
import React, { useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Animated, { FadeIn, FadeInDown, FadeOutUp } from "react-native-reanimated";
import { useLang, pickLang } from "@/context/LangContext";
import { useAuth } from "@/context/AuthContext";
import { rs } from "@/lib/responsive";

const AGE_IDS = ["under14", "14-17", "18-24", "25-34", "35-44", "45plus"] as const;
const AGE_RU = ["до 14", "14–17", "18–24", "25–34", "35–44", "45+"];
const AGE_EN = ["under 14", "14–17", "18–24", "25–34", "35–44", "45+"];
const AGE_KK = ["14-ке дейін", "14–17", "18–24", "25–34", "35–44", "45+"];

export default function ProfileSetupScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { lang } = useLang();
  const tr = (v: { ru: string; en: string; kk: string }) => pickLang(lang, v);
  const { saveProfileDraft, user } = useAuth();

  const [name, setName] = useState(user?.name ?? "");
  const [step, setStep] = useState<"name" | "age">("name");
  const [age, setAge] = useState<string | null>(null);

  const topPad = Platform.OS === "web" ? 54 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const canDone = name.trim().length >= 1;

  const done = () => {
    if (!canDone) return;
    Keyboard.dismiss();
    setStep("age");
  };

  const pickAge = async (id: string) => {
    if (age) return;
    setAge(id);
    await saveProfileDraft(name.trim(), id);
    setTimeout(() => router.push("/(auth)/survey"), 250);
  };

  const ageLabel = (i: number) => (lang === "en" ? AGE_EN[i] : lang === "kk" ? AGE_KK[i] : AGE_RU[i]);

  return (
    <KeyboardAvoidingView
      style={[s.root, { paddingTop: topPad + rs(24), paddingBottom: bottomPad + rs(20) }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <StatusBar barStyle="light-content" />

      {step === "name" ? (
        <Animated.View key="name" entering={FadeIn.duration(400)} exiting={FadeOutUp.duration(250)} style={s.block}>
          <Text style={s.title}>{tr({ ru: "Как вас зовут?", en: "What's your name?", kk: "Атыңыз кім?" })}</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={tr({ ru: "Имя", en: "Name", kk: "Есім" })}
            placeholderTextColor="rgba(255,255,255,0.35)"
            autoFocus
            autoCapitalize="words"
            autoCorrect={false}
            textContentType="givenName"
            returnKeyType="done"
            onSubmitEditing={done}
            maxLength={32}
            style={s.input}
          />
        </Animated.View>
      ) : (
        <Animated.View key="age" entering={FadeInDown.duration(450)} style={s.block}>
          <Text style={s.title}>{tr({ ru: "Сколько вам лет?", en: "How old are you?", kk: "Жасыңыз нешеде?" })}</Text>
          <Text style={s.note}>
            {tr({
              ru: "King Speech подходит для любого возраста — это нужно, чтобы подобрать темы под вас.",
              en: "King Speech is for any age — this just helps us pick topics for you.",
              kk: "King Speech кез келген жасқа лайық — бұл сізге тақырып таңдау үшін керек.",
            })}
          </Text>
          <View style={s.chips}>
            {AGE_IDS.map((id, i) => {
              const on = age === id;
              return (
                <Pressable
                  key={id}
                  onPress={() => pickAge(id)}
                  style={({ pressed }) => [s.chip, on && s.chipOn, { opacity: pressed ? 0.8 : 1 }]}
                >
                  <Text style={[s.chipTxt, on && s.chipTxtOn]}>{ageLabel(i)}</Text>
                </Pressable>
              );
            })}
          </View>
        </Animated.View>
      )}

      {step === "name" ? (
        <Pressable
          onPress={done}
          disabled={!canDone}
          style={({ pressed }) => [s.btn, { opacity: !canDone ? 0.35 : pressed ? 0.85 : 1 }]}
        >
          <Text style={s.btnTxt}>{tr({ ru: "Готово", en: "Done", kk: "Дайын" })}</Text>
        </Pressable>
      ) : null}
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000000", paddingHorizontal: 24 },
  block: { flex: 1, justifyContent: "center" },
  title: { fontSize: 32, letterSpacing: -0.5, color: "#FFFFFF", fontFamily: "Geologica_900Black" },
  input: {
    marginTop: 20,
    height: 60,
    borderRadius: 18,
    paddingHorizontal: 18,
    backgroundColor: "#151517",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    color: "#FFFFFF",
    fontSize: 20,
    fontFamily: "Geologica_600SemiBold",
  },
  note: { marginTop: 10, fontSize: 15, lineHeight: 21, color: "rgba(255,255,255,0.6)", fontFamily: "Geologica_500Medium" },
  chips: { marginTop: 22, flexDirection: "row", flexWrap: "wrap", gap: 10 },
  chip: {
    minWidth: 96,
    height: 52,
    paddingHorizontal: 18,
    borderRadius: 26,
    backgroundColor: "#151517",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  chipOn: { backgroundColor: "#FFFFFF", borderColor: "#FFFFFF" },
  chipTxt: { fontSize: 16, color: "#FFFFFF", fontFamily: "Geologica_700Bold" },
  chipTxtOn: { color: "#000000" },
  btn: { height: 58, borderRadius: 32, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  btnTxt: { fontSize: 17, color: "#000000", fontFamily: "Geologica_800ExtraBold" },
});
