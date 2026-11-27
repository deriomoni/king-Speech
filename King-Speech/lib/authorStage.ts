import AsyncStorage from "@react-native-async-storage/async-storage";
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
      if (!/[0-9A-Za-zА-Яа-яЁёӘәҒғҚқҢңӨөҰұҮүҺһІі]/.test(line) && out.length) out[out.length - 1] += line;
      else out.push(line);
    }
  }
  return out;
}

// ── My Studio drafts (local) ────────────────────────────────────────────────
// Every speech the player saves in My Studio lands here first; from the drafts
// list it can be read on the stage, and published from the score screen.

export const AUTHOR_DRAFTS_KEY = "@kingspeech_author_drafts_v1";

export type AuthorCategoryId = "holidays" | "business" | "study" | "kids";

export type AuthorDraft = {
  id: string;
  title: string;
  category: AuthorCategoryId;
  text: string;
  coverUri?: string;
  updatedAt: number;
  /** Set once the speech was sent to the public catalog. */
  publishedAt?: number;
};

export async function readAuthorDrafts(): Promise<AuthorDraft[]> {
  try {
    const raw = await AsyncStorage.getItem(AUTHOR_DRAFTS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.sort((a: AuthorDraft, b: AuthorDraft) => b.updatedAt - a.updatedAt) : [];
  } catch {
    return [];
  }
}

export async function writeAuthorDrafts(drafts: AuthorDraft[]): Promise<void> {
  await AsyncStorage.setItem(AUTHOR_DRAFTS_KEY, JSON.stringify(drafts.slice(0, 50)));
}

/** Insert or update one draft (newest first). */
export async function upsertAuthorDraft(draft: AuthorDraft): Promise<void> {
  const rest = (await readAuthorDrafts()).filter((d) => d.id !== draft.id);
  await writeAuthorDrafts([draft, ...rest]);
}

export async function deleteAuthorDraft(id: string): Promise<void> {
  await writeAuthorDrafts((await readAuthorDrafts()).filter((d) => d.id !== id));
}
