// The owner removed audio questions and read-aloud on 2026-10-23: "all grades must read".
// These tests pin the rule against the real bank.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Question } from '../../src/questions/types';
import { KINDS } from '../../src/questions/validate';

const dir = join(__dirname, '../../src/questions/bank');
const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
const all: Question[] = files.flatMap((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')));

describe('every question is answerable by reading', () => {
  it('loads the real bank', () => {
    expect(files.length).toBe(26);
    expect(all.length).toBeGreaterThan(2000);
  });

  it('no bank question has kind sightword or an audioWord', () => {
    expect(all.filter((q) => (q.kind as string) === 'sightword').map((q) => q.id)).toEqual([]);
    expect(all.filter((q) => 'audioWord' in q).map((q) => q.id)).toEqual([]);
    expect(KINDS as readonly string[]).not.toContain('sightword');
  });

  it('no prompt asks the player to hear or listen', () => {
    const bad = all.filter((q) =>
      /\b(you hear|listen to|listen for|hear the|tap the word you)\b/i.test(q.prompt),
    );
    expect(bad.map((q) => `${q.id}: ${q.prompt}`)).toEqual([]);
  });

  it('every question has a readable prompt and four readable choices that include the answer', () => {
    for (const q of all) {
      expect(q.prompt.trim().length, q.id).toBeGreaterThan(0);
      expect(q.choices, q.id).toHaveLength(4);
      for (const c of q.choices) expect(c.trim().length, q.id).toBeGreaterThan(0);
      expect(q.choices, q.id).toContain(q.answer);
    }
  });
});
