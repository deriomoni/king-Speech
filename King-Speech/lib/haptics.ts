/**
 * The app's single haptics entry point — a drop-in for `expo-haptics`
 * (`import * as Haptics from "@/lib/haptics"`). Every call is gated by the
 * Settings «Вибрация» toggle (SettingsContext calls setHapticsEnabled), so
 * turning vibration off silences haptics everywhere.
 */
import * as ExpoHaptics from "expo-haptics";

export const ImpactFeedbackStyle = ExpoHaptics.ImpactFeedbackStyle;
export type ImpactFeedbackStyle = ExpoHaptics.ImpactFeedbackStyle;
export const NotificationFeedbackType = ExpoHaptics.NotificationFeedbackType;
export type NotificationFeedbackType = ExpoHaptics.NotificationFeedbackType;

let enabled = true;

export function setHapticsEnabled(v: boolean) {
  enabled = v;
}

export function hapticsEnabled() {
  return enabled;
}

export function impactAsync(
  style: ExpoHaptics.ImpactFeedbackStyle = ExpoHaptics.ImpactFeedbackStyle.Medium,
): Promise<void> {
  if (!enabled) return Promise.resolve();
  return ExpoHaptics.impactAsync(style);
}

export function notificationAsync(
  type: ExpoHaptics.NotificationFeedbackType = ExpoHaptics.NotificationFeedbackType.Success,
): Promise<void> {
  if (!enabled) return Promise.resolve();
  return ExpoHaptics.notificationAsync(type);
}

export function selectionAsync(): Promise<void> {
  if (!enabled) return Promise.resolve();
  return ExpoHaptics.selectionAsync();
}

/** Web fallback used next to haptics in a few places (navigator.vibrate). */
export function webVibrate(pattern: number | number[]) {
  if (!enabled) return;
  try {
    (globalThis as any).navigator?.vibrate?.(pattern);
  } catch {}
}
