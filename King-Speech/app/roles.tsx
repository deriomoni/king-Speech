import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
  Modal,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  ZoomIn,
} from "react-native-reanimated";
import { useLang } from "@/context/LangContext";
import { useRoles } from "@/context/RolesContext";
import {
  ROLES,
  ROLE_CATEGORIES,
  type Role,
  type RoleCategory,
  type RoleMode,
  tx,
  pickWeightedRole,
} from "@/constants/rolesData";
import RoleArt, { hasRoleArt } from "@/components/roles/RoleArt";

const { width: SW } = Dimensions.get("window");
const CARD_GAP = 12;
const H_PAD = 20;
const CARD_W = (Math.min(SW, 520) - H_PAD * 2 - CARD_GAP) / 2;

// Clean white / black roles theme.
const BG = "#FFFFFF";
const BG2 = "#FFFFFF";
const CARD_BG = "#FFFFFF";
const LINE = "#111111"; // clean black card outline
const TEXT = "#111111";
const MUTED = "#6B7280";

// Only roles that already have supplied artwork are shown for now.
const ART_ROLES = ROLES.filter((r) => hasRoleArt(r.id));
const ART_ROLE_IDS = new Set(ART_ROLES.map((r) => r.id));

function haptic(style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) {
  if (Platform.OS !== "web") Haptics.impactAsync(style).catch(() => {});
}

// ---------------------------------------------------------------------------
// Role card
// ---------------------------------------------------------------------------
function RoleCard({
  role,
  collected,
  onPress,
}: {
  role: Role;
  collected: boolean;
  onPress: () => void;
}) {
  const { lang } = useLang();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] },
      ]}
    >
      <View style={styles.cardArtBox}>
        <RoleArt id={role.id} size={92} />
      </View>
      <Text style={styles.cardTitle} numberOfLines={2}>{tx(role.title, lang)}</Text>
      <Text style={styles.cardDesc} numberOfLines={3}>{tx(role.desc, lang)}</Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Mode picker sheet
// ---------------------------------------------------------------------------
function ModePicker({
  role,
  onClose,
  onPick,
}: {
  role: Role | null;
  onClose: () => void;
  onPick: (mode: RoleMode) => void;
}) {
  const { lang } = useLang();
  if (!role) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose}>
        <Animated.View entering={FadeInUp.springify().damping(18)} style={styles.sheet}>
          <Pressable onPress={() => {}}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetArtBox}>
              <RoleArt id={role.id} size={96} />
            </View>
            <Text style={styles.sheetTitle}>{tx(role.title, lang)}</Text>
            <Text style={styles.sheetScene}>{tx(role.scene, lang)}</Text>

            <Text style={styles.sheetChoose}>
              {lang === "en" ? "Choose how to play" : "Выбери, как играть"}
            </Text>

            <Pressable
              onPress={() => { haptic(Haptics.ImpactFeedbackStyle.Medium); onPick("scripted"); }}
              style={({ pressed }) => [styles.modeBtn, { opacity: pressed ? 0.9 : 1 }]}
            >
              <LinearGradient colors={["#6C5CE7", "#4834B0"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
              <Ionicons name="document-text" size={22} color="#fff" />
              <View style={styles.modeBtnTextWrap}>
                <Text style={styles.modeBtnTitle}>{lang === "en" ? "Read the script" : "По сценарию"}</Text>
                <Text style={styles.modeBtnSub}>{lang === "en" ? "Read the line on the teleprompter" : "Читай реплику по суфлёру"}</Text>
              </View>
            </Pressable>

            <Pressable
              onPress={() => { haptic(Haptics.ImpactFeedbackStyle.Medium); onPick("improv"); }}
              style={({ pressed }) => [styles.modeBtn, { opacity: pressed ? 0.9 : 1 }]}
            >
              <LinearGradient colors={["#E84393", "#B8246B"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
              <Ionicons name="flash" size={22} color="#fff" />
              <View style={styles.modeBtnTextWrap}>
                <Text style={styles.modeBtnTitle}>{lang === "en" ? "Improvise" : "Импровизация"}</Text>
                <Text style={styles.modeBtnSub}>{lang === "en" ? "React to the scene in your own words" : "Реагируй на сцену своими словами"}</Text>
              </View>
            </Pressable>

            <Pressable onPress={onClose} style={styles.sheetCancel}>
              <Text style={styles.sheetCancelText}>{lang === "en" ? "Cancel" : "Отмена"}</Text>
            </Pressable>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Spin overlay (roulette)
// ---------------------------------------------------------------------------
function SpinOverlay({
  onClose,
  onLanded,
}: {
  onClose: () => void;
  onLanded: (role: Role) => void;
}) {
  const { lang } = useLang();
  const [current, setCurrent] = useState<Role>(() => ART_ROLES[0]);
  const [done, setDone] = useState<Role | null>(null);
  const timeouts = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const winner = pickWeightedRole(ART_ROLES);
    haptic(Haptics.ImpactFeedbackStyle.Heavy);
    // Ease-out: fast flicks that slow down, then land on the winner.
    const steps = 26;
    let delay = 55;
    let acc = 0;
    for (let i = 0; i < steps; i++) {
      const isLast = i === steps - 1;
      acc += delay;
      const at = acc;
      const t = setTimeout(() => {
        if (isLast) {
          setCurrent(winner);
          setDone(winner);
          haptic(Haptics.ImpactFeedbackStyle.Heavy);
        } else {
          setCurrent(ART_ROLES[Math.floor(Math.random() * ART_ROLES.length)]);
          if (Platform.OS !== "web" && i % 2 === 0) haptic(Haptics.ImpactFeedbackStyle.Light);
        }
      }, at);
      timeouts.current.push(t);
      delay = Math.min(320, delay * 1.14); // decelerate
    }
    return () => { timeouts.current.forEach(clearTimeout); timeouts.current = []; };
  }, []);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.spinBackdrop}>
        <Text style={styles.spinLabel}>
          {done
            ? (lang === "en" ? "Your role!" : "Твоя роль!")
            : (lang === "en" ? "Spinning..." : "Крутим...")}
        </Text>
        <Animated.View
          key={current.id + (done ? "-done" : "")}
          entering={done ? ZoomIn.springify().damping(12) : FadeIn.duration(60)}
          style={styles.spinCard}
        >
          <View style={styles.spinArtBox}>
            <RoleArt id={current.id} size={120} />
          </View>
          <Text style={styles.spinTitle}>{tx(current.title, lang)}</Text>
          {done && <Text style={styles.spinDesc}>{tx(current.desc, lang)}</Text>}
        </Animated.View>

        {done ? (
          <Animated.View entering={FadeInUp.delay(150)} style={{ width: "100%", alignItems: "center" }}>
            <Pressable
              onPress={() => { haptic(Haptics.ImpactFeedbackStyle.Medium); onLanded(done); }}
              style={({ pressed }) => [styles.spinPlayBtn, { opacity: pressed ? 0.9 : 1 }]}
            >
              <LinearGradient colors={["#FFDE5C", "#FFC01E"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
              <Ionicons name="play" size={20} color="#3A2C00" />
              <Text style={styles.spinPlayText}>{lang === "en" ? "Play this role" : "Играть эту роль"}</Text>
            </Pressable>
            <Pressable onPress={onClose} style={styles.spinSkip}>
              <Text style={styles.spinSkipText}>{lang === "en" ? "Close" : "Закрыть"}</Text>
            </Pressable>
          </Animated.View>
        ) : null}
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------
export default function RolesScreen() {
  const insets = useSafeAreaInsets();
  const { lang } = useLang();
  const { isCollected } = useRoles();
  const [category, setCategory] = useState<RoleCategory | "all">("all");
  const [pickerRole, setPickerRole] = useState<Role | null>(null);
  const [spinning, setSpinning] = useState(false);

  const topPad = Platform.OS === "web" ? 24 : insets.top + 8;
  const bottomPad = (Platform.OS === "web" ? 24 : insets.bottom) + 32;

  // Only roles that already have artwork; the rest are hidden for now. Empty
  // categories are skipped in the chip row below.
  const visibleRoles = category === "all" ? ART_ROLES : ART_ROLES.filter((r) => r.category === category);

  const goPlay = useCallback((role: Role, mode: RoleMode) => {
    setPickerRole(null);
    setSpinning(false);
    router.push({ pathname: "/role-stage", params: { roleId: role.id, mode } });
  }, []);

  const openPickerFromSpin = useCallback((role: Role) => {
    setSpinning(false);
    setPickerRole(role);
  }, []);

  return (
    <View style={styles.root}>

      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={26} color={TEXT} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: H_PAD, paddingBottom: bottomPad }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.duration(400)}>
          <Text style={styles.title}>
            {lang === "en" ? "Choose your role" : "Выбери свою роль"}
          </Text>
          <Text style={styles.subtitle}>
            {lang === "en" ? "Step into a character and train adaptability — speak in any situation." : "Вживись в персонажа и тренируй адаптивность — говори в любой ситуации."}
          </Text>
        </Animated.View>

        {/* Spin button */}
        <Animated.View entering={FadeInDown.delay(80)}>
          <Pressable
            onPress={() => { haptic(Haptics.ImpactFeedbackStyle.Medium); setSpinning(true); }}
            style={({ pressed }) => [styles.spinCta, { opacity: pressed ? 0.92 : 1 }]}
          >
            <LinearGradient colors={["#FF7AC4", "#8E5BFF"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
            <Ionicons name="dice" size={22} color="#fff" />
            <Text style={styles.spinCtaText}>{lang === "en" ? "Spin for a random role" : "Крутить рулетку ролей"}</Text>
          </Pressable>
        </Animated.View>

        {/* Category chips (icon-free) — only categories that have art */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
          style={{ marginHorizontal: -H_PAD, marginTop: 18 }}
        >
          <View style={{ width: H_PAD }} />
          <CategoryChip
            active={category === "all"}
            label={lang === "en" ? "All" : "Все"}
            onPress={() => { haptic(); setCategory("all"); }}
          />
          {ROLE_CATEGORIES.filter((c) => ART_ROLES.some((r) => r.category === c.id)).map((c) => (
            <CategoryChip
              key={c.id}
              active={category === c.id}
              label={tx(c.label, lang)}
              onPress={() => { haptic(); setCategory(c.id); }}
            />
          ))}
          <View style={{ width: H_PAD }} />
        </ScrollView>

        {/* Grid */}
        <View style={styles.grid}>
          {visibleRoles.map((role, i) => {
            const has = isCollected(role.id);
            return (
              <Animated.View key={role.id} entering={FadeInDown.delay(Math.min(i * 30, 300))}>
                <RoleCard role={role} collected={has} onPress={() => { haptic(); setPickerRole(role); }} />
              </Animated.View>
            );
          })}
        </View>
      </ScrollView>

      <ModePicker role={pickerRole} onClose={() => setPickerRole(null)} onPick={(m) => pickerRole && goPlay(pickerRole, m)} />
      {spinning && <SpinOverlay onClose={() => setSpinning(false)} onLanded={openPickerFromSpin} />}
    </View>
  );
}

function CategoryChip({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        active
          ? { backgroundColor: LINE, borderColor: LINE }
          : { backgroundColor: "#FFFFFF", borderColor: "#0000001F" },
      ]}
    >
      <Text style={[styles.chipText, active && { color: "#FFFFFF" }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: H_PAD,
    paddingBottom: 8,
  },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "#00000008" },
  trophyBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20,
    backgroundColor: "#FFFFFF10", borderWidth: 1, borderColor: "#FFFFFF1A",
  },
  trophyText: { color: "#FFC01E", fontFamily: "Nunito_700Bold", fontSize: 13 },
  kicker: { color: MUTED, fontFamily: "Nunito_700Bold", fontSize: 12, letterSpacing: 2, marginTop: 6 },
  title: { color: TEXT, fontFamily: "Nunito_800ExtraBold", fontSize: 30, marginTop: 6, lineHeight: 34 },
  subtitle: { color: MUTED, fontFamily: "Nunito_400Regular", fontSize: 14, marginTop: 8, lineHeight: 20 },

  spinCta: {
    marginTop: 20, height: 56, borderRadius: 18, overflow: "hidden",
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    ...Platform.select({
      ios: { shadowColor: "#8E5BFF", shadowOpacity: 0.5, shadowRadius: 16, shadowOffset: { width: 0, height: 8 } },
      android: { elevation: 8 }, default: {},
    }),
  },
  spinCtaText: { color: "#fff", fontFamily: "Nunito_800ExtraBold", fontSize: 17 },

  chipsRow: { alignItems: "center", gap: 8, paddingVertical: 2 },
  chip: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20, borderWidth: 1.5,
    backgroundColor: "#FFFFFF",
  },
  chipText: { color: MUTED, fontFamily: "Nunito_600SemiBold", fontSize: 13 },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: CARD_GAP, marginTop: 18 },
  card: {
    width: CARD_W, minHeight: 188, borderRadius: 20, padding: 14,
    backgroundColor: CARD_BG, borderWidth: 2, borderColor: LINE,
    alignItems: "center", overflow: "hidden",
  },
  cardArtBox: {
    width: 100, height: 100, alignItems: "center", justifyContent: "center", marginTop: 2, marginBottom: 8,
  },
  cardTitle: { color: TEXT, fontFamily: "Nunito_800ExtraBold", fontSize: 16, marginTop: 2, textAlign: "center" },
  cardDesc: { color: MUTED, fontFamily: "Nunito_400Regular", fontSize: 12, marginTop: 4, lineHeight: 16, textAlign: "center" },

  // Mode picker
  sheetBackdrop: { flex: 1, backgroundColor: "#00000055", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: BG2, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 22, paddingBottom: Platform.OS === "web" ? 28 : 40,
    borderTopWidth: 1, borderColor: "#0000000F",
  },
  sheetHandle: { alignSelf: "center", width: 44, height: 5, borderRadius: 3, backgroundColor: "#00000022", marginBottom: 14 },
  sheetArtBox: { width: 104, height: 104, alignSelf: "center", alignItems: "center", justifyContent: "center" },
  sheetTitle: { color: TEXT, fontFamily: "Nunito_800ExtraBold", fontSize: 22, textAlign: "center", marginTop: 6 },
  sheetScene: { color: MUTED, fontFamily: "Nunito_400Regular", fontSize: 14, textAlign: "center", marginTop: 8, lineHeight: 20 },
  sheetChoose: { color: TEXT, fontFamily: "Nunito_700Bold", fontSize: 13, marginTop: 20, marginBottom: 10, letterSpacing: 0.5 },
  modeBtn: {
    height: 66, borderRadius: 18, overflow: "hidden", flexDirection: "row", alignItems: "center",
    paddingHorizontal: 18, gap: 14, marginBottom: 12,
  },
  modeBtnTextWrap: { flex: 1 },
  modeBtnTitle: { color: "#fff", fontFamily: "Nunito_800ExtraBold", fontSize: 16 },
  modeBtnSub: { color: "#FFFFFFCC", fontFamily: "Nunito_400Regular", fontSize: 12, marginTop: 2 },
  sheetCancel: { alignItems: "center", paddingVertical: 12, marginTop: 2 },
  sheetCancelText: { color: MUTED, fontFamily: "Nunito_600SemiBold", fontSize: 15 },

  // Spin overlay
  spinBackdrop: { flex: 1, backgroundColor: "#FFFFFFF7", alignItems: "center", justifyContent: "center", padding: 28 },
  spinLabel: { color: TEXT, fontFamily: "Nunito_800ExtraBold", fontSize: 22, marginBottom: 22 },
  spinCard: {
    width: Math.min(SW - 72, 300), minHeight: 240, borderRadius: 28, borderWidth: 2,
    borderColor: LINE,
    backgroundColor: CARD_BG, alignItems: "center", justifyContent: "center", padding: 22, overflow: "hidden",
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 20, shadowOffset: { width: 0, height: 8 } },
      android: { elevation: 8 }, default: {},
    }),
  },
  spinArtBox: { width: 132, height: 132, alignItems: "center", justifyContent: "center", marginBottom: 6 },
  spinTitle: { color: TEXT, fontFamily: "Nunito_800ExtraBold", fontSize: 22, textAlign: "center", marginTop: 10 },
  spinDesc: { color: MUTED, fontFamily: "Nunito_400Regular", fontSize: 13, textAlign: "center", marginTop: 8, lineHeight: 18 },
  spinPlayBtn: {
    marginTop: 28, height: 56, minWidth: 240, borderRadius: 28, overflow: "hidden",
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingHorizontal: 28,
  },
  spinPlayText: { color: "#3A2C00", fontFamily: "Nunito_800ExtraBold", fontSize: 16 },
  spinSkip: { paddingVertical: 14, marginTop: 4 },
  spinSkipText: { color: MUTED, fontFamily: "Nunito_600SemiBold", fontSize: 15 },
});
