import React, { useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  type ColorValue,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useGame, RANKS_MODULAR, MODULE_COLORS } from "@/context/GameContext";
import { useLang } from "@/context/LangContext";
import { useTheme, type Theme } from "@/context/ThemeContext";
import { useDevTools } from "@/context/DevToolsContext";
import {
  getRankTheme,
  pickLocalized,
  type IoniconName,
} from "@/components/path/rankTheme";

type RankStatus = "locked" | "current" | "completed";

function rankStatusFor(
  rankIndex: number,
  currentRank: number,
  isOpenTesting: boolean
): RankStatus {
  if (isOpenTesting) {
    // Open Testing unlocks every world for browsing.
    if (rankIndex < currentRank) return "completed";
    if (rankIndex === currentRank) return "current";
    return "completed";
  }
  if (rankIndex < currentRank) return "completed";
  if (rankIndex === currentRank) return "current";
  return "locked";
}

function rankNameFor(rankIndex: number, lang: "ru" | "en"): string {
  const ru = ["Новичок", "Любитель", "Уверенный", "Мастер", "Профи"];
  const en = ["Novice", "Amateur", "Confident", "Master", "Pro"];
  return (lang === "en" ? en : ru)[Math.max(0, Math.min(4, rankIndex - 1))];
}

export default function WorldsMapRoute() {
  const insets = useSafeAreaInsets();
  const { theme: appTheme, themeMode } = useTheme();
  const isDark = themeMode === "dark";
  const screenGradient = isDark
    ? (["#0B1220", "#161B2C", "#0B1220"] as const)
    : ([appTheme.bg, appTheme.bgSecondary, appTheme.bg] as const);
  const { lang } = useLang();
  const { currentRank, levels, showTimeRecordings } = useGame();
  const { isOpenTestingEnabled } = useDevTools();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const handleClose = useCallback(() => {
    if (Platform.OS !== "web") {
      Haptics.selectionAsync().catch(() => {});
    }
    if (router.canGoBack()) router.back();
    else router.replace("/");
  }, []);

  const handlePress = useCallback(
    (rankIndex: number, status: RankStatus) => {
      if (status === "locked") return;
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }
      if (status === "current") {
        // Current world is already what the Path tab shows — just close.
        if (router.canGoBack()) router.back();
        else router.replace("/");
        return;
      }
      router.push({ pathname: "/world/[id]", params: { id: String(rankIndex) } });
    },
    []
  );

  return (
    <View style={[styles.root, { paddingTop: topPad + 8, backgroundColor: appTheme.bg }]}>
      <LinearGradient
        colors={screenGradient as readonly [ColorValue, ColorValue, ...ColorValue[]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.headerRow}>
        <Pressable
          onPress={handleClose}
          accessibilityRole="button"
          accessibilityLabel={lang === "en" ? "Close" : "Закрыть"}
          style={({ pressed }) => [styles.closeBtn, { opacity: pressed ? 0.7 : 1 }]}
          testID="worlds-close"
          hitSlop={12}
        >
          <Ionicons name="chevron-back" size={26} color={appTheme.text} />
        </Pressable>
        <View style={styles.titleCol}>
          <Text
            style={[
              styles.kicker,
              { color: appTheme.textMuted, fontFamily: "Rubik_500Medium" },
            ]}
          >
            {lang === "en" ? "WORLDS" : "МИРЫ"}
          </Text>
          <Text style={[styles.title, { color: appTheme.text, fontFamily: "Rubik_700Bold" }]}>
            {lang === "en" ? "Your journey" : "Твой путь"}
          </Text>
        </View>
        <View style={styles.closeBtn} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: bottomPad + 32 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {RANKS_MODULAR.map((rank, idx) => {
          const status = rankStatusFor(rank.index, currentRank, isOpenTestingEnabled);
          const rankTheme = getRankTheme(rank.index);
          const completedInRank = levels.filter(
            (l) => l.module >= rank.fromSection && l.module <= rank.toSection && l.completed
          ).length;
          const totalInRank = rank.toSection - rank.fromSection + 1;
          const recordingsCount = (showTimeRecordings[rank.index] ?? []).length;
          const modulePreview: ModuleDot[] = [];
          for (let m = rank.fromSection; m <= rank.toSection; m++) {
            const moduleCompleted = levels.some(
              (l) => l.module === m && l.completed
            );
            modulePreview.push({
              module: m,
              color: MODULE_COLORS[m]?.color ?? rankTheme.accent,
              completed: moduleCompleted,
            });
          }

          return (
            <Animated.View
              key={rank.index}
              entering={FadeInDown.duration(360).delay(idx * 70)}
            >
              <RankCard
                rank={rank.index}
                rankName={rankNameFor(rank.index, lang)}
                status={status}
                themeAccent={rankTheme.accent}
                portalGradient={rankTheme.portalGradient}
                portalIcon={rankTheme.portalIcon}
                quote={pickLocalized(rankTheme.motivationalQuote, lang)}
                isDark={isDark}
                appTheme={appTheme}
                completedInRank={completedInRank}
                totalInRank={totalInRank}
                recordingsCount={recordingsCount}
                modulePreview={modulePreview}
                onPress={() => handlePress(rank.index, status)}
                lang={lang}
              />
            </Animated.View>
          );
        })}

        <View style={styles.footerHint}>
          <Ionicons name="information-circle-outline" size={14} color={appTheme.textMuted} />
          <Text
            style={[
              styles.footerHintText,
              { color: appTheme.textMuted, fontFamily: "Rubik_400Regular" },
            ]}
          >
            {lang === "en"
              ? "Tap a completed world to revisit recordings and the rank-up moment."
              : "Нажми на пройденный мир, чтобы пересмотреть записи и церемонию ранга."}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

interface ModuleDot {
  module: number;
  color: string;
  completed: boolean;
}

interface RankCardProps {
  rank: number;
  rankName: string;
  status: RankStatus;
  themeAccent: string;
  portalGradient: readonly [string, string];
  portalIcon: IoniconName;
  quote: string;
  completedInRank: number;
  totalInRank: number;
  recordingsCount: number;
  modulePreview: ModuleDot[];
  onPress: () => void;
  lang: "ru" | "en";
  isDark: boolean;
  appTheme: Theme;
}

function RankCard({
  rank,
  rankName,
  status,
  themeAccent,
  portalGradient,
  portalIcon,
  quote,
  completedInRank,
  totalInRank,
  recordingsCount,
  modulePreview,
  onPress,
  lang,
  isDark,
  appTheme,
}: RankCardProps) {
  const isLocked = status === "locked";
  const isCurrent = status === "current";
  const isCompleted = status === "completed";

  const statusLabel = isLocked
    ? lang === "en" ? "Locked" : "Закрыт"
    : isCurrent
    ? lang === "en" ? "Current" : "Текущий"
    : lang === "en" ? "Completed" : "Пройден";

  const lockedGradient: readonly [string, string] = isDark
    ? ["rgba(255,255,255,0.10)", "rgba(255,255,255,0.04)"]
    : ["rgba(14,14,16,0.06)", "rgba(14,14,16,0.03)"];
  const metaFg = isDark ? "rgba(255,255,255,0.7)" : appTheme.textSecondary;
  const metaIcon = isDark ? "rgba(255,255,255,0.6)" : appTheme.textMuted;

  return (
    <Pressable
      onPress={onPress}
      disabled={isLocked}
      accessibilityRole="button"
      accessibilityLabel={`${lang === "en" ? "Rank" : "Ранг"} ${rank} · ${rankName} · ${statusLabel}`}
      testID={`worlds-rank-${rank}`}
      style={({ pressed }) => [
        cardStyles.outer,
        {
          backgroundColor: isDark ? "rgba(255,255,255,0.04)" : appTheme.card,
          opacity: isLocked ? 0.55 : pressed ? 0.92 : 1,
          borderColor: isCurrent
            ? themeAccent
            : isDark
            ? "rgba(255,255,255,0.08)"
            : appTheme.cardBorder,
          borderWidth: isCurrent ? 2 : 1,
        },
      ]}
    >
      <View style={cardStyles.previewBanner} testID={`worlds-rank-${rank}-preview`}>
        <LinearGradient
          colors={isLocked ? lockedGradient : portalGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {!isLocked && (
          <View style={cardStyles.previewSheen} pointerEvents="none" />
        )}
        <View style={cardStyles.previewDotsRow}>
          {modulePreview.map((m) => (
            <View
              key={m.module}
              style={[
                cardStyles.previewDot,
                {
                  backgroundColor: isLocked
                    ? "rgba(255,255,255,0.22)"
                    : m.completed
                    ? m.color
                    : "rgba(255,255,255,0.28)",
                  borderColor: isLocked
                    ? "rgba(255,255,255,0.18)"
                    : m.completed
                    ? "rgba(255,255,255,0.55)"
                    : "rgba(255,255,255,0.35)",
                },
              ]}
            />
          ))}
        </View>
      </View>
      <View style={cardStyles.contentPad}>
      <View style={cardStyles.row}>
        <View style={[cardStyles.crest, { borderColor: isLocked ? "rgba(255,255,255,0.2)" : themeAccent }]}>
          {!isLocked && (
            <LinearGradient
              colors={portalGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          )}
          <Ionicons
            name={isLocked ? "lock-closed" : portalIcon}
            size={28}
            color="#fff"
          />
        </View>
        <View style={cardStyles.body}>
          <View style={cardStyles.headerLine}>
            <Text
              style={[
                cardStyles.rankIndex,
                { color: appTheme.textMuted, fontFamily: "Rubik_500Medium" },
              ]}
            >
              {lang === "en" ? "RANK" : "РАНГ"} {rank}
            </Text>
            <View
              style={[
                cardStyles.statusPill,
                {
                  backgroundColor: isCurrent
                    ? themeAccent + "33"
                    : isCompleted
                    ? "rgba(94, 234, 212, 0.18)"
                    : isDark
                    ? "rgba(255,255,255,0.08)"
                    : appTheme.bgSecondary,
                  borderColor: isCurrent
                    ? themeAccent
                    : isCompleted
                    ? "rgba(94, 234, 212, 0.5)"
                    : isDark
                    ? "rgba(255,255,255,0.18)"
                    : appTheme.cardBorder,
                },
              ]}
            >
              {isCompleted && (
                <Ionicons name="checkmark" size={10} color="#5EEAD4" style={{ marginRight: 3 }} />
              )}
              <Text
                style={[
                  cardStyles.statusText,
                  {
                    color: isCurrent
                      ? isDark
                        ? "#fff"
                        : appTheme.text
                      : isCompleted
                      ? "#5EEAD4"
                      : metaFg,
                    fontFamily: "Rubik_600SemiBold",
                  },
                ]}
              >
                {statusLabel}
              </Text>
            </View>
          </View>
          <Text
            style={[cardStyles.name, { color: appTheme.text, fontFamily: "Rubik_700Bold" }]}
            numberOfLines={1}
          >
            {rankName}
          </Text>
          <Text
            style={[cardStyles.quote, { color: metaFg, fontFamily: "Rubik_400Regular" }]}
            numberOfLines={2}
          >
            {quote}
          </Text>

          <View style={cardStyles.metaRow}>
            <View style={cardStyles.metaItem}>
              <Ionicons name="layers-outline" size={12} color={metaIcon} />
              <Text style={[cardStyles.metaText, { color: metaFg, fontFamily: "Rubik_500Medium" }]}>
                {completedInRank}/{totalInRank}{" "}
                {lang === "en" ? "modules" : "модулей"}
              </Text>
            </View>
            {!isLocked && (
              <View style={cardStyles.metaItem}>
                <Ionicons name="mic-outline" size={12} color={metaIcon} />
                <Text style={[cardStyles.metaText, { color: metaFg, fontFamily: "Rubik_500Medium" }]}>
                  {recordingsCount}{" "}
                  {lang === "en"
                    ? recordingsCount === 1 ? "recording" : "recordings"
                    : "записей"}
                </Text>
              </View>
            )}
          </View>
        </View>

        {!isLocked && (
          <Ionicons name="chevron-forward" size={20} color={appTheme.textMuted} />
        )}
      </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  titleCol: { flex: 1, alignItems: "center", gap: 2 },
  kicker: {
    fontSize: 11,
    letterSpacing: 1.6,
  },
  title: { fontSize: 18, letterSpacing: 0.3 },
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 14,
  },
  footerHint: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    marginTop: 12,
    paddingHorizontal: 4,
  },
  footerHintText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 15,
  },
});

const cardStyles = StyleSheet.create({
  outer: {
    borderRadius: 20,
    overflow: "hidden",
  },
  previewBanner: {
    height: 56,
    width: "100%",
    paddingHorizontal: 14,
    justifyContent: "center",
    overflow: "hidden",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.12)",
  },
  previewSheen: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    height: 14,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  previewDotsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "nowrap",
  },
  previewDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1,
  },
  contentPad: {
    padding: 14,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  crest: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  body: { flex: 1, gap: 4 },
  headerLine: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  rankIndex: { fontSize: 10, letterSpacing: 1.2 },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusText: { fontSize: 10, letterSpacing: 0.4 },
  name: { fontSize: 19, lineHeight: 22 },
  quote: { fontSize: 12, lineHeight: 16, fontStyle: "italic" },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginTop: 4,
    flexWrap: "wrap",
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: { fontSize: 11 },
});
