import { useEffect, useState } from "react";
import { Platform } from "react-native";

const DEFAULT_SAMPLE_COUNT = 60;

const cache = new Map<string, number[]>();
const failed = new Set<string>();
const inflight = new Map<string, Promise<number[] | null>>();

async function decodeWebWaveform(
  uri: string,
  count: number,
): Promise<number[] | null> {
  if (typeof window === "undefined") return null;
  const w = window as Window &
    typeof globalThis & {
      AudioContext?: typeof AudioContext;
      webkitAudioContext?: typeof AudioContext;
    };
  const Ctx = w.AudioContext ?? w.webkitAudioContext;
  if (!Ctx) return null;
  let ctx: AudioContext | null = null;
  try {
    const resp = await fetch(uri);
    if (!resp.ok) return null;
    const buf = await resp.arrayBuffer();
    ctx = new Ctx();
    const decoded = await ctx.decodeAudioData(buf.slice(0));
    const ch = decoded.getChannelData(0);
    if (ch.length === 0) return null;
    const blockSize = Math.max(1, Math.floor(ch.length / count));
    const out: number[] = new Array(count).fill(0);
    let max = 0;
    for (let i = 0; i < count; i++) {
      const start = i * blockSize;
      const end = Math.min(ch.length, start + blockSize);
      let sum = 0;
      for (let j = start; j < end; j++) sum += Math.abs(ch[j]);
      const avg = end > start ? sum / (end - start) : 0;
      out[i] = avg;
      if (avg > max) max = avg;
    }
    if (max > 0) {
      for (let i = 0; i < count; i++) out[i] = Math.min(1, out[i] / max);
    }
    return out;
  } catch {
    return null;
  } finally {
    if (ctx) {
      try {
        await ctx.close();
      } catch {
        // ignore
      }
    }
  }
}

export type WaveformState =
  | { status: "loading" }
  | { status: "ready"; samples: number[] }
  | { status: "unavailable" };

export function useAudioWaveform(
  uri: string,
  count: number = DEFAULT_SAMPLE_COUNT,
): WaveformState {
  const initial: WaveformState = (() => {
    const cached = cache.get(uri);
    if (cached) return { status: "ready", samples: cached };
    if (failed.has(uri)) return { status: "unavailable" };
    return { status: "loading" };
  })();
  const [state, setState] = useState<WaveformState>(initial);

  useEffect(() => {
    const cached = cache.get(uri);
    if (cached) {
      setState({ status: "ready", samples: cached });
      return;
    }
    if (failed.has(uri)) {
      setState({ status: "unavailable" });
      return;
    }
    if (Platform.OS !== "web") {
      // No real decoder available on native yet — see follow-up.
      failed.add(uri);
      setState({ status: "unavailable" });
      return;
    }

    let cancelled = false;
    setState({ status: "loading" });

    let task = inflight.get(uri);
    if (!task) {
      task = decodeWebWaveform(uri, count).then((result) => {
        if (result) cache.set(uri, result);
        else failed.add(uri);
        return result;
      });
      inflight.set(uri, task);
      task.finally(() => inflight.delete(uri));
    }

    task
      .then((result) => {
        if (cancelled) return;
        if (result) setState({ status: "ready", samples: result });
        else setState({ status: "unavailable" });
      })
      .catch(() => {
        if (cancelled) return;
        failed.add(uri);
        setState({ status: "unavailable" });
      });

    return () => {
      cancelled = true;
    };
  }, [uri, count]);

  return state;
}
