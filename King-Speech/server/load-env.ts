// Loads .env / .env.local into process.env for LOCAL runs (Windows/dev).
//
// Why this exists: the server reads secrets like ANTHROPIC_API_KEY and
// OPENAI_API_KEY directly from process.env (see llm.ts / audio/client.ts).
// On Replit those are injected by the platform, but a plain `tsx server/...`
// on a local machine has no loader — so the keys were undefined and every AI
// call failed. This is a zero-dependency loader (no `dotenv` package needed).
//
// It must be imported FIRST in server/index.ts, before any module that reads
// those env vars at import time. It NEVER overrides a variable that's already
// set, so Replit's injected secrets always win.
import * as fs from "fs";
import * as path from "path";

function loadEnvFile(file: string): void {
  let raw: string;
  try {
    raw = fs.readFileSync(file, "utf8");
  } catch {
    return; // file absent — fine
  }
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    if (!key || Object.prototype.hasOwnProperty.call(process.env, key)) continue;
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}

const root = process.cwd();
loadEnvFile(path.join(root, ".env"));
loadEnvFile(path.join(root, ".env.local"));

// One-line, secret-safe boot diagnostic so it's obvious whether the keys
// were picked up (prints presence, never values).
const present = (k: string) => (process.env[k] ? "✓" : "✗ MISSING");
console.log(
  `[env] ANTHROPIC_API_KEY ${present("ANTHROPIC_API_KEY")} · OPENAI_API_KEY ${present("OPENAI_API_KEY")}`,
);
