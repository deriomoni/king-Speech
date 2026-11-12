// «Моя библиотека» — Figma "Screen / 08 · Моя библиотека" (427:1778 dark, Light mode instance).
// Plate header + filter chips, then recording rows grouped «На этой неделе» /
// «Раньше» on the backing gradient. Each row: a small vinyl disc whose label is
// the play button (playing = yellow label with pause + yellow progress bar),
// title, mode · date, duration. No ratings.
//
// Data: GameContext.readingRecordings (dated, with duration) and
// GameContext.showTimeRecordings (rank → takes; no date/duration stored, so
// they sort into «Раньше» and the duration appears once the take is loaded).
// Interview and Roles takes are not persisted anywhere yet → those filters show
// the empty state. TODO(library): add them once those modes save recordings.
//
// Long-press a row: it lifts and wiggles (like the diary cassettes), playback
// stops, and an AppDialog confirms deleting the take (store entry + audio file).
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Platform } from "react-native";
import OverscrollFill from "@/components/OverscrollFill";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import Animated, {
  cancelAnimation,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "@/lib/haptics";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { useGame } from "@/context/GameContext";
import { useLang } from "@/context/LangContext";
import { useTheme } from "@/context/ThemeContext";
import AppDialog from "@/components/AppDialog";
import { deleteRecordingFile } from "@/lib/recordingFiles";

let Audio: any = null;
if (Platform.OS !== "web") {
  Audio = require("@/lib/av").Audio;
}

type Mode = "showtime" | "reading" | "interview" | "roles";
type Filter = "all" | Mode;

const FILTERS: { key: Filter; ru: string; en: string }[] = [
  { key: "all", ru: "Все", en: "All" },
  { key: "showtime", ru: "Show Time", en: "Show Time" },
  { key: "reading", ru: "Чтение", en: "Reading" },
  { key: "interview", ru: "Интервью", en: "Interview" },
  { key: "roles", ru: "Роли", en: "Roles" },
];

const MODE_LABEL: Record<Mode, { ru: string; en: string }> = {
  showtime: { ru: "Show Time", en: "Show Time" },
  reading: { ru: "Чтение", en: "Reading" },
  interview: { ru: "Интервью", en: "Interview" },
  roles: { ru: "Роли", en: "Roles" },
};

type Item = {
  id: string;
  uri: string;
  title: string;
  mode: Mode;
  /** Show Time takes are stored per rank. */
  rank?: number;
  date?: number;
  durationSec?: number;
};

const WEEK_MS = 7 * 86400000;

function fmtDuration(sec?: number) {
  if (!sec || sec <= 0 || !Number.isFinite(sec)) return "";
  const v = Math.round(sec);
  return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, "0")}`;
}

/** Remaining time while playing: «−1:23». */
function fmtRemaining(sec: number) {
  const v = Math.max(0, Math.ceil(sec));
  return `−${Math.floor(v / 60)}:${String(v % 60).padStart(2, "0")}`;
}

function fmtDate(ms: number, en: boolean) {
  try {
    return new Date(ms)
      .toLocaleDateString(en ? "en-US" : "ru-RU", { day: "numeric", month: "short" })
      .replace(".", "");
  } catch {
    return "";
  }
}

// ── Single shared player: one take plays at a time ────────────────────────────
function useLibraryPlayer() {
  const [playingUri, setPlayingUri] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [durations, setDurations] = useState<Record<string, number>>({});
  const webRef = useRef<HTMLAudioElement | null>(null);
  const soundRef = useRef<any>(null);
  const loadedUri = useRef<string | null>(null);

  const unload = useCallback(async () => {
    if (Platform.OS === "web") {
      webRef.current?.pause();
      webRef.current = null;
    } else if (soundRef.current) {
      try {
        await soundRef.current.unloadAsync();
      } catch {}
      soundRef.current = null;
    }
    loadedUri.current = null;
  }, []);

  useEffect(() => () => void unload(), [unload]);

  const noteDuration = (uri: string, sec: number) => {
    if (sec > 0 && Number.isFinite(sec)) setDurations((d) => (d[uri] === sec ? d : { ...d, [uri]: sec }));
  };

  const toggle = useCallback(
    async (uri: string) => {
      if (!uri) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      // Pause the current take.
      if (playingUri === uri) {
        if (Platform.OS === "web") webRef.current?.pause();
        else {
          try {
            await soundRef.current?.pauseAsync();
          } catch {}
        }
        setPlayingUri(null);
        return;
      }
      if (loadedUri.current !== uri) {
        await unload();
        setProgress(0);
      }
      try {
        if (Platform.OS === "web") {
          if (!webRef.current) {
            const a = new window.Audio(uri);
            webRef.current = a;
            loadedUri.current = uri;
            a.ondurationchange = () => noteDuration(uri, a.duration);
            a.ontimeupdate = () => a.duration > 0 && setProgress(a.currentTime / a.duration);
            a.onended = () => {
              setPlayingUri(null);
              setProgress(0);
            };
          }
          await webRef.current.play();
        } else {
          try {
            await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
          } catch {}
          if (!soundRef.current) {
            const { sound } = await Audio.Sound.createAsync(
              { uri },
              { shouldPlay: false, progressUpdateIntervalMillis: 250 },
            );
            soundRef.current = sound;
            loadedUri.current = uri;
            sound.setOnPlaybackStatusUpdate((st: any) => {
              if (!st?.isLoaded) return;
              if (st.durationMillis) {
                noteDuration(uri, st.durationMillis / 1000);
                setProgress((st.positionMillis ?? 0) / st.durationMillis);
              }
              if (st.didJustFinish) {
                setPlayingUri(null);
                setProgress(0);
                sound.setPositionAsync(0).catch(() => {});
              }
            });
          }
          await soundRef.current.playAsync();
        }
        setPlayingUri(uri);
      } catch (e) {
        console.warn("[library] playback failed:", e);
        setPlayingUri(null);
      }
    },
    [playingUri, unload],
  );

  const stop = useCallback(async () => {
    await unload();
    setPlayingUri(null);
    setProgress(0);
  }, [unload]);

  return { playingUri, progress, durations, toggle, stop };
}

// ── Row: long-press lifts + wiggles it (same feel as the diary cassettes) ─────
function LiftRow({
  lifted,
  onPress,
  onLongPress,
  style,
  accessibilityLabel,
  children,
}: {
  lifted: boolean;
  onPress: () => void;
  onLongPress: () => void;
  style: object;
  accessibilityLabel: string;
  children: React.ReactNode;
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
  const st = useAnimatedStyle(() => ({
    transform: [
      { translateY: -4 * lift.value },
      { scale: 1 + 0.03 * lift.value },
      // A wide row reads as a big swing at the cassettes' 2°: keep it subtle.
      { rotate: `${0.7 * wig.value}deg` },
    ],
    shadowColor: "#000",
    shadowOpacity: 0.28 * lift.value,
    shadowRadius: 4 + 10 * lift.value,
    shadowOffset: { width: 0, height: 2 + 8 * lift.value },
  }));
  return (
    <Animated.View style={st}>
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={450}
        style={({ pressed }) => [style, { opacity: pressed && !lifted ? 0.9 : 1 }]}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

// ── Vinyl disc with the play/pause label ──────────────────────────────────────
function Vinyl({ playing }: { playing: boolean }) {
  return (
    <View style={s.vinyl}>
      <Svg width={54} height={54} viewBox="0 0 54 54">
        <Circle cx={27} cy={27} r={27} fill="#111113" />
        <Circle cx={27} cy={27} r={26.25} stroke="rgba(255,255,255,0.10)" strokeWidth={1.5} fill="none" />
        {[22, 19, 16].map((r) => (
          <Circle key={r} cx={27} cy={27} r={r} stroke="rgba(255,255,255,0.07)" strokeWidth={1} fill="none" />
        ))}
        <Path d="M12 15 A19 19 0 0 1 24 8.5" stroke="rgba(255,255,255,0.16)" strokeWidth={1.5} fill="none" strokeLinecap="round" />
        <Circle cx={27} cy={27} r={12} fill={playing ? "#FFD857" : "#F0EEE9"} />
        {playing ? (
          <>
            <Rect x={22.6} y={22} width={3.2} height={10} rx={1.4} fill="#262628" />
            <Rect x={28.2} y={22} width={3.2} height={10} rx={1.4} fill="#262628" />
          </>
        ) : (
          // Triangle bbox is x 24.6–33.2 (w 8.6): centre it on the label (27)
          // plus ~w/6 to the right so it reads optically centred.
          <Path
            d="M24.6 22.4c0-.9.97-1.45 1.75-1l6.3 3.65c.77.45.77 1.56 0 2l-6.3 3.65c-.78.45-1.75-.11-1.75-1z"
            fill="#262628"
            transform="translate(-0.5 0.95)"
          />
        )}
      </Svg>
    </View>
  );
}

export default function LibraryScreen() {
  const insets = useSafeAreaInsets();
  const { lang } = useLang();
  const en = lang === "en";
  const { theme: c } = useTheme();
  const { readingRecordings, showTimeRecordings, removeReadingRecording, removeShowTimeRecording } = useGame();
  const [filter, setFilter] = useState<Filter>("all");
  const { playingUri, progress, durations, toggle, stop } = useLibraryPlayer();
  const [liftedId, setLiftedId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<Item | null>(null);
  const liftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (liftTimer.current) clearTimeout(liftTimer.current);
    },
    [],
  );

  // Long-press: stop playback, lift + wiggle the row, then ask.
  const askDelete = (it: Item) => {
    if (playingUri) void stop();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setLiftedId(it.id);
    if (liftTimer.current) clearTimeout(liftTimer.current);
    liftTimer.current = setTimeout(() => setToDelete(it), 380);
  };

  const cancelDelete = () => {
    setToDelete(null);
    setLiftedId(null);
  };

  const confirmDelete = async () => {
    const it = toDelete;
    setToDelete(null);
    setLiftedId(null);
    if (!it) return;
    if (playingUri === it.uri) await stop();
    if (it.mode === "reading") removeReadingRecording(it.uri);
    else if (it.mode === "showtime" && it.rank != null) removeShowTimeRecording(it.rank, it.uri);
    await deleteRecordingFile(it.uri);
  };

  const topPad = Platform.OS === "web" ? 54 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const items = useMemo<Item[]>(() => {
    const out: Item[] = [];
    for (const r of readingRecordings) {
      out.push({
        id: `r:${r.uri}`,
        uri: r.uri,
        title: `«${r.title}»`,
        mode: "reading",
        date: r.date,
        durationSec: r.durationSec,
      });
    }
    for (const [rank, list] of Object.entries(showTimeRecordings ?? {})) {
      (list ?? []).forEach((rec, i) => {
        if (!rec?.uri) return;
        out.push({
          id: `s:${rank}:${rec.uri}`,
          uri: rec.uri,
          rank: Number(rank),
          title: rec.label?.trim() || (en ? `Rank ${rank} · take ${i + 1}` : `Ранг ${rank} · дубль ${i + 1}`),
          mode: "showtime",
        });
      });
    }
    return out.sort((a, b) => (b.date ?? 0) - (a.date ?? 0));
  }, [readingRecordings, showTimeRecordings, en]);

  const visible = filter === "all" ? items : items.filter((it) => it.mode === filter);
  const now = Date.now();
  const thisWeek = visible.filter((it) => it.date && now - it.date < WEEK_MS);
  const earlier = visible.filter((it) => !(it.date && now - it.date < WEEK_MS));

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/profile");
  };

  const renderRow = (it: Item, i: number) => {
    const playing = playingUri === it.uri;
    const totalSec = durations[it.uri] ?? it.durationSec;
    // While playing: count down the remaining time; stopped: the duration.
    const dur =
      playing && totalSec && totalSec > 0
        ? fmtRemaining(totalSec * (1 - Math.min(1, Math.max(0, progress))))
        : fmtDuration(it.durationSec ?? durations[it.uri]);
    const meta = [en ? MODE_LABEL[it.mode].en : MODE_LABEL[it.mode].ru, it.date ? fmtDate(it.date, en) : ""]
      .filter(Boolean)
      .join(" · ");
    return (
      <Animated.View key={it.id} entering={FadeInDown.delay(80 + Math.min(i, 8) * 40).duration(360)}>
        <LiftRow
          lifted={liftedId === it.id}
          onPress={() => toggle(it.uri)}
          onLongPress={() => askDelete(it)}
          style={[s.row, { borderColor: c.tileStroke }]}
          accessibilityLabel={`${playing ? (en ? "Pause" : "Пауза") : en ? "Play" : "Слушать"} ${it.title}`}
        >
          <LinearGradient colors={[c.tileTop, c.tileBottom]} style={s.fill} pointerEvents="none" />
          <Vinyl playing={playing} />
          <View style={s.rowText}>
            <Text style={[s.rowTitle, { color: c.text }]} numberOfLines={1}>
              {it.title}
            </Text>
            <Text style={[s.rowMeta, { color: c.textMuted }]} numberOfLines={1}>
              {meta}
            </Text>
            {playing && (
              <View style={[s.progressTrack, { backgroundColor: c.divider }]}>
                <View style={[s.progressFill, { width: `${Math.max(2, Math.min(100, progress * 100))}%` }]} />
              </View>
            )}
          </View>
          <Text style={[s.rowDur, { color: c.text, fontVariant: ["tabular-nums"] }]}>{dur}</Text>
        </LiftRow>
      </Animated.View>
    );
  };

  return (
    <View style={[s.container, { backgroundColor: c.backingTop }]}>
      <ScrollView contentContainerStyle={s.scrollOuter} showsVerticalScrollIndicator={false}>
        <OverscrollFill top={c.bg} bottom={c.backingBottom} />
        {/* Top plate (Figma "Top panel" 427:1780) */}
        <View style={[s.plate, { backgroundColor: c.bg, borderColor: c.panelStroke, paddingTop: topPad + 10 }]}>
          <Pressable onPress={goBack} hitSlop={12} style={[s.back, { top: topPad + 10 }]} accessibilityRole="button">
            <Ionicons name="chevron-back" size={26} color={c.text} />
          </Pressable>
          <Text style={[s.title, { color: c.text }]}>{en ? "My library" : "Моя библиотека"}</Text>
          <Text style={[s.subtitle, { color: c.textMuted }]}>
            {en ? "Performances you saved" : "Выступления, которые ты сохранил"}
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            alwaysBounceHorizontal={false}
            style={s.chipsScroll}
            contentContainerStyle={s.chips}
          >
            {FILTERS.map((f) => {
              const active = f.key === filter;
              return (
                <Pressable
                  key={f.key}
                  onPress={() => {
                    setFilter(f.key);
                    if (Platform.OS !== "web") Haptics.selectionAsync();
                  }}
                  style={[
                    s.chip,
                    active
                      ? { backgroundColor: c.text, borderColor: c.text }
                      : { backgroundColor: c.card, borderColor: c.cardBorder },
                  ]}
                >
                  <Text style={[s.chipText, { color: active ? c.bg : c.textSecondary }]}>{en ? f.en : f.ru}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Backing (Figma 427:1779) */}
        <View style={[s.body, { paddingBottom: bottomPad + 40 }]}>
          <LinearGradient
            colors={[c.backingTop, c.backingMid, c.backingBottom]}
            locations={[0, 0.65, 1]}
            style={s.backing}
            pointerEvents="none"
          />
          {visible.length === 0 ? (
            <View style={s.empty}>
              <Text style={[s.emptyTitle, { color: c.text }]}>{en ? "Nothing here yet" : "Пока пусто"}</Text>
              <Text style={[s.emptySub, { color: c.textMuted }]}>
                {filter === "interview" || filter === "roles"
                  ? en
                    ? "Recordings from this mode will appear here soon."
                    : "Записи из этого режима скоро появятся здесь."
                  : en
                    ? "Record a performance and it will appear here."
                    : "Запиши выступление — и оно появится здесь."}
              </Text>
            </View>
          ) : (
            <>
              {thisWeek.length > 0 && (
                <>
                  <Text style={[s.section, { color: c.text }]}>{en ? "This week" : "На этой неделе"}</Text>
                  <View style={s.list}>{thisWeek.map(renderRow)}</View>
                </>
              )}
              {earlier.length > 0 && (
                <>
                  <Text style={[s.section, { color: c.text, marginTop: thisWeek.length ? 26 : 0 }]}>
                    {thisWeek.length ? (en ? "Earlier" : "Раньше") : en ? "Recordings" : "Записи"}
                  </Text>
                  <View style={s.list}>{earlier.map((it, i) => renderRow(it, i + thisWeek.length))}</View>
                </>
              )}
            </>
          )}
        </View>
      </ScrollView>

      <AppDialog
        visible={!!toDelete}
        title={en ? "Delete this recording?" : "Удалить запись?"}
        message={
          toDelete
            ? en
              ? `${toDelete.title} will be deleted for good.`
              : `${toDelete.title} удалится навсегда.`
            : undefined
        }
        onRequestClose={cancelDelete}
        buttons={[
          { label: en ? "Cancel" : "Отмена", onPress: cancelDelete },
          { label: en ? "Delete" : "Удалить", variant: "primary", onPress: () => void confirmDelete() },
        ]}
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
    paddingBottom: 22,
    zIndex: 1,
    alignItems: "center",
  },
  back: { position: "absolute", left: 16, width: 44, height: 44, justifyContent: "center", zIndex: 2 },
  title: { fontSize: 32, letterSpacing: -0.5, fontFamily: "Geologica_800ExtraBold", marginTop: 38 },
  subtitle: { fontSize: 14, fontFamily: "Geologica_500Medium", marginTop: 2 },
  chipsScroll: { marginTop: 28, alignSelf: "stretch" },
  chips: { paddingHorizontal: 20, gap: 8 },
  chip: { height: 36, borderRadius: 18, borderWidth: 1, paddingHorizontal: 15, justifyContent: "center" },
  chipText: { fontSize: 13, fontFamily: "Geologica_700Bold" },

  body: { flexGrow: 1, paddingTop: 34, paddingHorizontal: 24 },
  backing: { position: "absolute", top: -40, left: 0, right: 0, bottom: 0 },
  section: { fontSize: 19, letterSpacing: -0.2, fontFamily: "Geologica_800ExtraBold", marginBottom: 13 },
  list: { gap: 12 },

  row: {
    height: 84,
    borderRadius: 22,
    borderWidth: 1,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 14,
    paddingRight: 18,
  },
  vinyl: { width: 54, height: 54 },
  rowText: { flex: 1, marginLeft: 14, marginRight: 12 },
  rowTitle: { fontSize: 16, fontFamily: "Geologica_700Bold" },
  rowMeta: { fontSize: 12, fontFamily: "Geologica_600SemiBold", marginTop: 4 },
  progressTrack: { height: 3, borderRadius: 1.5, marginTop: 5, overflow: "hidden" },
  progressFill: { height: 3, borderRadius: 1.5, backgroundColor: "#FFD857" },
  rowDur: { fontSize: 13, fontFamily: "Geologica_700Bold" },

  empty: { alignItems: "center", paddingTop: 40, paddingHorizontal: 16 },
  emptyTitle: { fontSize: 18, fontFamily: "Geologica_800ExtraBold" },
  emptySub: { fontSize: 13, lineHeight: 18, fontFamily: "Geologica_500Medium", textAlign: "center", marginTop: 6 },
});
