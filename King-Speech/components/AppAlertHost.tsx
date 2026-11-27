import React, { useEffect, useState } from "react";
import StageGlassDialog, { type GlassBtn } from "@/components/showtime/StageGlassDialog";
import { useLang, pickLang } from "@/context/LangContext";
import { type AppAlertRequest, setAppAlertListener } from "@/lib/appAlert";

/** Renders `appAlert(...)` calls with the shared dialog card. Mount once. */
export default function AppAlertHost() {
  const { lang } = useLang();
  const [queue, setQueue] = useState<AppAlertRequest[]>([]);
  useEffect(() => {
    setAppAlertListener((req) => setQueue((q) => [...q, req]));
    return () => setAppAlertListener(null);
  }, []);

  const cur = queue[0];
  const close = () => setQueue((q) => q.slice(1));
  const ok = pickLang(lang, { ru: "OK", en: "OK", kk: "OK" });

  const src = cur?.buttons ?? [];
  // The last non-cancel button is the main action; the rest are secondary.
  let mainIdx = -1;
  src.forEach((b, i) => {
    if (b.style !== "cancel") mainIdx = i;
  });
  const buttons: GlassBtn[] = src.map((b, i) => ({
    label: b.text ?? ok,
    variant: b.style === "destructive" ? "danger" : src.length === 1 || i === mainIdx ? "primary" : "secondary",
    onPress: () => {
      close();
      b.onPress?.();
    },
  }));
  // Cancel first, like the reference (secondary left, action right).
  buttons.sort((a, b) => (a.variant === "secondary" ? -1 : 0) - (b.variant === "secondary" ? -1 : 0));
  const cancel = cur?.buttons.find((b) => b.style === "cancel");

  return (
    <StageGlassDialog
      visible={!!cur}
      title={cur?.title ?? ""}
      message={cur?.message}
      buttons={buttons}
      stacked={buttons.length > 2}
      onRequestClose={() => {
        close();
        cancel?.onPress?.();
      }}
    />
  );
}
