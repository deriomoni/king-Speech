import React, { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "@kingspeech_dev_open_testing_v1";

interface DevToolsContextValue {
  isOpenTestingEnabled: boolean;
  setOpenTestingEnabled: (v: boolean) => void;
  isLoaded: boolean;
}

const DevToolsContext = createContext<DevToolsContextValue | null>(null);

export function DevToolsProvider({ children }: { children: ReactNode }) {
  const [isOpenTestingEnabled, setEnabled] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw === "1") setEnabled(true);
      })
      .finally(() => setIsLoaded(true));
  }, []);

  const setOpenTestingEnabled = (v: boolean) => {
    setEnabled(v);
    AsyncStorage.setItem(STORAGE_KEY, v ? "1" : "0");
  };

  const value = useMemo(
    () => ({ isOpenTestingEnabled, setOpenTestingEnabled, isLoaded }),
    [isOpenTestingEnabled, isLoaded]
  );

  return <DevToolsContext.Provider value={value}>{children}</DevToolsContext.Provider>;
}

export function useDevTools() {
  const ctx = useContext(DevToolsContext);
  if (!ctx) throw new Error("useDevTools must be used within DevToolsProvider");
  return ctx;
}
