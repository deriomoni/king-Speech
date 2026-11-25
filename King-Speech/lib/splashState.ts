// Tiny signal: has the animated launch splash (BrandSplash) finished? Screens
// that open with their own intro (Welcome) wait for it, so the intro isn't
// played unseen underneath the splash.
import { useEffect, useState } from "react";

let done = false;
const listeners = new Set<() => void>();

export function markSplashDone() {
  if (done) return;
  done = true;
  listeners.forEach((l) => l());
  listeners.clear();
}

export function useSplashDone(): boolean {
  const [isDone, setDone] = useState(done);
  useEffect(() => {
    if (done) {
      setDone(true);
      return;
    }
    const l = () => setDone(true);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return isDone;
}

// Where Welcome leaves the logo (its centre, window coordinates), so sign-in
// can pick it up from there and glide it into its own place.
let logoCY: number | null = null;
export function setLogoHandoff(cy: number) {
  logoCY = cy;
}
export function takeLogoHandoff(): number | null {
  const v = logoCY;
  logoCY = null;
  return v;
}
