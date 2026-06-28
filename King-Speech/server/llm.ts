import Anthropic from "@anthropic-ai/sdk";

/**
 * Claude text-generation adapter for King Speech.
 *
 * Replaces the OpenAI `gpt-4o` chat-completions calls in routes.ts. All the
 * server's text tasks — Jenny's greeting/questions, answer scoring, the final
 * interview summary, and speech analysis — go through `chatComplete()`.
 *
 * Speech-to-text is NOT handled here: Claude has no transcription API, so
 * `/api/transcribe` uses a separate STT service.
 *
 * Requires `ANTHROPIC_API_KEY` in the environment.
 */

// Single source of truth for the model. claude-opus-4-8 is the most capable
// model (skill default). For the latency/cost-sensitive real-time calls
// (greeting, next question) claude-sonnet-4-6 is a reasonable cheaper swap —
// change this constant (or pass `model` per call) if desired.
export const CLAUDE_MODEL = "claude-opus-4-8";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface ChatOptions {
  system: string;
  user: string;
  maxTokens: number;
  /** When true, instruct Claude to emit only a raw JSON object and strip fences. */
  json?: boolean;
  model?: string;
}

/** Strip ```json … ``` / ``` … ``` fences a model may wrap JSON in. */
function stripCodeFences(text: string): string {
  const t = text.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(t);
  return (fenced ? fenced[1] : t).trim();
}

/**
 * One-shot text completion. Returns the assistant's text (fences stripped when
 * `json` is set). Throws on API errors — callers keep their existing
 * try/catch + fallbacks.
 *
 * Note: claude-opus-4-8 rejects `temperature`/`top_p`, so we don't send them;
 * behavior is steered by the prompt. We append a "final answer only"
 * instruction so the model doesn't leak reasoning into short outputs.
 */
export async function chatComplete(opts: ChatOptions): Promise<string> {
  const guard = opts.json
    ? "\n\nOutput ONLY the raw JSON object — no markdown, no code fences, no commentary before or after."
    : "\n\nRespond with only the final answer — no preamble, no explanation of your reasoning.";

  const resp = await anthropic.messages.create({
    model: opts.model ?? CLAUDE_MODEL,
    max_tokens: opts.maxTokens,
    system: opts.system + guard,
    messages: [{ role: "user", content: opts.user }],
  });

  const text = resp.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  return opts.json ? stripCodeFences(text) : text.trim();
}
