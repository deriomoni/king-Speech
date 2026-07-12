/**
 * Platform dispatcher for the STT adapter.
 *
 * Selects the iOS or Android implementation at runtime. A future whisper.cpp /
 * Kazakh adapter (§9 TODO) would be selected here based on locale/capability
 * without changing any caller.
 */

import { createAndroidAdapter } from './adapter.android';
import { createIosAdapter } from './adapter.ios';
import { SttAdapter } from './types';

let cached: SttAdapter | null = null;

export function createSttAdapter(): SttAdapter {
  if (cached) return cached;
  let os = 'ios';
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    os = (require('react-native') as { Platform: { OS: string } }).Platform.OS;
  } catch {
    // Non-RN context (e.g. tests): default to the iOS implementation, which
    // resolves to LITE anyway when the native module is absent.
  }
  cached = os === 'android' ? createAndroidAdapter() : createIosAdapter();
  return cached;
}

/** Test-only: clear the memoized adapter. */
export function __resetSttAdapterCache(): void {
  cached = null;
}
