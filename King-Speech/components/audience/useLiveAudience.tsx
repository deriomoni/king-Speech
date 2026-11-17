// Shared driver for the live Show Time hall: one Audience per mount (a new
// seating / outfits / cast mix every time the level opens), stage events,
// the voice-driven chatter rate and the chat bubbles next to the talkers' mouths.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Text, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { Cairo, type Backend } from "./cairo";
import { Audience, HALL, loadCast, setSpriteMeta, type Person } from "./scene";

export type AudiencePhase = "idle" | "live" | "done";
export type LiveAudienceProps = {
  width: number;
  /** "idle" before the speaker walks out, "live" while speaking, "done" after */
  phase: AudiencePhase;
  /** house lights slider, 0..1 — the hall turns into silhouettes */
  dim: number;
  /** live slider value while dragging (read every frame, no re-render needed) */
  dimRef?: React.MutableRefObject<number>;
  lang: "ru" | "en";
  /** recent mic levels 0..1 (newest last): pauses → more chatter, a strong voice → quieter hall */
  levelsRef?: React.MutableRefObject<number[]>;
  /** lighting kit (spotlights + bulbs), chosen by the module */
  variant?: number;
};
export const HALL_RATIO = HALL.H / HALL.W;

// eslint-disable-next-line @typescript-eslint/no-require-imports
const RAW = require("@/assets/showtime/audience/live/cast.json");
// eslint-disable-next-line @typescript-eslint/no-require-imports
export const SPRITE_META: { file: string; cat: string; w: number; h: number; tone: number[] }[] = require("@/assets/showtime/audience/live/sprites.json");
export const SPRITES: Record<string, number> = {
  "clap_1.png": require("@/assets/showtime/audience/live/clap_1.png"),
  "clap_3.png": require("@/assets/showtime/audience/live/clap_3.png"),
  "clap_5.png": require("@/assets/showtime/audience/live/clap_5.png"),
  "popcorn_hand_0.png": require("@/assets/showtime/audience/live/popcorn_hand_0.png"),
  "popcorn_hand_1.png": require("@/assets/showtime/audience/live/popcorn_hand_1.png"),
  "popcorn_hand_2.png": require("@/assets/showtime/audience/live/popcorn_hand_2.png"),
  "popcorn_hand_3.png": require("@/assets/showtime/audience/live/popcorn_hand_3.png"),
  "kernel_3.png": require("@/assets/showtime/audience/live/kernel_3.png"),
  "kernel_4.png": require("@/assets/showtime/audience/live/kernel_4.png"),
  "kernel_5.png": require("@/assets/showtime/audience/live/kernel_5.png"),
};

let CAST: Person[] | null = null;
const getCast = () => {
  if (!CAST) { setSpriteMeta(SPRITE_META); CAST = loadCast(RAW); }
  // each mount dresses its own copy (outfits / per-frame scratch live on the person)
  return CAST.map((p) => ({ ...p, G: { ...p.G } }));
};

const CHAT: Record<"ru" | "en", string[]> = {
  ru: ["шу-шу", "а ты знал?", "хм…", "тсс!", "ого", "интересно", "согласен", "ха-ха", "м-да", "слушай…", "серьёзно?", "ну да"],
  en: ["psst", "did you know?", "hmm…", "shh!", "wow", "interesting", "agreed", "ha-ha", "well…", "listen…", "really?", "yeah"],
};

type Bubble = { id: number; x: number; y: number; text: string; side: 1 | -1 };
const FPS = 20;

/** past this point of the slider the room goes to silhouettes; the switch is a
 * short timed cross-fade (two render passes only while it runs), the rest of
 * the slider's travel is the smooth black sheet the stage lays over the hall */
const SIL_AT = 0.3;
const SIL_FADE_SEC = 0.35;
const silOf = (dim: number) => (dim > SIL_AT ? 1 : 0);

export function useLiveAudience<H>(props: LiveAudienceProps, backend: Backend<H> | null, draw: (A: Audience, cr: Cairo<H>, t: number, sil: number) => void) {
  const { width, phase, dim, lang, levelsRef } = props;
  const k = width / HALL.W;
  const engine = useMemo(() => {
    if (!backend) return null;
    const cr = new Cairo<H>(backend);
    const A = new Audience(getCast(), cr as Cairo<any>, (Date.now() ^ (Math.random() * 1e9)) >>> 0);
    A.variant = props.variant ?? 0;
    return { A, cr };
  }, [backend]);
  useEffect(() => { if (engine) engine.A.variant = props.variant ?? 0; }, [engine, props.variant]);
  const t0 = useRef(Date.now());
  const now = () => (Date.now() - t0.current) / 1000;
  const ownDim = useRef(dim); ownDim.current = dim;
  const dimRef = props.dimRef ?? ownDim;
  const silMix = useRef(0);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const bubbleId = useRef(0);

  // stage events
  const phaseRef = useRef<AudiencePhase>("idle");
  useEffect(() => {
    if (!engine || phase === phaseRef.current) return;
    if (phase === "live") engine.A.start(now());
    if (phase === "done") engine.A.finish(now());
    phaseRef.current = phase;
  }, [phase, engine]);

  // chat bubbles by the talkers' mouths (a turn or two of each little conversation)
  useEffect(() => {
    if (!engine) return;
    const A = engine.A;
    A.onTalk = (j, start, dur) => {
      if (Math.random() > 0.55) return;
      const delay = Math.max(0, (start - now()) * 1000);
      timers.current.push(setTimeout(() => {
        if (phaseRef.current !== "live") return;
        const [mx, my] = A.mouthAt(j); const head = A.headSize(j);
        const id = ++bubbleId.current; const words = CHAT[lang];
        const side: 1 | -1 = mx * k > width * 0.62 ? -1 : 1;
        const b: Bubble = { id, x: (mx + side * head * 0.12) * k, y: (my - head * 0.08) * k, text: words[Math.floor(Math.random() * words.length)], side };
        setBubbles((p) => [...p.slice(-2), b]);
        timers.current.push(setTimeout(() => setBubbles((p) => p.filter((x) => x.id !== id)), Math.min(dur, 1.8) * 1000 + 500));
      }, delay));
    };
    return () => { A.onTalk = undefined; timers.current.forEach(clearTimeout); timers.current = []; };
  }, [engine, lang, k, width]);

  // frame loop
  useEffect(() => {
    if (!engine) return;
    let raf = 0, last = 0, alive = true;
    const loop = () => {
      if (!alive) return;
      const ms = Date.now();
      if (ms - last >= 1000 / FPS) {
        last = ms; const t = now();
        const lv = levelsRef?.current;
        if (lv && lv.length > 10) {
          const recent = lv.slice(-30); const avg = recent.reduce((a, v) => a + v, 0) / recent.length;
          // quiet stretch → the hall gets chattier; a confident voice keeps it attentive
          engine.A.chatRate = avg < 0.18 ? 2.2 : avg > 0.45 ? 0.6 : 1;
        }
        engine.A.tick(t);
        const target = silOf(dimRef.current); const step = 1 / (FPS * SIL_FADE_SEC);
        silMix.current = target > silMix.current ? Math.min(target, silMix.current + step) : Math.max(target, silMix.current - step);
        const m = silMix.current; const eased = m * m * (3 - 2 * m);
        draw(engine.A, engine.cr, t, eased);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { alive = false; cancelAnimationFrame(raf); };
  }, [engine, draw]);

  const overlay = (
    <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, width, height: width * HALL_RATIO }}>
      {bubbles.map((b) => (
        <Animated.View
          key={b.id}
          entering={FadeIn.duration(220)}
          exiting={FadeOut.duration(320)}
          style={{
            position: "absolute", top: b.y - 22, ...(b.side > 0 ? { left: b.x } : { right: width - b.x }),
            opacity: 0.9 - silOf(dim) * 0.35,
          }}
        >
          <View style={{ backgroundColor: "rgba(255,255,255,0.94)", borderRadius: 9, paddingHorizontal: 7, paddingVertical: 3, borderWidth: 1, borderColor: "rgba(13,10,10,0.85)" }}>
            <Text style={{ color: "#141012", fontSize: 10, fontFamily: "Geologica_500Medium" }}>{b.text}</Text>
          </View>
          <View style={{ position: "absolute", bottom: -3, [b.side > 0 ? "left" : "right"]: 5, width: 7, height: 7, backgroundColor: "rgba(255,255,255,0.94)", borderColor: "rgba(13,10,10,0.85)", borderLeftWidth: 1, borderBottomWidth: 1, transform: [{ rotate: b.side > 0 ? "-45deg" : "45deg" }] } as any} />
        </Animated.View>
      ))}
    </View>
  );
  return { overlay, k };
}
