// Entering a Show Time stage: the first entry of the day is free, further ones
// cost SHOW_TIME_COST coins behind the Liquid Glass pay dialog (Figma 37:4261
// «Ещё один выход (50 монет)» / 37:3896 «Не хватает монет»). Shared by the
// Show Time tab and the theme preview opened from the catalog.
import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useLang } from "@/context/LangContext";
import { useTheme } from "@/context/ThemeContext";
import { useGame } from "@/context/GameContext";
import CoinIcon from "@/components/CoinIcon";
import StageGlassDialog from "@/components/showtime/StageGlassDialog";
import { PlayTriangleIcon } from "@/components/showtime/ShowTimeIcons";

export const SHOW_TIME_COST = 50;

export function useShowTimeEntry() {
  const { lang } = useLang();
  const en = lang === "en";
  const { theme: c, themeMode } = useTheme();
  const isLight = themeMode === "light";
  const { coins, showTimeFreeAvailable, consumeShowTimeFree, spendCoins } = useGame();
  const [payFor, setPayFor] = useState<string | null>(null);

  const goToStage = (levelId: string) => {
    router.push({ pathname: "/showtime-stage", params: { levelId, mode: "trainer" } });
  };

  const start = (levelId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    if (showTimeFreeAvailable) {
      consumeShowTimeFree();
      goToStage(levelId);
    } else {
      setPayFor(levelId);
    }
  };

  const canPay = coins >= SHOW_TIME_COST;
  const confirmPaidEntry = () => {
    const levelId = payFor;
    if (levelId && spendCoins(SHOW_TIME_COST)) {
      setPayFor(null);
      goToStage(levelId);
    }
  };

  const dialog = (
    <StageGlassDialog
      visible={!!payFor}
      title={en ? "Enter Show Time again?" : "Ещё один выход в Show Time?"}
      message={
        canPay
          ? en
            ? "Today's free entry is used."
            : "Бесплатный выход на сегодня использован."
          : en
            ? "Not enough coins — earn them by finishing levels."
            : "Не хватает монет - зарабатывайте их, проходя уровни."
      }
      overlay={0.6}
      onRequestClose={() => setPayFor(null)}
      buttons={[
        { label: en ? "Cancel" : "Отмена", variant: "secondary", onPress: () => setPayFor(null) },
        {
          label: en ? "Enter ·" : "Выйти ·",
          variant: "primary",
          disabled: !canPay,
          onPress: confirmPaidEntry,
          trailing: (
            <View style={st.payTrail}>
              <Text style={[st.payTrailText, { color: canPay ? c.accentText : "rgba(240,238,233,0.35)" }]}>
                {SHOW_TIME_COST}
              </Text>
              <CoinIcon size={20} color={canPay ? c.accentText : "rgba(240,238,233,0.35)"} />
            </View>
          ),
        },
      ]}
    >
      <View style={st.payCostRow}>
        <Text style={[st.payCostLabel, { color: isLight ? "rgba(38,38,40,0.6)" : "rgba(240,238,233,0.6)" }]}>
          {en ? "This entry costs" : "Этот выход стоит"}
        </Text>
        <Text style={[st.payCostValue, { color: isLight ? "rgba(38,38,40,0.9)" : "rgba(240,238,233,0.9)" }]}>
          {SHOW_TIME_COST}
        </Text>
        <CoinIcon size={16} color={c.accent} />
      </View>
    </StageGlassDialog>
  );

  return { start, dialog, freeAvailable: showTimeFreeAvailable };
}

/** Yellow «Начать выступление» pill (Figma 17:707) with the cost when not free. */
export function ShowTimeStartButton({
  onPress,
  free,
  en,
  style,
}: {
  onPress: () => void;
  free: boolean;
  en: boolean;
  style?: object;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [st.startBtn, style, { opacity: pressed ? 0.85 : 1 }]}>
      <PlayTriangleIcon color="#262628" />
      <Text style={st.startBtnText}>{en ? "Start performance" : "Начать выступление"}</Text>
      {free ? null : (
        <View style={st.startBtnCost}>
          <Text style={st.startBtnCostText}>{SHOW_TIME_COST}</Text>
          <CoinIcon size={16} color="#3A3A3B" />
        </View>
      )}
    </Pressable>
  );
}

const st = StyleSheet.create({
  payCostRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 },
  payCostLabel: { fontFamily: "Geologica_600SemiBold", fontSize: 14 },
  payCostValue: { fontFamily: "Geologica_900Black", fontSize: 14 },
  payTrail: { flexDirection: "row", alignItems: "center", gap: 6 },
  payTrailText: { fontFamily: "Geologica_900Black", fontSize: 16 },
  startBtn: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    height: 50,
    borderRadius: 32,
    backgroundColor: "#FFD857",
    // Figma 17:707: icon box at x 20, label at x 50.
    paddingLeft: 20,
    paddingRight: 20,
    gap: 8,
    marginTop: 33,
  },
  startBtnText: { color: "#262628", fontSize: 16, fontFamily: "Geologica_700Bold" },
  startBtnCost: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginLeft: 2,
    paddingLeft: 10,
    borderLeftWidth: 1.5,
    borderLeftColor: "rgba(58,58,59,0.22)",
  },
  startBtnCostText: { color: "#3A3A3B", fontSize: 16, fontFamily: "Geologica_800ExtraBold" },
});
