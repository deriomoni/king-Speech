// Tiny cross-screen hand-off: the full theme catalog (app/theme-catalog.tsx)
// picks a Show Time theme and goes back; the Show Time tab listens and selects
// it. A module-level store avoids depending on router param semantics when
// popping back to an already-mounted tab.

type Listener = (key: string) => void;

let pending: string | null = null;
const listeners = new Set<Listener>();

export function requestShowTimeTheme(key: string) {
  pending = key;
  listeners.forEach((l) => l(key));
}

/** Returns and clears a selection made while the Show Time tab wasn't listening. */
export function takePendingShowTimeTheme(): string | null {
  const k = pending;
  pending = null;
  return k;
}

export function subscribeShowTimeTheme(l: Listener) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
