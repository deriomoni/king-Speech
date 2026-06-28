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

export async function registerRoutes(app: Express): Promise<Server> {

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

  app.post("/api/analyze-speech", async (req: Request, res: Response) => {
    try {
      const { audioBase64, title, durationSeconds, moduleNumber } = req.body;
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
      });
    } catch (err) {
      console.error("analyze-speech error:", err);
      return res.status(500).json({ error: "Analysis failed" });
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
