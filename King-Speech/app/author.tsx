// «Стать автором» — Figma "Screen / 07 · Стать автором" (426:1674) + publish
// sheet "07b · публикация" (426:1716), dark components with Light mode instances.
// Editor: title, category chips, speech text with word count and ≈ duration
// (words / 1.7 sec), yellow «Прочитать вслух». After reading, the publish sheet:
// preview card, «Обложка» upload (expo-image-picker), «Опубликовать в каталог»
// (TODO backend) and «Сохранить для себя» (local draft in AsyncStorage).
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  TextInput,
  Modal,
  Image,
  Alert,
  KeyboardAvoidingView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "@/lib/haptics";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLang } from "@/context/LangContext";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { PlayTriangleIcon } from "@/components/showtime/ShowTimeIcons";
import { AUTHOR_READ_RESULT_KEY, type AuthorReadResult } from "@/lib/authorStage";

let Audio: any = null;
if (Platform.OS !== "web") {
  Audio = require("@/lib/av").Audio;
}

const DRAFTS_KEY = "@kingspeech_author_drafts_v1";
const GOLD = "#FFD857";

type CategoryId = "holidays" | "business" | "study" | "kids";
const CATEGORIES: { id: CategoryId; ru: string; en: string; cover: [string, string] }[] = [
  { id: "holidays", ru: "Праздники", en: "Holidays", cover: ["#F39A4A", "#C94C17"] },
  { id: "business", ru: "Бизнес", en: "Business", cover: ["#5B8DEF", "#2C4FB0"] },
  { id: "study", ru: "Учёба", en: "Study", cover: ["#A777E8", "#5B33B5"] },
  { id: "kids", ru: "Для детей", en: "For kids", cover: ["#4FC48A", "#1F7D52"] },
];

export type AuthorDraft = {
  id: string;
  title: string;
  category: CategoryId;
  text: string;
  coverUri?: string;
  updatedAt: number;
};

function countWords(text: string) {
  // Whitespace-separated tokens that contain at least one letter/digit (so a
  // lone «—» doesn't count). No \p{L}: keep it Hermes-safe.
  return text
    .trim()
    .split(/\s+/)
    .filter((w) => /[0-9A-Za-zА-Яа-яЁё]/.test(w)).length;
}

function fmtApprox(sec: number, en: boolean) {
  if (sec < 60) return en ? `≈ ${sec} sec` : `≈ ${sec} сек`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (!s) return en ? `≈ ${m} min` : `≈ ${m} мин`;
  return en ? `≈ ${m} min ${s} sec` : `≈ ${m} мин ${s} сек`;
}

function wordsLabel(n: number, en: boolean) {
  if (en) return `${n} ${n === 1 ? "word" : "words"}`;
  const m10 = n % 10;
  const m100 = n % 100;
  const w = m10 === 1 && m100 !== 11 ? "слово" : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? "слова" : "слов";
  return `${n} ${w}`;
}

export default function AuthorScreen() {
  const insets = useSafeAreaInsets();
  const { lang } = useLang();
  const en = lang === "en";
  const { theme: c } = useTheme();
  const isDark = c.mode === "dark";
  const { user } = useAuth();
  // Set when we come back from the stage via `replace` (no screen to go back
  // to): which draft to restore and whether the reading was finished.
  const params = useLocalSearchParams<{ draftId?: string; read?: string; recordingUri?: string }>();

  const [draftId, setDraftId] = useState(() => params.draftId || `d${Date.now()}`);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<CategoryId>("holidays");
  const [text, setText] = useState("");
  const [coverUri, setCoverUri] = useState<string | undefined>(undefined);
  const [sheetOpen, setSheetOpen] = useState(false);
  // The take recorded on the stage — can be played back from the sheet.
  const [recordingUri, setRecordingUri] = useState<string | undefined>(undefined);
  const [playing, setPlaying] = useState(false);
  const soundRef = useRef<any>(null);
  const webAudioRef = useRef<any>(null);
  const draftIdRef = useRef(draftId);
  draftIdRef.current = draftId;

  const stroke = isDark ? "rgba(240,238,233,0.06)" : "rgba(38,38,40,0.08)";
  const topPad = Platform.OS === "web" ? 54 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const words = useMemo(() => countWords(text), [text]);
  const seconds = Math.round(words / 1.7);
  const cat = CATEGORIES.find((x) => x.id === category) ?? CATEGORIES[0];
  const canRead = title.trim().length > 0 && words > 0;

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/profile");
  };

  const readDrafts = async (): Promise<AuthorDraft[]> => {
    try {
      const raw = await AsyncStorage.getItem(DRAFTS_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  };

  const applyDraft = (d: AuthorDraft) => {
    setDraftId(d.id);
    setTitle(d.title);
    setCategory(CATEGORIES.some((x) => x.id === d.category) ? d.category : "holidays");
    setText(d.text);
    setCoverUri(d.coverUri);
  };

  // Upsert the current editor state into the local drafts list.
  const persistDraft = async () => {
    const draft: AuthorDraft = {
      id: draftId,
      title: title.trim(),
      category,
      text,
      coverUri,
      updatedAt: Date.now(),
    };
    const drafts = (await readDrafts()).filter((d) => d.id !== draft.id);
    await AsyncStorage.setItem(DRAFTS_KEY, JSON.stringify([draft, ...drafts].slice(0, 50)));
  };

  // Came back from the stage through `replace` (this screen was not in the
  // stack any more): restore the draft that was read, open the sheet if done.
  useEffect(() => {
    if (!params.draftId) return;
    let alive = true;
    (async () => {
      const d = (await readDrafts()).find((x) => x.id === params.draftId);
      if (alive && d) applyDraft(d);
    })();
    if (params.read === "1") {
      if (params.recordingUri) setRecordingUri(params.recordingUri);
      setSheetOpen(true);
    }
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Back from the stage via `router.back()`: the stage leaves its result in
  // storage when the speech was read to the end — then show the sheet.
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        try {
          const raw = await AsyncStorage.getItem(AUTHOR_READ_RESULT_KEY);
          if (!raw) return;
          await AsyncStorage.removeItem(AUTHOR_READ_RESULT_KEY);
          const res = JSON.parse(raw) as AuthorReadResult;
          if (!alive || (res.draftId && res.draftId !== draftIdRef.current)) return;
          setRecordingUri(res.recordingUri || undefined);
          setSheetOpen(true);
        } catch {}
      })();
      return () => {
        alive = false;
      };
    }, []),
  );

  const stopPlayback = useCallback(async () => {
    setPlaying(false);
    const w = webAudioRef.current;
    webAudioRef.current = null;
    if (w) {
      try {
        w.pause();
      } catch {}
    }
    const snd = soundRef.current;
    soundRef.current = null;
    if (snd) {
      try {
        await snd.stopAsync();
        await snd.unloadAsync();
      } catch {}
    }
  }, []);
  useEffect(() => () => void stopPlayback(), [stopPlayback]);
  useEffect(() => {
    if (!sheetOpen) void stopPlayback();
  }, [sheetOpen, stopPlayback]);

  const togglePlayback = async () => {
    if (playing) {
      await stopPlayback();
      return;
    }
    if (!recordingUri) return;
    try {
      if (Platform.OS === "web") {
        const a = new (window as any).Audio(recordingUri);
        webAudioRef.current = a;
        a.onended = () => {
          if (webAudioRef.current === a) void stopPlayback();
        };
        await a.play();
      } else {
        try {
          await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
        } catch {}
        const { sound } = await Audio.Sound.createAsync({ uri: recordingUri }, { shouldPlay: true });
        soundRef.current = sound;
        sound.setOnPlaybackStatusUpdate((st: any) => {
          if (st?.didJustFinish && soundRef.current === sound) void stopPlayback();
        });
      }
      setPlaying(true);
    } catch (e) {
      console.warn("[author] playback failed:", e);
      void stopPlayback();
    }
  };

  // «Черновики»: load the most recently saved draft into the editor.
  // TODO(author): a proper drafts list screen.
  const openDrafts = async () => {
    const drafts = await readDrafts();
    const last = drafts.sort((a, b) => b.updatedAt - a.updatedAt)[0];
    if (!last) {
      Alert.alert(en ? "Drafts" : "Черновики", en ? "No saved drafts yet." : "Сохранённых черновиков пока нет.");
      return;
    }
    applyDraft(last);
    setRecordingUri(undefined);
  };

  // «Прочитать вслух»: the Show Time stage with the player's own text
  // (showtime-stage `source=author`). Finished → back here with the sheet open;
  // left early → back to the editor as it was.
  const handleRead = async () => {
    if (!canRead) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    await stopPlayback();
    setRecordingUri(undefined);
    try {
      // Keep the draft safe in case this screen is unmounted meanwhile.
      await persistDraft();
    } catch (e) {
      console.warn("[author] persist draft failed:", e);
    }
    router.push({
      pathname: "/showtime-stage",
      params: { source: "author", title: title.trim(), text, category: en ? cat.en : cat.ru, draftId },
    });
  };

  const pickCover = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(en ? "Photos" : "Доступ к фото", en ? "Allow photo access to pick a cover." : "Разреши доступ к галерее, чтобы выбрать обложку.");
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (res.canceled || !res.assets?.[0]) return;
      setCoverUri(res.assets[0].uri);
    } catch (e: any) {
      console.warn("[author] pick cover failed:", e);
    }
  };

  const publish = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    // TODO(backend): upload the topic (title, category, text, cover) to the shared catalog.
    Alert.alert(en ? "Coming soon" : "Скоро", en ? "Publishing to the catalog is coming soon." : "Публикация в каталог скоро появится.");
  };

  const saveForMe = async () => {
    try {
      await persistDraft();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setSheetOpen(false);
      Alert.alert(en ? "Saved" : "Сохранено", en ? "The draft is in «Drafts»." : "Черновик сохранён в «Черновиках».");
    } catch (e) {
      console.warn("[author] save draft failed:", e);
    }
  };

  return (
    <View style={[s.container, { backgroundColor: c.bg }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[s.content, { paddingTop: topPad + 8, paddingBottom: bottomPad + 40 }]}
        >
          <View style={s.topRow}>
            <Pressable onPress={goBack} hitSlop={12} style={s.back} accessibilityRole="button">
              <Ionicons name="chevron-back" size={26} color={c.text} />
            </Pressable>
            <Pressable onPress={openDrafts} hitSlop={10}>
              <Text style={[s.drafts, { color: c.textMuted }]}>{en ? "Drafts" : "Черновики"}</Text>
            </Pressable>
          </View>

          <Text style={[s.title, { color: c.text }]}>{en ? "Become an author" : "Стать автором"}</Text>
          <Text style={[s.subtitle, { color: c.textMuted }]}>
            {en ? "Write your speech and read it aloud" : "Напиши своё выступление и прочитай его"}
          </Text>

          {/* Field · Название */}
          <View style={[s.field, { backgroundColor: c.card, borderColor: stroke }]}>
            <Text style={[s.fieldLabel, { color: c.textMuted }]}>{en ? "TITLE" : "НАЗВАНИЕ"}</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder={en ? "Toast for my best friend" : "Тост для лучшего друга"}
              placeholderTextColor={c.textMuted}
              maxLength={60}
              style={[s.titleInput, { color: c.text }, Platform.OS === "web" && ({ outlineStyle: "none" } as any)]}
            />
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipsScroll} contentContainerStyle={s.chips}>
            {CATEGORIES.map((x) => {
              const active = x.id === category;
              return (
                <Pressable
                  key={x.id}
                  onPress={() => {
                    setCategory(x.id);
                    if (Platform.OS !== "web") Haptics.selectionAsync();
                  }}
                  style={[
                    s.chip,
                    active ? { backgroundColor: c.text, borderColor: c.text } : { backgroundColor: c.card, borderColor: stroke },
                  ]}
                >
                  <Text style={[s.chipText, { color: active ? c.bg : c.textSecondary }]}>{en ? x.en : x.ru}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Field · Текст выступления */}
          <View style={[s.textCard, { backgroundColor: c.card, borderColor: stroke }]}>
            <Text style={[s.fieldLabel, { color: c.textMuted }]}>{en ? "SPEECH TEXT" : "ТЕКСТ ВЫСТУПЛЕНИЯ"}</Text>
            <TextInput
              value={text}
              onChangeText={setText}
              multiline
              textAlignVertical="top"
              selectionColor={GOLD}
              cursorColor={GOLD}
              placeholder={
                en
                  ? "Friends, let's raise our glasses…"
                  : "Друзья, давайте поднимем бокалы…"
              }
              placeholderTextColor={c.textMuted}
              style={[s.textInput, { color: c.text }, Platform.OS === "web" && ({ outlineStyle: "none" } as any)]}
            />
            <View style={s.statsRow}>
              <Text style={[s.stat, { color: c.textMuted }]}>{wordsLabel(words, en)}</Text>
              <Text style={[s.stat, { color: c.textMuted, marginLeft: 12 }]}>{fmtApprox(seconds, en)}</Text>
              <Text style={[s.stat, s.tip, { color: c.textMuted }]} numberOfLines={1}>
                {en ? "Tip: 1–2 minutes is ideal" : "Совет: 1–2 минуты — идеально"}
              </Text>
            </View>
          </View>

          <Pressable
            onPress={handleRead}
            disabled={!canRead}
            style={({ pressed }) => [s.readBtn, { opacity: !canRead ? 0.45 : pressed ? 0.85 : 1 }]}
          >
            <PlayTriangleIcon color="#262628" />
            <Text style={s.readText}>{en ? "Read aloud" : "Прочитать вслух"}</Text>
          </Pressable>
          <Text style={[s.hint, { color: c.textMuted }]}>
            {en ? "Read it first — then you can publish" : "Сначала прочитай — потом сможешь опубликовать"}
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* 07b · Publish sheet */}
      <Modal visible={sheetOpen} transparent animationType="slide" onRequestClose={() => setSheetOpen(false)}>
        <Pressable style={s.dim} onPress={() => setSheetOpen(false)}>
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={[s.sheet, { backgroundColor: c.bg, borderColor: c.panelStroke, paddingBottom: bottomPad + 20 + SHEET_TUCK }]}
          >
            <View style={[s.grabber, { backgroundColor: c.textMuted }]} />
            <Text style={[s.sheetTitle, { color: c.text }]}>{en ? "Nicely read!" : "Отлично прочитано!"}</Text>
            <Text style={[s.sheetSub, { color: c.textSecondary }]}>
              {en ? "Share the topic — other players can read it too" : "Поделись темой — её смогут прочитать другие игроки"}
            </Text>

            <View style={[s.preview, { backgroundColor: c.card, borderColor: stroke }]}>
              <View style={s.previewCover}>
                {coverUri ? (
                  <Image source={{ uri: coverUri }} style={s.fill} resizeMode="cover" />
                ) : (
                  <>
                    <LinearGradient colors={cat.cover} start={{ x: 0, y: 0 }} end={{ x: 0.4, y: 1 }} style={s.fill} />
                    <View style={s.previewOrb} />
                  </>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.previewTitle, { color: c.text }]} numberOfLines={2}>
                  {title.trim()}
                </Text>
                <Text style={[s.previewMeta, { color: c.textMuted }]}>
                  {en ? cat.en : cat.ru} · {fmtApprox(seconds, en)}
                </Text>
                {!!user?.name && (
                  <Text style={[s.previewAuthor, { color: c.textSecondary }]} numberOfLines={1}>
                    {en ? "Author: " : "Автор: "}
                    {user.name}
                  </Text>
                )}
              </View>
            </View>

            {!!recordingUri && (
              <Pressable
                onPress={togglePlayback}
                hitSlop={8}
                style={({ pressed }) => [s.listenBtn, { borderColor: stroke, opacity: pressed ? 0.8 : 1 }]}
              >
                <Ionicons name={playing ? "stop" : "play"} size={16} color={c.text} />
                <Text style={[s.listenText, { color: c.text }]}>
                  {playing ? (en ? "Stop" : "Остановить") : en ? "Listen to your reading" : "Послушать своё чтение"}
                </Text>
              </Pressable>
            )}

            <Text style={[s.coverLabel, { color: c.text }]}>{en ? "Cover" : "Обложка"}</Text>
            <Pressable
              onPress={pickCover}
              style={({ pressed }) => [
                s.upload,
                { backgroundColor: c.card, borderColor: c.textMuted, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Ionicons name="image-outline" size={22} color={c.text} />
              <View style={{ flex: 1 }}>
                <Text style={[s.uploadTitle, { color: c.text }]}>
                  {coverUri ? (en ? "Change photo" : "Сменить фото") : en ? "Upload photo" : "Загрузить фото"}
                </Text>
                <Text style={[s.uploadSub, { color: c.textMuted }]}>
                  {en ? "Your favourite photo for the cover" : "Твоя любимая фотография для обложки"}
                </Text>
              </View>
            </Pressable>

            <Pressable onPress={publish} style={({ pressed }) => [s.publishBtn, { opacity: pressed ? 0.85 : 1 }]}>
              <Text style={s.publishText}>{en ? "Publish to catalog" : "Опубликовать в каталог"}</Text>
            </Pressable>
            <Pressable onPress={saveForMe} hitSlop={8} style={s.saveBtn}>
              <Text style={[s.saveText, { color: c.textSecondary }]}>{en ? "Save for myself" : "Сохранить для себя"}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const SHEET_TUCK = 40;

const s = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20, width: "100%", maxWidth: 480, alignSelf: "center" },
  fill: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", height: 44 },
  back: { width: 44, height: 44, justifyContent: "center", marginLeft: -4 },
  drafts: { fontSize: 14, fontFamily: "Geologica_700Bold" },
  title: { fontSize: 32, letterSpacing: -0.5, fontFamily: "Geologica_800ExtraBold", marginTop: 12 },
  subtitle: { fontSize: 14, fontFamily: "Geologica_500Medium", marginTop: 2 },

  field: { borderRadius: 22, borderWidth: 2, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10, marginTop: 22 },
  fieldLabel: { fontSize: 10, letterSpacing: 1, fontFamily: "Geologica_800ExtraBold" },
  titleInput: { fontSize: 17, fontFamily: "Geologica_700Bold", paddingVertical: 4, marginTop: 2 },

  chipsScroll: { marginTop: 16, marginHorizontal: -20 },
  chips: { paddingHorizontal: 20, gap: 8 },
  chip: { height: 36, borderRadius: 18, borderWidth: 1, paddingHorizontal: 15, justifyContent: "center" },
  chipText: { fontSize: 13, fontFamily: "Geologica_700Bold" },

  textCard: { height: 340, borderRadius: 22, borderWidth: 2, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 18, marginTop: 16 },
  textInput: { flex: 1, fontSize: 16, lineHeight: 23, fontFamily: "Geologica_500Medium", marginTop: 8, padding: 0 },
  statsRow: { flexDirection: "row", alignItems: "center", marginTop: 10 },
  stat: { fontSize: 12, fontFamily: "Geologica_600SemiBold" },
  tip: { flex: 1, textAlign: "right", marginLeft: 12 },

  readBtn: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    height: 50,
    borderRadius: 32,
    backgroundColor: GOLD,
    paddingHorizontal: 22,
    gap: 8,
    marginTop: 24,
  },
  readText: { color: "#262628", fontSize: 16, fontFamily: "Geologica_800ExtraBold" },
  hint: { fontSize: 12, fontFamily: "Geologica_500Medium", textAlign: "center", marginTop: 12 },

  dim: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  // Uniform border + radius on the sheet itself, bottom edge tucked below the
  // screen: a translucent stroke with one side at 0 is drawn on iOS as separate
  // side polygons whose overlapping corner joins showed up as a seam.
  sheet: {
    borderRadius: 32,
    borderWidth: 1.5,
    marginBottom: -SHEET_TUCK,
    paddingHorizontal: 20,
    paddingTop: 10,
    width: "100%",
    maxWidth: 480,
    alignSelf: "center",
  },
  grabber: { alignSelf: "center", width: 40, height: 5, borderRadius: 3, opacity: 0.6 },
  sheetTitle: { fontSize: 23, letterSpacing: -0.3, fontFamily: "Geologica_800ExtraBold", textAlign: "center", marginTop: 22 },
  sheetSub: { fontSize: 13, fontFamily: "Geologica_500Medium", textAlign: "center", marginTop: 6 },
  preview: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderRadius: 22,
    borderWidth: 2,
    padding: 6,
    paddingRight: 16,
    marginTop: 20,
  },
  previewCover: { width: 96, height: 96, borderRadius: 16, overflow: "hidden" },
  previewOrb: {
    position: "absolute",
    right: -26,
    top: -30,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  previewTitle: { fontSize: 16, fontFamily: "Geologica_800ExtraBold" },
  previewMeta: { fontSize: 12, fontFamily: "Geologica_600SemiBold", marginTop: 5 },
  previewAuthor: { fontSize: 12, fontFamily: "Geologica_700Bold", marginTop: 7 },
  listenBtn: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    marginTop: 14,
  },
  listenText: { fontSize: 13, fontFamily: "Geologica_700Bold" },
  coverLabel: { fontSize: 14, fontFamily: "Geologica_700Bold", marginTop: 20 },
  upload: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    height: 66,
    borderRadius: 18,
    borderWidth: 1.5,
    borderStyle: "dashed",
    paddingHorizontal: 17,
    marginTop: 8,
  },
  uploadTitle: { fontSize: 14, fontFamily: "Geologica_700Bold" },
  uploadSub: { fontSize: 12, fontFamily: "Geologica_500Medium", marginTop: 3 },
  publishBtn: {
    alignSelf: "center",
    height: 50,
    borderRadius: 32,
    backgroundColor: GOLD,
    paddingHorizontal: 30,
    justifyContent: "center",
    marginTop: 22,
  },
  publishText: { color: "#262628", fontSize: 16, fontFamily: "Geologica_800ExtraBold" },
  saveBtn: { alignSelf: "center", paddingVertical: 12, marginTop: 2 },
  saveText: { fontSize: 14, fontFamily: "Geologica_700Bold" },
});
