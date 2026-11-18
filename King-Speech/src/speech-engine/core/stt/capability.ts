/**
 * STT capability detection (spec §4.4, §9).
 *
 * Detects availability, on-device support and per-word confidence, then caches
 * the result under `se:capability:v1`. The cache is keyed by locale so a
 * locale switch re-detects (spec §10).
 *
 * Kazakh: the app passes 'kk-KZ' (see `toBcp47` in types.ts) through the same
 * native detection. Where the OS recognizer has no kk-KZ support the start/
 * result path yields nothing and the engine falls back to LITE scoring (§9),
 * exactly as for any unsupported locale. A dedicated whisper.cpp adapter
 * would satisfy the `SttAdapter` interface and be selected in `adapter.ts`
 * — TODO only.
 */

import { getJson, setJson, STORAGE_KEYS } from '../storage';
import { getNativeSttModule } from './module';
import { SttCapability } from './types';

interface CapabilityCache {
  locale: string;
  capability: SttCapability;
}

/**
 * Whether per-word confidence is available on this platform.
 *
 * iOS `SFSpeechRecognizer` returns per-segment confidence (FULL). Android
 * frequently omits it; the Android adapter recovers what it can (§4.3) but at
 * detection time we conservatively assume confidence may be absent there.
 */
function platformWordConfidence(): boolean {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { Platform } = require('react-native') as { Platform: { OS: string } };
  return Platform.OS === 'ios';
}

async function detectFresh(locale: string): Promise<SttCapability> {
  const mod = getNativeSttModule();
  if (!mod) {
    return { available: false, onDevice: false, locale, wordConfidence: false };
  }

  let available = false;
  try {
    available = mod.isRecognitionAvailable();
  } catch {
    available = false;
  }
  if (!available) {
    return { available: false, onDevice: false, locale, wordConfidence: false };
  }

  let onDevice = false;
  try {
    onDevice = mod.supportsOnDeviceRecognition ? mod.supportsOnDeviceRecognition() : false;
  } catch {
    onDevice = false;
  }

  return {
    available: true,
    onDevice,
    locale,
    wordConfidence: platformWordConfidence(),
  };
}

/**
 * Detect capability, using the cached value when the locale matches. Pass
 * `forceRefresh` after an OS update or locale change to invalidate (§10).
 */
export async function detectCapability(
  locale: string,
  forceRefresh = false,
): Promise<SttCapability> {
  if (!forceRefresh) {
    const cached = await getJson<CapabilityCache>(STORAGE_KEYS.capability);
    if (cached && cached.locale === locale) return cached.capability;
  }
  const capability = await detectFresh(locale);
  await setJson<CapabilityCache>(STORAGE_KEYS.capability, { locale, capability });
  return capability;
}
