// «Аудио-дневник» — Figma "Screen / 06 · Аудио-дневник" (406:1302) and the
// privacy sheet "06d · приватность" (424:1558).
// Plate: back chevron, (i) → privacy sheet, title, subtitle, yellow «Начать
// запись» pill. Backing: «Мои записи» + a 2-column grid of slightly rotated mini
// cassettes (date · duration under each). Tap a cassette to play it (key pressed
// + yellow, mouth → white waveform); tap again to stop. One plays at a time.
// Long-press a cassette to delete it.
//
// PRIVATE: entries come from lib/diaryStorage (device only). They are
// intentionally NOT shown in «Моя библиотека» and never synced/uploaded.
import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Platform, Modal, useWindowDimensions } from "react-native";
import OverscrollFill from "@/components/OverscrollFill";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import Animated, { FadeIn, FadeInDown, SlideInDown } from "react-native-reanimated";
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

// ── One cassette at a time ────────────────────────────────────────────────────
function useDiaryPlayer() {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const webRef = useRef<HTMLAudioElement | null>(null);
  const soundRef = useRef<any>(null);

  const stop = useCallback(async () => {
    if (webRef.current) {
      webRef.current.pause();
      webRef.current = null;
    }
    if (soundRef.current) {
      const snd = soundRef.current;
      soundRef.current = null;
      try {
        await snd.unloadAsync();
      } catch {}
    }
    setPlayingId(null);
  }, []);

  useEffect(() => () => void stop(), [stop]);

  const toggle = useCallback(
    async (e: DiaryEntry) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      const wasThis = playingId === e.id;
      await stop();
      if (wasThis) return;
      try {
        if (Platform.OS === "web") {
          const a = new window.Audio(e.uri);
          webRef.current = a;
          a.onended = () => {
            if (webRef.current === a) {
              webRef.current = null;
              setPlayingId(null);
            }
          };
          await a.play();
        } else {
          try {
            await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
          } catch {}
          const { sound } = await Audio.Sound.createAsync({ uri: e.uri }, { shouldPlay: true });
          soundRef.current = sound;
          sound.setOnPlaybackStatusUpdate((st: any) => {
            if (st?.didJustFinish && soundRef.current === sound) void stop();
          });
        }
        setPlayingId(e.id);
      } catch (err) {
        console.warn("[diary] playback failed:", err);
        setPlayingId(null);
      }
    },
    [playingId, stop],
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

  const confirmDelete = async () => {
    const e = toDelete;
    setToDelete(null);
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
                  <Pressable
                    onPress={() => toggle(e)}
                    onLongPress={() => setToDelete(e)}
                    delayLongPress={450}
                    accessibilityRole="button"
                    accessibilityLabel={`${playingId === e.id ? (en ? "Stop" : "Стоп") : en ? "Play" : "Слушать"} ${e.title}`}
                    style={({ pressed }) => ({ opacity: pressed ? 0.92 : 1 })}
                  >
                    <View style={{ transform: [{ rotate: `${e.tilt ?? 0}deg` }] }}>
                      <Cassette
                        width={colW}
                        title={e.title}
                        emotion={e.emotion}
                        state={playingId === e.id ? "playing" : "idle"}
                        showKey
                      />
                    </View>
                    <Text style={[s.meta, { color: c.text }]}>
                      {fmtDiaryDate(e.date, en)} · {fmtClock(e.durationSec)}
                    </Text>
                  </Pressable>
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
            style={[s.sheet, { backgroundColor: c.bg, borderColor: c.panelStroke, paddingBottom: bottomPad + 22 }]}
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
          { label: en ? "Cancel" : "Отмена", onPress: () => setToDelete(null), variant: "secondary" },
        ]}
        onRequestClose={() => setToDelete(null)}
      />
    </View>
  );
}

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
  meta: { fontSize: 12, fontFamily: "Geologica_500Medium", marginTop: 8, marginLeft: 4, opacity: 0.5 },

  empty: { alignItems: "center", paddingTop: 30, paddingHorizontal: 16 },
  emptyTitle: { fontSize: 18, fontFamily: "Geologica_800ExtraBold" },
  emptySub: { fontSize: 13, lineHeight: 18, fontFamily: "Geologica_500Medium", textAlign: "center", marginTop: 6 },

  dim: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  sheet: {
    borderWidth: 1.5,
    borderBottomWidth: 0,
    marginHorizontal: -1.5,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
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
