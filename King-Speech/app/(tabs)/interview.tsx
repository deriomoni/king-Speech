import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  Dimensions,
  ScrollView,
  Alert,
} from "react-native";
import { useTheme } from "@/context/ThemeContext";
import { getInterviewPalette } from "@/lib/interviewPalette";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  withSpring,
  withRepeat,
  cancelAnimation,
  Easing,
  FadeIn,
  FadeInUp,
  FadeOut,
  ZoomIn,
  SlideInUp,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { getApiUrl } from "@/lib/query-client";
import { useJennyVoice } from "@/hooks/useJennyVoice";
import { usePremium } from "@/hooks/usePremium";
import JennyPaywall from "@/components/JennyPaywall";
import { useGame, type LevelType } from "@/context/GameContext";
import { useLang, Lang } from "@/context/LangContext";
import JennyAvatar from "@/components/JennyAvatar";

const { width: SW, height: SH } = Dimensions.get("window");
const MAX_SKIPS     = 4;
const MAX_QUESTIONS = 5;
const REACTION_TIME = 10;
const ANSWER_TIME   = 60;
const XP_PENALTY    = 5;
const MAX_DAILY     = 2;

let Audio: any = null;
if (Platform.OS !== "web") {
  Audio = require("expo-av").Audio;
}

type MacroPhase = "lobby" | "loading" | "greeting" | "active" | "scored" | "finished" | "expired";
type Phase      = "idle" | "waiting" | "recording" | "processing";
type AvatarState = "idle" | "speaking" | "listening" | "thinking" | "reacting" | "positive" | "negative" | "outraged";

type InterviewStatus = false | "done" | "lost";
interface DailyPlan {
  topics: string[];
  dateKey: string;
  used: InterviewStatus[];
}

interface LastScore {
  grammar: number;
  diction: number;
  feedback: string;
  transcript: string;
  transition: string;
}
interface AnswerRecord {
  question: string;
  transcript: string;
  audioUrl?: string;
}
interface FinalSummary {
  strengths: string[];
  weaknesses: string[];
  closing: string;
}

// Sonic Minimalism — Jenny / Interview tokens. Dark canvas everywhere.
const ACCENT      = "#9468FB";
const ACCENT_DEEP = "#6A4FF4";
const ACCENT_SOFT = "rgba(148,104,251,0.16)";
const GREEN       = "#34C785";
const RED         = "#9468FB"; // alert mapped onto the brand purple — no red anywhere
const WARM        = "#0E0E10";
const CARD_BG     = "rgba(255,255,255,0.05)";
const TEXT_PRIMARY = "#FFFFFF";
const TEXT_SEC     = "rgba(255,255,255,0.65)";
const GLASS_INT   = 40;

const QUESTION_COLORS = ["#9468FB", "#34C785", "#FFCF34", "#BECBEB", "#FCF6E6"];

function GlassCard({
  children,
  style,
  palette,
}: {
  children: React.ReactNode;
  style?: any;
  palette: ReturnType<typeof getInterviewPalette>;
}) {
  return (
    <View
      style={[
        gc.wrap,
        { borderColor: palette.glassBorder, backgroundColor: palette.cardBg },
        style,
      ]}
    >
      {Platform.OS === "web" ? (
        <View
          style={[StyleSheet.absoluteFill, { backgroundColor: palette.cardBg }]}
        />
      ) : (
        <BlurView
          intensity={GLASS_INT}
          tint={palette.glassTint}
          style={StyleSheet.absoluteFill}
        />
      )}
      {children}
    </View>
  );
}
const gc = StyleSheet.create({
  wrap: {
    borderRadius: 28,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  webFallback: { backgroundColor: "rgba(255,255,255,0.05)" },
});

function WaveBar({ delay, active }: { delay: number; active: boolean }) {
  const h = useSharedValue(3);
  useEffect(() => {
    if (active) {
      h.value = withRepeat(
        withSequence(
          withTiming(3 + Math.random() * 18, { duration: 220 + delay }),
          withTiming(3, { duration: 220 + delay }),
        ), -1, false
      );
    } else {
      cancelAnimation(h);
      h.value = withTiming(3, { duration: 200 });
    }
  }, [active]);
  const style = useAnimatedStyle(() => ({ height: h.value }));
  return <Animated.View style={[wv.bar, style]} />;
}
function Waveform({ active }: { active: boolean }) {
  return (
    <View style={wv.row}>
      {Array.from({ length: 20 }).map((_, i) => <WaveBar key={i} delay={i * 18} active={active} />)}
    </View>
  );
}
const wv = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 3, height: 28, justifyContent: "center" },
  bar: { width: 3, borderRadius: 2, backgroundColor: GREEN },
});

function TimerDisplay({ type, seconds, t }: { type: "reaction" | "answer"; seconds: number | null; t: (k: any) => string }) {
  const scaleV = useSharedValue(1);
  useEffect(() => {
    if (seconds !== null && type === "reaction" && seconds <= 5) {
      scaleV.value = withSequence(
        withTiming(1.1, { duration: 100 }),
        withTiming(1, { duration: 100 }),
      );
    }
  }, [seconds]);
  const scaleStyle = useAnimatedStyle(() => ({ transform: [{ scale: scaleV.value }] }));
  if (seconds === null) return null;

  if (type === "reaction") {
    const urgent = seconds <= 5;
    const color = urgent ? RED : ACCENT;
    return (
      <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)} style={td.reactionWrap}>
        <Text style={[td.reactionLabel, { fontFamily: "Inter_400Regular" }]}>
          {t("pressSpeak")}
        </Text>
        <Animated.View style={[td.circleWrap, scaleStyle]}>
          <View style={[td.circle, { borderColor: color }]}>
            <Text style={[td.circleNum, { color, fontFamily: "Inter_700Bold" }]}>{seconds}</Text>
          </View>
        </Animated.View>
      </Animated.View>
    );
  }

  const urgent = seconds <= 15;
  const color = urgent ? RED : GREEN;
  const pct = seconds / ANSWER_TIME;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return (
    <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)} style={td.answerWrap}>
      <View style={td.answerTrack}>
        <Animated.View style={[td.answerFill, { width: `${pct * 100}%` as any, backgroundColor: color }]} />
      </View>
      <Text style={[td.answerTime, { color, fontFamily: "Inter_600SemiBold" }]}>
        {mins}:{secs.toString().padStart(2, "0")}
      </Text>
    </Animated.View>
  );
}
const td = StyleSheet.create({
  reactionWrap: { alignItems: "center", paddingVertical: 4, gap: 4 },
  reactionLabel: { fontSize: 12, color: TEXT_SEC, letterSpacing: 0.3 },
  circleWrap: { width: 46, height: 46, alignItems: "center", justifyContent: "center" },
  circle: { width: 46, height: 46, borderRadius: 23, borderWidth: 2.5, alignItems: "center", justifyContent: "center" },
  circleNum: { fontSize: 20, lineHeight: 24 },
  answerWrap: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 2 },
  answerTrack: { flex: 1, height: 4, borderRadius: 2, backgroundColor: "rgba(0,0,0,0.06)", overflow: "hidden" },
  answerFill: { height: 4, borderRadius: 2 },
  answerTime: { fontSize: 13, minWidth: 34, textAlign: "right" },
});

const DAILY_STORAGE_PREFIX = "@kingspeech_interview_daily_";
const COOLDOWN_STORAGE_KEY = "@kingspeech_interview_cooldown";
const COOLDOWN_MS = 24 * 60 * 60 * 1000;

const DAILY_QUOTES: Record<Lang, string[]> = {
  ru: [
    "Слово сильнее меча.",
    "Краткость - сестра таланта.",
    "Голос раскрывает характер.",
    "Тишина - тоже речь.",
    "Простота - высшая изысканность.",
    "Мастерство приходит с практикой.",
    "Уверенность рождается из подготовки.",
    "Каждый день - шанс расти.",
    "Действие сильнее слов.",
    "Слушай прежде чем говорить.",
    "Ясность - вежливость мастера.",
    "Слова - ключи к сердцам.",
    "Речь лучше мёда.",
    "Говори мало, но правду.",
    "Великие мысли из сердца.",
    "Сила в каждом слове.",
    "Смелость красит оратора.",
    "Голос - твой инструмент.",
    "Дыхание - основа речи.",
    "Паузы создают смысл.",
    "Интонация решает всё.",
    "Практика рождает мастерство.",
    "Каждое слово имеет вес.",
    "Речь - зеркало души.",
    "Будь собой на сцене.",
    "Искренность покоряет слушателя.",
    "Говори с душой.",
    "Твой голос - твоя сила.",
    "Говори ясно и кратко.",
    "Осанка - часть голоса.",
    "Вдохновение - рабочее состояние.",
  ],
  en: [
    "Words cut deeper than swords.",
    "Brevity is the soul of wit.",
    "Your voice reveals character.",
    "Silence is also speech.",
    "Simplicity is elegance.",
    "Mastery comes with practice.",
    "Confidence is born of preparation.",
    "Every day is a chance to grow.",
    "Actions speak louder than words.",
    "Listen before you speak.",
    "Clarity is the master's courtesy.",
    "Words are keys to hearts.",
    "Speech is sweeter than honey.",
    "Speak little, but speak truth.",
    "Great thoughts come from the heart.",
    "Power lives in every word.",
    "Courage adorns the speaker.",
    "Your voice is your instrument.",
    "Breath is the foundation of speech.",
    "Pauses create meaning.",
    "Intonation changes everything.",
    "Practice breeds mastery.",
    "Every word carries weight.",
    "Speech mirrors the soul.",
    "Be yourself on stage.",
    "Sincerity wins the listener.",
    "Speak from the heart.",
    "Your voice is your power.",
    "Speak clearly and concisely.",
    "Posture is part of voice.",
    "Inspiration is a work state.",
  ],
};

function getLobbyRecs(t: (k: any) => string) {
  return [
    { icon: "restaurant-outline" as const, text: t("lobbyRec1") },
    { icon: "heart-outline" as const, text: t("lobbyRec2") },
    { icon: "chatbubble-ellipses-outline" as const, text: t("lobbyRec3") },
  ];
}
function getLobbyTips(t: (k: any) => string) {
  return [
    { icon: "body-outline" as const, text: t("lobbyTip1") },
    { icon: "volume-high-outline" as const, text: t("lobbyTip2") },
    { icon: "timer-outline" as const, text: t("lobbyTip3") },
    { icon: "mic-outline" as const, text: t("lobbyTip4") },
  ];
}

function CooldownTimer({ onExpired }: { onExpired: () => void }) {
  const { t } = useLang();
  const [remaining, setRemaining] = useState<number | null>(null);
  const pulseScale = useSharedValue(1);

  useEffect(() => {
    pulseScale.value = withRepeat(withSequence(withTiming(1.03, { duration: 1200 }), withTiming(1, { duration: 1200 })), -1, true);
  }, []);
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulseScale.value }] }));

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const stored = await AsyncStorage.getItem(COOLDOWN_STORAGE_KEY);
        if (!stored) { onExpired(); return; }
        const endTime = parseInt(stored, 10);
        const diff = endTime - Date.now();
        if (diff <= 0) {
          await AsyncStorage.removeItem(COOLDOWN_STORAGE_KEY);
          if (mounted) onExpired();
          return;
        }
        if (mounted) setRemaining(diff);
      } catch { if (mounted) onExpired(); }
    };
    load();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (remaining === null) return;
    if (remaining <= 0) {
      AsyncStorage.removeItem(COOLDOWN_STORAGE_KEY);
      onExpired();
      return;
    }
    const interval = setInterval(() => {
      setRemaining(prev => {
        if (prev === null) return null;
        const next = prev - 1000;
        if (next <= 0) {
          clearInterval(interval);
          AsyncStorage.removeItem(COOLDOWN_STORAGE_KEY);
          setTimeout(onExpired, 100);
          return 0;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [remaining !== null]);

  if (remaining === null || remaining <= 0) return null;

  const hrs = Math.floor(remaining / 3600000);
  const mins = Math.floor((remaining % 3600000) / 60000);
  const secs = Math.floor((remaining % 60000) / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <Animated.View entering={FadeIn.duration(500)} style={cdS.wrap}>
      <LinearGradient colors={["#1A1A2E", "#2D1B4E"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: 22 }]} />
      <View style={cdS.top}>
        <View style={cdS.iconWrap}>
          <Ionicons name="time-outline" size={20} color={ACCENT} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[cdS.doneLabel, { fontFamily: "Inter_600SemiBold" }]}>{t("allInterviewsDone")}</Text>
          <Text style={[cdS.nextLabel, { fontFamily: "Inter_400Regular" }]}>{t("nextInterviewIn")}</Text>
        </View>
      </View>
      <Animated.View style={[cdS.timerRow, pulseStyle]}>
        {[pad(hrs), pad(mins), pad(secs)].map((v, i) => (
          <React.Fragment key={i}>
            {i > 0 && <Text style={[cdS.colon, { fontFamily: "Inter_400Regular" }]}>:</Text>}
            <View style={cdS.digitBox}>
              <Text style={[cdS.digit, { fontFamily: "Inter_700Bold" }]}>{v}</Text>
            </View>
          </React.Fragment>
        ))}
      </Animated.View>
    </Animated.View>
  );
}
const cdS = StyleSheet.create({
  wrap: { borderRadius: 22, padding: 20, gap: 16, overflow: "hidden" },
  top: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconWrap: { width: 40, height: 40, borderRadius: 20, backgroundColor: ACCENT + "18", alignItems: "center", justifyContent: "center" },
  doneLabel: { fontSize: 14, color: "#fff" },
  nextLabel: { fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 2 },
  timerRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  digitBox: { backgroundColor: "rgba(108,99,255,0.15)", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, minWidth: 52, alignItems: "center", borderWidth: 1, borderColor: "rgba(108,99,255,0.2)" },
  digit: { fontSize: 28, color: "#fff", letterSpacing: 2 },
  colon: { fontSize: 28, color: "rgba(255,255,255,0.35)", marginHorizontal: 2 },
});

function LobbyScreen({ plan, onStart, topPad, bottomPad, onCooldownExpired }: {
  plan: DailyPlan; onStart: (idx: number) => void; topPad: number; bottomPad: number; onCooldownExpired: () => void;
}) {
  const { t } = useLang();
  const { themeMode } = useTheme();
  const palette = getInterviewPalette(themeMode);
  const remaining = plan.used.filter(u => u === false).length;
  const allUsed = remaining === 0;
  const [cooldownActive, setCooldownActive] = useState(false);

  useEffect(() => {
    if (allUsed) {
      AsyncStorage.getItem(COOLDOWN_STORAGE_KEY).then(stored => {
        if (stored) {
          const diff = parseInt(stored, 10) - Date.now();
          if (diff > 0) setCooldownActive(true);
        }
      });
    }
  }, [allUsed]);

  const LOBBY_RECS = getLobbyRecs(t);
  const LOBBY_TIPS = getLobbyTips(t);
  const nextIdx = plan.used.findIndex((u) => u === false);

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      {/* Ambient purple glow — radial decoration */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: -SH * 0.18,
          left: -SW * 0.2,
          width: SW * 1.2,
          height: SW * 1.2,
          borderRadius: SW * 0.6,
          backgroundColor: palette.glowA,
          ...(Platform.OS === "web" ? ({ filter: "blur(120px)" } as any) : { opacity: 0.35 }),
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          bottom: -SH * 0.12,
          right: -SW * 0.3,
          width: SW * 1.1,
          height: SW * 1.1,
          borderRadius: SW * 0.55,
          backgroundColor: palette.glowB,
          ...(Platform.OS === "web" ? ({ filter: "blur(120px)" } as any) : { opacity: 0.3 }),
        }}
      />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingTop: topPad + 24,
          paddingBottom: bottomPad + 120,
          gap: 28,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Editorial hero */}
        <View style={{ gap: 12 }}>
          <Text style={[lbS.kicker, { color: palette.textFaint }]}>
            {allUsed
              ? t("allInterviewsDone")
              : t("remainingOf", {
                  remaining: String(remaining),
                  max: String(MAX_DAILY),
                })}
          </Text>
          <Text style={[lbS.heroLine, { color: palette.text }]}>
            {t("interviewStudio")}{" "}
            <Text style={lbS.heroItalic}>Jenny</Text>
          </Text>
        </View>

        {/* Schedule glass card */}
        <GlassCard palette={palette} style={{ padding: 22, gap: 16 }}>
          <View style={lbS.planHeader}>
            <View style={lbS.planDot} />
            <Text style={[lbS.planTitle, { color: palette.textSec }]}>
              {t("scheduleToday")}
            </Text>
          </View>

          <View style={{ gap: 10 }}>
            {plan.topics.map((tp, i) => {
              const status = plan.used[i];
              const isUsed = status !== false;
              const isLost = status === "lost";
              const isNext = !isUsed && i === nextIdx;
              return (
                <Pressable
                  key={i}
                  onPress={() => {
                    if (isUsed || i !== nextIdx) return;
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onStart(nextIdx);
                  }}
                  disabled={isUsed || i !== nextIdx}
                  style={({ pressed }) => [
                    lbS.topicRow,
                    {
                      backgroundColor: palette.rowBg,
                      borderColor: palette.rowBorder,
                    },
                    isNext && {
                      backgroundColor: palette.rowBgActive,
                      borderColor: palette.accent + "59",
                    },
                    isUsed && lbS.topicRowMuted,
                    pressed && isNext && { opacity: 0.85 },
                  ]}
                >
                  <View
                    style={[
                      lbS.topicNum,
                      isNext && { backgroundColor: ACCENT_SOFT, borderColor: ACCENT },
                      isUsed && !isLost && { backgroundColor: "rgba(52,199,133,0.14)", borderColor: "rgba(52,199,133,0.35)" },
                      isLost && { backgroundColor: ACCENT_SOFT, borderColor: ACCENT },
                    ]}
                  >
                    {isLost ? (
                      <Ionicons name="close" size={14} color={ACCENT} />
                    ) : isUsed ? (
                      <Ionicons name="checkmark" size={14} color={GREEN} />
                    ) : (
                      <Text style={[lbS.topicNumTxt, { color: palette.text }]}>
                        {i + 1}
                      </Text>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        lbS.topicMeta,
                        { color: isUsed ? palette.textSec : palette.textFaint },
                      ]}
                    >
                      {t("interviewNofM", { n: String(i + 1), max: String(MAX_DAILY) })}
                    </Text>
                    <Text
                      style={[
                        lbS.topicName,
                        { color: isUsed ? palette.textSec : palette.text },
                      ]}
                      numberOfLines={2}
                    >
                      {tp}
                    </Text>
                  </View>
                  {isNext && (
                    <Ionicons name="arrow-forward" size={16} color={ACCENT} />
                  )}
                  {isUsed && !isLost && (
                    <View style={lbS.statusChipDone}>
                      <Text style={lbS.statusChipDoneTxt}>{t("passed")}</Text>
                    </View>
                  )}
                  {isLost && (
                    <View style={lbS.statusChipLost}>
                      <Text style={lbS.statusChipLostTxt}>{t("lost")}</Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        </GlassCard>

        {/* Tips & recs — single editorial card */}
        <GlassCard palette={palette} style={{ padding: 22, gap: 18 }}>
          <View>
            <Text style={[lbS.sectionLead, { color: palette.textSec }]}>
              {t("lobbyRecTitle")}
            </Text>
            <View style={{ height: 12 }} />
            {LOBBY_RECS.map((r, i) => (
              <View key={i} style={lbS.tipRow}>
                <View style={lbS.tipIconWrap}>
                  <Ionicons name={r.icon} size={14} color={ACCENT} />
                </View>
                <Text style={[lbS.tipText, { color: palette.text }]}>
                  {r.text}
                </Text>
              </View>
            ))}
          </View>
          <View style={[lbS.divider, { backgroundColor: palette.divider }]} />
          <View>
            <Text style={[lbS.sectionLead, { color: palette.textSec }]}>
              {t("lobbyTips")}
            </Text>
            <View style={{ height: 12 }} />
            {LOBBY_TIPS.map((tip, i) => (
              <View key={i} style={lbS.tipRow}>
                <View style={[lbS.tipIconWrap, { backgroundColor: "rgba(52,199,133,0.14)" }]}>
                  <Ionicons name={tip.icon} size={14} color={GREEN} />
                </View>
                <Text style={[lbS.tipText, { color: palette.text }]}>
                  {tip.text}
                </Text>
              </View>
            ))}
          </View>
        </GlassCard>

        {/* CTA — primary purple gradient. With cooldown, embed countdown inside. */}
        <Animated.View entering={FadeIn.delay(150).duration(360)}>
          <Pressable
            onPress={() => {
              if (allUsed || cooldownActive) return;
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              if (nextIdx >= 0) onStart(nextIdx);
            }}
            disabled={allUsed || cooldownActive}
            style={({ pressed }) => [
              lbS.startBtn,
              (allUsed || cooldownActive) && lbS.startBtnMuted,
              pressed && !allUsed && !cooldownActive && { opacity: 0.9 },
            ]}
          >
            {!allUsed && !cooldownActive && (
              <LinearGradient
                colors={[ACCENT, ACCENT_DEEP]}
                style={[StyleSheet.absoluteFill, { borderRadius: 32 }]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              />
            )}
            <View style={lbS.startBtnInner}>
              <Ionicons
                name={allUsed || cooldownActive ? "time-outline" : "mic"}
                size={20}
                color="#FFFFFF"
              />
              <Text style={lbS.startBtnTxt}>
                {cooldownActive
                  ? t("noInterviewsToday")
                  : allUsed
                  ? t("noInterviewsToday")
                  : t("startInterview")}
              </Text>
            </View>
          </Pressable>
          {allUsed && cooldownActive ? (
            <View style={{ marginTop: 12 }}>
              <CooldownTimer
                onExpired={() => {
                  setCooldownActive(false);
                  onCooldownExpired();
                }}
              />
            </View>
          ) : null}
        </Animated.View>
      </ScrollView>
    </View>
  );
}
const lbS = StyleSheet.create({
  kicker: {
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: "rgba(255,255,255,0.55)",
    fontFamily: "Nunito_400Regular",
  },
  heroLine: {
    fontSize: 52,
    lineHeight: 56,
    letterSpacing: -1.2,
    color: "#FFFFFF",
    fontFamily: "Rubik_600SemiBold",
  },
  heroItalic: {
    fontFamily: "Rubik_500Medium",
    color: ACCENT,
  },
  planHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  planDot: {
    width: 6, height: 6, borderRadius: 3, backgroundColor: ACCENT,
    shadowColor: ACCENT, shadowOpacity: 0.8, shadowRadius: 6, shadowOffset: { width: 0, height: 0 },
  },
  planTitle: {
    fontSize: 12,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: "rgba(255,255,255,0.65)",
    fontFamily: "Nunito_400Regular",
  },
  topicRow: {
    flexDirection: "row", alignItems: "center", gap: 14,
    paddingVertical: 14, paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.06)",
  },
  topicRowActive: {
    backgroundColor: "rgba(148,104,251,0.10)",
    borderColor: "rgba(148,104,251,0.35)",
  },
  topicRowMuted: { opacity: 0.55 },
  topicNum: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  topicNumTxt: { fontSize: 13, color: "#FFFFFF", fontFamily: "Nunito_700Bold" },
  topicMeta: {
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    fontFamily: "Nunito_400Regular",
  },
  topicName: {
    fontSize: 15, marginTop: 4, lineHeight: 20,
    fontFamily: "Nunito_400Regular",
  },
  statusChipDone: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10,
    backgroundColor: "rgba(52,199,133,0.14)",
  },
  statusChipDoneTxt: { fontSize: 10, color: GREEN, fontFamily: "Nunito_700Bold", letterSpacing: 0.6 },
  statusChipLost: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10,
    backgroundColor: ACCENT_SOFT,
  },
  statusChipLostTxt: { fontSize: 10, color: ACCENT, fontFamily: "Nunito_700Bold", letterSpacing: 0.6 },
  sectionLead: {
    fontSize: 12,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: "rgba(255,255,255,0.65)",
    fontFamily: "Nunito_400Regular",
  },
  tipRow: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 6 },
  tipIconWrap: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: ACCENT_SOFT,
    alignItems: "center", justifyContent: "center",
  },
  tipText: {
    flex: 1, fontSize: 14, lineHeight: 20,
    color: "rgba(255,255,255,0.82)",
    fontFamily: "Nunito_400Regular",
  },
  divider: { height: 1, backgroundColor: "rgba(255,255,255,0.08)" },
  startBtn: {
    height: 64, borderRadius: 32, overflow: "hidden",
    alignItems: "center", justifyContent: "center",
    shadowColor: ACCENT, shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4, shadowRadius: 24, elevation: 10,
  },
  startBtnInner: { flexDirection: "row", alignItems: "center", gap: 12 },
  startBtnTxt: {
    fontSize: 17, color: "#FFFFFF",
    fontFamily: "Nunito_700Bold", letterSpacing: -0.1,
  },
  startBtnMuted: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.10)",
    shadowOpacity: 0, elevation: 0,
  },
});

function ScoreReveal({ score }: { score: LastScore | null }) {
  const { t } = useLang();
  const { themeMode } = useTheme();
  if (!score) return null;
  const total = score.grammar + score.diction;
  const color = total >= 8 ? GREEN : total >= 5 ? "#F5A623" : RED;
  const palette = getInterviewPalette(themeMode);
  const label = total >= 8 ? t("excellentScore") : total >= 5 ? t("goodScore") : t("weakScore");
  return (
    <Animated.View entering={FadeInUp.duration(400)} exiting={FadeOut.duration(250)}>
      <GlassCard palette={palette} style={[scS.card, { borderColor: color + "30" }]}>
        {score.transition ? (
          <Text
            style={[
              scS.transition,
              { color: palette.textSec, fontFamily: "Inter_500Medium" },
            ]}
          >
            {score.transition}
          </Text>
        ) : null}
        <View style={scS.row}>
          <View style={[scS.badge, { borderColor: color + "25", backgroundColor: color + "08" }]}>
            <Text style={[scS.badgeNum, { color, fontFamily: "Inter_700Bold" }]}>{score.grammar}</Text>
            <Text
              style={[
                scS.badgeLbl,
                { color: palette.textSec, fontFamily: "Inter_400Regular" },
              ]}
            >
              {t("grammar")}
            </Text>
          </View>
          <View style={[scS.badge, { borderColor: color + "25", backgroundColor: color + "08" }]}>
            <Text style={[scS.badgeNum, { color, fontFamily: "Inter_700Bold" }]}>{score.diction}</Text>
            <Text
              style={[
                scS.badgeLbl,
                { color: palette.textSec, fontFamily: "Inter_400Regular" },
              ]}
            >
              {t("diction")}
            </Text>
          </View>
          <View style={[scS.totalBadge, { backgroundColor: color + "15", borderColor: color + "30" }]}>
            <Text style={[scS.totalNum, { color, fontFamily: "Inter_700Bold" }]}>{total}/10</Text>
            <Text style={[scS.totalLabel, { color, fontFamily: "Inter_600SemiBold" }]}>{label}</Text>
          </View>
        </View>
        {score.transcript ? (
          <View style={scS.transcriptRow}>
            <Ionicons name="chatbubble-outline" size={12} color={TEXT_SEC} />
            <Text
              style={[
                scS.transcriptTxt,
                { color: palette.textSec, fontFamily: "Inter_400Regular" },
              ]}
            >
              {score.transcript}
            </Text>
          </View>
        ) : null}
        {score.feedback ? (
          <View style={scS.feedbackRow}>
            <Ionicons name="bulb-outline" size={12} color={color} />
            <Text
              style={[
                scS.feedback,
                { color: palette.textSec, fontFamily: "Inter_400Regular" },
              ]}
            >
              {score.feedback}
            </Text>
          </View>
        ) : null}
      </GlassCard>
    </Animated.View>
  );
}
const scS = StyleSheet.create({
  card: { padding: 14, gap: 10, backgroundColor: "transparent" },
  transition: { fontSize: 13, color: TEXT_SEC, textAlign: "center", fontStyle: "italic" },
  row: { flexDirection: "row", gap: 8, justifyContent: "center" },
  badge: { flex: 1, alignItems: "center", padding: 10, borderRadius: 14, borderWidth: 1 },
  badgeNum: { fontSize: 22 },
  badgeLbl: { fontSize: 10, color: TEXT_SEC, marginTop: 3 },
  totalBadge: { flex: 1, alignItems: "center", justifyContent: "center", padding: 10, borderRadius: 14, borderWidth: 1.5 },
  totalNum: { fontSize: 18 },
  totalLabel: { fontSize: 10, marginTop: 2, letterSpacing: 0.5 },
  transcriptRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: "rgba(0,0,0,0.03)", borderRadius: 10, padding: 10 },
  transcriptTxt: { flex: 1, fontSize: 13, lineHeight: 19, color: TEXT_SEC, fontStyle: "italic" },
  feedbackRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  feedback: { flex: 1, fontSize: 12, lineHeight: 18, color: TEXT_SEC },
});

function MicButton({ phase, onPress, disabled, t }: { phase: Phase; onPress: () => void; disabled?: boolean; t: (k: any) => string }) {
  const scale = useSharedValue(1);
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (phase === "recording") {
      pulse.value = withRepeat(
        withSequence(withTiming(1.25, { duration: 700 }), withTiming(1, { duration: 700 })),
        -1, false
      );
    } else {
      cancelAnimation(pulse);
      pulse.value = withSpring(1);
    }
  }, [phase]);

  const press = () => {
    scale.value = withSequence(withTiming(0.88, { duration: 80 }), withSpring(1, { damping: 12 }));
    Haptics.impactAsync(phase === "recording" ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Medium);
    onPress();
  };

  const scStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }], opacity: phase === "recording" ? 0.2 : 0 }));

  const isRec = phase === "recording";
  const isProc = phase === "processing";

  const btnColor = isRec ? RED : ACCENT;
  return (
    <View style={mbS.wrap}>
      <Animated.View style={[mbS.pulse, { backgroundColor: btnColor }, pulseStyle]} />
      <Animated.View style={scStyle}>
        <Pressable
          onPress={press}
          disabled={isProc || disabled}
          style={[mbS.btn, {
            backgroundColor: btnColor,
            opacity: disabled && !isRec ? 0.5 : 1,
            shadowColor: btnColor,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.35,
            shadowRadius: 10,
            elevation: 8,
          }]}
        >
          {isProc
            ? <AnimatedDots color="#FFF" />
            : <Ionicons name={isRec ? "stop" : "mic"} size={28} color="#FFF" />
          }
        </Pressable>
      </Animated.View>
      <Text style={[mbS.label, { fontFamily: "Inter_500Medium" }]}>
        {isRec ? t("stopRecording") : isProc ? t("processingAudio") : t("speak")}
      </Text>
    </View>
  );
}
const mbS = StyleSheet.create({
  wrap: { alignItems: "center", gap: 6 },
  pulse: { position: "absolute", width: 72, height: 72, borderRadius: 36 },
  btn: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center", elevation: 6 },
  label: { fontSize: 12, color: TEXT_SEC },
});

function SkipButton({ skipCount, onPress, disabled, t }: { skipCount: number; onPress: () => void; disabled: boolean; t: (k: any) => string }) {
  const remaining = MAX_SKIPS - skipCount;
  return (
    <Pressable
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress(); }}
      disabled={disabled}
      style={({ pressed }) => [skpS.btn, { opacity: disabled ? 0.35 : pressed ? 0.7 : 1 }]}
    >
      <Ionicons name="shuffle-outline" size={15} color={TEXT_SEC} />
      <Text style={[skpS.label, { fontFamily: "Inter_400Regular" }]}>{t("anotherQuestion")}</Text>
      <View style={skpS.badge}>
        <Text style={[skpS.badgeTxt, { fontFamily: "Inter_700Bold" }]}>{remaining}</Text>
      </View>
    </Pressable>
  );
}
const skpS = StyleSheet.create({
  btn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, backgroundColor: "rgba(0,0,0,0.04)", borderWidth: 1, borderColor: "rgba(0,0,0,0.06)" },
  label: { fontSize: 13, color: TEXT_SEC },
  badge: { width: 20, height: 20, borderRadius: 10, backgroundColor: "rgba(0,0,0,0.06)", alignItems: "center", justifyContent: "center" },
  badgeTxt: { fontSize: 11, color: TEXT_SEC },
});

function ViolationPopup({ visible, onDismiss, t }: { visible: boolean; onDismiss: () => void; t: (k: any) => string }) {
  const scaleV = useSharedValue(0.8);
  const opV = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      opV.value = withTiming(1, { duration: 300 });
      scaleV.value = withSpring(1, { damping: 14 });
    }
  }, [visible]);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: opV.value }));
  const cardStyle = useAnimatedStyle(() => ({ transform: [{ scale: scaleV.value }], opacity: opV.value }));

  if (!visible) return null;

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 100, alignItems: "center", justifyContent: "center" }]}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.4)" }, overlayStyle]} />
      <Animated.View style={[vpS.card, cardStyle]}>
        {Platform.OS === "web" ? (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(255,255,255,0.95)", borderRadius: 24 }]} />
        ) : (
          <BlurView intensity={90} tint="light" style={[StyleSheet.absoluteFill, { borderRadius: 24, overflow: "hidden" }]} />
        )}
        <View style={vpS.iconWrap}>
          <Ionicons name="warning" size={36} color={RED} />
        </View>
        <Text style={[vpS.title, { fontFamily: "Inter_700Bold" }]}>{t("interviewTerminated")}</Text>
        <Text style={[vpS.message, { fontFamily: "Inter_400Regular" }]}>
          {t("violationMessage")}
        </Text>
        <View style={vpS.xpBadge}>
          <Ionicons name="arrow-down" size={15} color={RED} />
          <Text style={[vpS.xpText, { fontFamily: "Inter_700Bold" }]}>-{XP_PENALTY} XP</Text>
        </View>
        <Pressable
          onPress={onDismiss}
          style={({ pressed }) => [vpS.dismissBtn, { opacity: pressed ? 0.8 : 1 }]}
        >
          <Text style={[vpS.dismissText, { fontFamily: "Inter_600SemiBold" }]}>{t("ok")}</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}
const vpS = StyleSheet.create({
  card: { width: SW - 48, borderRadius: 24, padding: 28, alignItems: "center", gap: 14, overflow: "hidden" },
  iconWrap: { width: 68, height: 68, borderRadius: 34, backgroundColor: "rgba(14,165,233,0.1)", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "rgba(14,165,233,0.2)" },
  title: { fontSize: 20, color: TEXT_PRIMARY, textAlign: "center", zIndex: 1 },
  message: { fontSize: 14, lineHeight: 22, color: TEXT_SEC, textAlign: "center", zIndex: 1 },
  xpBadge: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(14,165,233,0.1)", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, zIndex: 1 },
  xpText: { fontSize: 18, color: RED },
  dismissBtn: { marginTop: 4, paddingHorizontal: 36, paddingVertical: 12, borderRadius: 14, backgroundColor: "rgba(0,0,0,0.05)", zIndex: 1 },
  dismissText: { fontSize: 15, color: TEXT_SEC },
});

function PulsingRing({ size, delay, color }: { size: number; delay: number; color: string }) {
  const scale = useSharedValue(0.85);
  const opacity = useSharedValue(0.3);
  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.15, { duration: 2200 + delay * 200, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.85, { duration: 2200 + delay * 200, easing: Easing.inOut(Easing.ease) }),
      ), -1, false
    );
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.6, { duration: 2200 + delay * 200, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.15, { duration: 2200 + delay * 200, easing: Easing.inOut(Easing.ease) }),
      ), -1, false
    );
  }, []);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));
  return (
    <Animated.View style={[{
      position: "absolute", width: size, height: size, borderRadius: size / 2,
      borderWidth: 1.5, borderColor: color,
    }, style]} />
  );
}

function AnimatedDots({ color = ACCENT }: { color?: string }) {
  const d1 = useSharedValue(0.3);
  const d2 = useSharedValue(0.3);
  const d3 = useSharedValue(0.3);
  useEffect(() => {
    d1.value = withRepeat(withSequence(withTiming(1, { duration: 400 }), withTiming(0.3, { duration: 400 })), -1, false);
    const t2 = setTimeout(() => {
      d2.value = withRepeat(withSequence(withTiming(1, { duration: 400 }), withTiming(0.3, { duration: 400 })), -1, false);
    }, 150);
    const t3 = setTimeout(() => {
      d3.value = withRepeat(withSequence(withTiming(1, { duration: 400 }), withTiming(0.3, { duration: 400 })), -1, false);
    }, 300);
    return () => { clearTimeout(t2); clearTimeout(t3); cancelAnimation(d1); cancelAnimation(d2); cancelAnimation(d3); };
  }, []);
  const s1 = useAnimatedStyle(() => ({ opacity: d1.value }));
  const s2 = useAnimatedStyle(() => ({ opacity: d2.value }));
  const s3 = useAnimatedStyle(() => ({ opacity: d3.value }));
  return (
    <View style={{ flexDirection: "row", gap: 5 }}>
      <Animated.View style={[{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: color }, s1]} />
      <Animated.View style={[{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: color }, s2]} />
      <Animated.View style={[{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: color }, s3]} />
    </View>
  );
}

function FloatingBlob({ x, y, size, color, delay }: { x: number; y: number; size: number; color: string; delay: number }) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(0.9);
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 1200 });
    translateX.value = withRepeat(
      withSequence(
        withTiming(12 + delay * 3, { duration: 4000 + delay * 500, easing: Easing.inOut(Easing.ease) }),
        withTiming(-12 - delay * 3, { duration: 4000 + delay * 500, easing: Easing.inOut(Easing.ease) }),
      ), -1, true
    );
    translateY.value = withRepeat(
      withSequence(
        withTiming(-10 - delay * 2, { duration: 3500 + delay * 400, easing: Easing.inOut(Easing.ease) }),
        withTiming(10 + delay * 2, { duration: 3500 + delay * 400, easing: Easing.inOut(Easing.ease) }),
      ), -1, true
    );
    scale.value = withRepeat(
      withSequence(
        withTiming(1.15, { duration: 3000 + delay * 300, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.85, { duration: 3000 + delay * 300, easing: Easing.inOut(Easing.ease) }),
      ), -1, true
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[{
      position: "absolute", left: x - size / 2, top: y - size / 2,
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: color,
    }, style]} />
  );
}

function FloatingParticle({ screenW, screenH, delay }: { screenW: number; screenH: number; delay: number }) {
  const x = Math.random() * screenW;
  const startY = Math.random() * screenH;
  const particleSize = 1.2 + Math.random() * 2;
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withTiming(0.03 + Math.random() * 0.06, { duration: 800 });
    translateY.value = withRepeat(
      withTiming(-screenH, { duration: 8000 + delay * 2000, easing: Easing.linear }),
      -1, false
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[{
      position: "absolute", left: x, top: startY,
      width: particleSize, height: particleSize, borderRadius: particleSize / 2,
      backgroundColor: "rgba(200,170,255,0.8)",
    }, style]} />
  );
}

function SpinnerRing() {
  const rotation = useSharedValue(0);
  const glowPulse = useSharedValue(0.5);
  const orbPulse = useSharedValue(0.18);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 2800, easing: Easing.linear }), -1, false
    );
    glowPulse.value = withRepeat(
      withSequence(
        withTiming(0.9, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.5, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
      ), -1, true
    );
    orbPulse.value = withRepeat(
      withSequence(
        withTiming(0.35, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.12, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
      ), -1, true
    );
  }, []);

  const ringRotation = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glowPulse.value }));
  const orbStyle = useAnimatedStyle(() => ({ opacity: orbPulse.value }));

  const RING_SIZE = 110;
  const ARC_RADIUS = 38;

  return (
    <View style={{ width: RING_SIZE, height: RING_SIZE, alignItems: "center", justifyContent: "center" }}>
      <Animated.View style={[{
        position: "absolute", width: 150, height: 150, borderRadius: 75,
        backgroundColor: "rgba(120,60,220,0.2)",
      }, glowStyle]} />

      <View style={{
        position: "absolute", width: 96, height: 96, borderRadius: 48,
        backgroundColor: "rgba(120,60,220,0.06)",
        borderWidth: 1, borderColor: "rgba(255,255,255,0.09)",
        shadowColor: "rgba(80,20,160,0.35)",
        shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 32,
      }} />

      <View style={{
        position: "absolute", width: (ARC_RADIUS + 7) * 2, height: (ARC_RADIUS + 7) * 2,
        borderRadius: ARC_RADIUS + 7,
        borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
      }} />

      <View style={{
        position: "absolute", width: (ARC_RADIUS - 7) * 2, height: (ARC_RADIUS - 7) * 2,
        borderRadius: ARC_RADIUS - 7,
        borderWidth: 1, borderColor: "rgba(255,255,255,0.05)",
      }} />

      <View style={{
        position: "absolute", width: ARC_RADIUS * 2, height: ARC_RADIUS * 2,
        borderRadius: ARC_RADIUS,
        borderWidth: 3, borderColor: "rgba(120,80,200,0.12)",
      }} />

      <Animated.View style={[{
        position: "absolute", width: ARC_RADIUS * 2 + 6, height: ARC_RADIUS * 2 + 6,
        borderRadius: ARC_RADIUS + 3,
        borderWidth: 4,
        borderColor: "transparent",
        borderTopColor: "rgba(255,255,255,0.85)",
        borderRightColor: "rgba(255,255,255,0.4)",
        shadowColor: "#FFF", shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.6, shadowRadius: 12,
      }, ringRotation]} />

      <Animated.View style={[{
        position: "absolute", width: ARC_RADIUS * 2 + 6, height: ARC_RADIUS * 2 + 6,
        borderRadius: ARC_RADIUS + 3,
        borderWidth: 2,
        borderColor: "transparent",
        borderBottomColor: "rgba(160,130,255,0.4)",
      }, ringRotation]} />

      <Animated.View style={[{
        width: 32, height: 32, borderRadius: 16,
        backgroundColor: "rgba(180,150,255,0.25)",
        alignItems: "center", justifyContent: "center",
      }, orbStyle]}>
        <View style={{
          width: 5, height: 5, borderRadius: 2.5,
          backgroundColor: "rgba(255,255,255,0.7)",
          position: "absolute", top: 8, left: 10,
        }} />
      </Animated.View>
    </View>
  );
}

function LoadingDot({ delay }: { delay: number }) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    const timer = setTimeout(() => {
      scale.value = withRepeat(
        withSequence(
          withTiming(1.4, { duration: 600, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 600, easing: Easing.inOut(Easing.ease) }),
        ), -1, true
      );
      opacity.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 600, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.3, { duration: 600, easing: Easing.inOut(Easing.ease) }),
        ), -1, true
      );
    }, delay);
    return () => clearTimeout(timer);
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[{
      width: 3, height: 3, borderRadius: 1.5,
      backgroundColor: "rgba(180,140,255,0.7)",
    }, style]} />
  );
}

function MinimalSpinner() {
  const rot = useSharedValue(0);
  const pulse = useSharedValue(1);
  useEffect(() => {
    rot.value = withRepeat(withTiming(360, { duration: 2200, easing: Easing.linear }), -1, false);
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 1300, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.ease) }),
      ), -1, true,
    );
  }, []);
  const rotStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rot.value}deg` }] }));
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));
  return (
    <Animated.View style={[{ width: 92, height: 92, alignItems: "center", justifyContent: "center" }, pulseStyle]}>
      <View style={{
        position: "absolute", width: 92, height: 92, borderRadius: 46,
        borderWidth: 2, borderColor: "rgba(124,58,237,0.10)",
      }} />
      <Animated.View style={[{
        position: "absolute", width: 92, height: 92, borderRadius: 46,
        borderWidth: 3, borderColor: "transparent",
        borderTopColor: "#7C3AED",
        borderRightColor: "rgba(124,58,237,0.45)",
      }, rotStyle]} />
      <View style={{
        width: 16, height: 16, borderRadius: 8,
        backgroundColor: "#7C3AED",
      }} />
    </Animated.View>
  );
}

function LoadingOverlay() {
  const { lang } = useLang();
  const { themeMode } = useTheme();
  const palette = getInterviewPalette(themeMode);
  const bgTop = palette.bg;
  const bgBottom = palette.bgBottom;
  const subtitle = lang === "ru" ? "Готовим студию" : "Preparing your studio";

  return (
    <View style={{ flex: 1, backgroundColor: bgTop }}>
      <LinearGradient
        colors={[bgTop, bgBottom]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
      />

      {/* Subtle accent halo behind spinner */}
      <View pointerEvents="none" style={{
        position: "absolute",
        top: SH * 0.5 - 180, left: SW * 0.5 - 180,
        width: 360, height: 360, borderRadius: 180,
        backgroundColor: palette.glowA,
      }} />

      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 36 }}>
        <MinimalSpinner />

        <Animated.Text entering={FadeIn.delay(200).duration(600)} style={{
          marginTop: 36,
          fontSize: 16, lineHeight: 22,
          color: palette.text,
          fontFamily: "Inter_600SemiBold",
          textAlign: "center" as const,
          letterSpacing: 0.2,
        }}>
          {subtitle}
        </Animated.Text>

        <Animated.Text entering={FadeIn.delay(500).duration(700)} style={{
          marginTop: 14,
          fontSize: 13, lineHeight: 19,
          color: palette.textSec,
          fontFamily: "Inter_400Regular",
          textAlign: "center" as const,
          fontStyle: "italic" as const,
          paddingHorizontal: 16,
        }}>
          {DAILY_QUOTES[lang][new Date().getDate() % DAILY_QUOTES[lang].length]}
        </Animated.Text>

        <View style={{ flexDirection: "row", gap: 6, marginTop: 28 }}>
          <LoadingDot delay={0} />
          <LoadingDot delay={220} />
          <LoadingDot delay={440} />
        </View>
      </View>
    </View>
  );
}

function FinalSummaryScreen({ summary, topic, answers, onBack, t }: {
  summary: FinalSummary; topic: string; answers: AnswerRecord[]; onBack: () => void; t: (k: any) => string;
}) {
  const { themeMode } = useTheme();
  const palette = getInterviewPalette(themeMode);
  const [playingIdx, setPlayingIdx] = useState<number | null>(null);
  const soundRef = useRef<any>(null);

  const playAudio = async (idx: number) => {
    const record = answers[idx];
    if (!record?.audioUrl) return;
    try {
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
        if (playingIdx === idx) { setPlayingIdx(null); return; }
      }
      if (Platform.OS === "web") {
        const audio = new (window as any).Audio(record.audioUrl);
        audio.play();
        audio.onended = () => setPlayingIdx(null);
        soundRef.current = { unloadAsync: () => { audio.pause(); audio.src = ""; } };
      } else {
        const { sound } = await Audio.Sound.createAsync({ uri: record.audioUrl });
        soundRef.current = sound;
        await sound.playAsync();
        sound.setOnPlaybackStatusUpdate((s: any) => { if (s.didJustFinish) setPlayingIdx(null); });
      }
      setPlayingIdx(idx);
    } catch { setPlayingIdx(null); }
  };

  useEffect(() => () => { soundRef.current?.unloadAsync?.(); }, []);

  return (
    <Animated.View entering={FadeInUp.duration(500)} style={{ flex: 1, backgroundColor: palette.bg }}>
      <LinearGradient colors={[palette.bg, palette.bgBottom]} style={StyleSheet.absoluteFill} />
      <ScrollView contentContainerStyle={fsS.scroll} showsVerticalScrollIndicator={false}>
        <Animated.View entering={ZoomIn.delay(200).duration(500)} style={fsS.badge}>
          <Ionicons name="trophy" size={36} color={GREEN} />
        </Animated.View>
        <Animated.Text
          entering={FadeIn.delay(350).duration(350)}
          style={[fsS.title, { color: palette.text, fontFamily: "Inter_700Bold" }]}
        >
          {t("interviewComplete")}
        </Animated.Text>
        <Animated.Text
          entering={FadeIn.delay(450).duration(350)}
          style={[fsS.topicLabel, { fontFamily: "Inter_400Regular" }]}
        >
          {topic}
        </Animated.Text>

        <Animated.View entering={FadeInUp.delay(550).duration(400)}>
          <GlassCard palette={palette} style={fsS.closingCard}>
            <Ionicons name="chatbubble-ellipses-outline" size={16} color={ACCENT} style={{ marginBottom: 4 }} />
            <Text
              style={[
                fsS.closingText,
                { color: palette.textSec, fontFamily: "Inter_400Regular" },
              ]}
            >
              {summary.closing}
            </Text>
          </GlassCard>
        </Animated.View>

        {summary.strengths.length > 0 && (
          <Animated.View entering={FadeInUp.delay(650).duration(400)} style={fsS.section}>
            <View style={fsS.sectionHead}>
              <Ionicons name="checkmark-circle" size={16} color={GREEN} />
              <Text style={[fsS.sectionTitle, { color: GREEN, fontFamily: "Inter_600SemiBold" }]}>{t("strengths")}</Text>
            </View>
            {summary.strengths.map((s, i) => (
              <View key={i} style={fsS.feedbackRow}>
                <View style={[fsS.dot, { backgroundColor: GREEN }]} />
                <Text
                  style={[
                    fsS.feedbackText,
                    { color: palette.textSec, fontFamily: "Inter_400Regular" },
                  ]}
                >
                  {s}
                </Text>
              </View>
            ))}
          </Animated.View>
        )}

        {summary.weaknesses.length > 0 && (
          <Animated.View entering={FadeInUp.delay(750).duration(400)} style={fsS.section}>
            <View style={fsS.sectionHead}>
              <Ionicons name="trending-up" size={16} color="#F5A623" />
              <Text style={[fsS.sectionTitle, { color: "#F5A623", fontFamily: "Inter_600SemiBold" }]}>{t("growthPoints")}</Text>
            </View>
            {summary.weaknesses.map((w, i) => (
              <View key={i} style={fsS.feedbackRow}>
                <View style={[fsS.dot, { backgroundColor: "#F5A623" }]} />
                <Text
                  style={[
                    fsS.feedbackText,
                    { color: palette.textSec, fontFamily: "Inter_400Regular" },
                  ]}
                >
                  {w}
                </Text>
              </View>
            ))}
          </Animated.View>
        )}

        {answers.length > 0 && (
          <Animated.View entering={FadeInUp.delay(850).duration(400)} style={fsS.section}>
            <View style={fsS.sectionHead}>
              <Ionicons name="document-text-outline" size={16} color={palette.textSec} />
              <Text
                style={[
                  fsS.sectionTitle,
                  { color: palette.textSec, fontFamily: "Inter_600SemiBold" },
                ]}
              >
                {t("myAnswers")}
              </Text>
            </View>
            {answers.map((a, i) => (
              <GlassCard key={i} palette={palette} style={fsS.answerCard}>
                <Text
                  style={[
                    fsS.answerQ,
                    { color: palette.text, fontFamily: "Inter_600SemiBold" },
                  ]}
                >
                  {a.question}
                </Text>
                <Text
                  style={[
                    fsS.answerT,
                    { color: palette.textSec, fontFamily: "Inter_400Regular" },
                  ]}
                >
                  {a.transcript || t("noText")}
                </Text>
                {a.audioUrl ? (
                  <Pressable onPress={() => playAudio(i)} style={({ pressed }) => [fsS.playBtn, { opacity: pressed ? 0.7 : 1 }]}>
                    <Ionicons name={playingIdx === i ? "pause" : "play"} size={12} color={ACCENT} />
                    <Text style={[fsS.playLabel, { fontFamily: "Inter_400Regular" }]}>{playingIdx === i ? t("pauseBtn") : t("listenBtn")}</Text>
                  </Pressable>
                ) : null}
              </GlassCard>
            ))}
          </Animated.View>
        )}

        <Animated.View entering={FadeIn.delay(950).duration(400)}>
          <Pressable onPress={onBack} style={({ pressed }) => [fsS.restartBtn, { opacity: pressed ? 0.8 : 1 }]}>
            <Ionicons name="refresh" size={17} color={ACCENT} />
            <Text style={[fsS.restartLabel, { color: ACCENT, fontFamily: "Inter_600SemiBold" }]}>{t("startAgain")}</Text>
          </Pressable>
        </Animated.View>
      </ScrollView>
    </Animated.View>
  );
}
const fsS = StyleSheet.create({
  scroll: { padding: 24, paddingBottom: 48, gap: 16, alignItems: "center" },
  badge: { width: 76, height: 76, borderRadius: 38, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: GREEN + "33", backgroundColor: GREEN + "10" },
  title: { fontSize: 26, color: TEXT_PRIMARY, textAlign: "center" },
  topicLabel: { fontSize: 14, color: GREEN },
  closingCard: { alignSelf: "stretch", padding: 16, alignItems: "center" },
  closingText: { fontSize: 14, lineHeight: 22, color: TEXT_SEC, textAlign: "center", fontStyle: "italic" },
  section: { alignSelf: "stretch", gap: 10 },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionTitle: { fontSize: 13, letterSpacing: 0.4 },
  feedbackRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingLeft: 4 },
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 7 },
  feedbackText: { flex: 1, fontSize: 14, color: TEXT_SEC, lineHeight: 21 },
  answerCard: { padding: 14, gap: 8 },
  answerQ: { fontSize: 13, color: TEXT_PRIMARY, lineHeight: 19 },
  answerT: { fontSize: 14, color: TEXT_SEC, lineHeight: 21 },
  playBtn: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: ACCENT_SOFT },
  playLabel: { fontSize: 12, color: ACCENT },
  restartBtn: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 16, backgroundColor: ACCENT_SOFT },
  restartLabel: { fontSize: 15 },
});

export default function InterviewScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const tabBarH = Platform.OS === "web" ? 84 : 50;
  const bottomPad = (Platform.OS === "web" ? 34 : insets.bottom) + tabBarH;
  const { completeTask, completeAllTasksForLevel, deductXp } = useGame();
  const { t, lang } = useLang();
  const { themeMode } = useTheme();
  const palette = getInterviewPalette(themeMode);
  // When opened from a path tile (module 3+ interview level), this is set and
  // the screen runs as a one-shot session that completes that specific level
  // on success and bypasses the daily plan / lobby entirely.
  const params = useLocalSearchParams<{ fromLevelId?: string }>();
  const fromLevelIdParam = (typeof params.fromLevelId === "string" && params.fromLevelId) || null;
  const fromLevelIdRef = useRef<string | null>(fromLevelIdParam);
  useEffect(() => { fromLevelIdRef.current = fromLevelIdParam; }, [fromLevelIdParam]);

  const [macroPhase, setMacroPhase] = useState<MacroPhase>("lobby");
  const [phase, setPhase] = useState<Phase>("idle");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [topic, setTopic] = useState("");
  const [skipCount, setSkipCount] = useState(0);
  const [totalScore, setTotalScore] = useState(0);
  const [avatarState, setAvatarState] = useState<AvatarState>("idle");
  const jennyVoice = useJennyVoice();
  const { isPremium, loading: premiumLoading, setPremium } = usePremium();

  const [currentQ, setCurrentQ] = useState("");
  const [displayedQ, setDisplayedQ] = useState("");
  const [greeting, setGreeting] = useState("");
  const [displayedG, setDisplayedG] = useState("");

  const [lastScore, setLastScore] = useState<LastScore | null>(null);
  const [showScore, setShowScore] = useState(false);
  const [reactionTimer, setReactionTimer] = useState<number | null>(null);
  const [answerTimer, setAnswerTimer] = useState<number | null>(null);
  const reactionRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const answerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const recordingRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<any>(null);
  const [liveTranscript, setLiveTranscript] = useState("");

  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [finalSummary, setFinalSummary] = useState<FinalSummary | null>(null);

  const typewriterRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const speakTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showViolation, setShowViolation] = useState(false);

  const [dailyPlan, setDailyPlan] = useState<DailyPlan | null>(null);
  const [activeTopicIdx, setActiveTopicIdx] = useState(0);
  const [pendingNext, setPendingNext] = useState<string | null>(null);

  const startTypewriter = useCallback((text: string, setter: (v: string) => void, onDone?: () => void) => {
    if (typewriterRef.current) clearInterval(typewriterRef.current);
    setter("");
    let i = 0;
    typewriterRef.current = setInterval(() => {
      i++;
      setter(text.slice(0, i));
      if (i >= text.length) {
        if (typewriterRef.current) clearInterval(typewriterRef.current);
        onDone?.();
      }
    }, 28);
  }, []);

  const stopReactionTimer = useCallback(() => {
    if (reactionRef.current) { clearInterval(reactionRef.current); reactionRef.current = null; }
    setReactionTimer(null);
  }, []);
  const stopAnswerTimer = useCallback(() => {
    if (answerRef.current) { clearInterval(answerRef.current); answerRef.current = null; }
    setAnswerTimer(null);
  }, []);

  const startReactionTimer = useCallback((onExpire: () => void) => {
    setReactionTimer(REACTION_TIME);
    if (reactionRef.current) clearInterval(reactionRef.current);
    reactionRef.current = setInterval(() => {
      setReactionTimer(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(reactionRef.current!);
          reactionRef.current = null;
          onExpire();
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const startAnswerTimer = useCallback((onExpire: () => void) => {
    setAnswerTimer(ANSWER_TIME);
    if (answerRef.current) clearInterval(answerRef.current);
    answerRef.current = setInterval(() => {
      setAnswerTimer(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(answerRef.current!);
          answerRef.current = null;
          onExpire();
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const startSpeechRecognition = useCallback(() => {
    if (Platform.OS !== "web") return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = lang === "en" ? "en-US" : "ru-RU";
    let finalText = "";
    rec.onresult = (e: any) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += t + " ";
        else interim = t;
      }
      setLiveTranscript(finalText + interim);
    };
    rec.onerror = () => {};
    rec.start();
    recognitionRef.current = rec;
  }, []);

  const stopSpeechRecognition = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
      recognitionRef.current = null;
    }
  }, []);

  const playQuestion = useCallback((text: string) => {
    setCurrentQ(text);
    setAvatarState("speaking");
    startTypewriter(text, setDisplayedQ);
    // Estimated-duration fallback so the avatar stops "speaking" even when the
    // voice backend isn't reachable. If real audio starts, we cancel this and
    // let the actual playback end drive the idle transition instead.
    const dur = Math.max(2400, text.trim().split(/\s+/).length * 300);
    if (speakTimerRef.current) clearTimeout(speakTimerRef.current);
    speakTimerRef.current = setTimeout(() => setAvatarState("idle"), dur);
    jennyVoice.speak(text, {
      onStart: () => {
        if (speakTimerRef.current) clearTimeout(speakTimerRef.current);
      },
      onEnd: () => setAvatarState("idle"),
    });
  }, [startTypewriter, jennyVoice]);

  const startRecording = useCallback(async () => {
    stopReactionTimer();
    jennyVoice.stop(); // Jenny stops talking the moment the user starts answering
    if (speakTimerRef.current) clearTimeout(speakTimerRef.current);
    setLiveTranscript("");

    if (Platform.OS === "web") {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
        audioChunksRef.current = [];
        mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
        mr.start(250);
        mediaRecorderRef.current = mr;
        setPhase("recording");
        setAvatarState("listening");
        startSpeechRecognition();
        startAnswerTimer(() => stopAndProcessRef.current?.());
      } catch {
        setDisplayedQ(t("noMicBrowser"));
        setCurrentQ(t("noMicBrowser"));
        setPhase("waiting");
      }
    } else {
      try {
        await Audio.requestPermissionsAsync();
        await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
        const { recording } = await Audio.Recording.createAsync(
          Audio.RecordingOptionsPresets.HIGH_QUALITY
        );
        recordingRef.current = recording;
        setPhase("recording");
        setAvatarState("listening");
        startAnswerTimer(() => stopAndProcessRef.current?.());
      } catch (e) {
        console.warn("Recording error:", e);
        setPhase("waiting");
      }
    }
  }, [stopReactionTimer, startSpeechRecognition, startAnswerTimer, jennyVoice]);

  const stopAndProcessRef = useRef<(() => void) | null>(null);
  const startSessionRef = useRef<(() => void) | null>(null);
  const mountedRef = useRef(false);

  const stopAndProcess = useCallback(async () => {
    if (phase !== "recording") return;
    stopAnswerTimer();
    stopSpeechRecognition();
    setPhase("processing");
    setAvatarState("thinking");
    setShowScore(false);
    setLastScore(null);
    setLiveTranscript("");

    let audioBase64 = "";
    let audioUrl: string | undefined;

    try {
      if (Platform.OS === "web") {
        const mr = mediaRecorderRef.current;
        if (!mr) throw new Error("No recorder");
        await new Promise<void>((resolve) => { mr.onstop = () => resolve(); mr.stop(); });
        mr.stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        audioUrl = URL.createObjectURL(blob);
        audioBase64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve((reader.result as string).split(",")[1] ?? "");
          reader.readAsDataURL(blob);
        });
      } else {
        const rec = recordingRef.current;
        await rec.stopAndUnloadAsync();
        const uri = rec.getURI();
        recordingRef.current = null;
        if (uri) {
          audioUrl = uri;
          const FileSystem = require("expo-file-system/legacy");
          audioBase64 = await FileSystem.readAsStringAsync(uri, { encoding: "base64" });
        }
      }

      if (!audioBase64) {
        setPhase("waiting");
        setAvatarState("idle");
        setDisplayedQ(t("audioNotRecorded"));
        setCurrentQ(t("audioNotRecorded"));
        return;
      }

      const answerUrl = new URL("/api/interview/answer", getApiUrl()).toString();
      const res = await fetch(answerUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, audioBase64 }),
      });
      if (res.status === 404) {
        setPhase("idle");
        setAvatarState("idle");
        setDisplayedQ(t("sessionExpired"));
        setCurrentQ(t("sessionExpired"));
        setTimeout(() => {
          loadDailyPlan();
          setMacroPhase("lobby");
        }, 2500);
        return;
      }
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();

      if (data.terminated) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setAvatarState("outraged");
        deductXp(XP_PENALTY);
        await markInterviewUsed(activeTopicIdx, "lost");
        setShowViolation(true);
        setPhase("idle");
        return;
      }

      const record: AnswerRecord = { question: currentQ, transcript: data.transcript ?? "", audioUrl };
      setAnswers(prev => [...prev, record]);

      const sentiment = data.sentiment as string;
      if (sentiment === "positive") setAvatarState("positive");
      else if (sentiment === "negative") setAvatarState("negative");
      else setAvatarState("reacting");

      const ls: LastScore = {
        grammar: data.grammarScore ?? 0,
        diction: data.dictionScore ?? 0,
        feedback: data.feedback ?? "",
        transcript: data.transcript ?? "",
        transition: data.transition ?? "",
      };
      setLastScore(ls);
      setShowScore(true);
      setTotalScore(data.totalScore ?? 0);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      if (data.finished) {
        if (data.summary) setFinalSummary(data.summary);
        setMacroPhase("finished");
        // Path-driven session: complete the originating level (with a score
        // derived from the running totalScore), and skip the daily-plan side
        // effects so the lobby quota isn't consumed.
        const linkedLevelId = fromLevelIdRef.current;
        if (linkedLevelId) {
          const raw = data.totalScore ?? 50;
          // totalScore is roughly the sum across MAX_QUESTIONS; average it
          // back into a 0..10 per-question score.
          const overall = Math.max(3, Math.min(10, raw / MAX_QUESTIONS));
          completeAllTasksForLevel(linkedLevelId as LevelType, overall);
          // Burn the path-link immediately so that if the user later opens
          // the Interview tab directly, we don't accidentally complete
          // this level a second time from a regular lobby session.
          fromLevelIdRef.current = null;
          try { router.setParams({ fromLevelId: undefined as unknown as string }); } catch {}
        } else {
          await markInterviewUsed(activeTopicIdx, "done");
          completeTask("interview", 1, 10);
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        setPendingNext(data.nextQuestion ?? "");
        setMacroPhase("scored");
        setPhase("idle");
      }
    } catch (e) {
      console.error("Answer error:", e);
      setPhase("waiting");
      setAvatarState("idle");
      setDisplayedQ(t("networkError"));
    }
  }, [phase, sessionId, currentQ, activeTopicIdx, stopAnswerTimer, stopSpeechRecognition, playQuestion, startReactionTimer, completeTask, completeAllTasksForLevel, deductXp]);

  useEffect(() => { stopAndProcessRef.current = stopAndProcess; }, [stopAndProcess]);

  const handleMic = useCallback(() => {
    if (phase === "waiting") startRecording();
    else if (phase === "recording") stopAndProcess();
  }, [phase, startRecording, stopAndProcess]);

  const handleSkip = useCallback(async () => {
    if (!sessionId || phase === "processing") return;
    stopReactionTimer();
    setPhase("processing");
    setAvatarState("thinking");
    try {
      const url = new URL("/api/interview/skip", getApiUrl()).toString();
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      if (res.status === 404) {
        setPhase("idle");
        setAvatarState("idle");
        setMacroPhase("expired");
        return;
      }
      const data = await res.json();
      setSkipCount(data.skipCount ?? 0);
      if (data.ended) {
        if (data.summary) setFinalSummary(data.summary);
        await markInterviewUsed(activeTopicIdx);
        setMacroPhase("finished");
      } else {
        setPhase("waiting");
        playQuestion(data.nextQuestion ?? "");
        startReactionTimer(() => {
          handleInterviewLost();
        });
      }
    } catch {
      setPhase("waiting");
      setAvatarState("idle");
    }
  }, [sessionId, phase, activeTopicIdx, stopReactionTimer, playQuestion, startReactionTimer]);

  const loadDailyPlan = useCallback(async () => {
    try {
      const cooldownEnd = await AsyncStorage.getItem(COOLDOWN_STORAGE_KEY);
      if (cooldownEnd && parseInt(cooldownEnd, 10) - Date.now() > 0) {
        const url = new URL(`/api/interview/daily-plan?lang=${lang}`, getApiUrl()).toString();
        const res = await fetch(url);
        const data = await res.json();
        const used: InterviewStatus[] = new Array(data.topics.length).fill("done");
        setDailyPlan({ topics: data.topics, dateKey: data.dateKey, used });
        return;
      }

      const url = new URL(`/api/interview/daily-plan?lang=${lang}`, getApiUrl()).toString();
      const res = await fetch(url);
      const data = await res.json();
      const storageKey = DAILY_STORAGE_PREFIX + data.dateKey;
      let used: InterviewStatus[] = new Array(data.topics.length).fill(false);
      try {
        const stored = await AsyncStorage.getItem(storageKey);
        if (stored) {
          const parsed = JSON.parse(stored);
          used = data.topics.map((_: any, i: number) => {
            const v = parsed[i];
            if (v === true) return "done" as const;
            if (v === "done" || v === "lost") return v as InterviewStatus;
            return false as const;
          });
        }
      } catch {}
      setDailyPlan({ topics: data.topics, dateKey: data.dateKey, used });
    } catch {
      setDailyPlan({ topics: [t("fallbackTopic1"), t("fallbackTopic2")], dateKey: "fallback", used: [false, false] });
    }
  }, [lang]);

  const handleCooldownExpired = useCallback(async () => {
    const keys = await AsyncStorage.getAllKeys();
    const dailyKeys = keys.filter(k => k.startsWith(DAILY_STORAGE_PREFIX));
    if (dailyKeys.length) await AsyncStorage.multiRemove(dailyKeys);
    await AsyncStorage.removeItem(COOLDOWN_STORAGE_KEY);
    loadDailyPlan();
  }, [loadDailyPlan]);

  const markInterviewUsed = useCallback(async (idx: number, status: "done" | "lost" = "done") => {
    if (!dailyPlan) return;
    const newUsed = [...dailyPlan.used];
    newUsed[idx] = status;
    const updated = { ...dailyPlan, used: newUsed };
    setDailyPlan(updated);
    try {
      await AsyncStorage.setItem(DAILY_STORAGE_PREFIX + dailyPlan.dateKey, JSON.stringify(newUsed));
      const allDone = newUsed.every(u => u !== false);
      if (allDone) {
        const existing = await AsyncStorage.getItem(COOLDOWN_STORAGE_KEY);
        if (!existing || parseInt(existing, 10) - Date.now() <= 0) {
          await AsyncStorage.setItem(COOLDOWN_STORAGE_KEY, String(Date.now() + COOLDOWN_MS));
        }
      }
    } catch {}
  }, [dailyPlan]);

  const startSession = useCallback(async (topicIdx?: number) => {
    const idx = topicIdx ?? activeTopicIdx;
    setActiveTopicIdx(idx);
    setMacroPhase("loading");
    setPhase("idle");
    setSessionId(null);
    setTopic("");
    setGreeting("");
    setDisplayedG("");
    setCurrentQ("");
    setDisplayedQ("");
    setLastScore(null);
    setShowScore(false);
    setTotalScore(0);
    setSkipCount(0);
    setAnswers([]);
    setFinalSummary(null);
    setReactionTimer(null);
    setAnswerTimer(null);
    setLiveTranscript("");
    setAvatarState("idle");
    setShowViolation(false);
    setPendingNext(null);
    stopReactionTimer();
    stopAnswerTimer();

    try {
      const url = new URL("/api/interview/start", getApiUrl()).toString();
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicIndex: idx, lang }),
      });
      const data = await res.json();
      setSessionId(data.sessionId);
      setTopic(data.topic);
      setGreeting(data.greeting);
      setCurrentQ(data.question);
      setMacroPhase("greeting");
    } catch {
      setGreeting(t("failedToConnect"));
      setMacroPhase("greeting");
    }
  }, [activeTopicIdx, stopReactionTimer, stopAnswerTimer]);

  useEffect(() => { startSessionRef.current = startSession; }, [startSession]);

  const prevLangRef = useRef(lang);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      // Path-driven entry: skip the lobby and start a one-shot session.
      if (fromLevelIdRef.current) {
        startSession(0);
      } else {
        loadDailyPlan();
      }
      return;
    }
    if (prevLangRef.current !== lang) {
      prevLangRef.current = lang;
      stopReactionTimer();
      stopAnswerTimer();
      stopSpeechRecognition();
      if (typewriterRef.current) clearInterval(typewriterRef.current);
      if (speakTimerRef.current) clearTimeout(speakTimerRef.current);
      setSessionId(null);
      setMacroPhase("lobby");
      setPhase("idle");
      setTopic("");
      setGreeting("");
      setDisplayedG("");
      setCurrentQ("");
      setDisplayedQ("");
      setLastScore(null);
      setShowScore(false);
      setTotalScore(0);
      setSkipCount(0);
      setAnswers([]);
      setFinalSummary(null);
      setReactionTimer(null);
      setAnswerTimer(null);
      setLiveTranscript("");
      setAvatarState("idle");
      setShowViolation(false);
      setPendingNext(null);
      setDailyPlan(null);
      loadDailyPlan();
    }
  }, [lang]);

  useEffect(() => {
    if (macroPhase === "greeting" && greeting) {
      setAvatarState("speaking");
      startTypewriter(greeting, setDisplayedG);
      const dur = Math.max(2400, greeting.trim().split(/\s+/).length * 300);
      if (speakTimerRef.current) clearTimeout(speakTimerRef.current);
      speakTimerRef.current = setTimeout(() => setAvatarState("idle"), dur);
      jennyVoice.speak(greeting, {
        onStart: () => {
          if (speakTimerRef.current) clearTimeout(speakTimerRef.current);
        },
        onEnd: () => setAvatarState("idle"),
      });
    }
  }, [macroPhase, greeting, jennyVoice, startTypewriter]);

  // Stop Jenny's voice if the screen unmounts mid-sentence.
  useEffect(() => () => jennyVoice.stop(), [jennyVoice]);

  const handleInterviewLost = useCallback(async () => {
    stopReactionTimer();
    stopAnswerTimer();
    await markInterviewUsed(activeTopicIdx, "lost");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    setMacroPhase("expired");
  }, [activeTopicIdx, markInterviewUsed, stopReactionTimer, stopAnswerTimer]);

  const goToNextQuestion = useCallback(() => {
    const next = pendingNext;
    if (!next) {
      if (sessionId && currentQ) {
        setShowScore(false);
        setMacroPhase("active");
        setPhase("waiting");
        playQuestion(currentQ);
        startReactionTimer(() => {
          handleInterviewLost();
        });
      }
      return;
    }
    setShowScore(false);
    setPendingNext(null);
    setCurrentQ(next);
    setMacroPhase("active");
    setPhase("waiting");
    playQuestion(next);
    startReactionTimer(() => {
      handleInterviewLost();
    });
  }, [pendingNext, sessionId, currentQ, playQuestion, startReactionTimer, handleInterviewLost]);

  const handleGreetingContinue = useCallback(() => {
    setMacroPhase("active");
    setPhase("waiting");
    setTimeout(() => {
      playQuestion(currentQ);
      startReactionTimer(() => {
        handleInterviewLost();
      });
    }, 300);
  }, [currentQ, playQuestion, startReactionTimer, handleInterviewLost]);

  useEffect(() => {
    return () => {
      stopReactionTimer();
      stopAnswerTimer();
      stopSpeechRecognition();
      if (typewriterRef.current) clearInterval(typewriterRef.current);
      if (speakTimerRef.current) clearTimeout(speakTimerRef.current);
      try {
        if (Platform.OS !== "web" && recordingRef.current) {
          recordingRef.current.stopAndUnloadAsync?.();
          recordingRef.current = null;
        }
        if (Platform.OS === "web" && mediaRecorderRef.current) {
          mediaRecorderRef.current.stream?.getTracks().forEach((t: any) => t.stop());
          mediaRecorderRef.current = null;
        }
      } catch {}
    };
  }, []);

  // Jenny Interview is a Premium feature — the whole flow sits behind the
  // paywall. "Unlock for testing" (onDevUnlock) lets us in without a real
  // purchase until the store / RevenueCat is configured.
  if (!premiumLoading && !isPremium) {
    return (
      <JennyPaywall
        lang={lang === "en" ? "en" : "ru"}
        onPurchase={() =>
          Alert.alert(
            lang === "en" ? "Coming soon" : "Скоро будет",
            lang === "en"
              ? "In-app purchases will be enabled once the store (RevenueCat) is set up."
              : "Покупки включатся, когда будет настроен магазин (RevenueCat).",
          )
        }
        onDevUnlock={() => setPremium(true)}
        onClose={() => router.replace("/(tabs)")}
      />
    );
  }

  if (macroPhase === "lobby" || !dailyPlan) {
    if (!dailyPlan) return <LoadingOverlay />;
    return <LobbyScreen plan={dailyPlan} onStart={(idx) => startSession(idx)} topPad={topPad} bottomPad={bottomPad} onCooldownExpired={handleCooldownExpired} />;
  }

  if (macroPhase === "loading") {
    return <LoadingOverlay />;
  }

  if (macroPhase === "expired") {
    return (
      <View
        style={[
          s.root,
          {
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 32,
            backgroundColor: palette.bg,
          },
        ]}
      >
        <LinearGradient
          colors={[palette.bg, palette.bgBottom]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />

        <View style={{ alignItems: "center", justifyContent: "center", width: 140, height: 140, marginBottom: 24 }}>
          <PulsingRing size={130} delay={0} color="rgba(14,165,233,0.2)" />
          <PulsingRing size={100} delay={1} color="rgba(14,165,233,0.3)" />
          <Animated.View entering={ZoomIn.duration(400)} style={{
            width: 56, height: 56, borderRadius: 28,
            backgroundColor: RED + "15", alignItems: "center", justifyContent: "center",
            borderWidth: 2, borderColor: RED + "25",
          }}>
            <Ionicons name="close-circle-outline" size={28} color={RED} />
          </Animated.View>
        </View>

        <Animated.Text
          entering={FadeIn.delay(200).duration(300)}
          style={{
            fontSize: 22,
            color: palette.text,
            fontFamily: "Inter_700Bold",
            textAlign: "center",
            marginBottom: 8,
          }}
        >
          {t("interviewLost")}
        </Animated.Text>
        <Animated.Text
          entering={FadeIn.delay(350).duration(300)}
          style={{
            fontSize: 14,
            lineHeight: 22,
            color: palette.textSec,
            fontFamily: "Inter_400Regular",
            textAlign: "center",
            marginBottom: 32,
          }}
        >
          {t("interviewLostDesc")}
        </Animated.Text>
        <Animated.View entering={FadeIn.delay(500).duration(300)}>
          <Pressable
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); loadDailyPlan(); setMacroPhase("lobby"); }}
            style={({ pressed }) => ({
              flexDirection: "row" as const, alignItems: "center" as const, gap: 10,
              paddingHorizontal: 30, paddingVertical: 15, borderRadius: 18,
              backgroundColor: ACCENT, opacity: pressed ? 0.85 : 1,
              shadowColor: ACCENT, shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.25, shadowRadius: 8, elevation: 6,
            })}
          >
            <Ionicons name="arrow-back" size={17} color="#FFF" />
            <Text style={{ fontSize: 16, color: "#FFF", fontFamily: "Inter_600SemiBold" }}>{t("toLobby")}</Text>
          </Pressable>
        </Animated.View>
      </View>
    );
  }

  if (macroPhase === "finished" && finalSummary) {
    return (
      <View style={[s.root, { paddingTop: topPad, paddingBottom: bottomPad }]}>
        <FinalSummaryScreen summary={finalSummary} topic={topic} answers={answers} onBack={() => {
          // After a path-driven session we've already cleared fromLevelIdRef
          // when the level was marked complete; if we still have it set, the
          // user backed out before completion — clear it now so subsequent
          // direct-tab interviews don't re-complete this level.
          const wasFromPath = fromLevelIdRef.current !== null || fromLevelIdParam !== null;
          fromLevelIdRef.current = null;
          try { router.setParams({ fromLevelId: undefined as unknown as string }); } catch {}
          if (wasFromPath) {
            router.replace("/(tabs)");
          } else {
            loadDailyPlan();
            setMacroPhase("lobby");
          }
        }} t={t} />
      </View>
    );
  }

  const showReactionTimer = macroPhase === "active" && phase === "waiting" && reactionTimer !== null;
  const showAnswerTimer = macroPhase === "active" && phase === "recording" && answerTimer !== null;
  const isProcessing = phase === "processing";
  const canSkip = macroPhase === "active" && (phase === "waiting" || phase === "recording") && !isProcessing && skipCount < MAX_SKIPS;
  const isScored = macroPhase === "scored";

  const questionText = macroPhase === "greeting" ? displayedG : (macroPhase === "active" || isScored) ? displayedQ : "";
  const questionFull = macroPhase === "greeting" ? greeting : (macroPhase === "active" || isScored) ? currentQ : "";

  const handleCloseInterview = () => {
    const isActive = macroPhase === "active" || macroPhase === "greeting" || macroPhase === "scored";
    const doExit = () => router.replace("/(tabs)");
    if (isActive) {
      Alert.alert(
        t("exitTaskTitle"),
        t("exitTaskMsg"),
        [
          { text: t("stayBtn"), style: "cancel" },
          { text: t("leaveBtn"), style: "destructive", onPress: doExit },
        ],
      );
    } else {
      doExit();
    }
  };

  return (
    <View style={[s.root, { paddingTop: topPad, backgroundColor: palette.bg }]}>
      <LinearGradient
        colors={[palette.bg, palette.bgBottom]}
        style={StyleSheet.absoluteFill}
      />

      <Pressable
        onPress={handleCloseInterview}
        hitSlop={12}
        style={({ pressed }) => ({
          position: "absolute",
          top: topPad + 8,
          right: 16,
          width: 40,
          height: 40,
          borderRadius: 20,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: palette.headerChip,
          zIndex: 100,
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <Ionicons name="close" size={22} color={palette.text} />
      </Pressable>

      <View style={s.avatarArea}>
        <View style={s.avatarGlow}>
          <LinearGradient
            colors={[
              phase === "recording" ? "rgba(14,165,233,0.12)" : "rgba(108,99,255,0.10)",
              "transparent",
              phase === "recording" ? "rgba(14,165,233,0.06)" : "rgba(52,199,133,0.06)",
            ]}
            style={{ position: "absolute", width: SW * 0.8, height: SW * 0.8, borderRadius: SW * 0.4 }}
            start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
          />
        </View>
        <JennyAvatar state={avatarState} />
      </View>

      <GlassCard
        palette={palette}
        style={[s.panel, { paddingBottom: Math.max(bottomPad + 10, Platform.OS === "ios" ? 40 : 25) }]}
      >
        <View style={[s.handle, { backgroundColor: palette.handle }]} />

        <View style={s.jennyRow}>
          <View style={{ flexDirection: "row" as const, alignItems: "center" as const, gap: 10, flex: 1 }}>
            <View
              style={[
                s.headerAvatarWrap,
                {
                  backgroundColor: palette.headerChip,
                  borderColor: palette.rowBorder,
                },
              ]}
            >
              <View style={[s.headerDot, { backgroundColor: phase === "recording" ? RED : GREEN }]} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.headerTitle, { color: GREEN, fontFamily: "Inter_700Bold" }]}>
                {t("withJenny")}
              </Text>
              <Text
                style={[s.headerSub, { color: palette.textSec, fontFamily: "Inter_400Regular" }]}
                numberOfLines={1}
              >
                {macroPhase === "greeting" ? t("interviewer") : topic ? `${t("interviewer")}  ·  ${topic}` : t("interviewer")}
              </Text>
            </View>
          </View>
          {(macroPhase === "active" || macroPhase === "scored") && (
            <View style={[s.progressBadge, { backgroundColor: palette.accentSoft }]}>
              <Text
                style={[s.progressBadgeTxt, { color: palette.accent, fontFamily: "Inter_700Bold" }]}
              >
                {answers.length}/{MAX_QUESTIONS}
              </Text>
            </View>
          )}
        </View>

        <ScrollView style={s.panelScroll} contentContainerStyle={s.panelScrollContent} showsVerticalScrollIndicator={false} bounces={false}>
          {showReactionTimer && <TimerDisplay type="reaction" seconds={reactionTimer} t={t} />}
          {showAnswerTimer && <TimerDisplay type="answer" seconds={answerTimer} t={t} />}
          {showScore && lastScore && <ScoreReveal score={lastScore} />}

          {!showScore && (() => {
            const qColor = macroPhase === "greeting" ? ACCENT : QUESTION_COLORS[answers.length % QUESTION_COLORS.length];
            return (
              <View style={[s.questionCard, { borderColor: qColor + "20", backgroundColor: qColor + "08" }]}>
                {isProcessing ? (
                  <Animated.View entering={FadeIn.duration(200)} style={s.thinkRow}>
                    <AnimatedDots />
                    <Text
                      style={[
                        s.thinkTxt,
                        { color: palette.textSec, fontFamily: "Inter_400Regular" },
                      ]}
                    >
                      {t("analyzingAnswer")}
                    </Text>
                  </Animated.View>
                ) : questionFull ? (
                  <View style={s.questionInner}>
                    <View style={s.questionIconRow}>
                      <Ionicons name={macroPhase === "greeting" ? "chatbubble-ellipses" : "help-circle"} size={16} color={qColor} />
                      <Text style={[s.questionLabel, { fontFamily: "Inter_500Medium", color: qColor }]}>
                        {macroPhase === "greeting" ? t("greeting") : t("questionNofM", { n: String(answers.length + 1), max: String(MAX_QUESTIONS) })}
                      </Text>
                    </View>
                    <Text style={[s.questionTxt, { fontFamily: "Inter_600SemiBold", color: qColor, textShadowColor: qColor + "22", textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 6 }]}>
                      {questionText}
                      {questionText.length < questionFull.length && <Text style={{ color: "transparent" }}>|</Text>}
                    </Text>
                  </View>
                ) : null}
              </View>
            );
          })()}

        {phase === "recording" && (
          <Animated.View entering={FadeIn.duration(250)} style={s.transcriptBox}>
            {Platform.OS === "web" && liveTranscript ? (
              <View style={s.transcriptInner}>
                <View style={s.transcriptDotRow}>
                  <View style={[s.transcriptDot, { backgroundColor: RED }]} />
                  <Text style={[s.transcriptDotLabel, { fontFamily: "Inter_500Medium" }]}>REC</Text>
                </View>
                <Text
                  style={[
                    s.transcriptText,
                    { color: palette.text, fontFamily: "Inter_400Regular" },
                  ]}
                >
                  {liveTranscript}
                </Text>
              </View>
            ) : (
              <View style={s.transcriptInner}>
                <View style={s.transcriptDotRow}>
                  <View style={[s.transcriptDot, { backgroundColor: RED }]} />
                  <Text style={[s.transcriptDotLabel, { fontFamily: "Inter_500Medium" }]}>REC</Text>
                </View>
                <Waveform active />
                <Text
                  style={[
                    s.transcriptHint,
                    { color: palette.textSec, fontFamily: "Inter_400Regular" },
                  ]}
                >
                  {Platform.OS === "web" ? t("speakWordsAppear") : t("recordingInProgress")}
                </Text>
              </View>
            )}
          </Animated.View>
        )}
        </ScrollView>

        {macroPhase === "greeting" ? (
          <Animated.View entering={FadeIn.delay(1000).duration(400)} style={s.controlRow}>
            <Pressable
              onPress={handleGreetingContinue}
              style={({ pressed }) => [s.nextBtn, { opacity: pressed ? 0.85 : 1 }]}
            >
              <LinearGradient colors={["#FFD700", "#F5A623"]} style={[StyleSheet.absoluteFill, { borderRadius: 20 }]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
              <Text style={[s.nextBtnTxt, { fontFamily: "Inter_700Bold", color: "#1A1A2E" }]}>{t("ok")}</Text>
              <Ionicons name="arrow-forward" size={16} color="#1A1A2E" />
            </Pressable>
          </Animated.View>
        ) : macroPhase === "scored" ? (
          <Animated.View entering={FadeIn.duration(350)} style={s.controlRow}>
            <Pressable
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); goToNextQuestion(); }}
              style={({ pressed }) => [s.nextBtn, { opacity: pressed ? 0.85 : 1 }]}
            >
              <LinearGradient colors={[GREEN, "#28B070"]} style={[StyleSheet.absoluteFill, { borderRadius: 20 }]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
              <Text style={[s.nextBtnTxt, { fontFamily: "Inter_700Bold" }]}>{t("nextQuestion")}</Text>
              <Ionicons name="arrow-forward" size={16} color="#FFF" />
            </Pressable>
          </Animated.View>
        ) : macroPhase === "active" ? (
          <View style={s.controlRow}>
            <SkipButton skipCount={skipCount} onPress={handleSkip} disabled={!canSkip} t={t} />
            <MicButton phase={phase} onPress={handleMic} disabled={isProcessing} t={t} />
          </View>
        ) : null}
      </GlassCard>

      <ViolationPopup
        visible={showViolation}
        onDismiss={() => { setShowViolation(false); loadDailyPlan(); setMacroPhase("lobby"); }}
        t={t}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: WARM },

  avatarArea: {
    height: SH * 0.42,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    position: "relative" as const,
    zIndex: 1,
  },
  avatarGlow: {
    position: "absolute" as const,
    top: "5%" as any,
    left: "10%" as any,
    right: "10%" as any,
    bottom: 0,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },

  panel: {
    flex: 1,
    marginTop: -40,
    paddingHorizontal: 22,
    paddingTop: 16,
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
  },
  handle: {
    alignSelf: "center" as const,
    width: 45,
    height: 5,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.08)",
    marginBottom: 14,
  },

  jennyRow: { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const, marginBottom: 12 },
  headerAvatarWrap: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.04)", alignItems: "center" as const,
    justifyContent: "center" as const, borderWidth: 1, borderColor: "rgba(0,0,0,0.06)",
  },
  headerDot: { width: 10, height: 10, borderRadius: 5 },
  headerTitle: { fontSize: 15, color: TEXT_PRIMARY },
  headerSub: { fontSize: 12, color: TEXT_SEC, marginTop: 1 },

  progressBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, backgroundColor: ACCENT_SOFT },
  progressBadgeTxt: { fontSize: 12, color: ACCENT },

  panelScroll: { flex: 1 },
  panelScrollContent: { gap: 12, paddingBottom: 6 },
  questionCard: {
    backgroundColor: "rgba(108,99,255,0.04)",
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    minHeight: SH * 0.15,
    justifyContent: "center" as const,
  },
  questionInner: { gap: 10, alignItems: "center" as const },
  questionIconRow: { flexDirection: "row" as const, alignItems: "center" as const, gap: 7 },
  questionLabel: { fontSize: 12.5, letterSpacing: 0.3 },
  questionTxt: { fontSize: SH > 700 ? 20 : 18, lineHeight: SH > 700 ? 30 : 27, color: TEXT_PRIMARY, textAlign: "center" as const },
  thinkRow: { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "center" as const, gap: 10, minHeight: SH * 0.1 },
  thinkTxt: { fontSize: 14, color: TEXT_SEC },

  transcriptBox: { minHeight: 48, backgroundColor: "rgba(14,165,233,0.04)", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "rgba(14,165,233,0.15)" },
  transcriptInner: { gap: 8 },
  transcriptDotRow: { flexDirection: "row" as const, alignItems: "center" as const, gap: 6 },
  transcriptDot: { width: 8, height: 8, borderRadius: 4 },
  transcriptDotLabel: { fontSize: 11, color: RED, letterSpacing: 1 },
  transcriptText: { fontSize: 14, color: TEXT_PRIMARY, lineHeight: 21 },
  transcriptHint: { fontSize: 13, color: TEXT_SEC, lineHeight: 19 },

  controlRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: 20,
    marginTop: "auto" as any,
    paddingTop: 14,
  },
  nextBtn: {
    height: 64,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: 10,
    paddingHorizontal: 36,
    borderRadius: 20,
    overflow: "hidden" as const,
    shadowColor: "#FFD700",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  nextBtnTxt: { fontSize: 17, color: "#FFF" },
});
