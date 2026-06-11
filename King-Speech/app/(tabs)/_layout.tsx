import { Tabs } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Platform, Pressable, StyleSheet, View, type ColorValue } from "react-native";
import React from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useLang } from "@/context/LangContext";
import { useTheme } from "@/context/ThemeContext";
import { sonic } from "@/constants/colors";
import {
  IconHome,
  IconMic,
  IconClapperboard,
  IconAvatar,
  IconGear,
} from "@/components/tabs/TabBarIcons";

type IconComponent = React.ComponentType<{ size?: number; color?: string }>;

interface Slot {
  routeName: string;
  Icon: IconComponent;
}

const SLOTS: Slot[] = [
  { routeName: "index", Icon: IconHome },
  { routeName: "interview", Icon: IconMic },
  { routeName: "showtime", Icon: IconClapperboard },
  { routeName: "profile", Icon: IconAvatar },
  { routeName: "settings", Icon: IconGear },
];

const TAB_HEIGHT = 64;
const ICON_SIZE = 30;
const PILL_HEIGHT = 44;
const BAR_PAD = 8;

// Per-theme color tokens for the tab bar. Dark is the canonical look —
// light mirrors it with inverted glass + soft slate inactive icons so the
// bar reads cleanly on the light Path canvas.
const TAB_TOKENS = {
  dark: {
    barBg: "#0E0E10",
    gradient: ["#1F1F28", "#0E0E10"] as const,
    topHighlight: "rgba(255,255,255,0.16)",
    border: "rgba(255,255,255,0.06)",
    inactive: "#7A7A82",
    active: "#FFFFFF",
    pillBorder: "rgba(148,104,251,0.50)",
    pillGradient: ["rgba(148,104,251,0.32)", "rgba(106,79,244,0.18)"] as const,
    purpleWash: [
      "rgba(148,104,251,0.14)",
      "rgba(148,104,251,0)",
      "rgba(148,104,251,0.14)",
    ] as const,
    shadowOpacity: 0.32,
  },
  light: {
    barBg: "#FFFFFF",
    gradient: ["#FFFFFF", "#F4F4F6"] as const,
    topHighlight: "rgba(255,255,255,0.9)",
    border: "rgba(14,14,16,0.08)",
    inactive: "#9A9AA4",
    active: "#0E0E10",
    pillBorder: "rgba(148,104,251,0.55)",
    pillGradient: ["rgba(148,104,251,0.22)", "rgba(106,79,244,0.10)"] as const,
    purpleWash: [
      "rgba(148,104,251,0.10)",
      "rgba(148,104,251,0)",
      "rgba(148,104,251,0.10)",
    ] as const,
    shadowOpacity: 0.14,
  },
} as const;

type GradientColors = readonly [ColorValue, ColorValue, ...ColorValue[]];

function asGradient(colors: readonly string[]): GradientColors {
  return colors as GradientColors;
}

function SonicTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { themeMode } = useTheme();
  const tk = TAB_TOKENS[themeMode];
  const isWeb = Platform.OS === "web";
  const bottomInset = isWeb ? 18 : Math.max(insets.bottom, 12);

  const focusedRoute = state.routes[state.index]?.name;
  const focusedIndex = SLOTS.findIndex((s) => s.routeName === focusedRoute);

  const [barWidth, setBarWidth] = React.useState(0);
  const slotWidth = barWidth > 0 ? (barWidth - BAR_PAD * 2) / SLOTS.length : 0;
  const pillWidth = slotWidth > 0 ? slotWidth * 0.82 : 0;

  const pillX = useSharedValue(0);
  const pillOpacity = useSharedValue(focusedIndex >= 0 ? 1 : 0);

  React.useEffect(() => {
    if (slotWidth === 0) return;
    if (focusedIndex < 0) {
      pillOpacity.value = withTiming(0, { duration: 180 });
      return;
    }
    pillOpacity.value = withTiming(1, { duration: 180 });
    const target =
      BAR_PAD + focusedIndex * slotWidth + (slotWidth - pillWidth) / 2;
    pillX.value = withSpring(target, {
      damping: 18,
      stiffness: 200,
      mass: 0.7,
    });
  }, [focusedIndex, slotWidth, pillWidth]);

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pillX.value }],
    opacity: pillOpacity.value,
    width: pillWidth,
  }));

  const press = (slot: Slot) => {
    if (Platform.OS !== "web") {
      Haptics.selectionAsync().catch(() => {});
    }
    const target = state.routes.find((r) => r.name === slot.routeName);
    if (!target) return;
    const event = navigation.emit({
      type: "tabPress",
      target: target.key,
      canPreventDefault: true,
    });
    if (!event.defaultPrevented) {
      navigation.navigate(target.name as never);
    }
  };

  return (
    <View
      pointerEvents="box-none"
      style={[styles.outer, { paddingBottom: bottomInset }]}
    >
      <View
        style={[
          styles.barWrap,
          {
            backgroundColor: tk.barBg,
            borderColor: tk.border,
            shadowOpacity: tk.shadowOpacity,
          },
        ]}
        onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
      >
        {/* Layer 1 — vertical glass gradient */}
        <LinearGradient
          colors={asGradient(tk.gradient)}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={[StyleSheet.absoluteFill, styles.barFill]}
          pointerEvents="none"
        />
        {/* Layer 2 — purple wash from sides */}
        <LinearGradient
          colors={asGradient(tk.purpleWash)}
          locations={[0, 0.5, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[StyleSheet.absoluteFill, styles.barFill]}
          pointerEvents="none"
        />
        {/* Top inner highlight line */}
        <View
          pointerEvents="none"
          style={[styles.topHighlight, { backgroundColor: tk.topHighlight }]}
        />

        {/* Active pill indicator */}
        {slotWidth > 0 ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.pill,
              {
                height: PILL_HEIGHT,
                top: (TAB_HEIGHT - PILL_HEIGHT) / 2,
                borderRadius: PILL_HEIGHT / 2,
              },
              pillStyle,
            ]}
          >
            <LinearGradient
              colors={asGradient(tk.pillGradient)}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[StyleSheet.absoluteFill, { borderRadius: PILL_HEIGHT / 2 }]}
            />
            <View
              style={[styles.pillBorder, { borderColor: tk.pillBorder }]}
              pointerEvents="none"
            />
          </Animated.View>
        ) : null}

        <View style={styles.row}>
          {SLOTS.map((slot, i) => (
            <TabSlot
              key={slot.routeName}
              slot={slot}
              isFocused={i === focusedIndex}
              onPress={() => press(slot)}
              activeColor={tk.active}
              inactiveColor={tk.inactive}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

function TabSlot({
  slot,
  isFocused,
  onPress,
  activeColor,
  inactiveColor,
}: {
  slot: Slot;
  isFocused: boolean;
  onPress: () => void;
  activeColor: string;
  inactiveColor: string;
}) {
  const scale = useSharedValue(1);
  const focusScale = useSharedValue(isFocused ? 1.08 : 1);

  React.useEffect(() => {
    focusScale.value = withSpring(isFocused ? 1.08 : 1, {
      damping: 16,
      stiffness: 240,
      mass: 0.7,
    });
  }, [isFocused]);

  const aStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value * focusScale.value }],
  }));

  const Icon = slot.Icon;
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() =>
        (scale.value = withSpring(0.9, { damping: 16, stiffness: 320 }))
      }
      onPressOut={() =>
        (scale.value = withSpring(1, { damping: 16, stiffness: 320 }))
      }
      accessibilityRole="button"
      accessibilityState={isFocused ? { selected: true } : {}}
      style={styles.tabBtn}
      hitSlop={8}
    >
      <Animated.View style={aStyle}>
        <Icon
          size={ICON_SIZE}
          color={isFocused ? activeColor : inactiveColor}
        />
      </Animated.View>
    </Pressable>
  );
}

export default function TabLayout() {
  const { t } = useLang();
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <SonicTabBar {...props} />}
    >
      <Tabs.Screen name="index" options={{ title: t("tabPath") }} />
      <Tabs.Screen name="interview" options={{ title: t("tabInterview") }} />
      <Tabs.Screen name="showtime" options={{ title: t("tabShowtime") }} />
      <Tabs.Screen name="profile" options={{ title: t("tabProfile") }} />
      <Tabs.Screen name="settings" options={{ title: t("tabSettings") }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  outer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  barWrap: {
    width: "100%",
    maxWidth: 480,
    height: TAB_HEIGHT,
    borderRadius: TAB_HEIGHT / 2,
    overflow: "hidden",
    borderWidth: 1,
    shadowColor: sonic.primary,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 14 },
    elevation: 14,
  },
  barFill: { borderRadius: TAB_HEIGHT / 2 },
  topHighlight: {
    position: "absolute",
    top: 0,
    left: 24,
    right: 24,
    height: 1,
  },
  row: {
    flex: 1,
    flexDirection: "row",
    alignItems: "stretch",
    paddingHorizontal: BAR_PAD,
  },
  tabBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  pill: {
    position: "absolute",
    left: 0,
    overflow: "hidden",
  },
  pillBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: PILL_HEIGHT / 2,
    borderWidth: 1,
  },
});
