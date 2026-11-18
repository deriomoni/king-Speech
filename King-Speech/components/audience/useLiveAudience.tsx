// Shared driver for the live Show Time hall: one Audience per mount (a new
// seating / outfits / cast mix every time the level opens), stage events,
// the voice-driven chatter rate and the chat bubbles next to the talkers' mouths.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Text, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { Cairo, type Backend } from "./cairo";
import type { Lang } from "@/context/LangContext";
import { Audience, HALL, loadCast, setBackgroundSprites, setSpriteMeta, type BgSprite, type Person } from "./scene";

export type AudiencePhase = "idle" | "live" | "done";
export type LiveAudienceProps = {
  width: number;
  /** "idle" before the speaker walks out, "live" while speaking, "done" after */
  phase: AudiencePhase;
  /** house lights slider, 0..1 — the hall turns into silhouettes */
  dim: number;
  /** live slider value while dragging (read every frame, no re-render needed) */
  dimRef?: React.MutableRefObject<number>;
  lang: Lang;
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
  "bg_1.png": require("@/assets/showtime/audience/live/bg_1.png"),
  "bg_2.png": require("@/assets/showtime/audience/live/bg_2.png"),
  "bg_3.png": require("@/assets/showtime/audience/live/bg_3.png"),
  "bg_4.png": require("@/assets/showtime/audience/live/bg_4.png"),
  "bg_5.png": require("@/assets/showtime/audience/live/bg_5.png"),
  "bg_6.png": require("@/assets/showtime/audience/live/bg_6.png"),
  "bg_7.png": require("@/assets/showtime/audience/live/bg_7.png"),
  "bg_8.png": require("@/assets/showtime/audience/live/bg_8.png"),
  "bg_9.png": require("@/assets/showtime/audience/live/bg_9.png"),
  "bg_10.png": require("@/assets/showtime/audience/live/bg_10.png"),
  "bg_11.png": require("@/assets/showtime/audience/live/bg_11.png"),
  "bg_12.png": require("@/assets/showtime/audience/live/bg_12.png"),
  "bg_13.png": require("@/assets/showtime/audience/live/bg_13.png"),
  "bg_14.png": require("@/assets/showtime/audience/live/bg_14.png"),
  "bg_15.png": require("@/assets/showtime/audience/live/bg_15.png"),
  "bg_16.png": require("@/assets/showtime/audience/live/bg_16.png"),
  "bg_17.png": require("@/assets/showtime/audience/live/bg_17.png"),
  "bg_18.png": require("@/assets/showtime/audience/live/bg_18.png"),
};

/** background extras («Фоновые», «Операторы»): picture size, eye line, shoulder share */
export const BG_SPRITES: BgSprite[] = [
  { file: "bg_1.png", w: 708, h: 1240, eye: 0.33, body: 0.9 },  // девушка с каре, в телефоне
  { file: "bg_2.png", w: 823, h: 1208, eye: 0.29, body: 0.85 }, // дедушка спит
  { file: "bg_3.png", w: 814, h: 1322, eye: 0.39, body: 0.9 },  // девушка с блокнотом
  { file: "bg_4.png", w: 843, h: 1278, eye: 0.33, body: 0.85 }, // парень в маске, в телефоне
  { file: "bg_5.png", w: 957, h: 1266, eye: 0.26, body: 0.72 }, // оператор с камерой
  { file: "bg_6.png", w: 807, h: 1270, eye: 0.29, body: 0.9 },  // девушка в шляпе
  { file: "bg_7.png", w: 850, h: 1271, eye: 0.33, body: 0.85 }, // парень в капюшоне с телефоном
  { file: "bg_8.png", w: 874, h: 1297, eye: 0.26, body: 0.9 },  // бородач говорит по телефону
  { file: "bg_9.png", w: 737, h: 1165, eye: 0.28, body: 0.88 },  // мужчина в наушниках скучает
  { file: "bg_10.png", w: 697, h: 1119, eye: 0.29, body: 0.88 }, // уставшая девушка в худи
  { file: "bg_11.png", w: 747, h: 1175, eye: 0.26, body: 0.88 }, // парень спит на плече
  { file: "bg_12.png", w: 624, h: 1193, eye: 0.32, body: 0.9 },  // девушка в очках и маске
  { file: "bg_13.png", w: 763, h: 1191, eye: 0.31, body: 0.85 }, // кудрявая говорит по телефону
  { file: "bg_14.png", w: 642, h: 1171, eye: 0.33, body: 0.92 }, // женщина, руки скрещены
  { file: "bg_15.png", w: 718, h: 1238, eye: 0.37, body: 0.88 }, // подросток с консолью
  { file: "bg_16.png", w: 728, h: 1240, eye: 0.33, body: 0.9 },  // мужчина читает программку
  { file: "bg_17.png", w: 743, h: 1134, eye: 0.33, body: 0.85 }, // девушка мечтает
  { file: "bg_18.png", w: 781, h: 1278, eye: 0.34, body: 0.9 },  // бабушка вяжет
];

let CAST: Person[] | null = null;
const getCast = () => {
  if (!CAST) { setSpriteMeta(SPRITE_META); setBackgroundSprites(BG_SPRITES); CAST = loadCast(RAW); }
  // each mount dresses its own copy (outfits / per-frame scratch live on the person)
  return CAST.map((p) => ({ ...p, G: { ...p.G } }));
};

const CHAT: Record<Lang, string[]> = {
  ru: ["шу-шу", "а ты знал?", "хм…", "тсс!", "ого", "интересно", "согласен", "ха-ха", "м-да", "слушай…", "серьёзно?", "ну да"],
  en: ["psst", "did you know?", "hmm…", "shh!", "wow", "interesting", "agreed", "ha-ha", "well…", "listen…", "really?", "yeah"],
  kk: ["сыбыр-сыбыр", "білесің бе?", "хм…", "тсс!", "ойбай", "қызық екен", "келісемін", "ха-ха", "иә-ә…", "тыңдашы…", "шын ба?", "солай-солай"],
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
