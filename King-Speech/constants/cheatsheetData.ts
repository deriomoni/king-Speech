import { Ionicons } from "@expo/vector-icons";
import { pickLang, type Lang } from "@/context/LangContext";

/**
 * «Шпаргалка» (Cheat Sheet) — emergency pre-performance prep content.
 *
 * A fully OFFLINE, static feature: no AI, no scoring, no camera, no recording.
 * The design principle is "not a reference, but a guide": the user is stressed,
 * has little time and attention, so every route is a pre-built sequence that
 * leads them by the hand ("do it with me"), not a menu of 40 exercises.
 *
 * All copy is trilingual (ru primary, en + kk mirrors). Use `tx(loc, lang)`.
 * Tongue-twister `text`/`sound` stay Russian for kk (the drill is the Russian
 * twister itself; EN gets a transliteration).
 */

export type IconName = keyof typeof Ionicons.glyphMap;

export interface Loc {
  ru: string;
  en: string;
  kk: string;
}

export function tx(loc: Loc | undefined, lang: Lang | string): string {
  if (!loc) return "";
  return pickLang(lang as Lang, loc);
}

// ── Step kinds ──────────────────────────────────────────────────────────────

export type PhaseType = "inhale" | "hold" | "exhale";
export interface BreathPhase {
  type: PhaseType;
  sec: number;
  label: Loc;
  cue: Loc;
}

export interface BreathingStep {
  kind: "breathing";
  id: string;
  block: BlockKind;
  title: Loc;
  intro: Loc;
  pattern: BreathPhase[];
  cycles: number;
}

/** Guided physical action (grounding, shaking, resonators) — optional timer. */
export interface ActionStep {
  kind: "action";
  id: string;
  block: BlockKind;
  emoji: string;
  title: Loc;
  intro: Loc;
  moves: Loc[];
  seconds?: number;
}

/**
 * Mouth warm-up with the illustrated warm-up portraits (components/warmup/
 * IllustratedDrill): the drills play one after another, animated in rhythm.
 */
export interface ArticulationStep {
  kind: "articulation";
  id: string;
  block: BlockKind;
  title: Loc;
  intro: Loc;
  /** Keys of ILLUSTRATED_EXERCISES («chest», «tubeSide», «cork», «tongueCircle»). */
  drills: string[];
  /** Seconds per drill. */
  secs: number;
}

/** Vocal chant / распевка — syllables highlighted in rhythm. */
export interface ChantStep {
  kind: "chant";
  id: string;
  block: BlockKind;
  title: Loc;
  intro: Loc;
  syllables: string[];
  tempoMs: number;
}

/** Tongue twister with a difficulty marker (1 easy → 4 hellish). */
export interface TwisterStep {
  kind: "twister";
  id: string;
  block: BlockKind;
  title: Loc;
  text: Loc;
  sound: Loc;
  difficulty: 1 | 2 | 3 | 4;
}

/** Short advice ("tip") or emergency micro-fix ("fix") card. */
export interface TipStep {
  kind: "tip";
  id: string;
  block: BlockKind;
  variant: "tip" | "fix";
  icon: IconName;
  title: Loc;
  text: Loc;
}

/** Final anchor screen — posture + one mantra + "Я готов". */
export interface FinalStep {
  kind: "final";
  id: string;
  block: BlockKind;
  title: Loc;
  lines: Loc[];
  mantra: Loc;
}

export type CheatStep =
  | BreathingStep
  | ActionStep
  | ArticulationStep
  | ChantStep
  | TwisterStep
  | TipStep
  | FinalStep;

export type BlockKind = "nerves" | "breath" | "voice" | "twister" | "fix" | "tip" | "final";

export interface BlockMeta {
  icon: IconName;
  title: Loc;
}

export const BLOCK_META: Record<BlockKind, BlockMeta> = {
  nerves: { icon: "heart-outline", title: { ru: "Нервы", en: "Nerves", kk: "Толқу" } },
  breath: { icon: "leaf-outline", title: { ru: "Дыхание", en: "Breathing", kk: "Тыныс" } },
  voice: { icon: "musical-notes-outline", title: { ru: "Голос и дикция", en: "Voice & diction", kk: "Дауыс және дикция" } },
  twister: { icon: "flash-outline", title: { ru: "Скороговорки", en: "Tongue twisters", kk: "Тіл бұрауыштар" } },
  fix: { icon: "medkit-outline", title: { ru: "Быстрые фиксы", en: "Quick fixes", kk: "Жедел көмек" } },
  tip: { icon: "bulb-outline", title: { ru: "Советы", en: "Tips", kk: "Кеңестер" } },
  final: { icon: "sparkles-outline", title: { ru: "Настрой", en: "Mindset", kk: "Көңіл күй" } },
};

// ── Exercise pool ───────────────────────────────────────────────────────────

const physiologicalSigh: BreathingStep = {
  kind: "breathing",
  id: "sigh",
  block: "nerves",
  title: { ru: "Дыхательная разминка", en: "Breathing warm-up", kk: "Тыныс жаттығуы" },
  intro: {
    ru: "Физиологический вздох сбивает тревогу быстрее всего. Дыши вместе с кругом.",
    en: "The physiological sigh calms nerves fastest. Breathe with the circle.",
    kk: "Физиологиялық күрсіну мазасыздықты бәрінен тез басады. Шеңбермен бірге дем алыңыз.",
  },
  cycles: 3,
  pattern: [
    { type: "inhale", sec: 3, label: { ru: "Вдох", en: "Inhale", kk: "Дем алу" }, cue: { ru: "Вдох через нос", en: "Inhale through the nose", kk: "Мұрынмен дем алыңыз" } },
    { type: "inhale", sec: 1, label: { ru: "Ещё чуть", en: "A bit more", kk: "Тағы аздап" }, cue: { ru: "Доберись носом", en: "Top up through the nose", kk: "Мұрынмен тағы аздап жұтыңыз" } },
    { type: "exhale", sec: 6, label: { ru: "Выдох", en: "Exhale", kk: "Дем шығару" }, cue: { ru: "Долгий выдох ртом", en: "Long exhale through the mouth", kk: "Аузыңызбен ұзақ дем шығарыңыз" } },
  ],
};

const diaphragmatic: BreathingStep = {
  kind: "breathing",
  id: "diaphragm",
  block: "breath",
  title: { ru: "Ровное дыхание", en: "Steady breathing", kk: "Бірқалыпты тыныс" },
  intro: {
    ru: "Дыши животом, а не плечами. Выдох длиннее вдоха — это успокаивает.",
    en: "Breathe with your belly, not your shoulders. A longer exhale calms you.",
    kk: "Иықпен емес, ішпен дем алыңыз. Дем шығару дем алудан ұзағырақ болсын — бұл тыныштандырады.",
  },
  cycles: 4,
  pattern: [
    { type: "inhale", sec: 4, label: { ru: "Вдох", en: "Inhale", kk: "Дем алу" }, cue: { ru: "Вдох носом, живот наружу", en: "Inhale, belly out", kk: "Мұрынмен дем алыңыз, іш алға шықсын" } },
    { type: "hold", sec: 2, label: { ru: "Задержка", en: "Hold", kk: "Кідіріс" }, cue: { ru: "Задержи дыхание", en: "Hold", kk: "Деміңізді ұстаңыз" } },
    { type: "exhale", sec: 6, label: { ru: "Выдох", en: "Exhale", kk: "Дем шығару" }, cue: { ru: "Медленный выдох ртом", en: "Slow exhale through the mouth", kk: "Аузыңызбен баяу дем шығарыңыз" } },
  ],
};

const grounding: ActionStep = {
  kind: "action",
  id: "grounding",
  block: "nerves",
  emoji: "🌿",
  title: { ru: "Заземление 5-4-3-2-1", en: "Grounding 5-4-3-2-1", kk: "Жерге тірелу 5-4-3-2-1" },
  intro: { ru: "Верни себя в «здесь и сейчас». Про себя назови:", en: "Bring yourself back to the here and now. Silently name:", kk: "Өзіңізді «осы жерге және осы сәтке» қайтарыңыз. Іштей атаңыз:" },
  seconds: 40,
  moves: [
    { ru: "5 вещей, которые видишь", en: "5 things you can see", kk: "Көріп тұрған 5 нәрсе" },
    { ru: "4 звука, которые слышишь", en: "4 sounds you can hear", kk: "Естіп тұрған 4 дыбыс" },
    { ru: "3 ощущения в теле", en: "3 sensations in your body", kk: "Денеңіздегі 3 сезім" },
    { ru: "2 запаха вокруг", en: "2 smells around you", kk: "Айналаңыздағы 2 иіс" },
    { ru: "1 медленный глубокий вдох", en: "1 slow deep breath", kk: "1 баяу әрі терең дем" },
  ],
};

const shaking: ActionStep = {
  kind: "action",
  id: "shaking",
  block: "nerves",
  emoji: "🙆",
  title: { ru: "Стряхни зажим", en: "Shake off the tension", kk: "Қысылуды сілкіп тастаңыз" },
  intro: { ru: "Тело держит стресс. Разомни его — делай за мной:", en: "Your body holds stress. Loosen it — do it with me:", kk: "Дене күйзелісті ұстап қалады. Оны босатыңыз — менімен бірге жасаңыз:" },
  seconds: 20,
  moves: [
    { ru: "Встряхни кисти рук 10 секунд", en: "Shake out your hands for 10 seconds", kk: "Қолдарыңызды 10 секунд сілкіңіз" },
    { ru: "Покрути плечами назад", en: "Roll your shoulders backwards", kk: "Иықтарыңызды артқа қарай айналдырыңыз" },
    { ru: "Урони и расслабь челюсть", en: "Drop and relax your jaw", kk: "Иегіңізді түсіріп, босаңсытыңыз" },
  ],
};

const resonators: ActionStep = {
  kind: "action",
  id: "resonators",
  block: "voice",
  emoji: "🎵",
  title: { ru: "Разбуди резонаторы", en: "Wake up your resonators", kk: "Резонаторларды ояту" },
  intro: { ru: "Тихо помычи «ммм» с закрытым ртом. Почувствуй вибрацию:", en: "Hum a soft 'mmm' with your mouth closed. Feel the buzz:", kk: "Аузыңызды жауып, ақырын «ммм» деп ыңылдаңыз. Дірілді сезініңіз:" },
  seconds: 20,
  moves: [
    { ru: "Вибрация в губах и носу", en: "Buzz in your lips and nose", kk: "Ерін мен мұрындағы діріл" },
    { ru: "Опусти звук ниже — в грудь", en: "Lower the tone into your chest", kk: "Дыбысты төмен — кеудеге түсіріңіз" },
    { ru: "Голос звучит теплее и объёмнее", en: "Your voice grows warmer and fuller", kk: "Дауыс жылырақ әрі көлемдірек естіледі" },
  ],
};

const lipTrill: ActionStep = {
  kind: "action",
  id: "lip-trill",
  block: "voice",
  emoji: "😛",
  title: { ru: "Губной вибрант «бррр»", en: "Lip trill 'brrr'", kk: "Ерін дірілі «бррр»" },
  intro: { ru: "Расслабь губы и пусти воздух — они завибрируют. Делай за мной:", en: "Relax your lips and push air — they'll flutter. Do it with me:", kk: "Еріндеріңізді босатып, ауа жіберіңіз — олар дірілдейді. Менімен бірге жасаңыз:" },
  seconds: 20,
  moves: [
    { ru: "Ровное «бррр» на одном дыхании", en: "A steady 'brrr' on one breath", kk: "Бір демде бірқалыпты «бррр»" },
    { ru: "Веди звук вверх, как горка", en: "Glide the tone up like a slide", kk: "Дыбысты сырғанақтай жоғары көтеріңіз" },
    { ru: "И плавно опусти вниз", en: "Then slide it smoothly back down", kk: "Сосын баяу төмен түсіріңіз" },
  ],
};

const sirena: ActionStep = {
  kind: "action",
  id: "sirena",
  block: "voice",
  emoji: "🚨",
  title: { ru: "Сирена", en: "Siren", kk: "Сирена" },
  intro: { ru: "Тяни «у-у-у» и катай голос от низа к верху и обратно:", en: "Sustain an 'oo' and roll your voice from low to high and back:", kk: "«у-у-у» деп созып, дауысыңызды төменнен жоғары және кері жүргізіңіз:" },
  seconds: 20,
  moves: [
    { ru: "От самого низкого — плавно вверх", en: "From your lowest — smoothly up", kk: "Ең төменгісінен — біртіндеп жоғары" },
    { ru: "До самого высокого — и обратно", en: "To your highest — and back", kk: "Ең жоғарғысына дейін — және кері" },
    { ru: "Без рывков, одной линией", en: "No jumps, one continuous line", kk: "Секірмей, бір сызықпен" },
  ],
};

const articulation: ArticulationStep = {
  kind: "articulation",
  id: "articulation",
  block: "voice",
  title: { ru: "Разомни рот", en: "Warm up your mouth", kk: "Ауыз жаттығуы" },
  intro: { ru: "Повторяй движения в такт с портретом.", en: "Repeat the moves in rhythm with the portrait.", kk: "Қимылдарды портретпен бірге ырғақпен қайталаңыз." },
  drills: ["tubeSide", "tongueCircle"],
  secs: 14,
};

const articulationTongue: ArticulationStep = {
  kind: "articulation",
  id: "articulation-tongue",
  block: "voice",
  title: { ru: "Голос и дикция", en: "Voice and diction", kk: "Дауыс пен дикция" },
  intro: { ru: "Повторяй в такт с портретом.", en: "Repeat in rhythm with the portrait.", kk: "Портретпен бірге ырғақпен қайталаңыз." },
  drills: ["chest", "cork"],
  secs: 14,
};

const chant: ChantStep = {
  kind: "chant",
  id: "chant-ma",
  block: "voice",
  title: { ru: "Распевка", en: "Vocal warm-up", kk: "Дауыс жаттығуы" },
  intro: { ru: "Тяни каждый слог, будто поёшь. Веди голос за подсветкой.", en: "Draw out each syllable like a song. Follow the highlight.", kk: "Әр буынды ән салғандай созып айтыңыз. Дауысыңызды белгіленген буынмен жүргізіңіз." },
  syllables: ["МА", "МЭ", "МИ", "МО", "МУ"],
  tempoMs: 620,
};

const chantBro: ChantStep = {
  kind: "chant",
  id: "chant-bro",
  block: "voice",
  title: { ru: "Распевка на «Б»", en: "Warm-up on 'B'", kk: "«Б» дыбысына дауыс жаттығуы" },
  intro: { ru: "Чётко смыкай губы на каждом слоге. Веди голос за подсветкой.", en: "Close your lips crisply on each syllable. Follow the highlight.", kk: "Әр буында еріндеріңізді анық жұмып айтыңыз. Дауысыңызды белгіленген буынмен жүргізіңіз." },
  syllables: ["БА", "БО", "БУ", "БЭ", "БЫ"],
  tempoMs: 600,
};

// Tongue twisters, grouped conceptually by target sound, with difficulty 1..4.
// TODO(kk-content): kk shows the Russian twister text/sound as-is; consider
// adding native Kazakh жаңылтпаштар (would need their own sound labels).
const twSasha: TwisterStep = {
  kind: "twister",
  id: "tw-sasha",
  block: "twister",
  title: { ru: "Шипящие", en: "Hissing sounds", kk: "Ысқырық дыбыстар" },
  sound: { ru: "Ш · С", en: "SH · S", kk: "Ш · С" },
  difficulty: 1,
  text: { ru: "Шла Саша по шоссе и сосала сушку.", en: "Shla Sasha po shosse i sosala sushku.", kk: "Шла Саша по шоссе и сосала сушку." },
};

const twTrava: TwisterStep = {
  kind: "twister",
  id: "tw-trava",
  block: "twister",
  title: { ru: "Звук «Р»", en: "The 'R' sound", kk: "«Р» дыбысы" },
  sound: { ru: "Р · В", en: "R · V", kk: "Р · В" },
  difficulty: 2,
  text: { ru: "На дворе трава, на траве дрова.", en: "Na dvore trava, na trave drova.", kk: "На дворе трава, на траве дрова." },
};

const twKopyt: TwisterStep = {
  kind: "twister",
  id: "tw-kopyt",
  block: "twister",
  title: { ru: "Взрывные «п/т/к»", en: "Plosives 'p/t/k'", kk: "«п/т/к» жарылыс дыбыстары" },
  sound: { ru: "П · Т · К", en: "P · T · K", kk: "П · Т · К" },
  difficulty: 3,
  text: { ru: "От топота копыт пыль по полю летит.", en: "Ot topota kopyt pyl po polyu letit.", kk: "От топота копыт пыль по полю летит." },
};

const twKolpak: TwisterStep = {
  kind: "twister",
  id: "tw-kolpak",
  block: "twister",
  title: { ru: "Адская", en: "Hellish", kk: "Тозақ деңгейі" },
  sound: { ru: "К · Л · П", en: "K · L · P", kk: "К · Л · П" },
  difficulty: 4,
  text: {
    ru: "Колпак под колпаком, а под колпаком колпак.",
    en: "Kolpak pod kolpakom, a pod kolpakom kolpak.",
    kk: "Колпак под колпаком, а под колпаком колпак.",
  },
};

const twGreki: TwisterStep = {
  kind: "twister",
  id: "tw-greki",
  block: "twister",
  title: { ru: "Грека и рак", en: "Greka and the crab", kk: "Грека мен шаян" },
  sound: { ru: "Р · К", en: "R · K", kk: "Р · К" },
  difficulty: 2,
  text: {
    ru: "Ехал Грека через реку, видит Грека — в реке рак.",
    en: "Ekhal Greka cherez reku, vidit Greka — v reke rak.",
    kk: "Ехал Грека через реку, видит Грека — в реке рак.",
  },
};

const twOsip: TwisterStep = {
  kind: "twister",
  id: "tw-osip",
  block: "twister",
  title: { ru: "Осип и Архип", en: "Osip and Arkhip", kk: "Осип пен Архип" },
  sound: { ru: "С · Х · П", en: "S · KH · P", kk: "С · Х · П" },
  difficulty: 2,
  text: {
    ru: "Осип охрип, а Архип осип.",
    en: "Osip okhrip, a Arkhip osip.",
    kk: "Осип охрип, а Архип осип.",
  },
};

const twKlara: TwisterStep = {
  kind: "twister",
  id: "tw-klara",
  block: "twister",
  title: { ru: "Карл и Клара", en: "Karl and Klara", kk: "Карл мен Клара" },
  sound: { ru: "Р · К · Л", en: "R · K · L", kk: "Р · К · Л" },
  difficulty: 3,
  text: {
    ru: "Карл у Клары украл кораллы, а Клара у Карла украла кларнет.",
    en: "Karl u Klary ukral korally, a Klara u Karla ukrala klarnet.",
    kk: "Карл у Клары украл кораллы, а Клара у Карла украла кларнет.",
  },
};

const twByk: TwisterStep = {
  kind: "twister",
  id: "tw-byk",
  block: "twister",
  title: { ru: "Тупогубый бычок", en: "The blunt-lipped bull", kk: "Доғал ерінді бұқашық" },
  sound: { ru: "Б · Г", en: "B · G", kk: "Б · Г" },
  difficulty: 3,
  text: {
    ru: "Бык тупогуб, тупогубенький бычок, у быка бела губа была тупа.",
    en: "Byk tupogub, tupogubenkiy bychok, u byka bela guba byla tupa.",
    kk: "Бык тупогуб, тупогубенький бычок, у быка бела губа была тупа.",
  },
};

const twCherti: TwisterStep = {
  kind: "twister",
  id: "tw-cherti",
  block: "twister",
  title: { ru: "Чертёнок", en: "Little devils", kk: "Кішкентай шайтандар" },
  sound: { ru: "Ч · Р", en: "CH · R", kk: "Ч · Р" },
  difficulty: 4,
  text: {
    ru: "Четыре чёрненьких чумазеньких чертёнка чертили чёрными чернилами чертёж.",
    en: "Chetyre chyornenkikh chumazenkikh chertyonka chertili chyornymi chernilami chertyozh.",
    kk: "Четыре чёрненьких чумазеньких чертёнка чертили чёрными чернилами чертёж.",
  },
};

// Tips (советы)
const tipExcitement: TipStep = {
  kind: "tip", id: "tip-excite", block: "tip", variant: "tip", icon: "flash-outline",
  title: { ru: "Волнение — это топливo", en: "Nerves are fuel", kk: "Толқу — бұл отын" },
  text: { ru: "Не гаси волнение — направь его в первую фразу. Это энергия, а не враг.", en: "Don't fight the nerves — pour them into your opening line. It's energy, not an enemy.", kk: "Толқуды басуға тырыспаңыз — оны алғашқы сөйлеміңізге бағыттаңыз. Бұл — жау емес, қуат." },
};
const tipTempo: TipStep = {
  kind: "tip", id: "tip-tempo", block: "tip", variant: "tip", icon: "speedometer-outline",
  title: { ru: "Чуть медленнее", en: "A touch slower", kk: "Сәл баяуырақ" },
  text: { ru: "Говори чуть медленнее, чем хочется. Спешка читается как волнение.", en: "Speak a little slower than feels natural. Rushing reads as anxiety.", kk: "Өзіңіз қалағаннан сәл баяуырақ сөйлеңіз. Асығыстық толқу сияқты көрінеді." },
};
const tipPauses: TipStep = {
  kind: "tip", id: "tip-pauses", block: "tip", variant: "tip", icon: "pause-outline",
  title: { ru: "Пауза весит больше", en: "A pause carries weight", kk: "Үзілістің салмағы зор" },
  text: { ru: "Пауза после важной мысли действует сильнее, чем громкость.", en: "A pause after a key point lands harder than volume ever will.", kk: "Маңызды ойдан кейінгі үзіліс дауыс қаттылығынан да күшті әсер етеді." },
};
const tipEyes: TipStep = {
  kind: "tip", id: "tip-eyes", block: "tip", variant: "tip", icon: "eye-outline",
  title: { ru: "Найди дружелюбные глаза", en: "Find friendly eyes", kk: "Мейірімді көздерді табыңыз" },
  text: { ru: "Выбери 2–3 доброжелательных лица и говори им, а не в пустоту.", en: "Pick 2–3 friendly faces and talk to them, not to the void.", kk: "2–3 мейірімді жүзді таңдап, бос кеңістікке емес, соларға сөйлеңіз." },
};
const tipPosture: TipStep = {
  kind: "tip", id: "tip-posture", block: "tip", variant: "tip", icon: "body-outline",
  title: { ru: "Тело спокойно — голос спокоен", en: "Calm body, calm voice", kk: "Дене тыныш — дауыс тыныш" },
  text: { ru: "Встань устойчиво, вес на обе ноги, плечи вниз. Опора даёт уверенный звук.", en: "Stand grounded, weight on both feet, shoulders down. Stability steadies your voice.", kk: "Нық тұрыңыз, салмақты екі аяққа салыңыз, иықты түсіріңіз. Тірек дауысқа сенімділік береді." },
};

// Encouraging one-liners to slip between exercises — reassure and de-stress.
const tipYouGotThis: TipStep = {
  kind: "tip", id: "tip-yougot", block: "tip", variant: "tip", icon: "sunny-outline",
  title: { ru: "У тебя получится", en: "You've got this", kk: "Сіздің қолыңыздан келеді" },
  text: { ru: "Ты уже здесь и готовишься — это половина успеха. Осталось просто начать.", en: "You're here and preparing — that's half the battle. Now just begin.", kk: "Сіз осындасыз және дайындалып жатырсыз — бұл табыстың жартысы. Енді тек бастау қалды." },
};
const tipSmile: TipStep = {
  kind: "tip", id: "tip-smile", block: "tip", variant: "tip", icon: "happy-outline",
  title: { ru: "Улыбнись", en: "Smile", kk: "Жымиыңыз" },
  text: { ru: "Лёгкая улыбка расслабляет лицо — и голос сразу звучит теплее и живее.", en: "A light smile relaxes your face — and your voice instantly sounds warmer.", kk: "Жеңіл жымиыс бетті босаңсытады — дауыс бірден жылырақ әрі жандырақ естіледі." },
};
const tipMistakesOk: TipStep = {
  kind: "tip", id: "tip-mistakes", block: "tip", variant: "tip", icon: "shield-checkmark-outline",
  title: { ru: "Ошибиться — это норм", en: "Slips are fine", kk: "Қателесу — қалыпты нәрсе" },
  text: { ru: "Даже опытные ораторы оговариваются. Не останавливайся — и никто не заметит.", en: "Even seasoned speakers stumble. Just keep going — no one will notice.", kk: "Тәжірибелі шешендер де жаңылысады. Тоқтамаңыз — ешкім байқамайды." },
};
const tipShine: TipStep = {
  kind: "tip", id: "tip-shine", block: "tip", variant: "tip", icon: "sparkles-outline",
  title: { ru: "Тебе есть что сказать", en: "You have something to say", kk: "Сіздің айтарыңыз бар" },
  text: { ru: "Люди пришли услышать именно тебя. Дыши ровно — и просто поделись.", en: "People came to hear you. Breathe steady — and simply share it.", kk: "Адамдар дәл сізді тыңдауға келді. Бірқалыпты дем алып, жай ғана бөлісіңіз." },
};

// Quick fixes (быстрые фиксы — аварии перед выходом)
const fixVoice: TipStep = {
  kind: "tip", id: "fix-voice", block: "fix", variant: "fix", icon: "mic-outline",
  title: { ru: "Севший голос", en: "Voice cracked", kk: "Қарлыққан дауыс" },
  text: { ru: "Тихо помычи «ммм» и сделай пару спокойных зевков — связки мягко проснутся.", en: "Hum a soft 'mmm' and take a couple of calm yawns — your cords wake up gently.", kk: "Ақырын «ммм» деп ыңылдап, бірер рет асықпай есінеп алыңыз — дауыс байламдары жайлап оянады." },
};
const fixDry: TipStep = {
  kind: "tip", id: "fix-dry", block: "fix", variant: "fix", icon: "water-outline",
  title: { ru: "Сухость во рту", en: "Dry mouth", kk: "Ауыздың құрғауы" },
  text: { ru: "Слегка прикуси кончик языка — вернётся слюна. Пей только тёплую воду, не ледяную.", en: "Lightly bite the tip of your tongue — saliva returns. Drink warm water only, never ice-cold.", kk: "Тіліңіздің ұшын сәл тістеп алыңыз — сілекей қайта келеді. Мұздай емес, тек жылы су ішіңіз." },
};
const fixWarm: TipStep = {
  kind: "tip", id: "fix-warm", block: "fix", variant: "fix", icon: "flame-outline",
  title: { ru: "Согреть связки", en: "Warm the cords", kk: "Дауыс байламдарын жылыту" },
  text: { ru: "Подыши на ладони тёплым воздухом, будто греешь их — то же тепло уйдёт в связки.", en: "Breathe warm air onto your palms as if warming them — that warmth reaches your cords.", kk: "Алақандарыңызды жылытқандай оларға жылы дем үрлеңіз — сол жылу дауыс байламдарына барады." },
};

const finalStep: FinalStep = {
  kind: "final",
  id: "final",
  block: "final",
  title: { ru: "Ты готов", en: "You're ready", kk: "Сіз дайынсыз" },
  lines: [
    { ru: "Плечи вниз, макушка вверх.", en: "Shoulders down, crown up.", kk: "Иық төмен, төбе жоғары." },
    { ru: "Один спокойный вдох.", en: "One calm breath.", kk: "Бір тыныш дем." },
    { ru: "Первую фразу — уверенно и не спеша.", en: "Deliver your first line with calm confidence.", kk: "Алғашқы сөйлемді — сенімді әрі асықпай." },
  ],
  mantra: { ru: "Мне есть что сказать — и я скажу это спокойно.", en: "I have something to say — and I'll say it calmly.", kk: "Менің айтарым бар — және мен оны сабырмен айтамын." },
};

// Full tongue-twister pool (easy → hellish) — used by the karaoke twister view's
// "Замена" (replace) button to cycle to another twister.
export const TWISTERS: TwisterStep[] = [
  twSasha, twGreki, twOsip, twTrava, twByk, twKlara, twKopyt, twCherti, twKolpak,
];

// ── Routes ──────────────────────────────────────────────────────────────────

export interface CheatRoute {
  id: "warmup" | "quick" | "balanced" | "full";
  minutes: number;
  accent: string;
  icon: IconName;
  title: Loc;
  subtitle: Loc;
  steps: CheatStep[];
}

export const ROUTES: CheatRoute[] = [
  {
    id: "warmup",
    minutes: 1,
    accent: "#4FD9A0",
    icon: "flame",
    title: { ru: "Разминка", en: "Warm-up", kk: "Жаттығу" },
    subtitle: { ru: "Быстрая разминка за минуту", en: "A one-minute warm-up", kk: "Бір минуттық жылдам жаттығу" },
    // ~1 min: one calming breath, mouth + voice, and one easy twister.
    steps: [
      physiologicalSigh,
      tipYouGotThis,
      articulation,
      chant,
      twSasha,
      finalStep,
    ],
  },
  {
    id: "quick",
    minutes: 2,
    accent: "#FFCF34",
    icon: "flash",
    title: { ru: "2 минуты", en: "2 minutes", kk: "2 минут" },
    subtitle: { ru: "Экстренно, перед самым выходом", en: "Emergency, right before you go on", kk: "Шұғыл, сахнаға шығар алдында" },
    // ~2 min: breath → mouth/voice → two twisters, with a tip and a fix.
    steps: [
      physiologicalSigh, tipExcitement,
      articulation,
      chant, tipSmile,
      lipTrill,
      twSasha,
      fixVoice,
      twGreki, tipMistakesOk,
      finalStep,
    ],
  },
  {
    id: "balanced",
    minutes: 5,
    accent: "#9468FB",
    icon: "pulse",
    title: { ru: "5 минут", en: "5 minutes", kk: "5 минут" },
    subtitle: { ru: "Сбалансированная разминка", en: "A balanced warm-up", kk: "Теңгерімді жаттығу" },
    // ~5 min: full breath + voice work and a real twister set (easy → hard).
    steps: [
      physiologicalSigh, tipExcitement,
      diaphragmatic, tipYouGotThis,
      articulation,
      lipTrill,
      chant,
      tipTempo,
      resonators,
      articulationTongue, tipSmile,
      twSasha,
      twGreki,
      twTrava,
      tipPauses,
      sirena,
      twKlara,
      fixVoice,
      twKopyt, tipMistakesOk,
      finalStep,
    ],
  },
  {
    id: "full",
    minutes: 10,
    accent: "#4FD9A0",
    icon: "shield-checkmark",
    title: { ru: "10 минут", en: "10 minutes", kk: "10 минут" },
    subtitle: { ru: "Полная подготовка заранее", en: "Full prep, ahead of time", kk: "Алдын ала толық дайындық" },
    // ~10 min: calm the nerves, open the breath, wake the whole apparatus, then
    // a long twister ladder from easy to hellish.
    steps: [
      physiologicalSigh, tipExcitement,
      grounding, tipYouGotThis,
      shaking, tipPosture,
      diaphragmatic,
      articulation,
      lipTrill,
      chant,
      tipTempo,
      resonators,
      sirena, tipSmile,
      articulationTongue,
      chantBro,
      fixWarm,
      twSasha,
      twOsip,
      twGreki,
      tipPauses,
      twTrava,
      twByk,
      fixDry,
      twKopyt,
      tipEyes,
      twKlara,
      twCherti, tipShine,
      fixVoice,
      twKolpak, tipMistakesOk,
      finalStep,
    ],
  },
];

// ── Full reference (Полная версия) ──────────────────────────────────────────
// A flat, grouped catalogue of every distinct exercise/tip for calm browsing.

export interface RefSection {
  block: BlockKind;
  steps: CheatStep[];
}

export const REFERENCE: RefSection[] = [
  { block: "nerves", steps: [physiologicalSigh, grounding, shaking] },
  { block: "breath", steps: [diaphragmatic] },
  { block: "voice", steps: [articulation, articulationTongue, chant, chantBro, resonators, lipTrill, sirena] },
  { block: "twister", steps: [twSasha, twGreki, twOsip, twTrava, twByk, twKlara, twKopyt, twCherti, twKolpak] },
  { block: "fix", steps: [fixVoice, fixDry, fixWarm] },
  { block: "tip", steps: [tipExcitement, tipTempo, tipPauses, tipEyes, tipPosture] },
  { block: "final", steps: [finalStep] },
];

export const DIFFICULTY_LABEL: Record<1 | 2 | 3 | 4, Loc> = {
  1: { ru: "Лёгкая", en: "Easy", kk: "Жеңіл" },
  2: { ru: "Средняя", en: "Medium", kk: "Орташа" },
  3: { ru: "Сложная", en: "Hard", kk: "Қиын" },
  4: { ru: "Адская", en: "Hellish", kk: "Өте қиын" },
};
