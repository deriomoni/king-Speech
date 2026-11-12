import React from "react";
import StageGlassDialog, { type GlassBtn } from "@/components/showtime/StageGlassDialog";

/**
 * AppDialog — the ONE shared design for every pop-up / confirm in the app.
 *
 * Figma 145:181 "Dialog / Liquid Glass" + 133:167 "Alert (iOS) · все окна":
 * a frosted 32pt card with a pale 4pt rim and a soft gold glow behind the
 * title; buttons are pills — `primary` = gold CTA (4pt amber stroke),
 * `secondary` = a neutral grey glass pill. A single button is always the
 * gold full-width "OK". Renders through StageGlassDialog so Show Time,
 * Reading, Vocabulary and every AppDialog caller share one look.
 *
 * Public API unchanged — use it instead of hand-rolling a <Modal>.
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
  const single = buttons.length === 1;
  const glassButtons: GlassBtn[] = buttons.map((b) => ({
    label: b.label,
    onPress: b.onPress,
    variant: single || b.variant === "primary" ? "primary" : "secondary",
  }));

  return (
    <StageGlassDialog
      visible={visible}
      title={title}
      message={message}
      buttons={glassButtons}
      onRequestClose={onRequestClose}
      dismissOnBackdrop={dismissOnBackdrop}
      overlay={0.6}
    />
  );
}
