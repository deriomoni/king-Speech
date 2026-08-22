import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Switch,
  Platform,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Path, G } from "react-native-svg";
import * as Haptics from "expo-haptics";
import { useGame } from "@/context/GameContext";
import { useLang } from "@/context/LangContext";
import { useAuth } from "@/context/AuthContext";
import { useDevTools } from "@/context/DevToolsContext";
import { useRouter } from "expo-router";
import { useTheme, type Theme, type ThemeMode } from "@/context/ThemeContext";

const SIGN_OUT = "#E5484D";

// King Speech wordmark (mascot + "KS"). Monochrome — `color` follows the theme
// so it reads on both light and dark. Kept small at the top of Settings.
// Extra breathing room between the mascot (left) and the "KS" wordmark.
const LOGO_GAP = 150;
const LOGO_VB_W = 2436 + LOGO_GAP;
const LOGO_W = Math.round(150 * (LOGO_VB_W / 2436)); // keep the glyphs their size
const LOGO_H = Math.round(LOGO_W * (858 / LOGO_VB_W));

function KSLogo({ color }: { color: string }) {
  return (
    <Svg width={LOGO_W} height={LOGO_H} viewBox={`0 0 ${LOGO_VB_W} 858`}>
      <Path
        d="M416.044 287.048C419.764 318.725 434.064 348.189 456.599 370.61C479.134 393.031 508.567 407.078 540.071 410.447C571.576 413.816 603.282 406.307 629.992 389.152C656.702 371.997 676.83 346.214 687.076 316.03C667.205 311.427 649.83 299.357 638.502 282.287C627.174 265.217 622.749 244.436 626.13 224.191C629.512 203.946 640.445 185.765 656.695 173.365C672.945 160.964 693.285 155.279 713.559 157.473C733.832 159.667 752.508 169.573 765.77 185.167C779.032 200.761 785.878 220.865 784.91 241.372C783.941 261.878 775.231 281.238 760.559 295.494C745.888 309.751 726.362 317.828 705.974 318.075V652.564C571.716 775.812 213.284 775.812 79.0264 652.564V318.075C58.6376 317.828 39.1122 309.751 24.4406 295.494C9.76892 281.238 1.05884 261.878 0.0903931 241.372C-0.878113 220.865 5.96808 200.761 19.2299 185.167C32.4917 169.573 51.1678 159.667 71.4414 157.473C91.7149 155.279 112.055 160.964 128.305 173.365C144.555 185.765 155.488 203.946 158.87 224.191C162.251 244.436 157.826 265.217 146.498 282.287C135.17 299.357 117.795 311.427 97.9241 316.03C108.17 346.214 128.298 371.997 155.008 389.152C181.718 406.307 213.424 413.816 244.929 410.447C276.433 407.078 305.866 393.031 328.401 370.61C350.936 348.189 365.236 318.725 368.956 287.048C348.441 281.315 330.684 268.291 318.974 250.388C307.264 232.485 302.395 210.916 305.268 189.676C308.141 168.436 318.562 148.964 334.601 134.866C350.64 120.768 371.209 113 392.5 113C413.791 113 434.36 120.768 450.399 134.866C466.438 148.964 476.859 168.436 479.732 189.676C482.605 210.916 477.736 232.485 466.026 250.388C454.316 268.291 436.559 281.315 416.044 287.048Z"
        fill={color}
      />
      <G transform={`translate(${LOGO_GAP} 0)`}>
        <Path
          d="M1813.8 58.3129C1781.36 62.8489 1768.19 76.3339 1760.59 108.066C1707.94 91.3499 1620.72 96.5698 1600.63 158.949C1593.94 179.758 1594.52 207.887 1604.67 227.6C1612.92 243.421 1622.27 249.927 1636.5 259.415C1619.16 267.21 1602.8 277.601 1596.45 296.296C1584.92 330.291 1602.78 354.462 1633.96 365.03C1634.96 365.377 1635.98 365.696 1637 365.987C1609.69 372.195 1579.23 381.327 1587.33 416.573C1598.66 465.929 1690.72 471.597 1729.93 465.493C1762.43 461.328 1794.04 454.259 1815.61 427.059C1838.88 397.717 1839.63 339.262 1807.2 316.46C1769.92 290.243 1718.38 302.937 1676.11 297.659C1658.94 295.516 1650.8 286.209 1664.52 271.053L1665.47 270.012C1694.71 281.061 1741.03 276.659 1769.79 264.242C1813.77 245.257 1828.64 192.687 1809.74 150.433C1804.43 138.537 1797.15 131.604 1787.2 123.213C1806.05 114.227 1814.9 111.975 1834.95 118.493L1835.07 58.2419C1828.66 58.1649 1820.03 57.8109 1813.8 58.3129ZM1116.08 15.813C1095.1 55.956 1075.37 96.969 1054.55 137.213C1051.14 143.82 1047.56 150.721 1044.5 157.474L1044.68 15.821L955.112 15.822L955.147 369.724L1044.61 369.713C1044.59 353.904 1042.44 280.576 1045.77 270.368C1050.77 255.074 1061.09 240.037 1067.99 225.351C1082.72 270.992 1101.21 324.947 1117.87 369.668L1217.1 369.73C1212.27 357.074 1199.87 327.436 1196.45 315.745L1135.18 155.512C1159.66 109.153 1189.43 62.12 1214.38 15.751L1116.08 15.813ZM1490.54 100.351C1467.09 103.309 1452.5 110.665 1437.23 129.564C1432.23 135.753 1428.37 143.181 1423.93 148.879C1424.41 134.735 1427.71 104.12 1428.67 90L1344.27 106.494L1344.21 369.691L1431.81 369.657L1431.77 218.833C1431.87 204.941 1431.33 185.102 1442.14 174.775C1447.27 169.913 1454.19 167.397 1461.24 167.825C1476.94 168.64 1483.02 181.111 1483.9 195.056C1485.16 215.149 1484.65 235.466 1484.64 255.618L1484.58 369.668L1572.13 369.685L1572.14 240.104C1572.19 183.46 1582.93 98.6142 1498.4 99.9502C1495.66 99.9932 1493.3 100.055 1490.54 100.351ZM1230.21 106.493C1228.05 110.72 1229.2 341.507 1229.22 369.714L1316.47 369.71L1316.43 106.49L1230.21 106.493ZM1318.17 45C1318.17 33.0653 1313.43 21.6193 1304.99 13.1802C1296.55 4.74106 1285.1 0 1273.17 0C1261.23 0 1249.79 4.74106 1241.35 13.1802C1232.91 21.6193 1228.17 33.0653 1228.17 45C1228.17 50.9095 1229.33 56.7611 1231.59 62.2208C1233.85 67.6804 1237.17 72.6412 1241.35 76.8198C1245.53 80.9984 1250.49 84.3131 1255.95 86.5746C1261.41 88.836 1267.26 90 1273.17 90C1279.08 90 1284.93 88.836 1290.39 86.5746C1295.85 84.3131 1300.81 80.9984 1304.99 76.8198C1309.16 72.6412 1312.48 67.6804 1314.74 62.2208C1317 56.7611 1318.17 50.9095 1318.17 45ZM1666.22 371.375C1686.19 373.314 1707 371.975 1727.59 372.847C1746.68 373.656 1765.03 382.677 1753.55 405.23C1751.25 409.74 1746.4 412.437 1742.03 414.728C1722.54 421.415 1704.46 420.592 1684.27 418.254C1658.01 415.212 1647.05 391.627 1666.22 371.375ZM1699.69 146.259C1726.19 142.131 1731.03 162.92 1731.52 184.35C1731.88 200.089 1730.87 222.873 1713.84 229.96C1706.29 230.898 1703.21 230.4 1695.94 228.985C1678.23 214.025 1680.07 180.365 1686.33 159.849C1688.52 152.684 1693.02 149.002 1699.69 146.259ZM1721.8 614.4C1708.35 558.247 1667.16 532.776 1610.61 535.439C1579.35 537.237 1546.16 546.418 1525.95 570.891C1486.7 618.409 1487.79 712.93 1536.46 753.82C1562.39 775.61 1596.69 782.16 1629.53 779.86C1659.59 777.53 1687.34 768.25 1707.06 744.33C1717.75 731.36 1718.79 724.83 1725.72 711.01C1701.63 704.84 1677.51 698.84 1653.34 693.01C1650.74 700.68 1648.9 705.59 1643.75 711.72C1629.14 729.09 1602.84 725.85 1590.84 707.54C1584.57 697.98 1583.19 689.13 1582.29 678.01L1718.39 677.99C1727.1 735.92 1754.76 770.08 1814.72 778.7C1869.75 787.1 1925.63 767.34 1943.95 710.58L1871.61 692.82C1865.73 712.8 1852.34 728.69 1828.73 721.71C1808.83 715.82 1802.97 696.93 1801.32 678.02L1944.91 678C1947.07 601.81 1929.07 538.727 1839.25 535.329C1791.39 533.519 1746.61 552.753 1728 599.57C1726.31 603.925 1723.99 610.398 1721.8 614.4ZM1388.35 535.147C1354.07 538.117 1340.65 551.94 1322.26 579.482C1323.21 566.511 1324.33 553.553 1325.62 540.612L1242.69 540.481L1242.68 857.895L1331 857.915C1331 857.915 1326.99 746.545 1325.6 738.255C1339.79 758.955 1353.05 773.435 1378.99 778.605C1397.43 782.275 1425.57 777.005 1441.01 766.375C1465.85 749.275 1476.93 722.115 1482.3 693.545C1489.52 655.105 1485.19 601.686 1462.57 569.228C1450.61 551.872 1432.19 540.036 1411.44 536.374C1404.56 535.147 1395.36 534.754 1388.35 535.147ZM1087.28 445.464C1050.61 446.848 1014.2 453.297 987.709 481.462C969.422 500.905 963.145 526.077 964.547 552.246C965.391 575.878 973.434 597.422 991.416 613.44C1017.01 636.24 1052.15 642.43 1084.51 650.21C1103.93 654.57 1131.42 658.86 1132.83 683.95C1133.21 690.64 1129.87 698.56 1124.99 702.93C1105.18 720.68 1064.78 715.57 1047.3 696.62C1036.6 685.02 1032.84 673.46 1028.98 659.06C1024.71 660.97 1020.43 662.35 1015.93 663.63C993.875 669.94 972.03 677.53 950 683.87C966.069 754.49 1015.56 778.46 1083.12 781.69C1121.9 782.08 1165.74 775.84 1194.66 747.56C1228.98 713.97 1233.12 644.18 1198.18 609.803C1175 586.997 1137.53 579.961 1107.1 572.465C1089.96 568.244 1052.15 562.432 1051.95 539.24C1051.93 532.197 1054.85 525.464 1060 520.659C1076.64 504.825 1116.44 508.933 1130.66 526.582C1138.35 536.123 1143.96 547.291 1146.87 559.194C1170.27 549.641 1198.06 537.895 1221.67 529.205C1215.21 502.585 1198.53 479.578 1175.24 465.152C1150.01 449.562 1116.59 444.801 1087.28 445.464ZM2207.87 450.073L2207.77 774.35L2294.87 774.33L2294.83 683.96C2294.83 666.01 2291.5 621.65 2305.2 608.034C2321.06 592.272 2347.59 603.522 2347.75 626.47C2349.3 642.34 2348.95 654.53 2348.95 669.33L2348.9 738.25L2348.89 774.36H2435.65L2435.67 666.67C2435.68 640.78 2437.03 619.574 2432.94 592.751C2423.7 532.13 2348.25 517.311 2308.01 556.992C2300.58 564.314 2281.95 583.935 2275.68 592.751C2285.73 554.671 2294.91 490.572 2294.81 450.09L2207.87 450.073ZM2073.23 535.438C2003.75 539.399 1965.25 575.989 1959.52 645.87C1952.89 726.8 2004.2 785.73 2087.45 779.97C2145.14 776.21 2180.58 747.08 2189.64 688.73C2183.09 687.62 2176.53 686.58 2169.95 685.61C2156.55 683.22 2117.91 677.33 2106.97 673.77C2104.42 693.21 2102.39 719.07 2074.74 717.18C2068.07 716.72 2061.76 711.98 2057.93 706.7C2044.27 686.11 2045.81 655.2 2048.7 631.66C2050.92 613.621 2061.87 593.171 2083.06 596.618C2102.03 599.705 2105.29 623.37 2106.88 639.07C2133.21 634.86 2163.16 629.09 2189.24 625.58C2177.81 560.014 2138.14 534.649 2073.23 535.438ZM1609.42 587.137C1638.73 586.082 1642.01 608.457 1642.9 631.76L1618.93 631.71L1582.47 631.72C1583.1 611.449 1587.56 592.579 1609.42 587.137ZM1826.71 587.264C1857.18 585.263 1860.85 607.472 1862.21 631.73L1835.43 631.69L1801.55 631.67C1802.78 611.661 1805.4 594.355 1826.71 587.264ZM1355.83 596.212C1400.62 590.364 1399.15 651.45 1394.55 681.06C1392.13 696.64 1386.69 710.7 1371.17 716.93C1355.09 720.02 1340.76 712.96 1335.75 696.94C1327.39 670.17 1323.3 608.283 1355.83 596.212Z"
          fill={color}
        />
      </G>
    </Svg>
  );
}

interface RowProps {
  theme: Theme;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  toggle?: boolean;
  toggleVal?: boolean;
  onToggle?: (v: boolean) => void;
  onPress?: () => void;
  isLast?: boolean;
  destructive?: boolean;
  rightChevron?: boolean;
}

function Row({
  theme,
  icon,
  label,
  value,
  toggle,
  toggleVal,
  onToggle,
  onPress,
  isLast,
  destructive,
  rightChevron,
}: RowProps) {
  const showChevron = rightChevron ?? (!!onPress && toggle === undefined);
  return (
    <Pressable
      onPress={() => {
        if (!onPress) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      disabled={!onPress && toggle === undefined}
      style={({ pressed }) => [
        styles.row,
        !isLast && { borderBottomWidth: 1, borderBottomColor: theme.divider },
        pressed && onPress ? { backgroundColor: theme.rowPressed } : null,
      ]}
    >
      <Ionicons
        name={icon}
        size={22}
        color={destructive ? SIGN_OUT : theme.text}
        style={{ marginRight: 14 }}
      />
      <Text style={[styles.rowLabel, { color: destructive ? SIGN_OUT : theme.text }]}>
        {label}
      </Text>
      <View style={{ flex: 1 }} />
      {value ? (
        <Text style={[styles.rowValue, { color: theme.textSecondary }]}>{value}</Text>
      ) : null}
      {toggle !== undefined && (
        <Switch
          value={toggleVal}
          onValueChange={(v) => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onToggle?.(v);
          }}
          trackColor={{ false: theme.switchTrackOff, true: theme.accent }}
          thumbColor="#FFFFFF"
          ios_backgroundColor={theme.switchTrackOff}
        />
      )}
      {showChevron && (
        <Ionicons
          name="chevron-forward"
          size={16}
          color={theme.textMuted}
          style={{ marginLeft: 8 }}
        />
      )}
    </Pressable>
  );
}

function Section({
  theme,
  title,
  children,
}: {
  theme: Theme;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={{ gap: 12 }}>
      <Text style={[styles.sectionLabel, { color: theme.text }]}>{title}</Text>
      <View
        style={[
          styles.listWrap,
          {
            backgroundColor: theme.card,
            borderColor: theme.cardBorder,
          },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

function ThemeOption({
  theme,
  mode,
  selected,
  label,
  onSelect,
}: {
  theme: Theme;
  mode: ThemeMode;
  selected: boolean;
  label: string;
  onSelect: (m: ThemeMode) => void;
}) {
  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onSelect(mode);
      }}
      style={[
        styles.themeOption,
        {
          borderColor: selected ? theme.accent : theme.cardBorder,
          backgroundColor: selected ? theme.accentDim : "transparent",
        },
      ]}
    >
      <Ionicons
        name={mode === "dark" ? "moon" : "sunny"}
        size={20}
        color={selected ? theme.accent : theme.textMuted}
      />
      <Text
        style={[
          styles.themeOptionLabel,
          { color: selected ? theme.accent : theme.text },
        ]}
      >
        {label}
      </Text>
      {selected && <Ionicons name="checkmark" size={18} color={theme.accent} />}
    </Pressable>
  );
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { theme, themeMode, setTheme } = useTheme();
  const { resetProgress } = useGame();
  const { lang: appLang, setLang: setAppLang, t } = useLang();
  const { user, signOut } = useAuth();
  const { isOpenTestingEnabled, setOpenTestingEnabled, isDevSkipEnabled, setDevSkipEnabled } = useDevTools();
  const router = useRouter();

  const [sound, setSound] = useState(true);
  const [vibration, setVibration] = useState(true);
  const [notifications, setNotifications] = useState(true);
  const [reminder, setReminder] = useState(true);
  const [showLangs, setShowLangs] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const handleLogout = () => {
    const doLogout = async () => {
      await signOut();
      router.replace("/(auth)/welcome");
    };
    if (Platform.OS === "web") {
      if (window.confirm(t("logoutConfirm"))) doLogout();
    } else {
      Alert.alert(t("logout"), t("logoutConfirm"), [
        { text: t("cancel"), style: "cancel" },
        { text: t("confirm"), style: "destructive", onPress: doLogout },
      ]);
    }
  };

  const handleReset = () => {
    if (Platform.OS === "web") {
      if (window.confirm(t("resetConfirm"))) resetProgress();
    } else {
      Alert.alert(t("resetTitle"), t("resetMessage"), [
        { text: t("cancel"), style: "cancel" },
        { text: t("resetBtn"), style: "destructive", onPress: resetProgress },
      ]);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: topPad + 12, paddingBottom: bottomPad + 120 },
        ]}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
      >
        <Animated.View entering={FadeInDown.duration(400)} style={styles.logoWrap}>
          <KSLogo color={theme.text} />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(30).duration(400)}>
          <Text style={[styles.pageTitle, { color: theme.text }]}>{t("settings")}</Text>
        </Animated.View>

        {user && (
          <Animated.View entering={FadeInDown.delay(40).duration(400)}>
            <Section theme={theme} title={t("account")}>
              <Row
                theme={theme}
                icon="person-circle-outline"
                label={user.name || t("profile")}
                value={
                  user.authMethod === "google"
                    ? "Google"
                    : user.authMethod === "apple"
                    ? "Apple"
                    : "Email"
                }
              />
              <Row
                theme={theme}
                icon="log-out-outline"
                label={t("logout")}
                onPress={handleLogout}
                destructive
                rightChevron={false}
                isLast
              />
            </Section>
          </Animated.View>
        )}

        <Animated.View entering={FadeInDown.delay(80).duration(400)}>
          <Section theme={theme} title={t("language")}>
            <Row
              theme={theme}
              icon="language-outline"
              label={t("language")}
              value={appLang === "ru" ? "Русский" : "English"}
              onPress={() => setShowLangs(!showLangs)}
              isLast={!showLangs}
            />
            {showLangs && (
              <>
                <Pressable
                  onPress={() => {
                    setAppLang("ru");
                    setShowLangs(false);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  style={[
                    styles.row,
                    {
                      borderBottomWidth: 1,
                      borderBottomColor: theme.divider,
                      paddingLeft: 54,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.rowLabel,
                      { color: appLang === "ru" ? theme.accent : theme.text },
                    ]}
                  >
                    Русский
                  </Text>
                  <View style={{ flex: 1 }} />
                  {appLang === "ru" && (
                    <Ionicons name="checkmark" size={18} color={theme.accent} />
                  )}
                </Pressable>
                <Pressable
                  onPress={() => {
                    setAppLang("en");
                    setShowLangs(false);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  style={[styles.row, { paddingLeft: 54 }]}
                >
                  <Text
                    style={[
                      styles.rowLabel,
                      { color: appLang === "en" ? theme.accent : theme.text },
                    ]}
                  >
                    English
                  </Text>
                  <View style={{ flex: 1 }} />
                  {appLang === "en" && (
                    <Ionicons name="checkmark" size={18} color={theme.accent} />
                  )}
                </Pressable>
              </>
            )}
          </Section>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(120).duration(400)}>
          <Section theme={theme} title={t("theme")}>
            <View style={styles.themeRow}>
              <ThemeOption
                theme={theme}
                mode="light"
                selected={themeMode === "light"}
                label={t("light")}
                onSelect={setTheme}
              />
              <ThemeOption
                theme={theme}
                mode="dark"
                selected={themeMode === "dark"}
                label={t("dark")}
                onSelect={setTheme}
              />
            </View>
          </Section>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(160).duration(400)}>
          <Section theme={theme} title={t("soundAndVibration")}>
            <Row
              theme={theme}
              icon="volume-high-outline"
              label={t("soundEffects")}
              toggle
              toggleVal={sound}
              onToggle={setSound}
            />
            <Row
              theme={theme}
              icon="phone-portrait-outline"
              label={t("vibration")}
              toggle
              toggleVal={vibration}
              onToggle={setVibration}
              isLast
            />
          </Section>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(400)}>
          <Section theme={theme} title={t("notifications")}>
            <Row
              theme={theme}
              icon="notifications-outline"
              label={t("pushNotifications")}
              toggle
              toggleVal={notifications}
              onToggle={setNotifications}
            />
            <Row
              theme={theme}
              icon="alarm-outline"
              label={t("dailyReminder")}
              toggle
              toggleVal={reminder}
              onToggle={setReminder}
            />
            <Row
              theme={theme}
              icon="time-outline"
              label={t("reminderTime")}
              value="09:00"
              onPress={() => {}}
              isLast
            />
          </Section>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(250).duration(400)}>
          <Section theme={theme} title={t("devTools")}>
            <Row
              theme={theme}
              icon="construct-outline"
              label={t("openTesting")}
              toggle
              toggleVal={isOpenTestingEnabled}
              onToggle={setOpenTestingEnabled}
              isLast={!__DEV__}
            />
            {/* Dev-only Skip mode. Gated behind __DEV__ so it is stripped from
                production builds and never ships to players. */}
            {__DEV__ && (
              <Row
                theme={theme}
                icon="play-skip-forward-outline"
                label="Skip уровней (dev)"
                toggle
                toggleVal={isDevSkipEnabled}
                onToggle={setDevSkipEnabled}
                isLast
              />
            )}
          </Section>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(320).duration(400)}>
          <Section theme={theme} title={t("data")}>
            <Row
              theme={theme}
              icon="trash-outline"
              label={t("resetProgress")}
              onPress={handleReset}
              destructive
            />
            <Row
              theme={theme}
              icon="information-circle-outline"
              label={t("appVersion")}
              value="1.0.0"
              isLast
            />
          </Section>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 20, gap: 24 },
  logoWrap: { alignItems: "flex-start", marginBottom: -8 },
  pageTitle: {
    fontSize: 20,
    fontFamily: "Nunito_700Bold",
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  sectionLabel: {
    fontSize: 13,
    fontFamily: "Nunito_700Bold",
    paddingLeft: 4,
    letterSpacing: 1,
    textTransform: "uppercase",
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
    fontFamily: "Nunito_400Regular",
    letterSpacing: -0.1,
  },
  rowValue: {
    fontSize: 14,
    fontFamily: "Nunito_400Regular",
  },
  themeRow: {
    flexDirection: "row",
    gap: 10,
    padding: 12,
  },
  themeOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  themeOptionLabel: {
    fontSize: 15,
    fontFamily: "Nunito_700Bold",
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingTop: 8,
    paddingBottom: 8,
  },
  brandIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  brandName: {
    fontSize: 15,
    fontFamily: "Rubik_600SemiBold",
    letterSpacing: -0.1,
  },
  brandTag: {
    fontSize: 11,
    fontFamily: "Nunito_400Regular",
    marginTop: 1,
  },
});
