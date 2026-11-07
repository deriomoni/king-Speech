// Catalog categories for the Show Time tab ("Каталог тем").
//
// TODO(design): the Figma catalog uses Популярные / Бизнес / Праздники / Учёба /
// Для детей, but the speech themes in app/showtime-stage.tsx carry no category
// metadata and the current content is motivational / life topics (no holiday or
// kids' speeches yet). Until the content gets a real `category` field, the
// themes are grouped by hand here by levelId. "Популярные" is always the
// carousel set (the first N themes). Unknown levelIds fall into "life".

export type ThemeCategoryId =
  | "popular"
  | "confidence"
  | "growth"
  | "people"
  | "society"
  | "life"
  | "art";

export const THEME_CATEGORIES: { id: ThemeCategoryId; ru: string; en: string }[] = [
  { id: "popular", ru: "Популярные", en: "Popular" },
  { id: "confidence", ru: "Уверенность", en: "Confidence" },
  { id: "growth", ru: "Успех", en: "Success" },
  { id: "people", ru: "Отношения", en: "People" },
  { id: "society", ru: "Общество", en: "Society" },
  { id: "life", ru: "Жизнь", en: "Life" },
  { id: "art", ru: "Искусство", en: "Art" },
];

const n = (nums: number[]) => nums.map((i) => (i === 1 ? "showtime" : `showtime${i}`));

const BY_CATEGORY: Record<Exclude<ThemeCategoryId, "popular">, string[]> = {
  confidence: n([7, 9, 10, 14, 18, 32, 33, 35, 37, 41, 67]),
  growth: n([5, 13, 21, 22, 24, 34, 45, 46, 50, 53, 55, 57, 58]),
  people: n([4, 20, 23, 27, 28, 29, 31, 38, 52, 56, 60]),
  society: n([12, 17, 40, 42, 44, 47, 48, 49, 51]),
  art: n([1, 2, 3, 6, 8, 19, 25]),
  life: [],
};

const LEVEL_TO_CATEGORY: Record<string, ThemeCategoryId> = {};
for (const [cat, ids] of Object.entries(BY_CATEGORY)) {
  for (const id of ids) LEVEL_TO_CATEGORY[id] = cat as ThemeCategoryId;
}

export function categoryOf(levelId: string): Exclude<ThemeCategoryId, "popular"> {
  return (LEVEL_TO_CATEGORY[levelId] as Exclude<ThemeCategoryId, "popular">) ?? "life";
}
