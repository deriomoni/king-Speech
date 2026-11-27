import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, Modal, TextInput, Platform } from "react-native";
import { useAppColors } from "@/hooks/useAppColors";
import { useLang, pickLang } from "@/context/LangContext";

/** Small rename dialog styled like AppDialog (same frame), with a text field. */
export default function NameEditDialog({
  visible,
  initial,
  onCancel,
  onSave,
}: {
  visible: boolean;
  initial: string;
  onCancel: () => void;
  onSave: (name: string) => void;
}) {
  const { colors, isDark } = useAppColors();
  const { lang } = useLang();
  const [value, setValue] = useState(initial);
  useEffect(() => {
    if (visible) setValue(initial);
  }, [visible, initial]);

  const ink = isDark ? "#FFFFFF" : "#111114";
  const onInk = isDark ? "#111114" : "#FFFFFF";

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.text }]}>{pickLang(lang, { ru: "Имя", en: "Name", kk: "Аты" })}</Text>
          <TextInput
            value={value}
            onChangeText={setValue}
            autoFocus
            maxLength={40}
            placeholder={pickLang(lang, { ru: "Как тебя зовут?", en: "What's your name?", kk: "Атыңыз кім?" })}
            placeholderTextColor={colors.textSecondary}
            onSubmitEditing={() => onSave(value)}
            style={[styles.input, { color: colors.text, borderColor: colors.border }]}
          />
          <View style={styles.btns}>
            <Pressable onPress={onCancel} style={[styles.btn, { backgroundColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(17,17,20,0.08)" }]}>
              <Text style={[styles.btnText, { color: colors.text }]}>{pickLang(lang, { ru: "Отмена", en: "Cancel", kk: "Болдырмау" })}</Text>
            </Pressable>
            <Pressable
              onPress={() => onSave(value)}
              disabled={!value.trim()}
              style={[styles.btn, { backgroundColor: ink, opacity: value.trim() ? 1 : 0.5 }]}
            >
              <Text style={[styles.btnText, { color: onInk }]}>{pickLang(lang, { ru: "Сохранить", en: "Save", kk: "Сақтау" })}</Text>
            </Pressable>
          </View>
        </View>
      </View>
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
  },
  title: { fontSize: 19, lineHeight: 25, textAlign: "center", fontFamily: "Geologica_800ExtraBold" },
  input: {
    marginTop: 16,
    height: 50,
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    fontSize: 16,
    fontFamily: "Geologica_500Medium",
    ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : null),
  },
  btns: { flexDirection: "row", gap: 10, marginTop: 18 },
  btn: { flex: 1, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  btnText: { fontSize: 15, fontFamily: "Geologica_700Bold" },
});
