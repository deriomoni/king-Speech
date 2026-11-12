// «Аудио-дневник» — Figma "Screen / 06 · Аудио-дневник" (406:1302) and the
// privacy sheet "06d · приватность" (424:1558).
// Plate: back chevron, (i) → privacy sheet, title, subtitle, yellow «Начать
// запись» pill. Backing: «Мои записи» + a 2-column grid of slightly rotated mini
// cassettes (date · duration under each). Tap a cassette to play it (key pressed
// + yellow, mouth → white waveform); tap again to stop. One plays at a time.
// Long-press a cassette: it lifts and jiggles (iOS home-screen style) and the
// delete confirmation appears; cancelling settles it back.
//
// PRIVATE: entries come from lib/diaryStorage (device only). They are
// intentionally NOT shown in «Моя библиотека» and never synced/uploaded.
import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Platform, Modal, useWindowDimensions } from "react-native";
import OverscrollFill from "@/components/OverscrollFill";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import Animated, {
  FadeIn,
  FadeInDown,
  SlideInDown,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useLang } from "@/context/LangContext";
import { useTheme } from "@/context/ThemeContext";
import AppDialog from "@/components/AppDialog";
import Cassette, { useDiaryFonts } from "@/components/diary/Cassette";
import { type DiaryEntry, loadDiary, deleteDiaryEntry, fmtClock } from "@/lib/diaryStorage";

let Audio: any = null;
if (Platform.OS !== "web") {
  Audio = require("@/lib/av").Audio;
}

const MONTHS_RU = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function fmtDiaryDate(ms: number, en: boolean) {
  const d = new Date(ms);
  return en ? `${MONTHS_EN[d.getMonth()]} ${d.getDate()}` : `${d.getDate()} ${MONTHS_RU[d.getMonth()]}`;
}

// ── Grid tile: long-press lifts + jiggles the cassette ──────────────────────
function CassetteTile({
  entry,
  width,
  playing,
  lifted,
  metaColor,
  en,
  onPress,
  onLongPress,
}: {
  entry: DiaryEntry;
  width: number;
  playing: boolean;
  lifted: boolean;
  metaColor: string;
  en: boolean;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const lift = useSharedValue(0);
  const wig = useSharedValue(0);
  useEffect(() => {
    if (lifted) {
      lift.value = withSpring(1, { damping: 14, stiffness: 240 });
      wig.value = withSequence(
        withTiming(-1, { duration: 60 }),
        withRepeat(withSequence(withTiming(1, { duration: 130 }), withTiming(-1, { duration: 130 })), -1, false),
      );
    } else {
      cancelAnimation(wig);
      wig.value = withTiming(0, { duration: 140 });
      lift.value = withTiming(0, { duration: 220 });
    }
    return () => cancelAnimation(wig);
  }, [lifted, lift, wig]);
  const tilt = entry.tilt ?? 0;
  const st = useAnimatedStyle(() => ({
    transform: [
      { translateY: -4 * lift.value },
      { scale: 1 + 0.06 * lift.value },
      { rotate: `${tilt + 2 * wig.value}deg` },
    ],
    // No shadow at rest (it would cost an offscreen pass per cassette).
    shadowOpacity: 0.3 * lift.value,
    shadowRadius: 4 + 10 * lift.value,
    shadowOffset: { width: 0, height: 2 + 8 * lift.value },
  }));
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={450}
      accessibilityRole="button"
      accessibilityLabel={`${playing ? (en ? "Stop" : "Стоп") : en ? "Play" : "Слушать"} ${entry.title}`}
      style={({ pressed }) => ({ opacity: pressed && !lifted ? 0.92 : 1 })}
    >
      <Animated.View style={[s.tileShadow, st]}>
        <Cassette width={width} title={entry.title} emotion={entry.emotion} state={playing ? "playing" : "idle"} showKey />
      </Animated.View>
      <Text style={[s.meta, { color: metaColor }]}>
        {fmtDiaryDate(entry.date, en)} · {fmtClock(entry.durationSec)}
      </Text>
    </Pressable>
  );
}

// ── One cassette at a time ────────────────────────────────────────────────────
function useDiaryPlayer() {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const webRef = useRef<HTMLAudioElement | null>(null);
  const soundRef = useRef<any>(null);
  // Source of truth for taps (state lags behind async starts) and a generation
  // counter so a start that is still loading gets cancelled by stop().
  const activeIdRef = useRef<string | null>(null);
  const genRef = useRef(0);

  const stop = useCallback(async () => {
    genRef.current += 1;
    activeIdRef.current = null;
    setPlayingId(null);
    if (webRef.current) {
      try {
        webRef.current.pause();
      } catch {}
      webRef.current = null;
    }
    if (soundRef.current) {
      const snd = soundRef.current;
      soundRef.current = null;
      try {
        await snd.pauseAsync?.();
      } catch {}
      try {
        await snd.unloadAsync();
      } catch {}
    }
  }, []);

  useEffect(() => () => void stop(), [stop]);

  const toggle = useCallback(
    async (e: DiaryEntry) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      const wasThis = activeIdRef.current === e.id;
      await stop();
      if (wasThis) return;
      const gen = genRef.current;
      activeIdRef.current = e.id;
      setPlayingId(e.id);
      try {
        if (Platform.OS === "web") {
          const a = new window.Audio(e.uri);
          webRef.current = a;
          a.onended = () => {
            if (webRef.current === a) void stop();
          };
          await a.play();
          if (gen !== genRef.current) a.pause();
        } else {
          try {
            await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
          } catch {}
          const { sound } = await Audio.Sound.createAsync({ uri: e.uri }, { shouldPlay: true });
          if (gen !== genRef.current) {
            // Stopped (second tap / left the screen) while it was loading.
            try {
              await sound.pauseAsync?.();
              await sound.unloadAsync();
            } catch {}
            return;
          }
          soundRef.current = sound;
          sound.setOnPlaybackStatusUpdate((st: any) => {
            if (st?.didJustFinish && soundRef.current === sound) void stop();
          });
        }
      } catch (err) {
        console.warn("[diary] playback failed:", err);
        if (gen === genRef.current) void stop();
      }
    },
    [stop],
  );

  return { playingId, toggle, stop };
}

export default function DiaryScreen() {
  const insets = useSafeAreaInsets();
  const { width: screenW } = useWindowDimensions();
  const { lang } = useLang();
  const en = lang === "en";
  const { theme: c } = useTheme();
  useDiaryFonts();
  const [entries, setEntries] = useState<DiaryEntry[] | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [toDelete, setToDelete] = useState<DiaryEntry | null>(null);
  const [liftedId, setLiftedId] = useState<string | null>(null);
  const liftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (liftTimer.current) clearTimeout(liftTimer.current);
  }, []);
  const { playingId, toggle, stop } = useDiaryPlayer();

  const topPad = Platform.OS === "web" ? 54 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const colW = Math.min(190, Math.floor((Math.min(screenW, 520) - 48 - 6) / 2));

  // Reload when coming back from the record flow; stop playback when leaving.
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      loadDiary().then((l) => alive && setEntries(l));
      return () => {
        alive = false;
        void stop();
      };
    }, [stop]),
  );

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/profile");
  };

  const startRecording = () => {
    void stop();
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    router.push("/diary-record");
  };

  // Long-press: lift + jiggle first, then ask.
  const askDelete = (e: DiaryEntry) => {
    // Stop whatever is playing right away (the held cassette included).
    if (playingId) void stop();
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setLiftedId(e.id);
    if (liftTimer.current) clearTimeout(liftTimer.current);
    liftTimer.current = setTimeout(() => setToDelete(e), 380);
  };

  const cancelDelete = () => {
    setToDelete(null);
    setLiftedId(null);
  };

  const confirmDelete = async () => {
    const e = toDelete;
    setToDelete(null);
    setLiftedId(null);
    if (!e) return;
    if (playingId === e.id) await stop();
    setEntries(await deleteDiaryEntry(e.id));
  };

  return (
    <View style={[s.container, { backgroundColor: c.backingTop }]}>
      <ScrollView contentContainerStyle={s.scrollOuter} showsVerticalScrollIndicator={false}>
        <OverscrollFill top={c.bg} bottom={c.backingBottom} />
        {/* Top plate */}
        <View style={[s.plate, { backgroundColor: c.bg, borderColor: c.panelStroke, paddingTop: topPad + 16 }]}>
          <Pressable onPress={goBack} hitSlop={12} style={[s.back, { top: topPad + 10 }]} accessibilityRole="button">
            <Ionicons name="chevron-back" size={26} color={c.text} />
          </Pressable>
          <Pressable
            onPress={() => setInfoOpen(true)}
            hitSlop={12}
            style={[s.infoBtn, { top: topPad + 16, borderColor: c.text }]}
            accessibilityRole="button"
            accessibilityLabel={en ? "About the diary" : "О дневнике"}
          >
            <Text style={[s.infoI, { color: c.text }]}>i</Text>
          </Pressable>
          <Text style={[s.title, { color: c.text }]}>{en ? "Audio diary" : "Аудио-дневник"}</Text>
          <Text style={[s.subtitle, { color: c.text }]}>{en ? "Your personal space" : "Твоё личное пространство"}</Text>
          <Pressable
            onPress={startRecording}
            style={({ pressed }) => [s.pill, { opacity: pressed ? 0.85 : 1 }]}
            accessibilityRole="button"
          >
            <Text style={s.pillText}>{en ? "Start recording" : "Начать запись"}</Text>
          </Pressable>
        </View>

        {/* Backing */}
        <View style={[s.body, { paddingBottom: bottomPad + 40 }]}>
          <LinearGradient
            colors={[c.backingTop, c.backingMid, c.backingBottom]}
            locations={[0, 0.65, 1]}
            style={s.backing}
            pointerEvents="none"
          />
          <Text style={[s.section, { color: c.text }]}>{en ? "My recordings" : "Мои записи"}</Text>
          {entries && entries.length === 0 ? (
            <View style={s.empty}>
              <Text style={[s.emptyTitle, { color: c.text }]}>{en ? "No cassettes yet" : "Пока нет кассет"}</Text>
              <Text style={[s.emptySub, { color: c.textMuted }]}>
                {en
                  ? "Tell how your day went — your first cassette will appear here."
                  : "Расскажи, как прошёл день, — и здесь появится первая кассета."}
              </Text>
            </View>
          ) : (
            <View style={s.grid}>
              {(entries ?? []).map((e, i) => (
                <Animated.View
                  key={e.id}
                  entering={FadeInDown.delay(60 + Math.min(i, 8) * 40).duration(360)}
                  style={{ width: colW }}
                >
                  <CassetteTile
                    entry={e}
                    width={colW}
                    playing={playingId === e.id}
                    lifted={liftedId === e.id}
                    metaColor={c.text}
                    en={en}
                    onPress={() => toggle(e)}
                    onLongPress={() => askDelete(e)}
                  />
                </Animated.View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Privacy sheet (06d) */}
      <Modal visible={infoOpen} transparent animationType="none" onRequestClose={() => setInfoOpen(false)}>
        <Animated.View entering={FadeIn.duration(200)} style={s.dim}>
          <Pressable style={s.fill} onPress={() => setInfoOpen(false)} />
          <Animated.View
            entering={SlideInDown.duration(280)}
            style={[s.sheet, { backgroundColor: c.bg, borderColor: c.panelStroke, paddingBottom: bottomPad + 22 + SHEET_TUCK }]}
          >
            <View style={[s.handle, { backgroundColor: c.textMuted }]} />
            <Text style={[s.sheetTitle, { color: c.text }]}>{en ? "Your private diary" : "Твой личный дневник"}</Text>
            <Text style={[s.sheetBody, { color: c.text }]}>
              {en
                ? "This is a place to share your thoughts and tell how your day went. It helps you learn to talk about yourself freely and honestly — and that's what matters most when you want to become a good storyteller.\n\nRecordings are stored only on your phone."
                : "Это место, где можно поделиться своими мыслями и рассказать, как прошёл твой день. Так ты учишься говорить о себе свободно и честно — а это главное, когда хочешь научиться рассказывать.\n\nЗаписи хранятся только на твоём телефоне."}
            </Text>
            <Pressable
              onPress={() => setInfoOpen(false)}
              style={({ pressed }) => [s.sheetBtn, { opacity: pressed ? 0.85 : 1 }]}
              accessibilityRole="button"
            >
              <Text style={s.pillText}>{en ? "Got it" : "Понятно"}</Text>
            </Pressable>
          </Animated.View>
        </Animated.View>
      </Modal>

      <AppDialog
        visible={!!toDelete}
        title={en ? "Delete this cassette?" : "Удалить кассету?"}
        message={
          en
            ? "The recording will be erased from your phone. This can't be undone."
            : "Запись сотрётся с телефона. Это нельзя отменить."
        }
        buttons={[
          { label: en ? "Delete" : "Удалить", onPress: confirmDelete, variant: "primary" },
          { label: en ? "Cancel" : "Отмена", onPress: cancelDelete, variant: "secondary" },
        ]}
        onRequestClose={cancelDelete}
      />
    </View>
  );
}

const SHEET_TUCK = 40;

const s = StyleSheet.create({
  container: { flex: 1 },
  scrollOuter: { flexGrow: 1 },
  fill: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  plate: {
    borderWidth: 1.5,
    borderTopWidth: 0,
    marginHorizontal: -1.5,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    paddingBottom: 28,
    zIndex: 1,
    alignItems: "center",
  },
  back: { position: "absolute", left: 16, width: 44, height: 44, justifyContent: "center", zIndex: 2 },
  infoBtn: {
    position: "absolute",
    right: 23,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  infoI: { fontSize: 12, lineHeight: 15, fontFamily: "Geologica_700Bold" },
  title: { fontSize: 30, letterSpacing: -0.5, fontFamily: "Geologica_800ExtraBold", marginTop: 34 },
  subtitle: { fontSize: 14, fontFamily: "Geologica_400Regular", marginTop: 2, opacity: 0.55 },
  pill: {
    marginTop: 28,
    height: 43,
    borderRadius: 22,
    paddingHorizontal: 22,
    backgroundColor: "#FFD857",
    alignItems: "center",
    justifyContent: "center",
  },
  pillText: { fontSize: 15, fontFamily: "Geologica_700Bold", color: "#262628" },

  body: { flexGrow: 1, paddingTop: 28, paddingHorizontal: 24 },
  backing: { position: "absolute", top: -40, left: 0, right: 0, bottom: 0 },
  section: { fontSize: 18, letterSpacing: -0.2, fontFamily: "Geologica_700Bold", marginBottom: 22 },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 22 },
  tileShadow: { shadowColor: "#000" },
  meta: { fontSize: 12, fontFamily: "Geologica_500Medium", marginTop: 8, marginLeft: 4, opacity: 0.5 },

  empty: { alignItems: "center", paddingTop: 30, paddingHorizontal: 16 },
  emptyTitle: { fontSize: 18, fontFamily: "Geologica_800ExtraBold" },
  emptySub: { fontSize: 13, lineHeight: 18, fontFamily: "Geologica_500Medium", textAlign: "center", marginTop: 6 },

  dim: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  // Uniform border + radius on the sheet itself, bottom edge tucked below the
  // screen: a translucent stroke with one side at 0 is drawn on iOS as separate
  // side polygons whose overlapping corner joins showed up as a seam.
  sheet: {
    borderWidth: 1.5,
    marginHorizontal: -1.5,
    marginBottom: -SHEET_TUCK,
    borderRadius: 32,
    paddingTop: 10,
    paddingHorizontal: 36,
    alignItems: "center",
  },
  handle: { width: 40, height: 5, borderRadius: 3, marginBottom: 29 },
  sheetTitle: { fontSize: 20, fontFamily: "Geologica_800ExtraBold", textAlign: "center" },
  sheetBody: {
    fontSize: 14,
    lineHeight: 21,
    fontFamily: "Geologica_400Regular",
    textAlign: "center",
    marginTop: 14,
    opacity: 0.65,
  },
  sheetBtn: {
    marginTop: 28,
    height: 45,
    borderRadius: 24,
    paddingHorizontal: 40,
    backgroundColor: "#FFD857",
    alignItems: "center",
    justifyContent: "center",
  },
});
