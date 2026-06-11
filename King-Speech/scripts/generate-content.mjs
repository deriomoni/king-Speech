#!/usr/bin/env node
// Generates modules 7-67 content into constants/gameContent.ts and
// emits SPEECH_THEMES_RU / SPEECH_THEMES_EN blocks for showtime-stage.tsx.

import { readFileSync, writeFileSync } from "node:fs";
import { MODULE_THEMES, COLOR_PALETTE, SHOWTIME_PALETTE } from "./content-data.mjs";
import { SHOWTIME_TEXTS } from "./showtime-data.mjs";
import { TWISTERS, PROSE_PIECES, POETRY_PIECES, FABLES, WARMUP_SETS, INTERVIEW_SETS } from "./tasks-data.mjs";

// Reading category cycle: (mod-1) % 3 → 0=prose, 1=poetry, 2=fable.
// Pool index: Math.floor((mod-1)/3) % pool.length.
const READING_POOLS = [PROSE_PIECES, POETRY_PIECES, FABLES];
const READING_CATEGORIES = ["prose", "poetry", "fable"];
function pickReadingPiece(mod) {
  const cat = (mod - 1) % 3;
  const pool = READING_POOLS[cat];
  const idx = Math.floor((mod - 1) / 3) % pool.length;
  return { piece: pool[idx], category: READING_CATEGORIES[cat] };
}

const TYPES = ["warmup", "interview", "tonguetwister", "showtime", "reading"];
const ICONS = {
  warmup: "flame-outline",
  interview: "mic-outline",
  tonguetwister: "chatbubbles-outline",
  showtime: "videocam-outline",
  reading: "book-outline",
};

const J = JSON.stringify;

function levelId(type, mod) { return mod === 1 ? type : `${type}${mod}`; }

function escapeText(s) { return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n"); }

// ── Build LEVELS_RU/EN entries (modules 7-67) ────────────────────────────────
function buildLevels(lang) {
  const lines = [];
  for (let mod = 7; mod <= 67; mod++) {
    const theme = MODULE_THEMES[mod];
    const themeText = lang === "ru" ? theme.ru : theme.en;
    const subtitleByType = {
      warmup: lang === "ru" ? "Разогрев голоса" : "Voice warm-up",
      interview: lang === "ru" ? "Глубокая беседа" : "Deeper conversation",
      tonguetwister: lang === "ru" ? "Тренировка дикции" : "Diction training",
      showtime: lang === "ru" ? "На сцене" : "On the stage",
      reading: lang === "ru" ? "Выразительное чтение" : "Expressive reading",
    };
    const titleByType = {
      warmup: lang === "ru" ? `Разогрев ${mod}` : `Warm-Up ${mod}`,
      interview: lang === "ru" ? `Интервью ${mod}` : `Interview ${mod}`,
      tonguetwister: lang === "ru" ? `Скороговорки ${mod}` : `Tongue Twisters ${mod}`,
      showtime: lang === "ru" ? `Show Time ${mod}` : `Show Time ${mod}`,
      reading: lang === "ru" ? `Чтение ${mod}` : `Reading ${mod}`,
    };
    const descByType = {
      warmup: lang === "ru"
        ? `Разминка голоса в теме «${themeText}». Дыхание, артикуляция, динамика.`
        : `Voice warm-up on the theme of "${themeText}". Breath, articulation, dynamics.`,
      interview: lang === "ru"
        ? `Интервью на тему «${themeText}». Отвечай голосом, развёрнуто и уверенно.`
        : `Interview on the theme of "${themeText}". Answer with your voice - in detail and with confidence.`,
      tonguetwister: lang === "ru"
        ? `Скороговорки уровня ${mod}. Чёткость важнее скорости.`
        : `Tongue twisters at level ${mod}. Clarity matters more than speed.`,
      showtime: lang === "ru"
        ? `Сцена и публика. Тема: «${themeText}». Произнеси текст выразительно.`
        : `Stage and audience. Theme: "${themeText}". Deliver the text expressively.`,
      reading: (() => {
        const { category } = pickReadingPiece(mod);
        if (lang === "ru") {
          if (category === "prose") return "Выразительное чтение классической прозы. Естественные паузы, образы, тон.";
          if (category === "fable") return "Выразительное чтение басни. Меняй голос, играй роли, не теряй мораль.";
          return "Выразительное чтение классической поэзии. Ритм, паузы, интонация.";
        }
        if (category === "prose") return "Expressive reading of classical prose. Natural pauses, imagery, tone.";
        if (category === "fable") return "Expressive reading of a fable. Change voices, play the roles, keep the moral.";
        return "Expressive reading of classical poetry. Rhythm, pauses, intonation.";
      })(),
    };
    let levelNumber = 30 + (mod - 7) * 5;
    for (const type of TYPES) {
      levelNumber++;
      const id = levelId(type, mod);
      const obj = {
        id,
        levelNumber,
        title: titleByType[type],
        subtitle: subtitleByType[type],
        description: descByType[type],
        philosophyQuote: themeText,
      };
      lines.push(`  { id: "${id}", levelNumber: ${levelNumber}, title: ${J(obj.title)}, subtitle: ${J(obj.subtitle)}, description: ${J(obj.description)}, philosophyQuote: ${J(obj.philosophyQuote)} },`);
    }
  }
  return lines.join("\n");
}

// ── Build LEVEL_META entries (modules 7-67) ──────────────────────────────────
function buildLevelMeta() {
  const lines = [];
  for (let mod = 7; mod <= 67; mod++) {
    const palette = COLOR_PALETTE[(mod - 7) % COLOR_PALETTE.length];
    for (const type of TYPES) {
      const id = levelId(type, mod);
      lines.push(`  { id: "${id}", icon: "${ICONS[type]}", color: "${palette.color}", colorDark: "${palette.colorDark}", module: ${mod} },`);
    }
  }
  return lines.join("\n");
}

// ── Build TASKS for one type/module ──────────────────────────────────────────
function buildTasks(lang, type, mod) {
  const themeText = lang === "ru" ? MODULE_THEMES[mod].ru : MODULE_THEMES[mod].en;
  if (type === "warmup") {
    const set = WARMUP_SETS[(mod - 7) % WARMUP_SETS.length];
    return set.map((t, i) => ({
      taskNumber: i + 1,
      title: lang === "ru" ? t.titleRu : t.titleEn,
      instruction: lang === "ru" ? t.instructionRu : t.instructionEn,
      content: lang === "ru" ? t.contentRu : t.contentEn,
      tips: lang === "ru" ? t.tipsRu : t.tipsEn,
    }));
  }
  if (type === "interview") {
    const set = INTERVIEW_SETS[(mod - 7) % INTERVIEW_SETS.length];
    return set.map((t, i) => {
      // Replace "module's theme" placeholder with actual theme
      let content = lang === "ru" ? t.contentRu : t.contentEn;
      content = content.replace(/тему этого модуля/g, `тему «${themeText}»`);
      content = content.replace(/this module's theme/g, `the theme of "${themeText}"`);
      return {
        taskNumber: i + 1,
        title: lang === "ru" ? t.titleRu : t.titleEn,
        instruction: lang === "ru" ? t.instructionRu : t.instructionEn,
        content,
        tips: lang === "ru" ? t.tipsRu : t.tipsEn,
      };
    });
  }
  if (type === "tonguetwister") {
    // Pick 3 twisters per module, cycling
    const baseIdx = ((mod - 7) * 3) % TWISTERS.length;
    const picks = [0, 1, 2].map(i => TWISTERS[(baseIdx + i) % TWISTERS.length]);
    return picks.map((tw, i) => ({
      taskNumber: i + 1,
      title: lang === "ru" ? `Скороговорка ${i + 1}` : `Tongue twister ${i + 1}`,
      instruction: lang === "ru"
        ? "Произнеси трижды: медленно, в среднем темпе, быстро. Без потери чёткости."
        : "Say it three times: slow, medium, fast. Don't lose clarity.",
      content: lang === "ru" ? tw.ru : tw.en,
      tips: lang === "ru"
        ? ["Начинай медленно", "Чёткость важнее скорости", "Артикуляция активна"]
        : ["Start slowly", "Clarity matters more than speed", "Active articulation"],
    }));
  }
  if (type === "showtime") {
    // Show Time tasks reference the showtime stage by theme.
    // Tasks here are 3 short prep prompts — actual long text lives in SPEECH_THEMES.
    const txt = SHOWTIME_TEXTS[mod - 7]; // index 0 = mod 7
    const data = lang === "ru" ? txt.ru : txt.en;
    // Split lines roughly into thirds for 3 task fragments
    const n = data.lines.length;
    const a = Math.ceil(n / 3), b = Math.ceil((2 * n) / 3);
    const parts = [data.lines.slice(0, a), data.lines.slice(a, b), data.lines.slice(b)];
    return parts.map((p, i) => ({
      taskNumber: i + 1,
      title: lang === "ru" ? `Часть ${i + 1}` : `Part ${i + 1}`,
      instruction: lang === "ru"
        ? "Ты на сцене. Прочитай отрывок выразительно, чувствуя зал."
        : "You're on stage. Read the excerpt expressively, feeling the audience.",
      content: p.join(" "),
      tips: lang === "ru"
        ? ["Смотри вперёд, а не в текст", "Делай паузы после фраз", "Выделяй ключевые слова"]
        : ["Look forward, not at the text", "Pause after phrases", "Emphasize key words"],
    }));
  }
  if (type === "reading") {
    const { piece, category } = pickReadingPiece(mod);
    const instructionByCat = {
      prose: lang === "ru"
        ? "Читай прозу естественно, выделяй образы, выдерживай паузы между предложениями."
        : "Read the prose naturally, bring out the imagery, hold pauses between sentences.",
      poetry: lang === "ru"
        ? "Читай стихотворение размеренно, с интонацией и паузами."
        : "Read the poem with measured rhythm, intonation, and pauses.",
      fable: lang === "ru"
        ? "Читай басню как живую сцену: меняй голоса, играй характеры, оттеняй мораль."
        : "Read the fable as a living scene: change voices, play characters, highlight the moral.",
    };
    const tipsByCat = {
      prose: lang === "ru"
        ? ["Не торопись", "Каждое предложение - картина", "Естественные паузы"]
        : ["Don't rush", "Each sentence is a picture", "Natural pauses"],
      poetry: lang === "ru"
        ? ["Чувствуй размер стиха", "Каждый образ - картина", "Финал - вдох"]
        : ["Feel the meter", "Each image is a picture", "End with breath"],
      fable: lang === "ru"
        ? ["Голос рассказчика - спокойный", "Персонажи - разные голоса", "Мораль - с весом"]
        : ["Narrator stays calm", "Characters get distinct voices", "Deliver the moral with weight"],
    };
    return piece.stanzas.map((stz, i) => ({
      taskNumber: i + 1,
      title: lang === "ru"
        ? `${piece.authorRu}: ${piece.titleRu} (${i + 1})`
        : `${piece.authorEn}: ${piece.titleEn} (${i + 1})`,
      instruction: instructionByCat[category],
      content: lang === "ru" ? stz.ru : stz.en,
      tips: tipsByCat[category],
    }));
  }
  return [];
}

// ── Build READING_META entries (modules 7-67) ────────────────────────────────
function buildReadingMeta() {
  const lines = [];
  for (let mod = 7; mod <= 67; mod++) {
    const { piece, category } = pickReadingPiece(mod);
    const id = `reading${mod}`;
    lines.push(`  ${id}: { authorRu: ${J(piece.authorRu)}, titleRu: ${J(piece.titleRu)}, authorEn: ${J(piece.authorEn)}, titleEn: ${J(piece.titleEn)}, category: "${category}" },`);
  }
  return lines.join("\n");
}

function tasksBlock(lang) {
  const lines = [];
  for (let mod = 7; mod <= 67; mod++) {
    for (const type of TYPES) {
      const id = levelId(type, mod);
      const tasks = buildTasks(lang, type, mod);
      lines.push(`  ${id}: [`);
      for (const t of tasks) {
        const tips = `[${t.tips.map(x => J(x)).join(", ")}]`;
        lines.push(`    { taskNumber: ${t.taskNumber}, title: ${J(t.title)}, instruction: ${J(t.instruction)}, content: ${J(t.content)}, tips: ${tips} },`);
      }
      lines.push(`  ],`);
    }
  }
  return lines.join("\n");
}

// ── Patch gameContent.ts ─────────────────────────────────────────────────────
function patchGameContent() {
  const file = "constants/gameContent.ts";
  let src = readFileSync(file, "utf-8");

  // 1) MODULE_QUOTES: extend ru and en
  const ruQuotes = [];
  const enQuotes = [];
  for (let mod = 7; mod <= 67; mod++) {
    ruQuotes.push(`    ${mod}: ${J(MODULE_THEMES[mod].ru)},`);
    enQuotes.push(`    ${mod}: ${J(MODULE_THEMES[mod].en)},`);
  }
  src = src.replace(
    /(\s+6: "Красота в глазах смотрящего",)\n(\s+\},\n\s+en:)/,
    `$1\n${ruQuotes.join("\n")}\n$2`
  );
  src = src.replace(
    /(\s+6: "Beauty is in the eye of the beholder",)\n(\s+\},\n\};)/,
    `$1\n${enQuotes.join("\n")}\n$2`
  );

  // 2) LEVELS_RU: insert before closing ];
  const ruLevels = buildLevels("ru");
  src = src.replace(
    /(reading6", levelNumber: 30, title: "Чтение: Пушкин"[^\n]+\n)(\];)/,
    `$1\n${ruLevels}\n$2`
  );

  // 3) LEVELS_EN: insert before closing ];
  const enLevels = buildLevels("en");
  src = src.replace(
    /(reading6", levelNumber: 30, title: "Reading: Shakespeare"[^\n]+\n)(\];)/,
    `$1\n${enLevels}\n$2`
  );

  // 4) LEVEL_META: insert before closing ];
  const meta = buildLevelMeta();
  src = src.replace(
    /(\{ id: "reading6", icon: "book-outline", color: "#EC4899", colorDark: "#DB2777", module: 6 \},\n)(\];)/,
    `$1${meta}\n$2`
  );

  // 5) TASKS_RU: append before closing };
  const ruTasks = tasksBlock("ru");
  // Find the TASKS_RU block start, then locate its closing `};`
  const ruTasksStart = src.indexOf("const TASKS_RU: Record<string, TaskData[]> = {");
  const ruTasksEnd = src.indexOf("\n};\n", ruTasksStart);
  src = src.slice(0, ruTasksEnd) + "\n" + ruTasks + src.slice(ruTasksEnd);

  // 6) TASKS_EN: append before closing };
  const enTasks = tasksBlock("en");
  const enTasksStart = src.indexOf("const TASKS_EN: Record<string, TaskData[]> = {");
  const enTasksEnd = src.indexOf("\n};\n", enTasksStart);
  src = src.slice(0, enTasksEnd) + "\n" + enTasks + src.slice(enTasksEnd);

  // 7) READING_META: append generated entries inside the existing READING_META map
  const readingMeta = buildReadingMeta();
  const metaMarker = "// __READING_META_GENERATED__";
  if (src.includes(metaMarker)) {
    src = src.replace(metaMarker, `${readingMeta}\n  ${metaMarker}`);
  } else {
    console.warn("⚠ READING_META marker not found - skipping META patch");
  }

  writeFileSync(file, src);
  console.log("✓ Patched constants/gameContent.ts");
}

// ── Build SPEECH_THEMES blocks for showtime-stage.tsx ────────────────────────
function buildShowtimeBlock(lang) {
  // Returns object literal source: "[ {...}, {...} ]" for SPEECH_THEMES_<LANG>
  const lines = ["["];
  // Modules 1-6: keep existing themes (we'll handle them by *prepending* a marker
  // and letting the patcher splice). For modules 7-67:
  for (let mod = 7; mod <= 67; mod++) {
    const palette = SHOWTIME_PALETTE[(mod - 7) % SHOWTIME_PALETTE.length];
    const t = SHOWTIME_TEXTS[mod - 7];
    const data = lang === "ru" ? t.ru : t.en;
    const linesArr = data.lines.map(l => `    ${J(l)},`).join("\n");
    const grad = `[${palette.gradient.map(x => `"${x}"`).join(", ")}]`;
    lines.push(`  {`);
    lines.push(`    id: "module${mod}",`);
    lines.push(`    title: ${J(data.title)},`);
    lines.push(`    gradient: ${grad} as const,`);
    lines.push(`    accent: "${palette.accent}",`);
    lines.push(`    lines: [`);
    lines.push(linesArr);
    lines.push(`    ],`);
    lines.push(`  },`);
  }
  lines.push("]");
  return lines.join("\n");
}

function dumpShowtimeBlocks() {
  const ru = buildShowtimeBlock("ru");
  const en = buildShowtimeBlock("en");
  writeFileSync(".local/showtime_ru.txt", ru);
  writeFileSync(".local/showtime_en.txt", en);
  console.log("✓ Wrote .local/showtime_ru.txt and showtime_en.txt");
}

patchGameContent();
dumpShowtimeBlocks();
console.log("Done.");
