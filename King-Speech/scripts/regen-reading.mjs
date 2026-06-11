#!/usr/bin/env node
// Surgically replaces all reading{N}: [...] blocks (N=1..67) in TASKS_RU and
// TASKS_EN inside constants/gameContent.ts with new content from the three
// reading pools (PROSE / POETRY / FABLES). Also injects READING_META entries
// for modules 7..67 at the // __READING_META_GENERATED__ marker.
//
// Categories cycle Prose → Poetry → Fable across modules 1..67.
// Modules 1..6 use hand-picked entries listed in HARDCODED_PIECES.

import { readFileSync, writeFileSync } from "node:fs";
import { PROSE_PIECES, POETRY_PIECES, FABLES } from "./tasks-data.mjs";

const J = JSON.stringify;

const READING_POOLS = { prose: PROSE_PIECES, poetry: POETRY_PIECES, fable: FABLES };
const CATEGORIES = ["prose", "poetry", "fable"];
function categoryFor(mod) { return CATEGORIES[(mod - 1) % 3]; }
function pickFromPool(mod) {
  const cat = categoryFor(mod);
  const pool = READING_POOLS[cat];
  const idx = Math.floor((mod - 1) / 3) % pool.length;
  return { piece: pool[idx], category: cat };
}

// Hand-picked entries for modules 1..6 — must match the cycle and the
// READING_META hardcoded entries in constants/gameContent.ts.
const HARDCODED_PIECES = {
  1: PROSE_PIECES[0],   // Толстой / Анна Каренина
  2: { // Pushkin "Зимнее утро" — not in the pool; first 3 stanzas.
    authorRu: "Александр Пушкин", titleRu: "Зимнее утро",
    authorEn: "Alexander Pushkin", titleEn: "Winter Morning",
    category: "poetry",
    stanzas: [
      { ru: "Мороз и солнце; день чудесный!\nЕщё ты дремлешь, друг прелестный -\nПора, красавица, проснись:\nОткрой сомкнуты негой взоры\nНавстречу северной Авроры,\nЗвездою севера явись!",
        en: "Frost and sunshine; what a wondrous day!\nYou still are slumbering, my charming friend -\nIt's time, my beauty, to wake up:\nOpen your eyes, now closed in blissful languor,\nGreet the northern Aurora,\nAppear as the star of the north!" },
      { ru: "Вечор, ты помнишь, вьюга злилась,\nНа мутном небе мгла носилась;\nЛуна, как бледное пятно,\nСквозь тучи мрачные желтела,\nИ ты печальная сидела -\nА нынче... погляди в окно:",
        en: "Last evening, you remember, the blizzard raged,\nMurk drifted across a clouded sky;\nThe moon, like a pale stain,\nGleamed yellow through the gloomy clouds,\nAnd you sat sad -\nBut now... look out of the window:" },
      { ru: "Под голубыми небесами\nВеликолепными коврами,\nБлестя на солнце, снег лежит;\nПрозрачный лес один чернеет,\nИ ель сквозь иней зеленеет,\nИ речка подо льдом блестит.",
        en: "Beneath the blue skies,\nLike magnificent carpets,\nGlittering in the sun, the snow lies;\nThe transparent forest alone darkens,\nAnd the spruce shows green through the rime,\nAnd the river glitters under the ice." },
    ],
  },
  3: FABLES[0],         // Krylov / Ворона и Лисица
  4: PROSE_PIECES[1],   // Чехов / Дама с собачкой
  5: { // Lermontov "Парус" — full poem in 3 stanzas.
    authorRu: "Михаил Лермонтов", titleRu: "Парус",
    authorEn: "Alfred Tennyson", titleEn: "The Eagle",
    category: "poetry",
    stanzas: [
      { ru: "Белеет парус одинокий\nВ тумане моря голубом!..\nЧто ищет он в стране далёкой?\nЧто кинул он в краю родном?..",
        en: "He clasps the crag with crooked hands;\nClose to the sun in lonely lands,\nRing'd with the azure world, he stands." },
      { ru: "Играют волны - ветер свищет,\nИ мачта гнётся и скрыпит...\nУвы! он счастия не ищет\nИ не от счастия бежит!",
        en: "The wrinkled sea beneath him crawls;\nHe watches from his mountain walls,\nAnd like a thunderbolt he falls." },
      { ru: "Под ним струя светлей лазури,\nНад ним луч солнца золотой...\nА он, мятежный, просит бури,\nКак будто в бурях есть покой!",
        en: "Above the cliff he holds his sway,\nThe restless winds his only prey,\nAnd watches all the world below." },
    ],
  },
  6: FABLES[1],         // Krylov / Стрекоза и Муравей
};

function pieceForMod(mod) {
  if (mod <= 6) return { piece: HARDCODED_PIECES[mod], category: HARDCODED_PIECES[mod].category };
  return pickFromPool(mod);
}

const INSTR = {
  ru: {
    prose: "Читай прозу естественно, выделяй образы, выдерживай паузы между предложениями.",
    poetry: "Читай стихотворение размеренно, с интонацией и паузами.",
    fable: "Читай басню как живую сцену: меняй голоса, играй характеры, оттеняй мораль.",
  },
  en: {
    prose: "Read the prose naturally, bring out the imagery, hold pauses between sentences.",
    poetry: "Read the poem with measured rhythm, intonation, and pauses.",
    fable: "Read the fable as a living scene: change voices, play characters, highlight the moral.",
  },
};

const TIPS = {
  ru: {
    prose: ["Не торопись", "Каждое предложение - картина", "Естественные паузы"],
    poetry: ["Чувствуй размер стиха", "Каждый образ - картина", "Финал - вдох"],
    fable: ["Голос рассказчика - спокойный", "Персонажи - разные голоса", "Мораль - с весом"],
  },
  en: {
    prose: ["Don't rush", "Each sentence is a picture", "Natural pauses"],
    poetry: ["Feel the meter", "Each image is a picture", "End with breath"],
    fable: ["Narrator stays calm", "Characters get distinct voices", "Deliver the moral with weight"],
  },
};

function buildReadingTaskBlock(lang, mod) {
  const { piece, category } = pieceForMod(mod);
  const lines = [];
  piece.stanzas.forEach((stz, i) => {
    const title = lang === "ru"
      ? `${piece.authorRu}: ${piece.titleRu} (${i + 1})`
      : `${piece.authorEn}: ${piece.titleEn} (${i + 1})`;
    const content = lang === "ru" ? stz.ru : stz.en;
    const tips = `[${TIPS[lang][category].map(x => J(x)).join(", ")}]`;
    lines.push(`    { taskNumber: ${i + 1}, title: ${J(title)}, instruction: ${J(INSTR[lang][category])}, content: ${J(content)}, tips: ${tips} },`);
  });
  return lines.join("\n");
}

function replaceReadingBlocks(src, lang) {
  // TASKS_RU / TASKS_EN block
  const tasksMarker = lang === "ru"
    ? "const TASKS_RU: Record<string, TaskData[]> = {"
    : "const TASKS_EN: Record<string, TaskData[]> = {";
  const start = src.indexOf(tasksMarker);
  if (start < 0) throw new Error(`Cannot find ${tasksMarker}`);
  // Walk to the matching closing `\n};\n`. We assume the next `\n};\n` after start
  // closes the TASKS map (no nested top-level `};` before that).
  const end = src.indexOf("\n};\n", start);
  if (end < 0) throw new Error(`Cannot find end of ${tasksMarker}`);
  let block = src.slice(start, end);

  let replaced = 0;
  for (let mod = 1; mod <= 67; mod++) {
    const id = mod === 1 ? "reading" : `reading${mod}`;
    // Match the entry: leading 2-space indent, id key, opening "[", entries, "  ],"
    // End delimiter is "\n  ],\n" which is unique enough per entry.
    const startKey = `\n  ${id}: [\n`;
    const idStart = block.indexOf(startKey);
    if (idStart < 0) {
      console.warn(`  ⚠ ${lang.toUpperCase()}: ${id} not found, skipping`);
      continue;
    }
    const bodyStart = idStart + startKey.length;
    // Try "  ],\n" (followed by next entry) or "  ],\n};\n" (last entry)
    let closeIdx = block.indexOf("\n  ],\n", bodyStart);
    if (closeIdx < 0) closeIdx = block.indexOf("\n  ],", bodyStart);
    if (closeIdx < 0) {
      console.warn(`  ⚠ ${lang.toUpperCase()}: ${id} close not found, skipping`);
      continue;
    }
    const newBody = buildReadingTaskBlock(lang, mod);
    block = block.slice(0, bodyStart) + newBody + block.slice(closeIdx);
    replaced++;
  }
  console.log(`  ✓ ${lang.toUpperCase()}: replaced ${replaced} reading blocks`);
  return src.slice(0, start) + block + src.slice(end);
}

function injectMeta(src) {
  const marker = "// __READING_META_GENERATED__";
  if (!src.includes(marker)) {
    console.warn("⚠ READING_META marker not found");
    return src;
  }
  const lines = [];
  for (let mod = 7; mod <= 67; mod++) {
    const { piece, category } = pickFromPool(mod);
    const id = `reading${mod}`;
    lines.push(`  ${id}: { authorRu: ${J(piece.authorRu)}, titleRu: ${J(piece.titleRu)}, authorEn: ${J(piece.authorEn)}, titleEn: ${J(piece.titleEn)}, category: "${category}" },`);
  }
  // Replace any prior generated block + marker with fresh entries + marker.
  // Strategy: find marker, then walk back to delete any prior generated lines
  // (between the closing `reading6: { ... }` line and the marker).
  const markerIdx = src.indexOf(marker);
  // Find the line start of the marker
  const lineStart = src.lastIndexOf("\n", markerIdx) + 1;
  // Walk back through any prior generated `  reading{N}: { ... },` lines
  let cursor = lineStart;
  // Hardcoded entries end at reading6: { ... },\n. Find that.
  const hardcodedEndMarker = "category: \"fable\" },\n"; // last hardcoded line ends with this
  const hardcodedEndIdx = src.indexOf(hardcodedEndMarker, src.indexOf("reading6:"));
  if (hardcodedEndIdx < 0) throw new Error("reading6 hardcoded entry not found");
  const insertAfter = hardcodedEndIdx + hardcodedEndMarker.length;
  // Replace everything from insertAfter up to and including the marker line
  const markerLineEnd = src.indexOf("\n", markerIdx) + 1;
  const generated = lines.join("\n") + "\n  " + marker + "\n";
  return src.slice(0, insertAfter) + generated + src.slice(markerLineEnd);
}

const file = "constants/gameContent.ts";
let src = readFileSync(file, "utf-8");
console.log("Replacing TASKS_RU reading blocks...");
src = replaceReadingBlocks(src, "ru");
console.log("Replacing TASKS_EN reading blocks...");
src = replaceReadingBlocks(src, "en");
console.log("Injecting READING_META generated entries...");
src = injectMeta(src);
writeFileSync(file, src);
console.log("✓ Done.");
