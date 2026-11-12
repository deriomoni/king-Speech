// Roles catalogue — Figma "Screen / 09 · Роли" (430:1923).
// Dark crown-ornament screen: spin deck («Вытянуть роль») + grid of tarot cards.
// Picking a card (or landing the spin) opens «Твоя роль» (/role-brief).
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
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "@/lib/haptics";
import { router } from "expo-router";
import Animated, {
  FadeIn,
  FadeInDown,
  ZoomIn,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { useLang } from "@/context/LangContext";
import { useRoles } from "@/context/RolesContext";
import {
  ROLES,
  ROLE_CATEGORIES,
  type Role,
  type RoleCategory,
  tx,
  pickWeightedRole,
  getRoleById,
} from "@/constants/rolesData";
import { hasRoleArt } from "@/components/roles/RoleArt";
import {
  RoleTarotCard,
  LockedRoleCard,
  RolePlayCard,
  CrownPattern,
  CROWN_PATTERN_PERIOD,
  ROLES_BG,
} from "@/components/roles/RoleTarotCard";
import { RolesMaskIcon } from "@/components/showtime/ShowTimeIcons";

const { width: SW, height: SH } = Dimensions.get("window");
const CARD_GAP = 12;
const H_PAD = 16;
const CONTENT_W = Math.min(SW, 520);
const CARD_W = Math.floor((CONTENT_W - H_PAD * 2 - CARD_GAP) / 2);
const DECK_W = Math.round(Math.min(CONTENT_W * 0.36, 170)); // centre card
const SIDE_W = Math.round(DECK_W * 0.9);
const SPIN_W = Math.round(Math.min(SW * 0.6, 260));

const TEXT = "#FFFFFF";
const MUTED = "rgba(255,255,255,0.55)";
const HAIR = "rgba(255,255,255,0.18)";

// Only roles that already have supplied artwork are shown.
const ART_ROLES = ROLES.filter((r) => hasRoleArt(r.id));

// Locked state (Figma «ЗАКРЫТО» card). The app has no lock mechanic yet — every
// role is playable — so this is off. Flip to lock roles the player hasn't
// collected (performed) yet.
const LOCK_UNCOLLECTED = false;

// The two real cards fanned behind the «Role Play» card (as in Figma).
const DECK_SIDES: Role[] = [
  getRoleById("showman") ?? ART_ROLES[0],
  getRoleById("moviestar") ?? ART_ROLES[1] ?? ART_ROLES[0],
];

function haptic(style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) {
  if (Platform.OS !== "web") Haptics.impactAsync(style).catch(() => {});
}

function openBrief(role: Role) {
  router.push({ pathname: "/role-brief", params: { roleId: role.id } });
}

// ---------------------------------------------------------------------------
// Spin overlay — cards flick past, decelerate and land; then «Твоя роль».
// ---------------------------------------------------------------------------
function SpinOverlay({ onClose, onLanded }: { onClose: () => void; onLanded: (role: Role) => void }) {
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
          timeouts.current.push(setTimeout(() => onLanded(winner), 900));
        } else {
          setCurrent(ART_ROLES[Math.floor(Math.random() * ART_ROLES.length)]);
          if (Platform.OS !== "web" && i % 2 === 0) haptic(Haptics.ImpactFeedbackStyle.Light);
        }
      }, at);
      timeouts.current.push(t);
      delay = Math.min(320, delay * 1.14); // decelerate
    }
    return () => { timeouts.current.forEach(clearTimeout); timeouts.current = []; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.spinBackdrop}>
        <CrownPattern width={SW} height={SH} />
        <Text style={styles.spinLabel}>
          {done ? (lang === "en" ? "YOUR ROLE" : "ТВОЯ РОЛЬ") : (lang === "en" ? "DRAWING..." : "ТЯНЕМ КАРТУ...")}
        </Text>
        <Animated.View
          key={current.id + (done ? "-done" : "")}
          entering={done ? ZoomIn.duration(420) : FadeIn.duration(60)}
          style={{ transform: [{ rotate: "-2deg" }] }}
        >
          <RoleTarotCard role={current} width={SPIN_W} lang={lang} />
        </Animated.View>
        <Pressable onPress={onClose} hitSlop={10} style={styles.spinSkip}>
          <Text style={styles.spinSkipText}>{lang === "en" ? "Close" : "Закрыть"}</Text>
        </Pressable>
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
  const [spinning, setSpinning] = useState(false);
  // The ornament is one screen-sized layer behind the list, shifted by the
  // scroll offset modulo its period — it looks like it scrolls with the
  // content (and keeps going into the iOS bounce) without drawing a
  // content-tall SVG.
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollY.value = e.contentOffset.y;
    },
  });
  const ornamentStyle = useAnimatedStyle(() => {
    const m = ((scrollY.value % CROWN_PATTERN_PERIOD) + CROWN_PATTERN_PERIOD) % CROWN_PATTERN_PERIOD;
    return { transform: [{ translateY: -m }] };
  });

  const topPad = Platform.OS === "web" ? 20 : insets.top + 4;
  const bottomPad = (Platform.OS === "web" ? 24 : insets.bottom) + 32;

  const visibleRoles = category === "all" ? ART_ROLES : ART_ROLES.filter((r) => r.category === category);

  const onLanded = useCallback((role: Role) => {
    setSpinning(false);
    openBrief(role);
  }, []);

  const startSpin = () => { haptic(Haptics.ImpactFeedbackStyle.Medium); setSpinning(true); };

  return (
    <View style={styles.root}>
      {/* Ornament follows the scroll (see ornamentStyle) */}
      <Animated.View pointerEvents="none" style={[styles.ornament, ornamentStyle]}>
        <CrownPattern width={SW} height={SH + CROWN_PATTERN_PERIOD} />
      </Animated.View>
      <Animated.ScrollView
        contentContainerStyle={{ paddingTop: topPad, paddingBottom: bottomPad }}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >

        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.iconBtn}>
            <Ionicons name="chevron-back" size={26} color={TEXT} />
          </Pressable>
        </View>
        <Animated.View entering={FadeInDown.duration(400)} style={styles.titleWrap}>
          <View style={styles.titleRow}>
            <RolesMaskIcon color={TEXT} width={22} height={30} />
            <Text style={styles.title}>{lang === "en" ? "Roles" : "Роли"}</Text>
          </View>
          <Text style={styles.subtitle}>
            {lang === "en"
              ? "Try on someone else's persona and level up your improv"
              : "Примерь чужой образ и прокачай импровизацию"}
          </Text>
        </Animated.View>

        {/* Spin deck */}
        <Animated.View entering={FadeInDown.delay(80)}>
          <Pressable onPress={startSpin} style={styles.deck}>
            <View style={[styles.deckSide, { transform: [{ translateX: -DECK_W * 0.78 }, { translateY: 14 }, { rotate: "-12deg" }] }]}>
              <RoleTarotCard role={DECK_SIDES[0]} width={SIDE_W} lang={lang} />
            </View>
            <View style={[styles.deckSide, { transform: [{ translateX: DECK_W * 0.78 }, { translateY: 14 }, { rotate: "12deg" }] }]}>
              <RoleTarotCard role={DECK_SIDES[1]} width={SIDE_W} lang={lang} />
            </View>
            <View style={styles.deckCentre}>
              <RolePlayCard width={DECK_W} />
            </View>
          </Pressable>
          <Pressable onPress={startSpin} style={({ pressed }) => [styles.spinCta, { opacity: pressed ? 0.85 : 1 }]}>
            <Text style={styles.spinCtaText}>{lang === "en" ? "Draw a role" : "Вытянуть роль"}</Text>
          </Pressable>
        </Animated.View>

        {/* All roles */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>{lang === "en" ? "All roles" : "Все роли"}</Text>
          <Text style={styles.sectionCount}>{ART_ROLES.length}</Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
          <CategoryChip active={category === "all"} label={lang === "en" ? "All" : "Все"} onPress={() => { haptic(); setCategory("all"); }} />
          {ROLE_CATEGORIES.filter((c) => ART_ROLES.some((r) => r.category === c.id)).map((c) => (
            <CategoryChip
              key={c.id}
              active={category === c.id}
              label={tx(c.label, lang)}
              onPress={() => { haptic(); setCategory(c.id); }}
            />
          ))}
        </ScrollView>

        <View style={styles.grid}>
          {visibleRoles.map((role, i) => {
            const locked = LOCK_UNCOLLECTED && !isCollected(role.id);
            return (
              <Animated.View key={role.id} entering={FadeInDown.delay(Math.min(i * 30, 300))}>
                {locked ? (
                  <LockedRoleCard width={CARD_W} lang={lang} />
                ) : (
                  <Pressable
                    onPress={() => { haptic(); openBrief(role); }}
                    style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.97 : 1 }] })}
                  >
                    <RoleTarotCard role={role} width={CARD_W} lang={lang} />
                  </Pressable>
                )}
              </Animated.View>
            );
          })}
        </View>
      </Animated.ScrollView>

      {spinning && <SpinOverlay onClose={() => setSpinning(false)} onLanded={onLanded} />}
    </View>
  );
}

function CategoryChip({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active ? styles.chipOn : styles.chipOff]}>
      <Text style={[styles.chipText, { color: active ? "#141416" : "rgba(255,255,255,0.8)" }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: ROLES_BG },
  ornament: { position: "absolute", top: 0, left: 0, width: SW, height: SH + CROWN_PATTERN_PERIOD },
  header: { paddingHorizontal: H_PAD - 4, paddingBottom: 4 },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  titleWrap: { alignItems: "center", paddingHorizontal: H_PAD },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  title: { color: TEXT, fontFamily: "Geologica_800ExtraBold", fontSize: 30, letterSpacing: -0.3 },
  subtitle: { color: MUTED, fontFamily: "Geologica_400Regular", fontSize: 13, marginTop: 8, textAlign: "center" },

  deck: { height: Math.round(DECK_W * 1.5) + 24, alignItems: "center", justifyContent: "center", marginTop: 22 },
  deckSide: { position: "absolute" },
  deckCentre: {
    borderRadius: Math.round(DECK_W * 0.075),
    backgroundColor: "#7A3BF0",
    ...Platform.select({
      ios: { shadowColor: "#7A3BF0", shadowOpacity: 0.55, shadowRadius: 24, shadowOffset: { width: 0, height: 10 } },
      android: { elevation: 12 },
      default: {},
    }),
  },
  spinCta: {
    alignSelf: "center", marginTop: 18, height: 52, paddingHorizontal: 34, borderRadius: 26,
    backgroundColor: "#000000", borderWidth: 1, borderColor: HAIR,
    alignItems: "center", justifyContent: "center",
  },
  spinCtaText: { color: "#FFFFFF", fontFamily: "Geologica_700Bold", fontSize: 16 },

  sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: H_PAD, marginTop: 30 },
  sectionTitle: { color: TEXT, fontFamily: "Geologica_700Bold", fontSize: 19 },
  sectionCount: { color: MUTED, fontFamily: "Geologica_600SemiBold", fontSize: 14 },

  chipsRow: { alignItems: "center", gap: 8, paddingHorizontal: H_PAD, paddingTop: 12, paddingBottom: 2 },
  chip: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20, borderWidth: 1 },
  chipOn: { backgroundColor: "#F0EEE9", borderColor: "#F0EEE9" },
  chipOff: { backgroundColor: "rgba(255,255,255,0.07)", borderColor: "rgba(255,255,255,0.10)" },
  chipText: { fontFamily: "Geologica_600SemiBold", fontSize: 13 },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: CARD_GAP, marginTop: 16, paddingHorizontal: H_PAD },

  spinBackdrop: { flex: 1, backgroundColor: "rgba(20,20,22,0.97)", alignItems: "center", justifyContent: "center", padding: 28 },
  spinLabel: { color: MUTED, fontFamily: "Geologica_700Bold", fontSize: 12, letterSpacing: 2, marginBottom: 24 },
  spinSkip: { paddingVertical: 14, marginTop: 28 },
  spinSkipText: { color: MUTED, fontFamily: "Geologica_600SemiBold", fontSize: 15 },
});
