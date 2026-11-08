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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { SvgXml } from "react-native-svg";
import * as Haptics from "expo-haptics";
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
import ProPromoCard from "@/components/profile/ProPromoCard";
import ProfileMenuPopover, { type MenuAnchor, type MenuOption } from "@/components/profile/ProfileMenuPopover";
import {
  CROWNICON_SVG,
  LIBRARY_SVG,
  ARROW_SVG,
  PEN_SVG,
  TROPHY_SVG,
  tintSvg,
} from "@/assets/figma/profile/svgs";
import MatteGlass from "@/components/MatteGlass";

// Persisted background color the player picks for their profile screen only.
const PROFILE_BG_KEY = "@kingspeech_profile_bg_v1";

// Figma "Screen / 04 · Profile" (12:357 dark / 12:358 light).
const AVATAR_SIZE = 104;
const AVATAR_TOP = 73; // relative to the cover top (overlaps its notch)
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

function LinkTile({
  theme,
  iconXml,
  iconW,
  iconH,
  title,
  sub,
  height,
  titleTop,
  subTop,
  inset,
  onPress,
  style,
}: {
  theme: Theme;
  iconXml: string;
  iconW: number;
  iconH: number;
  title: string;
  sub: string;
  height: number;
  titleTop: number;
  subTop: number;
  inset: number;
  onPress: () => void;
  style?: any;
}) {
  const arrow = tintSvg(ARROW_SVG, "#F0EEE9", theme.mode === "dark" ? "#F0EEE9" : "#262628");
  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onPress();
      }}
      style={({ pressed }) => [
        styles.tile,
        { height, paddingLeft: inset, paddingTop: inset, backgroundColor: theme.cardGlass, borderColor: strokeShape(theme), overflow: "hidden", zIndex: 0 },
        pressed && { opacity: 0.85 },
        style,
      ]}
    >
      <MatteGlass radius={22} />
      <SvgXml xml={iconXml} width={iconW} height={iconH} />
      <SvgXml xml={arrow} width={14} height={14} style={styles.tileArrow} />
      <Text style={[styles.tileTitle, { color: theme.text, top: titleTop, left: inset }]} numberOfLines={1}>
        {title}
      </Text>
      <Text style={[styles.tileSub, { color: theme.textMuted, top: subTop, left: inset }]} numberOfLines={1}>
        {sub}
      </Text>
    </Pressable>
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
  const isDark = theme.mode === "dark";
  const ink = isDark ? "#F0EEE9" : "#262628";

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

  const totalTasks = levels.reduce(
    (acc, l) => acc + l.tasks.filter((tt) => tt.status === "completed").length,
    0,
  );

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
  const completedLevels = levels.filter((l) => l.completed).length;

  // Daily activity for the streak card. The app has no dedicated activity
  // log, so we use the only dated activity it stores: saved recordings.
  const activityDates = useMemo(
    () => readingRecordings.map((r) => r.date).filter((d) => typeof d === "number"),
    [readingRecordings],
  );

  const initials = (name || "?").split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 1);

  const ruPlural = (n: number, one: string, few: string, many: string) => {
    const m10 = n % 10;
    const m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
    return many;
  };
  const subline = en
    ? `Module ${currentModule} of 67 · ${completedLevels} levels · ${totalTasks} tasks`
    : `Модуль ${currentModule} из 67 · ${completedLevels} ${ruPlural(completedLevels, "уровень", "уровня", "уровней")} · ${totalTasks} ${ruPlural(totalTasks, "задание", "задания", "заданий")}`;

  const iconInk = theme.accentInk; // gold on dark, ink on light

  return (
    <View style={[styles.container, { backgroundColor: bgColor ?? theme.bg }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: topPad, paddingBottom: bottomPad + 110 },
        ]}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
      >
        {/* Header — cover banner, avatar sitting in its notch, name + badge */}
        <Animated.View entering={FadeInDown.delay(40).duration(400)} style={styles.header}>
          <ProfileCover fill={theme.card} stroke={strokeShape(theme)} gold={theme.accent} />

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
            style={[styles.avatar, { backgroundColor: theme.accent }]}
          >
            <View style={styles.avatarClip}>
              {user?.photoURL ? (
                <Image
                  source={{ uri: user.photoURL }}
                  style={StyleSheet.absoluteFill}
                  resizeMode="cover"
                />
              ) : (
                <Text style={[styles.avatarText, { color: theme.accentText }]}>{initials}</Text>
              )}
              {uploadingAvatar && (
                <View style={styles.avatarUploading}>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                </View>
              )}
            </View>
          </Pressable>

          <View style={styles.nameRow}>
            <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
              {name || (t("profile") || "Profile")}
            </Text>
            <View style={[styles.badge, { borderColor: theme.accent }]}>
              <Text style={[styles.badgeTxt, { color: theme.accentInk }]}>Free</Text>
            </View>
          </View>
        </Animated.View>

        <View style={[styles.divider, { backgroundColor: theme.divider }]} />

        {/* Stats — Ранг · Модуль · Монеты */}
        <Animated.View entering={FadeInDown.delay(100).duration(400)}>
          <View style={styles.statsRow}>
            <Stat
              theme={theme}
              value={`${currentRank}`}
              label={en ? "Rank" : "Ранг"}
              left={<SvgXml xml={tintSvg(CROWNICON_SVG, "#F0EEE9", ink)} width={22} height={22} />}
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
          </View>
          <Text style={[styles.subline, { color: theme.textMuted }]} numberOfLines={1}>
            {subline}
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(160).duration(400)} style={styles.section}>
          <StreakCard theme={theme} activityDates={activityDates} lang={lang} />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(220).duration(400)} style={styles.section}>
          <ProPromoCard
            theme={theme}
            lang={lang}
            onUpgrade={() => router.push("/subscription" as any)}
          />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(280).duration(400)} style={styles.section}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              // TODO(design): coin store doesn't exist yet.
            }}
            style={({ pressed }) => [
              styles.buyBtn,
              { backgroundColor: theme.accent, borderColor: theme.ctaStroke },
              pressed && { opacity: 0.88 },
            ]}
          >
            <CoinIcon size={22} color={theme.accentText} />
            <Text style={[styles.buyTxt, { color: theme.accentText }]}>
              {en ? "Buy coins" : "Купить монеты"}
            </Text>
          </Pressable>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(340).duration(400)} style={[styles.section, styles.tilesRow]}>
          <LinkTile
            theme={theme}
            iconXml={tintSvg(PEN_SVG, "#FFD857", iconInk)}
            iconW={26}
            iconH={26}
            title={en ? "Become an author" : "Стать автором"}
            sub={en ? "Suggest your topic" : "Предложи свою тему"}
            height={112}
            titleTop={57}
            subTop={79}
            inset={13}
            onPress={() => {
              // TODO(design): author / topic-suggestion flow doesn't exist yet.
            }}
            style={{ flex: 1 }}
          />
          <LinkTile
            theme={theme}
            iconXml={tintSvg(TROPHY_SVG, "#FFD857", iconInk)}
            iconW={26}
            iconH={26}
            title={en ? "Awards" : "Награды"}
            sub={en ? "Cups and achievements" : "Кубки и достижения"}
            height={112}
            titleTop={57}
            subTop={79}
            inset={13}
            onPress={() => {
              // TODO(design): awards / achievements screen doesn't exist yet.
            }}
            style={{ flex: 1 }}
          />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(400).duration(400)} style={{ marginTop: 12 }}>
          <LinkTile
            theme={theme}
            iconXml={tintSvg(LIBRARY_SVG, "#F0EEE9", ink)}
            iconW={22}
            iconH={24}
            title={en ? "My library" : "Моя библиотека"}
            sub={en ? "Recordings of your performances" : "Записи твоих выступлений"}
            height={92}
            titleTop={47}
            subTop={67}
            inset={15}
            onPress={() => router.push("/reading-library")}
          />
        </Animated.View>
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
  scroll: { paddingHorizontal: 24 },

  // Header
  header: {
    height: AVATAR_TOP + AVATAR_SIZE, // 177 — avatar bottom
  },
  plusBtn: {
    position: "absolute",
    top: 13,
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
    ...(Platform.OS === "web"
      ? ({ boxShadow: "0px 6.5px 19.5px rgba(255,216,87,0.25)" } as any)
      : {
          shadowColor: "#FFD857",
          shadowOpacity: 0.25,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 6.5 },
          elevation: 6,
        }),
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
  nameRow: {
    position: "absolute",
    left: AVATAR_LEFT + AVATAR_SIZE + 14,
    right: 0,
    top: COVER_HEIGHT + 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  name: {
    fontSize: 22,
    letterSpacing: -0.11,
    fontFamily: "Geologica_700Bold",
    flexShrink: 1,
  },
  badge: {
    borderWidth: 1.5,
    borderRadius: 32,
    paddingHorizontal: 9,
    paddingVertical: 3,
    marginTop: 2,
    ...(Platform.OS === "web"
      ? ({ boxShadow: "0px 0px 5px rgba(255,216,87,0.55)" } as any)
      : {
          shadowColor: "#FFD857",
          shadowOpacity: 0.55,
          shadowRadius: 5,
          shadowOffset: { width: 0, height: 0 },
        }),
  },
  badgeTxt: {
    fontSize: 11,
    fontFamily: "Geologica_700Bold",
  },

  divider: { height: 1, marginTop: 20 },

  // Stats
  statsRow: { flexDirection: "row", marginTop: 15 },
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
  subline: {
    marginTop: 15,
    fontSize: 13,
    fontFamily: "Geologica_600SemiBold",
    textAlign: "center",
  },

  section: { marginTop: 16 },

  buyBtn: {
    height: 56,
    borderRadius: 32,
    borderWidth: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  buyTxt: {
    fontSize: 17,
    fontFamily: "Geologica_800ExtraBold",
  },

  tilesRow: { flexDirection: "row", gap: 12 },
  tile: {
    borderRadius: 22,
    borderWidth: 2,
  },
  tileArrow: { position: "absolute", top: 15, right: 15 },
  tileTitle: {
    position: "absolute",
    left: 13,
    fontSize: 15,
    fontFamily: "Geologica_600SemiBold",
  },
  tileSub: {
    position: "absolute",
    left: 13,
    fontSize: 12,
    fontFamily: "Geologica_400Regular",
  },

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
