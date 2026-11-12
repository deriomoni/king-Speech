import React, { useState, useEffect, useMemo, useRef } from "react";
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
  Modal,
  TextInput,
} from "react-native";
import OverscrollFill from "@/components/OverscrollFill";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { SvgXml } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "@/lib/haptics";
import * as ImagePicker from "expo-image-picker";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { useGame } from "@/context/GameContext";
import CoinIcon from "@/components/CoinIcon";
import { useAuth } from "@/context/AuthContext";
import { useLang } from "@/context/LangContext";
import { storage as fbStorage, auth as fbAuth, firebaseConfigured } from "@/lib/firebase";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { LEVEL_PALETTE_ORDER } from "@/theme/tokens";
import { useTheme, type Theme } from "@/context/ThemeContext";
import ProfileCover, { COVER_HEIGHT } from "@/components/profile/ProfileCover";
import StreakCard from "@/components/profile/StreakCard";
import GlossTile from "@/components/profile/GlossTile";
import ProfileMenuPopover, { type MenuAnchor, type MenuOption } from "@/components/profile/ProfileMenuPopover";
import {
  CASSETTE,
  QUILL,
  TROPHY,
  LIBRARY,
  COINS,
  RANK_SHIELD,
  themedSvg,
} from "@/assets/figma/profile/tiles";

// Persisted background color the player picks for their profile screen only.
const PROFILE_BG_KEY = "@kingspeech_profile_bg_v1";

// Figma "Screen / 04 · Profile" (12:357 dark / 12:358 light).
const AVATAR_SIZE = 104;
const AVATAR_TOP = 72; // relative to the cover top (sits in its notch)
const AVATAR_LEFT = 16; // relative to the 24pt gutter
const PLUS_SIZE = 40;

// Figma "stroke/shape" — the 2pt hairline around cards.
const strokeShape = (theme: Theme) =>
  theme.mode === "dark" ? "rgba(240,238,233,0.06)" : "rgba(38,38,40,0.08)";

function LayersIcon({ color }: { color: string }) {
  // Figma icon/layers (72:22): outlined square behind a filled one.
  return (
    <View style={{ width: 22, height: 22 }}>
      <View
        style={{
          position: "absolute",
          left: 6,
          top: 1,
          width: 15,
          height: 15,
          borderRadius: 4,
          borderWidth: 1.8,
          borderColor: color,
        }}
      />
      <View
        style={{
          position: "absolute",
          left: 1,
          top: 6,
          width: 15,
          height: 15,
          borderRadius: 4,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

function Stat({
  theme,
  value,
  label,
  left,
  right,
}: {
  theme: Theme;
  value: string;
  label: string;
  left?: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <View style={styles.stat}>
      <View style={styles.statValueRow}>
        {left}
        <Text style={[styles.statVal, { color: theme.text }]}>{value}</Text>
        {right}
      </View>
      <Text style={[styles.statLbl, { color: theme.textMuted }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

export default function ProfileScreen() {
  const { theme } = useTheme();
  const { t, lang } = useLang();
  const en = lang === "en";
  const insets = useSafeAreaInsets();
  const { levels, coins, readingRecordings, currentRank } = useGame();
  const { user, setPhotoURL, saveProfile } = useAuth();
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [photoMenuOpen, setPhotoMenuOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<MenuAnchor | null>(null);
  const plusRef = useRef<View>(null);
  const [nameEditOpen, setNameEditOpen] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [colorMenuOpen, setColorMenuOpen] = useState(false);
  // Player-picked profile-screen background color (null = default theme bg).
  const [bgColor, setBgColor] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(PROFILE_BG_KEY)
      .then((v) => {
        if (v) setBgColor(v);
      })
      .catch(() => {});
  }, []);

  const name = user?.name ?? "";

  // Upload / cache a picked image (shared by camera + gallery).
  const uploadPickedAsset = async (asset: ImagePicker.ImagePickerAsset) => {
    setUploadingAvatar(true);
    try {
      if (firebaseConfigured && fbStorage && fbAuth?.currentUser) {
        try {
          const resp = await fetch(asset.uri);
          const blob = await resp.blob();
          const uid = fbAuth.currentUser.uid;
          const path = storageRef(fbStorage, `avatars/${uid}.jpg`);
          await uploadBytes(path, blob, { contentType: blob.type || "image/jpeg" });
          const url = await getDownloadURL(path);
          await setPhotoURL(url);
        } catch (e: any) {
          console.warn("[profile] avatar upload failed:", e);
          await setPhotoURL(asset.uri);
          Alert.alert("Загрузка", "Не удалось загрузить в облако — фото сохранено локально.");
        }
      } else {
        await setPhotoURL(asset.uri);
      }
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handlePickFromGallery = async () => {
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
      await uploadPickedAsset(result.assets[0]);
    } catch (e: any) {
      console.warn("[profile] pick avatar failed:", e);
      Alert.alert("Ошибка", e?.message ?? "Не удалось выбрать фото");
    }
  };

  const handleTakeSelfie = async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Доступ к камере", "Разреши доступ к камере, чтобы сделать селфи.");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        cameraType: ImagePicker.CameraType.front,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.[0]) return;
      await uploadPickedAsset(result.assets[0]);
    } catch (e: any) {
      console.warn("[profile] take selfie failed:", e);
      Alert.alert("Ошибка", e?.message ?? "Не удалось сделать селфи");
    }
  };

  const handleRemovePhoto = async () => {
    try {
      await setPhotoURL("");
    } catch (e: any) {
      console.warn("[profile] remove photo failed:", e);
    }
  };

  const runPhotoAction = (action: () => Promise<void>) => {
    setPhotoMenuOpen(false);
    // Let the modal dismiss before launching the native picker/camera.
    setTimeout(() => {
      action();
    }, Platform.OS === "web" ? 0 : 220);
  };

  // "Загрузить фото профиля": camera or gallery on device; gallery on web.
  const handleUploadPhoto = () => {
    if (Platform.OS === "web") {
      runPhotoAction(handlePickFromGallery);
      return;
    }
    setPhotoMenuOpen(false);
    setTimeout(() => {
      Alert.alert(en ? "Profile photo" : "Фото профиля", undefined, [
        { text: t("takeSelfie"), onPress: () => handleTakeSelfie() },
        { text: t("chooseFromGallery"), onPress: () => handlePickFromGallery() },
        { text: t("cancel"), style: "cancel" },
      ]);
    }, 220);
  };

  const openPhotoMenu = () => {
    if (uploadingAvatar) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const node = plusRef.current;
    if (node && typeof node.measureInWindow === "function") {
      node.measureInWindow((x, y, width, height) => {
        setMenuAnchor({ x, y, width, height });
        setPhotoMenuOpen(true);
      });
    } else {
      setPhotoMenuOpen(true);
    }
  };

  // Open the name editor (from the edit menu).
  const openNameEdit = () => {
    setPhotoMenuOpen(false);
    setDraftName(name);
    setTimeout(() => setNameEditOpen(true), Platform.OS === "web" ? 0 : 220);
  };

  const openColorMenu = () => {
    setPhotoMenuOpen(false);
    setTimeout(() => setColorMenuOpen(true), Platform.OS === "web" ? 0 : 220);
  };

  const pickBgColor = (color: string | null) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setBgColor(color);
    setColorMenuOpen(false);
    if (color) AsyncStorage.setItem(PROFILE_BG_KEY, color).catch(() => {});
    else AsyncStorage.removeItem(PROFILE_BG_KEY).catch(() => {});
  };

  const handleSaveName = async () => {
    const trimmed = draftName.trim();
    setNameEditOpen(false);
    if (!trimmed || trimmed === name) return;
    try {
      await saveProfile(trimmed, user?.gender ?? "male");
    } catch (e: any) {
      console.warn("[profile] save name failed:", e);
      Alert.alert("Ошибка", e?.message ?? "Не удалось сохранить имя");
    }
  };

  const menuOptions: MenuOption[] = [
    {
      key: "photo",
      icon: "camera",
      label: en ? "Upload profile photo" : "Загрузить фото профиля",
      onPress: handleUploadPhoto,
    },
    {
      key: "bg",
      icon: "image",
      label: en ? "Choose background" : "Выбрать фон",
      onPress: openColorMenu,
    },
    {
      key: "name",
      icon: "pencil",
      label: en ? "Change profile name" : "Изменить имя профиля",
      onPress: openNameEdit,
    },
    ...(user?.photoURL
      ? [
          {
            key: "remove",
            icon: "trash" as const,
            label: t("removePhoto"),
            danger: true,
            onPress: () => runPhotoAction(handleRemovePhoto),
          },
        ]
      : []),
  ];

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  // The module the player is currently in = the module of the first still-
  // available level; if everything is done, the highest module they reached.
  const activeLevel = [...levels]
    .sort((a, b) => a.levelNumber - b.levelNumber)
    .find((l) => l.status === "available");
  const maxCompletedModule = levels.reduce(
    (m, l) => (l.completed && l.module > m ? l.module : m),
    0,
  );
  const currentModule = activeLevel?.module ?? (maxCompletedModule || 1);

  // Daily activity for the streak card. The app has no dedicated activity
  // log, so we use the only dated activity it stores: saved recordings.
  const activityDates = useMemo(
    () => readingRecordings.map((r) => r.date).filter((d) => typeof d === "number"),
    [readingRecordings],
  );

  const initials = (name || "?").split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 1);

  const mode = theme.mode;
  // Positions an exported Figma illustration inside a GlossTile (tile coords
  // minus the 1pt hairline the fill sits inside).
  const art = (xml: string, x: number, y: number, w: number, h: number) => (
    <SvgXml
      xml={xml}
      width={w}
      height={h}
      pointerEvents="none"
      style={{ position: "absolute", left: x - 1, top: y - 1 }}
    />
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.backingTop }]}>
      <ScrollView
        contentContainerStyle={styles.scrollOuter}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
      >
        <OverscrollFill top={bgColor ?? theme.bg} bottom={theme.backingBottom} />
        {/* Top plate (Figma "Top panel" 394:1200): rounded bottom, hairline stroke. */}
        <View
          style={[
            styles.topPanel,
            {
              backgroundColor: bgColor ?? theme.bg,
              borderColor: theme.panelStroke,
              paddingTop: topPad + 3,
            },
          ]}
        >
          {/* Header — cover banner, avatar sitting in its notch, name */}
          <Animated.View entering={FadeInDown.delay(40).duration(400)} style={styles.header}>
            <ProfileCover fill={theme.card} stroke={strokeShape(theme)} sheen="#F0EEE9" />

            <Pressable
              ref={plusRef}
              onPress={openPhotoMenu}
              disabled={uploadingAvatar}
              hitSlop={8}
              style={[
                styles.plusBtn,
                { backgroundColor: theme.bg, borderColor: strokeShape(theme) },
              ]}
            >
              {uploadingAvatar ? (
                <ActivityIndicator size="small" color={theme.text} />
              ) : (
                <>
                  <View style={[styles.plusH, { backgroundColor: theme.text }]} />
                  <View style={[styles.plusV, { backgroundColor: theme.text }]} />
                </>
              )}
            </Pressable>

            <Pressable
              onPress={openPhotoMenu}
              disabled={uploadingAvatar}
              style={[styles.avatar, { backgroundColor: theme.card }]}
            >
              <View style={styles.avatarClip}>
                {user?.photoURL ? (
                  <Image
                    source={{ uri: user.photoURL }}
                    style={StyleSheet.absoluteFill}
                    resizeMode="cover"
                  />
                ) : (
                  <Text style={[styles.avatarText, { color: theme.text }]}>{initials}</Text>
                )}
                {uploadingAvatar && (
                  <View style={styles.avatarUploading}>
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  </View>
                )}
              </View>
            </Pressable>

            <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
              {name || (t("profile") || "Profile")}
            </Text>
          </Animated.View>

          {/* Stats — Ранг · Модуль · Монеты */}
          <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.statsRow}>
            <Stat
              theme={theme}
              value={`${currentRank}`}
              label={en ? "Rank" : "Ранг"}
              left={<SvgXml xml={themedSvg(RANK_SHIELD, mode)} width={22} height={22} />}
            />
            <Stat
              theme={theme}
              value={`${currentModule}`}
              label={en ? "Module" : "Модуль"}
              left={<LayersIcon color={theme.text} />}
            />
            <Stat
              theme={theme}
              value={`${coins}`}
              label={en ? "Coins" : "Монеты"}
              right={<CoinIcon size={22} color={theme.text} />}
            />
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(160).duration(400)} style={styles.streak}>
            <StreakCard theme={theme} activityDates={activityDates} lang={lang} />
          </Animated.View>
        </View>

        {/* Backing (Figma 402:1301): vertical gradient behind the tile list. */}
        <View style={[styles.tiles, { paddingBottom: bottomPad + 110 }]}>
          <LinearGradient
            colors={[theme.backingTop, theme.backingMid, theme.backingBottom]}
            locations={[0, 0.65, 1]}
            style={styles.backing}
            pointerEvents="none"
          />

          <Animated.View entering={FadeInDown.delay(220).duration(400)}>
            <GlossTile
              mode={mode}
              idSuffix="diary"
              height={112}
              text={{
                title: en ? "Audio diary" : "Аудио-дневник",
                sub: en ? "Tell how your day went" : "Расскажи, как прошёл день",
                x: 20,
                y: 32,
                titleSize: 18,
                subSize: 12,
                subOffset: 28,
              }}
              spot={{ x: 170, y: -70, size: 240 }}
              art={art(themedSvg(CASSETTE, mode), 207, 15, 129, 82)}
              onPress={() => router.push("/diary")}
            />
          </Animated.View>

          <Animated.View
            entering={FadeInDown.delay(280).duration(400)}
            style={[styles.tilesRow, { marginTop: 16 }]}
          >
            <GlossTile
              mode={mode}
              idSuffix="author"
              height={156}
              style={{ flex: 1 }}
              text={{
                title: en ? "Become an author" : "Стать автором",
                sub: en ? "Suggest your topic" : "Предложи свою тему",
                x: 16,
                y: 104,
                titleSize: 17,
                subSize: 12,
                subOffset: 24,
              }}
              spot={{ x: -20, y: -50, size: 200 }}
              art={art(themedSvg(QUILL, mode), 43, 26, 83, 76)}
              onPress={() => router.push("/author")}
            />
            <GlossTile
              mode={mode}
              idSuffix="awards"
              height={156}
              style={{ flex: 1 }}
              text={{
                title: en ? "Awards" : "Награды",
                sub: en ? "Cups and achievements" : "Кубки и достижения",
                x: 16,
                y: 104,
                titleSize: 17,
                subSize: 12,
                subOffset: 24,
              }}
              spot={{ x: -10, y: -50, size: 200 }}
              art={art(themedSvg(TROPHY, mode), 35, 11, 112, 80)}
              onPress={() => {
                // TODO(design): awards / achievements screen doesn't exist yet.
              }}
            />
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(340).duration(400)} style={{ marginTop: 14 }}>
            <GlossTile
              mode={mode}
              idSuffix="library"
              height={112}
              text={{
                title: en ? "My library" : "Моя библиотека",
                sub: en ? "Recordings of your performances" : "Записи твоих выступлений",
                x: 20,
                y: 32,
                titleSize: 18,
                subSize: 12,
                subOffset: 28,
              }}
              spot={{ x: 170, y: -70, size: 240 }}
              art={art(themedSvg(LIBRARY, mode), 187.5, 12, 155, 91)}
              onPress={() => router.push("/library")}
            />
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(400).duration(400)} style={{ marginTop: 14 }}>
            <GlossTile
              mode={mode}
              idSuffix="coins"
              height={92}
              text={{
                title: en ? "Buy coins" : "Купить монеты",
                sub: en ? "Hints, themes and bonuses" : "Подсказки, темы и бонусы",
                x: 22,
                y: 22,
                titleSize: 21,
                subSize: 13,
                subOffset: 30,
              }}
              spot={{ x: 170, y: -70, size: 240 }}
              art={art(themedSvg(COINS, mode), 218, 10, 120, 73)}
              onPress={() => router.push("/coins")}
            />
          </Animated.View>
        </View>
      </ScrollView>

      {/* "+" menu — Figma 130:3 glass popover */}
      <ProfileMenuPopover
        visible={photoMenuOpen}
        anchor={menuAnchor}
        theme={theme}
        options={menuOptions}
        onClose={() => setPhotoMenuOpen(false)}
      />

      {/* Name editor */}
      <Modal
        visible={nameEditOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setNameEditOpen(false)}
      >
        <Pressable style={styles.nameBackdrop} onPress={() => setNameEditOpen(false)}>
          <Pressable
            style={[
              styles.nameSheet,
              { backgroundColor: theme.card, borderColor: strokeShape(theme) },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[styles.sheetTitle, { color: theme.text }]}>
              {en ? "Change profile name" : "Изменить имя профиля"}
            </Text>
            <TextInput
              value={draftName}
              onChangeText={setDraftName}
              placeholder={en ? "Your name" : "Ваше имя"}
              placeholderTextColor={theme.textMuted}
              style={[
                styles.nameInput,
                {
                  color: theme.text,
                  borderColor: theme.inputBorder,
                  backgroundColor: theme.bg,
                },
              ]}
              autoFocus
              maxLength={40}
              returnKeyType="done"
              onSubmitEditing={handleSaveName}
            />
            <Pressable
              onPress={handleSaveName}
              style={[
                styles.nameSaveBtn,
                { backgroundColor: theme.accent, borderColor: theme.ctaStroke },
              ]}
            >
              <Text style={[styles.nameSaveTxt, { color: theme.accentText }]}>
                {en ? "Save" : "Сохранить"}
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Profile background color picker — swatches + reset to default. */}
      <Modal
        visible={colorMenuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setColorMenuOpen(false)}
      >
        <Pressable style={styles.nameBackdrop} onPress={() => setColorMenuOpen(false)}>
          <Pressable
            style={[
              styles.nameSheet,
              { backgroundColor: theme.card, borderColor: strokeShape(theme) },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[styles.sheetTitle, { color: theme.text }]}>
              {en ? "Profile background" : "Фон профиля"}
            </Text>
            <View style={styles.swatchGrid}>
              {LEVEL_PALETTE_ORDER.map((col) => {
                const selected = bgColor === col;
                return (
                  <Pressable
                    key={col}
                    onPress={() => pickBgColor(col)}
                    style={[
                      styles.swatch,
                      {
                        backgroundColor: col,
                        borderColor: selected ? theme.text : "rgba(0,0,0,0.15)",
                        borderWidth: selected ? 3 : 1,
                      },
                    ]}
                  >
                    {selected && (
                      <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                    )}
                  </Pressable>
                );
              })}
            </View>
            <Pressable
              onPress={() => pickBgColor(null)}
              style={[styles.resetColorBtn, { borderColor: strokeShape(theme) }]}
            >
              <Ionicons name="refresh-outline" size={16} color={theme.textSecondary} />
              <Text style={[styles.resetColorTxt, { color: theme.textSecondary }]}>
                {en ? "Default background" : "Стандартный фон"}
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollOuter: { flexGrow: 1 },
  topPanel: {
    paddingHorizontal: 24,
    paddingBottom: 20,
    borderWidth: 1.5,
    borderTopWidth: 0,
    marginHorizontal: -1.5,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    zIndex: 1,
  },
  tiles: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 30 },
  backing: {
    position: "absolute",
    top: -40,
    left: 0,
    right: 0,
    bottom: 0,
  },

  // Header
  header: {
    height: AVATAR_TOP + AVATAR_SIZE, // 176 — avatar bottom
  },
  plusBtn: {
    position: "absolute",
    top: 12,
    right: 12,
    width: PLUS_SIZE,
    height: PLUS_SIZE,
    borderRadius: PLUS_SIZE / 2,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  plusH: {
    position: "absolute",
    width: 16,
    height: 2.4,
    borderRadius: 1.2,
  },
  plusV: {
    position: "absolute",
    width: 2.4,
    height: 16,
    borderRadius: 1.2,
  },
  avatar: {
    position: "absolute",
    left: AVATAR_LEFT,
    top: AVATAR_TOP,
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
  },
  avatarClip: {
    flex: 1,
    borderRadius: AVATAR_SIZE / 2,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 37.375,
    letterSpacing: -0.75,
    fontFamily: "Geologica_700Bold",
  },
  avatarUploading: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  name: {
    position: "absolute",
    left: AVATAR_LEFT + AVATAR_SIZE + 12,
    right: 0,
    top: COVER_HEIGHT + 14,
    fontSize: 22,
    letterSpacing: -0.11,
    fontFamily: "Geologica_700Bold",
  },

  // Stats
  statsRow: { flexDirection: "row", marginTop: 36 },
  stat: { flex: 1, alignItems: "center", gap: 4 },
  statValueRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  statVal: {
    fontSize: 26,
    letterSpacing: -0.26,
    fontFamily: "Geologica_800ExtraBold",
  },
  statLbl: {
    fontSize: 13,
    fontFamily: "Geologica_600SemiBold",
  },
  streak: { marginTop: 14 },

  tilesRow: { flexDirection: "row", gap: 12 },
  // Modals
  nameBackdrop: {
    flex: 1,
    backgroundColor: "rgba(38,38,40,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  nameSheet: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 22,
    borderWidth: 2,
    padding: 20,
    gap: 14,
  },
  sheetTitle: {
    fontSize: 17,
    fontFamily: "Geologica_700Bold",
    textAlign: "center",
  },
  nameInput: {
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 16,
    fontFamily: "Geologica_500Medium",
  },
  nameSaveBtn: {
    height: 52,
    borderRadius: 32,
    borderWidth: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  nameSaveTxt: {
    fontSize: 16,
    fontFamily: "Geologica_800ExtraBold",
  },
  swatchGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 12,
  },
  swatch: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  resetColorBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 46,
    borderRadius: 16,
    borderWidth: 2,
  },
  resetColorTxt: {
    fontSize: 14,
    fontFamily: "Geologica_600SemiBold",
  },
});
