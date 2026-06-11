import React, { useEffect, useRef, useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
  type LayoutChangeEvent,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withRepeat,
  withSequence,
  withDelay,
  cancelAnimation,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import Colors from "@/constants/colors";
import {
  useGame,
  LevelType,
  MODULE_COLORS,
  getModuleQuote,
  getRankForSection,
  RANKS_MODULAR,
} from "@/context/GameContext";
import { useLang, Lang } from "@/context/LangContext";
import { useAppColors } from "@/hooks/useAppColors";
import { useDevTools } from "@/context/DevToolsContext";
import { RankBackground } from "@/components/path/RankBackground";
import {
  PathPaintingBackground,
  PATH_LANDSCAPE_BG_EXPERIMENT,
} from "@/components/path/PathPaintingBackground";
import FinalPortal from "@/components/path/FinalPortal";
import { getRankTheme } from "@/components/path/rankTheme";

function GlowRing({ color }: { color: string }) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.6);
  useEffect(() => {
    scale.value = withRepeat(withTiming(1.1, { duration: 1400 }), -1, true);
    opacity.value = withRepeat(withTiming(0.15, { duration: 1400 }), -1, true);
    return () => {
      cancelAnimation(scale);
      cancelAnimation(opacity);
    };
  }, []);
  const s = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));
  return (
    <Animated.View
      style={[
        s,
        {
          position: "absolute",
          inset: -8,
          borderRadius: 24,
          backgroundColor: color,
        },
      ]}
    />
  );
}

interface StepItem {
  id: LevelType;
  levelNumber: number;
  title: string;
  subtitle: string;
  icon: string;
  status: "locked" | "available" | "completed";
  tasksDone: number;
  color: string;
  colorDark: string;
  module: number;
}

// Length must equal the number of steps per module (currently 6 after the
// vocabulary level was added). Keeping it at 6 ensures every module starts
// from the same side (right) and the staircase zigzags R-L-R-L-R-L without
// the vertical R-R glitch we had when the pattern was length 5.
const SIDE_PATTERN: ("left" | "right")[] = [
  "right",
  "left",
  "right",
  "left",
  "right",
  "left",
];

function getSide(index: number): "left" | "right" {
  return SIDE_PATTERN[index % SIDE_PATTERN.length];
}

const ENTRY_ANIM_MAX = 10;

function shapeRadius(
  shape: import("@/components/path/rankTheme").StepShape,
): number {
  switch (shape) {
    case "circle":
      return 36;
    case "hexagon":
      return 14;
    case "rect-glass":
      return 4;
    case "octagon":
      return 10;
    case "crystal":
      return 22;
  }
}

function StepBlock({
  item,
  index,
  totalDone,
  colors,
  isNaturallyAvailable,
  rankTheme,
}: {
  item: StepItem;
  index: number;
  totalDone: number;
  colors: import("@/constants/colors").AppColors;
  isNaturallyAvailable: boolean;
  rankTheme: import("@/components/path/rankTheme").RankTheme;
}) {
  const { isOpenTestingEnabled } = useDevTools();
  const shapeR = shapeRadius(rankTheme.stepShape);
  const effectiveStatus =
    isOpenTestingEnabled && item.status === "locked"
      ? "available"
      : item.status;
  const isAvail = effectiveStatus === "available";
  const isDone = effectiveStatus === "completed";
  const isLocked = effectiveStatus === "locked";

  // Skip entry animation for: completed rows, rows beyond the first few,
  // and any row that is only "available" because of the Open Testing override
  // (otherwise the calm Path turns into a stagger storm of 335 animations).
  const isOverridden = isOpenTestingEnabled && item.status === "locked";
  const animateEntry = !isDone && !isOverridden && index < ENTRY_ANIM_MAX;

  const entryScale = useSharedValue(animateEntry ? 0.85 : 1);
  const entryTranslateY = useSharedValue(animateEntry ? 30 : 0);
  const entryOpacity = useSharedValue(animateEntry ? 0 : 1);

  const pressY = useSharedValue(0);
  const pressScale = useSharedValue(1);

  useEffect(() => {
    if (!animateEntry) return;
    const delay = index * 40;
    entryScale.value = withDelay(
      delay,
      withSpring(1, { damping: 14, stiffness: 100 }),
    );
    entryTranslateY.value = withDelay(delay, withTiming(0, { duration: 300 }));
    entryOpacity.value = withDelay(delay, withTiming(1, { duration: 260 }));
    return () => {
      cancelAnimation(entryScale);
      cancelAnimation(entryTranslateY);
      cancelAnimation(entryOpacity);
    };
  }, []);

  useEffect(() => {
    return () => {
      cancelAnimation(pressY);
      cancelAnimation(pressScale);
    };
  }, []);

  const entryStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: entryScale.value },
      { translateY: entryTranslateY.value },
    ],
    opacity: entryOpacity.value,
  }));

  const faceStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: pressY.value }, { scale: pressScale.value }],
  }));

  const sideStyle = useAnimatedStyle(() => ({
    opacity: 1 - pressY.value / 5,
    transform: [{ scaleY: 1 - pressY.value / 12 }],
  }));

  // Glow only on the single naturally-available step (never on overridden ones).
  const showGlow = isNaturallyAvailable && item.status === "available";

  const levelColor = item.color;
  const levelColorDark = item.colorDark;

  const faceColor = isDone ? levelColor : isAvail ? levelColor : "#E8E8EE";
  const sideColor = isDone
    ? levelColorDark
    : isAvail
      ? levelColorDark
      : "#CACAD4";
  const textColor = isDone ? "#fff" : isAvail ? "#1A1A2E" : "#A0A0B0";
  const iconColor = isDone ? "#fff" : isAvail ? "#1A1A2E" : "#B0B0C0";

  const gradTop = isDone
    ? lightenColor(levelColor, 18)
    : isAvail
      ? lightenColor(levelColor, 22)
      : "#F2F2F6";
  const gradBot = faceColor;

  const handlePressIn = () => {
    if (isLocked) return;
    pressY.value = withTiming(4, { duration: 60 });
    pressScale.value = withTiming(0.97, { duration: 60 });
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    } else {
      try {
        (navigator as any).vibrate?.(20);
      } catch {}
    }
  };

  const handlePressOut = () => {
    if (isLocked) return;
    pressY.value = withSpring(0, { damping: 18, stiffness: 300 });
    pressScale.value = withSpring(1, { damping: 18, stiffness: 300 });
  };

  const handlePress = () => {
    if (isLocked) return;
    if (item.id.startsWith("showtime")) {
      router.push({
        pathname: "/showtime-stage",
        params: { levelId: item.id, mode: "game" },
      });
      return;
    }
    if (item.id.startsWith("vocabulary")) {
      router.push({
        pathname: "/vocabulary-level",
        params: { levelId: item.id, moduleId: String(item.module) },
      });
      return;
    }
    // All Path interview levels (modules 1 through 67) use the standard 3-task
    // level screen. The dedicated Jenny experience is only reachable from the
    // Interview tab, never from inside the Path.
    router.push({ pathname: "/level/[id]", params: { id: item.id } });
  };

  return (
    <Animated.View style={[entryStyle, { position: "relative" }]}>
      {showGlow && <GlowRing color={levelColor} />}

      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={isLocked}
        accessibilityRole="button"
        accessibilityLabel={`${item.title}`}
        style={styles.stepOuter}
      >
        <Animated.View
          style={[
            styles.step3dSide,
            {
              backgroundColor: sideColor,
              borderBottomLeftRadius: shapeR,
              borderBottomRightRadius: shapeR,
            },
            sideStyle,
          ]}
        />

        <Animated.View
          style={[styles.stepFace, { borderRadius: shapeR }, faceStyle]}
        >
          {/* Per-rank accent outline (skipped when completed). */}
          {!isDone && (
            <View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFillObject,
                {
                  borderRadius: shapeR,
                  borderWidth: rankTheme.stepShape === "rect-glass" ? 1 : 1.5,
                  borderColor:
                    rankTheme.stepShape === "circle"
                      ? "transparent"
                      : rankTheme.accent + (isAvail ? "AA" : "55"),
                  zIndex: 2,
                },
              ]}
            />
          )}
          <LinearGradient
            colors={[gradTop, gradBot]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={[StyleSheet.absoluteFill, { borderRadius: shapeR }]}
          />

          <View style={styles.stepHighlight} />

          <LinearGradient
            colors={[
              "transparent",
              isLocked ? "rgba(0,0,0,0.07)" : sideColor + "22",
            ]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.stepShadowOverlay}
          />

          <View style={styles.stepLeft}>
            <View
              style={[
                styles.stepIconCircle,
                {
                  backgroundColor: isDone
                    ? "rgba(255,255,255,0.25)"
                    : isAvail
                      ? "rgba(26,26,46,0.12)"
                      : "rgba(0,0,0,0.06)",
                },
              ]}
            >
              {isLocked ? (
                <Ionicons name="lock-closed" size={16} color={iconColor} />
              ) : isDone ? (
                <Ionicons name="checkmark" size={18} color="#fff" />
              ) : (
                <Ionicons name={item.icon as any} size={18} color={iconColor} />
              )}
            </View>
          </View>

          <View style={styles.stepCenter}>
            <Text
              style={[
                styles.stepTitle,
                { color: textColor, fontFamily: rankTheme.fontFamilyTitle },
              ]}
              numberOfLines={1}
            >
              {item.title}
            </Text>
            <Text
              style={[
                styles.stepSub,
                {
                  color: isDone
                    ? "rgba(255,255,255,0.75)"
                    : isAvail
                      ? "rgba(26,26,46,0.6)"
                      : "#B8B8C8",
                  fontFamily: rankTheme.fontFamily,
                },
              ]}
              numberOfLines={1}
            >
              {item.subtitle}
            </Text>

            <View style={styles.pips}>
              {[0, 1, 2].map((i) => (
                <View
                  key={i}
                  style={[
                    styles.pip,
                    {
                      backgroundColor:
                        i < item.tasksDone
                          ? isDone
                            ? "rgba(255,255,255,0.9)"
                            : "rgba(26,26,46,0.5)"
                          : isDone
                            ? "rgba(255,255,255,0.25)"
                            : isAvail
                              ? "rgba(26,26,46,0.18)"
                              : "rgba(0,0,0,0.1)",
                    },
                  ]}
                />
              ))}
            </View>
          </View>

          <View style={styles.stepRight}>
            {isDone ? (
              <Ionicons name="star" size={16} color="rgba(255,255,255,0.9)" />
            ) : isAvail ? (
              <Ionicons
                name="chevron-forward-circle"
                size={20}
                color="rgba(26,26,46,0.55)"
              />
            ) : (
              <View style={styles.levelNumBadge}>
                <Text
                  style={[
                    styles.levelNumText,
                    { fontFamily: "Rubik_700Bold", color: "#B0B0C0" },
                  ]}
                >
                  {item.levelNumber}
                </Text>
              </View>
            )}
          </View>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

function lightenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(
    255,
    ((num >> 16) & 0xff) + Math.round((255 * percent) / 100),
  );
  const g = Math.min(
    255,
    ((num >> 8) & 0xff) + Math.round((255 * percent) / 100),
  );
  const b = Math.min(255, (num & 0xff) + Math.round((255 * percent) / 100));
  return `rgb(${r},${g},${b})`;
}

function ModuleDivider({
  moduleNum,
  colors,
  lang,
}: {
  moduleNum: number;
  colors: import("@/constants/colors").AppColors;
  lang: Lang;
}) {
  const mc = MODULE_COLORS[moduleNum];
  const quote = getModuleQuote(moduleNum, lang);
  if (!mc || !quote) return null;

  return (
    <View style={styles.moduleDivider}>
      <View
        style={[styles.moduleDividerLine, { backgroundColor: mc.color + "40" }]}
      />
      <View style={[styles.moduleQuoteCard, { borderColor: mc.color + "50" }]}>
        <LinearGradient
          colors={[mc.color + "18", mc.color + "08"]}
          style={[StyleSheet.absoluteFill, { borderRadius: 16 }]}
        />
        <View style={[styles.moduleNumBadge, { backgroundColor: mc.color }]}>
          <Text style={[styles.moduleNumText, { fontFamily: "Rubik_700Bold" }]}>
            {moduleNum}
          </Text>
        </View>
        <Text
          style={[
            styles.moduleQuoteText,
            { color: colors.text, fontFamily: "Rubik_500Medium" },
          ]}
        >
          {quote}
        </Text>
      </View>
      <View
        style={[styles.moduleDividerLine, { backgroundColor: mc.color + "40" }]}
      />
    </View>
  );
}

export default function PathScreen() {
  const { colors, colorScheme, themeMode } = useAppColors();
  const insets = useSafeAreaInsets();
  const {
    levels: allLevels,
    currentRank,
    setCurrentRank,
    portalCompleted,
  } = useGame();
  const { isOpenTestingEnabled } = useDevTools();
  const { t, lang } = useLang();
  const scrollRef = useRef<ScrollView>(null);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const scrollTopInset = topPad + 12;

  // Filter the path to the user's CURRENT rank — each rank is its own world.
  const rankBounds = RANKS_MODULAR[Math.max(0, Math.min(4, currentRank - 1))];
  const rankTheme = getRankTheme(currentRank);
  const levels = allLevels.filter(
    (l) =>
      l.module >= rankBounds.fromSection && l.module <= rankBounds.toSection,
  );
  const completedCount = levels.filter((l) => l.completed).length;
  const allDone = completedCount === levels.length;
  const portalDone = !!portalCompleted[currentRank];
  const portalStatus: "locked" | "available" | "completed" = portalDone
    ? "completed"
    : allDone
      ? "available"
      : "locked";

  const stepsBottomToTop: StepItem[] = [...levels]
    .sort((a, b) => a.levelNumber - b.levelNumber)
    .map((l) => ({
      id: l.id,
      levelNumber: l.levelNumber,
      title: l.title,
      subtitle: l.subtitle,
      icon: l.icon,
      status: l.status,
      tasksDone: l.tasks.filter((t) => t.status === "completed").length,
      color: l.color,
      colorDark: l.colorDark,
      module: l.module,
    }));

  const stepsTopToBottom = [...stepsBottomToTop].reverse();

  const renderItems: Array<{
    type: string;
    moduleNum?: number;
    step?: StepItem;
    globalIndex?: number;
    side?: "left" | "right";
    isLast?: boolean;
    key: string;
  }> = [];

  // The Final Portal is the rank-terminal "7th level" — it lives at the end
  // of the last module of the rank. Because the path renders top-to-bottom
  // (newest module first), the portal is the very first item in renderItems.
  const lastModule = rankBounds.toSection;
  if (MODULE_COLORS[lastModule]) {
    renderItems.push({
      type: "divider",
      moduleNum: lastModule,
      key: `div_${lastModule}`,
    });
  }
  renderItems.push({ type: "portal", key: `portal_${currentRank}` });

  let currentModule = lastModule;
  let gIdx = 0;
  for (const item of stepsTopToBottom) {
    if (item.module !== currentModule) {
      if (MODULE_COLORS[item.module]) {
        renderItems.push({
          type: "divider",
          moduleNum: item.module,
          key: `div_${item.module}`,
        });
      }
      currentModule = item.module;
    }
    const origIdx = stepsBottomToTop.length - 1 - gIdx;
    const side = getSide(origIdx);
    renderItems.push({
      type: "step",
      step: item,
      globalIndex: gIdx,
      side,
      isLast: gIdx === stepsTopToBottom.length - 1,
      key: item.id,
    });
    gIdx++;
  }

  const activeKey = renderItems.find(
    (ri) => ri.type === "step" && ri.step?.status === "available",
  )?.key;

  const itemYRef = useRef<Record<string, number>>({});
  const lastScrolledCount = useRef(-1);

  const scrollToY = useCallback(
    (y: number) => {
      scrollRef.current?.scrollTo({
        y: Math.max(0, y - scrollTopInset),
        animated: true,
      });
    },
    [scrollTopInset],
  );

  const scrollToActive = useCallback(
    (force: boolean) => {
      if (isOpenTestingEnabled) return;
      if (!activeKey) return;
      if (!force && lastScrolledCount.current === completedCount) return;
      const tryScroll = (attempt: number) => {
        const y = itemYRef.current[activeKey];
        if (typeof y === "number") {
          lastScrolledCount.current = completedCount;
          scrollToY(y);
        } else if (attempt < 8) {
          setTimeout(() => tryScroll(attempt + 1), 80);
        }
      };
      tryScroll(0);
    },
    [activeKey, completedCount, scrollToY, isOpenTestingEnabled],
  );

  useFocusEffect(
    useCallback(() => {
      lastScrolledCount.current = -1;
      scrollToActive(true);
    }, [scrollToActive]),
  );

  const [scrollY, setScrollY] = useState(0);
  const [viewportH, setViewportH] = useState(0);
  // Bumped each time a new item Y is measured, so the visible-section
  // computation re-runs once the layout pass finishes for new rows.
  const [measureTick, setMeasureTick] = useState(0);
  const fabAnim = useSharedValue(0);

  const firstStepModule = stepsTopToBottom[0]?.module ?? 1;
  const probeY = scrollY + scrollTopInset + 24;
  let visibleSectionNum = firstStepModule;
  for (let i = 0; i < renderItems.length; i++) {
    const ri = renderItems[i];
    const y = itemYRef.current[ri.key];
    if (typeof y !== "number") continue;
    if (y <= probeY) {
      if (ri.type === "step" && ri.step) visibleSectionNum = ri.step.module;
      else if (ri.type === "divider" && ri.moduleNum)
        visibleSectionNum = ri.moduleNum;
    } else {
      break;
    }
  }
  // Tint anchor = lowest-numbered module that still has ANY step visible
  // in the scroll viewport. As long as the current module's last step
  // (vocabulary, top of the module group visually) is still on screen,
  // the tint stays locked. The color only starts transitioning once the
  // whole module has scrolled off the bottom of the viewport.
  const STEP_ROW_APPROX = 96;
  let tintAnchorModule: number | null = null;
  if (viewportH > 0) {
    const visibleTop = scrollY + scrollTopInset;
    const visibleBottom = scrollY + viewportH;
    for (const ri of renderItems) {
      if (ri.type !== "step" || !ri.step) continue;
      const y = itemYRef.current[ri.key];
      if (typeof y !== "number") continue;
      const bottom = y + STEP_ROW_APPROX;
      const isVisible = bottom > visibleTop && y < visibleBottom;
      if (!isVisible) continue;
      if (tintAnchorModule === null || ri.step.module < tintAnchorModule) {
        tintAnchorModule = ri.step.module;
      }
    }
  }
  if (tintAnchorModule === null) tintAnchorModule = visibleSectionNum;
  // Reference measureTick so the React Compiler doesn't strip the dependency.
  void measureTick;

  // Tactile "lock-in" — when the tint anchor module flips (i.e. the
  // previous module has fully scrolled off the viewport), fire a chunky
  // double-tap haptic so the player physically feels they've "snapped"
  // onto the next module. Discourages aimlessly skimming between
  // modules; rewards committing to one. Native only (no web vibration).
  const lockHapticPrevRef = useRef<number | null>(null);
  useEffect(() => {
    if (rankTheme.index !== 1) return;
    const prev = lockHapticPrevRef.current;
    if (prev !== null && prev !== tintAnchorModule) {
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
        setTimeout(() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(
            () => {},
          );
        }, 70);
      }
    }
    lockHapticPrevRef.current = tintAnchorModule;
  }, [tintAnchorModule, rankTheme.index]);
  const recordItemY = useCallback((key: string, y: number) => {
    if (itemYRef.current[key] === y) return;
    itemYRef.current[key] = y;
    setMeasureTick((n) => (n + 1) % 1000000);
  }, []);

  const activeY = activeKey ? itemYRef.current[activeKey] : undefined;
  const ROW_H = 80;
  let direction: "up" | "down" | null = null;
  if (
    !isOpenTestingEnabled &&
    activeKey &&
    typeof activeY === "number" &&
    viewportH > 0
  ) {
    const topVisible = scrollY + scrollTopInset;
    const bottomVisible = scrollY + viewportH - 120;
    if (activeY + ROW_H < topVisible) direction = "up";
    else if (activeY > bottomVisible) direction = "down";
  }
  const showFab = direction !== null;

  useEffect(() => {
    fabAnim.value = withTiming(showFab ? 1 : 0, { duration: 180 });
  }, [showFab, fabAnim]);

  const fabStyle = useAnimatedStyle(() => ({
    opacity: fabAnim.value,
    transform: [{ scale: 0.85 + fabAnim.value * 0.15 }],
  }));

  const onFabPress = useCallback(() => {
    if (typeof activeY !== "number") return;
    if (Platform.OS !== "web") {
      Haptics.selectionAsync().catch(() => {});
    }
    lastScrolledCount.current = -1;
    scrollToY(activeY);
  }, [activeY, scrollToY]);

  // Throttle scroll → React state updates. Native scroll itself stays
  // 60fps (driven by the platform); we only re-render the JS tree when
  // the scroll position has moved enough to potentially change the
  // tint anchor module. A 40px threshold is well under one step row
  // (~100px) so the anchor still flips on time, but cuts re-renders
  // by ~10× during a fling — which is the main cause of device heat.
  const lastReportedYRef = useRef(0);
  const onScrollEvt = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y;
      if (Math.abs(y - lastReportedYRef.current) < 40) return;
      lastReportedYRef.current = y;
      setScrollY(y);
    },
    [],
  );
  const onScrollEndEvt = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y;
      lastReportedYRef.current = y;
      setScrollY(y);
    },
    [],
  );
  const onSvLayout = useCallback((e: LayoutChangeEvent) => {
    setViewportH(e.nativeEvent.layout.height);
  }, []);

  const handlePortalPress = useCallback(() => {
    if (portalStatus === "locked") return;
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {},
      );
    }
    // If the user already finished the interview but never advanced (e.g.
    // they backed out of the rank-up screen), let them resume directly at
    // the rank-up CTA so progression can never get stranded.
    if (portalStatus === "completed") {
      router.push("/rank-up");
      return;
    }
    router.push("/portal-interview");
  }, [portalStatus]);

  const rank1BaseBg = themeMode === "dark" ? "#07070A" : "#FAFAFC";
  const containerBg = PATH_LANDSCAPE_BG_EXPERIMENT
    ? "transparent"
    : rankTheme.index === 1
      ? rank1BaseBg
      : rankTheme.bgColors[0];
  // Rank 1 tint follows the module the user is currently looking at, but
  // only when that module has been visited (completed or currently active).
  // Locked modules above show a clean theme background (no tint at all).
  // Yellow `#FFD166` is replaced with a richer amber that doesn't read as
  // muddy on dark.
  const RANK1_YELLOW_REPLACEMENT = "#F5A623";
  const rank1ActiveModule = Math.min(
    rankBounds.toSection,
    Math.max(rankBounds.fromSection, tintAnchorModule || rankBounds.fromSection),
  );
  const rawRank1Color = MODULE_COLORS[rank1ActiveModule]?.color;
  const rank1Tint: string | null =
    !PATH_LANDSCAPE_BG_EXPERIMENT && rankTheme.index === 1
      ? rawRank1Color === "#FFD166"
        ? RANK1_YELLOW_REPLACEMENT
        : (rawRank1Color ?? rankTheme.accent)
      : null;

  return (
    <View style={[styles.container, { backgroundColor: containerBg }]}>
      {PATH_LANDSCAPE_BG_EXPERIMENT ? (
        <PathPaintingBackground themeMode={themeMode} />
      ) : (
        <RankBackground
          theme={rankTheme}
          themeMode={themeMode}
          tintColor={rank1Tint}
        />
      )}
      {isOpenTestingEnabled && (
        <View
          style={[
            styles.devRankSwitcher,
            { top: topPad + 4, backgroundColor: rankTheme.accent + "E6" },
          ]}
          pointerEvents="box-none"
        >
          <Pressable
            onPress={() => {
              if (currentRank <= 1) return;
              if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
              setCurrentRank(currentRank - 1);
            }}
            disabled={currentRank <= 1}
            accessibilityRole="button"
            accessibilityLabel="Previous rank"
            testID="dev-rank-prev"
            hitSlop={8}
            style={[styles.devRankBtn, { opacity: currentRank <= 1 ? 0.35 : 1 }]}
          >
            <Ionicons name="chevron-back" size={16} color="#fff" />
          </Pressable>
          <View style={styles.devRankLabelCol}>
            <Text style={[styles.devRankKicker, { fontFamily: "Rubik_600SemiBold" }]}>
              DEV · RANK
            </Text>
            <Text style={[styles.devRankValue, { fontFamily: "Rubik_700Bold" }]}>
              {currentRank} / 5 ·{" "}
              {t(getRankForSection(rankBounds.fromSection).nameKey as any)}
            </Text>
          </View>
          <Pressable
            onPress={() => {
              if (currentRank >= 5) return;
              if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
              setCurrentRank(currentRank + 1);
            }}
            disabled={currentRank >= 5}
            accessibilityRole="button"
            accessibilityLabel="Next rank"
            testID="dev-rank-next"
            hitSlop={8}
            style={[styles.devRankBtn, { opacity: currentRank >= 5 ? 0.35 : 1 }]}
          >
            <Ionicons name="chevron-forward" size={16} color="#fff" />
          </Pressable>
        </View>
      )}

      <ScrollView
        ref={scrollRef}
        onContentSizeChange={() => {
          if (!isOpenTestingEnabled) scrollToActive(false);
        }}
        onScroll={onScrollEvt}
        onScrollEndDrag={onScrollEndEvt}
        onMomentumScrollEnd={onScrollEndEvt}
        scrollEventThrottle={64}
        onLayout={onSvLayout}
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: scrollTopInset, paddingBottom: bottomPad + 110 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {renderItems.map((ri) => {
          if (ri.type === "divider") {
            return (
              <View
                key={ri.key}
                onLayout={(e) => {
                  recordItemY(ri.key, e.nativeEvent.layout.y);
                }}
              >
                <ModuleDivider
                  moduleNum={ri.moduleNum ?? 1}
                  colors={colors}
                  lang={lang}
                />
              </View>
            );
          }
          if (ri.type === "portal") {
            return (
              <View
                key={ri.key}
                onLayout={(e) => {
                  recordItemY(ri.key, e.nativeEvent.layout.y);
                }}
              >
                <View style={styles.portalRow}>
                  <FinalPortal
                    theme={rankTheme}
                    status={portalStatus}
                    onPress={handlePortalPress}
                    testID="rank-final-portal"
                  />
                </View>
                <View style={styles.connectorRow}>
                  <View
                    style={[
                      styles.connectorLine,
                      {
                        borderColor:
                          portalStatus === "available"
                            ? rankTheme.accent
                            : portalStatus === "completed"
                              ? rankTheme.accent + "80"
                              : colors.border,
                      },
                    ]}
                  />
                </View>
              </View>
            );
          }
          const item = ri.step;
          if (!item) return null;
          const side = ri.side ?? "right";
          const isLast = ri.isLast ?? false;
          const idx = ri.globalIndex ?? 0;
          return (
            <View
              key={ri.key}
              onLayout={(e) => {
                recordItemY(ri.key, e.nativeEvent.layout.y);
              }}
            >
              <View
                style={[
                  styles.stepRow,
                  {
                    justifyContent:
                      side === "right" ? "flex-end" : "flex-start",
                  },
                ]}
              >
                <StepBlock
                  item={item}
                  index={idx}
                  totalDone={completedCount}
                  colors={colors}
                  isNaturallyAvailable={ri.key === activeKey}
                  rankTheme={rankTheme}
                />
              </View>

              {!isLast && (
                <View
                  style={[
                    styles.connectorRow,
                    {
                      justifyContent:
                        side === "right" ? "flex-end" : "flex-start",
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.connectorLine,
                      {
                        borderColor:
                          item.status === "completed"
                            ? item.color
                            : item.status === "available"
                              ? item.color + "80"
                              : colors.border,
                      },
                    ]}
                  />
                </View>
              )}
            </View>
          );
        })}

        <View style={styles.bottomHint}>
          <Ionicons
            name="arrow-up-outline"
            size={14}
            color={colors.textMuted}
          />
          <Text
            style={[
              styles.bottomHintText,
              { color: colors.textMuted, fontFamily: "Rubik_400Regular" },
            ]}
          >
            {t("startFromBottom")}
          </Text>
        </View>
      </ScrollView>

      <Animated.View
        pointerEvents={showFab ? "auto" : "none"}
        style={[
          styles.fab,
          {
            bottom: bottomPad + 90,
            backgroundColor:
              colorScheme === "dark"
                ? "rgba(255,255,255,0.18)"
                : "rgba(15,18,32,0.55)",
          },
          fabStyle,
        ]}
      >
        <Pressable
          onPress={onFabPress}
          accessibilityRole="button"
          accessibilityLabel={t("tabPath")}
          style={styles.fabPress}
        >
          <Ionicons
            name={direction === "up" ? "chevron-up" : "chevron-down"}
            size={22}
            color="#FFFFFF"
          />
        </Pressable>
      </Animated.View>
    </View>
  );
}

const STEP_W = 230;
const STEP_H = 72;

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 20, gap: 0 },
  portalRow: { alignItems: "center", marginBottom: 0 },
  verticalLine: {
    width: 2,
    height: 24,
    alignSelf: "center",
    borderRadius: 1,
    marginVertical: 0,
  },
  moduleDivider: {
    alignItems: "center",
    marginVertical: 12,
    gap: 8,
  },
  moduleDividerLine: {
    width: 2,
    height: 16,
    borderRadius: 1,
  },
  moduleQuoteCard: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    gap: 8,
    overflow: "hidden",
    width: "90%",
  },
  moduleNumBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  moduleNumText: {
    fontSize: 14,
    color: "#fff",
  },
  moduleQuoteText: {
    fontSize: 14,
    textAlign: "center",
    fontStyle: "italic",
    lineHeight: 20,
  },
  stepRow: {
    flexDirection: "row",
    marginVertical: 0,
  },
  stepOuter: {
    position: "relative",
    width: STEP_W,
    paddingBottom: 6,
  },
  step3dSide: {
    position: "absolute",
    bottom: 0,
    left: 3,
    right: 3,
    height: 14,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    zIndex: 0,
  },
  stepFace: {
    width: STEP_W,
    height: STEP_H,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    gap: 10,
    overflow: "hidden",
    shadowColor: "rgba(0,0,0,0.25)",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
    zIndex: 1,
  },
  stepHighlight: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "45%",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  stepShadowOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "50%",
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
  },
  stepLeft: { alignItems: "center", justifyContent: "center" },
  stepIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  stepCenter: { flex: 1, gap: 3 },
  stepTitle: { fontSize: 14 },
  stepSub: { fontSize: 11 },
  pips: { flexDirection: "row", gap: 4, marginTop: 2 },
  pip: { width: 7, height: 7, borderRadius: 4 },
  stepRight: { alignItems: "center", justifyContent: "center" },
  levelNumBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  levelNumText: { fontSize: 12 },
  connectorRow: {
    flexDirection: "row",
    height: 28,
    paddingHorizontal: STEP_W * 0.2,
  },
  connectorLine: {
    width: 2,
    height: 28,
    borderLeftWidth: 2,
    borderStyle: "dashed",
  },
  bottomHint: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 28,
  },
  bottomHintText: { fontSize: 13 },
  fab: {
    position: "absolute",
    right: 16,
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  fabPress: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 26,
  },
  devRankSwitcher: {
    position: "absolute",
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    zIndex: 20,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },
  devRankBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  devRankLabelCol: {
    alignItems: "center",
    minWidth: 120,
  },
  devRankKicker: {
    fontSize: 9,
    color: "rgba(255,255,255,0.85)",
    letterSpacing: 1.2,
  },
  devRankValue: {
    fontSize: 12,
    color: "#fff",
    letterSpacing: 0.3,
  },
});
