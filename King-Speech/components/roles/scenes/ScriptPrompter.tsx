// Scripted mode: the teleprompter becomes a dialogue script — the opponent's
// current line (small, as a quote) followed by YOUR line (big). It advances
// together with the scenario engine.
import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import type { Lang } from "@/context/LangContext";
import { lt, speakerName, type RoleScenario } from "@/constants/roleScenarios";
import { Avatar, SCENE, TypingDots } from "./common";

export function ScriptPrompter({
  scenario: s,
  lang,
  prompt,
  awaitingOpening,
  typing,
  finished,
  maxHeight,
}: {
  scenario: RoleScenario;
  lang: Lang;
  prompt: number;
  awaitingOpening: boolean;
  typing: boolean;
  finished: boolean;
  maxHeight: number;
}) {
  const beat = prompt >= 0 ? s.beats[prompt] : undefined;
  const yourLine = awaitingOpening ? s.opening : beat?.reply;
  const step = awaitingOpening ? 0 : prompt + 1;
  const total = s.beats.length + (s.opening ? 1 : 0);
  const shownStep = s.opening ? step + 1 : step;

  return (
    <View style={[styles.card, { maxHeight }]}>
      <View style={styles.head}>
        <Ionicons name="document-text" size={12} color={SCENE.muted} />
        <Text style={styles.headText}>
          {lang === "en" ? "SCRIPT" : "СЦЕНАРИЙ"} · {Math.min(shownStep, total)}/{total}
        </Text>
      </View>

      {finished ? (
        <Text style={styles.done}>{lang === "en" ? "Scene complete — tap stop ■" : "Сцена сыграна — жми стоп ■"}</Text>
      ) : typing ? (
        <View style={styles.oppRow}>
          <Avatar emoji={s.persona.avatar} size={22} />
          <TypingDots />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          <Animated.View key={`p${prompt}`} entering={FadeIn.duration(220)}>
            {beat && !awaitingOpening && (
              <View style={styles.oppRow}>
                <Avatar emoji={beat.from?.avatar ?? s.persona.avatar} size={22} />
                <Text style={styles.oppText}>
                  <Text style={styles.oppName}>{speakerName(beat.from, s, lang)}: </Text>
                  {lt(beat.line, lang)}
                </Text>
              </View>
            )}
            {yourLine && (
              <>
                <Text style={styles.youLabel}>{lang === "en" ? "YOU" : "ТЫ"}</Text>
                <Text style={styles.yourText}>{lt(yourLine, lang)}</Text>
              </>
            )}
          </Animated.View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#000000B3", borderRadius: 18, paddingHorizontal: 14, paddingVertical: 12 },
  head: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  headText: { color: SCENE.muted, fontFamily: "Geologica_700Bold", fontSize: 10, letterSpacing: 1 },
  oppRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 8 },
  oppName: { color: SCENE.yellow, fontFamily: "Geologica_700Bold" },
  oppText: { flex: 1, color: "rgba(255,255,255,0.78)", fontFamily: "Geologica_500Medium", fontSize: 13, lineHeight: 18 },
  youLabel: { color: SCENE.yellow, fontFamily: "Geologica_800ExtraBold", fontSize: 10, letterSpacing: 1.2, marginBottom: 2 },
  yourText: { color: SCENE.text, fontFamily: "Literata_400Regular", fontSize: 19, lineHeight: 27 },
  done: { color: SCENE.yellow, fontFamily: "Geologica_700Bold", fontSize: 15, paddingVertical: 6 },
});
