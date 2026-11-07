import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { SvgXml } from "react-native-svg";
import { useTheme } from "@/context/ThemeContext";
import { LOGO_SVG } from "@/assets/figma/auth/svgs";

// Shared bits of the Figma "01 · Вход и регистрация" flow (section 34:975).

const LOGO_W = 159;
const LOGO_H = 53;

/** King Speech wordmark (crown + "King Speech"). Native size 159×53. */
export function KingSpeechLogo({ width = LOGO_W, color }: { width?: number; color: string }) {
  const xml = React.useMemo(() => LOGO_SVG.replace(/#262628/g, color), [color]);
  return <SvgXml xml={xml} width={width} height={(width * LOGO_H) / LOGO_W} />;
}

/** Text colour helper: Figma uses ink-with-alpha (light ink on dark, dark ink on light). */
export function useInk() {
  const { theme } = useTheme();
  const dark = theme.mode === "dark";
  return {
    ink: (a: number) => (dark ? `rgba(240,238,233,${a})` : `rgba(38,38,40,${a})`),
    // Figma stroke/shape
    stroke: dark ? "rgba(240,238,233,0.06)" : "rgba(38,38,40,0.08)",
  };
}

type PillVariant = "primary" | "secondary" | "secondaryOnGold";

interface PillProps {
  label: string;
  onPress?: () => void;
  variant?: PillVariant;
  disabled?: boolean;
  busy?: boolean;
  left?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** 60pt pill button: gold primary with the 4px CTA stroke, or the muted "button/secondary". */
export function PillButton({ label, onPress, variant = "primary", disabled, busy, left, style }: PillProps) {
  const { theme } = useTheme();
  const dark = theme.mode === "dark";
  let box: ViewStyle;
  let color: string;
  if (variant === "primary") {
    box = { backgroundColor: theme.accent, borderWidth: 4, borderColor: theme.ctaStroke };
    color = theme.accentText;
  } else if (variant === "secondaryOnGold" || dark) {
    // Figma button/secondary (#716250 @ ~12%) with button/stroke #312C24, white ink.
    box = { backgroundColor: "rgba(113,98,80,0.12)", borderWidth: 2, borderColor: "#312C24" };
    color = "#FFFFFF";
  } else {
    box = { backgroundColor: "rgba(38,38,40,0.05)", borderWidth: 2, borderColor: "rgba(38,38,40,0.14)" };
    color = "rgba(38,38,40,0.45)";
  }
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [s.pill, box, { opacity: pressed ? 0.88 : 1 }, style]}
    >
      {left}
      <Text style={[s.pillTxt, { color }]}>{label}</Text>
      {busy ? (
        <View style={s.busy}>
          <ActivityIndicator size="small" color={color} />
        </View>
      ) : null}
    </Pressable>
  );
}

const s = StyleSheet.create({
  pill: {
    height: 60,
    borderRadius: 32,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    overflow: "hidden",
  },
  pillTxt: {
    fontSize: 17,
    fontFamily: "Geologica_800ExtraBold",
  },
  busy: {
    position: "absolute",
    right: 20,
  },
});
