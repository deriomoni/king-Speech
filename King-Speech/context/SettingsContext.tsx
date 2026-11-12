import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { setHapticsEnabled } from "@/lib/haptics";
import { setSfxMuted } from "@/lib/sfx";

/**
 * Player preferences from the Settings tab, persisted in AsyncStorage.
 * Side effects are applied globally: vibration gates lib/haptics, sound
 * effects gate lib/sfx. Push/reminder are stored for when scheduling lands.
 */
export interface AppSettings {
  soundEffects: boolean;
  vibration: boolean;
  pushNotifications: boolean;
  dailyReminder: boolean;
}

const STORAGE_KEY = "@kingspeech_settings_v1";
const DEFAULTS: AppSettings = {
  soundEffects: true,
  vibration: true,
  pushNotifications: true,
  dailyReminder: true,
};

function apply(s: AppSettings) {
  setHapticsEnabled(s.vibration);
  setSfxMuted(!s.soundEffects);
}

interface SettingsContextValue {
  settings: AppSettings;
  setSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  isLoaded: boolean;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULTS);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!raw) return;
        const parsed = { ...DEFAULTS, ...(JSON.parse(raw) as Partial<AppSettings>) };
        apply(parsed);
        setSettings(parsed);
      })
      .catch(() => {})
      .finally(() => setIsLoaded(true));
  }, []);

  const setSetting = useCallback(<K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      apply(next);
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const value = useMemo(() => ({ settings, setSetting, isLoaded }), [settings, setSetting, isLoaded]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
