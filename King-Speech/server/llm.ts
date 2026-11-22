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

// Lazy init so a missing ANTHROPIC_API_KEY doesn't crash server startup at
// import time (matches the pattern in replit_integrations/audio/client.ts).
// The client is built on first use; Claude-backed features fail explicitly
// only when actually invoked without a key.
let _anthropic: Anthropic | null = null;
function getAnthropic(): Anthropic {
  if (!_anthropic) {
    _anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }
  return _anthropic;
}

export interface ChatOptions {
  system: string;
  user: string;
  maxTokens: number;
  /** When true, instruct Claude to emit only a raw JSON object and strip fences. */
  json?: boolean;
  model?: string;
  /**
   * Reasoning effort (output_config.effort). Only sent when set; calls that
   * don't pass it behave exactly as before.
   */
  effort?: "low" | "medium" | "high";
}

/**
 * Thinking switched off for the fast models these short JSON scoring calls
 * may run on — the default model already runs without it. With thinking on,
 * its tokens would also count against the small max_tokens and could cut the
 * JSON short. Haiku 5.5 takes `disabled` (at effort high or below); Sonnet 5.5
 * rejects `disabled` and uses `between_tools` instead. Other models: the
 * parameter is left out (unchanged behaviour).
 */
function thinkingOffFor(model: string): Record<string, unknown> | undefined {
  if (model.startsWith("claude-haiku-5")) return { type: "disabled" };
  if (model.startsWith("claude-sonnet-5-5")) return { type: "between_tools" };
  return undefined;
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

  const model = opts.model ?? CLAUDE_MODEL;
  const thinking = thinkingOffFor(model);
  const resp = await getAnthropic().messages.create({
    model,
    max_tokens: opts.maxTokens,
    system: opts.system + guard,
    messages: [{ role: "user", content: opts.user }],
    ...(thinking ? { thinking: thinking as any } : {}),
    ...(opts.effort ? { output_config: { effort: opts.effort } } : {}),
  });

  const text = resp.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  return opts.json ? stripCodeFences(text) : text.trim();
}
