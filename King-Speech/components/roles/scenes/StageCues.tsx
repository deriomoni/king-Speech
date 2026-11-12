// Public / stage scenes. One family, six flavours (scenario.variant):
//   weather   — producer cues in the earpiece + weather map cards strip
//   showman   — crowd energy meter on the side + hall reactions
//   host      — «now in the programme» cards + guest interjections
//   comedian  — laugh meter on the side + heckler bubbles
//   interview — reporter questions with camera flashes
//   voice     — character script cards from the director behind the glass
import React, { useEffect } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import Animated, {
  FadeInDown,
  FadeOut,
  ZoomIn,
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { lt, type SceneCard, type StageVariant } from "@/constants/roleScenarios";
import type { ScenarioMsg } from "@/hooks/useRoleScenario";
import { Avatar, GoalTag, MoodMeter, SCENE, TypingDots, type SceneProps } from "./common";

const SIDE_METER: StageVariant[] = ["comedian", "showman"];

/** Absolute layer: camera flashes (interview) and the side meter (comedian / showman). */
export function StageOverlay({
  variant,
  flashKey,
  mood,
  label,
  bottom,
}: {
  variant?: StageVariant;
  flashKey: number;
  mood: number;
  label: string;
  bottom: number;
}) {
  return (
    <>
      {variant === "interview" && <Flash k={flashKey} />}
      {variant && SIDE_METER.includes(variant) && (
        <View pointerEvents="none" style={[styles.sideMeter, { bottom }]}>
          <Text style={{ fontSize: 20 }}>{variant === "comedian" ? "😂" : "🔥"}</Text>
          <VerticalBar value={mood} />
          <Text style={styles.sideLabel} numberOfLines={2}>{label}</Text>
        </View>
      )}
    </>
  );
}

function Flash({ k }: { k: number }) {
  const o = useSharedValue(0);
  useEffect(() => {
    if (!k) return;
    o.value = withSequence(withTiming(0.85, { duration: 60 }), withTiming(0, { duration: 220 }), withTiming(0.55, { duration: 60 }), withTiming(0, { duration: 380 }));
  }, [k, o]);
  const st = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View pointerEvents="none" style={[styles.flash, st]} />;
}

function VerticalBar({ value }: { value: number }) {
  const v = Math.max(0, Math.min(100, value));
  const h = useSharedValue(v);
  useEffect(() => {
    h.value = withTiming(v, { duration: 500 });
  }, [v, h]);
  const st = useAnimatedStyle(() => ({ height: `${h.value}%` }));
  const color = v < 34 ? "#FF6B5E" : v < 62 ? SCENE.yellow : SCENE.green;
  return (
    <View style={styles.vTrack}>
      <Animated.View style={[styles.vFill, { backgroundColor: color }, st]} />
    </View>
  );
}

function CueBubble({ m, s, lang, variant }: { m: ScenarioMsg; s: SceneProps["scenario"]; lang: SceneProps["lang"]; variant?: StageVariant }) {
  const tone = m.tone;
  const isCue = tone === "cue";
  const isTroll = tone === "troll";
  const icon: keyof typeof Ionicons.glyphMap = isCue
    ? variant === "weather"
      ? "headset"
      : "megaphone"
    : variant === "interview"
      ? "mic"
      : isTroll
        ? "flame"
        : "people";
  return (
    <Animated.View
      key={m.key}
      entering={FadeInDown.duration(260)}
      exiting={FadeOut.duration(160)}
      style={[styles.cue, isCue && styles.cueEarpiece, isTroll && styles.cueTroll, m.kind === "ending" && styles.cueEnding]}
    >
      <View style={styles.cueHead}>
        {isCue ? <Ionicons name={icon} size={14} color={SCENE.yellow} /> : <Avatar emoji={m.avatar} size={22} />}
        <Text style={[styles.cueName, isTroll && { color: "#FFB3B3" }]} numberOfLines={1}>{m.name.toUpperCase()}</Text>
        {!isCue && <Ionicons name={icon} size={12} color={SCENE.muted} />}
      </View>
      <Text style={[styles.cueText, isCue && { fontStyle: "italic" }]}>{m.text}</Text>
      {m.kind === "beat" && <GoalTag scenario={s} beatIndex={m.beatIndex} lang={lang} />}
    </Animated.View>
  );
}

function BigCard({ card, variant, lang }: { card: SceneCard; variant?: StageVariant; lang: SceneProps["lang"] }) {
  const kicker =
    variant === "host"
      ? (lang === "en" ? "NOW ON THE PROGRAMME" : "СЕЙЧАС В ПРОГРАММЕ")
      : variant === "voice"
        ? (lang === "en" ? "CHARACTER" : "ПЕРСОНАЖ")
        : (lang === "en" ? "FORECAST" : "ПРОГНОЗ");
  const dark = variant === "voice";
  return (
    <Animated.View entering={ZoomIn.duration(280)} style={[styles.card, variant === "voice" && styles.cardVoice]}>
      <Text style={styles.cardIcon}>{card.icon}</Text>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.cardKicker, dark && { color: "#9A6A00" }]}>{kicker}</Text>
        <Text style={[styles.cardTitle, dark && { color: "#1A1A1A" }]} numberOfLines={1}>{lt(card.title, lang)}</Text>
        {card.sub && (
          <Text style={[styles.cardSub, dark && { color: "#5A5A5A" }]} numberOfLines={1}>
            {variant === "voice" ? "✎ " : ""}
            {lt(card.sub, lang)}
          </Text>
        )}
      </View>
      {card.value && <Text style={[styles.cardValue, dark && { color: "#1A1A1A" }]}>{card.value}</Text>}
    </Animated.View>
  );
}

export function StageFeed(p: SceneProps) {
  const { scenario: s, lang, scripted } = p;
  const variant = s.variant;
  const lines = p.messages.filter((m) => m.kind !== "ambient" && m.kind !== "you");
  const last = lines[lines.length - 1];
  const beatsWithCards = p.messages.filter((m) => m.kind === "beat" && m.card);
  const card = beatsWithCards[beatsWithCards.length - 1]?.card;
  const showMeter = !variant || !SIDE_METER.includes(variant);

  return (
    <View style={{ gap: 8, maxHeight: p.maxHeight, justifyContent: "flex-end" }}>
      {showMeter && (
        <View style={styles.meterRow}>
          <MoodMeter value={p.mood} label={lt(s.meterLabel, lang)} width={110} />
        </View>
      )}

      {/* Weather: the map strip of every city covered so far */}
      {variant === "weather" && beatsWithCards.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }} style={{ flexGrow: 0 }}>
          {beatsWithCards.slice(0, -1).map((m) => (
            <View key={m.key} style={styles.mini}>
              <Text style={{ fontSize: 14 }}>{m.card!.icon}</Text>
              <Text style={styles.miniText}>{m.card!.value}</Text>
            </View>
          ))}
        </ScrollView>
      )}

      {card && <BigCard key={beatsWithCards[beatsWithCards.length - 1].key} card={card} variant={variant} lang={lang} />}

      {p.awaitingOpening && !scripted && (
        <Animated.View entering={FadeInDown} style={styles.hint}>
          <Ionicons name="sparkles" size={13} color={SCENE.onYellow} />
          <Text style={styles.hintText}>{lang === "en" ? "Your entrance: " : "Твой выход: "}{lt(s.openingHint, lang)}</Text>
        </Animated.View>
      )}

      {!scripted && last && !p.typing && <CueBubble m={last} s={s} lang={lang} variant={variant} />}

      {!scripted && p.typing && (
        <View style={[styles.cue, styles.cueEarpiece, { paddingVertical: 10 }]}>
          <TypingDots color={SCENE.yellow} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flash: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "#FFFFFF" },
  sideMeter: { position: "absolute", right: 12, width: 54, alignItems: "center", gap: 6, backgroundColor: SCENE.glassSoft, borderRadius: 16, paddingVertical: 10 },
  vTrack: { width: 10, height: 120, borderRadius: 5, backgroundColor: "rgba(255,255,255,0.18)", overflow: "hidden", justifyContent: "flex-end" },
  vFill: { width: 10, borderRadius: 5 },
  sideLabel: { color: SCENE.muted, fontFamily: "Geologica_600SemiBold", fontSize: 9, textAlign: "center", paddingHorizontal: 2 },

  meterRow: { alignSelf: "flex-start", backgroundColor: SCENE.glassSoft, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6 },

  mini: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: SCENE.glassSoft, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 },
  miniText: { color: SCENE.text, fontFamily: "Geologica_700Bold", fontSize: 11 },

  card: {
    flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "rgba(20,60,140,0.72)",
    borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.22)",
  },
  cardVoice: { backgroundColor: "rgba(245,240,225,0.94)" },
  cardIcon: { fontSize: 34 },
  cardKicker: { color: SCENE.yellow, fontFamily: "Geologica_700Bold", fontSize: 9, letterSpacing: 1 },
  cardTitle: { color: SCENE.text, fontFamily: "Geologica_800ExtraBold", fontSize: 17 },
  cardSub: { color: SCENE.muted, fontFamily: "Geologica_500Medium", fontSize: 12 },
  cardValue: { color: SCENE.text, fontFamily: "Geologica_800ExtraBold", fontSize: 24 },

  hint: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: SCENE.yellow, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6, maxWidth: "88%" },
  hintText: { color: SCENE.onYellow, fontFamily: "Geologica_600SemiBold", fontSize: 12, flexShrink: 1 },

  cue: { backgroundColor: SCENE.glass, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 9, borderWidth: 1, borderColor: SCENE.line, marginRight: 64 },
  cueEarpiece: { backgroundColor: SCENE.cue, borderColor: "rgba(255,216,87,0.35)" },
  cueTroll: { backgroundColor: SCENE.troll, borderColor: "rgba(255,120,120,0.4)" },
  cueEnding: { borderColor: SCENE.yellow },
  cueHead: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  cueName: { color: SCENE.yellow, fontFamily: "Geologica_700Bold", fontSize: 10, letterSpacing: 0.8, flexShrink: 1 },
  cueText: { color: SCENE.text, fontFamily: "Geologica_500Medium", fontSize: 14, lineHeight: 19 },
});
