import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import * as fs from "node:fs";
import * as path from "node:path";
import { speechToText, ensureCompatibleFormat, computeLoudness, synthesizeSpeech, type JennyVoice } from "./replit_integrations/audio/client";
import { chatComplete } from "./llm";

const JOURNALIST_NAME = "JENNY";
const MAX_QUESTIONS   = 5;
const MAX_SKIPS       = 4;

type Lang = "ru" | "en";

function getLang(body: any): Lang {
  return body?.lang === "en" ? "en" : "ru";
}

interface InterviewAnswer {
  question:     string;
  transcript:   string;
  grammarScore: number;
  dictionScore: number;
  feedback:     string;
}

interface InterviewSession {
  id:              string;
  topic:           string;
  answers:         InterviewAnswer[];
  totalScore:      number;
  currentQuestion: string;
  questionIndex:   number;
  skipCount:       number;
  createdAt:       number;
  lang:            Lang;
}

interface FinalSummary {
  strengths:  string[];
  weaknesses: string[];
  closing:    string;
}

const SESSIONS_FILE = path.join(process.cwd(), ".local", "interview_sessions.json");

function loadSessions(): Map<string, InterviewSession> {
  try {
    if (fs.existsSync(SESSIONS_FILE)) {
      const data = JSON.parse(fs.readFileSync(SESSIONS_FILE, "utf-8"));
      const map = new Map<string, InterviewSession>();
      const cutoff = Date.now() - 2 * 60 * 60 * 1000;
      for (const [k, v] of Object.entries(data)) {
        const s = v as InterviewSession;
        if (s.createdAt >= cutoff) map.set(k, s);
      }
      return map;
    }
  } catch {}
  return new Map();
}

function saveSessions() {
  try {
    const dir = path.dirname(SESSIONS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const obj: Record<string, InterviewSession> = {};
    for (const [k, v] of sessions) obj[k] = v;
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(obj));
  } catch (e) {
    console.warn("Failed to save sessions:", e);
  }
}

setInterval(() => { saveSessions(); }, 30_000);

const sessions = loadSessions();

const INTERVIEW_TOPICS: Record<Lang, string[]> = {
  ru: [
    "Ваша личная жизнь",
    "Ваши мечты и ценности",
    "Люди и отношения в вашей жизни",
    "Счастье и смысл жизни",
    "Жизненный опыт и личные уроки",
    "Ваши амбиции и цели",
    "Детство и воспоминания",
    "Ваши страхи и как вы их преодолеваете",
    "Путешествия и открытия",
    "Творчество и самовыражение",
  ],
  en: [
    "Your personal life",
    "Your dreams and values",
    "People and relationships in your life",
    "Happiness and meaning of life",
    "Life experience and personal lessons",
    "Your ambitions and goals",
    "Childhood and memories",
    "Your fears and how you overcome them",
    "Travel and discoveries",
    "Creativity and self-expression",
  ],
};

const MAX_DAILY_INTERVIEWS = 2;

function getDailyTopics(lang: Lang): { topics: string[]; dateKey: string } {
  const now = new Date();
  const dateKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  let seed = 0;
  for (let i = 0; i < dateKey.length; i++) seed = ((seed << 5) - seed + dateKey.charCodeAt(i)) | 0;
  seed = Math.abs(seed);
  const topics = INTERVIEW_TOPICS[lang];
  const i1 = seed % topics.length;
  let i2 = (seed * 7 + 3) % topics.length;
  if (i2 === i1) i2 = (i2 + 1) % topics.length;
  return { topics: [topics[i1], topics[i2]], dateKey };
}

function generateSessionId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

async function generateGreeting(topic: string, lang: Lang): Promise<string> {
  const systemPrompt = lang === "en"
    ? `You are ${JOURNALIST_NAME}, a warm and professional virtual journalist. Greet the interviewee, introduce yourself by name "${JOURNALIST_NAME}" and announce the interview topic. Be friendly and supportive. 2-3 sentences in English. Plain text, no paragraphs.`
    : `Ты — ${JOURNALIST_NAME}, тёплый и профессиональный виртуальный журналист. Поприветствуй собеседника, представься по имени "${JOURNALIST_NAME}" и объяви тему интервью. Будь дружелюбной и поддерживающей. 2–3 предложения на русском языке. Сплошной текст, без абзацев.`;

  const userPrompt = lang === "en"
    ? `Interview topic: "${topic}". Write a greeting.`
    : `Тема интервью: "${topic}". Напиши приветствие.`;

  const fallback = lang === "en"
    ? `Hello! I'm ${JOURNALIST_NAME}, your virtual journalist. Today we'll talk about "${topic}". Glad to meet you — let's begin!`
    : `Здравствуйте! Я ${JOURNALIST_NAME}, ваш виртуальный журналист. Сегодня мы поговорим о теме «${topic}». Рада нашей встрече — давайте начнём!`;

  const out = await chatComplete({ system: systemPrompt, user: userPrompt, maxTokens: 130 });
  return out || fallback;
}

async function generateInterviewQuestion(
  topic: string,
  questionIndex: number,
  previousAnswers: InterviewAnswer[],
  lang: Lang
): Promise<string> {
  const prevContext =
    previousAnswers.length > 0
      ? (lang === "en"
        ? `Conversation so far:\n${previousAnswers.map((a) => `You asked: ${a.question}\nThey answered: ${a.transcript?.trim() || "(they stayed silent)"}`).join("\n\n")}`
        : `Беседа до этого момента:\n${previousAnswers.map((a) => `Вы спросили: ${a.question}\nОни ответили: ${a.transcript?.trim() || "(человек промолчал)"}`).join("\n\n")}`)
      : "";

  // Jenny's personality lives here: she runs a real conversation, not a form —
  // every question builds on what the person actually just said.
  const systemPrompt = lang === "en"
    ? `You are ${JOURNALIST_NAME}, a warm, alive and emotionally attuned interviewer. Topic of the conversation: "${topic}". You are NOT running a questionnaire — you are having a real human conversation. Listen closely and let your next question grow out of what the person just said: pick up their exact words, their feelings, a detail they mentioned ("You said your father... tell me more about that"). Keep questions simple, open, human and easy to answer. If they stayed silent or gave a very short answer, gently come at it from an easier, more concrete angle. Ask ONE warm question, one or two sentences. Return ONLY the question text — no preface, no quotation marks.`
    : `Ты — ${JOURNALIST_NAME}, тёплый, живой и эмоционально чуткий интервьюер. Тема беседы: "${topic}". Ты ведёшь НЕ анкету, а настоящий человеческий разговор. Внимательно слушай и строй следующий вопрос на том, что человек только что сказал: подхватывай его слова, чувства, упомянутую деталь («Вы сказали, что ваш отец… расскажите об этом подробнее»). Вопросы простые, открытые, человечные, лёгкие для ответа. Если человек промолчал или ответил очень коротко — мягко зайди с другой, более простой и конкретной стороны. Задай ОДИН тёплый вопрос, одно-два предложения. Верни ТОЛЬКО текст вопроса — без вступлений и без кавычек.`;

  const userPrompt = lang === "en"
    ? `${prevContext}\n\nThis is question ${questionIndex + 1} of about ${MAX_QUESTIONS}. Ask your next question — make it follow naturally from their last answer.`
    : `${prevContext}\n\nЭто примерно ${questionIndex + 1}-й вопрос из ${MAX_QUESTIONS}. Задай следующий вопрос — пусть он естественно вытекает из последнего ответа человека.`;

  const fallback = lang === "en" ? "What does happiness mean to you?" : "Что для вас значит счастье?";

  const out = await chatComplete({ system: systemPrompt, user: userPrompt, maxTokens: 80 });
  return out || fallback;
}

function getTransition(grammarScore: number, dictionScore: number, lang: Lang): string {
  const score = grammarScore + dictionScore;
  if (lang === "en") {
    if (score >= 8) {
      const opts = ["Wonderful! A very insightful answer.", "Excellent, thank you! Your thought is very precise.", "Great answer, I'm impressed."];
      return opts[Math.floor(Math.random() * opts.length)];
    } else if (score >= 5) {
      const opts = ["Thank you for your answer.", "Interesting thought, thank you.", "Good, let's continue."];
      return opts[Math.floor(Math.random() * opts.length)];
    } else {
      const opts = ["I see, thank you.", "Okay, let's move to the next question.", "Thank you, let's continue."];
      return opts[Math.floor(Math.random() * opts.length)];
    }
  }
  if (score >= 8) {
    const opts = ["Замечательно! Очень содержательный ответ.", "Прекрасно, спасибо! Ваша мысль очень точная.", "Отличный ответ, я впечатлена."];
    return opts[Math.floor(Math.random() * opts.length)];
  } else if (score >= 5) {
    const opts = ["Спасибо за ваш ответ.", "Интересная мысль, спасибо.", "Хорошо, давайте продолжим."];
    return opts[Math.floor(Math.random() * opts.length)];
  } else {
    const opts = ["Понятно, спасибо.", "Хорошо, переходим к следующему вопросу.", "Спасибо, продолжаем."];
    return opts[Math.floor(Math.random() * opts.length)];
  }
}

interface AnalysisResult {
  grammarScore: number;
  dictionScore: number;
  feedback: string;
  sentiment: "positive" | "negative" | "neutral";
  violated: boolean;
  violationReason: string;
}

async function analyzeAnswer(
  question: string,
  transcript: string,
  topic: string,
  lang: Lang
): Promise<AnalysisResult> {
  const systemPrompt = lang === "en"
    ? `You are an expert in oratory and a content moderator. Perform two actions simultaneously:
1. Evaluate the candidate's answer by two criteria (each 0 to 5):
   - grammarScore — grammar, coherence, vocabulary richness
   - dictionScore — clarity, imagery, persuasiveness
   - feedback — one sentence of feedback in English
2. Check moderation:
   - sentiment — "positive" (polite), "negative" (rude), "neutral" (normal)
   - violated — true ONLY if text contains EXPLICIT profanity, direct insults, calls to violence or blatant discrimination. Do NOT flag: rough tone, slang, short answers, irrelevant answers, speech errors, silence, filler words. When in doubt set violated=false.
   - violationReason — reason for violation (empty string if none)
Respond STRICTLY in JSON: {"grammarScore": <0-5>, "dictionScore": <0-5>, "feedback": "<text>", "sentiment": "positive"|"negative"|"neutral", "violated": false|true, "violationReason": ""}`
    : `Ты — эксперт по ораторскому мастерству и модератор контента. Выполни два действия одновременно:
1. Оцени ответ кандидата по двум критериям (каждый от 0 до 5):
   - grammarScore — грамматика, связность, богатство словарного запаса
   - dictionScore — ясность, образность, убедительность
   - feedback — одно предложение обратной связи по-русски
2. Проверь модерацию:
   - sentiment — "positive" (вежливый), "negative" (грубый), "neutral" (обычный)
   - violated — true ТОЛЬКО если текст содержит ЯВНУЮ нецензурную лексику (мат), прямые оскорбления конкретных людей, призывы к насилию или откровенную дискриминацию. НЕ ставь violated=true за: грубоватый тон, сленг, разговорные выражения, короткие ответы, нерелевантные ответы, ошибки речи, молчание, мычание, слова-паразиты. При любом сомнении ставь violated=false.
   - violationReason — причина нарушения (пустая строка если нет)
Отвечай СТРОГО в JSON: {"grammarScore": <0-5>, "dictionScore": <0-5>, "feedback": "<текст>", "sentiment": "positive"|"negative"|"neutral", "violated": false|true, "violationReason": ""}`;

  const topicLabel = lang === "en" ? "Topic" : "Тема";
  const questionLabel = lang === "en" ? "Question" : "Вопрос";
  const answerLabel = lang === "en" ? "Answer" : "Ответ";
  const fallbackFeedback = lang === "en" ? "Good answer, keep developing." : "Хороший ответ, продолжайте развиваться.";

  const out = await chatComplete({
    system: systemPrompt,
    user: `${topicLabel}: "${topic}"\n${questionLabel}: ${question}\n${answerLabel}: ${transcript}`,
    maxTokens: 200,
    json: true,
  });
  try {
    const p = JSON.parse(out || "{}");
    return {
      grammarScore: Math.min(5, Math.max(0, Math.round(p.grammarScore ?? 2))),
      dictionScore: Math.min(5, Math.max(0, Math.round(p.dictionScore ?? 2))),
      feedback: p.feedback ?? fallbackFeedback,
      sentiment: ["positive", "negative", "neutral"].includes(p.sentiment) ? p.sentiment : "neutral",
      violated: p.violated === true && typeof p.violationReason === "string" && p.violationReason.trim().length >= 10,
      violationReason: typeof p.violationReason === "string" ? p.violationReason : "",
    };
  } catch {
    return {
      grammarScore: 2, dictionScore: 2,
      feedback: fallbackFeedback,
      sentiment: "neutral", violated: false, violationReason: "",
    };
  }
}

async function generateStructuredSummary(session: InterviewSession): Promise<FinalSummary> {
  const lang = session.lang ?? "ru";
  const answersText = session.answers
    .map((a, i) => lang === "en"
      ? `Question ${i + 1}: ${a.question}\nAnswer: ${a.transcript || "(no answer)"}`
      : `Вопрос ${i + 1}: ${a.question}\nОтвет: ${a.transcript || "(нет ответа)"}`)
    .join("\n\n");

  const systemPrompt = lang === "en"
    ? `You are ${JOURNALIST_NAME}, a journalist who has finished an interview. Give caring, developmental feedback. Respond STRICTLY in JSON:\n{"strengths": ["strength 1", "strength 2", "strength 3"], "weaknesses": ["growth area 1", "growth area 2"], "closing": "Warm supportive words, 1-2 sentences."}\nExamples of strengths: confident tone, good speech pace, sincerity, clear formulations, openness.\nExamples of growth areas: short answers, long pauses, filler words, uncertain sentence beginnings.\nFormulate carefully and constructively.`
    : `Ты — ${JOURNALIST_NAME}, журналист завершивший интервью. Дай бережную, развивающую обратную связь. Отвечай СТРОГО в JSON:\n{"strengths": ["сильная сторона 1", "сильная сторона 2", "сильная сторона 3"], "weaknesses": ["точка роста 1", "точка роста 2"], "closing": "Тёплые слова поддержки, 1-2 предложения."}\nПримеры сильных сторон: уверенный тон, хорошая скорость речи, искренность, ясные формулировки, открытость.\nПримеры точек роста: короткие ответы, длинные паузы, слова-паразиты, неуверенное начало фразы.\nФормулируй бережно и конструктивно.`;

  const topicLabel = lang === "en" ? "Topic" : "Тема";
  const fallbackStrengths = lang === "en"
    ? ["You participated in the interview", "Courage to speak out loud"]
    : ["Вы участвовали в интервью", "Смелость говорить вслух"];
  const fallbackClosing = lang === "en"
    ? "Thank you for the interview! Great job, keep training."
    : "Спасибо за интервью! Вы молодец, продолжайте тренироваться.";

  const out = await chatComplete({
    system: systemPrompt,
    user: `${topicLabel}: "${session.topic}"\n\n${answersText}`,
    maxTokens: 350,
    json: true,
  });
  try {
    const p = JSON.parse(out || "{}");
    return {
      strengths:  Array.isArray(p.strengths)  ? p.strengths.slice(0, 4)  : [fallbackStrengths[0]],
      weaknesses: Array.isArray(p.weaknesses) ? p.weaknesses.slice(0, 3) : [],
      closing:    typeof p.closing === "string" ? p.closing : fallbackClosing,
    };
  } catch {
    return {
      strengths:  fallbackStrengths,
      weaknesses: [],
      closing:    fallbackClosing,
    };
  }
}

// ── Interview answer-judge load guard ────────────────────────────────────────
// The AI judge (/api/judge-answer) is a best-effort enhancement worth ~10% of
// the score. To keep the backend alive under load we shed judge requests beyond
// a concurrency cap — the client then falls back to its autonomous score, so
// the game never stalls. (For a multi-instance deploy, back this with Redis.)
let judgeInFlight = 0;
const JUDGE_MAX_INFLIGHT = Number(process.env.JUDGE_MAX_INFLIGHT ?? 40);
// Fast, cheap model for the high-volume judge (override via env).
const JUDGE_MODEL = process.env.JUDGE_MODEL ?? "claude-haiku-4-5-20251001";

// Hidden text-match for Show Time: what fraction of the script's UNIQUE words the
// player actually said. Deterministic and O(unique) via Set membership — capped
// so a very long Show Time script never becomes a heavy computation.
function textCoverage(scriptText: string, transcript: string): number {
  const norm = (s: string) =>
    (s || "").toLowerCase().replace(/ё/g, "е").replace(/[^a-zа-я\s]/gi, " ").replace(/\s+/g, " ").trim();
  const scriptWords = Array.from(new Set(norm(scriptText).split(" ").filter(Boolean))).slice(0, 800);
  if (scriptWords.length === 0) return 0;
  const spoken = new Set(norm(transcript).split(" ").filter(Boolean));
  if (spoken.size === 0) return 0;
  let hit = 0;
  for (const w of scriptWords) if (spoken.has(w)) hit++;
  return hit / scriptWords.length;
}

export async function registerRoutes(app: Express): Promise<Server> {

  // Lightweight health probe. Used by start-expo-dev.ps1 to detect whether the
  // API is already up before spawning another instance. Kept on /api so it works
  // even when this process runs as a pure API server (KS_EXTERNAL_METRO=1) and
  // doesn't serve the web landing page at "/".
  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  // Vocabulary level — synonym checker. Used by the native fallback path of
  // app/vocabulary-level.tsx (a text input — no native STT engine is bundled
  // in this build); web validates synonyms client-side via the SpeechRecognition
  // API and findMatchedSynonym. Normalisation matches the client-side
  // `checkSynonym` exactly so web and native behave the same.
  // Contract:
  //   { transcript: string, synonyms: string[], foundAlready: string[] }
  //   → { matched: string | null, isValid: boolean, alreadyFound: boolean }
  // `alreadyFound` lets the client silently ignore repeats instead of
  // showing a "wrong" feed entry.
  app.post("/api/vocabulary/check-synonym", (req: Request, res: Response) => {
    try {
      const { transcript, synonyms, foundAlready } = req.body ?? {};
      if (
        typeof transcript !== "string" ||
        !Array.isArray(synonyms) ||
        !Array.isArray(foundAlready)
      ) {
        return res
          .status(400)
          .json({ error: "transcript, synonyms[], foundAlready[] required" });
      }
      const normalize = (s: string) =>
        String(s)
          .toLowerCase()
          .trim()
          .replace(/[.,!?]/g, "")
          .replace(/ё/g, "е");
      const cleanInput = normalize(transcript);
      if (!cleanInput) {
        return res.json({ matched: null, isValid: false, alreadyFound: false });
      }
      const normalizedSyns = synonyms.map((s: string) => ({
        raw: s,
        n: normalize(s),
      }));
      const exact = normalizedSyns.find((p) => p.n === cleanInput);
      const partial = !exact
        ? normalizedSyns.find((p) => p.n && cleanInput.includes(p.n))
        : null;
      const matchedRaw = (exact ?? partial)?.raw ?? null;
      const alreadyFound = matchedRaw
        ? foundAlready.map(normalize).includes(normalize(matchedRaw))
        : false;
      return res.json({
        matched: alreadyFound ? null : matchedRaw,
        isValid: !!matchedRaw && !alreadyFound,
        alreadyFound,
      });
    } catch (err) {
      console.error("[vocabulary/check-synonym]", err);
      return res.status(500).json({ error: "internal_error" });
    }
  });

  // Pure transcription endpoint. Used by the honest client-side analyzer
  // (services/speechAnalysis.ts) for warmup / tongue-twister / show-time /
  // reading levels — anything that doesn't need a GPT judgement, just the
  // words the user actually said.
  // Contract: { audioBase64, audioDurationSeconds? } →
  //   { transcript, audioDurationSeconds, audioRms, audioPeak, audioMeanVolumeDb, audioMaxVolumeDb }.
  // - Duration is sourced from the client (it's the recording timer that
  //   drove the UI); the server echoes it as the single source of truth.
  // - Loudness is computed by ffmpeg's `volumedetect` on the converted WAV
  //   so the analyzer can score volume from the real signal, not duration.
  app.post("/api/transcribe", async (req: Request, res: Response) => {
    try {
      const { audioBase64, audioDurationSeconds } = req.body;
      if (!audioBase64 || typeof audioBase64 !== "string") {
        return res.status(400).json({ error: "audioBase64 required" });
      }
      const durationOut = Number.isFinite(Number(audioDurationSeconds))
        ? Math.max(0, Number(audioDurationSeconds))
        : 0;
      const rawBuffer = Buffer.from(audioBase64, "base64");
      console.log(
        "[transcribe] inBytes=",
        rawBuffer.length,
        " durSec=",
        durationOut,
      );
      if (rawBuffer.length < 200) {
        // Empty / silent buffer (mic blocked, no audio captured). The
        // recording wasn't analyzable, so omit loudness fields entirely
        // — the client falls back to its duration heuristic.
        console.warn(
          "[transcribe] buffer too small (",
          rawBuffer.length,
          "B) — returning empty transcript",
        );
        return res.json({
          transcript: "",
          audioDurationSeconds: durationOut,
          audioRms: null,
          audioPeak: null,
          audioMeanVolumeDb: null,
          audioMaxVolumeDb: null,
        });
      }
      const { buffer, format } = await ensureCompatibleFormat(rawBuffer);
      // Run transcription and loudness measurement in parallel — they both
      // operate on the same converted buffer and don't depend on each other.
      const [transcript, loudness] = await Promise.all([
        speechToText(buffer, format),
        computeLoudness(buffer).catch((err) => {
          console.warn("computeLoudness failed:", err);
          return { ok: false, rms: 0, peak: 0, meanVolumeDb: -Infinity, maxVolumeDb: -Infinity };
        }),
      ]);
      // When loudness analysis failed (ffmpeg crash, non-zero exit, no
      // parseable output) return null so the client falls back to the
      // duration heuristic instead of mistaking the failure for silence.
      // dB anchors are sent as numbers when finite, null for valid silence
      // — JSON doesn't have an Infinity literal.
      const dbOrNull = (v: number) => Number.isFinite(v) ? v : null;
      return res.json({
        transcript: transcript ?? "",
        audioDurationSeconds: durationOut,
        audioRms: loudness.ok ? loudness.rms : null,
        audioPeak: loudness.ok ? loudness.peak : null,
        audioMeanVolumeDb: loudness.ok ? dbOrNull(loudness.meanVolumeDb) : null,
        audioMaxVolumeDb: loudness.ok ? dbOrNull(loudness.maxVolumeDb) : null,
      });
    } catch (err) {
      console.error("transcribe error:", err);
      return res.status(500).json({ error: "Transcription failed" });
    }
  });

  // Jenny's voice. Turns a line of text into natural human-sounding speech.
  // The interview client calls this for the greeting, every question, the
  // reactions and the spoken summary. Returns base64 audio the client plays.
  // NOTE: this consumes paid AI — gate it behind the premium entitlement
  // check (RevenueCat) once payments are wired, before doing real work.
  app.post("/api/tts", async (req: Request, res: Response) => {
    try {
      const { text, voice, instructions } = req.body ?? {};
      if (!text || typeof text !== "string" || !text.trim()) {
        return res.status(400).json({ error: "text required" });
      }
      const { buffer, format } = await synthesizeSpeech(text.trim().slice(0, 2000), {
        voice: voice as JennyVoice | undefined,
        instructions: typeof instructions === "string" ? instructions : undefined,
      });
      return res.json({ audioBase64: buffer.toString("base64"), format });
    } catch (err) {
      console.error("tts error:", err);
      return res.status(500).json({ error: "Speech synthesis failed" });
    }
  });

  // Interview judgement endpoint. Returns logic + eloquence on a 0..10
  // scale plus an optional one-line tip. Called by the analyzer for any
  // levelType whose base type is "interview".
  app.post("/api/analyze-interview", async (req: Request, res: Response) => {
    try {
      const { transcript } = req.body;
      const lang = getLang(req.body);
      if (!transcript || typeof transcript !== "string" || transcript.trim().length < 4) {
        // Nothing to score — return neutral 6s so the analyzer can carry on.
        return res.json({ logic: 6, eloquence: 6 });
      }
      const systemPrompt = lang === "en"
        ? `You are a strict speech coach scoring an interview answer. Rate two qualities on a 0..10 scale:\n- logic: clarity of thought, structure (thesis → argument → conclusion), coherence.\n- eloquence: vocabulary range, precise wording, expressive style (penalize generic phrases & filler).\nReturn STRICTLY JSON: {"logic": <0-10>, "eloquence": <0-10>, "tip": "<one short coaching tip in English>"}`
        : `Ты — строгий тренер по речи, оценивающий ответ на интервью. Оцени два качества по шкале 0..10:\n- logic: ясность мысли, структура (тезис → аргумент → вывод), связность.\n- eloquence: богатство словаря, точность формулировок, выразительность (штрафуй за шаблоны и слова-паразиты).\nВерни СТРОГО JSON: {"logic": <0-10>, "eloquence": <0-10>, "tip": "<один короткий совет на русском>"}`;
      const out = await chatComplete({
        system: systemPrompt,
        user: transcript.trim().slice(0, 4000),
        maxTokens: 200,
        json: true,
      });
      let parsed: any = {};
      try { parsed = JSON.parse(out || "{}"); } catch { parsed = {}; }
      const clamp = (v: any) => {
        const n = Number(v);
        if (!Number.isFinite(n)) return 6;
        return Math.min(10, Math.max(0, n));
      };
      return res.json({
        logic: clamp(parsed.logic),
        eloquence: clamp(parsed.eloquence),
        tip: typeof parsed.tip === "string" ? parsed.tip : undefined,
      });
    } catch (err) {
      console.error("analyze-interview error:", err);
      return res.status(500).json({ error: "Interview analysis failed" });
    }
  });

  // Interview answer-judge (~10% of the score). Answers TWO questions only:
  //   1) relevance — did the player actually answer THIS question? (primary)
  //   2) competence — how literate / coherent the answer is.
  // Everything else is scored by the client's autonomous mechanism. Under load
  // we return { available:false } so the client uses its autonomous score.
  app.post("/api/judge-answer", async (req: Request, res: Response) => {
    const lang = getLang(req.body);
    const { question, transcript } = req.body ?? {};
    if (!transcript || typeof transcript !== "string" || transcript.trim().length < 4) {
      return res.json({ available: false, reason: "empty" });
    }
    if (judgeInFlight >= JUDGE_MAX_INFLIGHT) {
      return res.status(503).json({ available: false, reason: "overloaded" });
    }
    judgeInFlight++;
    try {
      const system = lang === "en"
        ? `You are a fair but strict interview examiner. You are given a QUESTION and the TRANSCRIPT of a spoken answer. Judge ONLY two things:\n1) relevance (0..10) — how well the answer actually ADDRESSES THIS SPECIFIC QUESTION. This is the priority: 10 = answers it directly and fully; 5 = partial / adjacent; 0 = did not answer / off-topic.\n2) competence (0..10) — how literate and coherent the wording is (logic, precision, range; penalize waffle and fillers).\nIgnore pronunciation and loudness — text only.\nverdict: "yes" | "partial" | "off".\nnote: one short English sentence on what to improve (relevance first).\nReturn STRICTLY JSON: {"relevance":<0-10>,"competence":<0-10>,"verdict":"yes|partial|off","note":"..."}`
        : `Ты — справедливый, но строгий экзаменатор на собеседовании. Тебе дают ВОПРОС и РАСШИФРОВКУ устного ответа. Оцени СТРОГО две вещи:\n1) relevance (0..10) — насколько ответ ПО СУЩЕСТВУ отвечает ИМЕННО НА ЭТОТ вопрос. Это приоритет: 10 = ответил прямо и полно; 5 = частично / рядом; 0 = не ответил / не о том.\n2) competence (0..10) — насколько грамотно и связно построен ответ (логика, точность, богатство речи; штрафуй за воду и слова-паразиты).\nНе оценивай произношение и громкость — только текст.\nverdict: "yes" | "partial" | "off" — ответил ли по теме.\nnote: одна короткая фраза на русском, что улучшить (в первую очередь про соответствие вопросу).\nВерни СТРОГО JSON: {"relevance":<0-10>,"competence":<0-10>,"verdict":"yes|partial|off","note":"..."}`;
      const user = JSON.stringify({
        question: String(question ?? "").slice(0, 600),
        answer: transcript.trim().slice(0, 3000),
      });
      // Prefer the cheap/fast judge model; if the key can't use it, fall back to
      // the default (known-good) model so the judge still works.
      let out: string;
      try {
        out = await chatComplete({ system, user, maxTokens: 160, json: true, model: JUDGE_MODEL });
      } catch (modelErr) {
        console.warn(`judge-answer: model "${JUDGE_MODEL}" failed, retrying with default model:`, (modelErr as any)?.message);
        out = await chatComplete({ system, user, maxTokens: 160, json: true });
      }
      let parsed: any = {};
      try { parsed = JSON.parse(out || "{}"); } catch { parsed = {}; }
      const clamp = (v: any) => {
        const n = Number(v);
        return Number.isFinite(n) ? Math.min(10, Math.max(0, n)) : null;
      };
      const relevance = clamp(parsed.relevance);
      const competence = clamp(parsed.competence);
      if (relevance == null || competence == null) {
        return res.json({ available: false, reason: "parse" });
      }
      const verdict = ["yes", "partial", "off"].includes(parsed.verdict)
        ? parsed.verdict
        : relevance >= 7 ? "yes" : relevance >= 4 ? "partial" : "off";
      return res.json({
        available: true,
        relevance,
        competence,
        verdict,
        note: typeof parsed.note === "string" ? parsed.note.slice(0, 240) : undefined,
      });
    } catch (err) {
      console.error("judge-answer error:", err);
      return res.status(503).json({ available: false, reason: "error" });
    } finally {
      judgeInFlight--;
    }
  });

  // Show Time PAID feedback formatter (speech-engine §7.4). The client sends
  // ONLY metrics + short worst-case quotes (never audio or the full transcript).
  // Claude acts strictly as an EDITOR: it turns numbers into supportive prose,
  // it does NOT analyze. On any failure the client falls back to templates.
  app.post("/api/feedback/showtime", async (req: Request, res: Response) => {
    try {
      const { metrics, worstQuotes, rank } = req.body ?? {};
      const lang = getLang(req.body);
      if (!metrics || typeof metrics !== "object") {
        return res.status(400).json({ error: "metrics required" });
      }
      const quotes: string[] = Array.isArray(worstQuotes)
        ? worstQuotes.filter((q: unknown) => typeof q === "string").slice(0, 4)
        : [];
      const systemPrompt = lang === "en"
        ? `You are an editor for a speech-training app, NOT an analyzer. You are given already-computed metrics (0..1 unless noted) and up to 4 short quotes. Turn them into exactly 3 short, supportive paragraphs of coaching. Rules: invent NO facts beyond the metrics; name at most ONE growth area; always open with genuine praise; warm, concrete, second person. No lists, no scores, no markdown.`
        : `Ты — редактор приложения для тренировки речи, а НЕ аналитик. Тебе даны уже посчитанные метрики (0..1, если не указано иное) и до 4 коротких цитат. Преврати их РОВНО в 3 коротких поддерживающих абзаца разбора. Правила: не придумывай фактов сверх метрик; называй не больше ОДНОЙ зоны роста; всегда начинай с искренней похвалы; тепло, конкретно, на «ты». Без списков, без баллов, без разметки.`;
      const feedback = await chatComplete({
        system: systemPrompt,
        user: JSON.stringify({ metrics, worstQuotes: quotes, rank }).slice(0, 4000),
        maxTokens: 500,
      });
      return res.json({ feedback: feedback.trim() });
    } catch (err) {
      console.error("feedback/showtime error:", err);
      return res.status(500).json({ error: "Feedback formatting failed" });
    }
  });

  app.post("/api/analyze-speech", async (req: Request, res: Response) => {
    try {
      const { audioBase64, title, durationSeconds, moduleNumber } = req.body;
      const scriptText: string = typeof req.body.scriptText === "string" ? req.body.scriptText : "";
      const lang = getLang(req.body);
      if (!audioBase64) return res.status(400).json({ error: "audioBase64 required" });

      const rawBuffer = Buffer.from(audioBase64, "base64");
      const { buffer, format } = await ensureCompatibleFormat(rawBuffer);
      const transcript = await speechToText(buffer, format);

      const labels = lang === "en"
        ? { diction: "Diction", expressiveness: "Expressiveness", voice: "Voice", confidence: "Confidence" }
        : { diction: "Дикция", expressiveness: "Выразительность", voice: "Голос", confidence: "Уверенность" };

      if (!transcript || transcript.trim().length < 8) {
        const silentFeedback = lang === "en"
          ? "We didn't quite hear you. No worries — to pass this level just speak out loud, a little louder and closer to the mic."
          : "Кажется, мы тебя не услышали. Ничего страшного — чтобы пройти уровень, просто говори вслух, чуть увереннее и ближе к микрофону.";
        const silentError = lang === "en"
          ? "Speech not detected - microphone didn't pick up voice or speech wasn't delivered."
          : "Речь не обнаружена — микрофон не уловил голос или выступление не было произнесено.";
        return res.json({
          stars: 0, score: 0, silent: true, transcript: transcript ?? "",
          feedback: silentFeedback,
          categories: {
            diction:        { score: 0, label: labels.diction },
            expressiveness: { score: 0, label: labels.expressiveness },
            voice:          { score: 0, label: labels.voice },
            confidence:     { score: 0, label: labels.confidence },
          },
          metrics: {
            clarity: 0, expressiveness: 0, volume: 0, confidence: 0, tempo: 0, pauses: 0,
          },
          errors: [silentError],
          textMatch: null, wordCount: 0, durationSec: null, readOk: false,
        });
      }

      // --- Real measured signals so scoring is grounded, not guessed ---
      // Acoustic loudness (volume/projection) straight from the audio.
      const loud = await computeLoudness(buffer).catch(() => ({
        ok: false, rms: 0, peak: 0, meanVolumeDb: -Infinity, maxVolumeDb: -Infinity,
      }));
      // Speech rate (tempo) and filler density from the transcript + duration.
      const tokens = transcript.toLowerCase().split(/[^a-zа-яё0-9]+/i).filter(Boolean);
      const wordCount = tokens.length;
      // Hidden Show Time signals: how much of the script was actually read, and
      // whether this counts as a genuine read (not a skip / random noise).
      const textMatch = scriptText.trim().length >= 20 ? textCoverage(scriptText, transcript) : null;
      const readOk = wordCount >= 12 && (textMatch == null || textMatch >= 0.15);
      const FILLERS_RU = ["э", "эм", "ну", "типа", "значит", "вот", "короче", "это", "блин", "как бы", "в общем", "так сказать", "это самое"];
      const FILLERS_EN = ["um", "uh", "like", "basically", "actually", "so", "well", "you know", "i mean", "kinda", "sorta"];
      const single = new Set((lang === "en" ? FILLERS_EN : FILLERS_RU).filter((f) => !f.includes(" ")));
      const multi = (lang === "en" ? FILLERS_EN : FILLERS_RU).filter((f) => f.includes(" "));
      const lowerText = " " + transcript.toLowerCase() + " ";
      let fillerCount = tokens.filter((t) => single.has(t)).length;
      for (const phrase of multi) fillerCount += lowerText.split(phrase).length - 1;
      const dur = typeof durationSeconds === "number" && durationSeconds > 0 ? durationSeconds : null;
      const wpm = dur ? Math.round(wordCount / (dur / 60)) : null;
      const naLabel = lang === "en" ? "not measured" : "не измерено";

      // Translate the raw acoustic loudness into a plain, human-readable level
      // BEFORE handing it to the AI. This keeps scoring grounded in the real
      // measurement while making sure the model never even sees a technical
      // unit (dBFS) it could otherwise echo back to the player.
      const loudnessLevel = (() => {
        if (!loud.ok || !Number.isFinite(loud.meanVolumeDb)) return null;
        if (Number.isFinite(loud.maxVolumeDb) && loud.maxVolumeDb >= -1) return "tooLoud" as const;
        if (loud.meanVolumeDb >= -12) return "loud" as const;
        if (loud.meanVolumeDb >= -20) return "good" as const;
        if (loud.meanVolumeDb >= -30) return "quiet" as const;
        return "tooQuiet" as const;
      })();
      const loudnessText = (() => {
        if (!loudnessLevel) return naLabel;
        const map = lang === "en"
          ? { tooLoud: "too loud, the voice is overloaded", loud: "strong, maybe a touch too loud", good: "clear and confident", quiet: "a little quiet", tooQuiet: "barely audible (too quiet)" }
          : { tooLoud: "слишком громко, голос перегружен", loud: "сильно, возможно чуть громко", good: "чисто и уверенно", quiet: "немного тихо", tooQuiet: "почти не слышно (слишком тихо)" };
        return map[loudnessLevel];
      })();

      const signals = lang === "en"
        ? `Measured signals (rely on these — do NOT guess volume or tempo):\n- Duration: ${dur ? dur.toFixed(1) + " s" : naLabel}\n- Words: ${wordCount}\n- Speech rate: ${wpm ? wpm + " words/min" : naLabel}\n- Voice loudness: ${loudnessText}\n- Filler words detected: ${fillerCount}`
        : `Измеренные сигналы (опирайся на них — НЕ угадывай громкость и темп):\n- Длительность: ${dur ? dur.toFixed(1) + " c" : naLabel}\n- Слов: ${wordCount}\n- Темп речи: ${wpm ? wpm + " слов/мин" : naLabel}\n- Громкость голоса: ${loudnessText}\n- Слов-паразитов: ${fillerCount}`;

      // --- Difficulty-aware leniency ---
      // Early modules are scored gently and warmly (lead with strengths and
      // progress); later modules raise the bar and get more honest — but never
      // harsh. Module number comes from the client (1..67). When it's missing
      // (trainer / free play) we fall back to the balanced middle tier.
      const modNum = typeof moduleNumber === "number" && Number.isFinite(moduleNumber) ? moduleNumber : null;
      const tier: "early" | "mid" | "advanced" =
        modNum == null ? "mid" : modNum <= 10 ? "early" : modNum <= 30 ? "mid" : "advanced";
      const leniencyDirective = (lang === "en"
        ? {
            early: `DIFFICULTY — EARLY module: keep the WORDING warm and encouraging, but score HONESTLY — do NOT inflate or round borderline scores up. Reflect exactly how the delivery actually sounded: if a criterion was weak, score it low (1-2 when warranted) and frame the fix as an easy next step. Accuracy in the numbers, kindness only in the tone.`,
            mid: `DIFFICULTY — MID-LEVEL module: keep a warm, balanced tone. Acknowledge what worked, then give one honest, concrete thing to improve. Score fairly — neither inflating nor harsh.`,
            advanced: `DIFFICULTY — ADVANCED module: the speaker is experienced now. Be honest and precise, hold a higher bar and do NOT inflate scores. Stay supportive and respectful — demanding, but never harsh or discouraging.`,
          }
        : {
            early: `СЛОЖНОСТЬ — НАЧАЛЬНЫЙ модуль: держи ФОРМУЛИРОВКИ тёплыми и подбадривающими, но оценивай ЧЕСТНО — НЕ завышай и НЕ округляй пограничные баллы вверх. Отражай ровно то, как реально звучала подача: если критерий слабый — ставь низкий балл (1-2, когда это оправдано) и подавай исправление как лёгкий следующий шаг. Точность в цифрах, доброта только в тоне.`,
            mid: `СЛОЖНОСТЬ — СРЕДНИЙ модуль: держи тёплый, сбалансированный тон. Отметь, что получилось, затем дай одно честное, конкретное улучшение. Оценивай справедливо — без завышения, но и без жёсткости.`,
            advanced: `СЛОЖНОСТЬ — ПРОДВИНУТЫЙ модуль: игрок уже опытный. Будь честным и точным, держи более высокую планку и НЕ завышай баллы. Оставайся поддерживающим и уважительным — требовательно, но никогда не жёстко и не обескураживающе.`,
          })[tier];

      const systemPrompt = lang === "en"
        ? `You are a warm, encouraging speech mentor who genuinely believes in the speaker. The speaker is reading a PRE-WRITTEN text aloud — so do NOT judge the text itself: its wording, content, grammar, structure and word choice are NOT graded. Score ONLY how it is VOICED (delivery) on 6 criteria (each 1-5), using the transcription for pacing/fillers AND the measured signals (do not guess volume/tempo — rely on the data):\n1. diction — articulation & intelligibility; lower it for mumbled/garbled/cut-off words.\n2. expressiveness — VOCAL expressiveness: intonation variety, emphasis, emotional colour in the VOICE (not the text's content).\n3. voice — loudness & projection. Use the measured "Voice loudness" level: "clear and confident" = strong (4-5); "a little quiet" or "barely audible" = weak (1-2); "too loud, the voice is overloaded" also loses points.\n4. confidence — steady, firm voice without hesitation; many fillers/false starts lower it.\n5. tempo — from speech rate: a comfortable conversational pace (~110-150 words/min) is best (4-5); racing through (>180) or dragging (<90) lowers it. If rate not measured, judge from phrasing.\n6. pauses — meaningful pauses are good; frequent fillers/hesitation are not (use the filler count).\nCalibration: 5 = experienced speaker, 3 = average, 1 = serious problems. Be honest, but kind — lead with what went well, then gently point to one thing to grow.\nstars: 1 if average < 2.5; 2 if 2.5-3.9; 3 if >= 4.0.\n${leniencyDirective}\nTONE — THIS IS CRITICAL:\n- Write "summary", "tip" and "errors" like a warm human mentor talking to a friend, NEVER like a technical analyzer. The speaker should finish feeling encouraged and motivated, not criticized.\n- NEVER use technical terms or units. Forbidden: dBFS, decibels, dB, clipping, overload, signal, amplitude, frequency, and bare numbers with units. Turn every issue into plain, caring language. For example:\n  • too loud / overloaded → "your voice sounds too loud and a little strained — try speaking a touch softer"\n  • too quiet / barely audible → "you're hard to hear — speak up a bit, with more confidence"\n  • mumbling → "some words blur together — open your mouth a little more and they'll land"\n  • rushing → "you're speeding up a little — give your words room to breathe"\n- "summary", "tip" and "errors" must be about DELIVERY only (mumbling, rushing, monotone, too quiet, fillers) — NEVER about the wording or content of the text.\nReturn STRICTLY JSON: {"stars":<1|2|3>,"diction":<1-5>,"expressiveness":<1-5>,"voice":<1-5>,"confidence":<1-5>,"tempo":<1-5>,"pauses":<1-5>,"summary":"<one warm sentence about delivery>","tip":"<one concrete, kind delivery tip for the weakest criterion>","errors":["<delivery issue in plain, supportive words>", ...]}`
        : `Ты — тёплый, поддерживающий наставник по речи, который искренне верит в говорящего. Спикер читает вслух ЗАГОТОВЛЕННЫЙ текст — поэтому НЕ оценивай сам текст: его слова, содержание, грамматику, структуру и формулировки НЕ суди. Оценивай ТОЛЬКО то, как это ОЗВУЧЕНО (подачу), по 6 критериям (каждый 1-5), используя транскрипцию для темпа/слов-паразитов И измеренные сигналы (НЕ угадывай громкость/темп — опирайся на данные):\n1. diction — Дикция: чёткость и разборчивость; снижай за смазанные/оборванные слова.\n2. expressiveness — ВОКАЛЬНАЯ выразительность: интонационное разнообразие, акценты, эмоциональная окраска ГОЛОСА (не содержание текста).\n3. voice — Голос/громкость: опирайся на измеренный уровень «Громкость голоса»: «чисто и уверенно» = сильно (4-5); «немного тихо» или «почти не слышно» = слабо (1-2); «слишком громко, голос перегружен» тоже минус.\n4. confidence — Уверенность: ровный, твёрдый голос без колебаний; много слов-паразитов и оговорок снижают балл.\n5. tempo — Темп: по скорости речи: спокойный разговорный темп (~110-150 слов/мин) — лучше всего (4-5); тараторит (>180) или тянет (<90) — ниже. Если скорость не измерена — оцени по построению фраз.\n6. pauses — Паузы: осмысленные паузы хорошо; частые запинки/слова-паразиты плохо (учитывай число слов-паразитов).\nКалибровка: 5 = опытный спикер, 3 = средне, 1 = серьёзные проблемы. Будь честным, но добрым — сначала отметь, что получилось, потом мягко подскажи одно, над чем поработать.\nstars: 1 если средний < 2.5; 2 если 2.5-3.9; 3 если >= 4.0.\n${leniencyDirective}\nТОН — ЭТО КРИТИЧЕСКИ ВАЖНО:\n- Пиши "summary", "tip" и "errors" как тёплый живой наставник, говорящий с другом, НИКОГДА как технический анализатор. После обратной связи игрок должен чувствовать поддержку и желание продолжать, а не критику.\n- НИКОГДА не используй технические термины и единицы. Запрещено: dBFS, децибелы, дБ, клиппинг, перегруз, сигнал, амплитуда, частота и голые числа с единицами. Переводи каждую проблему на простой, тёплый язык. Например:\n  • слишком громко / перегруз → «твой голос звучит слишком громко и немного напряжённо — попробуй говорить чуть мягче»\n  • слишком тихо / почти не слышно → «тебя почти не слышно — говори увереннее и чуть громче»\n  • смазанность → «некоторые слова сливаются — открывай рот чуть шире, и они зазвучат чётко»\n  • спешка → «ты немного ускоряешься — дай словам пространство, не торопись»\n- "summary", "tip" и "errors" — ТОЛЬКО про подачу голосом (смазанность, спешка, монотонность, тихо, слова-паразиты), НИКОГДА про слова или содержание текста.\nВерни СТРОГО JSON: {"stars":<1|2|3>,"diction":<1-5>,"expressiveness":<1-5>,"voice":<1-5>,"confidence":<1-5>,"tempo":<1-5>,"pauses":<1-5>,"summary":"<одно тёплое предложение про подачу>","tip":"<один конкретный, добрый совет по подаче для самого слабого критерия>","errors":["<проблема подачи простыми, поддерживающими словами>", ...]}`;

      const topicLabel = lang === "en" ? "Speech topic" : "Тема выступления";
      const transcriptLabel = lang === "en" ? "Transcription" : "Транскрипция";
      const fallbackSummary = lang === "en" ? "Good performance!" : "Хорошее выступление!";

      const out = await chatComplete({
        system: systemPrompt,
        user: `${topicLabel}: "${title ?? (lang === "en" ? "public speech" : "публичное выступление")}"\n\n${signals}\n\n${transcriptLabel}:\n${transcript}`,
        maxTokens: 400,
        json: true,
      });

      let parsed: any = {};
      try { parsed = JSON.parse(out || "{}"); } catch { parsed = {}; }

      const stars = Math.min(3, Math.max(1, Math.round(parsed.stars ?? 2))) as 1 | 2 | 3;
      const scoreMap: Record<1 | 2 | 3, number> = { 1: 4, 2: 7, 3: 10 };

      const clamp = (v: any) => Math.min(5, Math.max(1, Math.round(v ?? 3)));
      const dictionScore        = clamp(parsed.diction);
      const expressivenessScore = clamp(parsed.expressiveness);
      const voiceScore          = clamp(parsed.voice);
      const confidenceScore     = clamp(parsed.confidence);
      const tempoScore          = clamp(parsed.tempo);
      const pausesScore         = clamp(parsed.pauses);

      return res.json({
        stars, score: scoreMap[stars], silent: false, transcript,
        feedback: parsed.summary ?? fallbackSummary,
        categories: {
          diction:        { score: dictionScore,        label: labels.diction },
          expressiveness: { score: expressivenessScore, label: labels.expressiveness },
          voice:          { score: voiceScore,          label: labels.voice },
          confidence:     { score: confidenceScore,     label: labels.confidence },
        },
        // Per-metric weakness scores (1-5) keyed by the canonical metric name
        // used by RankUpScreen tips. Tempo and pauses are derived only from
        // the full AI evaluation, so they live here rather than in `categories`.
        metrics: {
          clarity:        dictionScore,
          expressiveness: expressivenessScore,
          volume:         voiceScore,
          confidence:     confidenceScore,
          tempo:          tempoScore,
          pauses:         pausesScore,
        },
        errors: Array.isArray(parsed.errors) ? parsed.errors.slice(0, 5) : [],
        tip: typeof parsed.tip === "string" ? parsed.tip : undefined,
        // Hidden Show Time tolerance signals (transcript is NOT surfaced).
        textMatch,
        wordCount,
        durationSec: dur,
        readOk,
      });
    } catch (err) {
      console.error("analyze-speech error:", err);
      return res.status(500).json({ error: "Analysis failed" });
    }
  });

  // ---------------------------------------------------------------------
  // Roles («Роли») performance scoring. Scores a role scenario on 5
  // role-specific criteria (1-5): role fit, emotion, clarity, confidence,
  // grammar. Degrades gracefully: if transcription or the AI is unavailable
  // (missing keys in dev), we still return an honest deterministic score
  // grounded in the measured loudness / tempo so the flow never breaks.
  // ---------------------------------------------------------------------
  app.post("/api/analyze-role", async (req: Request, res: Response) => {
    const lang = getLang(req.body);
    const roleLabels = lang === "en"
      ? { roleFit: "Role fit", emotion: "Emotion", clarity: "Diction", confidence: "Confidence", grammar: "Grammar" }
      : { roleFit: "Соответствие роли", emotion: "Эмоции", clarity: "Чёткость произношения", confidence: "Уверенность", grammar: "Грамматика" };

    const {
      audioBase64,
      roleTitle,
      roleScene,
      scriptedText,
      mode,
      durationSeconds,
    } = req.body || {};

    // Deterministic fallback used whenever the AI can't be reached. Grounded
    // in whatever we did manage to measure (loudness, tempo, word count).
    const buildFallback = (
      opts: {
        transcript?: string;
        wpm?: number | null;
        wordCount?: number;
        loudnessOk?: boolean;
        aiUnavailable?: boolean;
      } = {},
    ) => {
      const { transcript = "", wpm = null, wordCount = 0, loudnessOk = true } = opts;
      // Base everything around a solid, encouraging middle score.
      const paceGood = wpm == null ? true : wpm >= 95 && wpm <= 175;
      const enough = wordCount === 0 ? true : wordCount >= 12;
      const s = (base: number, ok: boolean) => Math.min(5, Math.max(1, ok ? base : base - 1));
      const roleFit = s(4, enough);
      const emotion = s(4, loudnessOk);
      const clarity = s(4, loudnessOk && enough);
      const confidence = s(4, paceGood && loudnessOk);
      const grammar = s(4, enough);
      const avg = (roleFit + emotion + clarity + confidence + grammar) / 5;
      const stars = avg >= 4.4 ? 3 : avg >= 3.2 ? 2 : 1;
      const summary = lang === "en"
        ? "Nice work stepping into the role! Keep leaning into the character — a bit more emotion and energy will make it shine."
        : "Отличный заход в роль! Продолжай вживаться в персонажа — чуть больше эмоций и энергии, и будет блестяще.";
      const tip = lang === "en"
        ? "Try exaggerating the emotion a little more than feels natural — on camera it reads as just right."
        : "Попробуй сыграть эмоцию чуть ярче, чем кажется естественным — на камере это смотрится как раз в меру.";
      return {
        stars,
        transcript,
        feedback: summary,
        tip,
        metrics: { roleFit, emotion, clarity, confidence, grammar },
        categories: {
          roleFit:    { score: roleFit,    label: roleLabels.roleFit },
          emotion:    { score: emotion,    label: roleLabels.emotion },
          clarity:    { score: clarity,    label: roleLabels.clarity },
          confidence: { score: confidence, label: roleLabels.confidence },
          grammar:    { score: grammar,    label: roleLabels.grammar },
        },
        aiUnavailable: !!opts.aiUnavailable,
      };
    };

    try {
      if (!audioBase64) {
        // No audio at all (e.g. mic unavailable on web preview). Still return
        // a graceful, encouraging result instead of an error.
        return res.json({ ...buildFallback({ aiUnavailable: true }), silent: true });
      }

      const rawBuffer = Buffer.from(audioBase64, "base64");
      let transcript = "";
      try {
        const { buffer, format } = await ensureCompatibleFormat(rawBuffer);
        transcript = await speechToText(buffer, format);
      } catch (e) {
        console.warn("analyze-role: transcription unavailable:", e);
      }

      // Measured signals (best-effort).
      let loudnessOk = true;
      try {
        const { buffer } = await ensureCompatibleFormat(rawBuffer);
        const loud = await computeLoudness(buffer);
        loudnessOk = loud.ok ? loud.meanVolumeDb >= -30 : true;
      } catch {}

      const tokens = transcript.toLowerCase().split(/[^a-zа-яё0-9]+/i).filter(Boolean);
      const wordCount = tokens.length;
      const dur = typeof durationSeconds === "number" && durationSeconds > 0 ? durationSeconds : null;
      const wpm = dur && wordCount > 0 ? Math.round(wordCount / (dur / 60)) : null;

      if (!transcript || transcript.trim().length < 6) {
        // Couldn't hear enough — deterministic, still encouraging.
        return res.json(buildFallback({ transcript, wpm, wordCount, loudnessOk, aiUnavailable: false }));
      }

      const modeLabel = mode === "scripted"
        ? (lang === "en" ? "reading a scripted line for the role" : "читает заготовленную реплику для роли")
        : (lang === "en" ? "improvising in the role" : "импровизирует в роли");

      const systemPrompt = lang === "en"
        ? `You are a warm, playful acting coach helping someone train adaptability by performing life ROLES (a salesperson, a blogger, a barista, a showman...). The player is ${modeLabel}. Rate how well they INHABITED THE ROLE on 5 criteria, each 1-5:\n1. roleFit — did the delivery match the character & situation? Energy, vocabulary and attitude of the role.\n2. emotion — vividness and emotional colour of the voice; playing it flat scores low.\n3. clarity — articulation & intelligibility.\n4. confidence — steady, believable, no hesitation.\n5. grammar — correctness & fluency of speech (in improv judge phrasing; in scripted mode be lenient on wording).\nCalibration: 5 = a natural performer, 3 = decent, 1 = barely in character. Be honest but kind and fun.\nstars: 1 if average < 2.6; 2 if 2.6-3.9; 3 if >= 4.0.\nTONE: write "summary" and "tip" like an excited coach cheering a friend on — plain, warm language, no technical terms, no numbers/units. End the player feeling like a star who wants to play again.\nReturn ONLY JSON: {"roleFit":n,"emotion":n,"clarity":n,"confidence":n,"grammar":n,"stars":n,"summary":"...","tip":"..."}`
        : `Ты — тёплый, игривый тренер по актёрскому мастерству. Игрок тренирует адаптивность, играя жизненные РОЛИ (продажник, блогер, бариста, шоумен...). Игрок ${modeLabel}. Оцени, насколько он ВЖИЛСЯ В РОЛЬ, по 5 критериям, каждый 1-5:\n1. roleFit — Соответствие роли: попала ли подача в характер и ситуацию? Энергия, лексика и настрой роли.\n2. emotion — Эмоции: яркость и эмоциональная окраска голоса; плоская подача — низкий балл.\n3. clarity — Чёткость произношения: артикуляция и разборчивость.\n4. confidence — Уверенность: ровно, убедительно, без колебаний.\n5. grammar — Грамматика: правильность и плавность речи (в импровизации суди построение фраз; в режиме чтения будь снисходителен к формулировкам).\nКалибровка: 5 = прирождённый артист, 3 = неплохо, 1 = почти не в образе. Честно, но по-доброму и с азартом.\nstars: 1 если среднее < 2.6; 2 если 2.6-3.9; 3 если >= 4.0.\nТОН: пиши "summary" и "tip" как воодушевлённый тренер, который болеет за друга — простым тёплым языком, без технических терминов, без чисел и единиц. После фидбэка игрок должен чувствовать себя звездой и хотеть сыграть ещё.\nВерни ТОЛЬКО JSON: {"roleFit":n,"emotion":n,"clarity":n,"confidence":n,"grammar":n,"stars":n,"summary":"...","tip":"..."}`;

      const roleCtx = lang === "en"
        ? `Role: "${roleTitle ?? "a life role"}"\nScene: ${roleScene ?? "-"}${mode === "scripted" && scriptedText ? `\nScript they read: "${scriptedText}"` : ""}\n\nWhat they actually said:\n${transcript}`
        : `Роль: "${roleTitle ?? "жизненная роль"}"\nСцена: ${roleScene ?? "-"}${mode === "scripted" && scriptedText ? `\nТекст, который читали: "${scriptedText}"` : ""}\n\nЧто игрок реально сказал:\n${transcript}`;

      let parsed: any = null;
      try {
        const out = await chatComplete({ system: systemPrompt, user: roleCtx, maxTokens: 400, json: true });
        parsed = JSON.parse(out || "{}");
      } catch (e) {
        console.warn("analyze-role: AI scoring unavailable, using fallback:", e);
        return res.json(buildFallback({ transcript, wpm, wordCount, loudnessOk, aiUnavailable: true }));
      }

      const clamp = (v: any) => Math.min(5, Math.max(1, Math.round(v ?? 3)));
      const roleFit    = clamp(parsed.roleFit);
      const emotion    = clamp(parsed.emotion);
      const clarity    = clamp(parsed.clarity);
      const confidence = clamp(parsed.confidence);
      const grammar    = clamp(parsed.grammar);
      const stars = Math.min(3, Math.max(1, Math.round(parsed.stars ?? 2)));

      return res.json({
        stars,
        transcript,
        feedback: typeof parsed.summary === "string" && parsed.summary.trim()
          ? parsed.summary
          : (lang === "en" ? "Great job in the role!" : "Отличная работа в роли!"),
        tip: typeof parsed.tip === "string" ? parsed.tip : undefined,
        metrics: { roleFit, emotion, clarity, confidence, grammar },
        categories: {
          roleFit:    { score: roleFit,    label: roleLabels.roleFit },
          emotion:    { score: emotion,    label: roleLabels.emotion },
          clarity:    { score: clarity,    label: roleLabels.clarity },
          confidence: { score: confidence, label: roleLabels.confidence },
          grammar:    { score: grammar,    label: roleLabels.grammar },
        },
        aiUnavailable: false,
      });
    } catch (err) {
      console.error("analyze-role error:", err);
      return res.json(buildFallback({ aiUnavailable: true }));
    }
  });

  app.get("/api/interview/daily-plan", (req: Request, res: Response) => {
    const lang: Lang = req.query.lang === "en" ? "en" : "ru";
    const { topics, dateKey } = getDailyTopics(lang);
    return res.json({ topics, dateKey, maxDaily: MAX_DAILY_INTERVIEWS });
  });

  app.post("/api/interview/start", async (req: Request, res: Response) => {
    try {
      const lang = getLang(req.body);
      const { topicIndex } = req.body || {};
      const { topics } = getDailyTopics(lang);
      const topic = typeof topicIndex === "number" && topicIndex >= 0 && topicIndex < topics.length
        ? topics[topicIndex]
        : topics[Math.floor(Math.random() * topics.length)];
      const sessionId = generateSessionId();

      const [greeting, question] = await Promise.all([
        generateGreeting(topic, lang),
        generateInterviewQuestion(topic, 0, [], lang),
      ]);

      const session: InterviewSession = {
        id: sessionId, topic, answers: [], totalScore: 0,
        currentQuestion: question, questionIndex: 0, skipCount: 0,
        createdAt: Date.now(), lang,
      };
      sessions.set(sessionId, session);

      const cutoff = Date.now() - 2 * 60 * 60 * 1000;
      for (const [id, s] of sessions) {
        if (s.createdAt < cutoff) sessions.delete(id);
      }
      saveSessions();

      return res.json({ sessionId, topic, greeting, question });
    } catch (err) {
      console.error("interview/start error:", err);
      return res.status(500).json({ error: "Failed to start session" });
    }
  });

  app.post("/api/interview/answer", async (req: Request, res: Response) => {
    try {
      const { sessionId, audioBase64 } = req.body;
      if (!sessionId || !audioBase64) {
        return res.status(400).json({ error: "sessionId and audioBase64 required" });
      }
      const session = sessions.get(sessionId);
      if (!session) {
        console.warn(`[answer] Session not found: ${sessionId}, active sessions: ${sessions.size}`);
        return res.status(404).json({ error: "Session not found" });
      }
      const lang = session.lang ?? "ru";
      console.log(`[answer] session=${sessionId} q=${session.questionIndex + 1}/${MAX_QUESTIONS}`);

      const rawBuffer = Buffer.from(audioBase64, "base64");
      const { buffer, format } = await ensureCompatibleFormat(rawBuffer);
      const transcript = await speechToText(buffer, format);

      if (!transcript || transcript.trim().length < 3) {
        const emptyFeedback = lang === "en"
          ? "Answer not recognized. Speak more clearly and closer to the microphone."
          : "Ответ не распознан. Говорите чётче и ближе к микрофону.";
        const emptyTransition = lang === "en"
          ? "It seems you weren't heard. Shall we try again?"
          : "Кажется, вас не было слышно. Попробуем ещё раз?";
        return res.json({
          transcript: "", grammarScore: 0, dictionScore: 0,
          feedback: emptyFeedback,
          transition: emptyTransition,
          totalScore: session.totalScore,
          finished: false, nextQuestion: session.currentQuestion, summary: null,
          topic: session.topic, sentiment: "neutral", terminated: false,
        });
      }

      const { grammarScore, dictionScore, feedback, sentiment, violated, violationReason } =
        await analyzeAnswer(session.currentQuestion, transcript, session.topic, lang);

      if (violated) {
        const violationFeedback = lang === "en" ? "Platform rules violation." : "Нарушение правил платформы.";
        return res.json({
          transcript, grammarScore: 0, dictionScore: 0,
          feedback: violationReason || violationFeedback,
          transition: "", totalScore: session.totalScore,
          finished: true, terminated: true, sentiment: "negative",
          nextQuestion: "", summary: null, topic: session.topic,
        });
      }

      const transition = getTransition(grammarScore, dictionScore, lang);

      session.answers.push({ question: session.currentQuestion, transcript, grammarScore, dictionScore, feedback });
      session.totalScore += grammarScore + dictionScore;
      session.questionIndex++;

      const finished = session.questionIndex >= MAX_QUESTIONS;
      let nextQuestion = "";
      let summary: FinalSummary | null = null;

      if (finished) {
        summary = await generateStructuredSummary(session);
      } else {
        nextQuestion = await generateInterviewQuestion(session.topic, session.questionIndex, session.answers, lang);
        session.currentQuestion = nextQuestion;
      }
      saveSessions();

      return res.json({
        transcript, grammarScore, dictionScore, feedback, transition,
        totalScore: session.totalScore, finished, nextQuestion, summary,
        topic: session.topic, sentiment, terminated: false,
      });
    } catch (err) {
      console.error("interview/answer error:", err);
      return res.status(500).json({ error: "Failed to process answer" });
    }
  });

  app.post("/api/interview/skip", async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.body;
      if (!sessionId) return res.status(400).json({ error: "sessionId required" });

      const session = sessions.get(sessionId);
      if (!session) return res.status(404).json({ error: "Session not found" });

      const lang = session.lang ?? "ru";
      session.skipCount++;

      if (session.skipCount >= MAX_SKIPS) {
        const summary = await generateStructuredSummary(session);
        const endMsg = lang === "en"
          ? "It seems like it's hard to engage today - that's okay. Let's wrap up the interview here. You still did great for trying!"
          : "Похоже, сегодня вам непросто включиться в диалог — это нормально. Давайте завершим интервью на этом этапе. Вы всё равно молодец, что попробовали!";
        saveSessions();
        return res.json({
          nextQuestion: "", skipCount: session.skipCount, ended: true,
          endingMessage: endMsg,
          summary,
        });
      }

      const nextQuestion = await generateInterviewQuestion(session.topic, session.questionIndex, session.answers, lang);
      session.currentQuestion = nextQuestion;
      saveSessions();

      return res.json({
        nextQuestion, skipCount: session.skipCount, ended: false,
        endingMessage: "", summary: null,
      });
    } catch (err) {
      console.error("interview/skip error:", err);
      return res.status(500).json({ error: "Failed to skip question" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
