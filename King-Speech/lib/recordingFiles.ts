import { Platform } from "react-native";

/** Best-effort removal of a saved take's audio file (native file:// only). */
export async function deleteRecordingFile(uri: string): Promise<void> {
  if (Platform.OS === "web") {
    if (uri?.startsWith("blob:")) {
      try {
        URL.revokeObjectURL(uri);
      } catch {}
    }
    return;
  }
  if (!uri || !uri.startsWith("file:")) return;
  try {
    const FileSystem = require("expo-file-system/legacy");
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch (e) {
    console.warn("[recordings] could not delete file", e);
  }
}
