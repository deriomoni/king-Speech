// Registry of the 24 role scenarios (two-sided dialogues for /role-stage).
// Data lives in constants/scenarios/*; mechanics in docs/roles-gameplay.md.
import type { Lang } from "@/context/LangContext";
import type { LocalizedText, RoleScenario, BeatSpeaker } from "./scenarios/types";
import { SALES_SCENARIOS } from "./scenarios/sales";
import { BLOGGER_SCENARIOS } from "./scenarios/blogger";
import { COMMUNICATION_SCENARIOS } from "./scenarios/communication";
import { PUBLIC_SCENARIOS } from "./scenarios/public";

export * from "./scenarios/types";

export const ROLE_SCENARIOS: RoleScenario[] = [
  ...SALES_SCENARIOS,
  ...BLOGGER_SCENARIOS,
  ...COMMUNICATION_SCENARIOS,
  ...PUBLIC_SCENARIOS,
];

const BY_ID: Record<string, RoleScenario> = Object.fromEntries(ROLE_SCENARIOS.map((s) => [s.roleId, s]));

export function getRoleScenario(roleId: string | undefined | null): RoleScenario | undefined {
  return roleId ? BY_ID[roleId] : undefined;
}

export function lt(text: LocalizedText | string | undefined, lang: Lang): string {
  if (!text) return "";
  if (typeof text === "string") return text;
  return text[lang] ?? text.ru;
}

export function speakerName(s: BeatSpeaker | undefined, scenario: RoleScenario, lang: Lang): string {
  return s ? lt(s.name, lang) : lt(scenario.persona.name, lang);
}

/** Generic nudges when a scenario has none. */
export const GENERIC_NUDGE: Record<RoleScenario["kind"], LocalizedText> = {
  chat: { ru: "Эй, вы тут?", en: "Hey, are you there?" },
  live: { ru: "ау, звук пропал? 👀", en: "hello? did the sound cut out? 👀" },
  stage: { ru: "(тишина в зале)", en: "(silence in the room)" },
};

/** Generic live-stream chatter mixed with each blogger scenario's own ambient lines. */
export const GENERIC_AMBIENT: LocalizedText[] = [
  { ru: "привет 👋", en: "hi 👋" },
  { ru: "❤️❤️❤️", en: "❤️❤️❤️" },
  { ru: "только зашла, о чём речь?", en: "just joined, what's up?" },
  { ru: "🔥", en: "🔥" },
  { ru: "лайк не глядя", en: "liked already" },
  { ru: "ты лучший!", en: "you're the best!" },
  { ru: "+", en: "+" },
  { ru: "смотрю с работы 🤫", en: "watching from work 🤫" },
];

export const VIEWER_NICKS = [
  ["alina.v", "🦊"], ["tima_go", "🐼"], ["nika_sun", "🌻"], ["roma.88", "🎮"], ["yulia_k", "🌙"],
  ["den.izi", "🛹"], ["masha_m", "🍓"], ["gleb_x", "⚡"], ["sasha.art", "🎨"], ["vika_life", "🌈"],
] as const;
