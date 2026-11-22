// Compare speech-analysis configs on real saved attempts (eval-audio/).
//
// The API server saves attempts when run with SAVE_EVAL_AUDIO=1. This script
// starts throwaway API servers — the current config twice (to measure how much
// the scores wobble on their own) and each candidate once — replays every
// saved attempt through each, and writes a report: score differences against
// the baseline, speed, and the feedback texts side by side for reading.
//
// A candidate is good enough when its distance from the baseline is about the
// baseline's distance from itself (the noise floor) and the texts read as well.
//
// usage: node scripts/speech-eval/compare.js [candidate ...]
//   candidates: haiku | sonnet | mini-stt   (default: all)
// Costs real API calls: every attempt × (2 + number of candidates).
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "../..");
const EVAL_DIR = path.join(ROOT, "eval-audio");
const OUT_DIR = path.join(EVAL_DIR, "reports");

const CANDIDATES = {
  haiku: { ANALYSIS_MODEL: "claude-haiku-5-5" },
  sonnet: { ANALYSIS_MODEL: "claude-sonnet-5-5" },
  "mini-stt": { STT_MODEL: "gpt-4o-mini-transcribe" },
};

function startServer(port, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(ROOT, "node_modules/tsx/dist/cli.mjs"), "server/index.ts"], {
      cwd: ROOT,
      env: { ...process.env, ...env, PORT: String(port), KS_EXTERNAL_METRO: "1", SAVE_EVAL_AUDIO: "0" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const timer = setTimeout(() => reject(new Error(`server :${port} did not start`)), 60000);
    child.stdout.on("data", (d) => {
      if (String(d).includes("serving on port")) { clearTimeout(timer); resolve(child); }
    });
    child.stderr.on("data", () => {});
    child.on("exit", (c) => { clearTimeout(timer); reject(new Error(`server :${port} exited ${c}`)); });
  });
}

async function post(port, route, body) {
  const t = Date.now();
  const res = await fetch(`http://localhost:${port}/api/${route}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ms: Date.now() - t, ok: res.ok, data };
}

function loadSamples() {
  if (!fs.existsSync(EVAL_DIR)) return [];
  return fs.readdirSync(EVAL_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      const meta = JSON.parse(fs.readFileSync(path.join(EVAL_DIR, f), "utf8"));
      const base = f.replace(/\.json$/, "");
      const audio = fs.readdirSync(EVAL_DIR).find((g) => g.startsWith(base + ".") && !g.endsWith(".json"));
      return audio ? { id: base, meta, audioBase64: fs.readFileSync(path.join(EVAL_DIR, audio)).toString("base64") } : null;
    })
    .filter(Boolean);
}

function request(sample) {
  const m = sample.meta;
  if (m.route === "analyze-speech") {
    return ["analyze-speech", {
      audioBase64: sample.audioBase64, title: m.title ?? undefined, durationSeconds: m.durationSec ?? undefined,
      moduleNumber: m.moduleNumber ?? undefined, scriptText: m.scriptText ?? "", lang: m.lang,
    }];
  }
  return ["transcribe", {
    audioBase64: sample.audioBase64, audioDurationSeconds: m.durationSec ?? 0, lang: m.lang ?? undefined,
    ...(m.interview !== undefined ? { interview: true } : {}),
  }];
}

const METRICS = ["clarity", "expressiveness", "volume", "confidence", "tempo", "pauses"];
const words = (s) => (s || "").toLowerCase().split(/[^a-zа-яёәғқңөұүһі0-9]+/i).filter(Boolean);
// word error rate of b against reference a (Levenshtein over words)
function wer(a, b) {
  const x = words(a), y = words(b);
  if (!x.length) return y.length ? 1 : 0;
  const d = Array.from({ length: x.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= y.length; j++) d[0][j] = j;
  for (let i = 1; i <= x.length; i++)
    for (let j = 1; j <= y.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1));
  return d[x.length][y.length] / x.length;
}

function distance(route, a, b) {
  if (!a.ok || !b.ok) return { failed: true };
  if (route === "analyze-speech") {
    const md = METRICS.map((k) => Math.abs((a.data.metrics?.[k] ?? 0) - (b.data.metrics?.[k] ?? 0)));
    return {
      stars: Math.abs((a.data.stars ?? 0) - (b.data.stars ?? 0)),
      metrics: md.reduce((s, v) => s + v, 0) / md.length,
      wer: wer(a.data.transcript, b.data.transcript),
    };
  }
  const ia = a.data.interview, ib = b.data.interview;
  return {
    wer: wer(a.data.transcript, b.data.transcript),
    ...(ia && ib ? { interview: (Math.abs(ia.logic - ib.logic) + Math.abs(ia.eloquence - ib.eloquence)) / 2 } : {}),
  };
}

const mean = (xs) => (xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : null);
const fmt = (v, d = 2) => (v == null ? "—" : Number(v).toFixed(d));

(async () => {
  const picked = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(CANDIDATES);
  for (const c of picked) if (!CANDIDATES[c]) throw new Error(`unknown candidate ${c}`);
  const samples = loadSamples();
  if (!samples.length) { console.log("No saved attempts in eval-audio/ yet."); return; }
  console.log(`${samples.length} attempts × ${2 + picked.length} configs`);

  const configs = [["baseline", {}], ["baseline-again", {}], ...picked.map((c) => [c, CANDIDATES[c]])];
  const runs = {};
  let port = 5101;
  for (const [name, env] of configs) {
    const srv = await startServer(port, env);
    runs[name] = [];
    try {
      for (const s of samples) {
        const [route, body] = request(s);
        runs[name].push(await post(port, route, body));
        process.stdout.write(".");
      }
    } finally {
      srv.kill();
    }
    console.log(` ${name} done`);
    port++;
  }

  const lines = [`# Speech analysis comparison — ${new Date().toISOString()}`, "", `Attempts: ${samples.length}`, ""];
  lines.push("| Config | Avg time | Stars ≠ baseline | Metric diff (1–5) | Transcript WER | Interview diff (0–10) | Failures |");
  lines.push("|---|---|---|---|---|---|---|");
  for (const [name] of configs) {
    const r = runs[name];
    const ds = name === "baseline" ? [] : r.map((x, i) => distance(request(samples[i])[0], runs.baseline[i], x));
    const ok = ds.filter((d) => !d.failed);
    lines.push(`| ${name} | ${fmt(mean(r.map((x) => x.ms)) / 1000, 1)} s | ${name === "baseline" ? "—" : ok.filter((d) => d.stars).length + "/" + ok.filter((d) => d.stars != null).length} | ${fmt(mean(ok.map((d) => d.metrics).filter((v) => v != null)))} | ${fmt(mean(ok.map((d) => d.wer).filter((v) => v != null)), 3)} | ${fmt(mean(ok.map((d) => d.interview).filter((v) => v != null)))} | ${r.filter((x) => !x.ok).length} |`);
  }
  lines.push("", "«baseline-again» is the current config run a second time: its numbers are the noise floor.", "");
  samples.forEach((s, i) => {
    lines.push(`## ${s.id} (${s.meta.route}, ${s.meta.lang ?? "?"})`, "");
    for (const [name] of configs) {
      const d = runs[name][i].data;
      const text = s.meta.route === "analyze-speech"
        ? `★${d.stars ?? "?"} ${METRICS.map((k) => d.metrics?.[k] ?? "?").join("/")} — ${d.feedback ?? ""}${d.tip ? ` Совет: ${d.tip}` : ""}`
        : `${d.transcript ?? ""}${d.interview ? ` [logic ${d.interview.logic}, eloquence ${d.interview.eloquence}] ${d.interview.tip ?? ""}` : ""}`;
      lines.push(`- **${name}** (${fmt(runs[name][i].ms / 1000, 1)} s): ${text}`);
    }
    lines.push("");
  });

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const out = path.join(OUT_DIR, `compare-${Date.now()}.md`);
  fs.writeFileSync(out, lines.join("\n"));
  console.log("\n" + lines.slice(0, 6 + configs.length).join("\n"));
  console.log(`\nReport: ${out}`);
})().catch((e) => { console.error(e); process.exit(1); });
