// Blogger scenes: a generic live-stream overlay (no platform branding).
//   LiveTopBadge — «LIVE · 01:12» + viewer counter (replaces the REC pill)
//   LiveOverlay  — floating hearts on the right edge
//   LiveFeed     — pinned question + scrolling comment stream + fake input row
import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, {
  FadeInDown,
  FadeOut,
  LinearTransition,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { lt } from "@/constants/roleScenarios";
import { MONO } from "@/components/roles/RoleTarotCard";
import { Avatar, GoalTag, SCENE, TypingDots, type SceneProps } from "./common";

export function formatViewers(n: number): string {
  if (n >= 10000) return `${Math.round(n / 1000)}K`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(".0", "")}K`;
  return String(Math.max(0, Math.round(n)));
}

export function LiveTopBadge({ viewers, time }: { viewers: number; time: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <View style={styles.livePill}>
        <Text style={styles.liveText}>LIVE</Text>
        <Text style={styles.liveTime}>{time}</Text>
      </View>
      <View style={styles.viewersPill}>
        <Ionicons name="eye" size={13} color="#fff" />
        <Text style={styles.viewersText}>{formatViewers(viewers)}</Text>
      </View>
    </View>
  );
}

const HEART_COLORS = ["#FF3B6B", "#FF6FA5", "#FFD857", "#FF8A3D", "#C86BFF"];

/** Hearts float up from the bottom-right whenever `hearts` increments. */
export function LiveOverlay({ hearts, bottom }: { hearts: number; bottom: number }) {
  const [items, setItems] = useState<{ id: number; color: string; dx: number }[]>([]);
  const prev = useRef(hearts);
  useEffect(() => {
    const added = hearts - prev.current;
    prev.current = hearts;
    if (added <= 0) {
      if (hearts === 0) setItems([]);
      return;
    }
    const fresh = Array.from({ length: Math.min(added, 4) }, (_, i) => ({
      id: hearts * 10 + i,
      color: HEART_COLORS[Math.floor(Math.random() * HEART_COLORS.length)],
      dx: Math.random() * 30 - 15,
    }));
    setItems((cur) => [...cur, ...fresh].slice(-10));
  }, [hearts]);
  return (
    <View pointerEvents="none" style={[styles.heartsLane, { bottom }]}>
      {items.map((h, i) => (
        <FloatingHeart
          key={h.id}
          color={h.color}
          dx={h.dx}
          delay={i % 4}
          onDone={() => setItems((cur) => cur.filter((x) => x.id !== h.id))}
        />
      ))}
    </View>
  );
}

function FloatingHeart({ color, dx, delay, onDone }: { color: string; dx: number; delay: number; onDone: () => void }) {
  const t = useSharedValue(0);
  useEffect(() => {
    const id = setTimeout(onDone, 2200 + delay * 120);
    t.value = withTiming(1, { duration: 2000 + delay * 120, easing: Easing.out(Easing.quad) });
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const st = useAnimatedStyle(() => ({
    opacity: t.value < 0.1 ? t.value * 10 : 1 - Math.max(0, (t.value - 0.55) / 0.45),
    transform: [
      { translateY: -230 * t.value },
      { translateX: dx * Math.sin(t.value * 6) },
      { scale: 0.6 + Math.min(1, t.value * 4) * 0.5 },
    ],
  }));
  return (
    <Animated.View style={[styles.heart, st]}>
      <Ionicons name="heart" size={26} color={color} />
    </Animated.View>
  );
}

export function LiveFeed(p: SceneProps) {
  const { scenario: s, lang, scripted } = p;
  const pinned = [...p.messages].reverse().find((m) => m.kind === "beat" && m.pin);
  const stream = p.messages.slice(scripted ? -3 : -5);

  return (
    <View style={{ gap: 8, maxHeight: p.maxHeight, justifyContent: "flex-end" }}>
      {pinned && !scripted && (
        <Animated.View key={pinned.key} entering={FadeInDown.duration(260)} style={styles.pinned}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 3 }}>
            <Ionicons name="pin" size={12} color={SCENE.yellow} />
            <Text style={styles.pinnedLabel}>{lang === "en" ? "Pinned question" : "Закреплённый вопрос"}</Text>
          </View>
          <Text style={styles.pinnedText} numberOfLines={2}>
            <Text style={{ fontFamily: "Geologica_700Bold" }}>{pinned.name} </Text>
            {pinned.text}
          </Text>
        </Animated.View>
      )}

      {p.awaitingOpening && !scripted && (
        <Animated.View entering={FadeInDown} style={styles.hint}>
          <Ionicons name="radio" size={13} color={SCENE.onYellow} />
          <Text style={styles.hintText}>{lang === "en" ? "You're live! " : "Ты в эфире! "}{lt(s.openingHint, lang)}</Text>
        </Animated.View>
      )}

      <View style={{ maxHeight: Math.max(80, p.maxHeight - (pinned && !scripted ? 120 : 52)), overflow: "hidden", justifyContent: "flex-end", gap: 6 }}>
      {stream.map((m) => {
        if (m.kind === "you") return null;
        const troll = m.tone === "troll";
        const important = m.kind === "beat" || m.kind === "ending";
        return (
          <Animated.View
            key={m.key}
            entering={FadeInDown.duration(240)}
            exiting={FadeOut.duration(180)}
            layout={LinearTransition.duration(200)}
            style={[styles.comment, important && styles.commentImportant, troll && styles.commentTroll]}
          >
            <Avatar emoji={m.avatar} size={24} />
            <View style={{ flexShrink: 1 }}>
              <Text style={styles.commentText}>
                <Text style={styles.nick}>{m.name} </Text>
                {m.text}
              </Text>
              {important && !scripted && <GoalTag scenario={s} beatIndex={m.beatIndex} lang={lang} />}
            </View>
          </Animated.View>
        );
      })}

      {p.typing && !scripted && (
        <View style={[styles.comment, { opacity: 0.8 }]}>
          <Avatar emoji="💬" size={24} />
          <TypingDots />
        </View>
      )}
      </View>

      {/* Fake comment input — pure decoration, never focusable. */}
      <View style={styles.inputRow} pointerEvents="none">
        <View style={styles.input}>
          <Text style={styles.inputText}>{lang === "en" ? "Add a comment…" : "Комментарий…"}</Text>
        </View>
        <Ionicons name="heart-outline" size={22} color="#fff" />
        <Ionicons name="paper-plane-outline" size={21} color="#fff" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  livePill: { flexDirection: "row", alignItems: "center", borderRadius: 7, overflow: "hidden", backgroundColor: "#00000080" },
  liveText: {
    color: "#fff", fontFamily: "Geologica_800ExtraBold", fontSize: 12, letterSpacing: 0.8,
    backgroundColor: "#FF2D55", paddingHorizontal: 8, paddingVertical: 5,
  },
  liveTime: { color: "#fff", fontFamily: MONO, fontWeight: "700", fontSize: 12, paddingHorizontal: 7 },
  viewersPill: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#00000080", borderRadius: 7, paddingHorizontal: 8, paddingVertical: 5 },
  viewersText: { color: "#fff", fontFamily: "Geologica_700Bold", fontSize: 12 },

  heartsLane: { position: "absolute", right: 16, width: 44, height: 260, alignItems: "center", justifyContent: "flex-end" },
  heart: { position: "absolute", bottom: 0 },

  pinned: { backgroundColor: "rgba(255,255,255,0.14)", borderRadius: 14, paddingHorizontal: 11, paddingVertical: 8, borderLeftWidth: 3, borderLeftColor: SCENE.yellow, marginRight: 56 },
  pinnedLabel: { color: SCENE.yellow, fontFamily: "Geologica_700Bold", fontSize: 10, letterSpacing: 0.5, textTransform: "uppercase" },
  pinnedText: { color: SCENE.text, fontFamily: "Geologica_500Medium", fontSize: 13, lineHeight: 18 },

  hint: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: SCENE.yellow, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6, maxWidth: "88%" },
  hintText: { color: SCENE.onYellow, fontFamily: "Geologica_600SemiBold", fontSize: 12, flexShrink: 1 },

  comment: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginRight: 56, paddingVertical: 2 },
  commentImportant: { backgroundColor: "rgba(0,0,0,0.45)", borderRadius: 12, paddingHorizontal: 8, paddingVertical: 6 },
  commentTroll: { backgroundColor: SCENE.troll },
  commentText: { color: SCENE.text, fontFamily: "Geologica_400Regular", fontSize: 13, lineHeight: 18, textShadowColor: "rgba(0,0,0,0.6)", textShadowRadius: 3 },
  nick: { fontFamily: "Geologica_700Bold", color: "#fff" },

  inputRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 2 },
  input: { flex: 1, height: 36, borderRadius: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.45)", justifyContent: "center", paddingHorizontal: 14 },
  inputText: { color: "rgba(255,255,255,0.7)", fontFamily: "Geologica_400Regular", fontSize: 13 },
});
