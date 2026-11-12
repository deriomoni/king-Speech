// Drives a role scenario (constants/roleScenarios.ts) during a take on /role-stage.
//
// Turn-taking is adaptive: after an opponent line appears, the hook waits for
// the player to SPEAK (mic level above an adaptive noise floor for at least
// `minSpeak`) and then PAUSE (≥1.2 s of quiet). Then a «…» typing indicator
// shows briefly and the next line lands. Fallbacks:
//   • nobody speaks → a nudge at 6 s, the scene moves on at 12 s (silent answer)
//   • the player is mid-sentence at 12 s → we wait up to 25 s
//   • no mic levels at all (web without analyser, metering unsupported) →
//     timed beats sized to the scripted reply
//
// Everything runs on a single 200 ms interval that exists ONLY while
// `running` is true (i.e. while the take is being recorded).
import { useCallback, useEffect, useRef, useState } from "react";
import type { Lang } from "@/context/LangContext";
import {
  GENERIC_AMBIENT,
  GENERIC_NUDGE,
  VIEWER_NICKS,
  lt,
  speakerName,
  type BeatTone,
  type RoleScenario,
  type SceneCard,
} from "@/constants/roleScenarios";

export type ScenarioMsgKind = "beat" | "ambient" | "nudge" | "ending" | "you";

export interface ScenarioMsg {
  key: string;
  kind: ScenarioMsgKind;
  text: string;
  name: string;
  avatar: string;
  tone: BeatTone;
  beatIndex?: number;
  card?: SceneCard;
  pin?: boolean;
  flash?: boolean;
  /** "you" bubbles: seconds the player spoke for this answer. */
  seconds?: number;
}

export type GoalState = "pending" | "done";
export type AnswerSignal = "full" | "short" | "silent";

export interface ScenarioRunSummary {
  /** Lines the player actually got to (opponent beats + ending), in order. */
  dialogue: { who: string; text: string; yourLine?: string; answer?: AnswerSignal }[];
  goals: { id: string; text: string; live: GoalState }[];
  outcome: "win" | "lose" | "open";
  mood: number;
  answered: number;
  silent: number;
  totalBeats: number;
}

const TICK = 200;
const PAUSE_MS = 1200;
const MAX_WAIT_MS = 12000;
const HARD_CAP_MS = 25000;
const NUDGE_MS = 6000;
const NO_METER_GRACE_MS = 2500;

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const words = (s: string) => s.split(/\s+/).filter(Boolean).length;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

interface Engine {
  prompt: number; // -1 = player's opening, else index of the beat awaiting an answer
  phase: "await" | "typing" | "done";
  awaitStart: number;
  speechMs: number;
  lastSpeechAt: number;
  nudged: boolean;
  typingUntil: number;
  lastSignal: AnswerSignal | null;
  startedAt: number;
  lastAmbientAt: number;
  nextAmbientGap: number;
  lastHeartAt: number;
  // mic
  levelSeen: boolean;
  lastLevelAt: number;
  floor: number;
  speaking: boolean;
  // scores
  mood: number;
  viewers: number;
  answered: number;
  silent: number;
  dialogue: ScenarioRunSummary["dialogue"];
  goals: Record<string, GoalState>;
  seq: number;
}

function freshEngine(s: RoleScenario | undefined): Engine {
  const now = Date.now();
  return {
    prompt: s?.opening ? -1 : 0,
    phase: s?.opening ? "await" : "typing",
    awaitStart: now,
    speechMs: 0,
    lastSpeechAt: 0,
    nudged: false,
    typingUntil: now + 1400,
    lastSignal: null,
    startedAt: now,
    lastAmbientAt: now,
    nextAmbientGap: 1800,
    lastHeartAt: 0,
    levelSeen: false,
    lastLevelAt: 0,
    floor: -55,
    speaking: false,
    mood: 50,
    viewers: s?.startViewers ?? 120,
    answered: 0,
    silent: 0,
    dialogue: [],
    goals: Object.fromEntries((s?.goals ?? []).map((g) => [g.id, "pending" as GoalState])),
    seq: 0,
  };
}

export function useRoleScenario({
  scenario,
  lang,
  scripted,
  running,
  onBeat,
}: {
  scenario: RoleScenario | undefined;
  lang: Lang;
  scripted: boolean;
  running: boolean;
  /** Fired when an opponent line lands (haptics, flashes). */
  onBeat?: (msg: ScenarioMsg) => void;
}) {
  const eng = useRef<Engine>(freshEngine(scenario));
  const [messages, setMessages] = useState<ScenarioMsg[]>([]);
  const [typing, setTyping] = useState(false);
  const [prompt, setPrompt] = useState(eng.current.prompt);
  const [goals, setGoals] = useState<Record<string, GoalState>>(eng.current.goals);
  const [mood, setMood] = useState(50);
  const [viewers, setViewers] = useState(eng.current.viewers);
  const [hearts, setHearts] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const [finished, setFinished] = useState(false);
  const [outcome, setOutcome] = useState<"win" | "lose" | null>(null);
  const onBeatRef = useRef(onBeat);
  onBeatRef.current = onBeat;

  const push = useCallback((m: Omit<ScenarioMsg, "key">) => {
    const e = eng.current;
    const msg = { ...m, key: `m${++e.seq}` };
    setMessages((prev) => {
      const next = [...prev, msg];
      return next.length > 40 ? next.slice(next.length - 40) : next;
    });
    return msg;
  }, []);

  const reset = useCallback(() => {
    eng.current = freshEngine(scenario);
    setMessages([]);
    setTyping(!scenario?.opening && !!scenario);
    setPrompt(eng.current.prompt);
    setGoals(eng.current.goals);
    setMood(50);
    setViewers(eng.current.viewers);
    setHearts(0);
    setSpeaking(false);
    setFinished(false);
    setOutcome(null);
  }, [scenario]);

  /** Mic level in dBFS from the recorder (native metering or web analyser). */
  const feedLevel = useCallback((db: number) => {
    if (typeof db !== "number" || !isFinite(db)) return;
    const e = eng.current;
    const now = Date.now();
    const v = clamp(db, -90, 0);
    e.levelSeen = true;
    e.lastLevelAt = now;
    // Adaptive noise floor: drops fast, creeps up slowly.
    if (v < e.floor) e.floor = e.floor * 0.6 + v * 0.4;
    else e.floor += (v - e.floor) * (e.speaking ? 0.002 : 0.02);
    const on = Math.max(e.floor + 12, -52);
    const off = Math.max(e.floor + 8, -56);
    if (!e.speaking && v > on) e.speaking = true;
    else if (e.speaking && v < off) e.speaking = false;
    if (e.speaking) e.lastSpeechAt = now;
  }, []);

  // --- the main loop -------------------------------------------------------
  useEffect(() => {
    if (!running || !scenario) return;
    reset();
    const s = scenario;
    const isLive = s.kind === "live";
    let lastSpeakingUi = false;
    let lastViewersUi = 0;
    let lastViewersAt = 0;
    let lastTick = Date.now();

    const showBeat = (i: number) => {
      const e = eng.current;
      const b = s.beats[i];
      const text = e.lastSignal === "silent" && b.ifSilent ? lt(b.ifSilent, lang) : lt(b.line, lang);
      const msg = push({
        kind: "beat",
        text,
        name: speakerName(b.from, s, lang),
        avatar: b.from?.avatar ?? s.persona.avatar,
        tone: b.from?.tone ?? "persona",
        beatIndex: i,
        card: b.card,
        pin: b.pin,
        flash: b.flash,
      });
      e.dialogue.push({ who: msg.name, text });
      e.prompt = i;
      e.phase = "await";
      e.awaitStart = Date.now();
      e.speechMs = 0;
      e.nudged = false;
      setPrompt(i);
      setTyping(false);
      onBeatRef.current?.(msg);
    };

    const finish = () => {
      const e = eng.current;
      const silentMost = e.silent > s.beats.length / 2;
      const win = scripted ? !silentMost : e.mood >= 50 && !silentMost;
      const text = lt(win ? s.ending.win : s.ending.lose, lang);
      const msg = push({ kind: "ending", text, name: lt(s.persona.name, lang), avatar: s.persona.avatar, tone: "persona" });
      e.dialogue.push({ who: msg.name, text });
      e.phase = "done";
      setTyping(false);
      setFinished(true);
      setOutcome(win ? "win" : "lose");
      onBeatRef.current?.(msg);
    };

    const answer = (signal: AnswerSignal) => {
      const e = eng.current;
      const spokeSec = Math.round(e.speechMs / 1000);
      if (e.prompt >= 0) {
        const b = s.beats[e.prompt];
        const delta = signal === "full" ? (b.mood ?? 7) : signal === "short" ? 2 : -12;
        e.mood = clamp(e.mood + delta, 0, 100);
        if (b.goal && signal === "full" && e.goals[b.goal] !== "done") {
          e.goals = { ...e.goals, [b.goal]: "done" };
          setGoals(e.goals);
        }
        const last = e.dialogue[e.dialogue.length - 1];
        if (last) {
          last.answer = signal;
          if (scripted) last.yourLine = lt(b.reply, lang);
        }
      } else if (signal === "full") {
        e.mood = clamp(e.mood + 5, 0, 100);
      }
      if (signal === "silent") e.silent += 1;
      else e.answered += 1;
      setMood(e.mood);
      e.lastSignal = signal;
      // The player's turn as a bubble (chat scenes only; streams/stages don't echo you).
      if (s.kind === "chat" && signal !== "silent") {
        const yourText = scripted
          ? lt(e.prompt >= 0 ? s.beats[e.prompt].reply : s.opening!, lang)
          : "";
        push({ kind: "you", text: yourText, name: "", avatar: "", tone: "persona", seconds: Math.max(1, spokeSec) });
      }
      if (signal === "full" && isLive) setHearts((h) => h + 3);

      // Next opponent line (or the ending) after a short «…».
      e.phase = "typing";
      e.typingUntil = Date.now() + rand(850, 1500);
      setTyping(true);
    };

    const tick = () => {
      const e = eng.current;
      const now = Date.now();
      const dt = now - lastTick;
      lastTick = now;
      const metered = e.levelSeen && now - e.lastLevelAt < 1500;
      const noMeter = !e.levelSeen && now - e.startedAt > NO_METER_GRACE_MS;
      if (metered && e.speaking) {
        e.speechMs += dt;
        // A stale "speaking" flag without fresh samples shouldn't count forever.
        if (now - e.lastLevelAt > 600) e.speaking = false;
      }
      const isSpeaking = metered && e.speaking;
      if (isSpeaking !== lastSpeakingUi) {
        lastSpeakingUi = isSpeaking;
        setSpeaking(isSpeaking);
      }

      if (e.phase === "typing" && now >= e.typingUntil) {
        const next = e.prompt + 1;
        if (next < s.beats.length) showBeat(next);
        else finish();
      } else if (e.phase === "await") {
        const waited = now - e.awaitStart;
        const replyText =
          e.prompt >= 0 ? lt(s.beats[e.prompt].reply, lang) : lt(s.opening ?? s.beats[0].reply, lang);
        if (noMeter) {
          // Timed fallback sized to the scripted reply.
          const t = clamp(3500 + words(replyText) * 330, 5000, 12000);
          if (waited >= t) answer("full");
        } else {
          const minSpeak = scripted ? clamp(words(replyText) * 220, 1500, 6000) : 1600;
          const quiet = now - e.lastSpeechAt;
          if (e.speechMs >= minSpeak && quiet >= PAUSE_MS) {
            answer(e.speechMs >= (scripted ? minSpeak : 3000) ? "full" : "short");
          } else if (waited >= MAX_WAIT_MS && (quiet >= PAUSE_MS || waited >= HARD_CAP_MS)) {
            answer(e.speechMs < 600 ? "silent" : e.speechMs >= 3000 ? "full" : "short");
          } else if (!e.nudged && waited >= NUDGE_MS && e.speechMs < 300 && e.prompt >= 0) {
            e.nudged = true;
            push({
              kind: "nudge",
              text: lt(s.nudge ?? GENERIC_NUDGE[s.kind], lang),
              name: lt(s.persona.name, lang),
              avatar: s.persona.avatar,
              tone: "persona",
            });
          }
        }
      }

      // Silence slowly cools the room.
      if (e.phase !== "done" && metered && now - e.lastSpeechAt > 4000 && now - e.startedAt > 4000) {
        e.mood = clamp(e.mood - dt / 2000, 0, 100);
      }

      if (isLive) {
        // Ambient chatter.
        if (now - e.lastAmbientAt > e.nextAmbientGap) {
          e.lastAmbientAt = now;
          e.nextAmbientGap = rand(2200, 4600) * (isSpeaking ? 0.8 : 1.3);
          const pool = [...(s.ambient ?? []), ...GENERIC_AMBIENT];
          const [nick, ava] = VIEWER_NICKS[Math.floor(Math.random() * VIEWER_NICKS.length)];
          push({ kind: "ambient", text: lt(pool[Math.floor(Math.random() * pool.length)], lang), name: nick, avatar: ava, tone: "viewer" });
        }
        // Viewers drift toward a target that follows the mood and the stream age.
        const ageMin = (now - e.startedAt) / 60000;
        const base = s.startViewers ?? 120;
        const target = base * (0.55 + e.mood / 55) * (1 + ageMin * 0.5) * (isSpeaking || noMeter ? 1.08 : 0.94);
        e.viewers += (target - e.viewers) * 0.03 + rand(-1.5, 1.5);
        e.viewers = Math.max(3, e.viewers);
        if (Math.abs(e.viewers - lastViewersUi) >= 1 && now - lastViewersAt >= 1000) {
          lastViewersAt = now;
          lastViewersUi = Math.round(e.viewers);
          setViewers(lastViewersUi);
        }
        if ((isSpeaking || noMeter) && now - e.lastHeartAt > rand(700, 1600)) {
          e.lastHeartAt = now;
          setHearts((h) => h + 1);
        }
      }
    };

    const id = setInterval(tick, TICK);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, scenario, lang, scripted]);

  /** Freeze the current run into a summary for scoring / the result screen. */
  const snapshot = useCallback((): ScenarioRunSummary | undefined => {
    if (!scenario) return undefined;
    const e = eng.current;
    const finishedNow = e.phase === "done";
    const silentMost = e.silent > scenario.beats.length / 2;
    return {
      dialogue: e.dialogue.map((d) => ({ ...d })),
      goals: scenario.goals.map((g) => ({ id: g.id, text: lt(g.text, lang), live: e.goals[g.id] ?? "pending" })),
      outcome: finishedNow ? ((scripted ? !silentMost : e.mood >= 50 && !silentMost) ? "win" : "lose") : "open",
      mood: Math.round(e.mood),
      answered: e.answered,
      silent: e.silent,
      totalBeats: scenario.beats.length,
    };
  }, [scenario, lang, scripted]);

  const currentBeat = scenario && prompt >= 0 ? scenario.beats[prompt] : undefined;

  return {
    messages,
    typing,
    prompt,
    currentBeat,
    awaitingOpening: !!scenario?.opening && prompt === -1 && !finished,
    goals,
    mood,
    viewers,
    hearts,
    speaking,
    finished,
    outcome,
    feedLevel,
    reset,
    snapshot,
  };
}
