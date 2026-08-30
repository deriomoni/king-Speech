import React, { useEffect, useRef, useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
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
  useAnimatedScrollHandler,
  withTiming,
  withRepeat,
  withDelay,
  cancelAnimation,
  runOnJS,
  type SharedValue,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
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
import { getModuleName } from "@/constants/showtimeLoader";
import { useAppColors } from "@/hooks/useAppColors";
import { useDevTools } from "@/context/DevToolsContext";
import { PathGradientBackground } from "@/components/path/PathGradientBackground";
import { PathPatternBackground } from "@/components/path/PathPatternBackground";
import { getPathColors, darkenHex, readableText } from "@/constants/pathPalette";
import FinalPortal from "@/components/path/FinalPortal";
import { getRankTheme } from "@/components/path/rankTheme";
import PathScrubber from "@/components/path/PathScrubber";

function GlowRing({ color, radius }: { color: string; radius: number }) {
  // Soft, breathing halo behind the active tile. Rendered as a filled tile-
  // sized view whose colored shadow bleeds out on all sides — no hard border,
  // just a gentle diffuse glow that pulses in and out.
  const opacity = useSharedValue(0.5);
  useEffect(() => {
    opacity.value = withRepeat(withTiming(0.95, { duration: 1500 }), -1, true);
    return () => {
      cancelAnimation(opacity);
    };
  }, []);
  const s = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.glow,
        s,
        {
          borderRadius: radius,
          backgroundColor: color,
          boxShadow: `0px 0px 26px 8px ${color}`,
        },
      ]}
    />
  );
}

// Scroll-driven perspective wrapper. Rows near the vertical center of the
// viewport render at full size; rows toward the top/bottom edges shrink, fade,
// and tilt slightly — so as the player swipes, tiles leaving the center recede
// in perspective and the focused tiles pop forward.
function AnimatedRow({
  scrollY,
  viewportH,
  onLayoutY,
  children,
}: {
  scrollY: SharedValue<number>;
  viewportH: number;
  onLayoutY: (y: number) => void;
  children: React.ReactNode;
}) {
  const y = useSharedValue(0);
  const h = useSharedValue(0);
  const aStyle = useAnimatedStyle(() => {
    if (viewportH <= 0 || h.value <= 0) return {};
    const center = y.value + h.value / 2;
    const viewportCenter = scrollY.value + viewportH / 2;
    const norm = (center - viewportCenter) / (viewportH / 2);
    const dist = Math.min(Math.abs(norm), 1);
    // The middle band (~4 rows around the focus) stays fully opaque and
    // full size; only tiles near the very top/bottom edges recede. This keeps
    // the level names bright and readable instead of looking ghostly.
    const DEAD = 0.55;
    const raw = dist <= DEAD ? 0 : (dist - DEAD) / (1 - DEAD);
    // Smoothstep easing → gentle, fluid falloff (no linear popping).
    // Opacity-only: geometric transforms (scale/rotate/perspective) were
    // removed so the snake thread between tiles never visually disconnects
    // at the screen edges, and the per-frame cost stays minimal.
    const t = raw * raw * (3 - 2 * raw);
    const opacity = 1 - t * 0.12;
    return { opacity };
  }, [viewportH]);
  return (
    <Animated.View
      style={aStyle}
      onLayout={(e) => {
        y.value = e.nativeEvent.layout.y;
        h.value = e.nativeEvent.layout.height;
        onLayoutY(e.nativeEvent.layout.y);
      }}
    >
      {children}
    </Animated.View>
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

function SnakeConnector({
  fromSide,
  toSide,
  color,
}: {
  fromSide: "left" | "right" | "center";
  toSide: "left" | "right" | "center";
  color: string;
}) {
  const [w, setW] = useState(0);
  const H = 30;
  const pos = (s: "left" | "right" | "center") =>
    s === "right" ? w - STEP_W / 2 : s === "left" ? STEP_W / 2 : w / 2;
  const sx = pos(fromSide);
  const ex = pos(toSide);
  const d = `M ${sx} 0 C ${sx} ${H * 0.55}, ${ex} ${H * 0.45}, ${ex} ${H}`;
  return (
    <View
      style={{ width: "100%", height: H }}
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
    >
      {w > 0 && (
        <Svg width={w} height={H}>
          <Path
            d={d}
            stroke={color}
            strokeWidth={3}
            strokeLinecap="round"
            fill="none"
          />
        </Svg>
      )}
    </View>
  );
}

function StepBlock({
  item,
  index,
  totalDone,
  colors,
  isNaturallyAvailable,
  rankTheme,
  themeMode,
}: {
  item: StepItem;
  index: number;
  totalDone: number;
  colors: import("@/constants/colors").AppColors;
  isNaturallyAvailable: boolean;
  rankTheme: import("@/components/path/rankTheme").RankTheme;
  themeMode: import("@/context/ThemeContext").ThemeMode;
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
  const isDark = themeMode === "dark";

  // Skip entry animation for: completed rows, rows beyond the first few,
  // and any row that is only "available" because of the Open Testing override
  // (otherwise the calm Path turns into a stagger storm of 335 animations).
  const isOverridden = isOpenTestingEnabled && item.status === "locked";
  const animateEntry = !isDone && !isOverridden && index < ENTRY_ANIM_MAX;

  // Entry animation is opacity-only: scale/translate transforms would detach
  // the tile from the snake thread during mount and can leave the tile
  // rasterized/blurry on web.
  const entryOpacity = useSharedValue(animateEntry ? 0 : 1);

  useEffect(() => {
    if (!animateEntry) return;
    const delay = index * 40;
    entryOpacity.value = withDelay(delay, withTiming(1, { duration: 260 }));
    return () => {
      cancelAnimation(entryOpacity);
    };
  }, []);

  const entryStyle = useAnimatedStyle(() => ({
    opacity: entryOpacity.value,
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
  // Ink adapts to the brick's lightness so text/icons read on any palette tile.
  const onFace = readableText(faceColor);
  const textColor = isLocked ? "#A0A0B0" : onFace;
  const iconColor = isLocked ? "#B0B0C0" : onFace;

  const gradTop = isDone
    ? lightenColor(levelColor, 18)
    : isAvail
      ? lightenColor(levelColor, 22)
      : "#F2F2F6";
  const gradBot = faceColor;

  // Press feedback is a plain opacity dim (see the Pressable style below).
  // Transform-based press animations (translate/scale) rasterize the tile on
  // web and leave it blurry/pixelated after the spring settles, so they were
  // removed.
  const handlePressIn = () => {
    if (isLocked) return;
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    } else {
      try {
        (navigator as any).vibrate?.(20);
      } catch {}
    }
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
      {showGlow && <GlowRing color={levelColor} radius={shapeR} />}

      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        disabled={isLocked}
        accessibilityRole="button"
        accessibilityLabel={`${item.title}`}
        style={({ pressed }) => [
          styles.stepOuter,
          pressed && !isLocked && { opacity: 0.82 },
        ]}
      >
        <View style={[styles.stepFace, { borderRadius: shapeR }]}>
          {/* Solid color fill — flat, no glass, no gradient. */}
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              { borderRadius: shapeR, backgroundColor: faceColor },
            ]}
          />

          <View style={styles.stepLeft}>
            {isLocked ? (
              <Ionicons name="lock-closed" size={20} color={iconColor} />
            ) : isDone ? (
              <Ionicons name="checkmark" size={22} color={iconColor} />
            ) : (
              <Ionicons name={item.icon as any} size={22} color={iconColor} />
            )}
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
                  color: isLocked
                    ? "#B8B8C8"
                    : onFace === "#FFFFFF"
                      ? "rgba(255,255,255,0.78)"
                      : "rgba(26,26,46,0.62)",
                  fontFamily: rankTheme.fontFamily,
                },
              ]}
              numberOfLines={item.id?.startsWith("reading") ? 2 : 1}
              adjustsFontSizeToFit={item.id?.startsWith("reading")}
              minimumFontScale={0.7}
            >
              {item.subtitle}
            </Text>
          </View>
        </View>
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
      {/* No box, no colored number circle, no vertical dashes — just the module
          number and text on the Path background. */}
      <Text style={[styles.moduleNumText, { color: mc.color, fontFamily: "Rubik_700Bold" }]}>
        {moduleNum}
      </Text>
      {lang === "ru" && getModuleName(moduleNum) ? (
        <Text
          style={{
            color: colors.text,
            fontFamily: "Rubik_700Bold",
            fontSize: 16,
            textAlign: "center",
          }}
        >
          {getModuleName(moduleNum)}
        </Text>
      ) : null}
      <Text
        style={[
          styles.moduleQuoteText,
          { color: colors.text, fontFamily: "Rubik_500Medium" },
        ]}
      >
        {quote}
      </Text>
    </View>
  );
}

export default function PathScreen() {
  const { colors, colorScheme, themeMode } = useAppColors();
  const isDark = themeMode === "dark";
  const insets = useSafeAreaInsets();
  const {
    levels: allLevels,
    currentRank,
    setCurrentRank,
    portalCompleted,
  } = useGame();
  const { isOpenTestingEnabled } = useDevTools();
  const { t, lang } = useLang();
  const scrollRef = useRef<React.ComponentRef<typeof Animated.ScrollView>>(null);

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
    .map((l) => {
      // Tile ("brick") colour comes from the curated Path palette, per module.
      const brick = getPathColors(l.module, isDark).brick;
      return {
        id: l.id,
        levelNumber: l.levelNumber,
        title: l.title,
        subtitle: l.subtitle,
        icon: l.icon,
        status: l.status,
        tasksDone: l.tasks.filter((t) => t.status === "completed").length,
        color: brick,
        colorDark: darkenHex(brick, 0.3),
        module: l.module,
      };
    });

  const stepsTopToBottom = [...stepsBottomToTop].reverse();

  const renderItems: Array<{
    type: string;
    moduleNum?: number;
    step?: StepItem;
    globalIndex?: number;
    side?: "left" | "right";
    toSide?: "left" | "right" | "center";
    isLast?: boolean;
    /** True when the next row is a module divider — suppress the dangling thread. */
    nextIsDivider?: boolean;
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

  // Point each connector's snake thread at the row that immediately follows it,
  // so it curves toward the next step's side (or the centered divider/portal
  // card when a module boundary comes next).
  const rowSide = (
    r: (typeof renderItems)[number],
  ): "left" | "right" | "center" => (r.type === "step" ? r.side ?? "right" : "center");
  for (let i = 0; i < renderItems.length; i++) {
    const r = renderItems[i];
    if (r.type !== "step" && r.type !== "portal") continue;
    const next = renderItems[i + 1];
    if (next) r.toSide = rowSide(next);
    // A module boundary (divider next, or end of list) has no brick to connect
    // to — mark it so the connector isn't drawn as a dangling stub.
    r.nextIsDivider = !next || next.type === "divider";
  }

  const activeStep = renderItems.find(
    (ri) => ri.type === "step" && ri.step?.status === "available",
  )?.step;
  const activeKey = activeStep?.id;

  // The module the active level belongs to — the default anchor for the
  // background gradient (see the bgModule computation further down, after the
  // in-view module is known).
  const activeModule = activeStep?.module ?? rankBounds.toSection;

  const itemYRef = useRef<Record<string, number>>({});
  const lastScrolledCount = useRef(-1);
  // While true, the map keeps itself pinned to the active step. Set on every
  // focus and held until the player grabs the scroll themselves — this is what
  // makes the map land on the current module instead of being bounced back to
  // the top by the tall content's late layout passes (fonts/images reflowing).
  const autoPinRef = useRef(true);


  const scrollToY = useCallback(
    (y: number) => {
      scrollRef.current?.scrollTo({
        y: Math.max(0, y - scrollTopInset),
        animated: true,
      });
    },
    [scrollTopInset],
  );

  // Raw, un-animated scroll for the drag scrubber (absolute content offset).
  const scrubScrollTo = useCallback((y: number) => {
    scrollRef.current?.scrollTo({ y: Math.max(0, y), animated: false });
  }, []);

  const scrollToActive = useCallback(
    (force: boolean, animated: boolean = true) => {
      if (isOpenTestingEnabled) return;
      if (!activeKey) return;
      if (!force && lastScrolledCount.current === completedCount) return;
      const tryScroll = (attempt: number) => {
        const y = itemYRef.current[activeKey];
        if (typeof y === "number") {
          lastScrolledCount.current = completedCount;
          scrollRef.current?.scrollTo({
            y: Math.max(0, y - scrollTopInset),
            animated,
          });
        } else if (attempt < 12) {
          setTimeout(() => tryScroll(attempt + 1), 80);
        }
      };
      tryScroll(0);
    },
    [activeKey, completedCount, scrollTopInset, isOpenTestingEnabled],
  );

  useFocusEffect(
    useCallback(() => {
      // Entering the map: re-enable pinning and jump straight to the current
      // module (instant, no long animation across the whole ladder).
      autoPinRef.current = true;
      lastScrolledCount.current = -1;
      scrollToActive(true, false);
    }, [scrollToActive]),
  );

  const [scrollY, setScrollY] = useState(0);
  const [viewportH, setViewportH] = useState(0);
  const scrollYSV = useSharedValue(0);
  const lastReportedSV = useSharedValue(0);
  const [contentH, setContentH] = useState(0);
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

  // --- Path background (one flat theme color) -------------------------------
  // The ladder sits on the app's own background: light in the light theme,
  // dark in the dark theme, the same on every module. The per-module palette
  // no longer paints the background at all — only the level bricks still carry
  // their module's color.
  //
  // `bgModule` is still tracked, because it anchors the symbol pattern layer
  // (currently switched off, see PATH_PATTERN_BG) and drives the lock-in haptic
  // just below.
  //   • Normal play: pinned to the ACTIVE level's module.
  //   • Open Testing: follows the module currently IN VIEW, so a tester can
  //     scroll the map and watch the anchor move.
  const bgModule = isOpenTestingEnabled ? tintAnchorModule : activeModule;
  const curBgColor = colors.background;

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

  // Keep the view glued to the active step while auto-pin is on. The tall map
  // reflows several times after mount (fonts, step images, divider layout); each
  // reflow changes the active step's measured Y, and without this the content
  // would settle back near the top. Instant scroll = no visible bounce. Once the
  // player drags the map themselves we stop pinning (see onScrollBeginDrag).
  useEffect(() => {
    if (!autoPinRef.current || isOpenTestingEnabled) return;
    if (typeof activeY !== "number") return;
    scrollRef.current?.scrollTo({
      y: Math.max(0, activeY - scrollTopInset),
      animated: false,
    });
  }, [activeY, scrollTopInset, isOpenTestingEnabled]);

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
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollYSV.value = e.contentOffset.y;
      const yy = e.contentOffset.y;
      if (Math.abs(yy - lastReportedSV.value) >= 40) {
        lastReportedSV.value = yy;
        runOnJS(setScrollY)(yy);
      }
    },
  });
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
    // Jenny's interview was removed from the game, so the portal no longer
    // gates on it — pressing an unlocked portal goes straight to the rank-up
    // screen where the player advances to the next rank.
    router.push("/rank-up");
  }, [portalStatus]);

  // Base color under the full-screen background layer — only visible for the
  // split second before it mounts, so it uses the very same token and there is
  // nothing to flash between the two.
  const containerBg = colors.background;

  return (
    <View style={[styles.container, { backgroundColor: containerBg }]}>
      <PathGradientBackground color={curBgColor} themeMode={themeMode} />
      <PathPatternBackground moduleNum={bgModule} bg={curBgColor} />
      {isOpenTestingEnabled && (
        <>
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
        {/* Background preview readout — in Open Testing the background follows
            the module currently in view, so scrolling the map cycles through
            every module's color. */}
        <View
          style={[
            styles.devBgReadout,
            { top: topPad + 50 },
          ]}
          pointerEvents="none"
        >
          <Text
            style={[styles.devRankKicker, { fontFamily: "Rubik_600SemiBold" }]}
          >
            DEV · МОДУЛЬ · прокрути карту
          </Text>
          <View style={styles.devBgReadoutRow}>
            {/* The background is one flat theme color now, so the swatch shows
                the module's BRICK color — the only part of the palette the
                Path still uses. */}
            <View
              style={[
                styles.devBgSwatch,
                { backgroundColor: getPathColors(bgModule, isDark).brick },
              ]}
            />
            <Text
              style={[styles.devRankValue, { fontFamily: "Rubik_700Bold" }]}
            >
              модуль {bgModule} · ступени{" "}
              {getPathColors(bgModule, isDark).brick}
            </Text>
          </View>
        </View>
        </>
      )}

      <Animated.ScrollView
        ref={scrollRef}
        onContentSizeChange={(_w, h) => {
          setContentH(h);
          // While pinning, force an instant re-pin to the active step as the
          // tall content settles. Afterwards keep the original completion-driven
          // (animated, guarded) scroll behavior.
          if (autoPinRef.current) scrollToActive(true, false);
          else scrollToActive(false);
        }}
        onScroll={scrollHandler}
        onScrollBeginDrag={() => {
          // Player took control of the scroll — stop auto-pinning so we don't
          // fight their dragging. Pinning resumes next time the map is focused.
          autoPinRef.current = false;
        }}
        onScrollEndDrag={onScrollEndEvt}
        onMomentumScrollEnd={onScrollEndEvt}
        scrollEventThrottle={16}
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
              <AnimatedRow
                key={ri.key}
                scrollY={scrollYSV}
                viewportH={viewportH}
                onLayoutY={(y) => recordItemY(ri.key, y)}
              >
                <ModuleDivider
                  moduleNum={ri.moduleNum ?? 1}
                  colors={colors}
                  lang={lang}
                />
              </AnimatedRow>
            );
          }
          if (ri.type === "portal") {
            return (
              <AnimatedRow
                key={ri.key}
                scrollY={scrollYSV}
                viewportH={viewportH}
                onLayoutY={(y) => recordItemY(ri.key, y)}
              >
                <View style={styles.portalRow}>
                  <FinalPortal
                    theme={rankTheme}
                    status={portalStatus}
                    onPress={handlePortalPress}
                    testID="rank-final-portal"
                  />
                </View>
                <SnakeConnector
                  fromSide="center"
                  toSide={ri.toSide ?? "right"}
                  color={
                    portalStatus === "available"
                      ? rankTheme.accent
                      : portalStatus === "completed"
                        ? rankTheme.accent + "AA"
                        : colors.border
                  }
                />
              </AnimatedRow>
            );
          }
          const item = ri.step;
          if (!item) return null;
          const side = ri.side ?? "right";
          const isLast = ri.isLast ?? false;
          const idx = ri.globalIndex ?? 0;
          return (
            <AnimatedRow
              key={ri.key}
              scrollY={scrollYSV}
              viewportH={viewportH}
              onLayoutY={(y) => recordItemY(ri.key, y)}
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
                  themeMode={themeMode}
                />
              </View>

              {!isLast && !ri.nextIsDivider && (
                <SnakeConnector
                  fromSide={side}
                  toSide={ri.toSide ?? (side === "right" ? "left" : "right")}
                  color={
                    item.status === "completed"
                      ? item.color
                      : item.status === "available"
                        ? item.color + "AA"
                        : colors.border
                  }
                />
              )}
            </AnimatedRow>
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
      </Animated.ScrollView>

      <PathScrubber
        contentH={contentH}
        viewportH={viewportH}
        scrollY={scrollY}
        topInset={scrollTopInset}
        bottomInset={bottomPad}
        accent={rankTheme.accent}
        dark={colorScheme === "dark"}
        onScrubTo={scrubScrollTo}
      />

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
            size={16}
            color="#FFFFFF"
          />
        </Pressable>
      </Animated.View>

    </View>
  );
}

const STEP_W = 212;
const STEP_H = 64;

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
    marginTop: 16,
    marginBottom: 36,
    gap: 6,
  },
  moduleDividerLine: {
    width: 2,
    height: 16,
    borderRadius: 1,
  },
  moduleQuoteCard: {
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    gap: 8,
    overflow: "hidden",
    width: "86%",
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
    paddingBottom: 0,
  },
  glow: {
    position: "absolute",
    top: 0,
    left: 0,
    width: STEP_W,
    height: STEP_H,
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
    zIndex: 1,
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
  bottomHint: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 28,
  },
  bottomHintText: { fontSize: 13 },
  illustrationCredit: { fontSize: 10, textAlign: "right", opacity: 0.55, marginTop: 12 },
  fab: {
    position: "absolute",
    right: 16,
    width: 38,
    height: 38,
    borderRadius: 19,
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
    borderRadius: 19,
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
  devBgReadout: {
    position: "absolute",
    alignSelf: "center",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    zIndex: 20,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
  },
  devBgReadoutRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  devBgSwatch: {
    width: 12,
    height: 12,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.5)",
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
