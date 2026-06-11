import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  TextInput,
  Image,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { useGame, getRank, RANKS } from "@/context/GameContext";
import { useAuth } from "@/context/AuthContext";
import { useLang } from "@/context/LangContext";
import { storage as fbStorage, auth as fbAuth, firebaseConfigured } from "@/lib/firebase";

import { colors as brandColors } from "@/theme/tokens";
import { useTheme, type Theme } from "@/context/ThemeContext";

const ACCENT = brandColors.purple;
const ACCENT_DEEP = brandColors.purpleDeep;
const CTA_GOLD = brandColors.gold;

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
  const { t } = useLang();
  const insets = useSafeAreaInsets();
  const { levels, totalXp } = useGame();
  const { user, saveProfile, setPhotoURL } = useAuth();
  const [name, setName] = useState(user?.name ?? "");
  const [editingName, setEditingName] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  React.useEffect(() => {
    if (user?.name && !editingName) setName(user.name);
  }, [user?.name]);

  const handlePickAvatar = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
      setUploadingAvatar(true);

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
          // Fall back to local URI so the user still sees their pick
          await setPhotoURL(asset.uri);
          Alert.alert("Загрузка", "Не удалось загрузить в облако — фото сохранено локально.");
        }
      } else {
        // No Firebase — store local URI only
        await setPhotoURL(asset.uri);
      }
    } catch (e: any) {
      console.warn("[profile] pick avatar failed:", e);
      Alert.alert("Ошибка", e?.message ?? "Не удалось выбрать фото");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const rank = getRank(totalXp);
  const completedLevels = levels.filter((l) => l.completed).length;
  const totalTasks = levels.reduce(
    (acc, l) => acc + l.tasks.filter((tt) => tt.status === "completed").length,
    0,
  );
  const initials = (name || "?").split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
  const authLabel =
    user?.authMethod === "google" ? "Google account"
    : user?.authMethod === "apple" ? "Apple account"
    : user?.authMethod === "email" ? "Email account"
    : "King Speech";

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: topPad + 12, paddingBottom: bottomPad + 100 },
        ]}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
      >
        <Animated.View entering={FadeInDown.duration(400)}>
          <Text style={[styles.pageTitle, { color: theme.text }]}>
            {t("profile") || "Profile"}
          </Text>
        </Animated.View>

        {/* Profile card — big square avatar + centered name */}
        <Animated.View
          entering={FadeInDown.delay(60).duration(400)}
          style={[
            styles.profileCard,
            {
              backgroundColor: theme.card,
              borderColor: theme.cardBorder,
            },
          ]}
        >
          <Pressable
            onPress={handlePickAvatar}
            disabled={uploadingAvatar}
            style={[
              styles.avatarBig,
              {
                backgroundColor: theme.bgSecondary,
                borderColor: theme.cardBorder,
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
                <Text style={styles.avatarBigText}>{initials}</Text>
              </>
            )}
            {/* Edit badge */}
            <View style={[styles.avatarEditBadge, { borderColor: theme.card }]}>
              {uploadingAvatar ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="camera" size={16} color="#FFFFFF" />
              )}
            </View>
          </Pressable>

          <View style={styles.nameBlock}>
            {editingName ? (
              <TextInput
                style={[
                  styles.nameInput,
                  {
                    textAlign: "center",
                    color: theme.text,
                    borderBottomColor: theme.accent,
                  },
                ]}
                value={name}
                onChangeText={setName}
                onBlur={async () => {
                  setEditingName(false);
                  if (user && name.trim()) await saveProfile(name.trim(), user.gender);
                }}
                autoFocus
                maxLength={30}
              />
            ) : (
              <Pressable onPress={() => setEditingName(true)} style={styles.nameRowCentered}>
                <Text style={[styles.nameBig, { color: theme.text }]}>
                  {name || t("profile") || "Profile"}
                </Text>
                <Ionicons name="pencil-outline" size={14} color={theme.textMuted} />
              </Pressable>
            )}
            <Text style={[styles.emailCentered, { color: theme.textSecondary }]}>
              {authLabel}
            </Text>
            <View style={styles.kycRowCentered}>
              <Ionicons name="checkmark-circle" size={14} color={theme.accent} />
              <Text style={[styles.kycText, { color: theme.textSecondary }]}>
                {(rank.icon ?? "") + " "}{rank.name}
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* Stats */}
        <Animated.View entering={FadeInDown.delay(120).duration(400)} style={styles.statsRow}>
          <StatBox theme={theme} icon="star" value={`${totalXp}`} label="XP" />
          <StatBox
            theme={theme}
            icon="trophy-outline"
            value={`${completedLevels}`}
            label={t("levelsCompleted")}
          />
          <StatBox
            theme={theme}
            icon="book-outline"
            value={`${totalTasks}`}
            label={t("tasksCompleted")}
          />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(170).duration(400)}>
          <RankProgress theme={theme} xp={totalXp} />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(230).duration(400)}>
          <Text style={[styles.sectionLabel, { color: theme.text }]}>
            {t("rankSystem")}
          </Text>
          <ListWrapper theme={theme}>
            {RANKS.map((r, i) => {
              const isActive = r.name === rank.name;
              const isLast = i === RANKS.length - 1;
              return (
                <View
                  key={r.name}
                  style={[
                    styles.row,
                    !isLast && {
                      borderBottomWidth: 1,
                      borderBottomColor: theme.divider,
                    },
                  ]}
                >
                  <Text style={{ fontSize: 20, marginRight: 12 }}>{r.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.rowLabel,
                        { color: isActive ? theme.accent : theme.text },
                      ]}
                    >
                      {r.name}
                    </Text>
                    <Text style={[styles.rowSub, { color: theme.textSecondary }]}>
                      {r.minXp} XP
                    </Text>
                  </View>
                  {isActive && (
                    <Ionicons name="checkmark-circle" size={18} color={theme.accent} />
                  )}
                </View>
              );
            })}
          </ListWrapper>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

function RankProgress({ theme, xp }: { theme: Theme; xp: number }) {
  const rank = getRank(xp);
  const idx = RANKS.findIndex((r) => r.name === rank.name);
  const next = RANKS[idx + 1];
  const rangeMin = rank.minXp;
  const rangeMax = next ? next.minXp : Math.max(xp, rank.minXp + 1);
  const span = Math.max(1, rangeMax - rangeMin);
  const progress = next ? Math.min(1, Math.max(0, (xp - rangeMin) / span)) : 1;
  const pct = Math.round(progress * 100);

  return (
    <View
      style={[
        styles.rankCard,
        { backgroundColor: theme.card, borderColor: theme.cardBorder },
      ]}
    >
      <View style={styles.rankCardHeader}>
        <View style={styles.rankCardLeft}>
          <Text style={styles.rankCardIcon}>{rank.icon}</Text>
          <View>
            <Text style={[styles.rankCardName, { color: theme.text }]}>{rank.name}</Text>
            <Text style={[styles.rankCardSub, { color: theme.textSecondary }]}>
              {xp} XP{next ? `  ·  ${pct}%` : "  ·  MAX"}
            </Text>
          </View>
        </View>
        {next && (
          <View style={styles.rankCardRight}>
            <Text style={[styles.rankCardNextLabel, { color: theme.textMuted }]}>
              NEXT
            </Text>
            <Text style={[styles.rankCardNext, { color: theme.text }]} numberOfLines={1}>
              {next.icon} {next.name}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.rankTrackOuter}>
        <View
          style={[
            styles.rankTrack,
            {
              backgroundColor:
                theme.mode === "dark"
                  ? "rgba(255,255,255,0.08)"
                  : "rgba(14,14,16,0.06)",
              borderColor: theme.cardBorder,
            },
          ]}
        >
          <View style={[styles.rankFillWrap, { width: `${pct}%` }]}>
            <LinearGradient
              colors={["#6A4FF4", "#9468FB", "#C4A6FF"]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
            {/* glossy top highlight */}
            <View style={styles.rankFillGloss} />
            {/* neon thumb */}
            {progress > 0.02 && (
              <View style={styles.rankThumb} pointerEvents="none">
                <View style={styles.rankThumbGlow} />
                <View
                  style={[
                    styles.rankThumbCore,
                    {
                      backgroundColor: theme.card,
                      borderColor: theme.accent,
                    },
                  ]}
                />
              </View>
            )}
          </View>
        </View>
      </View>

      <View style={styles.rankFooterRow}>
        <Text style={[styles.rankFooterText, { color: theme.textMuted }]}>
          {rangeMin} XP
        </Text>
        <Text style={[styles.rankFooterText, { color: theme.textMuted }]}>
          {next ? `${rangeMax - xp} XP до ${next.name}` : "Максимальный ранг"}
        </Text>
        <Text style={[styles.rankFooterText, { color: theme.textMuted }]}>
          {next ? `${rangeMax} XP` : `${xp} XP`}
        </Text>
      </View>
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
    fontFamily: "Inter_600SemiBold",
    letterSpacing: -0.2,
    marginBottom: 4,
  },

  // Profile card — vertical, centered, big square avatar
  profileCard: {
    alignItems: "center",
    gap: 16,
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
  },
  avatarBig: {
    width: 200,
    height: 200,
    borderRadius: 20,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
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
  avatarBigText: {
    color: "#FFFFFF",
    fontSize: 64,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1,
  },
  avatarEditBadge: {
    position: "absolute",
    right: 10,
    bottom: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: ACCENT_DEEP,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
  },
  nameBlock: {
    alignItems: "center",
    gap: 4,
  },
  nameRowCentered: { flexDirection: "row", alignItems: "center", gap: 6 },
  nameBig: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.3,
  },
  emailCentered: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  kycRowCentered: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  nameInput: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    borderBottomWidth: 1,
    borderBottomColor: ACCENT,
    paddingVertical: 2,
    minWidth: 140,
  },
  email: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginTop: 1,
  },
  kycRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
  },
  kycText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
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
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.4,
  },
  statLbl: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },

  // Section / lists
  sectionLabel: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
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
    fontFamily: "Inter_500Medium",
    letterSpacing: -0.1,
  },
  rowSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  rowValue: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
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
    fontFamily: "Inter_600SemiBold",
    letterSpacing: -0.2,
  },
  rankCardSub: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    marginTop: 2,
    letterSpacing: 0.3,
  },
  rankCardRight: { alignItems: "flex-end", flexShrink: 1, maxWidth: 140 },
  rankCardNextLabel: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    letterSpacing: 1.2,
  },
  rankCardNext: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
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
    fontFamily: "Inter_500Medium",
    letterSpacing: 0.2,
    flexShrink: 1,
  },
});
