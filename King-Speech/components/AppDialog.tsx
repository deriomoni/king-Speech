import React from "react";
import { View, Text, StyleSheet, Pressable, Modal } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { useAppColors } from "@/hooks/useAppColors";

/**
 * AppDialog — the ONE shared design for every pop-up / splash confirm in the
 * app, so they all share the same frame shape and behaviour.
 *
 * - Theme-aware: light surface in light theme, dark surface in dark theme.
 * - No icons — clean title + optional message.
 * - Plain black-and-white buttons: `primary` is a solid ink fill, everything
 *   else is a neutral outline. No coloured/destructive tints.
 *
 * Use it instead of hand-rolling a <Modal> for confirmations.
 */
export type AppDialogButtonVariant = "primary" | "secondary";

export interface AppDialogButton {
  label: string;
  onPress: () => void;
  variant?: AppDialogButtonVariant;
}

export default function AppDialog({
  visible,
  title,
  message,
  buttons,
  onRequestClose,
  dismissOnBackdrop = true,
}: {
  visible: boolean;
  title: string;
  message?: string;
  buttons: AppDialogButton[];
  onRequestClose?: () => void;
  /** Tap outside the card to dismiss (calls onRequestClose). Default true. */
  dismissOnBackdrop?: boolean;
}) {
  const { colors, isDark } = useAppColors();

  const cardBg = colors.surface; // white in light theme, dark surface in dark
  const ink = isDark ? "#FFFFFF" : "#111114";
  const onInk = isDark ? "#111114" : "#FFFFFF";

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onRequestClose}>
      <Animated.View entering={FadeIn.duration(140)} style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={dismissOnBackdrop ? onRequestClose : undefined}
        />
        <Animated.View
          entering={FadeInDown.springify().damping(20).mass(0.7)}
          style={[styles.card, { backgroundColor: cardBg, borderColor: colors.border }]}
        >
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          {message ? (
            <Text style={[styles.message, { color: colors.textSecondary }]}>{message}</Text>
          ) : null}

          <View style={styles.btns}>
            {buttons.map((b, i) => {
              const primary = b.variant === "primary";
              return (
                <Pressable
                  key={i}
                  onPress={b.onPress}
                  style={({ pressed }) => [
                    styles.btn,
                    primary
                      ? { backgroundColor: ink }
                      : { backgroundColor: "transparent", borderWidth: 1.5, borderColor: colors.border },
                    { opacity: pressed ? 0.8 : 1 },
                  ]}
                >
                  <Text style={[styles.btnText, { color: primary ? onInk : colors.text }]}>
                    {b.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 24,
    borderWidth: 1,
    paddingTop: 26,
    paddingBottom: 18,
    paddingHorizontal: 22,
    alignItems: "center",
  },
  title: {
    fontSize: 19,
    lineHeight: 25,
    textAlign: "center",
    fontFamily: "Nunito_800ExtraBold",
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 8,
    fontFamily: "Nunito_400Regular",
  },
  btns: {
    flexDirection: "row",
    gap: 10,
    alignSelf: "stretch",
    marginTop: 22,
  },
  btn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  btnText: {
    fontSize: 15,
    fontFamily: "Nunito_700Bold",
  },
});
