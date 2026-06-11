import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import * as fs from "node:fs";
import * as path from "node:path";
import { openai, speechToText, ensureCompatibleFormat, computeLoudness } from "./replit_integrations/audio/client";

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

  const resp = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    max_tokens: 130,
    temperature: 0.8,
  });
  return resp.choices[0]?.message?.content?.trim() ?? fallback;
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
        ? `Previous questions:\n${previousAnswers.map((a, i) => `${i + 1}. ${a.question}`).join("\n")}`
        : `Предыдущие вопросы:\n${previousAnswers.map((a, i) => `${i + 1}. ${a.question}`).join("\n")}`)
      : "";

  const systemPrompt = lang === "en"
    ? `You are ${JOURNALIST_NAME}, a friendly journalist-interviewer. Topic: "${topic}". Ask simple, warm, human questions about life, feelings and personal experience. Questions should be easy to answer, not too complex. Good examples: "What does happiness mean to you?", "What kind of person do you want to become?", "What do you value most in people?", "What makes your day truly good?". One question, one sentence. Only the question text, no explanations.`
    : `Ты — ${JOURNALIST_NAME}, дружелюбный журналист-интервьюер. Тема: "${topic}". Задавай простые, тёплые, человечные вопросы о жизни, чувствах и личном опыте. Вопросы должны быть лёгкими для ответа, не слишком сложными. Хорошие примеры: "Что для вас значит счастье?", "Каким человеком вы хотите стать?", "Что вы больше всего цените в людях?", "Что делает ваш день по-настоящему хорошим?". Один вопрос, одно предложение. Только текст вопроса, без пояснений.`;

  const userPrompt = lang === "en"
    ? `Question ${questionIndex + 1} of ${MAX_QUESTIONS}.\n${prevContext}\nAsk the next question.`
    : `Вопрос ${questionIndex + 1} из ${MAX_QUESTIONS}.\n${prevContext}\nЗадай следующий вопрос.`;

  const fallback = lang === "en" ? "What does happiness mean to you?" : "Что для вас значит счастье?";

  const resp = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    max_tokens: 80,
    temperature: 0.9,
  });
  return resp.choices[0]?.message?.content?.trim() ?? fallback;
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

  const resp = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `${topicLabel}: "${topic}"\n${questionLabel}: ${question}\n${answerLabel}: ${transcript}` },
    ],
    max_tokens: 200,
    temperature: 0.3,
    response_format: { type: "json_object" },
  });
  try {
    const p = JSON.parse(resp.choices[0]?.message?.content ?? "{}");
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

  const resp = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `${topicLabel}: "${session.topic}"\n\n${answersText}` },
    ],
    max_tokens: 350,
    temperature: 0.7,
    response_format: { type: "json_object" },
  });
  try {
    const p = JSON.parse(resp.choices[0]?.message?.content ?? "{}");
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
      const resp = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: transcript.trim().slice(0, 4000) },
        ],
        max_tokens: 200,
        // temperature: 0 → identical transcript yields identical scores, so
        // retries of the same recording give the same result.
        temperature: 0,
        response_format: { type: "json_object" },
      });
      let parsed: any = {};
      try { parsed = JSON.parse(resp.choices[0]?.message?.content ?? "{}"); } catch { parsed = {}; }
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
      const { audioBase64, title } = req.body;
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
          ? "Nothing was said. Please try again - speak the text out loud."
          : "Ничего не было сказано. Попробуйте снова — произнесите текст выступления вслух.";
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

      const systemPrompt = lang === "en"
        ? `You are a strict professional oratory expert. Evaluate the transcription of a public speech by six criteria (each 1 to 5):\n1. diction — Diction (clarity of articulation).\n2. expressiveness — Expressiveness.\n3. voice — Voice (volume / projection).\n4. confidence — Confidence.\n5. tempo — Tempo (pacing — neither rushed nor dragging).\n6. pauses — Pauses (meaningful silence at the right moments, not excessive filler/hesitation).\nFinal rating (stars): 1 if average < 2.5, 2 if 2.5-3.9, 3 if >= 4.0.\nReturn STRICTLY JSON:\n{"stars": <1|2|3>, "diction": <1-5>, "expressiveness": <1-5>, "voice": <1-5>, "confidence": <1-5>, "tempo": <1-5>, "pauses": <1-5>, "summary": "<one sentence>", "tip": "<one short, concrete coaching tip targeting the weakest criterion>", "errors": ["<error 1>", ...]}`
        : `Ты — строгий профессиональный эксперт по ораторскому мастерству. Оцени транскрипцию публичного выступления по шести критериям (каждый от 1 до 5):\n1. diction — Дикция (чёткость артикуляции).\n2. expressiveness — Выразительность.\n3. voice — Голос (громкость / посыл).\n4. confidence — Уверенность.\n5. tempo — Темп (не торопится и не растягивает).\n6. pauses — Паузы (осмысленное молчание в нужных местах, без лишних запинок и слов-паразитов).\nИтоговый рейтинг (stars): 1 если средний балл < 2.5, 2 если 2.5–3.9, 3 если >= 4.0.\nВерни СТРОГО JSON:\n{"stars": <1|2|3>, "diction": <1-5>, "expressiveness": <1-5>, "voice": <1-5>, "confidence": <1-5>, "tempo": <1-5>, "pauses": <1-5>, "summary": "<одно предложение>", "tip": "<один короткий конкретный совет по самому слабому критерию>", "errors": ["<ошибка 1>", ...]}`;

      const topicLabel = lang === "en" ? "Speech topic" : "Тема выступления";
      const transcriptLabel = lang === "en" ? "Transcription" : "Транскрипция";
      const fallbackSummary = lang === "en" ? "Good performance!" : "Хорошее выступление!";

      const resp = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `${topicLabel}: "${title ?? (lang === "en" ? "public speech" : "публичное выступление")}"\n\n${transcriptLabel}:\n${transcript}` },
        ],
        max_tokens: 400,
        temperature: 0.3,
        response_format: { type: "json_object" },
      });

      let parsed: any = {};
      try { parsed = JSON.parse(resp.choices[0]?.message?.content ?? "{}"); } catch { parsed = {}; }

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
