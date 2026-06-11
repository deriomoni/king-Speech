// Module-level callback registry. GameContext registers its full local-state
// reset function here on mount; AuthContext.signOut() calls it so the game
// state is wiped on logout regardless of whether Firebase is configured.
type Resetter = () => Promise<void> | void;

let resetter: Resetter | null = null;

export function registerGameResetter(fn: Resetter): () => void {
  resetter = fn;
  return () => {
    if (resetter === fn) resetter = null;
  };
}

export async function runGameReset(): Promise<void> {
  if (resetter) {
    try {
      await resetter();
    } catch (e) {
      console.warn("[gameResetRegistry] reset failed:", e);
    }
  }
}
