import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useGame, type ReadingRecording } from "@/context/GameContext";
import { useLang } from "@/context/LangContext";
import { useTheme } from "@/context/ThemeContext";
import RecordingPlayer from "@/components/RecordingPlayer";

function StarsRow({ count, color, track }: { count: number; color: string; track: string }) {
  return (
    <View style={{ flexDirection: "row", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Ionicons key={n} name={n <= count ? "star" : "star-outline"} size={13} color={n <= count ? color : track} />
      ))}
    </View>
  );
}

function categoryLabel(cat: string | undefined, lang: "ru" | "en") {
  if (cat === "fable") return lang === "ru" ? "Басня" : "Fable";
  if (cat === "prose") return lang === "ru" ? "Проза" : "Prose";
  return lang === "ru" ? "Поэзия" : "Poetry";
}

function RecordingCard({
  rec,
  index,
  expanded,
  onToggle,
  onDelete,
  theme,
  lang,
  t,
}: {
  rec: ReadingRecording;
  index: number;
  expanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
  theme: any;
  lang: "ru" | "en";
  t: (k: any) => string;
}) {
  const accent = theme.accent;
  const track = theme.mode === "dark" ? "rgba(255,255,255,0.16)" : "rgba(20,16,8,0.16)";
  const dateStr = (() => {
    try {
      return new Date(rec.date).toLocaleDateString(lang === "ru" ? "ru-RU" : "en-US", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return "";
    }
  })();

  return (
    <Animated.View
      entering={FadeInDown.delay(40 + index * 40).duration(400)}
      style={[card.wrap, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
    >
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onToggle();
        }}
        onLongPress={onDelete}
        style={card.head}
      >
        <View style={[card.iconBox, { backgroundColor: accent + "1A" }]}>
          <Ionicons name="book" size={20} color={accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={[card.title, { color: theme.text }]}>
            {rec.title}
          </Text>
          {rec.author ? (
            <Text numberOfLines={1} style={[card.author, { color: theme.textSecondary }]}>
              {rec.author}
            </Text>
          ) : null}
          <View style={card.metaRow}>
            <Text style={[card.meta, { color: theme.textMuted }]}>
              {categoryLabel(rec.category, lang)}
              {dateStr ? `  ·  ${dateStr}` : ""}
            </Text>
          </View>
        </View>
        <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={18} color={theme.textMuted} />
      </Pressable>

      {/* Ratings */}
      <View style={card.ratingsRow}>
        <View style={card.ratingChip}>
          <Text style={[card.ratingLabel, { color: theme.textMuted }]}>{t("selfStars")}</Text>
          <StarsRow count={rec.selfRating ?? 0} color={accent} track={track} />
        </View>
        {typeof rec.aiStars === "number" ? (
          <View style={card.ratingChip}>
            <Text style={[card.ratingLabel, { color: theme.textMuted }]}>{t("aiStarsShort")}</Text>
            <StarsRow count={rec.aiStars} color={theme.mode === "dark" ? "#5EEAD4" : "#0E9F8E"} track={track} />
          </View>
        ) : null}
      </View>

      {expanded ? (
        <Animated.View entering={FadeIn.duration(250)} style={{ marginTop: 12, gap: 10 }}>
          <RecordingPlayer
            uri={rec.uri}
            accentColor={accent}
            trackColor={track}
            textColor={theme.textSecondary}
          />
          <Pressable
            onPress={onDelete}
            style={({ pressed }) => [card.deleteBtn, { opacity: pressed ? 0.6 : 1 }]}
          >
            <Ionicons name="trash-outline" size={16} color="#E5484D" />
            <Text style={[card.deleteText, { color: "#E5484D" }]}>
              {lang === "ru" ? "Удалить" : "Delete"}
            </Text>
          </Pressable>
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

export default function ReadingLibraryScreen() {
  const { theme } = useTheme();
  const { t, lang } = useLang();
  const insets = useSafeAreaInsets();
  const { readingRecordings, removeReadingRecording } = useGame();
  const [expandedUri, setExpandedUri] = useState<string | null>(null);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const confirmDelete = (rec: ReadingRecording) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(t("deleteRecording"), t("deleteRecordingMsg"), [
      { text: t("cancel"), style: "cancel" },
      {
        text: lang === "ru" ? "Удалить" : "Delete",
        style: "destructive",
        onPress: () => {
          if (expandedUri === rec.uri) setExpandedUri(null);
          removeReadingRecording(rec.uri);
        },
      },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Ionicons name="chevron-back" size={26} color={theme.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>{t("myLibrary")}</Text>
          <Text style={[styles.headerSub, { color: theme.textSecondary }]}>
            {readingRecordings.length} {t("recordingsCount")}
          </Text>
        </View>
        <Ionicons name="library" size={22} color={theme.accent} />
      </View>

      {readingRecordings.length === 0 ? (
        <View style={styles.empty}>
          <View style={[styles.emptyIcon, { backgroundColor: theme.accent + "18" }]}>
            <Ionicons name="mic-outline" size={40} color={theme.accent} />
          </View>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>{t("libraryEmptyTitle")}</Text>
          <Text style={[styles.emptyBody, { color: theme.textSecondary }]}>{t("libraryEmptyBody")}</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad + 40 }]}
          showsVerticalScrollIndicator={false}
        >
          {readingRecordings.map((rec, i) => (
            <RecordingCard
              key={rec.uri}
              rec={rec}
              index={i}
              expanded={expandedUri === rec.uri}
              onToggle={() => setExpandedUri((cur) => (cur === rec.uri ? null : rec.uri))}
              onDelete={() => confirmDelete(rec)}
              theme={theme}
              lang={lang}
              t={t}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 20, fontFamily: "Inter_700Bold", letterSpacing: -0.3 },
  headerSub: { fontSize: 12.5, fontFamily: "Inter_400Regular", marginTop: 1 },
  scroll: { paddingHorizontal: 18, paddingTop: 6, gap: 12 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40, gap: 14 },
  emptyIcon: { width: 84, height: 84, borderRadius: 42, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_700Bold", textAlign: "center" },
  emptyBody: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
});

const card = StyleSheet.create({
  wrap: { borderRadius: 18, borderWidth: 1, padding: 14 },
  head: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconBox: { width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 15.5, fontFamily: "Inter_600SemiBold", letterSpacing: -0.2 },
  author: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 1 },
  metaRow: { marginTop: 4 },
  meta: { fontSize: 11.5, fontFamily: "Inter_400Regular" },
  ratingsRow: { flexDirection: "row", gap: 18, marginTop: 12 },
  ratingChip: { flexDirection: "row", alignItems: "center", gap: 6 },
  ratingLabel: { fontSize: 11, fontFamily: "Inter_500Medium", textTransform: "uppercase", letterSpacing: 0.5 },
  deleteBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 8 },
  deleteText: { fontSize: 13.5, fontFamily: "Inter_600SemiBold" },
});
