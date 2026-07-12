/**
 * Paid Show Time feedback formatter (spec §7.4).
 *
 * THIS IS THE ONLY FILE IN THE ENGINE ALLOWED TO MAKE A NETWORK CALL (HC-2).
 * It sends ONLY metrics + short worst-case quotes to the existing Express
 * backend, which prompts the model as an EDITOR ("turn metrics into 3
 * supportive paragraphs"). No audio, no full transcript ever leaves the device.
 *
 * Timeout 6 s; on ANY error/offline it returns null → the caller silently falls
 * back to the template feedback. The user never sees a network error.
 */

import { Locale, PlayerRank, RawMetrics } from '../../types';

export const FEEDBACK_ENDPOINT = '/api/feedback/showtime';
export const REQUEST_TIMEOUT_MS = 6000;

export interface ShowTimeFeedbackPayload {
  metrics: RawMetrics;
  /** ≤4 short phrases with fillers/tautology, ≤12 words each. */
  worstQuotes: string[];
  locale: Locale;
  rank: PlayerRank;
}

/** Resolve the backend base URL from env (mirrors the app's getApiUrl, no app import). */
function resolveBaseUrl(): string | null {
  const env = (typeof process !== 'undefined' && process.env) || ({} as Record<string, string>);
  const full = env.EXPO_PUBLIC_API_URL;
  if (full) return full.replace(/\/$/, '');
  const domain = env.EXPO_PUBLIC_DOMAIN;
  if (domain) return `https://${domain}`.replace(/\/$/, '');
  return null;
}

/**
 * Ask the backend to format the metrics into supportive prose. Returns the text
 * on success, or null on timeout / offline / any error (silent fallback).
 */
export async function formatShowTimeFeedback(
  payload: ShowTimeFeedbackPayload,
): Promise<string | null> {
  const base = resolveBaseUrl();
  if (!base) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${base}${FEEDBACK_ENDPOINT}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { feedback?: string };
    return typeof data.feedback === 'string' && data.feedback.trim().length > 0
      ? data.feedback.trim()
      : null;
  } catch {
    return null; // offline / timeout / parse error → silent fallback
  } finally {
    clearTimeout(timer);
  }
}
