import lexicon from "@/constants/interviewLexicon.json";

// ─────────────────────────────────────────────────────────────────────────────
// Грамотность (module G) — deterministic, transcript-only scorer for interview
// answers. Implements the L1 (dictionary + rules) layer of the v2 spec against
// the bundled lexicon (constants/interviewLexicon.json):
//   · G1 — слова-паразиты (categories with per-100 tolerance θ and weight w)
//   · G2 — грамматические искажения словоформ (weight per entry, θ = 0)
// Each sub-block uses density-of-penalty-per-100-words + exponential decay:
//   D = Σ(w·k·penalized) / L_norm · 100 ;  score = 100·exp(−D/τ)
// G3 (синтаксис/лексические нормы) needs dependency parsing / an LLM arbiter and
// is NOT in the lexicon, so G is renormalised over the available sub-blocks.
//
// Context (pause/prosody) features from the spec need word timestamps we don't
// have client-side, so context-dependent items get a single lenient coefficient
// (CTX_K) instead of a per-hit k_ctx. This under-penalises rather than over-.
// ─────────────────────────────────────────────────────────────────────────────

export interface LiteracyViolation {
  lemma: string;
  category: string;
  block: "G1" | "G2";
  count: number;
  weight: number;
}

export interface LiteracyResult {
  available: boolean; // false when the transcript is too short to score
  words: number;
  overall: number; // G, 0..100
  overall10: number; // G / 10, 0..10
  g1: number; // паразиты, 0..100
  g2: number; // словоформы, 0..100
  g3: number; // построение речи (завершённость + паузы), 0..100
  wordsPerSec: number | null;
  incomplete: boolean; // thought seems cut off / too short to be an answer
  violations: LiteracyViolation[];
  habit?: { lemma: string; count: number };
}

const LEX: any = lexicon;
const SUBW = LEX.scoring?.literacy_sub_weights ?? { g1_parasites: 0.3, g2_forms: 0.35, g3_structure: 0.35 };
const TAU = LEX.scoring?.decay_tau ?? { G1: 14, G2: 8, G3: 10 };
// Lenient coefficient for context-dependent items (no timestamps client-side).
const CTX_K = 0.6;

function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-zа-яё\s-]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Words a finished thought almost never ends on — a trailing one signals the
// answer was cut off mid-clause.
const HANGING_WORDS = new Set(
  (
    "и а но да или либо то же бы ли не ни что чтобы потому если когда как что-то " +
    "в во на с со к ко по из изо для от ото до у о об обо за под над при про без " +
    "между чем чём этот эта это эти тот та те мой моя мои наш наша это самое ну вот"
  ).split(/\s+/),
);

interface Surface {
  id: string;
  block: "G1" | "G2";
  category: string;
  lemma: string;
  weight: number;
  theta: number;
  ctx: boolean;
  s: string; // " normalized surface "
}

// Flatten the lexicon into space-padded surfaces, longest first so multi-word
// phrases ("это самое") are consumed before their substrings ("это").
const SURFACES: Surface[] = (() => {
  const out: Surface[] = [];
  for (const e of (LEX.lexicon as any[]) ?? []) {
    if (e.block !== "G1" && e.block !== "G2") continue;
    const catMeta = LEX.categories?.[e.category];
    const ctx = typeof e.requires_context_check === "boolean" ? e.requires_context_check : !!catMeta?.ctx;
    for (const surf of (e.surface as string[]) ?? []) {
      const s = " " + norm(surf) + " ";
      if (s.trim().length === 0) continue;
      out.push({
        id: e.id,
        block: e.block,
        category: e.category,
        lemma: e.lemma,
        weight: Number(e.base_weight) || 0,
        theta: Number(e.tolerance_per_100) || 0,
        ctx,
        s,
      });
    }
  }
  out.sort((a, b) => b.s.length - a.s.length);
  return out;
})();

export function scoreLiteracy(transcript: string, durationSec?: number): LiteracyResult {
  const text = norm(transcript || "");
  const words = text ? text.split(" ").filter(Boolean) : [];
  const L = words.length;
  if (L < 3) {
    return {
      available: false,
      words: L,
      overall: 0,
      overall10: 0,
      g1: 0,
      g2: 0,
      g3: 0,
      wordsPerSec: null,
      incomplete: true,
      violations: [],
    };
  }
  const Lnorm = Math.max(L, 40);
  let work = " " + words.join(" ") + " ";

  // Count occurrences per lexicon entry, consuming each match (blank the inner
  // characters, keep the two boundary spaces so neighbours stay separated).
  const perEntry: Record<string, { su: Surface; count: number }> = {};
  for (const su of SURFACES) {
    let c = 0;
    let idx = work.indexOf(su.s);
    while (idx !== -1) {
      c++;
      const len = su.s.length;
      work = work.slice(0, idx + 1) + " ".repeat(Math.max(0, len - 2)) + work.slice(idx + len - 1);
      idx = work.indexOf(su.s, idx);
    }
    if (c > 0) {
      if (!perEntry[su.id]) perEntry[su.id] = { su, count: 0 };
      perEntry[su.id].count += c;
    }
  }

  // Aggregate: G1 by category (shared θ / w), G2 summed per entry.
  const byLemma: Record<string, LiteracyViolation> = {};
  const g1cat: Record<string, { count: number; weight: number; theta: number; ctx: boolean }> = {};
  let pG2 = 0;

  for (const { su, count } of Object.values(perEntry)) {
    const v = byLemma[su.lemma];
    if (v) v.count += count;
    else byLemma[su.lemma] = { lemma: su.lemma, category: su.category, block: su.block, count, weight: su.weight };

    if (su.block === "G1") {
      const g = g1cat[su.category] ?? { count: 0, weight: su.weight, theta: su.theta, ctx: su.ctx };
      g.count += count;
      g1cat[su.category] = g;
    } else {
      pG2 += su.weight * count; // θ = 0, k = 1
    }
  }

  let pG1 = 0;
  for (const cat of Object.values(g1cat)) {
    const tol = (cat.theta * Lnorm) / 100;
    const pen = Math.max(0, cat.count - tol);
    const k = cat.ctx ? CTX_K : 1;
    pG1 += cat.weight * k * pen;
  }

  const d1 = (pG1 / Lnorm) * 100;
  const d2 = (pG2 / Lnorm) * 100;
  const g1 = 100 * Math.exp(-d1 / (TAU.G1 || 14));
  const g2 = 100 * Math.exp(-d2 / (TAU.G2 || 8));

  // ── G3 — построение речи (heuristic; the spec's L2/L3 parser is not on the
  // client, so we approximate "logic & completeness" from what the transcript +
  // duration reveal): did the player actually say something, is the pace / pause
  // pattern natural, and does the answer end on a finished thought? ────────────
  const dur = durationSec && durationSec > 0 ? durationSec : null;
  const wps = dur ? L / dur : null;

  // substance: a real answer needs enough words; a few words = didn't answer.
  const substance = clamp01((L - 8) / 40);
  // fluency (pause proxy): natural conversational pace is ~2.0–3.2 words/sec.
  // Long gaps between words drag words-per-second down → lower fluency. Unknown
  // duration → treat pace as neutral so we never punish missing data.
  const fluency = wps == null ? 0.85 : Math.exp(-Math.pow(wps - 2.6, 2) / (2 * 1.1 * 1.1));
  // ending: a trailing conjunction / preposition / hanging particle = cut off.
  const lastWord = words[words.length - 1];
  const endsClean = !HANGING_WORDS.has(lastWord);
  const incomplete = L < 20 || !endsClean;

  const g3 = clamp(100 * (0.5 * substance + 0.35 * fluency + 0.15 * (endsClean ? 1 : 0)));

  // Full G with all three sub-blocks (G3 now filled by the heuristic).
  const w1 = SUBW.g1_parasites || 0.3;
  const w2 = SUBW.g2_forms || 0.35;
  const w3 = SUBW.g3_structure || 0.35;
  const overall = (w1 * g1 + w2 * g2 + w3 * g3) / (w1 + w2 + w3);

  const violations = Object.values(byLemma).sort((a, b) => b.weight * b.count - a.weight * a.count).slice(0, 6);

  // "Твоё слово-паразит": the most repeated G1 item (≥3 uses).
  let habit: { lemma: string; count: number } | undefined;
  for (const v of Object.values(byLemma)) {
    if (v.block === "G1" && v.count >= 3 && (!habit || v.count > habit.count)) {
      habit = { lemma: v.lemma, count: v.count };
    }
  }

  return {
    available: true,
    words: L,
    overall: clamp(overall),
    overall10: clamp(overall) / 10,
    g1: clamp(g1),
    g2: clamp(g2),
    g3: clamp(g3),
    wordsPerSec: wps,
    incomplete,
    violations,
    habit,
  };
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, n));
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}
