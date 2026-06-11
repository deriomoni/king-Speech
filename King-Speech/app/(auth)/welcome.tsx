import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  StatusBar,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Animated, { FadeIn, FadeInDown, FadeInUp } from "react-native-reanimated";
import { useLang, Lang } from "@/context/LangContext";
import { useTheme } from "@/context/ThemeContext";
import OreoMascot from "@/components/OreoMascot";

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t, lang, setLang } = useLang();
  const { theme } = useTheme();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  return (
    <View style={[s.root, { backgroundColor: theme.bg, paddingTop: topPad, paddingBottom: bottomPad + 16 }]}>
      <StatusBar barStyle={theme.mode === "dark" ? "light-content" : "dark-content"} />

      {/* Lang toggle — top right */}
      <Animated.View entering={FadeIn.delay(200)} style={s.langRow}>
        <Pressable
          onPress={() => setLang("ru")}
          style={[s.langBtn, lang === "ru" && { backgroundColor: theme.accent }]}
        >
          <Text style={[s.langTxt, { color: lang === "ru" ? theme.accentText : theme.textSecondary }]}>
            RU
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setLang("en")}
          style={[s.langBtn, lang === "en" && { backgroundColor: theme.accent }]}
        >
          <Text style={[s.langTxt, { color: lang === "en" ? theme.accentText : theme.textSecondary }]}>
            EN
          </Text>
        </Pressable>
      </Animated.View>

      {/* Oreo mascot with starburst */}
      <Animated.View entering={FadeIn.delay(100)} style={s.videoWrap}>
        <OreoMascot size={240} shouldPlay />
      </Animated.View>

      {/* Title + subtitle */}
      <Animated.View entering={FadeInUp.delay(300).springify()} style={s.textBlock}>
        <Text style={[s.title, { color: theme.text }]}>{t("welcome")}</Text>
        <Text style={[s.sub, { color: theme.textSecondary }]}>{t("welcomeSub")}</Text>
      </Animated.View>

      {/* CTA */}
      <Animated.View entering={FadeInDown.delay(450).springify()} style={s.btnBlock}>
        <Pressable
          style={({ pressed }) => [
            s.primaryBtn,
            { backgroundColor: theme.cta, opacity: pressed ? 0.88 : 1 },
          ]}
          onPress={() => router.push("/(auth)/login")}
        >
          <Text style={[s.primaryBtnTxt, { color: theme.ctaText }]}>{t("start")}</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "space-between",
  },
  langRow: {
    flexDirection: "row",
    gap: 8,
    alignSelf: "flex-end",
    marginRight: 20,
    marginTop: 8,
  },
  langBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  langTxt: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
  },
  videoWrap: {
    flex: 1,
    width: "100%",
    maxHeight: 340,
    justifyContent: "center",
    alignItems: "center",
  },
  video: {
    width: 300,
    height: 300,
  },
  textBlock: {
    alignItems: "center",
    paddingHorizontal: 32,
    marginBottom: 8,
  },
  title: {
    fontSize: 34,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    marginBottom: 10,
    letterSpacing: -0.5,
  },
  sub: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 24,
  },
  btnBlock: {
    width: "100%",
    paddingHorizontal: 24,
    marginTop: 24,
  },
  primaryBtn: {
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: "center",
    shadowColor: "#FFD166",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  primaryBtnTxt: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.3,
  },
});
