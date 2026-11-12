// Face-tracking scoring core — pure TypeScript, no React / native imports, so
// it can be unit-tested in node and reused by the hook in lib/faceTracking.ts.
//
// PRIVACY: everything here works on a handful of numbers (box size, centre,
// head angles) that Google ML Kit computes ON THE DEVICE. No camera frame,
// image or face data ever leaves the phone, and nothing is sent to a server.

export type FaceTrackStatus = "ok" | "adjust" | "lost";

/** Which single hint to show while in the `adjust` state. */
export type FaceHint = "closer" | "farther" | "center" | "look";

/** One detection result, already reduced to plain numbers in the frame processor. */
export interface FaceSample {
  /** At least one face was found in the frame. */
  present: boolean;
  /** Number of faces found (the largest one is scored). */
  faces: number;
  /** Face box height / frame height (upright frame), 0..1. */
  sizeRatio: number;
  /** Face box centre, normalised 0..1 in the upright frame. */
  cx: number;
  cy: number;
  /** ML Kit Euler angles, degrees. Y = left/right turn, X = up/down nod. */
  yaw: number;
  pitch: number;
}

export interface FaceTakeStats {
  /** Share of the take (0..100) spent in each state. */
  okPct: number;
  adjustPct: number;
  lostPct: number;
  /** Mean smoothed quality (0..1) over the time a face was visible. */
  avgQuality: number;
  /** Mean visibility (0..100) over the whole take; lost time counts as 0. */
  avgVisibility: number;
  /** Total tracked time in ms (sum of the three buckets). */
  trackedMs: number;
}

export interface FaceTrackSnapshot {
  status: FaceTrackStatus;
  hint: FaceHint | null;
  /** Smoothed quality 0..1 (0 when lost). */
  quality: number;
  /** 0..100, quantised to steps of 5 so the UI doesn't re-render on noise. */
  visibility: number;
}

// ---- Thresholds (tune on device; see docs/face-tracking.md) ----------------
export const FT = {
  /** Detection rate in the frame processor (~5 fps). */
  intervalMs: 200,
  /** Ideal face height as a share of frame height. */
  sizeIdealMin: 0.3,
  sizeIdealMax: 0.65,
  /** Size score falls linearly to 0 at these bounds. */
  sizeZeroMin: 0.12,
  sizeZeroMax: 0.9,
  /** Centre offset (0 = centre, 1 = frame edge): full score below, 0 above. */
  centerGood: 0.15,
  centerBad: 0.6,
  /** Head angle (max of |yaw|, |pitch|), degrees. */
  angleGood: 20,
  angleBad: 35,
  /** Weights of the quality score. */
  wSize: 0.35,
  wCenter: 0.3,
  wAngle: 0.35,
  /** If any single factor is below this, quality is capped at `worstCap`. */
  worstGate: 0.35,
  worstCap: 0.5,
  /** EMA factor per sample (at 5 fps ≈ 0.5 s time constant). */
  emaAlpha: 0.35,
  /** Hysteresis: enter `ok` at ≥ okEnter, leave it only below okExit. */
  okEnter: 0.6,
  okExit: 0.52,
  /** Minimum time in ok/adjust before switching between them. */
  minDwellMs: 600,
  /** No face for longer than this → `lost`. */
  lostAfterMs: 800,
  /** A hint must stay the worst factor this long before it replaces the shown one. */
  hintHoldMs: 1000,
  /** Samples further apart than this (paused processor) are not counted in stats. */
  maxStatGapMs: 1000,
} as const;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

export function sizeScore(r: number): number {
  if (r >= FT.sizeIdealMin && r <= FT.sizeIdealMax) return 1;
  if (r < FT.sizeIdealMin) return clamp01((r - FT.sizeZeroMin) / (FT.sizeIdealMin - FT.sizeZeroMin));
  return clamp01((FT.sizeZeroMax - r) / (FT.sizeZeroMax - FT.sizeIdealMax));
}

/** 0 = perfectly centred, 1 = centre on the frame edge (clamped). */
export function centerOffset(cx: number, cy: number): number {
  const dx = cx - 0.5;
  const dy = cy - 0.5;
  return clamp01(Math.sqrt(dx * dx + dy * dy) / 0.5);
}

export function centerScore(offset: number): number {
  return clamp01((FT.centerBad - offset) / (FT.centerBad - FT.centerGood));
}

export function angleScore(yaw: number, pitch: number): number {
  const a = Math.max(Math.abs(yaw || 0), Math.abs(pitch || 0));
  return clamp01((FT.angleBad - a) / (FT.angleBad - FT.angleGood));
}

export interface FactorScores {
  size: number;
  center: number;
  angle: number;
}

export function factorScores(s: FaceSample): FactorScores {
  return {
    size: sizeScore(s.sizeRatio),
    center: centerScore(centerOffset(s.cx, s.cy)),
    angle: angleScore(s.yaw, s.pitch),
  };
}

export function qualityOf(f: FactorScores): number {
  let q = FT.wSize * f.size + FT.wCenter * f.center + FT.wAngle * f.angle;
  if (Math.min(f.size, f.center, f.angle) < FT.worstGate) q = Math.min(q, FT.worstCap);
  return clamp01(q);
}

/**
 * Stateful tracker: feed it samples (≈5/s) with a timestamp, read the snapshot.
 * Also accumulates per-take stats between startTake() / endTake().
 */
export class FaceTracker {
  private ema = -1; // -1 = no estimate yet
  private emaF: FactorScores = { size: 1, center: 1, angle: 1 };
  private lastSize = 0.45;
  private status: FaceTrackStatus = "ok";
  private statusSince = 0;
  private lastSeen = -1;
  private hint: FaceHint | null = null;
  private pendingHint: FaceHint | null = null;
  private pendingHintSince = 0;
  private lastT = -1;

  // per-take stats
  private recording = false;
  private ms = { ok: 0, adjust: 0, lost: 0 };
  private qMsSum = 0;
  private qMs = 0;
  private visMsSum = 0;

  reset() {
    this.ema = -1;
    this.emaF = { size: 1, center: 1, angle: 1 };
    this.status = "ok";
    this.statusSince = 0;
    this.lastSeen = -1;
    this.hint = null;
    this.pendingHint = null;
    this.lastT = -1;
  }

  update(s: FaceSample, now: number): FaceTrackSnapshot {
    // stats for the interval that just ended belong to the previous state
    if (this.recording && this.lastT >= 0) {
      const dt = now - this.lastT;
      if (dt > 0 && dt <= FT.maxStatGapMs) {
        this.ms[this.status] += dt;
        const q = this.status === "lost" ? 0 : Math.max(0, this.ema);
        if (this.status !== "lost") {
          this.qMsSum += q * dt;
          this.qMs += dt;
        }
        this.visMsSum += q * 100 * dt;
      }
    }
    this.lastT = now;

    if (!s.present) {
      if (this.lastSeen < 0) this.lastSeen = now; // never seen: start the lost clock now
      if (this.status !== "lost" && now - this.lastSeen > FT.lostAfterMs) {
        this.setStatus("lost", now);
        this.hint = null;
      }
      return this.snapshot();
    }

    this.lastSeen = now;
    const f = factorScores(s);
    this.lastSize = s.sizeRatio;
    const raw = qualityOf(f);
    if (this.ema < 0 || this.status === "lost") {
      // fresh start / face came back: don't drag the old average along
      this.ema = raw;
      this.emaF = f;
    } else {
      const a = FT.emaAlpha;
      this.ema += a * (raw - this.ema);
      this.emaF = {
        size: this.emaF.size + a * (f.size - this.emaF.size),
        center: this.emaF.center + a * (f.center - this.emaF.center),
        angle: this.emaF.angle + a * (f.angle - this.emaF.angle),
      };
    }

    const dwellOk = now - this.statusSince >= FT.minDwellMs;
    if (this.status === "lost") {
      this.setStatus(this.ema >= FT.okEnter ? "ok" : "adjust", now);
    } else if (this.status === "ok" && this.ema < FT.okExit && dwellOk) {
      this.setStatus("adjust", now);
    } else if (this.status === "adjust" && this.ema >= FT.okEnter && dwellOk) {
      this.setStatus("ok", now);
    }

    if (this.status === "adjust") {
      const worst = this.worstHint();
      if (this.hint == null) {
        this.hint = worst;
        this.pendingHint = null;
      } else if (worst !== this.hint) {
        if (this.pendingHint !== worst) {
          this.pendingHint = worst;
          this.pendingHintSince = now;
        } else if (now - this.pendingHintSince >= FT.hintHoldMs) {
          this.hint = worst;
          this.pendingHint = null;
        }
      } else {
        this.pendingHint = null;
      }
    } else {
      this.hint = null;
      this.pendingHint = null;
    }
    return this.snapshot();
  }

  snapshot(): FaceTrackSnapshot {
    const q = this.status === "lost" ? 0 : Math.max(0, this.ema);
    return {
      status: this.status,
      hint: this.status === "adjust" ? this.hint : null,
      quality: q,
      visibility: Math.round((q * 100) / 5) * 5,
    };
  }

  startTake() {
    this.recording = true;
    this.ms = { ok: 0, adjust: 0, lost: 0 };
    this.qMsSum = 0;
    this.qMs = 0;
    this.visMsSum = 0;
  }

  /** Stops accumulating and returns the take's stats (null if nothing was tracked). */
  endTake(): FaceTakeStats | null {
    this.recording = false;
    const total = this.ms.ok + this.ms.adjust + this.ms.lost;
    if (total <= 0) return null;
    const pct = (v: number) => Math.round((v / total) * 100);
    return {
      okPct: pct(this.ms.ok),
      adjustPct: pct(this.ms.adjust),
      lostPct: pct(this.ms.lost),
      avgQuality: this.qMs > 0 ? Math.round((this.qMsSum / this.qMs) * 100) / 100 : 0,
      avgVisibility: Math.round(this.visMsSum / total),
      trackedMs: Math.round(total),
    };
  }

  private setStatus(st: FaceTrackStatus, now: number) {
    this.status = st;
    this.statusSince = now;
  }

  private worstHint(): FaceHint {
    const { size, center, angle } = this.emaF;
    if (size <= center && size <= angle) return this.lastSize < FT.sizeIdealMin ? "closer" : "farther";
    if (center <= angle) return "center";
    return "look";
  }
}

export const FACE_HINT_TEXT: Record<FaceHint, { ru: string; en: string }> = {
  closer: { ru: "Подойди ближе", en: "Move closer" },
  farther: { ru: "Отойди чуть дальше", en: "Move back a little" },
  center: { ru: "Встань по центру", en: "Center yourself" },
  look: { ru: "Смотри в камеру", en: "Look at the camera" },
};
