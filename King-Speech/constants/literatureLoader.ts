import { z } from "zod";
import type { ReadingCategory } from "@/constants/gameContent";
import literatureRaw from "@/assets/content/king_speech_literature_content.json";

/**
 * Loader for the "reading" (literature) levels.
 *
 * Content lives in `assets/content/king_speech_literature_content.json`
 * (one entry per module, 1..67). This loader validates the JSON once at
 * import time with zod, then serves it to the reading screen. To change or
 * add literature, edit ONLY the JSON — no code changes required.
 *
 * The collection is Russian-language, so callers should fall back to the
 * legacy hardcoded content for `lang === "en"`.
 */

const LiteratureModuleSchema = z.object({
  module: z.number().int().positive(),
  title: z.string(), // module name, e.g. "Первый шаг"
  author: z.string(), // e.g. "Александр Пушкин"
  work: z.string(), // e.g. "«Если жизнь тебя обманет…»"
  kind: z.string(), // e.g. "Стихотворение", "Басня", "Стихотворение в прозе"
  meta: z.string().optional().default(""), // e.g. "1825 год"
  teaser: z.string().optional().default(""),
  body: z.array(z.string()).min(1), // stanzas / paragraphs; lines split on "\n"
});

export type LiteratureModule = z.infer<typeof LiteratureModuleSchema>;

const parsed = z.array(LiteratureModuleSchema).safeParse(literatureRaw);
if (!parsed.success) {
  // Don't crash the app on a bad content edit — degrade to the legacy path.
  console.warn(
    "[literatureLoader] invalid literature content JSON:",
    parsed.error.issues.slice(0, 3),
  );
}

const LITERATURE: LiteratureModule[] = parsed.success ? parsed.data : [];
const BY_MODULE = new Map<number, LiteratureModule>(
  LITERATURE.map((m) => [m.module, m]),
);

/** Get the literature entry for a module (1..67), or null if missing/invalid. */
export function getLiterature(moduleId: number): LiteratureModule | null {
  return BY_MODULE.get(moduleId) ?? null;
}

/** "reading" → 1, "reading2" → 2, … "reading67" → 67. */
export function getModuleFromReadingId(levelId: string): number {
  const m = /^reading(\d*)$/.exec(levelId);
  if (!m) return 1;
  return m[1] ? parseInt(m[1], 10) : 1;
}

/** Derive the reading display category from the literary `kind`. */
export function literatureCategory(kind: string): ReadingCategory {
  const k = kind.toLowerCase();
  if (k.includes("басн")) return "fable";
  if (k.includes("проз")) return "prose"; // "Стихотворение в прозе"
  return "poetry";
}

/**
 * Join body stanzas into the single string ReadingLevelView expects:
 * lines are split on "\n" (poetry karaoke), paragraphs on a blank line.
 */
export function getLiteratureFullText(mod: LiteratureModule): string {
  return mod.body
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .join("\n\n");
}
