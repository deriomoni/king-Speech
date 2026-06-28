import React, { useCallback, useMemo, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  Modal,
  TextInput,
  Alert,
  type GestureResponderEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Sharing from "expo-sharing";
import { Audio } from "expo-av";
import { router, useLocalSearchParams } from "expo-router";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import {
  useGame,
  RANKS_MODULAR,
  MODULE_COLORS,
  type Level,
  type ShowTimeRecording,
} from "@/context/GameContext";
import { useLang } from "@/context/LangContext";
import { useDevTools } from "@/context/DevToolsContext";
import {
  getRankTheme,
  pickLocalized,
  type RankTheme,
} from "@/components/path/rankTheme";
import { RankBackground } from "@/components/path/RankBackground";
import { useAudioWaveform } from "@/hooks/useAudioWaveform";
import { colors as brandColors } from "@/theme/tokens";
import { useTheme } from "@/context/ThemeContext";

function rankNameFor(rankIndex: number, lang: "ru" | "en"): string {
  const ru = ["Новичок", "Любитель", "Уверенный", "Мастер", "Профи"];
  const en = ["Novice", "Amateur", "Confident", "Master", "Pro"];
  return (lang === "en" ? en : ru)[Math.max(0, Math.min(4, rankIndex - 1))];
}

export default function WorldDetailRoute() {
  const params = useLocalSearchParams<{ id?: string }>();
  const insets = useSafeAreaInsets();
  const { lang } = useLang();
  const { themeMode } = useTheme();
  const { currentRank, levels, showTimeRecordings, portalCompleted, isLoaded } = useGame();
  const { isOpenTestingEnabled } = useDevTools();

  const rankIndex = useMemo(() => {
    const n = parseInt(String(params.id ?? ""), 10);
    return Number.isFinite(n) && n >= 1 && n <= 5 ? n : null;
  }, [params.id]);

  // Browseable when this rank is fully behind the user (or via Open Testing).
  const browsable =
    rankIndex !== null &&
    (isOpenTestingEnabled || rankIndex < currentRank);
  // The rank-up memento is only meaningful if the portal was completed.
  const mementoAvailable = rankIndex !== null && !!portalCompleted[rankIndex];

  useEffect(() => {
    if (!isLoaded) return;
    if (rankIndex === null || !browsable) {
      router.replace("/worlds");
    }
  }, [isLoaded, rankIndex, browsable]);

  const handleClose = useCallback(() => {
    if (Platform.OS !== "web") {
      Haptics.selectionAsync().catch(() => {});
    }
    if (router.canGoBack()) router.back();
    else router.replace("/worlds");
  }, []);

  const handleOpenLevel = useCallback((levelId: string) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    if (levelId.startsWith("showtime")) {
      router.push({ pathname: "/showtime-stage", params: { levelId, mode: "trainer" } });
      return;
    }
    if (levelId.startsWith("vocabulary")) {
      const level = levels.find((l) => l.id === levelId);
      router.push({
        pathname: "/vocabulary-level",
        params: { levelId, moduleId: String(level?.module ?? "") },
      });
      return;
    }
    router.push({ pathname: "/level/[id]", params: { id: levelId } });
  }, [levels]);

  const handleOpenMemento = useCallback(() => {
    if (!mementoAvailable || rankIndex === null) return;
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    router.push({ pathname: "/rank-up", params: { memento: "1", rank: String(rankIndex) } });
  }, [mementoAvailable, rankIndex]);

  if (!isLoaded || rankIndex === null || !browsable) return null;

  const theme = getRankTheme(rankIndex);
  const bounds = RANKS_MODULAR[rankIndex - 1];
  const rankLevels = levels.filter(
    (l) => l.module >= bounds.fromSection && l.module <= bounds.toSection
  );
  const recordings: ShowTimeRecording[] = showTimeRecordings[rankIndex] ?? [];

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bgColors[0] }}>
      <RankBackground theme={theme} themeMode={themeMode} />

      <View style={[detailStyles.headerWrap, { paddingTop: topPad + 6 }]}>
        <Pressable
          onPress={handleClose}
          accessibilityRole="button"
          accessibilityLabel={lang === "en" ? "Back to worlds" : "К мирам"}
          style={({ pressed }) => [
            detailStyles.backBtn,
            {
              backgroundColor: theme.cardBg,
              borderColor: theme.borderColor,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
          testID="world-back"
          hitSlop={10}
        >
          <Ionicons name="chevron-back" size={22} color={theme.textPrimary} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[
          detailStyles.scroll,
          { paddingTop: topPad + 56, paddingBottom: bottomPad + 32 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeIn.duration(360)} style={detailStyles.heroBlock}>
          <Text
            style={[
              detailStyles.kicker,
              { color: theme.textSecondary, fontFamily: theme.fontFamily },
            ]}
          >
            {lang === "en" ? "RANK" : "РАНГ"} {rankIndex} ·{" "}
            {lang === "en" ? "Completed" : "Пройден"}
          </Text>
          <Text
            style={[
              detailStyles.heroTitle,
              { color: theme.textPrimary, fontFamily: theme.fontFamilyTitle },
            ]}
          >
            {rankNameFor(rankIndex, lang)}
          </Text>
          <Text
            style={[
              detailStyles.heroQuote,
              { color: theme.textSecondary, fontFamily: theme.fontFamily },
            ]}
          >
            {pickLocalized(theme.motivationalQuote, lang)}
          </Text>
        </Animated.View>

        {/* Show Time recordings */}
        <Animated.View entering={FadeInDown.duration(360).delay(100)}>
          <RecordingsBlock
            theme={theme}
            lang={lang}
            rankIndex={rankIndex}
            recordings={recordings}
          />
        </Animated.View>

        {/* Rank-up memento */}
        <Animated.View entering={FadeInDown.duration(360).delay(180)}>
          <MementoBlock
            theme={theme}
            lang={lang}
            available={mementoAvailable}
            onPress={handleOpenMemento}
          />
        </Animated.View>

        {/* Modules list */}
        <Animated.View entering={FadeInDown.duration(360).delay(260)}>
          <ModulesBlock
            theme={theme}
            lang={lang}
            levels={rankLevels}
            onOpen={handleOpenLevel}
          />
        </Animated.View>
      </ScrollView>
    </View>
  );
}

// --- Recordings block ----------------------------------------------------

function autoLabel(index: number, lang: "ru" | "en"): string {
  if (index === 0) return lang === "en" ? "First take" : "Первая запись";
  return `${lang === "en" ? "Take" : "Дубль"} ${index + 1}`;
}

async function shareRecording(
  uri: string,
  label: string,
  lang: "ru" | "en"
): Promise<void> {
  if (Platform.OS === "web") {
    const filename = `${label.replace(/[^\w\-. ]+/g, "_") || "recording"}.m4a`;
    try {
      const res = await fetch(uri);
      const blob = await res.blob();
      const file =
        typeof File !== "undefined"
          ? new File([blob], filename, { type: blob.type || "audio/mp4" })
          : null;
      const navAny = typeof navigator !== "undefined" ? (navigator as any) : null;
      if (
        file &&
        navAny &&
        typeof navAny.canShare === "function" &&
        navAny.canShare({ files: [file] }) &&
        typeof navAny.share === "function"
      ) {
        await navAny.share({ files: [file], title: label });
        return;
      }
      // Fallback: trigger a download.
      if (typeof document !== "undefined" && typeof URL !== "undefined") {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        return;
      }
      throw new Error("share-unavailable");
    } catch (e) {
      console.warn("Web share failed", e);
      if (typeof window !== "undefined") {
        window.alert(
          lang === "en"
            ? "Sharing isn't available on this browser."
            : "Поделиться нельзя в этом браузере."
        );
      }
    }
    return;
  }
  try {
    const available = await Sharing.isAvailableAsync();
    if (!available) {
      Alert.alert(
        lang === "en" ? "Sharing unavailable" : "Поделиться нельзя",
        lang === "en"
          ? "Sharing isn't supported on this device."
          : "На этом устройстве недоступно."
      );
      return;
    }
    await Sharing.shareAsync(uri, {
      mimeType: "audio/mp4",
      dialogTitle: label,
      UTI: "public.audio",
    });
  } catch (e) {
    console.warn("Native share failed", e);
  }
}

async function deleteRecordingFile(uri: string): Promise<void> {
  if (Platform.OS === "web") return;
  if (!uri || !uri.startsWith("file:")) return;
  try {
    const FileSystem = require("expo-file-system/legacy");
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch (e) {
    console.warn("Could not delete recording file", e);
  }
}

function RecordingsBlock({
  theme,
  lang,
  rankIndex,
  recordings,
}: {
  theme: RankTheme;
  lang: "ru" | "en";
  rankIndex: number;
  recordings: ShowTimeRecording[];
}) {
  const { renameShowTimeRecording, removeShowTimeRecording } = useGame();
  const [actionFor, setActionFor] = useState<{ uri: string; index: number } | null>(null);
  const [renameFor, setRenameFor] = useState<{ uri: string; initial: string } | null>(null);

  const openActions = useCallback((uri: string, index: number) => {
    if (Platform.OS !== "web") {
      Haptics.selectionAsync().catch(() => {});
    }
    setActionFor({ uri, index });
  }, []);

  const closeActions = useCallback(() => setActionFor(null), []);

  const handleRenameRequest = useCallback(() => {
    if (!actionFor) return;
    const target = recordings.find((r) => r.uri === actionFor.uri);
    const initial = target?.label ?? autoLabel(actionFor.index, lang);
    setRenameFor({ uri: actionFor.uri, initial });
    setActionFor(null);
  }, [actionFor, recordings, lang]);

  const handleRenameSubmit = useCallback(
    (label: string) => {
      if (!renameFor) return;
      renameShowTimeRecording(rankIndex, renameFor.uri, label);
      setRenameFor(null);
    },
    [renameFor, rankIndex, renameShowTimeRecording]
  );

  const performDelete = useCallback(
    async (uri: string) => {
      removeShowTimeRecording(rankIndex, uri);
      await deleteRecordingFile(uri);
    },
    [rankIndex, removeShowTimeRecording]
  );

  const handleDeleteRequest = useCallback(() => {
    if (!actionFor) return;
    const uri = actionFor.uri;
    setActionFor(null);
    const title = lang === "en" ? "Delete recording?" : "Удалить запись?";
    const msg =
      lang === "en"
        ? "This will remove it from your keepsake library. This can't be undone."
        : "Запись исчезнет из коллекции воспоминаний. Это нельзя отменить.";
    if (Platform.OS === "web") {
      const ok =
        typeof window !== "undefined" ? window.confirm(`${title}\n\n${msg}`) : true;
      if (ok) performDelete(uri);
      return;
    }
    Alert.alert(title, msg, [
      { text: lang === "en" ? "Cancel" : "Отмена", style: "cancel" },
      {
        text: lang === "en" ? "Delete" : "Удалить",
        style: "destructive",
        onPress: () => {
          performDelete(uri);
        },
      },
    ]);
  }, [actionFor, lang, performDelete]);

  const handleShareRequest = useCallback(() => {
    if (!actionFor) return;
    const target = recordings.find((r) => r.uri === actionFor.uri);
    const label = target?.label ?? autoLabel(actionFor.index, lang);
    const uri = actionFor.uri;
    setActionFor(null);
    shareRecording(uri, label, lang);
  }, [actionFor, recordings, lang]);

  return (
    <View
      style={[
        detailStyles.card,
        { backgroundColor: theme.cardBg, borderColor: theme.borderColor },
      ]}
    >
      <View style={detailStyles.cardHeader}>
        <Ionicons name="mic" size={16} color={theme.accent} />
        <Text
          style={[
            detailStyles.cardTitle,
            { color: theme.textPrimary, fontFamily: theme.fontFamilyTitle },
          ]}
        >
          {lang === "en" ? "Show Time recordings" : "Записи Show Time"}
        </Text>
      </View>
      <Text
        style={[
          detailStyles.cardSub,
          { color: theme.textSecondary, fontFamily: theme.fontFamily },
        ]}
      >
        {recordings.length === 0
          ? lang === "en"
            ? "No recordings were saved during this rank."
            : "В этом ранге записи не сохранились."
          : lang === "en"
          ? `${recordings.length} ${recordings.length === 1 ? "recording" : "recordings"} from your journey. Long-press to rename, share, or delete.`
          : `${recordings.length} записей из твоего пути. Удерживай, чтобы переименовать, поделиться или удалить.`}
      </Text>
      {recordings.length > 0 && (
        <View style={{ gap: 8, marginTop: 8 }}>
          {recordings.map((rec, i) => (
            <RecordingItem
              key={`${rec.uri}-${i}`}
              uri={rec.uri}
              index={i}
              label={rec.label ?? autoLabel(i, lang)}
              theme={theme}
              lang={lang}
              isFirst={i === 0}
              onMore={() => openActions(rec.uri, i)}
            />
          ))}
        </View>
      )}

      <ActionSheetModal
        visible={!!actionFor}
        theme={theme}
        lang={lang}
        title={
          actionFor
            ? recordings.find((r) => r.uri === actionFor.uri)?.label ??
              autoLabel(actionFor.index, lang)
            : ""
        }
        onClose={closeActions}
        onRename={handleRenameRequest}
        onShare={handleShareRequest}
        onDelete={handleDeleteRequest}
      />

      <RenameModal
        visible={!!renameFor}
        theme={theme}
        lang={lang}
        initial={renameFor?.initial ?? ""}
        onCancel={() => setRenameFor(null)}
        onSubmit={handleRenameSubmit}
      />
    </View>
  );
}

function ActionSheetModal({
  visible,
  theme,
  lang,
  title,
  onClose,
  onRename,
  onShare,
  onDelete,
}: {
  visible: boolean;
  theme: RankTheme;
  lang: "ru" | "en";
  title: string;
  onClose: () => void;
  onRename: () => void;
  onShare: () => void;
  onDelete: () => void;
}) {
  const insets = useSafeAreaInsets();
  const bottomPad = Platform.OS === "web" ? 34 : Math.max(insets.bottom, 12);
  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <Pressable style={detailStyles.sheetBackdrop} onPress={onClose} testID="recording-actions-backdrop">
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={[
            detailStyles.sheetCard,
            {
              backgroundColor: theme.cardBg,
              borderColor: theme.borderColor,
              paddingBottom: bottomPad + 8,
            },
          ]}
          testID="recording-actions-sheet"
        >
          <View style={detailStyles.sheetGrabber} />
          <Text
            numberOfLines={1}
            style={[
              detailStyles.sheetTitle,
              { color: theme.textPrimary, fontFamily: theme.fontFamilyTitle },
            ]}
          >
            {title}
          </Text>
          <SheetAction
            icon="create-outline"
            label={lang === "en" ? "Rename" : "Переименовать"}
            color={theme.textPrimary}
            accent={theme.accent}
            onPress={onRename}
            testID="recording-action-rename"
          />
          <SheetAction
            icon="share-outline"
            label={lang === "en" ? "Share" : "Поделиться"}
            color={theme.textPrimary}
            accent={theme.accent}
            onPress={onShare}
            testID="recording-action-share"
          />
          <SheetAction
            icon="trash-outline"
            label={lang === "en" ? "Delete" : "Удалить"}
            color="#E11D48"
            accent="#E11D48"
            onPress={onDelete}
            testID="recording-action-delete"
          />
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [
              detailStyles.sheetCancel,
              { borderColor: theme.borderColor, opacity: pressed ? 0.8 : 1 },
            ]}
            accessibilityRole="button"
            accessibilityLabel={lang === "en" ? "Cancel" : "Отмена"}
            testID="recording-action-cancel"
          >
            <Text
              style={[
                detailStyles.sheetCancelText,
                { color: theme.textSecondary, fontFamily: theme.fontFamily },
              ]}
            >
              {lang === "en" ? "Cancel" : "Отмена"}
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function SheetAction({
  icon,
  label,
  color,
  accent,
  onPress,
  testID,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  color: string;
  accent: string;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        detailStyles.sheetRow,
        { opacity: pressed ? 0.7 : 1 },
      ]}
      testID={testID}
    >
      <Ionicons name={icon} size={20} color={accent} />
      <Text
        style={[
          detailStyles.sheetRowText,
          { color, fontFamily: "Rubik_500Medium" },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function RenameModal({
  visible,
  theme,
  lang,
  initial,
  onCancel,
  onSubmit,
}: {
  visible: boolean;
  theme: RankTheme;
  lang: "ru" | "en";
  initial: string;
  onCancel: () => void;
  onSubmit: (label: string) => void;
}) {
  const [text, setText] = useState(initial);

  useEffect(() => {
    if (visible) setText(initial);
  }, [visible, initial]);

  const submit = useCallback(() => {
    onSubmit(text);
  }, [text, onSubmit]);

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onCancel}
    >
      <Pressable style={detailStyles.sheetBackdrop} onPress={onCancel}>
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={[
            detailStyles.renameCard,
            { backgroundColor: theme.cardBg, borderColor: theme.borderColor },
          ]}
          testID="recording-rename-sheet"
        >
          <Text
            style={[
              detailStyles.sheetTitle,
              { color: theme.textPrimary, fontFamily: theme.fontFamilyTitle, marginTop: 0 },
            ]}
          >
            {lang === "en" ? "Rename recording" : "Переименовать запись"}
          </Text>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={initial}
            placeholderTextColor={theme.textMuted}
            autoFocus
            selectTextOnFocus
            maxLength={60}
            returnKeyType="done"
            onSubmitEditing={submit}
            style={[
              detailStyles.renameInput,
              {
                color: theme.textPrimary,
                borderColor: theme.borderColor,
                fontFamily: theme.fontFamily,
              },
            ]}
            testID="recording-rename-input"
          />
          <Text
            style={[
              detailStyles.renameHint,
              { color: theme.textMuted, fontFamily: theme.fontFamily },
            ]}
          >
            {lang === "en"
              ? "Leave empty to restore the auto label."
              : "Оставь пустым, чтобы вернуть автоназвание."}
          </Text>
          <View style={detailStyles.renameButtons}>
            <Pressable
              onPress={onCancel}
              style={({ pressed }) => [
                detailStyles.renameBtn,
                { borderColor: theme.borderColor, opacity: pressed ? 0.8 : 1 },
              ]}
              testID="recording-rename-cancel"
            >
              <Text
                style={[
                  detailStyles.renameBtnText,
                  { color: theme.textSecondary, fontFamily: theme.fontFamily },
                ]}
              >
                {lang === "en" ? "Cancel" : "Отмена"}
              </Text>
            </Pressable>
            <Pressable
              onPress={submit}
              style={({ pressed }) => [
                detailStyles.renameBtn,
                {
                  backgroundColor: theme.accent,
                  borderColor: theme.accent,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
              testID="recording-rename-save"
            >
              <Text
                style={[
                  detailStyles.renameBtnText,
                  { color: "#fff", fontFamily: "Rubik_600SemiBold" },
                ]}
              >
                {lang === "en" ? "Save" : "Сохранить"}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function formatClock(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function RecordingItem({
  uri,
  index,
  label,
  theme,
  lang,
  isFirst,
  onMore,
}: {
  uri: string;
  index: number;
  label: string;
  theme: RankTheme;
  lang: "ru" | "en";
  isFirst: boolean;
  onMore: () => void;
}) {
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [position, setPosition] = useState(0); // seconds
  const [duration, setDuration] = useState(0); // seconds
  const soundRef = useRef<Audio.Sound | null>(null);
  const webAudioRef = useRef<HTMLAudioElement | null>(null);
  const barWidthRef = useRef(0);
  const barRef = useRef<View>(null);

  useEffect(() => {
    return () => {
      if (soundRef.current) soundRef.current.unloadAsync().catch(() => {});
      const wa = webAudioRef.current;
      if (wa) {
        try { wa.pause(); } catch {}
        webAudioRef.current = null;
      }
    };
  }, []);

  const pause = useCallback(async () => {
    if (Platform.OS === "web") {
      const wa = webAudioRef.current;
      if (wa) {
        try { wa.pause(); } catch {}
      }
    } else if (soundRef.current) {
      try { await soundRef.current.pauseAsync(); } catch {}
    }
    setPlaying(false);
  }, []);

  const ensureWebAudio = useCallback((): HTMLAudioElement | null => {
    if (webAudioRef.current) return webAudioRef.current;
    const ctor = typeof window !== "undefined" ? window.Audio : undefined;
    if (!ctor) return null;
    const audio = new ctor(uri);
    audio.muted = muted;
    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      if (Number.isFinite(audio.duration)) setDuration(audio.duration || 0);
    };
    audio.ondurationchange = () => {
      if (Number.isFinite(audio.duration)) setDuration(audio.duration || 0);
    };
    audio.ontimeupdate = () => {
      setPosition(audio.currentTime || 0);
    };
    audio.onended = () => {
      setPlaying(false);
      try { audio.currentTime = 0; } catch {}
      setPosition(0);
    };
    webAudioRef.current = audio;
    return audio;
  }, [uri, muted]);

  const play = useCallback(async () => {
    try {
      if (playing) {
        await pause();
        return;
      }
      if (Platform.OS === "web") {
        const audio = ensureWebAudio();
        if (!audio) return;
        // Restart from beginning if we finished previously.
        if (
          Number.isFinite(audio.duration) &&
          audio.duration > 0 &&
          audio.currentTime >= audio.duration - 0.05
        ) {
          try { audio.currentTime = 0; } catch {}
        }
        await audio.play();
        setPlaying(true);
        return;
      }
      if (!soundRef.current) {
        const { sound } = await Audio.Sound.createAsync(
          { uri },
          { isMuted: muted, progressUpdateIntervalMillis: 100 }
        );
        soundRef.current = sound;
        sound.setOnPlaybackStatusUpdate((status) => {
          if (!status.isLoaded) return;
          if (typeof status.durationMillis === "number") {
            setDuration(status.durationMillis / 1000);
          }
          if (typeof status.positionMillis === "number") {
            setPosition(status.positionMillis / 1000);
          }
          if (status.didJustFinish) {
            setPlaying(false);
            soundRef.current?.setPositionAsync(0).catch(() => {});
            setPosition(0);
          }
        });
      } else {
        // If we're at the end, rewind before playing again.
        if (duration > 0 && position >= duration - 0.05) {
          try { await soundRef.current.setPositionAsync(0); } catch {}
          setPosition(0);
        }
      }
      await soundRef.current.playAsync();
      setPlaying(true);
    } catch {
      setPlaying(false);
    }
  }, [uri, playing, pause, muted, duration, position, ensureWebAudio]);

  const toggleMute = useCallback(async () => {
    const next = !muted;
    setMuted(next);
    if (Platform.OS === "web") {
      const wa = webAudioRef.current;
      if (wa) wa.muted = next;
    } else if (soundRef.current) {
      try { await soundRef.current.setIsMutedAsync(next); } catch {}
    }
  }, [muted]);

  const seekToFraction = useCallback(async (fraction: number) => {
    const f = Math.max(0, Math.min(1, fraction));
    if (duration <= 0) return;
    const targetSec = f * duration;
    setPosition(targetSec);
    if (Platform.OS === "web") {
      const audio = ensureWebAudio();
      if (audio) {
        try { audio.currentTime = targetSec; } catch {}
      }
    } else {
      if (!soundRef.current) {
        try {
          const { sound } = await Audio.Sound.createAsync(
            { uri },
            { isMuted: muted, progressUpdateIntervalMillis: 100, shouldPlay: false }
          );
          soundRef.current = sound;
          sound.setOnPlaybackStatusUpdate((status) => {
            if (!status.isLoaded) return;
            if (typeof status.durationMillis === "number") {
              setDuration(status.durationMillis / 1000);
            }
            if (typeof status.positionMillis === "number") {
              setPosition(status.positionMillis / 1000);
            }
            if (status.didJustFinish) {
              setPlaying(false);
              soundRef.current?.setPositionAsync(0).catch(() => {});
              setPosition(0);
            }
          });
        } catch {
          return;
        }
      }
      try {
        await soundRef.current!.setPositionAsync(Math.floor(targetSec * 1000));
      } catch {}
    }
  }, [duration, ensureWebAudio, muted, uri]);

  const onBarPress = useCallback((e: GestureResponderEvent) => {
    let w = barWidthRef.current;
    let x = e.nativeEvent.locationX ?? 0;
    if (Platform.OS === "web") {
      // On RN Web, locationX from a Pressable wrapping child Views is not
      // always set, so derive x from pageX/clientX and the underlying DOM
      // element's bounding rect.
      const node = barRef.current as unknown as HTMLElement | null;
      const native = e.nativeEvent as unknown as {
        pageX?: number;
        clientX?: number;
      };
      const cx = native.pageX ?? native.clientX;
      if (
        node &&
        typeof node.getBoundingClientRect === "function" &&
        typeof cx === "number"
      ) {
        const rect = node.getBoundingClientRect();
        if (rect.width > 0) w = rect.width;
        x = cx - rect.left;
      }
    }
    if (w <= 0) return;
    seekToFraction(x / w);
  }, [seekToFraction]);

  const progress = duration > 0 ? Math.min(1, Math.max(0, position / duration)) : 0;
  const accentSoftBar = theme.accent + "33";
  const waveform = useAudioWaveform(uri);
  const waveformSamples =
    waveform.status === "ready" ? waveform.samples : null;

  return (
    <Pressable
      onLongPress={onMore}
      delayLongPress={350}
      style={[
        detailStyles.recItem,
        {
          borderColor: theme.accent + (playing ? "" : "55"),
          backgroundColor: playing ? theme.accent + "20" : "transparent",
        },
      ]}
      testID={`world-recording-${index}`}
    >
      <Pressable
        onPress={play}
        accessibilityRole="button"
        accessibilityLabel={`${label} — ${playing ? (lang === "en" ? "pause" : "пауза") : (lang === "en" ? "play" : "воспроизвести")}`}
        style={({ pressed }) => [
          detailStyles.recPlay,
          { backgroundColor: brandColors.gold, opacity: pressed ? 0.8 : 1 },
        ]}
        hitSlop={6}
        testID={`world-recording-play-${index}`}
      >
        <Ionicons name={playing ? "pause" : "play"} size={14} color={brandColors.onGold} />
      </Pressable>

      <View style={detailStyles.recBody}>
        <View style={detailStyles.recBodyTop}>
          <Text
            style={[
              detailStyles.recLabel,
              { color: theme.textPrimary, fontFamily: theme.fontFamilyTitle },
            ]}
            numberOfLines={1}
          >
            {label}
          </Text>
          <Text
            style={[
              detailStyles.recTime,
              { color: theme.textMuted, fontFamily: theme.fontFamily },
            ]}
          >
            {formatClock(position)}
            {duration > 0 ? ` / ${formatClock(duration)}` : ""}
          </Text>
        </View>
        <Pressable
          ref={barRef}
          onPress={onBarPress}
          onLayout={(e) => {
            barWidthRef.current = e.nativeEvent.layout.width;
          }}
          accessibilityRole="adjustable"
          accessibilityLabel={lang === "en" ? "Seek recording" : "Перемотка"}
          accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
          disabled={duration <= 0}
          style={detailStyles.recWaveTrack}
          testID={`world-recording-bar-${index}`}
          hitSlop={{ top: 8, bottom: 8 }}
        >
          {waveformSamples ? (
            (() => {
              const playIdx = Math.round(progress * waveformSamples.length);
              return waveformSamples.map((v, i) => {
                const h = Math.max(2, Math.round(v * 22));
                const isPast = i < playIdx;
                return (
                  <View
                    key={i}
                    pointerEvents="none"
                    style={[
                      detailStyles.recWaveBar,
                      {
                        height: h,
                        backgroundColor: isPast ? theme.accent : accentSoftBar,
                      },
                    ]}
                  />
                );
              });
            })()
          ) : (
            <View
              pointerEvents="none"
              style={[
                detailStyles.recWavePlaceholder,
                { backgroundColor: accentSoftBar },
              ]}
            >
              <View
                style={[
                  detailStyles.recWavePlaceholderFill,
                  {
                    width: `${progress * 100}%`,
                    backgroundColor: brandColors.gold,
                  },
                ]}
              />
            </View>
          )}
        </Pressable>
      </View>

      <Pressable
        onPress={toggleMute}
        accessibilityRole="button"
        accessibilityLabel={
          muted
            ? lang === "en" ? "Unmute" : "Включить звук"
            : lang === "en" ? "Mute" : "Выключить звук"
        }
        style={({ pressed }) => [
          detailStyles.recMute,
          {
            borderColor: theme.accent + "66",
            backgroundColor: muted ? theme.accent + "22" : "transparent",
            opacity: pressed ? 0.8 : 1,
          },
        ]}
        hitSlop={6}
        testID={`world-recording-mute-${index}`}
      >
        <Ionicons
          name={muted ? "volume-mute" : "volume-high"}
          size={14}
          color={theme.accentDark}
        />
      </Pressable>

      {isFirst && (
        <View style={[detailStyles.recBadge, { backgroundColor: theme.accentSoft, borderColor: theme.accent }]}>
          <Text
            style={[
              detailStyles.recBadgeText,
              { color: theme.accentDark, fontFamily: theme.fontFamily },
            ]}
          >
            {lang === "en" ? "MEMORY" : "ПАМЯТЬ"}
          </Text>
        </View>
      )}

      <Pressable
        onPress={onMore}
        accessibilityRole="button"
        accessibilityLabel={lang === "en" ? "More actions" : "Действия"}
        style={({ pressed }) => [
          detailStyles.recMore,
          {
            borderColor: theme.accent + "66",
            opacity: pressed ? 0.7 : 1,
          },
        ]}
        hitSlop={8}
        testID={`world-recording-more-${index}`}
      >
        <Ionicons name="ellipsis-horizontal" size={14} color={theme.accentDark} />
      </Pressable>
    </Pressable>
  );
}

// --- Memento block -------------------------------------------------------

function MementoBlock({
  theme,
  lang,
  available,
  onPress,
}: {
  theme: RankTheme;
  lang: "ru" | "en";
  available: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!available}
      accessibilityRole="button"
      accessibilityLabel={lang === "en" ? "Re-open rank-up memento" : "Открыть воспоминание о повышении"}
      testID="world-memento-cta"
      style={({ pressed }) => [
        detailStyles.mementoCard,
        {
          borderColor: theme.accent,
          backgroundColor: theme.cardBg,
          opacity: !available ? 0.55 : pressed ? 0.92 : 1,
        },
      ]}
    >
      <View style={detailStyles.mementoIcon}>
        <LinearGradient
          colors={theme.portalGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: 26 }]}
        />
        <Ionicons name={theme.portalIcon} size={22} color="#fff" />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text
          style={[
            detailStyles.cardTitle,
            { color: theme.textPrimary, fontFamily: theme.fontFamilyTitle, marginBottom: 0 },
          ]}
        >
          {lang === "en" ? "The rank-up moment" : "Момент повышения"}
        </Text>
        <Text
          style={[
            detailStyles.cardSub,
            { color: theme.textSecondary, fontFamily: theme.fontFamily },
          ]}
        >
          {available
            ? lang === "en"
              ? "Re-watch your portal ceremony as a keepsake."
              : "Пересмотри церемонию портала как воспоминание."
            : lang === "en"
            ? "Portal not finished — no ceremony to revisit."
            : "Портал не пройден — церемонии нет."}
        </Text>
      </View>
      {available && (
        <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
      )}
    </Pressable>
  );
}

// --- Modules block -------------------------------------------------------

function ModulesBlock({
  theme,
  lang,
  levels,
  onOpen,
}: {
  theme: RankTheme;
  lang: "ru" | "en";
  levels: Level[];
  onOpen: (id: string) => void;
}) {
  const sorted = [...levels].sort((a, b) => a.levelNumber - b.levelNumber);
  return (
    <View
      style={[
        detailStyles.card,
        { backgroundColor: theme.cardBg, borderColor: theme.borderColor },
      ]}
    >
      <View style={detailStyles.cardHeader}>
        <Ionicons name="layers" size={16} color={theme.accent} />
        <Text
          style={[
            detailStyles.cardTitle,
            { color: theme.textPrimary, fontFamily: theme.fontFamilyTitle },
          ]}
        >
          {lang === "en" ? "Modules in this rank" : "Модули этого ранга"}
        </Text>
      </View>
      <Text
        style={[
          detailStyles.cardSub,
          { color: theme.textSecondary, fontFamily: theme.fontFamily },
        ]}
      >
        {lang === "en"
          ? "Tap any module to revisit it. Your progress here is preserved."
          : "Нажми на модуль, чтобы вернуться к нему. Прогресс сохраняется."}
      </Text>
      <View style={{ marginTop: 4 }}>
        {sorted.map((l) => {
          const mc = MODULE_COLORS[l.module] ?? { color: theme.accent, colorDark: theme.accentDark };
          const tasksDone = l.tasks.filter((t) => t.status === "completed").length;
          return (
            <Pressable
              key={l.id}
              onPress={() => onOpen(l.id)}
              accessibilityRole="button"
              accessibilityLabel={`${l.title} · ${tasksDone}/${l.tasks.length}`}
              style={({ pressed }) => [
                detailStyles.modRow,
                {
                  borderColor: theme.borderColor,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
              testID={`world-module-${l.id}`}
            >
              <View style={[detailStyles.modBadge, { backgroundColor: mc.color }]}>
                <Text style={[detailStyles.modBadgeText, { fontFamily: "Rubik_700Bold" }]}>
                  {l.module}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    detailStyles.modTitle,
                    { color: theme.textPrimary, fontFamily: theme.fontFamilyTitle },
                  ]}
                  numberOfLines={1}
                >
                  {l.title}
                </Text>
                <Text
                  style={[
                    detailStyles.modSub,
                    { color: theme.textSecondary, fontFamily: theme.fontFamily },
                  ]}
                  numberOfLines={l.id?.startsWith("reading") ? 2 : 1}
                  adjustsFontSizeToFit={l.id?.startsWith("reading")}
                  minimumFontScale={0.7}
                >
                  {l.subtitle}
                </Text>
              </View>
              <View style={detailStyles.modMeta}>
                {l.completed ? (
                  <View style={[detailStyles.modCheckCircle, { backgroundColor: mc.color }]}>
                    <Ionicons name="checkmark" size={12} color="#fff" />
                  </View>
                ) : (
                  <Text
                    style={[
                      detailStyles.modProg,
                      { color: theme.textMuted, fontFamily: "Rubik_500Medium" },
                    ]}
                  >
                    {tasksDone}/{l.tasks.length}
                  </Text>
                )}
                <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const detailStyles = StyleSheet.create({
  headerWrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: 14,
    paddingBottom: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: {
    paddingHorizontal: 18,
    gap: 16,
  },
  heroBlock: { alignItems: "center", gap: 6, paddingVertical: 8 },
  kicker: {
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  heroTitle: { fontSize: 38, lineHeight: 42, textAlign: "center" },
  heroQuote: {
    fontSize: 14,
    lineHeight: 20,
    fontStyle: "italic",
    textAlign: "center",
    paddingHorizontal: 12,
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    gap: 6,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  cardTitle: { fontSize: 18 },
  cardSub: { fontSize: 13, lineHeight: 18 },
  recItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  recPlay: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  recBody: { flex: 1, gap: 4, justifyContent: "center" },
  recBodyTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  recLabel: { flex: 1, fontSize: 14 },
  recTime: { fontSize: 11, letterSpacing: 0.4 },
  recWaveTrack: {
    height: 26,
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 1,
  },
  recWaveBar: {
    flex: 1,
    minWidth: 1,
    borderRadius: 1,
  },
  recWavePlaceholder: {
    height: 4,
    width: "100%",
    borderRadius: 999,
    overflow: "hidden",
  },
  recWavePlaceholderFill: {
    height: "100%",
    borderRadius: 999,
  },
  recMute: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  recMore: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  recBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
  },
  recBadgeText: { fontSize: 9, letterSpacing: 0.8 },
  mementoCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1.5,
  },
  mementoIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  modRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderTopWidth: 1,
  },
  modBadge: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  modBadgeText: { color: "#fff", fontSize: 12 },
  modTitle: { fontSize: 15 },
  modSub: { fontSize: 12 },
  modMeta: { flexDirection: "row", alignItems: "center", gap: 6 },
  modProg: { fontSize: 11 },
  modCheckCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
    padding: 16,
  },
  sheetCard: {
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 4,
  },
  sheetGrabber: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.25)",
    marginBottom: 8,
  },
  sheetTitle: {
    fontSize: 16,
    marginTop: 4,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  sheetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 6,
  },
  sheetRowText: { fontSize: 15 },
  sheetCancel: {
    marginTop: 8,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
  },
  sheetCancelText: { fontSize: 14 },
  renameCard: {
    marginTop: "auto",
    marginBottom: "auto",
    borderRadius: 22,
    borderWidth: 1,
    padding: 18,
    gap: 10,
  },
  renameInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  renameHint: { fontSize: 12 },
  renameButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 6,
  },
  renameBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  renameBtnText: { fontSize: 14 },
});
