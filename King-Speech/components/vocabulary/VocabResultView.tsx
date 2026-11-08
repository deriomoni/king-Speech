import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useTheme } from "@/context/ThemeContext";
import type { VocabWord } from "@/constants/vocabularyData";

/**
 * «Словарный запас · Время вышло» (Figma 37:6698): title, the word, a big
 * found/total count, points, a gold progress bar, every synonym as a chip
 * (found ones highlighted), named/missed stats and «Далее».
 */
export default function VocabResultView({
  word,
  foundSynonyms,
  score,
  onNext,
  topPad,
  bottomPad,
}: {
  word: VocabWord;
  foundSynonyms: string[];
  score: number;
  onNext: () => void;
  topPad: number;
  bottomPad: number;
}) {
  const { theme, themeMode } = useTheme();
  const isDark = themeMode === "dark";
  const ink = (a: number) => (isDark ? `rgba(240,238,233,${a})` : `rgba(38,38,40,${a})`);
  const [animFound, setAnimFound] = useState(0);
  const [animScore, setAnimScore] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const dur = 1200;
    const finalFound = foundSynonyms.length;
    const finalScore = score;
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);
    const id = setInterval(() => {
      const t = Math.min(1, (Date.now() - start) / dur);
      const e = ease(t);
      setAnimFound(Math.round(e * finalFound));
      setAnimScore(Math.round(e * finalScore));
      if (t >= 1) clearInterval(id);
    }, 30);
    return () => clearInterval(id);
  }, [foundSynonyms.length, score]);

  const total = word.synonyms.length;
  const isFound = (s: string) =>
    foundSynonyms.some((f) => f.trim().toLowerCase() === s.trim().toLowerCase());
  const foundCount = word.synonyms.filter(isFound).length;
  const missedCount = Math.max(0, total - foundCount);
  const secondary = isDark ? "#CCCAC6" : "rgba(38,38,40,0.7)";
  const muted = isDark ? "#969593" : "rgba(38,38,40,0.5)";
  const display = word.word.charAt(0).toUpperCase() + word.word.slice(1).toLowerCase();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.bg }}
      contentContainerStyle={[styles.content, { paddingTop: topPad + 24, paddingBottom: bottomPad + 40 }]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.title, { color: theme.text }]}>Время вышло!</Text>
      <Text style={[styles.wordLine, { color: secondary }]}>Слово: {word.word.toUpperCase()}</Text>

      <Text style={[styles.big, { color: theme.text }]}>
        {animFound} / {total}
      </Text>
      <Text style={[styles.score, { color: secondary }]}>+{animScore} очков</Text>

      <View style={[styles.track, { backgroundColor: ink(0.1) }]}>
        <Animated.View
          entering={FadeInDown.duration(400)}
          style={[styles.fill, { backgroundColor: theme.accent, width: `${total ? (foundCount / total) * 100 : 0}%` }]}
        />
      </View>

      <Text style={[styles.sectionLabel, { color: secondary }]}>Синонимы к слову «{display}»</Text>
      <View style={styles.chips}>
        {word.synonyms.map((syn, idx) => {
          const found = isFound(syn);
          return (
            <Animated.View
              key={`${syn}-${idx}`}
              entering={FadeInDown.delay(idx * 55).duration(240)}
              style={[
                styles.chip,
                found
                  ? {
                      backgroundColor: isDark ? "rgba(255,237,168,0.14)" : "rgba(255,237,168,0.35)",
                      borderColor: isDark ? "rgba(255,237,168,0.45)" : "rgba(230,205,130,0.7)",
                    }
                  : { backgroundColor: ink(0.05), borderColor: isDark ? "rgba(240,238,233,0.06)" : "rgba(38,38,40,0.08)" },
              ]}
            >
              <Text style={[styles.chipText, { color: found ? theme.accentInk : muted }]}>
                {found ? "✓ " : ""}
                {syn}
              </Text>
            </Animated.View>
          );
        })}
      </View>

      <Text style={[styles.stats, { color: muted }]}>
        Назвал {foundCount} · Пропустил {missedCount}
      </Text>
      {foundCount === 0 ? (
        <Text style={[styles.encourage, { color: secondary }]}>В следующий раз получится!</Text>
      ) : null}

      <Pressable
        onPress={onNext}
        accessibilityRole="button"
        accessibilityLabel="Далее"
        style={({ pressed }) => [
          styles.cta,
          { backgroundColor: theme.accent, borderColor: theme.ctaStroke, opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <Text style={[styles.ctaText, { color: theme.accentText }]}>Далее</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 24, alignItems: "stretch" },
  title: { fontFamily: "Geologica_700Bold", fontSize: 20, letterSpacing: -0.1, textAlign: "center" },
  wordLine: { marginTop: 8, fontFamily: "Geologica_500Medium", fontSize: 14, textAlign: "center" },
  big: { marginTop: 18, fontFamily: "Geologica_700Bold", fontSize: 64, letterSpacing: -1.92, textAlign: "center" },
  score: { marginTop: 6, fontFamily: "Geologica_600SemiBold", fontSize: 28, letterSpacing: -0.28, textAlign: "center" },
  track: { marginTop: 20, height: 10, borderRadius: 5, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 5 },
  sectionLabel: { marginTop: 27, fontFamily: "Geologica_600SemiBold", fontSize: 14 },
  chips: { marginTop: 14, flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { height: 29, borderRadius: 32, borderWidth: 2, paddingHorizontal: 11, justifyContent: "center" },
  chipText: { fontFamily: "Geologica_500Medium", fontSize: 13 },
  stats: { marginTop: 18, fontFamily: "Geologica_500Medium", fontSize: 14, textAlign: "center" },
  encourage: { marginTop: 30, fontFamily: "Geologica_500Medium", fontStyle: "italic", fontSize: 16, textAlign: "center" },
  cta: { marginTop: 28, height: 54, borderRadius: 32, borderWidth: 4, alignItems: "center", justifyContent: "center" },
  ctaText: { fontFamily: "Geologica_600SemiBold", fontSize: 15 },
});
