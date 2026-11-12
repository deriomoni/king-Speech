/**
 * expo-av compatibility shim.
 *
 * `expo-av` was removed in Expo SDK 57. This module re-implements the small
 * slice of the old `expo-av` API that King Speech actually uses, on top of the
 * new `expo-audio` and `expo-video` packages, so existing call sites keep
 * working unchanged. Import `{ Audio }`, `{ Video }`, `{ ResizeMode }` from
 * here (`@/lib/av`) instead of from `"expo-av"`.
 *
 * Covered surface (see the migration audit):
 *   Audio.requestPermissionsAsync / getPermissionsAsync
 *   Audio.setAudioModeAsync
 *   Audio.RecordingOptionsPresets  (-> expo-audio RecordingPresets)
 *   Audio.Recording.createAsync + start/pause/stopAndUnload/getURI +
 *     setProgressUpdateInterval / setOnRecordingStatusUpdate (metering)
 *   Audio.Sound.createAsync + play/pause/stop/replay/setPosition/unload +
 *     setOnPlaybackStatusUpdate / getStatusAsync
 *   Video + ResizeMode  (looping muted mascot clip)
 */
import React from "react";
import { Platform } from "react-native";
import { requireNativeModule } from "expo-modules-core";
import {
  createAudioPlayer,
  setAudioModeAsync as _setAudioModeAsync,
  requestRecordingPermissionsAsync,
  getRecordingPermissionsAsync,
  RecordingPresets,
} from "expo-audio";
import { useVideoPlayer, VideoView } from "expo-video";

// The native ExpoAudio module — accessed lazily. `requireNativeModule` throws
// on web (no native module there), and the imperative AudioRecorder is only
// ever used on native anyway (web records through MediaRecorder), so we resolve
// it on first use instead of at import time. `expo-audio`'s index (imported
// above) has already applied its prototype patches by then.
let _nativeAudio: any = null;
function getNativeAudio(): any {
  if (!_nativeAudio) _nativeAudio = requireNativeModule("ExpoAudio");
  return _nativeAudio;
}

const RECORDING_STATUS_UPDATE = "recordingStatusUpdate";
const PLAYBACK_STATUS_UPDATE = "playbackStatusUpdate";

// Mirrors expo-audio's internal utils/options.createRecordingOptions so we can
// build the platform option shape its AudioRecorder constructor expects,
// without a fragile deep import into build/.
function createRecordingOptions(options: any = {}) {
  const common = {
    extension: options.extension,
    sampleRate: options.sampleRate,
    numberOfChannels: options.numberOfChannels,
    bitRate: options.bitRate,
    isMeteringEnabled: options.isMeteringEnabled ?? false,
  };
  if (Platform.OS === "ios") {
    return { ...common, directory: options.directory, ...(options.ios ?? {}) };
  }
  if (Platform.OS === "android") {
    return {
      ...common,
      directory: options.directory,
      ...(options.android ?? {}),
    };
  }
  return { ...common, ...(options.web ?? {}) };
}

// ---------------------------------------------------------------------------
// Audio mode
// ---------------------------------------------------------------------------
async function setAudioModeAsync(mode: any = {}): Promise<void> {
  const mapped: any = {};
  if ("allowsRecording" in mode) mapped.allowsRecording = mode.allowsRecording;
  if ("allowsRecordingIOS" in mode)
    mapped.allowsRecording = mode.allowsRecordingIOS;
  if ("playsInSilentMode" in mode)
    mapped.playsInSilentMode = mode.playsInSilentMode;
  if ("playsInSilentModeIOS" in mode)
    mapped.playsInSilentMode = mode.playsInSilentModeIOS;
  if ("staysActiveInBackground" in mode)
    mapped.shouldPlayInBackground = mode.staysActiveInBackground;
  if ("shouldPlayInBackground" in mode)
    mapped.shouldPlayInBackground = mode.shouldPlayInBackground;
  if ("playThroughEarpieceAndroid" in mode)
    mapped.shouldRouteThroughEarpiece = mode.playThroughEarpieceAndroid;
  try {
    await _setAudioModeAsync(mapped);
  } catch {
    // Non-fatal: an unsupported mode key must never crash a screen.
  }
}

// ---------------------------------------------------------------------------
// Recording  (native only — web callers use MediaRecorder directly)
// ---------------------------------------------------------------------------
class Recording {
  private _rec: any = null;
  private _statusCb: ((s: any) => void) | null = null;
  private _interval = 250;
  private _timer: ReturnType<typeof setInterval> | null = null;

  static async createAsync(
    options: any = {},
    onStatusUpdate?: (s: any) => void,
    interval?: number,
  ): Promise<{ recording: Recording; status: any }> {
    const rec = new Recording();
    const platformOptions = createRecordingOptions(options);
    rec._rec = new (getNativeAudio().AudioRecorder)(platformOptions);
    if (onStatusUpdate) rec.setOnRecordingStatusUpdate(onStatusUpdate);
    if (interval) rec._interval = interval;
    try {
      await rec._rec.prepareToRecordAsync(options);
    } catch {
      // Some platforms auto-prepare; ignore if prepare is unnecessary.
    }
    try {
      rec._rec.record();
    } catch {}
    rec._startPolling();
    return { recording: rec, status: rec._safeStatus() };
  }

  private _safeStatus(): any {
    try {
      return this._rec?.getStatus?.() ?? {};
    } catch {
      return {};
    }
  }

  private _startPolling() {
    this._stopPolling();
    if (!this._statusCb || !this._rec) return;
    this._timer = setInterval(() => {
      if (!this._statusCb) return;
      const st = this._safeStatus();
      // expo-av consumers read `status.metering` (dBFS) and `durationMillis`.
      this._statusCb(st);
    }, Math.max(50, this._interval));
  }

  private _stopPolling() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  }

  setOnRecordingStatusUpdate(cb: ((s: any) => void) | null) {
    this._statusCb = cb;
    if (cb) this._startPolling();
    else this._stopPolling();
  }

  setProgressUpdateInterval(ms: number) {
    this._interval = ms || 250;
    if (this._statusCb) this._startPolling();
  }

  // expo-av used startAsync() both to begin and to resume; the app only calls
  // it to resume after pause.
  async startAsync() {
    try {
      this._rec?.record();
    } catch {}
    this._startPolling();
  }

  async pauseAsync() {
    try {
      this._rec?.pause();
    } catch {}
  }

  async stopAndUnloadAsync() {
    this._stopPolling();
    try {
      await this._rec?.stop();
    } catch {}
  }

  getURI(): string | null {
    try {
      return this._rec?.uri ?? null;
    } catch {
      return null;
    }
  }

  async getStatusAsync() {
    return this._safeStatus();
  }
}

// ---------------------------------------------------------------------------
// Sound  (playback)
// ---------------------------------------------------------------------------
function mapPlaybackStatus(p: any): any {
  if (!p) return { isLoaded: false };
  const currentTime = typeof p.currentTime === "number" ? p.currentTime : 0;
  const duration = typeof p.duration === "number" ? p.duration : undefined;
  return {
    isLoaded: p.isLoaded ?? true,
    isPlaying: !!p.playing,
    positionMillis: Math.round(currentTime * 1000),
    durationMillis: duration != null ? Math.round(duration * 1000) : undefined,
    didJustFinish: !!p.didJustFinish,
    rate: p.playbackRate ?? 1,
  };
}

class Sound {
  private _player: any = null;
  private _sub: any = null;

  static async createAsync(
    source: any,
    initialStatus: any = {},
    onStatusUpdate?: (s: any) => void,
  ): Promise<{ sound: Sound; status: any }> {
    const snd = new Sound();
    // expo-av accepted { uri }, require(...) (number) and URL strings — all of
    // which expo-audio's AudioSource also accepts.
    snd._player = createAudioPlayer(source, 250);
    if (onStatusUpdate) snd.setOnPlaybackStatusUpdate(onStatusUpdate);
    try {
      if (typeof initialStatus?.volume === "number")
        snd._player.volume = initialStatus.volume;
      if (typeof initialStatus?.isLooping === "boolean")
        snd._player.loop = initialStatus.isLooping;
      if (typeof initialStatus?.rate === "number")
        snd._player.setPlaybackRate?.(initialStatus.rate);
      if (initialStatus?.shouldPlay) snd._player.play();
    } catch {}
    return { sound: snd, status: mapPlaybackStatus(snd._player) };
  }

  setOnPlaybackStatusUpdate(cb: ((s: any) => void) | null) {
    try {
      this._sub?.remove?.();
    } catch {}
    this._sub = null;
    if (cb && this._player) {
      this._sub = this._player.addListener(
        PLAYBACK_STATUS_UPDATE,
        (st: any) => cb(mapPlaybackStatus(st)),
      );
    }
  }

  async playAsync() {
    try {
      this._player?.play();
    } catch {}
  }

  async pauseAsync() {
    try {
      this._player?.pause();
    } catch {}
  }

  async stopAsync() {
    try {
      this._player?.pause();
      await this._player?.seekTo(0);
    } catch {}
  }

  async replayAsync() {
    try {
      await this._player?.seekTo(0);
      this._player?.play();
    } catch {}
  }

  async setPositionAsync(ms: number) {
    try {
      await this._player?.seekTo((ms || 0) / 1000);
    } catch {}
  }

  async setRateAsync(rate: number) {
    try {
      this._player?.setPlaybackRate?.(rate);
    } catch {}
  }

  async setVolumeAsync(v: number) {
    try {
      if (this._player) this._player.volume = v;
    } catch {}
  }

  async setIsLoopingAsync(looping: boolean) {
    try {
      if (this._player) this._player.loop = looping;
    } catch {}
  }

  async getStatusAsync() {
    return mapPlaybackStatus(this._player);
  }

  async unloadAsync() {
    try {
      this._sub?.remove?.();
    } catch {}
    this._sub = null;
    // Pause first: on iOS `remove()` alone can leave the native player audible.
    try {
      this._player?.pause();
    } catch {}
    try {
      this._player?.remove();
    } catch {}
    this._player = null;
  }
}

export const Audio = {
  Sound,
  Recording,
  setAudioModeAsync,
  requestPermissionsAsync: requestRecordingPermissionsAsync,
  getPermissionsAsync: getRecordingPermissionsAsync,
  RecordingOptionsPresets: RecordingPresets,
};

// ---------------------------------------------------------------------------
// Video  (only the looping mascot clip in OreoMascot)
// ---------------------------------------------------------------------------
export enum ResizeMode {
  CONTAIN = "contain",
  COVER = "cover",
  STRETCH = "stretch",
}

interface VideoProps {
  source: any;
  style?: any;
  resizeMode?: ResizeMode | string;
  isLooping?: boolean;
  shouldPlay?: boolean;
  isMuted?: boolean;
  [key: string]: any;
}

export function Video({
  source,
  style,
  resizeMode,
  isLooping,
  shouldPlay,
  isMuted,
}: VideoProps) {
  const player = useVideoPlayer(source, (p: any) => {
    try {
      p.loop = !!isLooping;
      p.muted = !!isMuted;
      if (shouldPlay) p.play();
    } catch {}
  });

  React.useEffect(() => {
    try {
      if (shouldPlay) player.play();
      else player.pause();
    } catch {}
  }, [shouldPlay, player]);

  const contentFit =
    resizeMode === ResizeMode.COVER
      ? "cover"
      : resizeMode === ResizeMode.STRETCH
        ? "fill"
        : "contain";

  return (
    <VideoView
      player={player}
      style={style}
      contentFit={contentFit as any}
      nativeControls={false}
    />
  );
}

export default Audio;
