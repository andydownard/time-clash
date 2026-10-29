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
    'missile',
    'soldier',
    'army',
    'troops',
    'war',
    'shoot',
  ]),
  ...['buy', 'die'].map((word) => ({
    file: 'src/questions/homophones.ts',
    word,
    reason: 'A homophone list has to contain the words that sound alike. Never shown to a child.',
  })),
  ...[['src/game/upgrades.ts', 'missile']].map(([file, word]) => ({
    file: file as string,
    word: word as string,
    reason: 'An internal id kept for saves and art (shown name is Rocket). Never shown to a child.',
  })),
  {
    file: 'src/data/introScript.ts',
    word: 'shoot',
    text: '/audio/voice/intro-03-shoot-twice.m4a',
    reason:
      'A recorded clip file name. The card title and words were reworded; the file keeps its name.',
  },
  {
    file: 'src/questions/bank/reading-10.json',
    word: 'war',
    text: "High in the Arctic, a vault is tunneled deep into a frozen mountain. It holds duplicate packets of seeds from farms and gardens around the world, kept cold and dry. If drought, flood, or war wipes out a crop in one country, scientists can request seeds from the vault and plant again. Few visitors ever see the shelves, yet the vault works like an insurance policy for the planet's food supply.",
    reason: 'Real-world reading passage, not about fighting. Question text is never spoken.',
  },
  {
    file: 'src/questions/bank/reading-10.json',
    word: 'shoot',
    text: 'When wolves were brought back to a large national park, the change reached far beyond the wolves themselves. Elk, no longer free to graze by the rivers all day, moved on, and willow and aspen shoots began to recover along the banks. Beavers returned to use the willows, and their dams created ponds for birds and fish. Ecologists call such a chain of effects a trophic cascade.',
    reason: 'Real-world reading passage, not about fighting. Question text is never spoken.',
  },
  {
    file: 'src/questions/bank/reading-6.json',
    word: 'shoot',
    text: 'Players enjoyed climbing more than shooting.',
    reason: 'Real-world reading passage, not about fighting. Question text is never spoken.',
  },
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
