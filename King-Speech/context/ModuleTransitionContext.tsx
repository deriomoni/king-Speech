import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import ModuleTransitionOverlay from "@/components/ModuleTransitionOverlay";

/**
 * Global module-transition overlay. Mounted once near the root so the
 * full-screen "Module N → N+1" Rive animation can play OVER any screen and
 * survive navigation (e.g. finishing the last level → returning to the map).
 */
type TransitionState = { from: number; to: number; color: string } | null;

interface ModuleTransitionContextValue {
  /** Play the corridor animation from `from` → `to`, floor tinted to `color`. */
  triggerModuleTransition: (from: number, to: number, color: string) => void;
}

const ModuleTransitionContext = createContext<ModuleTransitionContextValue | null>(null);

export function ModuleTransitionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TransitionState>(null);

  const triggerModuleTransition = useCallback(
    (from: number, to: number, color: string) => {
      setState({ from, to, color });
    },
    [],
  );

  const value = useMemo(() => ({ triggerModuleTransition }), [triggerModuleTransition]);

  return (
    <ModuleTransitionContext.Provider value={value}>
      {children}
      {state && (
        <ModuleTransitionOverlay
          from={state.from}
          to={state.to}
          color={state.color}
          onDone={() => setState(null)}
        />
      )}
    </ModuleTransitionContext.Provider>
  );
}

export function useModuleTransition() {
  const ctx = useContext(ModuleTransitionContext);
  if (!ctx) {
    throw new Error("useModuleTransition must be used within ModuleTransitionProvider");
  }
  return ctx;
}
