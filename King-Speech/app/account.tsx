// «Настройки · Аккаунт» — Figma 313:4647.
import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  Image,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "@/lib/haptics";
import * as ImagePicker from "expo-image-picker";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { useGame } from "@/context/GameContext";
import { useLang } from "@/context/LangContext";
import AppDialog, { type AppDialogButton } from "@/components/AppDialog";
import NameEditDialog from "@/components/account/NameEditDialog";
import { storage as fbStorage, auth as fbAuth, firebaseConfigured } from "@/lib/firebase";

type DialogState = { title: string; message?: string; buttons: AppDialogButton[] } | null;

const AUTH_LABEL: Record<string, string> = {
  google: "Google",
  apple: "Apple",
  email: "Email",
};

export default function AccountScreen() {
  const { theme, themeMode } = useTheme();
  const isDark = themeMode === "dark";
  const { lang } = useLang();
  const en = lang === "en";
  const insets = useSafeAreaInsets();
  const { user, signOut, saveProfile, setPhotoURL } = useAuth();
  const { resetProgress } = useGame();

  const [dialog, setDialog] = useState<DialogState>(null);
  const [nameOpen, setNameOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  const topPad = Platform.OS === "web" ? 54 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const ink = (a: number) => (isDark ? `rgba(240,238,233,${a})` : `rgba(38,38,40,${a})`);
  const stroke = isDark ? "rgba(240,238,233,0.06)" : "rgba(38,38,40,0.08)";

  const name = user?.name || (en ? "Player" : "Игрок");
  const initial = name.trim().charAt(0).toUpperCase() || "К";
  const email = user?.email || "—";
  const method = user?.isOffline
    ? en ? "Offline" : "Офлайн"
    : AUTH_LABEL[user?.authMethod ?? ""] ?? "—";

  const back = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/settings" as any);
  };

  const closeDialog = () => setDialog(null);

  // Same flow as the Profile tab's avatar «Галерея» option (pick → upload to
  // Firebase Storage → setPhotoURL, falling back to the local uri).
  const changePhoto = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Доступ к фото", "Разреши доступ к галерее, чтобы установить аватар.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      setUploading(true);
      try {
        if (firebaseConfigured && fbStorage && fbAuth?.currentUser) {
          try {
            const blob = await (await fetch(asset.uri)).blob();
            const path = storageRef(fbStorage, `avatars/${fbAuth.currentUser.uid}.jpg`);
            await uploadBytes(path, blob, { contentType: blob.type || "image/jpeg" });
            await setPhotoURL(await getDownloadURL(path));
          } catch (e) {
            console.warn("[account] avatar upload failed:", e);
            await setPhotoURL(asset.uri);
          }
        } else {
          await setPhotoURL(asset.uri);
        }
      } finally {
        setUploading(false);
      }
    } catch (e: any) {
      console.warn("[account] pick avatar failed:", e);
    }
  };

  const confirmSignOut = () =>
    setDialog({
      title: en ? "Sign out?" : "Выйти из аккаунта?",
      message: en ? "You can sign back in at any time." : "Вы сможете войти снова в любой момент.",
      buttons: [
        { label: en ? "Cancel" : "Отмена", onPress: closeDialog },
        {
          label: en ? "Sign out" : "Выйти",
          variant: "primary",
          onPress: async () => {
            closeDialog();
            await signOut();
            router.replace("/(auth)/welcome");
          },
        },
      ],
    });

  const confirmReset = () =>
    setDialog({
      title: en ? "Reset progress?" : "Сбросить прогресс?",
      message: en
        ? "All levels, XP and coins will start over."
        : "Все уровни, опыт и монеты начнутся заново.",
      buttons: [
        { label: en ? "Cancel" : "Отмена", onPress: closeDialog },
        {
          label: en ? "Reset" : "Сбросить",
          variant: "primary",
          onPress: () => {
            closeDialog();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            resetProgress();
          },
        },
      ],
    });

  const confirmDelete = () =>
    setDialog({
      title: en ? "Delete account?" : "Удалить аккаунт?",
      message: en
        ? "Your profile, recordings, progress and coins will be deleted. This can't be undone."
        : "Удалятся профиль, записи, прогресс и монеты. Восстановить их будет нельзя.",
      buttons: [
        { label: en ? "Cancel" : "Отмена", onPress: closeDialog },
        {
          label: en ? "Delete" : "Удалить",
          variant: "primary",
          onPress: async () => {
            closeDialog();
            // TODO(design): call a real account-deletion API (Firebase user + data
            // wipe) once one exists. For now: wipe local progress and sign out.
            resetProgress();
            await signOut();
            router.replace("/(auth)/welcome");
          },
        },
      ],
    });

  const Chevron = () => <Ionicons name="chevron-forward" size={17} color={ink(0.5)} />;

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <ScrollView
        contentContainerStyle={{ paddingTop: topPad, paddingBottom: bottomPad + 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={back} hitSlop={12} style={styles.backBtn} accessibilityLabel="Назад">
            <Ionicons name="chevron-back" size={24} color={theme.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: theme.text }]}>{en ? "Account" : "Аккаунт"}</Text>
        </View>

        {/* Avatar */}
        <Pressable onPress={changePhoto} style={styles.avatar} accessibilityLabel="Изменить фото">
          {user?.photoURL ? (
            <Image source={{ uri: user.photoURL }} style={styles.avatarImg} />
          ) : (
            <Text style={styles.avatarInitial}>{initial}</Text>
          )}
          {uploading ? (
            <View style={styles.avatarBusy}>
              <ActivityIndicator color="#FFFFFF" />
            </View>
          ) : null}
        </Pressable>
        <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
          {name}
        </Text>
        <Pressable onPress={changePhoto} hitSlop={8} style={{ alignSelf: "center" }}>
          <Text style={[styles.changePhoto, { color: theme.accentInk }]}>
            {en ? "Change photo" : "Изменить фото"}
          </Text>
        </Pressable>

        {/* ДАННЫЕ */}
        <Text style={[styles.sectionLabel, { color: ink(0.5) }]}>{en ? "DETAILS" : "ДАННЫЕ"}</Text>
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: stroke }]}>
          <Pressable
            onPress={() => setNameOpen(true)}
            style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.rowPressed }]}
          >
            <Text style={[styles.rowLabel, { color: theme.text }]}>{en ? "Name" : "Имя"}</Text>
            <View style={styles.rowRight}>
              <Text style={[styles.rowValue, { color: ink(0.5) }]} numberOfLines={1}>
                {name}
              </Text>
              <Chevron />
            </View>
          </Pressable>
          <View style={[styles.divider, { backgroundColor: theme.divider }]} />
          <Pressable
            onPress={() => {
              // TODO(design): email change flow (needs re-auth via Firebase).
            }}
            style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.rowPressed }]}
          >
            <Text style={[styles.rowLabel, { color: theme.text }]}>Email</Text>
            <View style={styles.rowRight}>
              <Text style={[styles.rowValue, { color: ink(0.5) }]} numberOfLines={1}>
                {email}
              </Text>
              <Chevron />
            </View>
          </Pressable>
          <View style={[styles.divider, { backgroundColor: theme.divider }]} />
          <View style={styles.row}>
            <Text style={[styles.rowLabel, { color: theme.text }]}>{en ? "Sign-in method" : "Способ входа"}</Text>
            <Text style={[styles.rowValue, { color: ink(0.5) }]}>{method}</Text>
          </View>
        </View>

        {/* Session */}
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: stroke, marginTop: 20 }]}>
          <Pressable
            onPress={confirmSignOut}
            style={({ pressed }) => [styles.row, styles.rowIcon, pressed && { backgroundColor: theme.rowPressed }]}
          >
            <Ionicons name="log-out-outline" size={22} color={theme.accentInk} />
            <Text style={[styles.rowLabel, { color: theme.accentInk, flex: 1, marginLeft: 12 }]}>
              {en ? "Sign out" : "Выйти из аккаунта"}
            </Text>
          </Pressable>
          <View style={[styles.divider, { backgroundColor: theme.divider }]} />
          <Pressable
            onPress={confirmReset}
            style={({ pressed }) => [styles.row, styles.rowIcon, pressed && { backgroundColor: theme.rowPressed }]}
          >
            <Ionicons name="refresh" size={21} color={theme.text} style={{ transform: [{ scaleX: -1 }] }} />
            <Text style={[styles.rowLabel, { color: theme.text, flex: 1, marginLeft: 12 }]}>
              {en ? "Reset progress" : "Сбросить прогресс"}
            </Text>
            <Chevron />
          </Pressable>
        </View>

        {/* Delete account */}
        <Pressable
          onPress={confirmDelete}
          style={({ pressed }) => [styles.deleteBtn, { opacity: pressed ? 0.8 : 1 }]}
        >
          <Text style={styles.deleteText}>{en ? "Delete account" : "Удалить аккаунт"}</Text>
        </Pressable>
        <Text style={[styles.deleteNote, { color: ink(0.5) }]}>
          {en
            ? "Your profile, recordings, progress and coins will be deleted. This can't be undone."
            : "Удалятся профиль, записи, прогресс и монеты. Восстановить их будет нельзя."}
        </Text>
      </ScrollView>

      <AppDialog
        visible={!!dialog}
        title={dialog?.title ?? ""}
        message={dialog?.message}
        buttons={dialog?.buttons ?? []}
        onRequestClose={closeDialog}
      />
      <NameEditDialog
        visible={nameOpen}
        initial={user?.name ?? ""}
        onCancel={() => setNameOpen(false)}
        onSave={async (n) => {
          setNameOpen(false);
          if (user && n.trim() && n.trim() !== user.name) await saveProfile(n.trim(), user.gender);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { height: 44, justifyContent: "center", alignItems: "center", marginTop: 0 },
  backBtn: { position: "absolute", left: 14, top: 6, width: 32, height: 32, justifyContent: "center" },
  headerTitle: { fontSize: 17, fontFamily: "Geologica_700Bold" },
  avatar: {
    marginTop: 14,
    alignSelf: "center",
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "#FFD857",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImg: { width: 88, height: 88 },
  avatarInitial: { fontSize: 36, fontFamily: "Geologica_700Bold", color: "#262628" },
  avatarBusy: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  name: {
    marginTop: 14,
    fontSize: 22,
    fontFamily: "Geologica_700Bold",
    letterSpacing: -0.11,
    textAlign: "center",
    paddingHorizontal: 24,
  },
  changePhoto: { marginTop: 5, fontSize: 14, fontFamily: "Geologica_600SemiBold", textAlign: "center" },
  sectionLabel: {
    marginTop: 33,
    marginLeft: 24,
    marginBottom: 10,
    fontSize: 11,
    fontFamily: "Geologica_600SemiBold",
    letterSpacing: 0.55,
  },
  card: { marginHorizontal: 20, borderRadius: 22, borderWidth: 2, overflow: "hidden" },
  row: {
    height: 55,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rowIcon: { justifyContent: "flex-start" },
  rowRight: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1, marginLeft: 16 },
  rowLabel: { fontSize: 15, fontFamily: "Geologica_400Regular" },
  rowValue: { fontSize: 14, fontFamily: "Geologica_400Regular", flexShrink: 1 },
  divider: { height: 1, marginHorizontal: 16 },
  deleteBtn: {
    marginTop: 80,
    marginHorizontal: 20,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: "rgba(255,90,78,0.25)",
    backgroundColor: "rgba(255,90,78,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  deleteText: { color: "#FF6B5E", fontSize: 15, fontFamily: "Geologica_600SemiBold" },
  deleteNote: {
    marginTop: 12,
    alignSelf: "center",
    maxWidth: 322,
    fontSize: 12,
    lineHeight: 16.8,
    fontFamily: "Geologica_400Regular",
    textAlign: "center",
  },
});
