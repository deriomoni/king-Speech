/**
 * Public entry point for the speech engine (spec §2).
 *
 * The app captures audio+STT once (via the STT adapter with `persist`), registers
 * it under an `audioSessionId`, then calls `analyze`. `analyze` decodes the WAV
 * to PCM, runs the acoustic pipeline (§3), the right level analyzer, the gates,
 * the show curve and the feedback selector, persists the raw metrics (HC-4) and
 * the personal baselines, and returns the shown result.
 *
 * `analyzeCaptured` is the pure core (audio already decoded) — used by tests and
 * callers that already hold frames/VAD.
 */

import { clippingRatio, computeRmsFrames, RmsFrames } from './core/audio/rms';
import { computeVad, VadResult } from './core/audio/vad';
import { loadPcmFromWavUri } from './core/audio/capture';
import { normalizeText } from './core/text/normalize';
import { align } from './core/text/align';
import { stem } from './core/text/stemmer';
import { SttMode, SttResult } from './core/stt/types';
import { checkGates, retryMessage } from './scoring/gates';
import { applyCurve } from './scoring/curve';
import { starsFor } from './scoring/stars';
import {
  EMPTY_HISTORY,
  FeedbackHistory,
  MetricValue,
  selectFeedback,
} from './feedback/selector';
import { Insight } from './feedback/insights';
import {
  emaUpdate,
  getProblemCluster,
  loadBaselines,
  loadSoundmap,
  saveBaselines,
  saveSoundmap,
  updateSoundmap,
  weeklyProgress,
} from './profile/baseline';
import { extractClusters } from './profile/baseline';
import { getJson, setJson, STORAGE_KEYS } from './core/storage';
import { analyzeTongueTwister } from './analyzers/tongueTwister';
import { analyzeReading } from './analyzers/reading';
import { analyzeVocabulary } from './analyzers/vocabulary';
import { analyzeShowTime } from './analyzers/showtime/analyzer';
import { normalizeHyp, speechDurationFromTimings } from './analyzers/context';
import { computeLoudness } from './core/metrics/loudness';
import {
  AnalysisResult,
  Feedback,
  Level,
  Locale,
  PlayerRank,
  RawMetrics,
  ReferenceContent,
  RetryReason,
} from './types';

export * from './types';

// ---------------------------------------------------------------------------
// Capture registry — the app fills this after recording (single capture).
// ---------------------------------------------------------------------------

export interface CapturedAudio {
  stt: SttResult | null;
  mode: SttMode;
  /** Persisted WAV URI; decoded lazily by analyze(). */
  wavUri?: string;
  /** Pre-decoded audio (tests / callers that already ran the pipeline). */
  frames?: RmsFrames;
  vad?: VadResult;
  clippingRatio?: number;
  durationMs?: number;
}

const sessions = new Map<string, CapturedAudio>();

export function registerCapture(id: string, captured: CapturedAudio): void {
  sessions.set(id, captured);
}
export function clearCapture(id: string): void {
  sessions.delete(id);
}

export interface AnalyzeInput {
  level: Level;
  audioSessionId: string;
  reference?: ReferenceContent;
  attempt?: 1 | 2 | 3;
  rank: PlayerRank;
  locale: Locale;
}

function retry(reason: RetryReason, locale: Locale, message?: string): AnalysisResult {
  return { status: 'retry', reason, message: message ?? retryMessage(reason, locale) };
}

export async function analyze(input: AnalyzeInput): Promise<AnalysisResult> {
  const captured = sessions.get(input.audioSessionId);
  if (!captured) return retry('nothing_recognized', input.locale);

  let { frames, vad, clippingRatio: clip, durationMs } = captured;
  if ((!frames || !vad) && captured.wavUri) {
    try {
      const pcm = await loadPcmFromWavUri(captured.wavUri);
      frames = computeRmsFrames(pcm.samples, pcm.sampleRate);
      vad = computeVad(frames);
      clip = clippingRatio(frames);
      durationMs = (pcm.samples.length / pcm.sampleRate) * 1000;
    } catch {
      // Decode failed — fall through with whatever we have (may be LITE).
    }
  }

  return analyzeCaptured({
    level: input.level,
    locale: input.locale,
    rank: input.rank,
    attempt: input.attempt,
    reference: input.reference,
    stt: captured.stt,
    mode: captured.mode,
    frames,
    vad,
    clippingRatio: clip,
    durationMs,
  });
}

export interface AnalyzeCapturedParams {
  level: Level;
  locale: Locale;
  rank: PlayerRank;
  attempt?: 1 | 2 | 3;
  reference?: ReferenceContent;
  stt: SttResult | null;
  mode: SttMode;
  frames?: RmsFrames;
  vad?: VadResult;
  clippingRatio?: number;
  durationMs?: number;
  /** Injected clock for deterministic weekly-progress tests. */
  now?: number;
}

interface AnalyzerResult {
  raw: number;
  metrics: RawMetrics;
  insights: Insight[];
  metricValues: MetricValue[];
}

export async function analyzeCaptured(params: AnalyzeCapturedParams): Promise<AnalysisResult> {
  const { level, locale, rank, mode, stt, frames, vad } = params;
  const now = params.now ?? Date.now();

  // --- LITE: no STT (§9). Acoustic-only, or skip vocabulary. ---
  if (!stt || mode === 'LITE') {
    return liteResult(params);
  }

  const recognizedWords = stt.words.length;
  const hasReference = level === 'tongue_twister' || level === 'reading' || level === 'literature';
  const refText = params.reference?.text ?? '';
  const refWordCount = hasReference ? normalizeText(refText).split(' ').filter(Boolean).length : 0;

  // Coverage for the gate (analyzers recompute internally).
  let coverage: number | null = null;
  if (hasReference) {
    const refWords = normalizeText(refText).split(' ').filter(Boolean);
    const hyp = normalizeHyp(stt).map((w) => w.text);
    coverage = align(refWords, hyp).coverage;
  }

  const durationMs =
    params.durationMs ?? (vad ? vad.speechDurationMs : speechDurationFromTimings(normalizeHyp(stt)));
  const speechRatio = vad ? vad.speechRatio : recognizedWords > 0 ? 1 : 0;

  const gate = checkGates({
    level,
    durationMs,
    speechRatio,
    recognizedWords,
    clippingRatio: params.clippingRatio ?? 0,
    coverage,
    refWordCount,
    targetWpm: params.reference?.baseWPM,
  });
  if (!gate.ok) return retry(gate.reason, locale);

  // --- Dispatch to the level analyzer. ---
  let result: AnalyzerResult;
  let clarityPerWordForSoundmap: { refWord: string; failed: boolean; smeared: boolean }[] | null = null;
  let tautologyWord: string | null = null;

  if (level === 'tongue_twister') {
    const soundmap = await loadSoundmap();
    const out = analyzeTongueTwister({
      referenceRaw: refText,
      stt,
      attempt: params.attempt ?? 1,
      baseWPM: params.reference?.baseWPM,
      mode,
      speechDurationMs: vad?.speechDurationMs,
      problemCluster: getProblemCluster(soundmap),
    });
    result = out;
    clarityPerWordForSoundmap = out.clarityPerWord.map((w) => ({
      refWord: w.refWord,
      failed: w.failed,
      smeared: w.smeared,
    }));
  } else if (level === 'reading' || level === 'literature') {
    if (!frames || !vad) return retry('nothing_recognized', locale);
    const out = analyzeReading({
      referenceRaw: refText,
      stt,
      mode,
      literature: level === 'literature' || !!params.reference?.literature,
      frames,
      vad,
    });
    result = out;
  } else if (level === 'vocabulary') {
    const out = analyzeVocabulary({ referenceRaw: refText, stt, mode });
    if (!out.matched) {
      const msg =
        locale === 'en'
          ? `Didn't catch it. Say it again: ${refText}`
          : `Не расслышал. Скажи ещё раз: ${refText}`;
      return retry('off_script', locale, msg);
    }
    result = out;
  } else {
    // show_time
    if (!frames || !vad) return retry('nothing_recognized', locale);
    const out = analyzeShowTime({ stt, mode, locale, frames, vad });
    result = out;
    const tw = out.insights.find((i) => i.id === 'tautology_word');
    tautologyWord = tw?.evidence.word ?? null;
  }

  // Capture a tautology word for synonym lookup across levels.
  if (!tautologyWord) {
    const tw = result.insights.find((i) => i.id === 'tautology_word');
    tautologyWord = tw?.evidence.word ?? null;
  }

  // --- Score + feedback. ---
  const shownScore = applyCurve(result.raw, rank);
  const stars = starsFor(shownScore);

  const history = (await getJson<FeedbackHistory>(STORAGE_KEYS.feedback)) ?? { ...EMPTY_HISTORY };
  const baseline = await loadBaselines();
  const baselineGains = computeBaselineGains(result.metricValues, baseline.values);

  const progress = weeklyProgress(baseline, now, locale);

  const { feedback, history: newHistory } = selectFeedback({
    insights: result.insights,
    metrics: result.metricValues,
    locale,
    history,
    baselineGains,
    tautologyStem: tautologyWord ? stem(tautologyWord, locale) : undefined,
    progressLine: progress.line ?? undefined,
  });

  // --- Persist (best-effort; no-ops without AsyncStorage). ---
  await persistSideEffects({
    level,
    metricValues: result.metricValues,
    metrics: result.metrics,
    baselineRecord: emaUpdate(progress.record, snapshotFor(result.metricValues)),
    history: newHistory,
    clarityForSoundmap: clarityPerWordForSoundmap,
    now,
  });

  return {
    status: 'scored',
    shown: { score: Math.round(shownScore), stars, feedback },
    raw: result.metrics,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computeBaselineGains(
  metricValues: readonly MetricValue[],
  baseline: Record<string, number>,
): Record<string, number> {
  const gains: Record<string, number> = {};
  for (const m of metricValues) {
    if (!m.computed) continue;
    const b = baseline[m.key];
    if (b != null) gains[m.key] = m.value - b;
  }
  return gains;
}

function snapshotFor(metricValues: readonly MetricValue[]): Record<string, number> {
  const snap: Record<string, number> = {};
  for (const m of metricValues) if (m.computed) snap[m.key] = m.value;
  return snap;
}

interface PersistParams {
  level: Level;
  metricValues: readonly MetricValue[];
  metrics: RawMetrics;
  baselineRecord: Awaited<ReturnType<typeof loadBaselines>>;
  history: FeedbackHistory;
  clarityForSoundmap: { refWord: string; failed: boolean; smeared: boolean }[] | null;
  now: number;
}

async function persistSideEffects(p: PersistParams): Promise<void> {
  await setJson(STORAGE_KEYS.feedback, p.history);
  await saveBaselines(p.baselineRecord);

  // Raw metrics — internal only (HC-4), capped history.
  const rawLog = (await getJson<{ at: number; level: Level; metrics: RawMetrics }[]>(STORAGE_KEYS.raw)) ?? [];
  rawLog.push({ at: p.now, level: p.level, metrics: p.metrics });
  await setJson(STORAGE_KEYS.raw, rawLog.slice(-100));

  // Soundmap update for tongue twisters.
  if (p.level === 'tongue_twister' && p.clarityForSoundmap) {
    const updates = p.clarityForSoundmap.map((w) => ({
      clusters: extractClusters(w.refWord),
      failed: w.failed || w.smeared,
    }));
    const soundmap = await loadSoundmap();
    await saveSoundmap(updateSoundmap(soundmap, updates));
  }
}

/** Minimal LITE-mode acoustic scoring (§9). */
function liteResult(params: AnalyzeCapturedParams): AnalysisResult {
  const { level, locale, rank, vad } = params;

  if (level === 'vocabulary') {
    // Vocabulary needs STT — skip without penalty (§9).
    return retry('nothing_recognized', locale, locale === 'en'
      ? 'Full analysis needs the voice pack — this level is skipped for now.'
      : 'Для этого уровня нужен голосовой пакет — уровень пока пропущен.');
  }
  if (!vad || vad.speechDbfs.length === 0) {
    return retry('mostly_silence', locale);
  }

  const loud = computeLoudness(vad.speechDbfs, vad.noiseFloor, vad.speechDurationMs);
  // Rough punctuation proxy: reward a moderate number of pauses (structure).
  const punctProxy = vad.pauses.length > 0 ? 0.5 : 0.3;
  const raw = 100 * (0.6 * loud.loudness + 0.4 * punctProxy);
  const shownScore = applyCurve(raw, rank);

  const feedback: Feedback = {
    praise: locale === 'en' ? 'Your voice came through clearly.' : 'Голос звучит уверенно.',
    growth: locale === 'en'
      ? 'Full analysis will unlock once the voice pack is installed.'
      : 'Полный анализ появится после установки голосового пакета.',
    action: locale === 'en' ? 'Install the language pack in settings.' : 'Установи языковой пакет в настройках.',
    growthCategory: 'lite',
  };

  return {
    status: 'scored',
    shown: { score: Math.round(shownScore), stars: starsFor(shownScore), feedback },
    raw: { raw, mode: 'LITE', loudness: loud.loudness },
    liteMode: true,
  };
}
