import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, Modal, TextInput, Platform } from "react-native";
import { useAppColors } from "@/hooks/useAppColors";

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
          <Text style={[styles.title, { color: colors.text }]}>Имя</Text>
          <TextInput
            value={value}
            onChangeText={setValue}
            autoFocus
            maxLength={40}
            placeholder="Как тебя зовут?"
            placeholderTextColor={colors.textSecondary}
            onSubmitEditing={() => onSave(value)}
            style={[styles.input, { color: colors.text, borderColor: colors.border }]}
          />
          <View style={styles.btns}>
            <Pressable onPress={onCancel} style={[styles.btn, { borderWidth: 1.5, borderColor: colors.border }]}>
              <Text style={[styles.btnText, { color: colors.text }]}>Отмена</Text>
            </Pressable>
            <Pressable
              onPress={() => onSave(value)}
              disabled={!value.trim()}
              style={[styles.btn, { backgroundColor: ink, opacity: value.trim() ? 1 : 0.5 }]}
            >
              <Text style={[styles.btnText, { color: onInk }]}>Сохранить</Text>
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
