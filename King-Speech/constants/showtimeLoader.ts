import { z } from "zod";
import showtimeRaw from "@/assets/content/king_speech_showtime_content.json";

/**
 * Loader for Show Time speech content (variant B).
 *
 * Content lives in `assets/content/king_speech_showtime_content.json`
 * (one entry per module, 1..67), generated from the author's docx
 * "King_Speech_ShowTime_все_модули.docx". To change a Show Time speech or a
 * module name, edit ONLY the JSON.
 *
 * The JSON carries the speech text + the canonical module name (`title`).
 * The visual theme (gradients, colors, stage interior, timer) stays in
 * `SPEECH_THEMES` inside `app/showtime-stage.tsx`; this content is merged
 * over it for Russian. The collection is Russian-only — callers fall back
 * to the legacy English themes for `lang === "en"`.
 */

const PartSchema = z.object({
  title: z.string(),
  lines: z.array(z.string()).min(1),
});

const ShowtimeModuleSchema = z.object({
  module: z.number().int().positive(),
  rank: z.number().int().min(1).max(5),
  title: z.string(), // canonical module name, e.g. "Первый шаг"
  parts: z.array(PartSchema).min(1),
});

export type ShowtimePart = z.infer<typeof PartSchema>;
export type ShowtimeModule = z.infer<typeof ShowtimeModuleSchema>;

const parsed = z.array(ShowtimeModuleSchema).safeParse(showtimeRaw);
if (!parsed.success) {
  console.warn(
    "[showtimeLoader] invalid Show Time content JSON:",
    parsed.error.issues.slice(0, 3),
  );
}

const SHOWTIME: ShowtimeModule[] = parsed.success ? parsed.data : [];
const BY_MODULE = new Map<number, ShowtimeModule>(
  SHOWTIME.map((m) => [m.module, m]),
);

/** "showtime" → 1, "showtime2" → 2, … "showtime67" → 67. */
export function getModuleFromShowtimeId(levelId: string): number {
  const m = /^showtime(\d*)$/.exec(levelId);
  if (!m) return 1;
  return m[1] ? parseInt(m[1], 10) : 1;
}

/** Show Time entry for a module (1..67), or null if missing/invalid. */
export function getShowtimeModule(moduleId: number): ShowtimeModule | null {
  return BY_MODULE.get(moduleId) ?? null;
}

/** Canonical module display name ("Первый шаг", …), or null if unknown. */
export function getModuleName(moduleId: number): string | null {
  return BY_MODULE.get(moduleId)?.title ?? null;
}
