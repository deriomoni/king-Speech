// Sign-up, step 1 — a short scene on black, hosted by Oscar:
//   Oscar: «Здравствуйте! Меня зовут Оскар.» → «А как вас зовут?»
//   → Oscar steps away, the question settles as the title, the name field appears
//   → (return key) Oscar again: «{Имя}, рад знакомству!» → steps away
//   → «Сколько вам лет?» with the options fading in
//   → picking one saves the draft and opens the short questionnaire.
import React, { useCallback, useEffect, useState } from "react";
import { BackHandler, Keyboard, KeyboardAvoidingView, Platform, Pressable, StatusBar, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn, FadeInDown, FadeOut, FadeOutUp } from "react-native-reanimated";
import { useLang, pickLang } from "@/context/LangContext";
import { useAuth } from "@/context/AuthContext";
import OscarMascot from "@/components/OscarMascot";
import { rs } from "@/lib/responsive";
import { playUi } from "@/lib/uiSound";

type Phase = "hello" | "ask" | "name" | "greet" | "age";
type L = { ru: string; en: string; kk: string };

const AGES: { id: string; label: L }[] = [
  { id: "under14", label: { ru: "до 14", en: "under 14", kk: "14-ке дейін" } },
  { id: "14-17", label: { ru: "14–17", en: "14–17", kk: "14–17" } },
  { id: "18-24", label: { ru: "18–24", en: "18–24", kk: "18–24" } },
  { id: "25-34", label: { ru: "25–34", en: "25–34", kk: "25–34" } },
  { id: "35-44", label: { ru: "35–44", en: "35–44", kk: "35–44" } },
  { id: "45-54", label: { ru: "45–54", en: "45–54", kk: "45–54" } },
  { id: "55-66", label: { ru: "55–66", en: "55–66", kk: "55–66" } },
  { id: "67plus", label: { ru: "67+", en: "67+", kk: "67+" } },
];

const HELLO_MS = 2200; // «Здравствуйте! Меня зовут Оскар.»
const ASK_MS = 1700; // «А как вас зовут?» before it becomes the title
const GREET_MS = 2200; // «{Имя}, рад знакомству!»

export default function ProfileSetupScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { lang } = useLang();
  const tr = (v: L) => pickLang(lang, v);
  const { saveProfileDraft, user } = useAuth();

  const [phase, setPhase] = useState<Phase>("hello");
  const [name, setName] = useState(user?.name ?? "");
  const [age, setAge] = useState<string | null>(null);

  const topPad = Platform.OS === "web" ? 54 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  // the scene's timeline
  useEffect(() => {
    let id: ReturnType<typeof setTimeout> | undefined;
    if (phase === "hello") id = setTimeout(() => setPhase("ask"), HELLO_MS);
    else if (phase === "ask") id = setTimeout(() => setPhase("name"), ASK_MS);
    else if (phase === "greet") id = setTimeout(() => setPhase("age"), GREET_MS);
    return () => {
      if (id) clearTimeout(id);
    };
  }, [phase]);

  const submitName = () => {
    if (!name.trim()) return;
    Keyboard.dismiss();
    setPhase("greet");
  };

  const pickAge = async (id: string) => {
    if (age) return;
    setAge(id);
    await saveProfileDraft(name.trim(), id);
    setTimeout(() => router.push("/(auth)/survey"), 350);
  };

  // coming back from the questionnaire: the age can be picked again
  useFocusEffect(
    useCallback(() => {
      setAge(null);
    }, []),
  );

  // a mistap on the age? back to the name (it stays filled in)
  const backToName = useCallback(() => {
    if (phase !== "age") return false;
    playUi("back");
    setAge(null);
    setPhase("name");
    return true;
  }, [phase]);
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener("hardwareBackPress", backToName);
      return () => sub.remove();
    }, [backToName]),
  );

  const firstName = name.trim().split(/\s+/)[0] ?? "";
  const oscarLine =
    phase === "hello"
      ? tr({ ru: "Здравствуйте! Меня зовут Оскар.", en: "Hello! My name is Oscar.", kk: "Сәлеметсіз бе! Менің атым Оскар." })
      : phase === "ask"
        ? tr({ ru: "А как вас зовут?", en: "And what's your name?", kk: "Ал сіздің атыңыз кім?" })
        : tr({ ru: `${firstName}, рад знакомству!`, en: `${firstName}, nice to meet you!`, kk: `${firstName}, танысқаныма қуаныштымын!` });
  const oscarShown = phase === "hello" || phase === "ask" || phase === "greet";

  return (
    <KeyboardAvoidingView
      style={[s.root, { paddingTop: topPad + rs(24), paddingBottom: bottomPad + rs(20) }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <StatusBar barStyle="light-content" />

      {oscarShown ? (
        // Oscar and his line; the line crossfades as he speaks
        <Animated.View
          key={phase === "greet" ? "oscar-greet" : "oscar-intro"}
          entering={FadeIn.duration(900)}
          exiting={FadeOut.duration(600)}
          style={s.center}
        >
          <OscarMascot emotion={phase === "greet" ? "happy" : "hi"} size={rs(200)} />
          <Animated.Text key={phase} entering={FadeIn.duration(700)} exiting={FadeOut.duration(350)} style={s.line}>
            {oscarLine}
          </Animated.Text>
        </Animated.View>
      ) : null}

      {phase === "name" ? (
        <Animated.View key="name" entering={FadeIn.duration(900)} exiting={FadeOutUp.duration(400)} style={s.block}>
          <Text style={s.title}>{tr({ ru: "Как вас зовут?", en: "What's your name?", kk: "Атыңыз кім?" })}</Text>
          <Animated.View entering={FadeInDown.delay(350).duration(700)}>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={tr({ ru: "Имя", en: "Name", kk: "Есім" })}
              placeholderTextColor="rgba(255,255,255,0.35)"
              autoFocus
              autoCapitalize="words"
              autoCorrect={false}
              textContentType="givenName"
              returnKeyType="next"
              enablesReturnKeyAutomatically
              blurOnSubmit={false}
              onSubmitEditing={submitName}
              maxLength={32}
              style={s.input}
            />
          </Animated.View>
        </Animated.View>
      ) : null}

      {phase === "age" ? (
        <Animated.View key="age-back" entering={FadeIn.duration(600)} exiting={FadeOut.duration(250)} style={[s.back, { top: topPad + rs(12) }]}>
          <Pressable onPress={backToName} hitSlop={12} accessibilityLabel={tr({ ru: "Назад", en: "Back", kk: "Артқа" })}>
            <Ionicons name="chevron-back" size={rs(26)} color="#FFFFFF" />
          </Pressable>
        </Animated.View>
      ) : null}

      {phase === "age" ? (
        <Animated.View key="age" entering={FadeIn.duration(800)} style={s.block}>
          <Text style={s.title}>{tr({ ru: "Сколько вам лет?", en: "How old are you?", kk: "Жасыңыз нешеде?" })}</Text>
          <Text style={s.note}>
            {tr({
              ru: "King Speech подходит для любого возраста — это нужно, чтобы подобрать темы под вас.",
              en: "King Speech is for any age — this just helps us pick topics for you.",
              kk: "King Speech кез келген жасқа лайық — бұл сізге тақырып таңдау үшін керек.",
            })}
          </Text>
          <View style={s.chips}>
            {AGES.map((a, i) => {
              const on = age === a.id;
              return (
                <Animated.View key={a.id} entering={FadeInDown.delay(250 + i * 70).duration(500)}>
                  <Pressable
                    onPress={() => {
                      playUi("tapSoft");
                      pickAge(a.id);
                    }}
                    style={[s.chip, on && s.chipOn]}
                  >
                    <Text style={[s.chipTxt, on && s.chipTxtOn]}>{tr(a.label)}</Text>
                  </Pressable>
                </Animated.View>
              );
            })}
          </View>
        </Animated.View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000000", paddingHorizontal: 24 },
  center: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  line: {
    marginTop: 18,
    fontSize: 22,
    lineHeight: 29,
    textAlign: "center",
    color: "#FFFFFF",
    fontFamily: "Geologica_700Bold",
  },
  block: { flex: 1, justifyContent: "center" },
  back: { position: "absolute", left: 18, zIndex: 2 },
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
});
