// template
import { Link, Stack } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { useLang, pickLang } from "@/context/LangContext";

export default function NotFoundScreen() {
  const { lang } = useLang();
  return (
    <>
      <Stack.Screen options={{ title: pickLang(lang, { ru: "Упс!", en: "Oops!", kk: "Ой!" }) }} />
      <View style={styles.container}>
        <Text style={styles.title}>
          {pickLang(lang, { ru: "Такого экрана нет.", en: "This screen doesn't exist.", kk: "Мұндай экран жоқ." })}
        </Text>

        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>
            {pickLang(lang, { ru: "На главный экран", en: "Go to home screen", kk: "Басты экранға" })}
          </Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
  },
  link: {
    marginTop: 15,
    paddingVertical: 15,
  },
  linkText: {
    fontSize: 14,
    color: "#2e78b7",
  },
});
