// Email + password sign-in / sign-up, on the same dusk aurora as the sign-in
// screen. Signing in or up flips the auth state; the root gate then routes on
// (profile-setup for a brand-new account, otherwise onboarding or the app).
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { useLang, pickLang } from "@/context/LangContext";
import { useAuth } from "@/context/AuthContext";
import AuroraBackground, { AURORA_DUSK } from "@/components/subscription/AuroraBackground";
import { rs } from "@/lib/responsive";

type Mode = "signIn" | "signUp";

export default function EmailAuthScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { lang } = useLang();
  const tr = (v: { ru: string; en: string; kk: string }) => pickLang(lang, v);
  const { signInWithEmail, signUpWithEmail, resetPassword, authError, clearAuthError } = useAuth();

  const [mode, setMode] = useState<Mode>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const topPad = Platform.OS === "web" ? 54 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const error = localError ?? authError;

  useEffect(() => {
    clearAuthError();
    setLocalError(null);
  }, [mode, clearAuthError]);

  const validEmail = /^\S+@\S+\.\S+$/.test(email.trim());
  const canSubmit = validEmail && password.length >= 6 && (mode === "signIn" || password2.length >= 6) && !busy;

  const submit = async () => {
    setLocalError(null);
    if (mode === "signUp" && password !== password2) {
      setLocalError(tr({ ru: "Пароли не совпадают.", en: "The passwords don't match.", kk: "Құпиясөздер сәйкес емес." }));
      return;
    }
    setBusy(true);
    const ok = mode === "signIn" ? await signInWithEmail(email, password) : await signUpWithEmail(email, password);
    // on success the root gate navigates away; keep the spinner until then
    if (!ok) setBusy(false);
  };

  const forgot = async () => {
    if (!validEmail) {
      setLocalError(tr({ ru: "Введи email — пришлём ссылку для сброса пароля.", en: "Enter your email — we'll send a reset link.", kk: "Email енгізіңіз — құпиясөзді қалпына келтіру сілтемесін жібереміз." }));
      return;
    }
    const ok = await resetPassword(email);
    if (ok) {
      Alert.alert(
        tr({ ru: "Письмо отправлено", en: "Email sent", kk: "Хат жіберілді" }),
        tr({ ru: "Проверь почту — там ссылка для нового пароля.", en: "Check your inbox for a link to set a new password.", kk: "Поштаңызды тексеріңіз — жаңа құпиясөз сілтемесі сонда." }),
      );
    }
  };

  const isUp = mode === "signUp";

  // back to the sign-in screen; after a reload there may be nothing to pop, so
  // fall back to replacing the route instead of throwing
  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(auth)/login");
  };

  return (
    <View style={[s.root, { paddingTop: topPad, paddingBottom: bottomPad + rs(16) }]}>
      <StatusBar barStyle="light-content" />
      {/* arrives already darkened, stripe by stripe, from the sign-in screen */}
      <AuroraBackground palette={AURORA_DUSK} dim={false} rim shade={1} />

      <Pressable onPress={goBack} hitSlop={12} style={s.back} accessibilityLabel={tr({ ru: "Назад", en: "Back", kk: "Артқа" })}>
        <Ionicons name="chevron-back" size={rs(26)} color="#FFFFFF" />
      </Pressable>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={s.flex}>
        <View style={s.flex} />

        <Animated.View entering={FadeIn.duration(400)}>
          <Text style={s.title}>
            {isUp ? tr({ ru: "Регистрация", en: "Sign up", kk: "Тіркелу" }) : tr({ ru: "Вход", en: "Sign in", kk: "Кіру" })}
          </Text>
          <Text style={s.sub}>
            {isUp
              ? tr({ ru: "Создай аккаунт — прогресс будет с тобой на любом устройстве.", en: "Create an account — your progress follows you to any device.", kk: "Аккаунт ашыңыз — прогресс кез келген құрылғыда сізбен бірге." })
              : tr({ ru: "Введи email и пароль от своего аккаунта.", en: "Enter your account email and password.", kk: "Аккаунтыңыздың email мен құпиясөзін енгізіңіз." })}
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(120).duration(450)} style={s.form}>
          <View style={s.field}>
            <Ionicons name="mail-outline" size={rs(18)} color="rgba(255,255,255,0.7)" />
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="Email"
              placeholderTextColor="rgba(255,255,255,0.5)"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              autoComplete="email"
              style={s.input}
            />
          </View>
          <View style={s.field}>
            <Ionicons name="lock-closed-outline" size={rs(18)} color="rgba(255,255,255,0.7)" />
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder={tr({ ru: "Пароль", en: "Password", kk: "Құпиясөз" })}
              placeholderTextColor="rgba(255,255,255,0.5)"
              secureTextEntry={!showPass}
              autoCapitalize="none"
              textContentType={isUp ? "newPassword" : "password"}
              autoComplete={isUp ? "new-password" : "password"}
              style={s.input}
            />
            <Pressable onPress={() => setShowPass((v) => !v)} hitSlop={10}>
              <Ionicons name={showPass ? "eye-off-outline" : "eye-outline"} size={rs(18)} color="rgba(255,255,255,0.7)" />
            </Pressable>
          </View>
          {isUp ? (
            <View style={s.field}>
              <Ionicons name="lock-closed-outline" size={rs(18)} color="rgba(255,255,255,0.7)" />
              <TextInput
                value={password2}
                onChangeText={setPassword2}
                placeholder={tr({ ru: "Повтори пароль", en: "Repeat password", kk: "Құпиясөзді қайталаңыз" })}
                placeholderTextColor="rgba(255,255,255,0.5)"
                secureTextEntry={!showPass}
                autoCapitalize="none"
                textContentType="newPassword"
                style={s.input}
              />
            </View>
          ) : null}

          {error ? <Text style={s.error}>{error}</Text> : null}

          <Pressable
            onPress={submit}
            disabled={!canSubmit}
            style={({ pressed }) => [s.btn, { opacity: pressed ? 0.85 : 1 }]}
          >
            <Text style={[s.btnTxt, !canSubmit && { color: "rgba(255,255,255,0.45)" }]}>
              {isUp ? tr({ ru: "Зарегистрироваться", en: "Create account", kk: "Тіркелу" }) : tr({ ru: "Войти", en: "Sign in", kk: "Кіру" })}
            </Text>
            {busy ? (
              <View style={s.busy}>
                <ActivityIndicator size="small" color="#FFFFFF" />
              </View>
            ) : null}
          </Pressable>

          {!isUp ? (
            <Pressable onPress={forgot} hitSlop={8} style={s.linkWrap}>
              <Text style={s.link}>{tr({ ru: "Забыли пароль?", en: "Forgot password?", kk: "Құпиясөзді ұмыттыңыз ба?" })}</Text>
            </Pressable>
          ) : null}
        </Animated.View>

        <Pressable onPress={() => setMode(isUp ? "signIn" : "signUp")} hitSlop={10} style={s.switch}>
          <Text style={s.switchTxt}>
            {isUp
              ? tr({ ru: "Уже есть аккаунт? ", en: "Already have an account? ", kk: "Аккаунтыңыз бар ма? " })
              : tr({ ru: "Нет аккаунта? ", en: "No account yet? ", kk: "Аккаунтыңыз жоқ па? " })}
            <Text style={s.switchStrong}>
              {isUp ? tr({ ru: "Войти", en: "Sign in", kk: "Кіру" }) : tr({ ru: "Зарегистрироваться", en: "Sign up", kk: "Тіркелу" })}
            </Text>
          </Text>
        </Pressable>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 24, backgroundColor: "#05031A" },
  flex: { flex: 1 },
  back: { width: 40, height: 40, justifyContent: "center", marginLeft: -8, marginTop: 4 },
  title: { fontSize: 34, letterSpacing: -0.6, color: "#FFFFFF", fontFamily: "Geologica_900Black" },
  sub: { marginTop: 8, fontSize: 15, lineHeight: 20, color: "rgba(255,255,255,0.75)", fontFamily: "Geologica_500Medium" },
  form: { marginTop: 24, gap: 10 },
  field: {
    height: 56,
    borderRadius: 18,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(10,8,30,0.45)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  input: { flex: 1, height: "100%", color: "#FFFFFF", fontSize: 16, fontFamily: "Geologica_500Medium" },
  error: { color: "#FFD0D6", fontSize: 13, lineHeight: 18, fontFamily: "Geologica_600SemiBold" },
  btn: {
    marginTop: 6,
    height: 58,
    borderRadius: 32,
    backgroundColor: "#0A0A0C",
    alignItems: "center",
    justifyContent: "center",
  },
  btnTxt: { fontSize: 17, color: "#FFFFFF", fontFamily: "Geologica_800ExtraBold" },
  busy: { position: "absolute", right: 20 },
  linkWrap: { alignSelf: "center", marginTop: 6 },
  link: { fontSize: 14, color: "rgba(255,255,255,0.8)", fontFamily: "Geologica_600SemiBold" },
  switch: { alignSelf: "center", marginTop: 22 },
  switchTxt: { fontSize: 15, color: "rgba(255,255,255,0.75)", fontFamily: "Geologica_500Medium" },
  switchStrong: { color: "#FFFFFF", fontFamily: "Geologica_800ExtraBold" },
});
