// Sales / service scenes: a face-to-face chat with the customer / guest.
// Their lines arrive as left bubbles, your turns as compact right bubbles,
// plus a persona strip with the mood meter and quick context chips.
import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import Animated, { FadeInDown, FadeOut, LinearTransition } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { lt } from "@/constants/roleScenarios";
import { Avatar, GoalTag, MoodMeter, SCENE, TypingDots, type SceneProps } from "./common";

export function ChatDialogue(p: SceneProps) {
  const { scenario: s, lang, scripted } = p;
  const lines = p.messages.filter((m) => m.kind !== "ambient");
  const visible = scripted ? [] : lines.slice(-3);
  // Bubbles get whatever is left under maxHeight; older ones clip off the top.
  const listMax = Math.max(90, p.maxHeight - (s.chips?.length ? 96 : 64));

  return (
    <View style={{ gap: 8, maxHeight: p.maxHeight, justifyContent: "flex-end" }}>
      {/* Persona strip */}
      <View style={styles.persona}>
        <Avatar emoji={s.persona.avatar} size={34} ring={p.typing ? SCENE.yellow : undefined} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.name} numberOfLines={1}>{lt(s.persona.name, lang)}</Text>
          <Text style={styles.moodText} numberOfLines={1}>{lt(s.persona.mood, lang)}</Text>
        </View>
        <MoodMeter value={p.mood} label={lt(s.meterLabel, lang)} width={86} />
      </View>

      {!!s.chips?.length && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }} style={{ flexGrow: 0 }}>
          {s.chips.map((c, i) => (
            <View key={i} style={styles.chip}>
              <Text style={styles.chipIcon}>{c.icon}</Text>
              <Text style={styles.chipText}>{lt(c.label, lang)}</Text>
            </View>
          ))}
        </ScrollView>
      )}

      {p.awaitingOpening && !scripted && (
        <Animated.View entering={FadeInDown} style={styles.hint}>
          <Ionicons name="mic" size={13} color={SCENE.onYellow} />
          <Text style={styles.hintText}>{lang === "en" ? "You start" : "Ты начинаешь"}: {lt(s.openingHint, lang)}</Text>
        </Animated.View>
      )}

      <View style={{ maxHeight: listMax, overflow: "hidden", justifyContent: "flex-end", gap: 8 }}>
      {visible.map((m) =>
        m.kind === "you" ? (
          <Animated.View key={m.key} entering={FadeInDown.duration(220)} exiting={FadeOut.duration(160)} layout={LinearTransition.duration(200)} style={styles.youRow}>
            <View style={styles.youBubble}>
              {m.text ? (
                <Text style={styles.youText} numberOfLines={2}>{m.text}</Text>
              ) : (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Ionicons name="mic" size={13} color={SCENE.onYellow} />
                  <Text style={styles.youMeta}>{lang === "en" ? "You" : "Ты"} · {Math.floor((m.seconds ?? 1) / 60)}:{String((m.seconds ?? 1) % 60).padStart(2, "0")}</Text>
                </View>
              )}
            </View>
          </Animated.View>
        ) : (
          <Animated.View key={m.key} entering={FadeInDown.duration(260)} exiting={FadeOut.duration(160)} layout={LinearTransition.duration(200)} style={styles.oppRow}>
            <Avatar emoji={m.avatar} size={26} />
            <View style={[styles.oppBubble, m.kind === "nudge" && styles.nudge, m.kind === "ending" && styles.ending]}>
              {m.tone !== "persona" && <Text style={styles.speaker}>{m.name}</Text>}
              <Text style={styles.oppText}>{m.text}</Text>
              {m.kind === "beat" && <GoalTag scenario={s} beatIndex={m.beatIndex} lang={lang} />}
            </View>
          </Animated.View>
        ),
      )}

      {p.typing && !scripted && (
        <Animated.View entering={FadeInDown.duration(180)} style={styles.oppRow}>
          <Avatar emoji={s.persona.avatar} size={26} />
          <View style={[styles.oppBubble, { paddingVertical: 10 }]}>
            <TypingDots />
          </View>
        </Animated.View>
      )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  persona: {
    flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: SCENE.glass,
    borderRadius: 16, paddingHorizontal: 10, paddingVertical: 8,
  },
  name: { color: SCENE.text, fontFamily: "Geologica_700Bold", fontSize: 14 },
  moodText: { color: SCENE.muted, fontFamily: "Geologica_400Regular", fontSize: 11 },
  chip: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: SCENE.glassSoft, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 },
  chipIcon: { fontSize: 12 },
  chipText: { color: SCENE.text, fontFamily: "Geologica_500Medium", fontSize: 11 },
  hint: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: SCENE.yellow, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6, maxWidth: "92%" },
  hintText: { color: SCENE.onYellow, fontFamily: "Geologica_600SemiBold", fontSize: 12, flexShrink: 1 },
  oppRow: { flexDirection: "row", alignItems: "flex-end", gap: 7, maxWidth: "86%" },
  oppBubble: {
    backgroundColor: SCENE.glass, borderRadius: 16, borderBottomLeftRadius: 5,
    paddingHorizontal: 12, paddingVertical: 8, flexShrink: 1, borderWidth: 1, borderColor: SCENE.line,
  },
  nudge: { backgroundColor: SCENE.glassSoft, borderStyle: "dashed" },
  ending: { borderColor: SCENE.yellow },
  speaker: { color: SCENE.yellow, fontFamily: "Geologica_600SemiBold", fontSize: 11, marginBottom: 2 },
  oppText: { color: SCENE.text, fontFamily: "Geologica_500Medium", fontSize: 14, lineHeight: 19 },
  youRow: { alignSelf: "flex-end", maxWidth: "78%" },
  youBubble: { backgroundColor: SCENE.yellow, borderRadius: 16, borderBottomRightRadius: 5, paddingHorizontal: 12, paddingVertical: 7 },
  youText: { color: SCENE.onYellow, fontFamily: "Geologica_500Medium", fontSize: 13, lineHeight: 17 },
  youMeta: { color: SCENE.onYellow, fontFamily: "Geologica_700Bold", fontSize: 12 },
});
