import React, { useState, useEffect, useMemo, useRef } from "react";
import { appAlert } from "@/lib/appAlert";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  Image,
  ActivityIndicator,
  Modal,
  TextInput,
} from "react-native";
import OverscrollFill from "@/components/OverscrollFill";
import { EdgeScale, EdgeScaleProvider, useEdgeScroll } from "@/components/EdgeScale";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { SvgXml } from "react-native-svg";
import { PressScale } from "@/components/settings/SettingsParts";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "@/lib/haptics";
import * as ImagePicker from "expo-image-picker";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { useGame } from "@/context/GameContext";
import CoinIcon from "@/components/CoinIcon";
import { useAuth } from "@/context/AuthContext";
import { useLang, pickLang } from "@/context/LangContext";
import { storage as fbStorage, auth as fbAuth, firebaseConfigured } from "@/lib/firebase";
import { rs } from "@/lib/responsive";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme, type Theme } from "@/context/ThemeContext";
import ProfileCover, { COVER_HEIGHT, PlainPlateThumb } from "@/components/profile/ProfileCover";
import { COVER_PATTERNS, COVER_ART_RATIO } from "@/components/profile/coverPatterns";
import StreakCard from "@/components/profile/StreakCard";
import { type TilePalette } from "@/components/profile/GlossTile";
import SoftTile from "@/components/profile/SoftTile";
import CoinScatter, { SPARK_COLOR } from "@/components/profile/CoinScatter";
import LibraryLogo from "@/components/profile/LibraryLogo";
import { isDailyClaimedToday } from "@/components/DailyRewards";

// Flat bright tiles (same in light and dark), Google Labs-style palette:
// saturated-but-soft fills with dark ink.
const TILE_INK = "#1F1E1D";
// Shared tile geometry so all cards read as one set.
const TILE_H = 196;
const TILE_BAND = 62;
const TILE_TITLE = 16;
const TILE_BLOB = 46;
const TILE_PALETTES: Record<"diary" | "studio" | "library" | "coins", TilePalette> = {
  // each colour drifts to a neighbouring hue at the bottom
  diary: { color: "#A0A3FF", ink: TILE_INK }, // Raman
  studio: { color: "#5B3DB8", ink: "#F4F2EE", flat: true }, // deep violet, solid
  library: { color: "#F7F6F2", ink: TILE_INK }, // light paper, colourful books
  coins: { color: "#5C5BEE", ink: "#FFFFFF" }, // Röntgen — white ink reads better
};
import ProfileMenuPopover, { type MenuAnchor, type MenuOption } from "@/components/profile/ProfileMenuPopover";
import {
  CASSETTE,
  QUILL,
  COINS,
  RANK_SHIELD,
  themedSvg,
} from "@/assets/figma/profile/tiles";

// Persisted background color the player picks for their profile screen only.
const PROFILE_COVER_KEY = "@kingspeech_profile_cover_v1";

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
    <View style={{ width: rs(22), height: rs(22) }}>
      <View
        style={{
          position: "absolute",
          left: rs(6),
          top: rs(1),
          width: rs(15),
          height: rs(15),
          borderRadius: rs(4),
          borderWidth: 1.8,
          borderColor: color,
        }}
      />
      <View
        style={{
          position: "absolute",
          left: rs(1),
          top: rs(6),
          width: rs(15),
          height: rs(15),
          borderRadius: rs(4),
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
  const insets = useSafeAreaInsets();
  const { levels, coins, activityLog, currentRank } = useGame();
  // «Получите бесплатные монеты» (hidden once) today’s daily bonus is taken (on /coins).
  const [dailyClaimed, setDailyClaimed] = useState(false);
  useFocusEffect(
    React.useCallback(() => {
      isDailyClaimedToday().then(setDailyClaimed);
    }, []),
  );
  const { user, setPhotoURL, saveProfile } = useAuth();
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [photoMenuOpen, setPhotoMenuOpen] = useState(false);
  // True from open until the menu's close animation ends: the «+» under the
  // overlay hides meanwhile, the overlay draws the rotating glyph itself.
  const [menuShown, setMenuShown] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<MenuAnchor | null>(null);
  const plusRef = useRef<View>(null);
  const [nameEditOpen, setNameEditOpen] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [coverMenuOpen, setCoverMenuOpen] = useState(false);
  // Plate background picked from the catalogue (null = plain neutral plate).
  const [coverPattern, setCoverPattern] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(PROFILE_COVER_KEY)
      .then((v) => {
        if (v) setCoverPattern(v);
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
          appAlert(pickLang(lang, { ru: "Загрузка", en: "Upload", kk: "Жүктеу" }), pickLang(lang, { ru: "Не удалось загрузить в облако — фото сохранено локально.", en: "Couldn't upload to the cloud — the photo is saved on this device.", kk: "Бұлтқа жүктеу мүмкін болмады — фото құрылғыда сақталды." }));
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
        appAlert(pickLang(lang, { ru: "Доступ к фото", en: "Photo access", kk: "Фотоға рұқсат" }), pickLang(lang, { ru: "Разреши доступ к галерее, чтобы установить аватар.", en: "Allow gallery access to set your avatar.", kk: "Аватар орнату үшін галереяға рұқсат беріңіз." }));
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
      appAlert(pickLang(lang, { ru: "Ошибка", en: "Error", kk: "Қате" }), e?.message ?? pickLang(lang, { ru: "Не удалось выбрать фото", en: "Couldn't pick a photo", kk: "Фото таңдау мүмкін болмады" }));
    }
  };

  const handleTakeSelfie = async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        appAlert(pickLang(lang, { ru: "Доступ к камере", en: "Camera access", kk: "Камераға рұқсат" }), pickLang(lang, { ru: "Разреши доступ к камере, чтобы сделать селфи.", en: "Allow camera access to take a selfie.", kk: "Селфи түсіру үшін камераға рұқсат беріңіз." }));
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
      appAlert(pickLang(lang, { ru: "Ошибка", en: "Error", kk: "Қате" }), e?.message ?? pickLang(lang, { ru: "Не удалось сделать селфи", en: "Couldn't take a selfie", kk: "Селфи түсіру мүмкін болмады" }));
    }
  };

  const handleRemovePhoto = async () => {
    try {
      await setPhotoURL("");
    } catch (e: any) {
      console.warn("[profile] remove photo failed:", e);
    }
  };

  // Close the «+» menu, then run `fn` once its close animation (× → +) has
  // finished and the overlay modal is gone — so a picker / alert / next modal
  // never opens over a dismissing one.
  const afterMenuCloseRef = useRef<(() => void) | null>(null);
  const closeMenuThen = (fn: () => void) => {
    if (Platform.OS === "web") {
      setPhotoMenuOpen(false);
      setTimeout(fn, 0);
      return;
    }
    afterMenuCloseRef.current = fn;
    setPhotoMenuOpen(false);
  };
  const onMenuClosed = () => {
    setMenuShown(false);
    const fn = afterMenuCloseRef.current;
    afterMenuCloseRef.current = null;
    if (fn) setTimeout(fn, 60);
  };

  const runPhotoAction = (action: () => Promise<void>) => {
    closeMenuThen(() => void action());
  };

  // "Загрузить фото профиля": camera or gallery on device; gallery on web.
  const handleUploadPhoto = () => {
    if (Platform.OS === "web") {
      runPhotoAction(handlePickFromGallery);
      return;
    }
    closeMenuThen(() => {
      appAlert(pickLang(lang, { ru: "Фото профиля", en: "Profile photo", kk: "Профиль фотосы" }), undefined, [
        { text: t("takeSelfie"), onPress: () => handleTakeSelfie() },
        { text: t("chooseFromGallery"), onPress: () => handlePickFromGallery() },
        { text: t("cancel"), style: "cancel" },
      ]);
    });
  };

  const openPhotoMenu = () => {
    if (uploadingAvatar) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const node = plusRef.current;
    if (node && typeof node.measureInWindow === "function") {
      node.measureInWindow((x, y, width, height) => {
        setMenuAnchor({ x, y, width, height });
        setMenuShown(true);
        setPhotoMenuOpen(true);
      });
    } else {
      setMenuShown(true);
      setPhotoMenuOpen(true);
    }
  };

  // Open the name editor (from the edit menu).
  const openNameEdit = () => {
    setDraftName(name);
    closeMenuThen(() => setNameEditOpen(true));
  };

  const openCoverMenu = () => {
    closeMenuThen(() => setCoverMenuOpen(true));
  };

  const pickCover = (id: string | null) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setCoverPattern(id);
    setCoverMenuOpen(false);
    if (id) AsyncStorage.setItem(PROFILE_COVER_KEY, id).catch(() => {});
    else AsyncStorage.removeItem(PROFILE_COVER_KEY).catch(() => {});
  };

  const handleSaveName = async () => {
    const trimmed = draftName.trim();
    setNameEditOpen(false);
    if (!trimmed || trimmed === name) return;
    try {
      await saveProfile(trimmed, user?.gender ?? "male");
    } catch (e: any) {
      console.warn("[profile] save name failed:", e);
      appAlert(pickLang(lang, { ru: "Ошибка", en: "Error", kk: "Қате" }), e?.message ?? pickLang(lang, { ru: "Не удалось сохранить имя", en: "Couldn't save the name", kk: "Атты сақтау мүмкін болмады" }));
    }
  };

  const menuOptions: MenuOption[] = [
    {
      key: "photo",
      icon: "camera",
      label: pickLang(lang, { ru: "Загрузить фото профиля", en: "Upload profile photo", kk: "Профиль фотосын жүктеу" }),
      onPress: handleUploadPhoto,
    },
    {
      key: "bg",
      icon: "image",
      label: pickLang(lang, { ru: "Фон таблички", en: "Plate background", kk: "Тақтайша фоны" }),
      onPress: openCoverMenu,
    },
    {
      key: "name",
      icon: "pencil",
      label: pickLang(lang, { ru: "Изменить имя профиля", en: "Change profile name", kk: "Профиль атын өзгерту" }),
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
  const { scrollY: edgeScrollY, onScroll: onEdgeScroll } = useEdgeScroll();

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


  const initials = (name || "?").split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 1);

  const mode = theme.mode;
  // Positions an exported Figma illustration inside a GlossTile (tile coords
  // minus the 1pt hairline the fill sits inside).
  const art = (xml: string, x: number, y: number, w: number, h: number) => (
    <SvgXml
      xml={xml}
      width={rs(w)}
      height={rs(h)}
      pointerEvents="none"
      style={{ position: "absolute", left: rs(x - 1), top: rs(y - 1) }}
    />
  );

  return (
    <EdgeScaleProvider scrollY={edgeScrollY} topEdge={topPad + rs(8)} bottomEdge={bottomPad + rs(84)}>
    <View style={[styles.container, { backgroundColor: theme.backingTop }]}>
      <Animated.ScrollView
        contentContainerStyle={styles.scrollOuter}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
        onScroll={onEdgeScroll}
        scrollEventThrottle={16}
      >
        <OverscrollFill top={theme.bg} bottom={theme.backingBottom} />
        {/* Top plate (Figma "Top panel" 394:1200): rounded bottom, hairline stroke. */}
        <View
          style={[
            styles.topPanel,
            {
              backgroundColor: theme.bg,
              borderColor: theme.panelStroke,
              paddingTop: topPad + rs(3),
            },
          ]}
        >
          {/* Header — cover banner, avatar sitting in its notch, name */}
          <EdgeScale entering={FadeInDown.delay(40).duration(400)} style={styles.header}>
            <ProfileCover
              fill={theme.card}
              stroke={strokeShape(theme)}
              sheen="#F0EEE9"
              pattern={coverPattern}
              ink={theme.text}
            />

            <Pressable
              ref={plusRef}
              onPress={openPhotoMenu}
              disabled={uploadingAvatar}
              hitSlop={rs(8)}
              style={[
                styles.plusBtn,
                { backgroundColor: theme.bg, borderColor: strokeShape(theme) },
              ]}
            >
              {uploadingAvatar ? (
                <ActivityIndicator size="small" color={theme.text} />
              ) : (
                <View style={[styles.plusGlyph, { opacity: menuShown ? 0 : 1 }]}>
                  <View style={[styles.plusH, { backgroundColor: theme.text }]} />
                  <View style={[styles.plusV, { backgroundColor: theme.text }]} />
                </View>
              )}
            </Pressable>

            {/* The avatar is not a button: only the «+» opens the menu. */}
            <View style={[styles.avatar, { backgroundColor: theme.card }]}>
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
            </View>

            <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
              {name || (t("profile") || "Profile")}
            </Text>
          </EdgeScale>

          {/* Stats — Ранг · Модуль · Монеты */}
          <EdgeScale entering={FadeInDown.delay(100).duration(400)} style={styles.statsRow}>
            <Stat
              theme={theme}
              value={`${currentRank}`}
              label={pickLang(lang, { ru: "Ранг", en: "Rank", kk: "Дәреже" })}
              left={<SvgXml xml={themedSvg(RANK_SHIELD, mode)} width={rs(22)} height={rs(22)} />}
            />
            <Stat
              theme={theme}
              value={`${currentModule}`}
              label={pickLang(lang, { ru: "Модуль", en: "Module", kk: "Модуль" })}
              left={<LayersIcon color={theme.text} />}
            />
            <Stat
              theme={theme}
              value={`${coins}`}
              label={pickLang(lang, { ru: "Монеты", en: "Coins", kk: "Монеталар" })}
              right={<CoinIcon size={rs(22)} color={theme.text} />}
            />
          </EdgeScale>

          <EdgeScale entering={FadeInDown.delay(160).duration(400)} style={styles.streak}>
            <StreakCard theme={theme} activity={activityLog} lang={lang} />
          </EdgeScale>
        </View>

        {/* Backing (Figma 402:1301): vertical gradient behind the tile list. */}
        <View style={[styles.tiles, { paddingBottom: bottomPad + rs(110) }]}>
          <LinearGradient
            colors={[theme.backingTop, theme.backingMid, theme.backingBottom]}
            locations={[0, 0.65, 1]}
            style={styles.backing}
            pointerEvents="none"
          />

          {/* Bento: diary + library side by side (mirrored blob corners, same
              band, same type scale, art centred above the title), coins below. */}
          <EdgeScale entering={FadeInDown.delay(220).duration(400)} style={styles.bentoRow}>
            <SoftTile
              height={TILE_H}
              band={TILE_BAND}
              style={{ flex: 1 }}
              palette={TILE_PALETTES.diary}
              title={pickLang(lang, { ru: "Аудио-дневник", en: "Audio diary", kk: "Аудиокүнделік" })}
              sub={pickLang(lang, { ru: "Расскажи о дне", en: "Tell about your day", kk: "Күніңді айтып бер" })}
              titleSize={TILE_TITLE}
              blob={{ corner: "tl", radius: TILE_BLOB }}
              art={
                <View pointerEvents="none" style={[styles.tileArt, { top: rs(30) }]}>
                  <SvgXml xml={themedSvg(CASSETTE, "dark")} width={rs(122)} height={rs(78)} />
                </View>
              }
              onPress={() => router.push("/diary")}
            />
            <SoftTile
              height={TILE_H}
              band={TILE_BAND}
              style={{ flex: 1 }}
              palette={TILE_PALETTES.library}
              title={pickLang(lang, { ru: "Библиотека", en: "Library", kk: "Кітапхана" })}
              sub={pickLang(lang, { ru: "Ваших записей", en: "of your recordings", kk: "Жазбаларыңыздың" })}
              titleSize={TILE_TITLE}
              blob={{ corner: "tr", radius: TILE_BLOB }}
              art={
                <View pointerEvents="none" style={[styles.tileArt, { top: rs(24) }]}>
                  <LibraryLogo width={rs(124)} height={rs(87)} />
                </View>
              }
              onPress={() => router.push("/library")}
            />
          </EdgeScale>

          <EdgeScale entering={FadeInDown.delay(300).duration(400)} style={{ marginTop: rs(12) }}>
            <SoftTile
              height={124}
              band={TILE_BAND}
              palette={TILE_PALETTES.coins}
              title={pickLang(lang, { ru: "Купить монеты", en: "Buy coins", kk: "Монета сатып алу" })}
              sub={pickLang(lang, { ru: "Подсказки, темы и бонусы", en: "Hints, themes and bonuses", kk: "Кеңестер, тақырыптар мен бонустар" })}
              titleSize={TILE_TITLE}
              badge={
                dailyClaimed
                  ? undefined
                  : { text: pickLang(lang, { ru: "Получите бесплатные монеты", en: "Get free coins", kk: "Тегін монеталар алыңыз" }) }
              }
              art={
                // coin stack on the right, vertically centred; loose coins around it
                <>
                  <SvgXml
                    xml={themedSvg({ ...COINS, light: ["0.9", SPARK_COLOR] }, "light")}
                    width={rs(112)}
                    height={rs(68)}
                    pointerEvents="none"
                    style={{ position: "absolute", right: rs(30), top: rs(28) }}
                  />
                  <CoinScatter />
                </>
              }
              onPress={() => router.push("/coins")}
            />
          </EdgeScale>
        </View>
      </Animated.ScrollView>

      {/* "+" menu — Figma 130:3 glass popover */}
      <ProfileMenuPopover
        visible={photoMenuOpen}
        anchor={menuAnchor}
        theme={theme}
        options={menuOptions}
        onClose={() => setPhotoMenuOpen(false)}
        onClosed={onMenuClosed}
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
              {pickLang(lang, { ru: "Изменить имя профиля", en: "Change profile name", kk: "Профиль атын өзгерту" })}
            </Text>
            <TextInput
              value={draftName}
              onChangeText={setDraftName}
              placeholder={pickLang(lang, { ru: "Ваше имя", en: "Your name", kk: "Атыңыз" })}
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
                {pickLang(lang, { ru: "Сохранить", en: "Save", kk: "Сақтау" })}
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Plate background catalogue — 7 ornaments + the plain plate. */}
      <Modal
        visible={coverMenuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCoverMenuOpen(false)}
      >
        <Pressable style={styles.nameBackdrop} onPress={() => setCoverMenuOpen(false)}>
          <Pressable
            style={[
              styles.nameSheet,
              { backgroundColor: theme.card, borderColor: strokeShape(theme) },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[styles.sheetTitle, { color: theme.text }]}>
              {pickLang(lang, { ru: "Фон таблички", en: "Plate background", kk: "Тақтайша фоны" })}
            </Text>
            <ScrollView style={{ maxHeight: rs(520) }} showsVerticalScrollIndicator={false}>
            <View style={styles.coverGrid}>
              {[null, ...COVER_PATTERNS].map((p) => {
                const id = p?.id ?? null;
                const selected = coverPattern === id;
                return (
                  <View key={id ?? "plain"} style={styles.coverCell}>
                  <PressScale onPress={() => pickCover(id)} style={{ gap: rs(6) }}>
                    <View
                      style={[
                        styles.coverThumb,
                        {
                          backgroundColor: "transparent",
                          borderColor: selected ? theme.text : "transparent",
                          borderWidth: selected ? 2.5 : 1.5,
                        },
                      ]}
                    >
                      {p ? (
                        <Image source={p.image} style={styles.coverThumbImg} resizeMode="contain" />
                      ) : (
                        <PlainPlateThumb fill={theme.bg} ink={theme.text} stroke={strokeShape(theme)} />
                      )}
                      {selected && (
                        <View style={[styles.coverCheck, { backgroundColor: theme.text }]}>
                          <Ionicons name="checkmark" size={rs(14)} color={theme.bg} />
                        </View>
                      )}
                    </View>
                    <Text style={[styles.coverName, { color: selected ? theme.text : theme.textSecondary }]} numberOfLines={1}>
                      {p ? pickLang(lang, p) : pickLang(lang, { ru: "Без узора", en: "Plain", kk: "Өрнексіз" })}
                    </Text>
                  </PressScale>
                  </View>
                );
              })}
            </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
    </EdgeScaleProvider>
  );
}

const styles = StyleSheet.create({
  bentoRow: { flexDirection: "row", gap: 12 },
  bentoCol: { flex: 1, gap: 12 },
  tileArt: { position: "absolute", left: 0, right: 0, alignItems: "center" },
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
    alignItems: "center",
    justifyContent: "center",
  },
  plusGlyph: { width: 18, height: 18, alignItems: "center", justifyContent: "center" },
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
    alignItems: "center",
    justifyContent: "center",
  },
  nameSaveTxt: {
    fontSize: 16,
    fontFamily: "Geologica_800ExtraBold",
  },
  coverGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 12,
  },
  coverCell: { width: "48%", gap: 6 },
  coverThumb: {
    width: "100%",
    aspectRatio: COVER_ART_RATIO,
    borderRadius: 14,
    overflow: "hidden",
    padding: 2,
  },
  coverThumbImg: { width: "100%", height: "100%" },
  coverCheck: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  coverName: {
    fontSize: 13,
    fontFamily: "Geologica_600SemiBold",
    paddingLeft: 2,
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
  },
  resetColorTxt: {
    fontSize: 14,
    fontFamily: "Geologica_600SemiBold",
  },
});
