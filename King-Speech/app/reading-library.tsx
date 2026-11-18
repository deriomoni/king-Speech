// «Профиль · Моя библиотека» — Figma 311:4347.
// Data source: GameContext.readingRecordings (private reading takes); playback
// via the shared RecordingPlayer, opened inline from the ▶ duration pill.
import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "@/lib/haptics";
import { useGame, type ReadingRecording } from "@/context/GameContext";
import { useLang, pickLang, LANG_LOCALE, type Lang } from "@/context/LangContext";
import { useTheme } from "@/context/ThemeContext";
import RecordingPlayer from "@/components/RecordingPlayer";
import AppDialog from "@/components/AppDialog";
import { getLiterature, getLiteratureFullText } from "@/constants/literatureLoader";

type Filter = "all" | "showtime" | "interview" | "reading" | "tonguetwister";

const FILTERS: { key: Filter; ru: string; en: string; kk: string }[] = [
  { key: "all", ru: "Все", en: "All", kk: "Барлығы" },
  { key: "showtime", ru: "Show Time", en: "Show Time", kk: "Сахна уақыты" },
  { key: "interview", ru: "Интервью", en: "Interview", kk: "Сұхбат" },
  { key: "reading", ru: "Чтение", en: "Reading", kk: "Оқу" },
  { key: "tonguetwister", ru: "Скороговорки", en: "Tongue twisters", kk: "Тіл бұрауыштар" },
];

// work title → literature text, built once (module ids 1..67).
let EXCERPTS: Map<string, string> | null = null;
function excerptFor(title: string): string {
  if (!EXCERPTS) {
    EXCERPTS = new Map();
    for (let i = 1; i <= 67; i++) {
      for (const lit of [getLiterature(i), getLiterature(i, "kk")]) {
        if (lit) EXCERPTS.set(lit.work, getLiteratureFullText(lit).replace(/\s*\n+\s*/g, " "));
      }
    }
  }
  return EXCERPTS.get(title) ?? "";
}

function fmtDuration(sec?: number) {
  if (!sec || sec <= 0) return "0:00";
  const s = Math.round(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function fmtWhen(ms: number, lang: Lang) {
  try {
    const d = new Date(ms);
    const now = new Date();
    const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const diff = Math.round((day(now) - day(d)) / 86400000);
    const time = d.toLocaleTimeString(LANG_LOCALE[lang], { hour: "2-digit", minute: "2-digit", hour12: false });
    let date: string;
    if (diff === 0) date = pickLang(lang, { ru: "Сегодня", en: "Today", kk: "Бүгін" });
    else if (diff === 1) date = pickLang(lang, { ru: "Вчера", en: "Yesterday", kk: "Кеше" });
    else
      date = d
        .toLocaleDateString(LANG_LOCALE[lang], { day: "numeric", month: "short" })
        .replace(".", "");
    return `${date} · ${time}`;
  } catch {
    return "";
  }
}

function scoreOf(rec: ReadingRecording): string | null {
  const v = typeof rec.aiScore === "number" && rec.aiScore > 0 ? rec.aiScore : rec.selfRating ? rec.selfRating * 2 : null;
  return v == null ? null : `${v.toFixed(1)} / 10`;
}

function RecordRow({
  rec,
  index,
  expanded,
  onToggle,
  onMore,
  theme,
  isDark,
  lang,
}: {
  rec: ReadingRecording;
  index: number;
  expanded: boolean;
  onToggle: () => void;
  onMore: () => void;
  theme: any;
  isDark: boolean;
  lang: Lang;
}) {
  const ink = (a: number) => (isDark ? `rgba(240,238,233,${a})` : `rgba(38,38,40,${a})`);
  const excerpt = excerptFor(rec.title) || rec.author || "";
  const score = scoreOf(rec);
  const mode = pickLang(lang, { ru: "Чтение", en: "Reading", kk: "Оқу" });

  return (
    <Animated.View entering={FadeInDown.delay(40 + index * 40).duration(380)} style={[row.wrap, { borderBottomColor: theme.divider }]}>
      <Text style={[row.meta, { color: ink(0.5) }]}>
        {fmtWhen(rec.date, lang)} · {mode}
      </Text>
      <Text style={[row.title, { color: theme.text }]} numberOfLines={2}>
        {rec.title}
      </Text>
      {excerpt ? (
        <Text style={[row.excerpt, { color: ink(0.7) }]} numberOfLines={3}>
          {excerpt}
        </Text>
      ) : null}

      <View style={row.pills}>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onToggle();
          }}
          accessibilityLabel={pickLang(lang, { ru: "Слушать запись", en: "Play recording", kk: "Жазбаны тыңдау" })}
          style={({ pressed }) => [row.pill, row.playPill, { backgroundColor: ink(0.08), opacity: pressed ? 0.7 : 1 }]}
        >
          <Ionicons name={expanded ? "pause" : "play"} size={12} color={theme.text} />
          <Text style={[row.pillText, { color: theme.text }]}>{fmtDuration(rec.durationSec)}</Text>
        </Pressable>
        {score ? (
          <View style={[row.pill, { backgroundColor: isDark ? "rgba(255,216,87,0.14)" : "rgba(255,216,87,0.35)" }]}>
            <Text style={[row.pillText, { color: theme.accentInk }]}>{score}</Text>
          </View>
        ) : null}
        <View style={{ flex: 1 }} />
        <Pressable onPress={onMore} hitSlop={12} accessibilityLabel={pickLang(lang, { ru: "Ещё", en: "More", kk: "Тағы" })} style={row.more}>
          <Ionicons name="ellipsis-horizontal" size={22} color={ink(0.5)} />
        </Pressable>
      </View>

      {expanded ? (
        <Animated.View entering={FadeIn.duration(220)} style={{ marginTop: 14 }}>
          <RecordingPlayer
            uri={rec.uri}
            waveform={rec.waveform}
            accentColor={theme.accent}
            trackColor={ink(0.16)}
            textColor={ink(0.65)}
          />
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

export default function ReadingLibraryScreen() {
  const { theme, themeMode } = useTheme();
  const isDark = themeMode === "dark";
  const { t, lang } = useLang();
  const insets = useSafeAreaInsets();
  const { readingRecordings, removeReadingRecording } = useGame();
  const [expandedUri, setExpandedUri] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [pendingDelete, setPendingDelete] = useState<ReadingRecording | null>(null);

  const topPad = Platform.OS === "web" ? 54 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const ink = (a: number) => (isDark ? `rgba(240,238,233,${a})` : `rgba(38,38,40,${a})`);

  const list = useMemo(() => {
    // Library currently stores reading takes only.
    if (filter !== "all" && filter !== "reading") return [];
    const q = query.trim().toLowerCase();
    const sorted = [...readingRecordings].sort((a, b) => b.date - a.date);
    if (!q) return sorted;
    return sorted.filter((r) =>
      [r.title, r.author ?? "", excerptFor(r.title)].some((s) => s.toLowerCase().includes(q)),
    );
  }, [readingRecordings, filter, query]);

  const confirmDelete = (rec: ReadingRecording) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPendingDelete(rec);
  };

  const empty = readingRecordings.length === 0;

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <ScrollView
        contentContainerStyle={{ paddingTop: topPad, paddingBottom: bottomPad + 40 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.6 : 1 }]}
          accessibilityLabel={pickLang(lang, { ru: "Назад", en: "Back", kk: "Артқа" })}
        >
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </Pressable>
        <Text style={[styles.title, { color: theme.text }]}>{t("myLibrary")}</Text>

        {/* Search */}
        <View style={[styles.search, { backgroundColor: ink(0.08) }]}>
          <Ionicons name="search" size={18} color={ink(0.5)} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={pickLang(lang, { ru: "Поиск по записям", en: "Search recordings", kk: "Жазбалардан іздеу" })}
            placeholderTextColor={ink(0.5)}
            style={[styles.searchInput, { color: theme.text }]}
            returnKeyType="search"
          />
          <Pressable
            hitSlop={8}
            onPress={() => {
              // TODO(design): voice search.
            }}
          >
            <Ionicons name="mic" size={18} color={ink(0.5)} />
          </Pressable>
        </View>

        {/* Filter chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          alwaysBounceHorizontal={false}
          contentContainerStyle={styles.chips}
          style={{ marginTop: 14, flexGrow: 0 }}
        >
          {FILTERS.map((f) => {
            const on = filter === f.key;
            return (
              <Pressable
                key={f.key}
                onPress={() => setFilter(f.key)}
                style={[
                  styles.chip,
                  { backgroundColor: on ? (isDark ? "rgba(255,216,87,0.16)" : "rgba(255,216,87,0.45)") : ink(0.08) },
                ]}
              >
                <Text style={[styles.chipText, { color: on ? theme.accentInk : ink(0.7) }]}>
                  {pickLang(lang, f)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {empty || list.length === 0 ? (
          <View style={styles.empty}>
            <View style={[styles.emptyIcon, { backgroundColor: theme.accentDim }]}>
              <Ionicons name="mic-outline" size={36} color={theme.accentInk} />
            </View>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>
              {empty ? t("libraryEmptyTitle") : pickLang(lang, { ru: "Ничего не найдено", en: "Nothing found", kk: "Ештеңе табылмады" })}
            </Text>
            <Text style={[styles.emptyBody, { color: ink(0.65) }]}>
              {empty
                ? t("libraryEmptyBody")
                : pickLang(lang, {
                    ru: "Попробуй другой запрос или фильтр.",
                    en: "Try another search or filter.",
                    kk: "Басқа сұраныс не сүзгіні байқап көріңіз.",
                  })}
            </Text>
          </View>
        ) : (
          <View style={{ marginTop: 6 }}>
            {list.map((rec, i) => (
              <RecordRow
                key={rec.uri}
                rec={rec}
                index={i}
                expanded={expandedUri === rec.uri}
                onToggle={() => setExpandedUri((cur) => (cur === rec.uri ? null : rec.uri))}
                onMore={() => confirmDelete(rec)}
                theme={theme}
                isDark={isDark}
                lang={lang}
              />
            ))}
          </View>
        )}
      </ScrollView>

      <AppDialog
        visible={!!pendingDelete}
        title={t("deleteRecording")}
        message={t("deleteRecordingMsg")}
        onRequestClose={() => setPendingDelete(null)}
        buttons={[
          { label: t("cancel"), onPress: () => setPendingDelete(null) },
          {
            label: pickLang(lang, { ru: "Удалить", en: "Delete", kk: "Жою" }),
            variant: "primary",
            onPress: () => {
              const rec = pendingDelete;
              setPendingDelete(null);
              if (!rec) return;
              if (expandedUri === rec.uri) setExpandedUri(null);
              removeReadingRecording(rec.uri);
            },
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  backBtn: { marginTop: 8, marginLeft: 17, width: 32, height: 28, justifyContent: "center" },
  title: { marginTop: 10, marginLeft: 24, fontSize: 34, fontFamily: "Geologica_700Bold", letterSpacing: -0.34 },
  search: {
    marginTop: 12,
    marginHorizontal: 24,
    height: 44,
    borderRadius: 22,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Geologica_500Medium",
    paddingVertical: 0,
    ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : null),
  },
  chips: { paddingHorizontal: 24, gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16 },
  chipText: { fontSize: 13, fontFamily: "Geologica_600SemiBold" },
  empty: { alignItems: "center", paddingHorizontal: 40, paddingTop: 80, gap: 14 },
  emptyIcon: { width: 76, height: 76, borderRadius: 38, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontSize: 18, fontFamily: "Geologica_700Bold", textAlign: "center" },
  emptyBody: { fontSize: 14, fontFamily: "Geologica_400Regular", textAlign: "center", lineHeight: 20 },
});

const row = StyleSheet.create({
  wrap: { marginHorizontal: 24, paddingTop: 16, paddingBottom: 20, borderBottomWidth: 1 },
  meta: { fontSize: 12, fontFamily: "Geologica_500Medium" },
  title: { marginTop: 5, fontSize: 16, fontFamily: "Geologica_700Bold" },
  excerpt: { marginTop: 7, fontSize: 14, lineHeight: 19.6, fontFamily: "Geologica_400Regular" },
  pills: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 13 },
  pill: { borderRadius: 16, paddingHorizontal: 10, paddingVertical: 7 },
  playPill: { flexDirection: "row", alignItems: "center", gap: 6, paddingLeft: 12, paddingRight: 14 },
  pillText: { fontSize: 13, fontFamily: "Geologica_700Bold" },
  more: { width: 28, alignItems: "flex-end" },
});
