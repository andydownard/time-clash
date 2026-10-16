// Copy lint (AGENTS.md risk 1): no banned word in any string literal that could reach a child.
// Scans src/**/*.ts, src/**/*.json (this includes the question bank), public/*.html, index.html.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { applyAllowlist, scanRepo, type AllowEntry } from './data/copyLintScan';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

/**
 * Places where a banned word is correct. Each entry names one file, one word, and why.
 * Keep this list short. tests/data/copyLintScan.test.ts proves it cannot hide other words.
 */
const BLOCKLIST_REASON = 'A name blocklist has to contain the words it blocks.';
const blocklistEntries = (file: string, words: readonly string[]): AllowEntry[] =>
  words.map((word) => ({ file, word, reason: BLOCKLIST_REASON }));

export const ALLOWLIST: readonly AllowEntry[] = [
  ...blocklistEntries('src/ui/nameBlocklist.ts', [
    'kill',
    'die',
    'dead',
    'blood',
    'gore',
    'defeat',
  ]),
  ...['buy', 'die'].map((word) => ({
    file: 'src/questions/homophones.ts',
    word,
    reason: 'A homophone list has to contain the words that sound alike. Never shown to a child.',
  })),
  ...blocklistEntries('src/game/names.ts', ['kill', 'die', 'dead', 'blood', 'gore']),
];

describe('copy lint: real repo', () => {
  const { files, findings } = scanRepo(ROOT);
  const result = applyAllowlist(findings, ALLOWLIST);

  it('scans a healthy number of source files', () => {
    expect(files.filter((f) => f.startsWith('src/') && f.endsWith('.ts')).length).toBeGreaterThan(
      10,
    );
    expect(files).toContain('index.html');
  });

  it('finds no banned words in any string literal', () => {
    const lines = result.remaining.map((f) => `${f.file}:${f.line} "${f.word}" in "${f.text}"`);
    expect(lines).toEqual([]);
  });

  it('has no stale or broken allowlist entries', () => {
    expect(result.invalid).toEqual([]);
    expect(result.unused).toEqual([]);
  });
});

describe('copy lint: scanner reaches every kind of file (canary)', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'tc-lint-'));
  afterAll(() => rmSync(tmp, { recursive: true, force: true }));

  mkdirSync(join(tmp, 'src', 'questions', 'bank'), { recursive: true });
  mkdirSync(join(tmp, 'src', 'ui'), { recursive: true });
  mkdirSync(join(tmp, 'public', 'deep'), { recursive: true });
  writeFileSync(
    join(tmp, 'src', 'questions', 'bank', 'math-3.json'),
    JSON.stringify({ questions: [{ prompt: 'What is the price of 3 pens?' }] }),
  );
  writeFileSync(join(tmp, 'src', 'ui', 'a.ts'), `export const A = 'Do not kill the fun';`);
  writeFileSync(join(tmp, 'public', 'page.html'), '<p>You can buy it</p>');
  writeFileSync(join(tmp, 'public', 'deep', 'ignored.html'), '<p>blood</p>');
  writeFileSync(join(tmp, 'index.html'), '<title>Dead end</title>');

  it('catches a banned word in question bank JSON', () => {
    const { findings } = scanRepo(tmp);
    expect(findings).toContainEqual(
      expect.objectContaining({ file: 'src/questions/bank/math-3.json', word: 'price' }),
    );
  });

  it('catches TS, public html, and index.html', () => {
    const { findings } = scanRepo(tmp);
    const hits = findings.map((f) => `${f.file}:${f.word}`);
    expect(hits).toEqual(
      expect.arrayContaining(['src/ui/a.ts:kill', 'public/page.html:buy', 'index.html:dead']),
    );
  });

  it('only scans public/*.html at the top level', () => {
    const { files } = scanRepo(tmp);
    expect(files).not.toContain('public/deep/ignored.html');
  });

  it('an allowlist entry clears exactly its finding', () => {
    const { findings } = scanRepo(tmp);
    const r = applyAllowlist(findings, [{ file: 'src/ui/a.ts', word: 'kill', reason: 'canary' }]);
    expect(r.remaining.map((f) => f.file)).not.toContain('src/ui/a.ts');
    expect(r.remaining.length).toBe(findings.length - 1);
  });
});
