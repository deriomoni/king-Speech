// ---------------------------------------------------------------------------
// Role scenarios — the two-sided dialogue the player performs on /role-stage.
// See docs/roles-gameplay.md for the mechanics and how to add a scenario.
//
// A scenario is a short scripted play with ONE live actor (the player):
//   persona  → who the player talks to (customer, guest, viewers, producer…)
//   goals    → 2–3 things the player must achieve (shown on /role-brief,
//              tracked live, judged by the AI on /role-result)
//   opening  → when set, the PLAYER speaks first (bloggers, stage acts);
//              otherwise the opponent opens the scene
//   beats    → 6–10 opponent lines. Each one waits for the player to answer
//              (speech, then a pause) before the next bubble appears.
//              `reply` is the player's line for the scripted (teleprompter) mode.
//   ending   → the opponent's last line, picked by how the scene went
// ---------------------------------------------------------------------------

export interface LocalizedText {
  ru: string;
  en: string;
}

/** Which overlay family the stage renders. */
export type SceneKind = "chat" | "live" | "stage";

/** Stage-show flavours (only for kind === "stage"). */
export type StageVariant = "weather" | "showman" | "host" | "comedian" | "interview" | "voice";

/**
 * Who says a beat. Defaults to the scenario persona.
 *  viewer  — a live-stream comment (nick + avatar)
 *  troll   — a hostile comment / heckler the player should handle
 *  cue     — an off-camera instruction (producer in the earpiece, director)
 *  guest   — a second character (event guest, passenger…)
 */
export type BeatTone = "persona" | "viewer" | "troll" | "cue" | "guest";

export interface BeatSpeaker {
  name: string | LocalizedText;
  avatar: string;
  tone?: BeatTone;
}

/** A visual card shown with a beat (weather map tile, program item, character sheet). */
export interface SceneCard {
  icon: string;
  title: LocalizedText;
  sub?: LocalizedText;
  /** Big value on the card, e.g. "+24°" or "21:30". */
  value?: string;
}

export interface ScenarioBeat {
  /** The opponent's line. */
  line: LocalizedText;
  /** Player's scripted answer to this line (teleprompter mode). */
  reply: LocalizedText;
  /** Alternative opponent line used when the player stayed silent on the previous beat. */
  ifSilent?: LocalizedText;
  /** Override speaker (viewer comment, producer cue, heckler…). */
  from?: BeatSpeaker;
  /** The goal this beat puts in play — answering it fully ticks the goal live. */
  goal?: string;
  /** How much a full answer moves the mood meter (default +7). Negative-feeling beats can give more. */
  mood?: number;
  /** Optional on-screen card shown with this beat. */
  card?: SceneCard;
  /** Interview: camera flashes when the line lands. */
  flash?: boolean;
  /** Live: pin this comment as the question of the moment. */
  pin?: boolean;
}

export interface ScenarioGoal {
  id: string;
  text: LocalizedText;
  /**
   * Lower-case word STEMS that suggest the goal was attempted. Used for the
   * offline fallback scoring on the server (and documentation for the judge).
   */
  keywords: { ru: string[]; en: string[] };
}

export interface ScenarioPersona {
  name: LocalizedText;
  avatar: string;
  /** Short mood line under the name: «Спешит и сомневается». */
  mood: LocalizedText;
  /** One-sentence description for /role-brief. */
  about: LocalizedText;
}

export interface ScenarioChip {
  icon: string;
  label: LocalizedText;
}

export interface RoleScenario {
  roleId: string;
  kind: SceneKind;
  variant?: StageVariant;
  persona: ScenarioPersona;
  goals: ScenarioGoal[];
  /** The player opens the scene with this line (scripted text; improv sees a hint). */
  opening?: LocalizedText;
  /** Short improv hint for the opening («Поприветствуй эфир и назови тему»). */
  openingHint?: LocalizedText;
  beats: ScenarioBeat[];
  ending: { win: LocalizedText; lose: LocalizedText };
  /** Persona's nudge when the player is silent (falls back to a generic one). */
  nudge?: LocalizedText;
  /** Quick context chips (budget, weather, time pressure…). */
  chips?: ScenarioChip[];
  /** Live streams: viewers at the start. */
  startViewers?: number;
  /** Live streams: role-flavoured ambient comments (mixed with generic chatter). */
  ambient?: LocalizedText[];
  /** Label for the mood meter («Настроение клиента», «Смех зала»…). */
  meterLabel?: LocalizedText;
}

// --- compact authoring helpers ---------------------------------------------

export const L = (ru: string, en: string): LocalizedText => ({ ru, en });

/** beat(lineRu, lineEn, replyRu, replyEn, extra?) */
export function beat(
  lineRu: string,
  lineEn: string,
  replyRu: string,
  replyEn: string,
  extra: Partial<Omit<ScenarioBeat, "line" | "reply">> = {},
): ScenarioBeat {
  return { line: L(lineRu, lineEn), reply: L(replyRu, replyEn), ...extra };
}

export function goal(id: string, ru: string, en: string, kwRu: string[], kwEn: string[]): ScenarioGoal {
  return { id, text: L(ru, en), keywords: { ru: kwRu, en: kwEn } };
}

/** A viewer / troll / cue speaker. */
export function who(name: string | LocalizedText, avatar: string, tone: BeatTone = "viewer"): BeatSpeaker {
  return { name, avatar, tone };
}
