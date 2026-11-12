// Entering a Show Time stage: the first entry of the day is free, further ones
// cost SHOW_TIME_COST coins behind the Liquid Glass pay dialog (Figma 37:4261
// «Ещё один выход (50 монет)» / 37:3896 «Не хватает монет»).
//
// Flow: the Show Time tab and the theme catalog only OPEN the stage
// (openShowTimeStage → its «Превью темы» card, nothing is charged). The
// preview's start button calls useShowTimeEntry().begin(go): a free entry is
// consumed and the show starts; otherwise the pay dialog appears and coins are
// spent exactly once, on confirm, right before the show starts.
import React, { useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import * as Haptics from "@/lib/haptics";
import { router } from "expo-router";
import { useLang } from "@/context/LangContext";
import { useTheme } from "@/context/ThemeContext";
import { useGame } from "@/context/GameContext";
import CoinIcon from "@/components/CoinIcon";
import StageGlassDialog from "@/components/showtime/StageGlassDialog";
import { PlayTriangleIcon } from "@/components/showtime/ShowTimeIcons";

export const SHOW_TIME_COST = 50;

/** Opens a theme's stage on its preview card as a paid-or-free Show Time entry. */
export function openShowTimeStage(levelId: string) {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  router.push({ pathname: "/showtime-stage", params: { levelId, mode: "trainer", entry: "showtime" } });
}

export function useShowTimeEntry() {
  const { lang } = useLang();
  const en = lang === "en";
  const { theme: c, themeMode } = useTheme();
  const isLight = themeMode === "light";
  const { coins, showTimeFreeAvailable, consumeShowTimeFree, spendCoins } = useGame();
  const [payOpen, setPayOpen] = useState(false);
  const pendingRef = useRef<(() => void) | null>(null);
  // One entry per stage visit: a double tap must not consume/charge twice.
  const launchedRef = useRef(false);

  const launch = (go: () => void) => {
    launchedRef.current = true;
    pendingRef.current = null;
    go();
  };

  const begin = (go: () => void) => {
    if (launchedRef.current) return;
    if (showTimeFreeAvailable) {
      consumeShowTimeFree();
      launch(go);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      pendingRef.current = go;
      setPayOpen(true);
    }
  };

  const cancel = () => {
    pendingRef.current = null;
    setPayOpen(false);
  };

  const canPay = coins >= SHOW_TIME_COST;
  const confirmPaidEntry = () => {
    const go = pendingRef.current;
    if (!go || launchedRef.current) return;
    if (spendCoins(SHOW_TIME_COST)) {
      setPayOpen(false);
      launch(go);
    }
  };

  const dialog = (
    <StageGlassDialog
      visible={payOpen}
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
      onRequestClose={cancel}
      buttons={[
        { label: en ? "Cancel" : "Отмена", variant: "secondary", onPress: cancel },
        {
          label: en ? "Enter ·" : "Выйти ·",
          variant: "primary",
          disabled: !canPay,
          onPress: confirmPaidEntry,
          trailing: (
            <View style={st.payTrail}>
              <Text style={[st.payTrailText, { color: canPay ? c.accentText : c.text }]}>
                {SHOW_TIME_COST}
              </Text>
              <CoinIcon size={20} color={canPay ? c.accentText : c.text} />
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

  return { begin, dialog, freeAvailable: showTimeFreeAvailable };
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
