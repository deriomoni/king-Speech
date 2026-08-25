import React, { useState, useEffect } from "react";
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
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path, Circle } from "react-native-svg";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { useGame, MODULE_COLORS } from "@/context/GameContext";
import { useAuth } from "@/context/AuthContext";
import { useLang } from "@/context/LangContext";
import { storage as fbStorage, auth as fbAuth, firebaseConfigured } from "@/lib/firebase";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { colors as brandColors, LEVEL_PALETTE_ORDER } from "@/theme/tokens";
import { useTheme, type Theme } from "@/context/ThemeContext";

// Persisted background color the player picks for their profile screen only.
const PROFILE_BG_KEY = "@kingspeech_profile_bg_v1";

// Round profile avatar.
const AVATAR_SIZE = 128;
const AVATAR_RADIUS = AVATAR_SIZE / 2;

const ACCENT = brandColors.purple;
const ACCENT_DEEP = brandColors.purpleDeep;
const CTA_GOLD = brandColors.gold;

// The King Speech crown, recoloured per module. Paths lifted from the brand
// "LVL ICON" asset; only the crown itself (no baked-in number) so the level
// number is rendered as live text beside it.
function CrownIcon({ color, size = 26 }: { color: string; size?: number }) {
  const stroke = "#12121A";
  return (
    <Svg width={size} height={size} viewBox="0 0 152 152" fill="none">
      <Path
        d="M98.4385 73.9681C99.2726 75.8662 101.735 76.3662 103.243 74.9439L134.066 45.8806C136.097 43.9661 139.412 45.6182 139.106 48.392L130.626 125.329C130.458 126.849 129.174 128 127.644 128H23.3262C21.8094 128 20.5312 126.868 20.3481 125.362L11.0021 48.5243C10.6631 45.7375 13.9957 44.0534 16.0382 45.9794L46.364 74.574C47.8724 75.9963 50.3345 75.4963 51.1686 73.5982L71.976 26.2499C73.0267 23.8591 76.4185 23.8592 77.469 26.2499L98.4385 73.9681Z"
        fill={color}
        stroke={stroke}
        strokeWidth={6}
      />
      <Path
        d="M20 135C20 133.343 21.3431 132 23 132H128C129.657 132 131 133.343 131 135V143C131 144.657 129.657 146 128 146H23C21.3431 146 20 144.657 20 143V135Z"
        fill={color}
        stroke={stroke}
        strokeWidth={6}
      />
      <Circle cx={139.5} cy={34.5} r={8.5} fill={color} stroke={stroke} strokeWidth={6} />
      <Circle cx={75.5} cy={11.5} r={8.5} fill={color} stroke={stroke} strokeWidth={6} />
      <Circle cx={11.5} cy={34.5} r={8.5} fill={color} stroke={stroke} strokeWidth={6} />
    </Svg>
  );
}

function ListWrapper({ theme, children }: { theme: Theme; children: React.ReactNode }) {
  return (
    <View
      style={[
        styles.listWrap,
        { backgroundColor: theme.card, borderColor: theme.cardBorder },
      ]}
    >
      {children}
    </View>
  );
}

function ListRow({
  theme,
  icon,
  label,
  value,
  isLast,
  onPress,
  rightIcon,
}: {
  theme: Theme;
  icon?: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string | React.ReactNode;
  isLast?: boolean;
  onPress?: () => void;
  rightIcon?: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <Pressable
      onPress={() => {
        if (!onPress) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.row,
        !isLast && { borderBottomWidth: 1, borderBottomColor: theme.divider },
        pressed && onPress ? { backgroundColor: theme.rowPressed } : null,
      ]}
    >
      {icon && (
        <Ionicons name={icon} size={22} color={theme.text} style={{ marginRight: 14 }} />
      )}
      <Text style={[styles.rowLabel, { color: theme.text }]}>{label}</Text>
      <View style={{ flex: 1 }} />
      {typeof value === "string" ? (
        <Text style={[styles.rowValue, { color: theme.textSecondary }]}>{value}</Text>
      ) : value ?? null}
      {onPress && (
        <Ionicons
          name={rightIcon ?? "chevron-forward"}
          size={16}
          color={theme.textMuted}
          style={{ marginLeft: 8 }}
        />
      )}
    </Pressable>
  );
}

export default function ProfileScreen() {
  const { theme } = useTheme();
  const { t, lang } = useLang();
  const insets = useSafeAreaInsets();
  const { levels, coins, readingRecordings } = useGame();
  const { user, setPhotoURL, saveProfile } = useAuth();
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [photoMenuOpen, setPhotoMenuOpen] = useState(false);
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

  const openPhotoMenu = () => {
    if (uploadingAvatar) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setPhotoMenuOpen(true);
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
  const currentModule = activeLevel?.module ?? maxCompletedModule ?? 1;
  const moduleColor =
    MODULE_COLORS[currentModule]?.color ?? theme.accent;

  // Overall path completion for the Progress card.
  const completedLevels = levels.filter((l) => l.completed).length;
  const pathPct = Math.round((completedLevels / Math.max(1, levels.length)) * 100);

  const initials = (name || "?").split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);

  return (
    <View style={[styles.container, { backgroundColor: bgColor ?? theme.bg }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: topPad + 12, paddingBottom: bottomPad + 100 },
        ]}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
      >
        {/* Round avatar on top, name underneath. Tap the avatar to change the
            photo. */}
        <Animated.View
          entering={FadeInDown.delay(60).duration(400)}
          style={styles.profileHeader}
        >
          <Pressable
            onPress={openPhotoMenu}
            disabled={uploadingAvatar}
            style={[
              styles.avatar,
              {
                width: AVATAR_SIZE,
                height: AVATAR_SIZE,
                borderRadius: AVATAR_RADIUS,
                backgroundColor: theme.bgSecondary,
              },
            ]}
          >
            {user?.photoURL ? (
              <Image
                source={{ uri: user.photoURL }}
                style={StyleSheet.absoluteFill}
                resizeMode="cover"
              />
            ) : (
              <>
                <LinearGradient
                  colors={[ACCENT, ACCENT_DEEP]}
                  style={StyleSheet.absoluteFill}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                />
                <Text style={styles.avatarText}>{initials}</Text>
              </>
            )}
            {uploadingAvatar && (
              <View style={styles.avatarUploading}>
                <ActivityIndicator size="small" color="#FFFFFF" />
              </View>
            )}
          </Pressable>

          <Text style={[styles.nameBig, { color: theme.text }]} numberOfLines={1}>
            {name || (t("profile") || "Profile")}
          </Text>
        </Animated.View>

        {/* Stats — LVL panel first (module-coloured crown), then XP & tasks */}
        <Animated.View entering={FadeInDown.delay(120).duration(400)} style={styles.statsRow}>
          <View
            style={[
              styles.statBox,
              {
                backgroundColor: moduleColor + "1F",
                borderColor: moduleColor,
              },
            ]}
          >
            <CrownIcon color={moduleColor} size={22} />
            <Text style={[styles.statVal, { color: theme.text }]}>{currentModule}</Text>
            <Text style={[styles.statLbl, { color: theme.textSecondary }]} numberOfLines={1}>
              {t("statLevel")}
            </Text>
          </View>
          <StatBox theme={theme} icon="disc" value={`${coins}`} label={lang === "en" ? "Coins" : "Монеты"} />
        </Animated.View>

        {/* Private reading library — button now carries the title itself, so
            no duplicate section heading above it. */}
        <Animated.View entering={FadeInDown.delay(200).duration(400)}>
          <ListWrapper theme={theme}>
            <ListRow
              theme={theme}
              icon="library-outline"
              label={lang === "en" ? "My library" : "Моя библиотека"}
              value={`${readingRecordings.length}`}
              isLast
              onPress={() => router.push("/reading-library")}
            />
          </ListWrapper>
        </Animated.View>

        {/* Progress — completion + a short summary of key parameters. */}
        <Animated.View entering={FadeInDown.delay(260).duration(400)}>
          <Text style={[styles.sectionLabel, { color: theme.text }]}>
            {lang === "en" ? "Progress" : "Прогресс"}
          </Text>
          <View
            style={[
              styles.progressCard,
              { backgroundColor: theme.card, borderColor: theme.cardBorder },
            ]}
          >
            <View style={styles.progressTop}>
              <Text style={[styles.progressTitle, { color: theme.text }]}>
                {lang === "en" ? "Path completed" : "Путь пройден"}
              </Text>
              <Text style={[styles.progressPct, { color: theme.accent }]}>
                {pathPct}%
              </Text>
            </View>

            <View
              style={[
                styles.progBar,
                {
                  backgroundColor:
                    theme.mode === "dark"
                      ? "rgba(255,255,255,0.08)"
                      : "rgba(14,14,16,0.06)",
                },
              ]}
            >
              <View style={[styles.progFill, { width: `${pathPct}%` }]}>
                <LinearGradient
                  colors={[ACCENT, ACCENT_DEEP]}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={StyleSheet.absoluteFill}
                />
              </View>
            </View>

            <View style={styles.progMetrics}>
              <ProgMetric theme={theme} value={`${currentModule}`} label={lang === "en" ? "Module" : "Модуль"} />
              <ProgMetric theme={theme} value={`${completedLevels}`} label={lang === "en" ? "Levels" : "Уровни"} />
              <ProgMetric theme={theme} value={`${totalTasks}`} label={lang === "en" ? "Tasks" : "Задания"} />
              <ProgMetric theme={theme} value={`${coins}`} label={lang === "en" ? "Coins" : "Монеты"} />
            </View>

            <Text style={[styles.progSummary, { color: theme.textSecondary }]}>
              {lang === "en"
                ? `You're on module ${currentModule} of 67 — ${completedLevels} levels done and ${coins} coins earned. Keep the streak going.`
                : `Вы на модуле ${currentModule} из 67 — пройдено ${completedLevels} уровней и накоплено ${coins} монет. Так держать!`}
            </Text>
          </View>
        </Animated.View>

      </ScrollView>

      {/* Edit-profile button — top-right corner. Opens the menu to change the
          name and photo. */}
      <Pressable
        onPress={openPhotoMenu}
        disabled={uploadingAvatar}
        hitSlop={8}
        style={[styles.editFab, { top: topPad }]}
      >
        {uploadingAvatar ? (
          <ActivityIndicator size="small" color={theme.accent} />
        ) : (
          <Ionicons name="brush-outline" size={20} color={theme.accent} />
        )}
      </Pressable>

      {/* Avatar action menu — take selfie / choose from gallery / remove */}
      <Modal
        visible={photoMenuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPhotoMenuOpen(false)}
      >
        <Pressable style={styles.menuBackdrop} onPress={() => setPhotoMenuOpen(false)}>
          <Pressable
            style={[
              styles.menuSheet,
              {
                backgroundColor: theme.card,
                borderColor: theme.cardBorder,
                paddingBottom: bottomPad + 12,
              },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={[styles.menuGrabber, { backgroundColor: theme.divider }]} />
            <Text style={[styles.menuTitle, { color: theme.text }]}>
              {lang === "en" ? "Edit profile" : "Изменить профиль"}
            </Text>

            <PhotoMenuRow
              theme={theme}
              icon="create-outline"
              label={lang === "en" ? "Change name" : "Изменить имя"}
              onPress={openNameEdit}
            />
            <PhotoMenuRow
              theme={theme}
              icon="color-palette-outline"
              label={lang === "en" ? "Choose color" : "Выбрать цвет"}
              onPress={openColorMenu}
            />
            <PhotoMenuRow
              theme={theme}
              icon="camera-outline"
              label={t("takeSelfie")}
              onPress={() => runPhotoAction(handleTakeSelfie)}
            />
            <PhotoMenuRow
              theme={theme}
              icon="images-outline"
              label={t("chooseFromGallery")}
              onPress={() => runPhotoAction(handlePickFromGallery)}
            />
            {user?.photoURL ? (
              <PhotoMenuRow
                theme={theme}
                icon="trash-outline"
                label={t("removePhoto")}
                danger
                onPress={() => runPhotoAction(handleRemovePhoto)}
              />
            ) : null}
            <PhotoMenuRow
              theme={theme}
              icon="close"
              label={t("cancel")}
              muted
              onPress={() => setPhotoMenuOpen(false)}
            />
          </Pressable>
        </Pressable>
      </Modal>

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
              { backgroundColor: theme.card, borderColor: theme.cardBorder },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[styles.menuTitle, { color: theme.text }]}>
              {lang === "en" ? "Change name" : "Изменить имя"}
            </Text>
            <TextInput
              value={draftName}
              onChangeText={setDraftName}
              placeholder={lang === "en" ? "Your name" : "Ваше имя"}
              placeholderTextColor={theme.textMuted}
              style={[
                styles.nameInput,
                {
                  color: theme.text,
                  borderColor: theme.cardBorder,
                  backgroundColor: theme.bgSecondary,
                },
              ]}
              autoFocus
              maxLength={40}
              returnKeyType="done"
              onSubmitEditing={handleSaveName}
            />
            <Pressable onPress={handleSaveName} style={styles.nameSaveBtn}>
              <LinearGradient
                colors={[ACCENT, ACCENT_DEEP]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <Text style={styles.nameSaveTxt}>
                {lang === "en" ? "Save" : "Сохранить"}
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Profile background color picker — 12 swatches + reset to default. */}
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
              { backgroundColor: theme.card, borderColor: theme.cardBorder },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[styles.menuTitle, { color: theme.text }]}>
              {lang === "en" ? "Profile background" : "Фон профиля"}
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
              style={[styles.resetColorBtn, { borderColor: theme.cardBorder }]}
            >
              <Ionicons name="refresh-outline" size={16} color={theme.textSecondary} />
              <Text style={[styles.resetColorTxt, { color: theme.textSecondary }]}>
                {lang === "en" ? "Default background" : "Стандартный фон"}
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function PhotoMenuRow({
  theme,
  icon,
  label,
  onPress,
  danger,
  muted,
}: {
  theme: Theme;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  danger?: boolean;
  muted?: boolean;
}) {
  const color = danger ? "#E5484D" : muted ? theme.textSecondary : theme.text;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.menuRow,
        pressed ? { backgroundColor: theme.rowPressed } : null,
      ]}
    >
      <Ionicons name={icon} size={22} color={color} style={{ marginRight: 14 }} />
      <Text style={[styles.menuRowLabel, { color }]}>{label}</Text>
    </Pressable>
  );
}

function ProgMetric({
  theme,
  value,
  label,
}: {
  theme: Theme;
  value: string;
  label: string;
}) {
  return (
    <View style={styles.progMetric}>
      <Text style={[styles.progMetricVal, { color: theme.text }]}>{value}</Text>
      <Text style={[styles.progMetricLbl, { color: theme.textMuted }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function StatBox({
  theme,
  icon,
  value,
  label,
}: {
  theme: Theme;
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  label: string;
}) {
  return (
    <View
      style={[
        styles.statBox,
        { backgroundColor: theme.card, borderColor: theme.cardBorder },
      ]}
    >
      <Ionicons name={icon} size={18} color={theme.accent} />
      <Text style={[styles.statVal, { color: theme.text }]}>{value}</Text>
      <Text style={[styles.statLbl, { color: theme.textSecondary }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 20, gap: 24 },
  pageTitle: {
    fontSize: 20,
    fontFamily: "Nunito_600SemiBold",
    letterSpacing: -0.2,
    marginBottom: 4,
  },

  // Profile header — plain centered avatar + name, no card box.
  profileHeader: {
    alignItems: "center",
    gap: 14,
    paddingVertical: 8,
  },
  avatar: {
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    ...(Platform.OS === "web"
      ? ({
          boxShadow: "0 8px 24px rgba(148,104,251,0.25)",
        } as any)
      : {
          shadowColor: ACCENT,
          shadowOpacity: 0.35,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 6 },
          elevation: 6,
        }),
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 46,
    fontFamily: "Nunito_700Bold",
    letterSpacing: 1,
  },
  avatarUploading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  editFab: {
    position: "absolute",
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  nameBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  nameSheet: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
    gap: 14,
  },
  nameInput: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 16,
    fontFamily: "Nunito_500Medium",
  },
  nameSaveBtn: {
    height: 50,
    borderRadius: 16,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  nameSaveTxt: {
    color: "#FFFFFF",
    fontSize: 16,
    fontFamily: "Nunito_700Bold",
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
    borderRadius: 14,
    borderWidth: 1,
  },
  resetColorTxt: {
    fontSize: 14,
    fontFamily: "Nunito_600SemiBold",
  },

  // Progress card
  progressCard: {
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    gap: 14,
  },
  progressTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  progressTitle: {
    fontSize: 15,
    fontFamily: "Nunito_600SemiBold",
    letterSpacing: -0.1,
  },
  progressPct: {
    fontSize: 16,
    fontFamily: "Nunito_700Bold",
  },
  progBar: {
    height: 10,
    borderRadius: 999,
    overflow: "hidden",
  },
  progFill: {
    height: 10,
    borderRadius: 999,
    overflow: "hidden",
  },
  progMetrics: {
    flexDirection: "row",
    gap: 10,
  },
  progMetric: {
    flex: 1,
    alignItems: "flex-start",
    gap: 2,
  },
  progMetricVal: {
    fontSize: 18,
    fontFamily: "Nunito_700Bold",
    letterSpacing: -0.4,
  },
  progMetricLbl: {
    fontSize: 11,
    fontFamily: "Nunito_400Regular",
  },
  progSummary: {
    fontSize: 13,
    lineHeight: 19,
    fontFamily: "Nunito_400Regular",
  },
  nameBig: {
    fontSize: 22,
    fontFamily: "Nunito_700Bold",
    letterSpacing: -0.3,
    textAlign: "center",
  },

  // Stats
  statsRow: { flexDirection: "row", gap: 10 },
  statBox: {
    flex: 1,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "flex-start",
    gap: 6,
  },
  statVal: {
    fontSize: 20,
    fontFamily: "Nunito_700Bold",
    letterSpacing: -0.4,
  },
  statLbl: {
    fontSize: 11,
    fontFamily: "Nunito_400Regular",
  },

  // Section / lists
  sectionLabel: {
    fontSize: 15,
    fontFamily: "Nunito_500Medium",
    paddingLeft: 4,
    marginBottom: 12,
    letterSpacing: -0.1,
  },
  listWrap: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 14,
    minHeight: 56,
  },
  rowLabel: {
    fontSize: 15,
    fontFamily: "Nunito_500Medium",
    letterSpacing: -0.1,
  },
  rowSub: {
    fontSize: 12,
    fontFamily: "Nunito_400Regular",
    marginTop: 2,
  },
  rowValue: {
    fontSize: 14,
    fontFamily: "Nunito_400Regular",
  },

  // Avatar action menu
  menuBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  menuSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    paddingTop: 10,
    paddingHorizontal: 10,
  },
  menuGrabber: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: 10,
  },
  menuTitle: {
    fontSize: 13,
    fontFamily: "Nunito_600SemiBold",
    letterSpacing: 0.2,
    textAlign: "center",
    marginBottom: 8,
    opacity: 0.7,
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 15,
    borderRadius: 14,
  },
  menuRowLabel: {
    fontSize: 16,
    fontFamily: "Nunito_500Medium",
  },

  // Rank progress slider
  rankCard: {
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    gap: 14,
  },
  rankCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  rankCardLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flexShrink: 1,
  },
  rankCardIcon: { fontSize: 26 },
  rankCardName: {
    fontSize: 16,
    fontFamily: "Nunito_600SemiBold",
    letterSpacing: -0.2,
  },
  rankCardSub: {
    fontSize: 12,
    fontFamily: "Nunito_500Medium",
    marginTop: 2,
    letterSpacing: 0.3,
  },
  rankCardRight: { alignItems: "flex-end", flexShrink: 1, maxWidth: 140 },
  rankCardNextLabel: {
    fontSize: 10,
    fontFamily: "Nunito_500Medium",
    letterSpacing: 1.2,
  },
  rankCardNext: {
    fontSize: 12,
    fontFamily: "Nunito_500Medium",
    marginTop: 2,
  },

  rankTrackOuter: {
    paddingVertical: 4,
  },
  rankTrack: {
    height: 12,
    borderRadius: 999,
    backgroundColor: "rgba(26,26,31,0.06)",
    borderWidth: 1,
    borderColor: "rgba(26,26,31,0.08)",
    overflow: "visible",
  },
  rankFillWrap: {
    height: 10,
    borderRadius: 999,
    overflow: "visible",
    backgroundColor: CTA_GOLD,
    ...(Platform.OS === "web"
      ? ({
          boxShadow:
            "0 0 14px rgba(255,207,52,0.85), 0 0 28px rgba(255,207,52,0.55), 0 0 48px rgba(255,207,52,0.35)",
        } as any)
      : {
          shadowColor: CTA_GOLD,
          shadowOpacity: 0.9,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 0 },
          elevation: 8,
        }),
  },
  rankFillGloss: {
    position: "absolute",
    top: 1,
    left: 6,
    right: 6,
    height: 3,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.45)",
    opacity: 0.6,
  },
  rankThumb: {
    position: "absolute",
    right: -8,
    top: -6,
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  rankThumbGlow: {
    position: "absolute",
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(196,166,255,0.45)",
    ...(Platform.OS === "web"
      ? ({ boxShadow: "0 0 16px rgba(196,166,255,0.95), 0 0 32px rgba(148,104,251,0.6)" } as any)
      : {
          shadowColor: "#C4A6FF",
          shadowOpacity: 1,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 0 },
        }),
  },
  rankThumbCore: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1.5,
  },

  rankFooterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  rankFooterText: {
    fontSize: 11,
    fontFamily: "Nunito_500Medium",
    letterSpacing: 0.2,
    flexShrink: 1,
  },
});
