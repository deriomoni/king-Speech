import { fetch as expoFetch } from "expo/fetch";
import { getApiUrl } from "@/lib/query-client";

// AI judge for interview answers. It only answers two questions — did the player
// address THIS question (relevance, primary) and how competent the wording is —
// and is worth ~10% of the score. Everything else is the client's autonomous
// mechanism. Any failure / timeout / server overload resolves to
// { available:false } so the caller silently uses its autonomous score.

export interface AnswerJudge {
  available: boolean;
  relevance?: number; // 0..10 — did they answer the question (primary)
  competence?: number; // 0..10 — how literate/coherent
  verdict?: "yes" | "partial" | "off";
  note?: string;
}

function num(v: any): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(10, Math.max(0, n)) : undefined;
}

export async function judgeAnswer(params: {
  question: string;
  transcript: string;
  lang: "ru" | "en";
  timeoutMs?: number;
}): Promise<AnswerJudge> {
  const { question, transcript, lang, timeoutMs = 8000 } = params;
  if (!transcript || transcript.trim().length < 4) return { available: false };

  const request = (async (): Promise<AnswerJudge> => {
    try {
      const url = new URL("/api/judge-answer", getApiUrl()).toString();
      const res = await expoFetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, transcript, lang }),
      });
      if (!res.ok) return { available: false }; // 503 (overloaded) etc.
      const data = await res.json();
      if (!data?.available) return { available: false };
      return {
        available: true,
        relevance: num(data.relevance),
        competence: num(data.competence),
        verdict: data.verdict === "yes" || data.verdict === "partial" || data.verdict === "off" ? data.verdict : undefined,
        note: typeof data.note === "string" ? data.note : undefined,
      };
    } catch {
      return { available: false };
    }
  })();

  // Race the request against a hard timeout — a slow judge never blocks the game.
  return Promise.race([
    request,
    new Promise<AnswerJudge>((resolve) => setTimeout(() => resolve({ available: false }), timeoutMs)),
  ]);
}
