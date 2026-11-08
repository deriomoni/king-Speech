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
// Minimal shape of what expo-router's <Tabs> passes to a custom `tabBar`.
// SDK 58 replaced the `navigation` prop with `emitter` + `navigateToTab`
// (see expo-router/build/react-navigation/bottom-tabs/types.d.ts).
type TabRoute = { key: string; name: string };
type BottomTabBarProps = {
  state: { index: number; routes: TabRoute[] };
  emitter: {
    emit: (event: {
      type: "tabPress";
      target?: string;
      canPreventDefault?: boolean;
    }) => { defaultPrevented: boolean };
  };
  navigateToTab: (routeKey: string) => void;
  descriptors: Record<string, { options: { tabBarStyle?: unknown } }>;
};
import { useLang } from "@/context/LangContext";
import { useTheme } from "@/context/ThemeContext";
import {
  IconHome,
  IconCheatSheet,
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
  { routeName: "interview", Icon: IconCheatSheet },
  { routeName: "showtime", Icon: IconClapperboard },
  { routeName: "profile", Icon: IconAvatar },
  { routeName: "settings", Icon: IconGear },
];

const TAB_HEIGHT = 64;
const ICON_SIZE = 30;
const BAR_PAD = 8;
const BAR_BORDER = 5; // tab/border stroke width

// Per-theme color tokens for the tab bar. Dark is the canonical look —
// light mirrors it with inverted glass + soft slate inactive icons so the
// bar reads cleanly on the light Path canvas.
const TAB_TOKENS = {
  // Values = Figma variables tab/* (component 2:117 dark, 17:858 light).
  dark: {
    barBg: "#18181A", // tab/bg (matches the darker app background)
    gradient: ["#2A2A2C", "#18181A"] as const, // tab/glass-top → glass-bottom
    topHighlight: "rgba(240,238,233,0.14)", // tab/highlight
    border: "rgba(240,238,233,0.06)", // tab/border
    inactive: "#81807F", // tab/icon-inactive
    active: "#FFD857", // tab/icon-active
    shadowColor: "rgba(255,216,87,0.22)", // tab/shadow
  },
  light: {
    barBg: "#FAF9F6",
    gradient: ["#FAF9F6", "#F4F3F0"] as const,
    topHighlight: "rgba(250,249,246,0.9)",
    border: "rgba(38,38,40,0.08)",
    inactive: "#A5A5A4",
    active: "#262628",
    shadowColor: "rgba(255,216,87,0.20)",
  },
} as const;

type GradientColors = readonly [ColorValue, ColorValue, ...ColorValue[]];

function asGradient(colors: readonly string[]): GradientColors {
  return colors as GradientColors;
}

function SonicTabBar({ state, emitter, navigateToTab, descriptors }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { themeMode } = useTheme();
  const tk = TAB_TOKENS[themeMode];

  // A screen can hide the whole tab bar by setting
  // tabBarStyle: { display: "none" } (e.g. the Cheat Sheet warm-up runner).
  const focusedOptions = descriptors[state.routes[state.index]?.key]?.options;
  const tabBarHidden =
    (focusedOptions?.tabBarStyle as { display?: string } | undefined)?.display ===
    "none";
  const isWeb = Platform.OS === "web";
  const bottomInset = isWeb ? 18 : Math.max(insets.bottom, 12);

  const focusedRoute = state.routes[state.index]?.name;
  const focusedIndex = SLOTS.findIndex((s) => s.routeName === focusedRoute);

  // No pill: the active tab is shown by its icon colour alone.

  if (tabBarHidden) return null;

  const press = (slot: Slot) => {
    if (Platform.OS !== "web") {
      Haptics.selectionAsync().catch(() => {});
    }
    const target = state.routes.find((r) => r.name === slot.routeName);
    if (!target) return;
    const event = emitter.emit({
      type: "tabPress",
      target: target.key,
      canPreventDefault: true,
    });
    if (!event.defaultPrevented) {
      navigateToTab(target.key);
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
            shadowColor: tk.shadowColor,
          },
        ]}
      >
        {/* Layer 1 — vertical glass gradient */}
        <LinearGradient
          colors={asGradient(tk.gradient)}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={[StyleSheet.absoluteFill, styles.barFill]}
          pointerEvents="none"
        />
        {/* Top inner highlight line */}
        <View
          pointerEvents="none"
          style={[styles.topHighlight, { backgroundColor: tk.topHighlight }]}
        />


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
    borderWidth: BAR_BORDER,
    shadowOpacity: 1,
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
});
