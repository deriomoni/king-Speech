// «Твоя роль» — Figma "Screen / 09b · Роли · твоя роль" (430:2027).
// Shown after drawing a role (spin) or picking one from the grid: big tarot
// card, the scene, three tasks, and the camera / voice-only choice before
// going on stage.
import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, Platform, Dimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "@/lib/haptics";
import { router, useLocalSearchParams } from "expo-router";
import Animated, { FadeInDown, ZoomIn } from "react-native-reanimated";
import { useLang } from "@/context/LangContext";
import { getRoleById, getRoleTasks, tx, type RoleMode } from "@/constants/rolesData";
import {
  RoleTarotCard,
  CrownPattern,
  ROLES_BG,
  roleFrameColor,
  roleInk,
} from "@/components/roles/RoleTarotCard";
import { PlayTriangleIcon } from "@/components/showtime/ShowTimeIcons";
import { getRoleScenario, lt } from "@/constants/roleScenarios";

const { width: SW, height: SH } = Dimensions.get("window");
const CARD_W = Math.round(Math.min(SW * 0.55, 240));
const PANEL = "#1C1C20";
const PANEL_LINE = "rgba(255,255,255,0.08)";
const TEXT = "#FFFFFF";
const MUTED = "rgba(255,255,255,0.5)";

function haptic(style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) {
  if (Platform.OS !== "web") Haptics.impactAsync(style).catch(() => {});
}

export default function RoleBriefScreen() {
  const insets = useSafeAreaInsets();
  const { lang } = useLang();
  const params = useLocalSearchParams<{ roleId: string }>();
  const role = getRoleById(String(params.roleId));
  const [withCamera, setWithCamera] = useState(true);
  const [mode, setMode] = useState<RoleMode>("improv");

  const topPad = Platform.OS === "web" ? 16 : insets.top + 4;
  const bottomPad = (Platform.OS === "web" ? 16 : insets.bottom) + 10;

  if (!role) {
    return (
      <View style={[styles.root, { alignItems: "center", justifyContent: "center" }]}>
        <Text style={styles.errText}>{lang === "en" ? "Role not found" : "Роль не найдена"}</Text>
        <Pressable onPress={() => router.back()} style={styles.errBtn}>
          <Text style={styles.errBtnText}>{lang === "en" ? "Back" : "Назад"}</Text>
        </Pressable>
      </View>
    );
  }

  const tasks = getRoleTasks(role);
  const scenario = getRoleScenario(role.id);
  const sceneKind =
    scenario?.kind === "live"
      ? (lang === "en" ? "Live stream" : "Прямой эфир")
      : scenario?.kind === "stage"
        ? (lang === "en" ? "On stage" : "Сцена")
        : (lang === "en" ? "Dialogue" : "Диалог");
  const dotBg = roleFrameColor(role.id);
  const dotInk = roleInk(role.id);

  const goOnStage = () => {
    haptic(Haptics.ImpactFeedbackStyle.Medium);
    router.push({
      pathname: "/role-stage",
      params: { roleId: role.id, mode, camera: withCamera ? "1" : "0" },
    });
  };

  return (
    <View style={styles.root}>
      <CrownPattern width={SW} height={SH} />

      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: topPad }]}>
        <View style={{ width: 40 }} />
        <Text style={styles.kicker}>{lang === "en" ? "YOUR ROLE" : "ТВОЯ РОЛЬ"}</Text>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.closeBtn}>
          <Ionicons name="close" size={26} color={TEXT} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Animated.View entering={ZoomIn.duration(420)} style={styles.cardWrap}>
          <RoleTarotCard role={role} width={CARD_W} lang={lang} />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(120)} style={styles.panel}>
          <Text style={styles.panelLabel}>{lang === "en" ? "SCENE" : "СЦЕНА"}</Text>
          <Text style={styles.sceneText}>{tx(role.scene, lang)}</Text>

          <View style={styles.divider} />

          {scenario ? (
            <>
              <Text style={styles.panelLabel}>{lang === "en" ? "YOU'LL BE TALKING TO" : "С КЕМ ТЫ ГОВОРИШЬ"}</Text>
              <View style={styles.personaRow}>
                <View style={styles.personaAvatar}>
                  <Text style={{ fontSize: 24 }}>{scenario.persona.avatar}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.personaName}>{lt(scenario.persona.name, lang)}</Text>
                  <Text style={styles.personaMood}>{lt(scenario.persona.mood, lang)}</Text>
                </View>
              </View>
              <Text style={styles.personaAbout}>{lt(scenario.persona.about, lang)}</Text>
              <Text style={styles.metaLine}>
                {sceneKind} · {scenario.beats.length} {lang === "en" ? "lines" : "реплик"} · {lang === "en" ? "1–2 min" : "1–2 мин"}
                {scenario.opening ? (lang === "en" ? " · you open" : " · ты начинаешь") : ""}
              </Text>

              <View style={styles.divider} />

              <Text style={styles.panelLabel}>{lang === "en" ? "SCENE GOALS" : "ЦЕЛИ СЦЕНЫ"}</Text>
              {scenario.goals.map((g, i) => (
                <View key={g.id} style={styles.taskRow}>
                  <View style={[styles.taskDot, { backgroundColor: dotBg }]}>
                    <Text style={[styles.taskNum, { color: dotInk }]}>{i + 1}</Text>
                  </View>
                  <Text style={styles.taskText}>{lt(g.text, lang)}</Text>
                </View>
              ))}
              <Text style={styles.metaLine}>
                {lang === "en"
                  ? "Lines appear when you pause. Steer the talk toward the goals — they tick live."
                  : "Реплики появляются, когда ты делаешь паузу. Веди разговор к целям — они отмечаются по ходу."}
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.panelLabel}>{lang === "en" ? "YOUR TASKS" : "ТВОИ ЗАДАНИЯ"}</Text>
              {tasks.slice(0, 3).map((t, i) => (
                <View key={i} style={styles.taskRow}>
                  <View style={[styles.taskDot, { backgroundColor: dotBg }]}>
                    <Text style={[styles.taskNum, { color: dotInk }]}>{i + 1}</Text>
                  </View>
                  <Text style={styles.taskText}>{tx(t, lang)}</Text>
                </View>
              ))}
            </>
          )}

          {/* Play style (kept from the old mode picker): improv vs teleprompter */}
          <View style={styles.modeRow}>
            <ModePill
              active={mode === "improv"}
              icon="flash"
              label={lang === "en" ? "Improvise" : "Импровизация"}
              onPress={() => { haptic(); setMode("improv"); }}
            />
            <ModePill
              active={mode === "scripted"}
              icon="document-text"
              label={lang === "en" ? "Read the script" : "По сценарию"}
              onPress={() => { haptic(); setMode("scripted"); }}
            />
          </View>
        </Animated.View>
      </ScrollView>

      {/* Bottom bar */}
      <View style={[styles.bottomWrap, { paddingBottom: bottomPad }]}>
        <View style={styles.bottomBar}>
          <View style={styles.segment}>
            <SegmentOption
              active={withCamera}
              icon="videocam-outline"
              label={lang === "en" ? "With camera" : "С камерой"}
              onPress={() => { haptic(); setWithCamera(true); }}
            />
            <SegmentOption
              active={!withCamera}
              icon="mic-outline"
              label={lang === "en" ? "Voice only" : "Только голос"}
              onPress={() => { haptic(); setWithCamera(false); }}
            />
          </View>
          <Pressable onPress={goOnStage} style={({ pressed }) => [styles.goBtn, { transform: [{ scale: pressed ? 0.98 : 1 }] }]}>
            <PlayTriangleIcon color={ROLES_BG} />
            <Text style={styles.goText}>{lang === "en" ? "Go on stage" : "Выйти на сцену"}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function SegmentOption({
  active,
  icon,
  label,
  onPress,
}: {
  active: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  const color = active ? ROLES_BG : "rgba(255,255,255,0.6)";
  return (
    <Pressable onPress={onPress} style={[styles.segOpt, active && styles.segOptOn]}>
      <Ionicons name={icon} size={18} color={color} />
      <Text style={[styles.segText, { color }]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

function ModePill({
  active,
  icon,
  label,
  onPress,
}: {
  active: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.modePill, active && styles.modePillOn]}>
      <Ionicons name={icon} size={13} color={active ? TEXT : MUTED} />
      <Text style={[styles.modeText, { color: active ? TEXT : MUTED }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: ROLES_BG },
  errText: { color: TEXT, fontFamily: "Geologica_800ExtraBold", fontSize: 20, marginBottom: 16 },
  errBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 16, backgroundColor: "#FFFFFF1A" },
  errBtnText: { color: TEXT, fontFamily: "Geologica_600SemiBold", fontSize: 15 },

  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingBottom: 4 },
  kicker: { color: MUTED, fontFamily: "Geologica_700Bold", fontSize: 12, letterSpacing: 2 },
  closeBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },

  scroll: { paddingHorizontal: 20, paddingBottom: 24 },
  cardWrap: {
    alignSelf: "center", marginTop: 10, marginBottom: 26, transform: [{ rotate: "-2deg" }],
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOpacity: 0.5, shadowRadius: 20, shadowOffset: { width: 0, height: 12 } },
      android: { elevation: 10 },
      default: {},
    }),
  },

  panel: { backgroundColor: PANEL, borderRadius: 22, borderWidth: 1, borderColor: PANEL_LINE, padding: 18 },
  panelLabel: { color: MUTED, fontFamily: "Geologica_700Bold", fontSize: 11, letterSpacing: 1.2, marginBottom: 10 },
  sceneText: { color: TEXT, fontFamily: "Geologica_500Medium", fontSize: 15, lineHeight: 22 },
  divider: { height: 1, backgroundColor: PANEL_LINE, marginVertical: 16 },
  taskRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 7 },
  taskDot: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  taskNum: { fontFamily: "Geologica_700Bold", fontSize: 13 },
  personaRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  personaAvatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center" },
  personaName: { color: TEXT, fontFamily: "Geologica_700Bold", fontSize: 16 },
  personaMood: { color: MUTED, fontFamily: "Geologica_500Medium", fontSize: 12, marginTop: 1 },
  personaAbout: { color: "rgba(255,255,255,0.8)", fontFamily: "Geologica_400Regular", fontSize: 13, lineHeight: 19, marginTop: 10 },
  metaLine: { color: MUTED, fontFamily: "Geologica_500Medium", fontSize: 11, lineHeight: 15, marginTop: 10 },
  taskText: { flex: 1, color: TEXT, fontFamily: "Geologica_500Medium", fontSize: 14, lineHeight: 19 },

  modeRow: { flexDirection: "row", gap: 8, marginTop: 14 },
  modePill: {
    flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 14, borderWidth: 1, borderColor: PANEL_LINE,
  },
  modePillOn: { backgroundColor: "rgba(255,255,255,0.10)", borderColor: "rgba(255,255,255,0.22)" },
  modeText: { fontFamily: "Geologica_600SemiBold", fontSize: 12 },

  bottomWrap: { paddingHorizontal: 20, paddingTop: 6 },
  bottomBar: { backgroundColor: PANEL, borderRadius: 26, borderWidth: 1, borderColor: PANEL_LINE, padding: 8, gap: 8 },
  segment: { flexDirection: "row", backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 18, padding: 4, gap: 4 },
  segOpt: { flex: 1, height: 40, borderRadius: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  segOptOn: { backgroundColor: "#FFFFFF" },
  segText: { fontFamily: "Geologica_600SemiBold", fontSize: 14 },
  goBtn: {
    height: 54, borderRadius: 20, backgroundColor: "#FFFFFF",
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
  },
  goText: { color: ROLES_BG, fontFamily: "Geologica_800ExtraBold", fontSize: 16 },
});
