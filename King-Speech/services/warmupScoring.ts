import { centsBetween } from "@/services/warmupPitch";
import { getPitchToleranceCents } from "@/constants/contentLoader";

export type HitZone = "clean" | "touch" | "miss";

export interface WarmupScoreResult {
  accuracy: number;
  stars: 1 | 2 | 3;
  comboMax: number;
  cleanMs: number;
  totalMs: number;
}

export interface PitchGameSession {
  hearts: number;
  combo: number;
  comboMax: number;
  cleanMs: number;
  voicedMs: number;
  totalMs: number;
  missFlash: boolean;
}

export function createPitchSession(): PitchGameSession {
  return {
    hearts: 3,
    combo: 0,
    comboMax: 0,
    cleanMs: 0,
    voicedMs: 0,
    totalMs: 0,
    missFlash: false,
  };
}

export function classifyPitchHit(
  userHz: number | null,
  targetHz: number,
  rank: number,
  voiceActive: boolean,
): HitZone {
  const tolerance = getPitchToleranceCents(rank);
  if (userHz != null && userHz > 0) {
    const cents = centsBetween(userHz, targetHz);
    if (cents <= tolerance * 0.45) return "clean";
    if (cents <= tolerance) return "touch";
    return "miss";
  }
  if (voiceActive) return "touch";
  return "miss";
}

export function tickPitchSession(
  session: PitchGameSession,
  zone: HitZone,
  deltaMs: number,
  voiced: boolean,
): { session: PitchGameSession; heartLost: boolean } {
  const next = { ...session };
  next.totalMs += deltaMs;
  if (voiced) next.voicedMs += deltaMs;

  let heartLost = false;

  if (zone === "clean") {
    next.cleanMs += deltaMs;
    next.combo += 1;
    next.comboMax = Math.max(next.comboMax, next.combo);
    next.missFlash = false;
  } else if (zone === "touch") {
    next.missFlash = false;
  } else if (voiced) {
    next.combo = 0;
    next.hearts = Math.max(0, next.hearts - 1);
    heartLost = next.hearts < session.hearts;
    next.missFlash = true;
  }

  return { session: next, heartLost };
}

export function finalizeWarmupScore(session: PitchGameSession): WarmupScoreResult {
  const total = Math.max(session.voicedMs, session.totalMs, 1);
  const accuracy = Math.round((session.cleanMs / total) * 100);

  let stars: 1 | 2 | 3 = 1;
  if (accuracy >= 85) stars = 3;
  else if (accuracy >= 65) stars = 2;

  return {
    accuracy,
    stars,
    comboMax: session.comboMax,
    cleanMs: session.cleanMs,
    totalMs: session.totalMs,
  };
}

export function starsToScore(stars: 1 | 2 | 3): number {
  return stars * 3;
}
