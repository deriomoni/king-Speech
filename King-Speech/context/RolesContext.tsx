import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Persisted collection of roles the player has performed at least once.
// This drives the «Собранные роли» achievements view and the "new role
// unlocked" reveal. We store only lightweight metadata — never any recording.

const COLLECTED_KEY = "@kingspeech_roles_collected_v1";

export interface CollectedRole {
  id: string;
  /** ms epoch of first unlock. */
  firstAt: number;
  /** Number of times the role was performed. */
  plays: number;
  /** Best AI overall score 0..10 across performances (optional). */
  bestScore?: number;
}

interface RolesContextValue {
  collected: Record<string, CollectedRole>;
  isLoaded: boolean;
  isCollected: (id: string) => boolean;
  /**
   * Records one performance of a role. Returns true when this call unlocked
   * the role for the first time (so callers can show a celebratory reveal).
   */
  recordRolePlay: (id: string, score?: number) => boolean;
  collectedCount: number;
}

const RolesContext = createContext<RolesContextValue | null>(null);

export function RolesProvider({ children }: { children: ReactNode }) {
  const [collected, setCollected] = useState<Record<string, CollectedRole>>({});
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(COLLECTED_KEY)
      .then((raw) => {
        if (raw) {
          try {
            const obj = JSON.parse(raw);
            if (obj && typeof obj === "object" && !Array.isArray(obj)) {
              setCollected(obj);
            }
          } catch {}
        }
      })
      .finally(() => setIsLoaded(true));
  }, []);

  const persist = useCallback((next: Record<string, CollectedRole>) => {
    setCollected(next);
    AsyncStorage.setItem(COLLECTED_KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  const isCollected = useCallback(
    (id: string) => !!collected[id],
    [collected],
  );

  const recordRolePlay = useCallback(
    (id: string, score?: number): boolean => {
      const existing = collected[id];
      const isNew = !existing;
      const next: Record<string, CollectedRole> = {
        ...collected,
        [id]: {
          id,
          firstAt: existing?.firstAt ?? Date.now(),
          plays: (existing?.plays ?? 0) + 1,
          bestScore:
            typeof score === "number"
              ? Math.max(existing?.bestScore ?? 0, score)
              : existing?.bestScore,
        },
      };
      persist(next);
      return isNew;
    },
    [collected, persist],
  );

  const value: RolesContextValue = {
    collected,
    isLoaded,
    isCollected,
    recordRolePlay,
    collectedCount: Object.keys(collected).length,
  };

  return (
    <RolesContext.Provider value={value}>{children}</RolesContext.Provider>
  );
}

export function useRoles(): RolesContextValue {
  const ctx = useContext(RolesContext);
  if (!ctx) throw new Error("useRoles must be used within RolesProvider");
  return ctx;
}
