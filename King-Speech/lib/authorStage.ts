// «Стать автором» → Show Time stage hand-off (app/author.tsx ↔ app/showtime-stage.tsx).
// The stage writes the result here when the reading is finished; the editor
// consumes it on focus and opens its publish sheet.
export const AUTHOR_READ_RESULT_KEY = "@kingspeech_author_read_result_v1";

export type AuthorReadResult = { draftId: string; recordingUri: string; at: number };

// Split the player's text into stage lines the way theme speeches are
// structured: one sentence per line. Paragraph breaks always start a new line.
// No lookbehind / \p{L}: keep it Hermes-safe.
export function splitAuthorText(text: string): string[] {
  const out: string[] = [];
  for (const para of text.replace(/\r\n?/g, "\n").split("\n")) {
    const p = para.replace(/\s+/g, " ").trim();
    if (!p) continue;
    const parts = p.match(/[^.!?…]+(?:[.!?…]+["»”')\]]*|$)/g) ?? [p];
    for (const raw of parts) {
      const line = raw.trim();
      if (!line) continue;
      // A stray «—» or «...» on its own joins the previous sentence.
      if (!/[0-9A-Za-zА-Яа-яЁё]/.test(line) && out.length) out[out.length - 1] += line;
      else out.push(line);
    }
  }
  return out;
}
