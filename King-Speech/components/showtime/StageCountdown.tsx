import React, { useEffect, useMemo, useRef, useState } from "react";
import { Modal, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, ZoomIn } from "react-native-reanimated";
import * as Haptics from "@/lib/haptics";
import { type Lang, pickLang } from "@/context/LangContext";

// 5-second countdown before the speaker walks out on stage, with a different
// piece of advice every time so each entrance starts with a fresh mood.

type Tip = { ru: string; en: string; kk: string };

const TIPS: Tip[] = [
  { ru: "Дождись, пока софиты включатся", en: "Wait for the spotlights", kk: "Прожекторлар жанғанша күт" },
  { ru: "Подготовься", en: "Get ready", kk: "Дайындал" },
  { ru: "Сделай глубокий вдох", en: "Take a deep breath", kk: "Терең дем ал" },
  { ru: "Говори на выдохе", en: "Speak on the out-breath", kk: "Дем шығарып сөйле" },
  { ru: "Выпрями спину", en: "Straighten your back", kk: "Арқаңды тікте" },
  { ru: "Расслабь плечи", en: "Relax your shoulders", kk: "Иығыңды босат" },
  { ru: "Начни не спеша", en: "Start slowly", kk: "Асықпай баста" },
];

let lastTip = -1;
function nextTip() {
  let i = Math.floor(Math.random() * TIPS.length);
  if (i === lastTip) i = (i + 1) % TIPS.length;
  lastTip = i;
  return TIPS[i];
}

const SECONDS = 5;

export default function StageCountdown({ lang, onDone }: { lang: Lang; onDone: () => void }) {
  const tip = useMemo(nextTip, []);
  const [left, setLeft] = useState(SECONDS);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    Haptics.selectionAsync().catch(() => {});
    const id = setInterval(() => {
      setLeft((n) => {
        if (n <= 1) {
          clearInterval(id);
          setTimeout(() => doneRef.current(), 0);
          return 0;
        }
        Haptics.selectionAsync().catch(() => {});
        return n - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // A Modal so it always covers the whole screen (status bar included) on
  // every device — as a plain layer it sat under the preview on iOS.
  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent presentationStyle="overFullScreen" onRequestClose={() => {}}>
    <View style={s.wrap}>
      <Text style={[s.label, { fontFamily: "Geologica_600SemiBold" }]}>
        {pickLang(lang, { ru: "ВЫХОД НА СЦЕНУ ЧЕРЕЗ", en: "ON STAGE IN", kk: "САХНАҒА ШЫҒУҒА" })}
      </Text>
      <View style={s.numBox}>
        {left > 0 && (
          <Animated.Text key={left} entering={ZoomIn.duration(320)} style={[s.num, { fontFamily: "Geologica_800ExtraBold" }]}>
            {left}
          </Animated.Text>
        )}
      </View>
      <Animated.Text entering={FadeIn.delay(250).duration(500)} style={[s.tip, { fontFamily: "Geologica_700Bold" }]}>
        {pickLang(lang, tip)}
      </Animated.Text>
    </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: "#121214",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  label: { color: "rgba(255,255,255,0.6)", fontSize: 13, letterSpacing: 2 },
  numBox: { height: 150, justifyContent: "center", alignItems: "center", marginVertical: 8 },
  num: { color: "#FFD857", fontSize: 128, lineHeight: 140 },
  tip: { color: "#FFFFFF", fontSize: 22, lineHeight: 29, textAlign: "center", maxWidth: 320 },
});
