/**
 * HC-2 guard (spec §11.8, §12): no network calls anywhere in the engine except
 * `analyzers/showtime/llmFormatter.ts`.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

const ROOT = path.resolve(__dirname, '..');
const ALLOWED = path.join('analyzers', 'showtime', 'llmFormatter.ts');
const NETWORK_RE = /\b(fetch|axios|XMLHttpRequest)\b/;

function collectSourceFiles(dir: string, acc: string[]): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === '__fixtures__') continue;
      collectSourceFiles(full, acc);
    } else if (entry.name.endsWith('.ts')) {
      acc.push(full);
    }
  }
}

describe('HC-2 — no network calls outside llmFormatter (§11.8)', () => {
  it('grep finds fetch/axios/XMLHttpRequest only in llmFormatter.ts', () => {
    const files: string[] = [];
    collectSourceFiles(ROOT, files);
    const offenders: string[] = [];
    for (const file of files) {
      const rel = path.relative(ROOT, file);
      if (rel === ALLOWED) continue;
      const src = fs.readFileSync(file, 'utf8');
      if (NETWORK_RE.test(src)) offenders.push(rel);
    }
    expect(offenders).toEqual([]);
  });
});
