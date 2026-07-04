import { z } from "zod";
import tongueTwisterRaw from "@/assets/content/king_speech_tonguetwisters_content.json";

/**
 * Loader for tongue-twister levels (variant B).
 *
 * Content lives in `assets/content/king_speech_tonguetwisters_content.json`:
 *  - `daily`: standalone twisters with a phonetic `focus`
 *  - `groups`: twisters grouped by target sound
 *
 * Unlike literature/showtime, this JSON is NOT indexed per module. There are
 * 67 tongue-twister levels but a shared pool of ~100 twisters, so we assign
 * each module a deterministic slice of the flattened pool (daily first, then
 * every group's items, in file order). Module N gets `count` consecutive
 * twisters starting at offset (N-1)*count, wrapping around the pool. This is
 * stable across runs and varies content module-to-module. To change the
 * twisters, edit ONLY the JSON.
 *
 * Russian-only content — callers fall back to legacy text for `lang === "en"`.
 */

const TongueTwisterSchema = z.object({
  daily: z
    .array(z.object({ text: z.string(), focus: z.string().optional().default("") }))
    .default([]),
  groups: z
    .array(
      z.object({
        sound: z.string(),
        note: z.string().optional().default(""),
        items: z.array(z.string()).default([]),
      }),
    )
    .default([]),
});

export type TongueTwisterContent = z.infer<typeof TongueTwisterSchema>;

const parsed = TongueTwisterSchema.safeParse(tongueTwisterRaw);
if (!parsed.success) {
  console.warn(
    "[tongueTwisterLoader] invalid tongue-twister content JSON:",
    parsed.error.issues.slice(0, 3),
  );
}

const CONTENT: TongueTwisterContent = parsed.success
  ? parsed.data
  : { daily: [], groups: [] };

// Flattened, de-duplicated pool in a stable order: daily, then each group.
const POOL: string[] = (() => {
  const seen = new Set<string>();
  const pool: string[] = [];
  const push = (s: string) => {
    const t = s.trim();
    if (t && !seen.has(t)) {
      seen.add(t);
      pool.push(t);
    }
  };
  CONTENT.daily.forEach((d) => push(d.text));
  CONTENT.groups.forEach((g) => g.items.forEach(push));
  return pool;
})();

/**
 * Short twisters are over too fast to drill — say them twice. We return the
 * text on two lines so the player naturally repeats it (e.g. "От топота
 * копыт…" is only 6 words → doubled).
 */
function repeatIfShort(t: string): string {
  const words = t.trim().split(/\s+/).filter(Boolean).length;
  // ≤8 words = a single short phrase (e.g. "От топота копыт пыль по полю
  // летит" is 7) → drill it twice; longer compound twisters stay single.
  return words <= 8 ? `${t}\n${t}` : t;
}

/** "tonguetwister" → 1, "tonguetwister2" → 2, … */
export function getModuleFromTongueTwisterId(levelId: string): number {
  const m = /^tonguetwister(\d*)$/.exec(levelId);
  if (!m) return 1;
  return m[1] ? parseInt(m[1], 10) : 1;
}

/**
 * Deterministic slice of `count` twisters for a module (1..67). Returns []
 * when the pool is empty so callers can fall back to legacy content.
 */
export function getTongueTwistersForModule(
  moduleId: number,
  count: number,
): string[] {
  if (POOL.length === 0 || count <= 0) return [];
  const start = ((moduleId - 1) * count) % POOL.length;
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    out.push(repeatIfShort(POOL[(start + i) % POOL.length]));
  }
  return out;
}
