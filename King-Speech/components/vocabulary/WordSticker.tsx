import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { ZoomIn } from "react-native-reanimated";
import { useTheme } from "@/context/ThemeContext";

/**
 * A synonym "sticker" (Figma «Word · найдено» / «Word · не разгадано»):
 * a tilted card dropped onto the board. Found ones are cream with a gold
 * order badge; un-guessed ones (hint) are dark with a dashed rim and the
 * first letters only.
 */
export type StickerSize = "large" | "compact" | "hint";

const SIZE: Record<StickerSize, { h: number; word: number; pts: number; padX: number; badge: number; badgeFont: number }> = {
  large: { h: 72, word: 24, pts: 11, padX: 17, badge: 28, badgeFont: 13 },
  compact: { h: 58, word: 19, pts: 10, padX: 15, badge: 24, badgeFont: 12 },
  hint: { h: 52, word: 18, pts: 10, padX: 15, badge: 24, badgeFont: 12 },
};

export default function WordSticker({
  word,
  found,
  order,
  size,
  cx,
  cy,
  rotate,
  boxW,
  animate = true,
}: {
  word: string;
  found: boolean;
  /** 1-based order in which the word was found (badge). */
  order?: number;
  size: StickerSize;
  /** Centre of the card inside the board. */
  cx: number;
  cy: number;
  rotate: number;
  /** Board width — the card is clamped inside it. */
  boxW: number;
  animate?: boolean;
}) {
  const { themeMode } = useTheme();
  const isDark = themeMode === "dark";
  const s = SIZE[size];
  const [w, setW] = useState(0);
  const h = found ? s.h : s.h - 2;
  const left = w ? Math.max(8, Math.min(boxW - w - 16, cx - w / 2)) : cx;

  const card = found
    ? {
        backgroundColor: isDark ? "#F0EEE9" : "#FFFFFF",
        borderColor: isDark ? "#CCCAC6" : "rgba(38,38,40,0.14)",
        borderStyle: "solid" as const,
      }
    : {
        backgroundColor: isDark ? "#464647" : "rgba(38,38,40,0.06)",
        borderColor: isDark ? "rgba(240,238,233,0.35)" : "rgba(38,38,40,0.28)",
        borderStyle: "dashed" as const,
      };

  return (
    <View pointerEvents="none" style={{ position: "absolute", left, top: cy - h / 2, opacity: w ? 1 : 0 }}>
      <Animated.View entering={animate ? ZoomIn.duration(260) : undefined}>
        <View
          onLayout={(e) => setW(e.nativeEvent.layout.width)}
          style={[
            styles.card,
            card,
            { height: h, paddingHorizontal: s.padX, transform: [{ rotate: `${rotate}deg` }] },
          ]}
        >
          {found ? <Text style={[styles.pts, { fontSize: s.pts }]}>+3 очка</Text> : null}
          <Text
            numberOfLines={1}
            style={[
              styles.word,
              {
                fontSize: s.word,
                letterSpacing: -s.word * 0.005,
                color: found ? "#262628" : isDark ? "rgba(240,238,233,0.55)" : "rgba(38,38,40,0.5)",
              },
            ]}
          >
            {word}
          </Text>
          {found && order ? (
            <View
              style={[
                styles.badge,
                {
                  width: s.badge,
                  height: s.badge,
                  borderRadius: s.badge / 2,
                  top: -(s.badge / 2) + 1,
                  right: -(s.badge / 2) + 3,
                },
              ]}
            >
              <Text style={[styles.badgeText, { fontSize: s.badgeFont }]}>{order}</Text>
            </View>
          ) : null}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 2, borderRadius: 22, justifyContent: "center" },
  pts: { fontFamily: "Geologica_700Bold", color: "rgba(38,38,40,0.5)", marginBottom: -1 },
  word: { fontFamily: "Geologica_700Bold" },
  badge: {
    position: "absolute",
    backgroundColor: "#FFD857",
    borderWidth: 4,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { fontFamily: "Geologica_900Black", color: "#262628" },
});
