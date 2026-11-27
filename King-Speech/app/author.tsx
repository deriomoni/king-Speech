// My Studio — the player's speeches, laid out like Notes: a list of saved
// texts (title + date); tapping one opens the editor (title + text). After
// saving, «Выйти на сцену» reads it on the Show Time stage (no theme preview);
// its score screen can publish it (Royal plan).
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { appAlert } from "@/lib/appAlert";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  TextInput,
  KeyboardAvoidingView,
  BackHandler,
  Keyboard,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import Animated, { Easing, FadeIn, FadeInDown, FadeOut } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "@/lib/haptics";
import { useLang, pickLang, type Lang } from "@/context/LangContext";
import { useTheme } from "@/context/ThemeContext";
import { PlayTriangleIcon } from "@/components/showtime/ShowTimeIcons";
import { type AuthorDraft, deleteAuthorDraft, readAuthorDrafts, upsertAuthorDraft } from "@/lib/authorStage";
import { rs } from "@/lib/responsive";

export type { AuthorDraft };

const GOLD = "#FFD857";

function countWords(text: string) {
  // Whitespace-separated tokens that contain at least one letter/digit (so a
  // lone «—» doesn't count). No \p{L}: keep it Hermes-safe.
  return text
    .trim()
    .split(/\s+/)
    .filter((w) => /[0-9A-Za-zА-Яа-яЁёӘәҒғҚқҢңӨөҰұҮүҺһІі]/.test(w)).length;
}

function fmtApprox(sec: number, lang: Lang) {
  const en = lang === "en";
  if (sec < 60) return en ? `≈ ${sec} sec` : `≈ ${sec} сек`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (!s) return en ? `≈ ${m} min` : `≈ ${m} мин`;
  return en ? `≈ ${m} min ${s} sec` : `≈ ${m} мин ${s} сек`;
}

function wordsLabel(n: number, lang: Lang) {
  if (lang === "en") return `${n} ${n === 1 ? "word" : "words"}`;
  if (lang === "kk") return `${n} сөз`;
  const m10 = n % 10;
  const m100 = n % 100;
  const w = m10 === 1 && m100 !== 11 ? "слово" : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? "слова" : "слов";
  return `${n} ${w}`;
}

const pad2 = (n: number) => String(n).padStart(2, "0");
/** Notes-style date: time for today, otherwise the day. */
function fmtDate(ts: number) {
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;
}

const newId = () => `d${Date.now()}`;

type Editing = { id: string; isNew: boolean };

export default function AuthorScreen() {
  const insets = useSafeAreaInsets();
  const { lang } = useLang();
  const tr = (ru: string, en: string, kk: string) => pickLang(lang, { ru, en, kk });
  const { theme: c } = useTheme();
  const isDark = c.mode === "dark";
  // `draftId` — open this speech in the editor (e.g. coming back from the stage).
  const params = useLocalSearchParams<{ draftId?: string }>();

  const [drafts, setDrafts] = useState<AuthorDraft[]>([]);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  // What's on disk for the open speech — «Выйти на сцену» needs it saved.
  const [savedSnap, setSavedSnap] = useState<{ title: string; text: string } | null>(null);
  const [savedFlash, setSavedFlash] = useState(0);
  const [kbOpen, setKbOpen] = useState(false);
  const titleRef = useRef<any>(null);
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", () => setKbOpen(true));
    const hide = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", () => setKbOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  // A new speech: focus the title only after the editor has faded in, so the
  // keyboard doesn't jolt the transition.
  useEffect(() => {
    if (!editing?.isNew) return;
    const t = setTimeout(() => titleRef.current?.focus(), 420);
    return () => clearTimeout(t);
  }, [editing?.id, editing?.isNew]);

  const stroke = isDark ? "rgba(240,238,233,0.06)" : "rgba(38,38,40,0.08)";
  const topPad = Platform.OS === "web" ? rs(54) : insets.top;
  const bottomPad = Platform.OS === "web" ? rs(34) : insets.bottom;

  const words = useMemo(() => countWords(text), [text]);
  const seconds = Math.round(words / 1.7);
  const canSave = title.trim().length > 0 && words > 0;
  const dirty = !savedSnap || savedSnap.title !== title.trim() || savedSnap.text !== text;
  const canStage = !!savedSnap && !dirty;

  const refreshDrafts = useCallback(async () => {
    const list = await readAuthorDrafts();
    setDrafts(list);
    return list;
  }, []);

  const openDraft = (d: AuthorDraft) => {
    setEditing({ id: d.id, isNew: false });
    setTitle(d.title);
    setText(d.text);
    setSavedSnap({ title: d.title, text: d.text });
    setSavedFlash(0);
  };

  const openNew = () => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    setEditing({ id: newId(), isNew: true });
    setTitle("");
    setText("");
    setSavedSnap(null);
    setSavedFlash(0);
  };

  // Fresh list whenever the screen shows; open the requested speech once.
  const openedParamRef = useRef(false);
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      refreshDrafts().then((list) => {
        if (!alive || openedParamRef.current || !params.draftId) return;
        openedParamRef.current = true;
        const d = list.find((x) => x.id === params.draftId);
        if (d) openDraft(d);
      });
      return () => {
        alive = false;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [refreshDrafts]),
  );

  const closeEditor = () => {
    setEditing(null);
    void refreshDrafts();
  };

  const goBack = () => {
    if (editing) {
      closeEditor();
      return;
    }
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/profile");
  };

  // Android back closes the editor first.
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        if (!editing) return false;
        closeEditor();
        return true;
      });
      return () => sub.remove();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editing]),
  );

  const handleSave = async () => {
    if (!editing || !canSave) return;
    try {
      const prev = drafts.find((d) => d.id === editing.id);
      await upsertAuthorDraft({
        id: editing.id,
        title: title.trim(),
        category: prev?.category ?? "holidays",
        text,
        coverUri: prev?.coverUri,
        updatedAt: Date.now(),
        publishedAt: prev?.publishedAt,
      });
      await refreshDrafts();
      setEditing({ id: editing.id, isNew: false });
      setSavedSnap({ title: title.trim(), text });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setSavedFlash((n) => n + 1);
    } catch (e) {
      console.warn("[author] save failed:", e);
    }
  };

  // Straight onto the stage (it skips the theme preview for My Studio).
  const goOnStage = () => {
    if (!editing || !canStage) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    router.push({
      pathname: "/showtime-stage",
      params: { source: "author", title: title.trim(), text, category: "", draftId: editing.id },
    });
  };

  const confirmDelete = () => {
    if (!editing) return;
    const run = async () => {
      if (!editing.isNew) await deleteAuthorDraft(editing.id);
      closeEditor();
    };
    appAlert(tr("Удалить текст?", "Delete this text?", "Мәтінді жою керек пе?"), title.trim() ? `«${title.trim()}»` : undefined, [
      { text: tr("Отмена", "Cancel", "Болдырмау"), style: "cancel" },
      { text: tr("Удалить", "Delete", "Жою"), style: "destructive", onPress: () => void run() },
    ]);
  };

  // ── Editor ────────────────────────────────────────────────────────────────
  if (editing) {
    return (
      <View style={[s.container, { backgroundColor: c.bg }]}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <Animated.View
            key={editing.id}
            entering={FadeInDown.duration(420).easing(Easing.out(Easing.cubic))}
            style={{ flex: 1 }}
          >
          {/* tap anywhere outside the fields to hide the keyboard */}
          <Pressable
            onPress={Keyboard.dismiss}
            accessible={false}
            style={[s.content, s.editorWrap, { paddingTop: topPad + rs(8), paddingBottom: bottomPad + rs(16) }]}
          >
            <View style={s.topRow}>
              <Pressable onPress={goBack} hitSlop={12} style={s.back} accessibilityRole="button">
                <Ionicons name="chevron-back" size={rs(26)} color={c.text} />
              </Pressable>
              {kbOpen ? (
                <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)}>
                  <Pressable onPress={Keyboard.dismiss} hitSlop={10} accessibilityRole="button">
                    <Text style={[s.doneText, { color: c.text }]}>{tr("Готово", "Done", "Дайын")}</Text>
                  </Pressable>
                </Animated.View>
              ) : !editing.isNew && (
                <Pressable onPress={confirmDelete} hitSlop={10} style={s.back} accessibilityLabel={tr("Удалить", "Delete", "Жою")}>
                  <Ionicons name="trash-outline" size={rs(21)} color={c.textMuted} />
                </Pressable>
              )}
            </View>

            {/* Field · Название */}
            <View style={[s.field, { backgroundColor: c.card, borderColor: stroke }]}>
              <Text style={[s.fieldLabel, { color: c.textMuted }]}>{tr("НАЗВАНИЕ", "TITLE", "АТАУЫ")}</Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder={tr("Тост для лучшего друга", "Toast for my best friend", "Ең жақын досыма тост")}
                placeholderTextColor={c.textMuted}
                maxLength={60}
                ref={titleRef}
                returnKeyType="next"
                style={[s.titleInput, { color: c.text }, Platform.OS === "web" && ({ outlineStyle: "none" } as any)]}
              />
            </View>

            {/* Field · Текст выступления */}
            <View style={[s.textCard, { backgroundColor: c.card, borderColor: stroke }]}>
              <Text style={[s.fieldLabel, { color: c.textMuted }]}>{tr("ТЕКСТ ВЫСТУПЛЕНИЯ", "SPEECH TEXT", "СӨЗ МӘТІНІ")}</Text>
              <TextInput
                value={text}
                onChangeText={setText}
                multiline
                textAlignVertical="top"
                selectionColor={GOLD}
                cursorColor={GOLD}
                placeholder={tr("Друзья, давайте поднимем бокалы…", "Friends, let's raise our glasses…", "Достар, тостымызды көтерейік…")}
                placeholderTextColor={c.textMuted}
                style={[s.textInput, { color: c.text }, Platform.OS === "web" && ({ outlineStyle: "none" } as any)]}
              />
              <View style={s.statsRow}>
                <Text style={[s.stat, { color: c.textMuted }]}>{wordsLabel(words, lang)}</Text>
                <Text style={[s.stat, { color: c.textMuted, marginLeft: rs(12) }]}>{fmtApprox(seconds, lang)}</Text>
              </View>
            </View>

            {/* Save, then go on stage */}
            <View style={s.actions}>
              {dirty && (
                <Animated.View entering={FadeIn.duration(220)} exiting={FadeOut.duration(180)} style={{ flex: 1 }}>
                  <Pressable
                    onPress={handleSave}
                    disabled={!canSave}
                    style={({ pressed }) => [
                      s.btn,
                      { backgroundColor: c.card, borderColor: stroke, opacity: !canSave ? 0.45 : pressed ? 0.85 : 1 },
                    ]}
                  >
                    <Ionicons name="bookmark" size={rs(17)} color={c.text} />
                    <Text style={[s.btnText, { color: c.text }]}>{tr("Сохранить", "Save", "Сақтау")}</Text>
                  </Pressable>
                </Animated.View>
              )}
              <Pressable
                onPress={goOnStage}
                disabled={!canStage}
                style={({ pressed }) => [s.btn, s.stageBtn, { opacity: !canStage ? 0.45 : pressed ? 0.85 : 1 }]}
              >
                <PlayTriangleIcon color="#262628" scale={0.85} />
                <Text style={[s.btnText, { color: "#262628" }]} numberOfLines={1}>
                  {tr("Выйти на сцену", "Go on stage", "Сахнаға шығу")}
                </Text>
              </Pressable>
            </View>
            {savedFlash > 0 && !dirty ? (
              <Animated.Text key={savedFlash} entering={FadeIn.duration(250)} style={[s.hint, { color: c.textMuted }]}>
                {tr("Сохранено в My Studio", "Saved to My Studio", "My Studio-ға сақталды")}
              </Animated.Text>
            ) : !canStage ? (
              <Text style={[s.hint, { color: c.textMuted }]}>
                {tr("Сохрани текст, чтобы выйти с ним на сцену", "Save the text to take it on stage", "Сахнаға шығу үшін мәтінді сақтаңыз")}
              </Text>
            ) : null}
          </Pressable>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    );
  }

  // ── List (like Notes) ─────────────────────────────────────────────────────
  return (
    <Animated.View entering={FadeIn.duration(320)} style={[s.container, { backgroundColor: c.bg }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.content, { paddingTop: topPad + rs(8), paddingBottom: bottomPad + rs(120) }]}
      >
        <View style={s.topRow}>
          <Pressable onPress={goBack} hitSlop={12} style={s.back} accessibilityRole="button">
            <Ionicons name="chevron-back" size={rs(26)} color={c.text} />
          </Pressable>
        </View>

        <Text style={[s.title, { color: c.text }]}>My Studio</Text>
        <Text style={[s.subtitle, { color: c.textMuted }]}>
          {tr("Твои выступления", "Your speeches", "Сенің сөздерің")}
        </Text>

        {drafts.length === 0 ? (
          <View style={[s.emptyCard, { backgroundColor: c.card, borderColor: stroke }]}>
            <Ionicons name="document-text-outline" size={rs(30)} color={c.textMuted} />
            <Text style={[s.emptyText, { color: c.textMuted }]}>
              {tr("Пока пусто. Нажми «+», чтобы написать первое выступление.", "Nothing yet. Tap «+» to write your first speech.", "Әзірге бос. Алғашқы сөзді жазу үшін «+» басыңыз.")}
            </Text>
          </View>
        ) : (
          <View style={[s.list, { backgroundColor: c.card, borderColor: stroke }]}>
            {drafts.map((d, i) => (
              <Animated.View key={d.id} entering={FadeInDown.duration(260).delay(Math.min(i, 8) * 40)}>
                <Pressable
                  onPress={() => openDraft(d)}
                  style={({ pressed }) => [s.row, { opacity: pressed ? 0.6 : 1 }]}
                  accessibilityRole="button"
                >
                  <Text style={[s.rowTitle, { color: c.text }]} numberOfLines={1}>
                    {d.title}
                  </Text>
                  <Text style={[s.rowDate, { color: c.textMuted }]} numberOfLines={1}>
                    {fmtDate(d.updatedAt)}
                  </Text>
                </Pressable>
                {i < drafts.length - 1 && <View style={[s.sep, { backgroundColor: stroke }]} />}
              </Animated.View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* New speech — bottom right, like Notes */}
      <Pressable
        onPress={openNew}
        style={({ pressed }) => [s.fab, { bottom: bottomPad + rs(20), opacity: pressed ? 0.85 : 1 }]}
        accessibilityRole="button"
        accessibilityLabel={tr("Новое выступление", "New speech", "Жаңа сөз")}
      >
        <Ionicons name="add" size={rs(30)} color="#262628" />
      </Pressable>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20, width: "100%", maxWidth: 480, alignSelf: "center" },
  editorWrap: { flex: 1 },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", height: 44 },
  back: { width: 44, height: 44, justifyContent: "center", marginLeft: -4 },
  title: { fontSize: 32, letterSpacing: -0.5, fontFamily: "Geologica_800ExtraBold", marginTop: 12 },
  subtitle: { fontSize: 14, fontFamily: "Geologica_500Medium", marginTop: 2 },

  list: { borderRadius: 22, borderWidth: 2, marginTop: 22, paddingHorizontal: 18 },
  row: { paddingVertical: 14 },
  rowTitle: { fontSize: 17, fontFamily: "Geologica_700Bold" },
  rowDate: { fontSize: 14, fontFamily: "Geologica_500Medium", marginTop: 3 },
  sep: { height: 1.5 },
  emptyCard: { borderRadius: 22, borderWidth: 2, marginTop: 22, padding: 28, alignItems: "center", gap: 10 },
  emptyText: { fontSize: 14, lineHeight: 20, fontFamily: "Geologica_500Medium", textAlign: "center" },
  fab: {
    position: "absolute",
    right: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: GOLD,
    alignItems: "center",
    justifyContent: "center",
  },

  field: { borderRadius: 22, borderWidth: 2, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10, marginTop: 12 },
  fieldLabel: { fontSize: 10, letterSpacing: 1, fontFamily: "Geologica_800ExtraBold" },
  titleInput: { fontSize: 17, fontFamily: "Geologica_700Bold", paddingVertical: 4, marginTop: 2 },

  textCard: { flex: 1, minHeight: 220, borderRadius: 22, borderWidth: 2, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 16, marginTop: 14 },
  textInput: { flex: 1, fontSize: 16, lineHeight: 23, fontFamily: "Geologica_500Medium", marginTop: 8, padding: 0 },
  statsRow: { flexDirection: "row", alignItems: "center", marginTop: 10 },
  stat: { fontSize: 12, fontFamily: "Geologica_600SemiBold" },

  actions: { flexDirection: "row", gap: 10, marginTop: 18 },
  btn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 52,
    borderRadius: 32,
  },
  stageBtn: { flex: 1.3, backgroundColor: GOLD, borderColor: GOLD },
  btnText: { fontSize: 15, fontFamily: "Geologica_800ExtraBold" },
  doneText: { fontSize: 16, fontFamily: "Geologica_700Bold" },
  hint: { fontSize: 12, fontFamily: "Geologica_500Medium", textAlign: "center", marginTop: 10 },
});
