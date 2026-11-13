// Who launched the cover flight into the theme preview, so the preview's X can
// fly the photo back to the same cover (Show Time carousel or theme catalog).

export type FlightOrigin = "showtime" | "catalog";

let launch: { origin: FlightOrigin; levelId: string } | null = null;
const listeners = new Set<(origin: FlightOrigin, levelId: string) => void>();

/** Called when a flight lands and the preview opens. */
export function markFlightLaunch(origin: FlightOrigin, levelId: string) {
  launch = { origin, levelId };
}

/** The preview for `levelId` was opened by a flight (its photo must not fade in). */
export function isFlightLanding(levelId: string) {
  return launch?.levelId === levelId;
}

/** Forget the launch (e.g. the show started — no flight back afterwards). */
export function clearFlightLaunch() {
  launch = null;
}

/** Preview X: asks the origin screen to fly the photo back. True if one will. */
export function requestFlightReturn(levelId: string): boolean {
  if (!launch || launch.levelId !== levelId || listeners.size === 0) return false;
  const { origin } = launch;
  launch = null;
  listeners.forEach((fn) => fn(origin, levelId));
  return true;
}

export function subscribeFlightReturn(fn: (origin: FlightOrigin, levelId: string) => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
