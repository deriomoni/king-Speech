import fs from "fs";

function parseFile(path) {
  let src = fs.readFileSync(path, "utf8");
  src = src.replace(/as const/g, "");
  return eval(src);
}

function emit(entries, lang) {
  const lines = [];
  for (const e of entries) {
    const id = e.id.replace("module", "showtime");
    const interior = lang === "ru" ? "Сцена и публика" : "Stage and audience";
    const audienceDesc = lang === "ru" ? "Зал слушает" : "The hall is listening";
    const speechTitle = lang === "ru" ? "Выступление" : "Speech";
    lines.push(`  ${id}: {`);
    lines.push(`    levelId: "${id}",`);
    lines.push(`    title: ${JSON.stringify(e.title)},`);
    lines.push(`    curtainTitle: "Show Time",`);
    lines.push(`    interior: ${JSON.stringify(interior)},`);
    lines.push(`    audienceDesc: ${JSON.stringify(audienceDesc)},`);
    lines.push(`    gradientColors: [${e.gradient.map((g) => JSON.stringify(g)).join(", ")}],`);
    lines.push(`    accentColor: ${JSON.stringify(e.accent)},`);
    lines.push(`    timerSeconds: null,`);
    lines.push(`    speeches: [`);
    lines.push(`      {`);
    lines.push(`        title: ${JSON.stringify(speechTitle)},`);
    lines.push(`        lines: [`);
    for (const ln of e.lines) lines.push(`          ${JSON.stringify(ln)},`);
    lines.push(`        ],`);
    lines.push(`      },`);
    lines.push(`    ],`);
    lines.push(`  },`);
  }
  return lines.join("\n");
}

const ru = parseFile(".local/showtime_ru.txt");
const en = parseFile(".local/showtime_en.txt");

const ruBlock = emit(ru, "ru");
const enBlock = emit(en, "en");

const file = "app/showtime-stage.tsx";
let src = fs.readFileSync(file, "utf8");

const RU_MARKER = "  showtime6: {";
const ruIdx = src.indexOf(RU_MARKER);
if (ruIdx === -1) throw new Error("RU showtime6 not found");
const ruClose = src.indexOf("\n};\n", ruIdx);
if (ruClose === -1) throw new Error("RU close not found");

src = src.slice(0, ruClose) + "\n" + ruBlock + src.slice(ruClose);

const EN_MARKER = 'levelId: "showtime6"';
const enIdx = src.indexOf(EN_MARKER, src.indexOf("SPEECH_THEMES_EN"));
if (enIdx === -1) throw new Error("EN showtime6 not found");
const enClose = src.indexOf("\n};\n", enIdx);
if (enClose === -1) throw new Error("EN close not found");

src = src.slice(0, enClose) + "\n" + enBlock + src.slice(enClose);

fs.writeFileSync(file, src);
console.log(`Inserted ${ru.length} RU + ${en.length} EN themes`);
