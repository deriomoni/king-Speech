// Web view of the live Show Time hall: same renderer, drawn into an HTML canvas.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Image, View } from "react-native";
import { Canvas2DBackend } from "./canvas2dBackend";
import { HALL } from "./scene";
import { HALL_RATIO, SPRITES, useLiveAudience, type LiveAudienceProps } from "./useLiveAudience";

function uriOf(mod: any): string | undefined {
  if (typeof mod === "string") return mod;
  return mod?.uri ?? mod?.default ?? (Image as any).resolveAssetSource?.(mod)?.uri;
}

function LiveAudienceWeb(props: LiveAudienceProps) {
  const { width } = props;
  const height = width * HALL_RATIO;
  const dpr = Math.min(2, typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [ctx, setCtx] = useState<CanvasRenderingContext2D | null>(null);
  const [imgs, setImgs] = useState<Record<string, HTMLImageElement> | null>(null);
  useEffect(() => {
    let dead = false; const out: Record<string, HTMLImageElement> = {};
    Promise.all(Object.entries(SPRITES).map(([name, mod]) => new Promise<void>((res) => {
      const im = new window.Image(); im.onload = () => res(); im.onerror = () => res(); im.src = uriOf(mod) || ""; out[name] = im;
    }))).then(() => { if (!dead) setImgs(out); });
    return () => { dead = true; };
  }, []);
  useEffect(() => { if (canvasRef.current) setCtx(canvasRef.current.getContext("2d")); }, []);
  const backend = useMemo(() => (ctx && imgs ? new Canvas2DBackend(ctx, imgs) : null), [ctx, imgs]);
  const draw = useCallback((A: any, cr: any, t: number, sil: number) => {
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    cr.reset(); const s = (width * dpr) / HALL.W; cr.scale(s, s);
    A.frame(t, sil);
  }, [ctx, width, dpr]);
  const { overlay } = useLiveAudience(props, backend, draw);
  return (
    <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, width, height }}>
      {React.createElement("canvas", { ref: canvasRef, width: Math.round(width * dpr), height: Math.round(height * dpr), style: { width, height, display: "block" } })}
      {overlay}
    </View>
  );
}

export const LiveAudience: React.ComponentType<LiveAudienceProps> | null = LiveAudienceWeb;
export { HALL_RATIO } from "./useLiveAudience";
export type { AudiencePhase, LiveAudienceProps } from "./useLiveAudience";
